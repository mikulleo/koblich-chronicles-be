/**
 * Gym progress mock-data seeder — puts a user at any level so the progress card,
 * avatars and roadmap can be eyeballed on the site.
 *
 * Usage (from koblich-chronicles-be) — NOTE: `payload run` swallows --flags, so
 * options are passed as bare `key=value` positionals:
 *   pnpm seed:gym email=gym-demo@local.test create-user level=5
 *   pnpm seed:gym email=gym-demo@local.test level=10 submissions=6 reviewed=3
 *   pnpm seed:gym email=gym-demo@local.test points=3200
 *   pnpm seed:gym email=gym-demo@local.test show
 *   pnpm seed:gym email=gym-demo@local.test clear clear-submissions
 *
 * Options: email, password, create-user, level (1-10), points, fill (0-0.95,
 * how far into the level band to land — default 0.45), submissions, reviewed,
 * days (history spread, default 90), seed (PRNG seed), clear, clear-submissions,
 * show, dry-run, force.
 *
 * Points are derived server-side (see utilities/gymProgress.ts), so the seeder
 * doesn't write a total anywhere — it back-solves a plausible history:
 * first/repeat replay completions + study minutes + submissions that add up to
 * exactly the requested points, then re-reads getGymProgress to verify.
 *
 * Safety: refuses to touch a non-local DATABASE_URI unless --force is passed.
 */

import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import {
  GYM_LEVELS,
  GYM_POINTS,
  MAX_SESSION_SECONDS,
  getGymProgress,
  levelForPoints,
} from '../utilities/gymProgress'

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

interface Options {
  email: string
  password: string
  createUser: boolean
  level?: number
  points?: number
  fill: number
  submissions?: number
  reviewed?: number
  days: number
  seed: number
  clear: boolean
  clearSubmissions: boolean
  show: boolean
  dryRun: boolean
  force: boolean
}

/** Marker written into seeded submissions so --clear never eats real ones */
const SEED_MARKER = '[SEEDED_GYM_MOCK]'

const parseArgs = (rawArgv: string[]): Options => {
  // `payload run` re-writes process.argv to positionals only (minimist eats the
  // --flags), so accept both `key=value` and `--key=value`.
  const argv = rawArgv.map((a) => a.replace(/^--/, ''))
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a === name || a.startsWith(`${name}=`))
    if (!hit) return undefined
    const idx = hit.indexOf('=')
    return idx === -1 ? 'true' : hit.slice(idx + 1)
  }
  const num = (name: string): number | undefined => {
    const raw = get(name)
    if (raw === undefined) return undefined
    const parsed = Number(raw)
    if (!Number.isFinite(parsed)) throw new Error(`--${name} must be a number (got "${raw}")`)
    return parsed
  }
  const flag = (name: string): boolean => get(name) === 'true'

  return {
    email: (get('email') ?? 'gym-demo@local.test').toLowerCase(),
    password: get('password') ?? 'GymDemo123!',
    createUser: flag('create-user'),
    level: num('level'),
    points: num('points'),
    fill: num('fill') ?? 0.45,
    submissions: num('submissions'),
    reviewed: num('reviewed'),
    days: num('days') ?? 90,
    seed: num('seed') ?? 42,
    clear: flag('clear'),
    clearSubmissions: flag('clear-submissions'),
    show: flag('show'),
    dryRun: flag('dry-run'),
    force: flag('force'),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG so re-running with the same --seed rebuilds the same history */
const mulberry32 = (a: number) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const isLocalDb = (uri: string | undefined): boolean =>
  !!uri && /@(localhost|127\.0\.0\.1|postgres)[:/]/.test(uri)

interface PlannedSession {
  refId: string
  completed: boolean
  firstCompletion: boolean
  durationSeconds: number
  points: number
  daysAgo: number
}

/**
 * Back-solve a session history worth exactly `targetPoints`:
 * ~45% of points from first completions, ~10% from repeats, the rest from
 * study minutes (1 pt/min), spread over `days` days.
 */
const planSessions = (
  targetPoints: number,
  tradeIds: string[],
  opts: { days: number; rand: () => number },
): PlannedSession[] => {
  const { days, rand } = opts
  if (targetPoints <= 0 || tradeIds.length === 0) return []

  const maxFirsts = Math.min(tradeIds.length, Math.floor((targetPoints * 0.45) / GYM_POINTS.replayFirstComplete))
  const firsts = Math.max(1, maxFirsts)
  let completionPoints = firsts * GYM_POINTS.replayFirstComplete

  let repeats = Math.floor((targetPoints * 0.1) / GYM_POINTS.replayRepeatComplete)
  // Never let completions alone overshoot the target — study time must stay >= 0
  while (repeats > 0 && completionPoints + repeats * GYM_POINTS.replayRepeatComplete > targetPoints) {
    repeats -= 1
  }
  completionPoints += repeats * GYM_POINTS.replayRepeatComplete

  // A single first completion can already overshoot a tiny target; drop repeats
  // and let the study budget be 0 in that case.
  const studyMinutesBudget = Math.max(0, targetPoints - completionPoints)

  const sessions: PlannedSession[] = []
  const pushSession = (s: PlannedSession) => sessions.push(s)

  for (let i = 0; i < firsts; i++) {
    pushSession({
      refId: tradeIds[i],
      completed: true,
      firstCompletion: true,
      durationSeconds: 0,
      points: GYM_POINTS.replayFirstComplete,
      daysAgo: Math.floor(rand() * days),
    })
  }
  for (let i = 0; i < repeats; i++) {
    pushSession({
      refId: tradeIds[Math.floor(rand() * Math.min(firsts, tradeIds.length))],
      completed: true,
      firstCompletion: false,
      durationSeconds: 0,
      points: GYM_POINTS.replayRepeatComplete,
      daysAgo: Math.floor(rand() * days),
    })
  }

  // Hand out study minutes: 6–35 min per replay session first, then top up with
  // study-only sessions until the budget is spent exactly.
  const maxMinutes = Math.floor(MAX_SESSION_SECONDS / 60)
  let left = studyMinutesBudget
  for (const s of sessions) {
    if (left <= 0) break
    const want = 6 + Math.floor(rand() * 30)
    const give = Math.min(want, left, maxMinutes)
    s.durationSeconds = give * 60
    left -= give
  }
  let guard = 0
  while (left > 0 && guard++ < 10000) {
    const give = Math.min(left, 10 + Math.floor(rand() * 80), maxMinutes)
    pushSession({
      refId: tradeIds[Math.floor(rand() * tradeIds.length)],
      completed: false,
      firstCompletion: false,
      durationSeconds: give * 60,
      points: 0,
      daysAgo: Math.floor(rand() * days),
    })
    left -= give
  }

  return sessions.sort((a, b) => b.daysAgo - a.daysAgo)
}

const dateDaysAgo = (daysAgo: number, rand: () => number): string => {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(8 + Math.floor(rand() * 12), Math.floor(rand() * 60), 0, 0)
  return d.toISOString()
}

const SEED_SYMBOLS = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMD', 'CRWD', 'PLTR', 'SMCI', 'META', 'NFLX']

const printProgress = (label: string, p: Awaited<ReturnType<typeof getGymProgress>>) => {
  const mins = Math.floor(p.stats.totalStudySeconds / 60)
  console.log(
    `${label}: ${p.totalPoints} pts — L${p.level.level} ${p.level.avatar} ${p.level.title}` +
      (p.nextLevel ? ` (next ${p.nextLevel.title} @ ${p.nextLevel.minPoints})` : ' (max)'),
  )
  console.log(
    `   replays ${p.stats.replaysCompleted} (${p.stats.uniqueReplaysCompleted} unique) · ` +
      `study ${Math.floor(mins / 60)}h ${mins % 60}m · ` +
      `submissions ${p.stats.submissions} (${p.stats.reviewedSubmissions} reviewed)`,
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const run = async () => {
  const opts = parseArgs(process.argv.slice(2))

  if (!isLocalDb(process.env.DATABASE_URI) && !opts.force) {
    console.error(
      `Refusing to seed: DATABASE_URI does not look local (${String(process.env.DATABASE_URI).replace(/:[^:@/]*@/, ':***@')}).\n` +
        `Point .env.local at the local Postgres, or pass --force if you really mean it.`,
    )
    process.exit(1)
  }

  const payload: Payload = await getPayload({ config })
  const rand = mulberry32(opts.seed)

  // --- user ---------------------------------------------------------------
  const existing = await payload.find({
    collection: 'users',
    where: { email: { equals: opts.email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  let user = existing.docs[0]
  if (!user) {
    if (!opts.createUser) {
      console.error(`No user with email ${opts.email}. Re-run with --create-user to make one.`)
      process.exit(1)
    }
    user = await payload.create({
      collection: 'users',
      data: {
        email: opts.email,
        password: opts.password,
        name: 'Gym Demo',
        roles: ['user'],
      },
      overrideAccess: true,
    })
    console.log(`Created user ${opts.email} (id ${user.id}) with password "${opts.password}"`)
  }
  const userId = user.id

  if (opts.show) {
    printProgress('Current', await getGymProgress(payload, userId))
    process.exit(0)
  }

  // --- clear --------------------------------------------------------------
  const clearActivity = async () => {
    const { docs } = await payload.find({
      collection: 'gym-activity',
      where: { user: { equals: userId } },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'gym-activity', id: doc.id, overrideAccess: true })
    }
    return docs.length
  }

  const clearSeededSubmissions = async () => {
    const { docs } = await payload.find({
      collection: 'trade-submissions',
      where: {
        and: [{ user: { equals: userId } }, { notes: { like: SEED_MARKER } }],
      },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'trade-submissions', id: doc.id, overrideAccess: true })
    }
    return docs.length
  }

  if (opts.clear || opts.clearSubmissions) {
    if (opts.dryRun) {
      console.log('[dry-run] would clear gym activity' + (opts.clearSubmissions ? ' + seeded submissions' : ''))
      process.exit(0)
    }
    const removedActivity = opts.clear ? await clearActivity() : 0
    const removedSubs = opts.clearSubmissions ? await clearSeededSubmissions() : 0
    console.log(`Cleared ${removedActivity} gym-activity rows, ${removedSubs} seeded submissions.`)
    if (opts.level === undefined && opts.points === undefined) {
      printProgress('Now', await getGymProgress(payload, userId))
      process.exit(0)
    }
  }

  // --- target -------------------------------------------------------------
  if (opts.level === undefined && opts.points === undefined) {
    console.error('Nothing to do — pass --level=<1-10> or --points=<n> (or --show / --clear).')
    process.exit(1)
  }

  let targetPoints: number
  if (opts.points !== undefined) {
    targetPoints = Math.max(0, Math.floor(opts.points))
  } else {
    const lvl = GYM_LEVELS.find((l) => l.level === opts.level)
    if (!lvl) {
      console.error(`--level must be 1..${GYM_LEVELS.length}`)
      process.exit(1)
      return
    }
    const next = GYM_LEVELS.find((l) => l.level === lvl.level + 1)
    // Land part-way into the level's band so the "next level" bar isn't empty
    targetPoints = next
      ? Math.round(lvl.minPoints + (next.minPoints - lvl.minPoints) * Math.min(Math.max(opts.fill, 0), 0.95))
      : lvl.minPoints + 500
  }

  // --- submissions --------------------------------------------------------
  // Submission points are counted live from trade-submissions, so they have to
  // be created (or already exist) before the replay history is back-solved.
  const wantSubs = opts.submissions
  const wantReviewed = Math.min(opts.reviewed ?? 0, wantSubs ?? 0)
  const plannedSubmissions: { symbol: string; reviewed: boolean }[] = []
  if (wantSubs !== undefined && wantSubs > 0) {
    for (let i = 0; i < wantSubs; i++) {
      plannedSubmissions.push({
        symbol: SEED_SYMBOLS[i % SEED_SYMBOLS.length],
        reviewed: i < wantReviewed,
      })
    }
  }

  // --- trades to reference ------------------------------------------------
  const trades = await payload.find({
    collection: 'trades',
    limit: 300,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  })
  const tradeIds = trades.docs.map((t) => String(t.id))
  if (tradeIds.length === 0) {
    console.error('No trades in this database to reference as replays.')
    process.exit(1)
  }

  if (opts.dryRun) {
    const submissionPoints =
      plannedSubmissions.length * GYM_POINTS.submission +
      plannedSubmissions.filter((s) => s.reviewed).length * GYM_POINTS.submissionReviewedBonus
    const plan = planSessions(Math.max(0, targetPoints - submissionPoints), tradeIds, {
      days: opts.days,
      rand,
    })
    const studyMin = plan.reduce((n, s) => n + s.durationSeconds, 0) / 60
    console.log(
      `[dry-run] target ${targetPoints} pts → ${plan.length} sessions ` +
        `(${plan.filter((s) => s.completed).length} completions, ${studyMin} study minutes), ` +
        `${plannedSubmissions.length} submissions`,
    )
    process.exit(0)
  }

  for (const sub of plannedSubmissions) {
    const entry = 100 + Math.round(rand() * 200)
    const created = await payload.create({
      collection: 'trade-submissions',
      data: {
        user: userId,
        tickerSymbol: sub.symbol,
        tradeType: 'long',
        entryDate: dateDaysAgo(Math.floor(rand() * opts.days) + 10, rand),
        entryPrice: entry,
        positionSizePct: 100,
        initialStopLoss: Math.round(entry * 0.93 * 100) / 100,
        exits: [
          {
            date: dateDaysAgo(Math.floor(rand() * 8), rand),
            price: Math.round(entry * (1 + rand() * 0.25) * 100) / 100,
            sizePct: 100,
          },
        ],
        notes: `${SEED_MARKER} mock submission for gym progress screenshots`,
        makePublic: true,
        reviewStatus: sub.reviewed ? 'reviewed' : 'pending',
      },
      overrideAccess: true,
    })
    // reviewStatus is admin-only on create; force it when a reviewed one is wanted
    if (sub.reviewed) {
      await payload.update({
        collection: 'trade-submissions',
        id: created.id,
        data: { reviewStatus: 'reviewed' },
        overrideAccess: true,
      })
    }
  }

  // Whatever submissions the user has (seeded or real) already count — the
  // replay history only has to make up the difference.
  const afterSubs = await getGymProgress(payload, userId)
  const submissionPoints =
    afterSubs.stats.submissions * GYM_POINTS.submission +
    afterSubs.stats.reviewedSubmissions * GYM_POINTS.submissionReviewedBonus

  if (submissionPoints > targetPoints) {
    console.warn(
      `Submissions alone are worth ${submissionPoints} pts, more than the ${targetPoints} pt target — ` +
        `no replay history added.`,
    )
  }

  const plan = planSessions(Math.max(0, targetPoints - submissionPoints), tradeIds, {
    days: opts.days,
    rand,
  })

  for (const s of plan) {
    const when = dateDaysAgo(s.daysAgo, rand)
    await payload.create({
      collection: 'gym-activity',
      data: {
        user: userId,
        source: 'trade',
        refId: s.refId,
        completed: s.completed,
        firstCompletion: s.firstCompletion,
        durationSeconds: s.durationSeconds,
        points: s.points,
        createdAt: when,
        updatedAt: when,
      },
      overrideAccess: true,
    })
  }

  // --- verify -------------------------------------------------------------
  const progress = await getGymProgress(payload, userId)
  printProgress('Seeded', progress)

  const expectedLevel = levelForPoints(targetPoints)
  const ok =
    progress.totalPoints === targetPoints && progress.level.level === expectedLevel.level
  if (!ok) {
    console.error(
      `VERIFY FAILED — wanted ${targetPoints} pts / L${expectedLevel.level}, ` +
        `got ${progress.totalPoints} pts / L${progress.level.level}`,
    )
    process.exit(1)
  }
  console.log(`Verified: exactly ${targetPoints} pts, level ${progress.level.level}. ✅`)
  process.exit(0)
}

// Top-level await is required: `payload run` calls process.exit(0) as soon as this
// module finishes loading, so a detached promise would be killed at the first await.
try {
  await run()
} catch (err) {
  console.error(err)
  process.exit(1)
}
