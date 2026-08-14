import type { Endpoint, PayloadRequest } from 'payload'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek.js'

import { isAdmin } from '../access/adminOnly'

dayjs.extend(isoWeek)

/**
 * Aggregates registration + engagement numbers for the admin "Users & Engagement"
 * page: signups over time, and how many distinct users actually use the daily
 * check-in and the trade replay.
 *
 * Everything is computed in memory from a handful of `find` calls — the volumes
 * here are hundreds/thousands of rows, and this keeps the query logic in Payload
 * rather than raw SQL.
 */

type Granularity = 'day' | 'week' | 'month'

type Bucket = {
  key: string
  label: string
  newUsers: number
  cumulativeUsers: number
  checkInUsers: number
  replayUsers: number
}

const asId = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return id === undefined || id === null ? null : String(id)
  }
  return String(value)
}

const startOfBucket = (date: dayjs.Dayjs, granularity: Granularity): dayjs.Dayjs =>
  granularity === 'week' ? date.startOf('isoWeek') : date.startOf(granularity)

const bucketLabel = (date: dayjs.Dayjs, granularity: Granularity): string => {
  if (granularity === 'month') return date.format('MMM YYYY')
  if (granularity === 'week') return `w/c ${date.format('D MMM')}`
  return date.format('D MMM')
}

/** Picks a granularity that keeps the x-axis readable for the chosen span. */
const autoGranularity = (start: dayjs.Dayjs, end: dayjs.Dayjs): Granularity => {
  const days = end.diff(start, 'day')
  if (days <= 45) return 'day'
  if (days <= 240) return 'week'
  return 'month'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const findAll = async (req: PayloadRequest, collection: any, where?: any) => {
  const result = await req.payload.find({
    collection,
    where,
    depth: 0,
    pagination: false,
    limit: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result?.docs ?? []) as any[]
}

export const userEngagementStats: Endpoint = {
  path: '/engagement-stats',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    if (!isAdmin({ req })) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    try {
      const endParam = req.query?.end as string | undefined
      const startParam = req.query?.start as string | undefined
      const granularityParam = req.query?.granularity as Granularity | 'auto' | undefined
      const excludeAdmins = req.query?.excludeAdmins !== 'false'

      const end = (endParam ? dayjs(endParam) : dayjs()).endOf('day')

      const [users, checkIns, replays, submissions] = await Promise.all([
        findAll(req, 'users'),
        findAll(req, 'mental-check-ins'),
        findAll(req, 'gym-activity'),
        findAll(req, 'trade-submissions'),
      ])

      const adminIds = new Set(
        users.filter((u) => (u.roles ?? []).includes('admin')).map((u) => String(u.id)),
      )
      const countedUsers = excludeAdmins
        ? users.filter((u) => !adminIds.has(String(u.id)))
        : users
      const isCounted = (userId: string | null): userId is string =>
        Boolean(userId) && (!excludeAdmins || !adminIds.has(userId as string))

      // Default start: the first signup, so "all time" needs no magic constant.
      const earliestSignup = countedUsers.reduce<dayjs.Dayjs | null>((earliest, u) => {
        const created = dayjs(u.createdAt)
        if (!created.isValid()) return earliest
        return !earliest || created.isBefore(earliest) ? created : earliest
      }, null)
      const start = (startParam ? dayjs(startParam) : (earliestSignup ?? end.subtract(1, 'year')))
        .startOf('day')

      const granularity: Granularity =
        granularityParam && granularityParam !== 'auto'
          ? granularityParam
          : autoGranularity(start, end)

      /* ── Build the empty bucket timeline ── */
      const buckets: Bucket[] = []
      const indexByKey = new Map<string, number>()
      let cursor = startOfBucket(start, granularity)
      const lastBucket = startOfBucket(end, granularity)
      // Hard stop so a silly date range can't spin forever.
      while (!cursor.isAfter(lastBucket) && buckets.length < 400) {
        const key = cursor.format('YYYY-MM-DD')
        indexByKey.set(key, buckets.length)
        buckets.push({
          key,
          label: bucketLabel(cursor, granularity),
          newUsers: 0,
          cumulativeUsers: 0,
          checkInUsers: 0,
          replayUsers: 0,
        })
        cursor = cursor.add(1, granularity === 'week' ? 'week' : granularity)
      }

      const bucketIndexFor = (value: unknown): number | null => {
        const date = dayjs(value as string)
        if (!date.isValid()) return null
        const idx = indexByKey.get(startOfBucket(date, granularity).format('YYYY-MM-DD'))
        return idx === undefined ? null : idx
      }

      /* ── Registrations ── */
      let usersBeforeRange = 0
      countedUsers.forEach((u) => {
        const created = dayjs(u.createdAt)
        if (!created.isValid()) return
        if (created.isBefore(start)) {
          usersBeforeRange += 1
          return
        }
        const idx = bucketIndexFor(u.createdAt)
        if (idx !== null && buckets[idx]) buckets[idx].newUsers += 1
      })

      let running = usersBeforeRange
      buckets.forEach((bucket) => {
        running += bucket.newUsers
        bucket.cumulativeUsers = running
      })

      /* ── Distinct active users per bucket ── */
      const checkInUsersPerBucket = buckets.map(() => new Set<string>())
      const replayUsersPerBucket = buckets.map(() => new Set<string>())

      // Adoption counters, scoped to the selected range.
      const checkInUsersInRange = new Set<string>()
      const replayUsersInRange = new Set<string>()
      const submissionUsersInRange = new Set<string>()
      let checkInsInRange = 0
      let replaysInRange = 0
      let replaySecondsInRange = 0
      let submissionsInRange = 0

      checkIns.forEach((doc) => {
        const completedAt = doc.preMarket?.completedAt || doc.postMarket?.completedAt
        if (!completedAt) return
        const userId = asId(doc.user)
        if (!isCounted(userId)) return
        // `date` is the day the check-in is *for* — the meaningful axis here.
        const idx = bucketIndexFor(doc.date ?? completedAt)
        if (idx === null) return
        checkInUsersPerBucket[idx]?.add(userId)
        checkInUsersInRange.add(userId)
        checkInsInRange += 1
      })

      replays.forEach((doc) => {
        const userId = asId(doc.user)
        if (!isCounted(userId)) return
        const idx = bucketIndexFor(doc.createdAt)
        if (idx === null) return
        replayUsersPerBucket[idx]?.add(userId)
        replayUsersInRange.add(userId)
        replaysInRange += 1
        replaySecondsInRange += Number(doc.durationSeconds) || 0
      })

      submissions.forEach((doc) => {
        const userId = asId(doc.user)
        if (!isCounted(userId)) return
        const idx = bucketIndexFor(doc.createdAt)
        if (idx === null) return
        submissionUsersInRange.add(userId)
        submissionsInRange += 1
      })

      buckets.forEach((bucket, i) => {
        bucket.checkInUsers = checkInUsersPerBucket[i]?.size ?? 0
        bucket.replayUsers = replayUsersPerBucket[i]?.size ?? 0
      })

      const activeInRange = new Set<string>([
        ...checkInUsersInRange,
        ...replayUsersInRange,
        ...submissionUsersInRange,
      ])

      const newUsersInRange = buckets.reduce((sum, b) => sum + b.newUsers, 0)

      /* ── "How many, and when" — absolute windows, independent of the filter ── */
      const signupsSince = (days: number): number => {
        const cutoff = dayjs().subtract(days, 'day').startOf('day')
        return countedUsers.filter((u) => {
          const created = dayjs(u.createdAt)
          return created.isValid() && !created.isBefore(cutoff)
        }).length
      }

      const recentSignups = [...countedUsers]
        .filter((u) => dayjs(u.createdAt).isValid())
        .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf())
        .slice(0, 20)
        .map((u) => ({
          id: String(u.id),
          name: u.name ?? null,
          email: u.email ?? null,
          createdAt: u.createdAt,
        }))

      const firstSignup = earliestSignup ? earliestSignup.format('YYYY-MM-DD') : null
      const latestSignup = recentSignups[0]?.createdAt ?? null

      return Response.json({
        success: true,
        range: {
          start: start.format('YYYY-MM-DD'),
          end: end.format('YYYY-MM-DD'),
          granularity,
          excludeAdmins,
        },
        totals: {
          registeredUsers: countedUsers.length,
          newUsersInRange,
          activeUsersInRange: activeInRange.size,
          checkInsInRange,
          replaysInRange,
          replayHoursInRange: Number((replaySecondsInRange / 3600).toFixed(1)),
          submissionsInRange,
        },
        adoption: {
          registeredUsers: countedUsers.length,
          checkInUsers: checkInUsersInRange.size,
          replayUsers: replayUsersInRange.size,
          submissionUsers: submissionUsersInRange.size,
        },
        signups: {
          today: signupsSince(0),
          last7Days: signupsSince(7),
          last30Days: signupsSince(30),
          last90Days: signupsSince(90),
          last12Months: signupsSince(365),
          allTime: countedUsers.length,
          firstSignup,
          latestSignup,
        },
        recentSignups,
        buckets,
      })
    } catch (error) {
      req.payload.logger.error(`Error building user engagement stats: ${error}`)
      return Response.json(
        { success: false, error: 'Failed to build engagement stats' },
        { status: 500 },
      )
    }
  },
}
