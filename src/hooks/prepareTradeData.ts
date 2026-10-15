import { CollectionBeforeChangeHook } from 'payload'

// Fields the metric hooks read. On update, `data` only holds what is being changed
// (e.g. the importer appending an exit sends just `exits`), so the rest comes from the stored doc.
const INPUT_FIELDS = [
  'type',
  'status',
  'entryDate',
  'entryPrice',
  'shares',
  'initialStopLoss',
  'exits',
  'modifiedStops',
  'currentPrice',
  'targetPositionSize',
] as const

/**
 * open / partial / closed from the exits; falls back to the given status when nothing was exited.
 * Shared with the status field hook so both always agree.
 */
export function deriveTradeStatus(
  exits: { shares?: number | string | null }[] | null | undefined,
  shares: number | string | null | undefined,
  fallback: string | null | undefined,
): 'open' | 'partial' | 'closed' {
  if (exits && exits.length > 0) {
    const totalSharesExited = exits.reduce(
      (sum, exit) => sum + (parseFloat(String(exit.shares)) || 0),
      0,
    )
    const totalShares = parseFloat(String(shares))
    if (totalShares > 0 && totalSharesExited >= totalShares) return 'closed'
    if (totalSharesExited > 0) return 'partial'
  }
  return (fallback as 'open' | 'partial' | 'closed') || 'open'
}

/**
 * Runs before the other collection beforeChange hooks.
 *
 * Payload runs collection hooks *before* field hooks, so status / positionSize /
 * targetPositionSize (set by field hooks) were still the previous save's values when the
 * metric hooks ran — closing a trade left its normalized metrics empty until a second save.
 * This fills in the stored values an update didn't send and derives those three up front.
 */
export const prepareTradeDataHook: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation === 'update' && originalDoc) {
    for (const key of INPUT_FIELDS) {
      if (data[key] === undefined && originalDoc[key] !== undefined) data[key] = originalDoc[key]
    }
  }

  if (operation === 'create' && !data.targetPositionSize) {
    data.targetPositionSize = req.user?.preferences?.targetPositionSize || 25000
  }

  data.status = deriveTradeStatus(data.exits, data.shares, data.status)

  const entryPrice = parseFloat(data.entryPrice)
  const shares = parseFloat(data.shares)
  if (!isNaN(entryPrice) && !isNaN(shares) && entryPrice && shares) {
    data.positionSize = parseFloat((entryPrice * shares).toFixed(2))
  }

  return data
}
