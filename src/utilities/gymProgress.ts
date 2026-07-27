import type { Payload } from 'payload'

/**
 * Gym progress: points economy + level ladder.
 *
 * Points are never stored as a running total — they are always derived:
 *   - replay completions: points stored per gym-activity row (first vs repeat)
 *   - study time: 1 pt per full minute, summed from gym-activity durations
 *   - submissions: counted straight from trade-submissions (so pre-existing
 *     submissions are credited retroactively and deletes self-correct)
 */

export const GYM_POINTS = {
  replayFirstComplete: 50,
  replayRepeatComplete: 10,
  perStudyMinute: 1,
  submission: 100,
  submissionReviewedBonus: 50,
} as const

/** Max study time accepted per replay session (guards against forged durations) */
export const MAX_SESSION_SECONDS = 3 * 60 * 60

export interface GymLevel {
  level: number
  minPoints: number
  title: string
  avatar: string
}

export const GYM_LEVELS: GymLevel[] = [
  { level: 1, minPoints: 0, title: 'Gym Rookie', avatar: '🐣' },
  { level: 2, minPoints: 150, title: 'Chart Watcher', avatar: '🐰' },
  { level: 3, minPoints: 400, title: 'Candle Counter', avatar: '🦉' },
  { level: 4, minPoints: 800, title: 'Breakout Scout', avatar: '🦊' },
  { level: 5, minPoints: 1500, title: 'Momentum Hunter', avatar: '🐺' },
  { level: 6, minPoints: 2500, title: 'Swing Surgeon', avatar: '🦅' },
  { level: 7, minPoints: 4000, title: 'Risk Tamer', avatar: '🦁' },
  { level: 8, minPoints: 6000, title: 'Market Brute', avatar: '👹' },
  { level: 9, minPoints: 9000, title: 'Trading Dragon', avatar: '🐉' },
  { level: 10, minPoints: 13000, title: 'Gym GOAT', avatar: '🐐' },
]

export const levelForPoints = (points: number): GymLevel => {
  let current: GymLevel = { level: 1, minPoints: 0, title: 'Gym Rookie', avatar: '🐣' }
  for (const lvl of GYM_LEVELS) {
    if (points >= lvl.minPoints) current = lvl
  }
  return current
}

export interface GymProgress {
  totalPoints: number
  level: GymLevel
  nextLevel: GymLevel | null
  stats: {
    replaysCompleted: number
    uniqueReplaysCompleted: number
    totalStudySeconds: number
    submissions: number
    reviewedSubmissions: number
  }
  levels: GymLevel[]
}

export async function getGymProgress(payload: Payload, userId: string | number): Promise<GymProgress> {
  const activities = await payload.find({
    collection: 'gym-activity',
    where: { user: { equals: userId } },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })

  let completionPoints = 0
  let replaysCompleted = 0
  let totalStudySeconds = 0
  const uniqueCompleted = new Set<string>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const doc of activities.docs as any[]) {
    totalStudySeconds += Number(doc.durationSeconds) || 0
    if (doc.completed) {
      replaysCompleted += 1
      completionPoints += Number(doc.points) || 0
      uniqueCompleted.add(`${doc.source}:${doc.refId}`)
    }
  }

  const [submissions, reviewedSubmissions] = await Promise.all([
    payload.count({
      collection: 'trade-submissions',
      where: { user: { equals: userId } },
      overrideAccess: true,
    }),
    payload.count({
      collection: 'trade-submissions',
      where: {
        and: [{ user: { equals: userId } }, { reviewStatus: { equals: 'reviewed' } }],
      },
      overrideAccess: true,
    }),
  ])

  const totalPoints =
    completionPoints +
    Math.floor(totalStudySeconds / 60) * GYM_POINTS.perStudyMinute +
    submissions.totalDocs * GYM_POINTS.submission +
    reviewedSubmissions.totalDocs * GYM_POINTS.submissionReviewedBonus

  const level = levelForPoints(totalPoints)
  const nextLevel = GYM_LEVELS.find((l) => l.minPoints > totalPoints) ?? null

  return {
    totalPoints,
    level,
    nextLevel,
    stats: {
      replaysCompleted,
      uniqueReplaysCompleted: uniqueCompleted.size,
      totalStudySeconds,
      submissions: submissions.totalDocs,
      reviewedSubmissions: reviewedSubmissions.totalDocs,
    },
    levels: GYM_LEVELS,
  }
}
