import type { PayloadRequest } from 'payload'
import { generateMindsetEvaluation } from './claudeClient'
import { PATTERN_TAXONOMY } from './mindsetPatterns'
import { formatThreePsForPrompt } from './threePs'
import {
  findLastActionStep,
  formatActionJournalForPrompt,
  isActionJournalUser,
  sanitizeActionJournal,
  tallyPillars,
} from './actionJournal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCollection = any

/**
 * On-demand "Prepare for coaching" brief for Action Journal users.
 *
 * Replaces the per-evaluation "Bring to your next coaching session" line: rather
 * than one suggestion per day (which piles up into noise), the trader asks for a
 * single brief covering a whole period from the Insights dashboard. Nothing is
 * persisted — the FE caches the latest brief per period.
 */

const SYSTEM_PROMPT = `You are helping a discretionary trader prepare for their next session with their trading-performance coach (Steven Goldstein). The trader journals with a 3-3-1 method (3 things I did well, 3 things for improvement, 1 action step) across three pillars:
- Self-State (Being): cognitive clarity vs reactive, fatigued or emotionally hijacked
- Process Adherence: trading their proven edge vs "freestyling"
- Market Engagement (Behaviours): keeping agency vs letting volatility dictate behaviour

You receive every check-in, journal entry, discipline log, daily AI evaluation and coaching-session summary for a chosen period. Your job is to pick the ONE thing most worth spending coaching time on, for the whole period — not a recap of each day.

How to choose:
- Reveal, don't restate. Counting what the trader already logged ("you tagged FOMO 4 times") is not insight. Cross-reference sources to surface something they probably haven't connected: e.g. a pre-market flag that precedes a post-market trap, an action step that keeps being rewritten but never followed, a gap between how they rate themselves and what the discipline log shows, a theme from the last coaching session that went quiet or got worse.
- Prefer a theme with evidence on several dates over a single dramatic day.
- If the last coaching session left commitments, check whether the data shows them being lived.
- Cite concrete dates (YYYY-MM-DD) and the trader's own words where useful.
- Frame the coaching question as something open the trader can actually ask the coach — not advice to themselves.
- NEVER suggest paper trading, simulated trading or demo accounts.
- Be brief and plain. Every string is one to three sentences.

Fields:
- periodSummary: two or three sentences on what defined this period.
- mainTopic: the single thing to bring. title (short), whyNow (the cross-referenced evidence, with dates), questionForCoach (one open question).
- supportingTopics: zero to two lesser themes worth a minute if time allows, same shape. Leave empty if nothing clears the bar.
- actionStepFollowThrough: how the action steps and coaching commitments in this period actually held up.
- progressToShare: up to three concrete wins worth naming in the session (the coach should hear what's working too).`

const TOPIC_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    whyNow: { type: 'string' },
    questionForCoach: { type: 'string' },
  },
  required: ['title', 'whyNow', 'questionForCoach'],
  additionalProperties: false,
} as const

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    periodSummary: { type: 'string' },
    mainTopic: TOPIC_SCHEMA,
    supportingTopics: { type: 'array', items: TOPIC_SCHEMA },
    actionStepFollowThrough: { type: 'string' },
    progressToShare: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'periodSummary',
    'mainTopic',
    'supportingTopics',
    'actionStepFollowThrough',
    'progressToShare',
  ],
  additionalProperties: false,
} as const

export interface CoachingPrepTopic {
  title: string
  whyNow: string
  questionForCoach: string
}

export interface CoachingPrep {
  periodSummary: string
  mainTopic: CoachingPrepTopic
  supportingTopics: CoachingPrepTopic[]
  actionStepFollowThrough: string
  progressToShare: string[]
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const PATTERN_LABELS: Record<string, string> = Object.fromEntries(
  PATTERN_TAXONOMY.map((p) => [p.code, p.label]),
)

const day = (value: unknown) => String(value ?? '').split('T')[0] || 'unknown'
const clip = (value: unknown, max: number) => {
  const s = typeof value === 'string' ? value.trim() : ''
  return s.length > max ? `${s.slice(0, max)}…` : s
}
const kv = (obj: Record<string, unknown> | null | undefined) =>
  Object.entries(obj ?? {})
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function sanitizeTopic(raw: unknown): CoachingPrepTopic {
  const t = (raw ?? {}) as Record<string, unknown>
  return { title: str(t.title), whyNow: str(t.whyNow), questionForCoach: str(t.questionForCoach) }
}

function sanitizePrep(raw: unknown): CoachingPrep {
  const p = (raw ?? {}) as Record<string, unknown>
  return {
    periodSummary: str(p.periodSummary),
    mainTopic: sanitizeTopic(p.mainTopic),
    supportingTopics: Array.isArray(p.supportingTopics)
      ? p.supportingTopics.slice(0, 2).map(sanitizeTopic).filter((t) => t.title)
      : [],
    actionStepFollowThrough: str(p.actionStepFollowThrough),
    progressToShare: Array.isArray(p.progressToShare)
      ? p.progressToShare.filter((s): s is string => typeof s === 'string' && !!s.trim()).slice(0, 3)
      : [],
  }
}

function countInto(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function formatCounts(map: Map<string, number>, label?: (k: string) => string): string {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${label ? label(k) : k} ×${n}`)
    .join(', ')
}

function formatCheckIn(ci: AnyCollection): string[] {
  const lines: string[] = []
  const parts = [`- ${day(ci.date)}`]
  const pre = ci.preMarket
  if (pre?.completedAt) {
    parts.push(`pre: ${kv(pre.ratings)}`)
    if (pre.contextFlags?.length) parts.push(`flags [${pre.contextFlags.join(',')}]`)
    if (pre.intentions?.length) parts.push(`intentions [${pre.intentions.join(',')}]`)
    if (pre.biggestRisk) parts.push(`predicted risk "${clip(pre.biggestRisk, 160)}"`)
  }
  const post = ci.postMarket
  if (post?.completedAt) {
    parts.push(`post: ${kv(post.ratings)}`)
    const behaviors = Object.entries(post.behaviors ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k)
    if (behaviors.length) parts.push(`behaviors [${behaviors.join(',')}]`)
    if (post.actualTraps?.length) parts.push(`traps [${post.actualTraps.join(',')}]`)
  }
  if (ci.analysis) {
    const a = ci.analysis
    if (a.intentionAdherence != null) parts.push(`adherence ${a.intentionAdherence}%`)
    if (a.stateConsistency != null) parts.push(`drift ${a.stateConsistency}`)
    if (a.riskPredictionAccuracy) parts.push(`risk prediction ${a.riskPredictionAccuracy}`)
  }
  lines.push(parts.join(' | '))

  if (pre?.completedAt) {
    lines.push(...formatThreePsForPrompt(pre.threePs, '    '))
    if (pre.notes?.trim()) lines.push(`    Pre-market notes: ${clip(pre.notes, 400)}`)
  }

  const r = post?.reflections
  if (r) {
    const aj = sanitizeActionJournal(r.actionJournal)
    if (aj) {
      lines.push(...formatActionJournalForPrompt(aj, '    '))
    } else {
      if (r.whatWentWell) lines.push(`    Went well: ${clip(r.whatWentWell, 300)}`)
      if (r.whatWentPoorly) lines.push(`    Went poorly: ${clip(r.whatWentPoorly, 300)}`)
      if (r.tomorrowFocus) lines.push(`    Tomorrow focus: ${clip(r.tomorrowFocus, 200)}`)
    }
    if (r.lessonsLearned) lines.push(`    Lessons: ${clip(r.lessonsLearned, 300)}`)
    if (r.emotionalHighlight) lines.push(`    Emotional highlight: ${clip(r.emotionalHighlight, 200)}`)
  }
  return lines
}

function formatJournal(j: AnyCollection, long: boolean): string[] {
  const lines = [`- ${day(j.date)} (${j.entryType}): ${clip(j.title, 120)}`]
  if (j.linkedTraps?.length) lines.push(`    Linked traps: ${j.linkedTraps.join(', ')}`)
  const aj = sanitizeActionJournal(j.actionJournal)
  if (aj) {
    lines.push(...formatActionJournalForPrompt(aj, '    '))
  } else {
    for (const gp of j.guidedPrompts ?? []) {
      if (gp?.response?.trim()) lines.push(`    Q: ${gp.prompt}`, `    A: ${clip(gp.response, long ? 800 : 300)}`)
    }
  }
  if (j.freeContent) lines.push(`    Notes: ${clip(j.freeContent, long ? 1200 : 400)}`)
  return lines
}

export function buildUserPrompt(input: {
  startDate: string | null
  endDate: string
  checkIns: AnyCollection[]
  journals: AnyCollection[]
  priorCoachingSession: AnyCollection | null
  disciplineLogs: AnyCollection[]
  evaluations: AnyCollection[]
  lastActionStep: Awaited<ReturnType<typeof findLastActionStep>>
}): string {
  const s: string[] = []
  const { checkIns, journals, disciplineLogs, evaluations } = input

  s.push(`## Period: ${input.startDate ?? 'all time'} → ${input.endDate}`)
  s.push(
    `Data: ${checkIns.length} check-ins, ${journals.length} journal entries, ${disciplineLogs.length} discipline logs, ${evaluations.length} daily AI evaluations`,
  )

  // Coaching sessions first — the brief should pick up where the last one left off.
  const sessions = journals.filter((j) => j.entryType === 'coaching_session_summary')
  if (input.priorCoachingSession) sessions.push(input.priorCoachingSession)
  s.push(`\n## Coaching Session Summaries (newest first)`)
  if (sessions.length === 0) s.push('- None recorded')
  for (const cs of sessions) s.push(...formatJournal(cs, true))

  s.push(`\n## Most Recent Action Step`)
  s.push(
    input.lastActionStep
      ? `- ${input.lastActionStep.date} (${input.lastActionStep.source}): ${input.lastActionStep.text}`
      : '- None recorded',
  )

  // Period-level tallies, so the model can spend its attention on connections
  // rather than counting.
  const traps = new Map<string, number>()
  const flags = new Map<string, number>()
  for (const ci of checkIns) {
    for (const t of ci.postMarket?.actualTraps ?? []) countInto(traps, t)
    for (const f of ci.preMarket?.contextFlags ?? []) countInto(flags, f)
  }
  const tags = new Map<string, number>()
  for (const ev of evaluations) {
    for (const t of ev.aiAnalysis?.patternTags ?? []) if (t?.code) countInto(tags, t.code)
  }
  const pillars = tallyPillars(
    [
      ...checkIns.map((c) => sanitizeActionJournal(c.postMarket?.reflections?.actionJournal)),
      ...journals.map((j) => sanitizeActionJournal(j.actionJournal)),
    ].filter((e): e is NonNullable<typeof e> => !!e),
  )
  s.push(`\n## Period Tallies`)
  if (traps.size) s.push(`- Traps logged: ${formatCounts(traps)}`)
  if (flags.size) s.push(`- Pre-market context flags: ${formatCounts(flags)}`)
  if (tags.size) s.push(`- AI pattern tags: ${formatCounts(tags, (k) => PATTERN_LABELS[k] ?? k)}`)
  if (pillars.length) s.push('- 3-3-1 pillar tags:', ...pillars.map((l) => `  ${l}`))

  s.push(`\n## Daily Check-Ins (newest first)`)
  for (const ci of checkIns) s.push(...formatCheckIn(ci))

  const otherJournals = journals.filter((j) => j.entryType !== 'coaching_session_summary')
  if (otherJournals.length) {
    s.push(`\n## Journal Entries (newest first)`)
    for (const j of otherJournals) s.push(...formatJournal(j, false))
  }

  if (disciplineLogs.length) {
    s.push(`\n## Discipline Logs`)
    for (const dl of disciplineLogs) {
      s.push(
        `- ${day(dl.date)}: compliance ${dl.summary?.complianceRate ?? 'N/A'}%, violated ${dl.summary?.violated ?? 0}`,
      )
      for (const e of dl.entries ?? []) {
        if (e?.status !== 'violated') continue
        const rule = typeof e.rule === 'object' ? e.rule?.title : e.rule
        s.push(`    Violated "${rule}" (state: ${e.mentalStateAtViolation || 'n/a'})`)
      }
    }
  }

  if (evaluations.length) {
    s.push(`\n## Daily AI Evaluations (score / focus given)`)
    for (const ev of evaluations) {
      const codes = (ev.aiAnalysis?.patternTags ?? []).map((t: AnyCollection) => t?.code).filter(Boolean)
      s.push(
        `- ${day(ev.date)}: score ${ev.aiAnalysis?.overallScore ?? 'N/A'}; focus "${clip(ev.aiAnalysis?.focusForTomorrow, 200)}"${codes.length ? `; tags [${codes.join(',')}]` : ''}`,
      )
    }
  }

  return s.join('\n')
}

/** POST /mindset-evaluations/coaching-prep — body { startDate?, endDate? } (YYYY-MM-DD). */
export async function coachingPrepHandler(req: PayloadRequest): Promise<Response> {
  if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isActionJournalUser(req.user)) {
    return Response.json({ error: 'Coaching prep is not enabled for this account' }, { status: 403 })
  }

  let body: { startDate?: unknown; endDate?: unknown } = {}
  try {
    if (typeof req.json === 'function') body = await req.json()
  } catch {
    // empty body = all time
  }
  const startDate = typeof body.startDate === 'string' && ISO_DATE.test(body.startDate) ? body.startDate : null
  const today = new Date().toISOString().split('T')[0]!
  const endDate = typeof body.endDate === 'string' && ISO_DATE.test(body.endDate) ? body.endDate : today

  let config: AnyCollection = {}
  try {
    config = await req.payload.findGlobal({ slug: 'mindset-config' as AnyCollection })
  } catch {
    // fall through to disabled
  }
  const aiConfig = config?.aiConfig || {}
  if (!aiConfig.enabled) {
    return Response.json({ error: 'AI evaluations are not enabled. Enable them in Mindset Config.' }, { status: 400 })
  }

  const userId = req.user.id
  const dateRange: Record<string, string> = { less_than_equal: `${endDate}T23:59:59.999Z` }
  if (startDate) dateRange.greater_than_equal = startDate
  const inRange = { user: { equals: userId }, date: dateRange }

  const dayAfterEnd = new Date(`${endDate}T00:00:00.000Z`)
  dayAfterEnd.setUTCDate(dayAfterEnd.getUTCDate() + 1)

  try {
    const [checkIns, journals, disciplineLogs, evaluations, priorSessions, lastActionStep] = await Promise.all([
      req.payload.find({
        collection: 'mental-check-ins' as AnyCollection,
        overrideAccess: true,
        where: inRange,
        sort: '-date',
        limit: 200,
        depth: 0,
      }),
      req.payload.find({
        collection: 'mindset-journal' as AnyCollection,
        overrideAccess: true,
        where: inRange,
        sort: '-date',
        limit: 150,
        depth: 0,
      }),
      req.payload.find({
        collection: 'discipline-log' as AnyCollection,
        overrideAccess: true,
        where: inRange,
        sort: '-date',
        limit: 200,
        depth: 1,
      }),
      req.payload.find({
        collection: 'mindset-evaluations' as AnyCollection,
        overrideAccess: true,
        where: { ...inRange, status: { equals: 'completed' } },
        sort: '-createdAt',
        limit: 300,
        depth: 0,
      }),
      // The session right before the window, so the brief can check whether
      // its commitments held up during the period.
      startDate
        ? req.payload.find({
            collection: 'mindset-journal' as AnyCollection,
            overrideAccess: true,
            where: {
              user: { equals: userId },
              entryType: { equals: 'coaching_session_summary' },
              date: { less_than: startDate },
            },
            sort: '-date',
            limit: 1,
            depth: 0,
          })
        : Promise.resolve({ docs: [] as AnyCollection[] }),
      findLastActionStep(req.payload, userId, dayAfterEnd.toISOString().split('T')[0]!),
    ])

    // Regenerations leave up to 3 evaluations per day — keep the newest only.
    const seenDays = new Set<string>()
    const dailyEvaluations = (evaluations.docs as AnyCollection[])
      .filter((ev) => {
        const d = day(ev.date)
        if (seenDays.has(d)) return false
        seenDays.add(d)
        return true
      })
      .sort((a, b) => (day(a.date) < day(b.date) ? 1 : -1))

    const checkInDocs = checkIns.docs as AnyCollection[]
    const journalDocs = journals.docs as AnyCollection[]
    if (checkInDocs.length === 0 && journalDocs.length === 0) {
      return Response.json(
        { error: 'No check-ins or journal entries in this period — pick a wider range.' },
        { status: 400 },
      )
    }

    const userPrompt = buildUserPrompt({
      startDate,
      endDate,
      checkIns: checkInDocs,
      journals: journalDocs,
      priorCoachingSession: (priorSessions.docs[0] as AnyCollection) ?? null,
      disciplineLogs: disciplineLogs.docs as AnyCollection[],
      evaluations: dailyEvaluations,
      lastActionStep,
    })

    const model = aiConfig.model || 'claude-sonnet-5'
    const result = await generateMindsetEvaluation(
      SYSTEM_PROMPT,
      userPrompt,
      {
        model,
        // Thinking shares this budget on Claude 5, and the prompt can span months.
        maxTokens: Math.max(aiConfig.maxTokens || 0, 8000),
        temperature: aiConfig.temperature ?? 0.7,
      },
      OUTPUT_SCHEMA as unknown as Record<string, unknown>,
    )

    let parsed: unknown
    try {
      parsed = JSON.parse(result.content)
    } catch {
      const match = result.content.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Failed to parse AI response as JSON')
      parsed = JSON.parse(match[0])
    }

    const allDates = [...checkInDocs, ...journalDocs].map((d) => day(d.date)).sort()
    return Response.json({
      prep: sanitizePrep(parsed),
      period: { startDate, endDate },
      coverage: {
        checkIns: checkInDocs.length,
        journals: journalDocs.length,
        evaluations: dailyEvaluations.length,
        coachingSessions: journalDocs.filter((j) => j.entryType === 'coaching_session_summary').length,
        firstDate: allDates[0] ?? null,
        lastDate: allDates[allDates.length - 1] ?? null,
      },
      generatedAt: new Date().toISOString(),
      usage: result.usage ?? null,
    })
  } catch (error) {
    console.error('[CoachingPrep] Failed:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return Response.json({ error: 'Coaching prep failed', details: message }, { status: 500 })
  }
}
