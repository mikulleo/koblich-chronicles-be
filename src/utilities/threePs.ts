/**
 * Pre-market "3Ps" alignment (Steven Goldstein): Purpose, Presence, Process.
 * Each P gets a 1–5 alignment rating plus a short anchor note. Offered to
 * Action Journal users only (see isActionJournalUser) — everyone else's
 * pre-market check-in is unchanged.
 *
 * Keep the shape in sync with the FE copy in
 * koblich-chronicles-fe/src/lib/mental-edge/three-ps.ts
 */
export type ThreePKey = 'purpose' | 'presence' | 'process'

export const THREE_P_LABELS: Record<ThreePKey, string> = {
  purpose: 'Purpose',
  presence: 'Presence',
  process: 'Process',
}

const KEYS = Object.keys(THREE_P_LABELS) as ThreePKey[]

export interface ThreePEntry {
  rating: number | null
  note: string
}

export type ThreePsData = Record<ThreePKey, ThreePEntry>

function sanitizeEntry(raw: unknown): ThreePEntry {
  const v = (raw ?? {}) as Record<string, unknown>
  const n = typeof v.rating === 'number' ? Math.round(v.rating) : NaN
  return {
    rating: n >= 1 && n <= 5 ? n : null,
    note: typeof v.note === 'string' ? v.note.slice(0, 1000) : '',
  }
}

/** Coerce untrusted JSON into the ThreePsData shape (or null if absent). */
export function sanitizeThreePs(value: unknown): ThreePsData | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  return Object.fromEntries(KEYS.map((k) => [k, sanitizeEntry(v[k])])) as ThreePsData
}

/** beforeChange normaliser for the `threePs` json field. */
export const normalizeThreePsField = ({ value }: { value?: unknown }) =>
  value == null ? value : sanitizeThreePs(value)

/** "Purpose 4/5 — note" lines for AI prompts, skipping untouched Ps. */
export function formatThreePsForPrompt(value: unknown, indent = ''): string[] {
  const data = sanitizeThreePs(value)
  if (!data) return []
  const lines: string[] = []
  for (const k of KEYS) {
    const { rating, note } = data[k]
    if (rating == null && !note.trim()) continue
    const score = rating != null ? ` ${rating}/5` : ''
    lines.push(`${indent}  ${THREE_P_LABELS[k]}${score}${note.trim() ? ` — ${note.trim()}` : ''}`)
  }
  return lines.length ? [`${indent}3Ps alignment (Purpose / Presence / Process):`, ...lines] : []
}
