import type { Payload } from 'payload'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCollection = any

/**
 * 3-3-1 Action Journal (3 things I did well, 3 things for improvement, 1 action
 * step) framed by three pillars: Self-State, Process Adherence, Market
 * Engagement. Currently enabled per user email; everyone else keeps the
 * original post-market reflection prompts and AI coaching prompt.
 *
 * Keep this list in sync with the FE copy in
 * koblich-chronicles-fe/src/lib/mental-edge/action-journal.ts
 */
export const ACTION_JOURNAL_EMAILS = ['mikulkal@atlas.cz']

export function isActionJournalUser(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase()
  return !!email && ACTION_JOURNAL_EMAILS.includes(email)
}

export type Pillar = 'self_state' | 'process' | 'market'

export const PILLAR_LABELS: Record<Pillar, string> = {
  self_state: 'Self-State',
  process: 'Process Adherence',
  market: 'Market Engagement',
}

export interface ActionJournalItem {
  text: string
  pillar: Pillar | null
}

export interface ActionJournalData {
  didWell: ActionJournalItem[]
  improvement: ActionJournalItem[]
  actionStep: string
  context: string
}

const PILLARS = Object.keys(PILLAR_LABELS) as Pillar[]

function sanitizeItems(value: unknown): ActionJournalItem[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 3).map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>
    const text = typeof item.text === 'string' ? item.text.slice(0, 1000) : ''
    const pillar = PILLARS.includes(item.pillar as Pillar) ? (item.pillar as Pillar) : null
    return { text, pillar }
  })
}

/** Coerce untrusted JSON into the ActionJournalData shape (or null if absent). */
export function sanitizeActionJournal(value: unknown): ActionJournalData | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  return {
    didWell: sanitizeItems(v.didWell),
    improvement: sanitizeItems(v.improvement),
    actionStep: typeof v.actionStep === 'string' ? v.actionStep.slice(0, 1000) : '',
    context: typeof v.context === 'string' ? v.context.slice(0, 2000) : '',
  }
}

/** Shared beforeValidate-style normaliser for the `actionJournal` json field. */
export const normalizeActionJournalField = ({ value }: { value?: unknown }) =>
  value == null ? value : sanitizeActionJournal(value)

/** "1. [Process Adherence] text" lines, skipping empty items. */
export function formatItems(items: ActionJournalItem[]): string {
  return items
    .filter((i) => i.text.trim())
    .map((i, idx) => `${idx + 1}. ${i.pillar ? `[${PILLAR_LABELS[i.pillar]}] ` : ''}${i.text.trim()}`)
    .join('\n')
}

/** Markdown-ish block for the AI user prompt. */
export function formatActionJournalForPrompt(aj: ActionJournalData, indent = ''): string[] {
  const lines: string[] = []
  const well = formatItems(aj.didWell)
  const improve = formatItems(aj.improvement)
  if (well) lines.push(`${indent}3 Things I Did Well:`, ...well.split('\n').map((l) => `${indent}  ${l}`))
  if (improve) lines.push(`${indent}3 Things for Improvement:`, ...improve.split('\n').map((l) => `${indent}  ${l}`))
  if (aj.actionStep.trim()) lines.push(`${indent}1 Action Step Forward: ${aj.actionStep.trim()}`)
  if (aj.context.trim()) lines.push(`${indent}Market & week context: ${aj.context.trim()}`)
  return lines
}

export interface LastActionStep {
  date: string
  text: string
  source: 'check-in' | 'journal'
}

/**
 * Most recent non-empty Action Step strictly before `beforeDate` (YYYY-MM-DD),
 * looking at both daily check-ins (tomorrowFocus, which the 3-3-1 form mirrors
 * its action step into) and 3-3-1 journal entries.
 */
export async function findLastActionStep(
  payload: Payload,
  userId: string | number,
  beforeDate: string,
): Promise<LastActionStep | null> {
  const before = new Date(`${beforeDate}T00:00:00.000Z`).toISOString()

  const [checkIns, journals] = await Promise.all([
    payload.find({
      collection: 'mental-check-ins' as AnyCollection,
      overrideAccess: true,
      where: {
        user: { equals: userId },
        date: { less_than: before },
        'postMarket.reflections.tomorrowFocus': { exists: true },
      },
      sort: '-date',
      limit: 10,
      depth: 0,
    }),
    payload.find({
      collection: 'mindset-journal' as AnyCollection,
      overrideAccess: true,
      where: {
        user: { equals: userId },
        date: { less_than: before },
        entryType: { equals: 'post_market_reflection' },
      },
      sort: '-date',
      limit: 10,
      depth: 0,
    }),
  ])

  const candidates: LastActionStep[] = []

  const ci = (checkIns.docs as AnyCollection[]).find((d) =>
    (d.postMarket?.reflections?.tomorrowFocus || '').trim(),
  )
  if (ci) {
    candidates.push({
      date: String(ci.date).split('T')[0]!,
      text: ci.postMarket.reflections.tomorrowFocus.trim(),
      source: 'check-in',
    })
  }

  const j = (journals.docs as AnyCollection[]).find((d) =>
    (sanitizeActionJournal(d.actionJournal)?.actionStep || '').trim(),
  )
  if (j) {
    candidates.push({
      date: String(j.date).split('T')[0]!,
      text: sanitizeActionJournal(j.actionJournal)!.actionStep.trim(),
      source: 'journal',
    })
  }

  // Latest date wins; on a tie prefer the daily check-in.
  candidates.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
  return candidates[0] ?? null
}

/**
 * Tally of pillar tags across a set of 3-3-1 entries, so the coach can see
 * which pillar keeps showing up under "improvement" vs "did well".
 */
export function tallyPillars(entries: ActionJournalData[]): string[] {
  const well: Record<Pillar, number> = { self_state: 0, process: 0, market: 0 }
  const improve: Record<Pillar, number> = { self_state: 0, process: 0, market: 0 }
  let any = false
  for (const aj of entries) {
    for (const i of aj.didWell) if (i.pillar && i.text.trim()) { well[i.pillar]++; any = true }
    for (const i of aj.improvement) if (i.pillar && i.text.trim()) { improve[i.pillar]++; any = true }
  }
  if (!any) return []
  return PILLARS.map(
    (p) => `- ${PILLAR_LABELS[p]}: did well ×${well[p]}, for improvement ×${improve[p]}`,
  )
}

/**
 * Appended to the system prompt for Action Journal users. Adapted from the
 * coach's suggested project instruction; maps the asks onto the existing
 * evaluation output schema so no extra fields are needed.
 */
export const ACTION_JOURNAL_SYSTEM_ADDENDUM = `## Trading Performance Journal (3-3-1) — personal instructions

This is my trading performance journal, running alongside my coaching with Steven Goldstein. When I add a session summary or journal entry, take me through a short 3-3-1 reflection (3 things I did well, 3 things for improvement, 1 action step) across my Self-State, Process Adherence and Market Engagement. Remind me of my last action step and point out patterns you notice over time. Keep your responses brief.

The three pillars:
- Self-State (Being): Was I operating from cognitive clarity, or was I reactive, fatigued or emotionally hijacked?
- Process Adherence: Did I understand my edge and stick to it, or did I "freestyle" outside my proven framework?
- Market Engagement (Behaviours): Did I maintain agency, or did the market's volatility dictate my behavioural response?

My pre-market check-in also records my alignment to the 3Ps (Purpose, Presence, Process), each rated 1–5 with a short anchor note. Compare that morning intent with how the day actually went — e.g. low Presence before the open followed by reactive post-market behaviour, or a clear Process anchor that I then abandoned — and call out the gap when there is one.

How to map this onto the JSON fields (these instructions override the length guidance above):
- coachingFeedback: brief — at most two short paragraphs. Open with one sentence naming my last action step (provided under "Last Action Step") and whether today's data shows I followed through.
- strengthsHighlighted: up to 3 items — the "3 things I did well", each prefixed with its pillar in brackets, e.g. "[Process Adherence] ...".
- actionableInsights: up to 3 items — the "3 things for improvement", each prefixed with its pillar in brackets.
- focusForTomorrow: the single "1 action step" — one concrete adjustment for the next session that strengthens Process Adherence. If my own written action step is good, sharpen it rather than replace it.
- patternsIdentified: recurring patterns across entries over time (use the pillar tally and history), not a restatement of today.
- Keep every list item to one sentence.
- Do not add a "bring to your next coaching session" section — coaching prep is generated separately across a whole period.`
