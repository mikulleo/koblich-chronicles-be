import type { Payload } from 'payload'

// Trade statistics + an in-memory snapshot of the trades they are computed from.
//
// Every /trades/stats request used to re-read all closed/partial trades from Postgres
// (~780 KB per request), and the statistics page fires ~15 of them. Now the trades are
// loaded once into a snapshot and every stats request (any date range / ticker / status)
// plus the precomputed yearly/monthly table is served from memory.
//
// The snapshot is refreshed:
//   - daily at 10:00 Europe/Prague (scheduled in payload.config onInit),
//   - lazily on the next request after any trade is created/updated/deleted
//     (Trades afterChange/afterDelete hooks call invalidateTradeStatsSnapshot).

export interface NormalizedStats {
  totalProfitLoss: number
  totalProfitLossPercent: number
  averageRRatio: number
  profitFactor: number
  maxGainPercent: number
  maxLossPercent: number
  maxGainLossRatio: number
  averageWinPercent: number
  averageLossPercent: number
  winLossRatio: number
  adjustedWinLossRatio: number
  expectancy: number
}

export interface TradeStats {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  breakEvenTrades: number
  battingAverage: number
  averageWinPercent: number
  averageLossPercent: number
  winLossRatio: number
  adjustedWinLossRatio: number
  averageRRatio: number
  profitFactor: number
  expectancy: number
  averageDaysHeldWinners: number
  averageDaysHeldLosers: number
  maxGainPercent: number
  maxLossPercent: number
  maxGainLossRatio: number
  totalProfitLoss: number
  totalProfitLossPercent: number
  tradeStatusCounts: {
    closed: number
    partial: number
  }
  normalized: NormalizedStats
}

// Helper function to calculate trade statistics
export function calculateTradeStats(trades: any[]): TradeStats {
  // Initialize arrays for standard and normalized data
  const winners: any[] = []
  const losers: any[] = []
  const breakEven: any[] = []

  // Initialize statistics
  const stats: TradeStats = {
    totalTrades: trades.length,
    winningTrades: 0,
    losingTrades: 0,
    breakEvenTrades: 0,
    battingAverage: 0,
    averageWinPercent: 0,
    averageLossPercent: 0,
    winLossRatio: 0,
    adjustedWinLossRatio: 0,
    averageRRatio: 0,
    profitFactor: 0,
    expectancy: 0,
    averageDaysHeldWinners: 0,
    averageDaysHeldLosers: 0,
    maxGainPercent: 0,
    maxLossPercent: 0,
    maxGainLossRatio: 0,
    totalProfitLoss: 0,
    totalProfitLossPercent: 0,
    tradeStatusCounts: {
      closed: trades.filter((t) => t.status === 'closed').length,
      partial: trades.filter((t) => t.status === 'partial').length,
    },
    normalized: {
      totalProfitLoss: 0,
      totalProfitLossPercent: 0,
      averageRRatio: 0,
      profitFactor: 0,
      maxGainPercent: 0,
      maxLossPercent: 0,
      maxGainLossRatio: 0,
      averageWinPercent: 0,
      averageLossPercent: 0,
      winLossRatio: 0,
      adjustedWinLossRatio: 0,
      expectancy: 0,
    },
  }

  if (trades.length === 0) {
    return stats
  }

  // Separate winners and losers
  trades.forEach((trade) => {
    if (trade.profitLossPercent > 0) {
      winners.push(trade)
    } else if (trade.profitLossPercent < 0) {
      losers.push(trade)
    } else {
      breakEven.push(trade)
    }
  })

  // Standard metrics calculations
  stats.winningTrades = winners.length
  stats.losingTrades = losers.length
  stats.breakEvenTrades = breakEven.length

  // Calculate batting average (win rate)
  stats.battingAverage = (winners.length / trades.length) * 100

  // Calculate average win/loss percentages
  stats.averageWinPercent = winners.length
    ? winners.reduce((sum, trade) => sum + trade.profitLossPercent, 0) / winners.length
    : 0

  stats.averageLossPercent = losers.length
    ? losers.reduce((sum, trade) => sum + trade.profitLossPercent, 0) / losers.length
    : 0

  // Calculate win/loss ratio
  stats.winLossRatio =
    stats.averageLossPercent !== 0
      ? Math.abs(stats.averageWinPercent / stats.averageLossPercent)
      : 0

  // Calculate adjusted win/loss ratio
  if (stats.averageLossPercent !== 0 && stats.battingAverage < 100) {
    const winRate = stats.battingAverage / 100
    stats.adjustedWinLossRatio =
      (winRate * stats.averageWinPercent) / ((1 - winRate) * Math.abs(stats.averageLossPercent))
  }

  // Calculate average R-ratio
  stats.averageRRatio = trades.reduce((sum, trade) => sum + (trade.rRatio || 0), 0) / trades.length

  // Calculate profit factor (gross wins / gross losses)
  const grossWins = winners.reduce((sum, trade) => sum + trade.profitLossAmount, 0)
  const grossLosses = Math.abs(losers.reduce((sum, trade) => sum + trade.profitLossAmount, 0))
  stats.profitFactor = grossLosses !== 0 ? grossWins / grossLosses : 0

  // Calculate expectancy
  stats.expectancy =
    (stats.battingAverage / 100) * stats.averageWinPercent +
    (1 - stats.battingAverage / 100) * stats.averageLossPercent

  // Calculate average days held
  stats.averageDaysHeldWinners = winners.length
    ? winners.reduce((sum, trade) => sum + (trade.daysHeld || 0), 0) / winners.length
    : 0

  stats.averageDaysHeldLosers = losers.length
    ? losers.reduce((sum, trade) => sum + (trade.daysHeld || 0), 0) / losers.length
    : 0

  // Calculate max gain/loss
  stats.maxGainPercent = winners.length
    ? Math.max(...winners.map((trade) => trade.profitLossPercent))
    : 0

  stats.maxLossPercent = losers.length
    ? Math.min(...losers.map((trade) => trade.profitLossPercent))
    : 0

  stats.maxGainLossRatio =
    stats.maxLossPercent !== 0 ? Math.abs(stats.maxGainPercent / stats.maxLossPercent) : 0

  // Calculate total profit/loss
  stats.totalProfitLoss = trades.reduce((sum, trade) => sum + trade.profitLossAmount, 0)

  // Calculate weighted average profit/loss percentage
  const totalInvested = trades.reduce((sum, trade) => {
    return sum + trade.entryPrice * trade.shares
  }, 0)

  stats.totalProfitLossPercent =
    totalInvested !== 0 ? (stats.totalProfitLoss / totalInvested) * 100 : 0

  // Calculate normalized statistics
  const normalizedTrades = trades.filter((trade) => trade.normalizedMetrics)

  if (normalizedTrades.length > 0) {
    // For normalized stats we need to use weighted averages based on position size
    const normalizedWinners = normalizedTrades.filter(
      (t) => t.normalizedMetrics.profitLossPercent > 0,
    )
    const normalizedLosers = normalizedTrades.filter(
      (t) => t.normalizedMetrics.profitLossPercent < 0,
    )

    // Calculate total normalized P/L amount
    stats.normalized.totalProfitLoss = normalizedTrades.reduce(
      (sum, trade) => sum + (trade.normalizedMetrics.profitLossAmount || 0),
      0,
    )

    // Calculate estimated total normalized investment
    const normalizedInvestment = normalizedTrades.reduce((sum, trade) => {
      const factor = trade.normalizationFactor || 1
      return factor > 0 ? sum + trade.positionSize / factor : sum
    }, 0)

    stats.normalized.totalProfitLossPercent =
      normalizedInvestment !== 0
        ? (stats.normalized.totalProfitLoss / normalizedInvestment) * 100
        : 0

    // Calculate normalized metrics for winners
    if (normalizedWinners.length > 0) {
      let maxNormalizedGain = 0

      normalizedWinners.forEach((trade) => {
        // Find maximum normalized gain
        if (trade.normalizedMetrics.profitLossPercent > maxNormalizedGain) {
          maxNormalizedGain = trade.normalizedMetrics.profitLossPercent
        }
      })

      stats.normalized.averageWinPercent =
        normalizedWinners.length > 0
          ? normalizedWinners.reduce(
              (sum, trade) => sum + trade.normalizedMetrics.profitLossPercent,
              0,
            ) / normalizedWinners.length
          : 0

      stats.normalized.maxGainPercent = maxNormalizedGain
    }

    // Calculate normalized metrics for losers
    if (normalizedLosers.length > 0) {
      let minNormalizedLoss = 0

      normalizedLosers.forEach((trade) => {
        // Find minimum normalized loss (most negative value)
        if (trade.normalizedMetrics.profitLossPercent < minNormalizedLoss) {
          minNormalizedLoss = trade.normalizedMetrics.profitLossPercent
        }
      })

      stats.normalized.averageLossPercent =
        normalizedLosers.length > 0
          ? normalizedLosers.reduce(
              (sum, trade) => sum + trade.normalizedMetrics.profitLossPercent,
              0,
            ) / normalizedLosers.length
          : 0

      stats.normalized.maxLossPercent = minNormalizedLoss
    }

    // Calculate normalized win/loss ratio
    stats.normalized.winLossRatio =
      stats.normalized.averageLossPercent !== 0
        ? Math.abs(stats.normalized.averageWinPercent / stats.normalized.averageLossPercent)
        : 0

    // Calculate normalized adjusted win/loss ratio
    if (stats.normalized.averageLossPercent !== 0 && stats.battingAverage < 100) {
      const winRate = stats.battingAverage / 100
      stats.normalized.adjustedWinLossRatio =
        (winRate * stats.normalized.averageWinPercent) /
        ((1 - winRate) * Math.abs(stats.normalized.averageLossPercent))
    }

    // Calculate normalized max gain/loss ratio
    stats.normalized.maxGainLossRatio =
      stats.normalized.maxLossPercent !== 0
        ? Math.abs(stats.normalized.maxGainPercent / stats.normalized.maxLossPercent)
        : 0

    // Calculate normalized average R-ratio
    stats.normalized.averageRRatio =
      normalizedTrades.reduce((sum, trade) => sum + (trade.normalizedMetrics.rRatio || 0), 0) /
      normalizedTrades.length

    // Calculate normalized profit factor
    const normalizedGrossWins = normalizedWinners.reduce(
      (sum, trade) => sum + trade.normalizedMetrics.profitLossAmount,
      0,
    )

    const normalizedGrossLosses = Math.abs(
      normalizedLosers.reduce((sum, trade) => sum + trade.normalizedMetrics.profitLossAmount, 0),
    )

    stats.normalized.profitFactor =
      normalizedGrossLosses !== 0 ? normalizedGrossWins / normalizedGrossLosses : 0

    // Calculate normalized expectancy
    stats.normalized.expectancy =
      (stats.battingAverage / 100) * stats.normalized.averageWinPercent +
      (1 - stats.battingAverage / 100) * stats.normalized.averageLossPercent
  }

  return stats
}

// ────────────────────────────────────────────────────────────────────────────────
// Snapshot of closed/partial trades + precomputed yearly/monthly stats
// ────────────────────────────────────────────────────────────────────────────────

export type StatsStatusFilter = 'all' | 'closed-only'

export interface StatsMetadata {
  totalTrades: number
  closedTrades: number
  partialTrades: number
  statusFilter: string
  dateRange: string
  tickerFilter: boolean
}

export interface StatsResult {
  stats: TradeStats
  metadata: StatsMetadata
}

export interface PeriodStats extends StatsResult {
  period: string
  periodLabel: string
}

export interface YearPeriodStats extends PeriodStats {
  months: PeriodStats[]
}

export interface StatsQuery {
  startDate?: string
  endDate?: string
  tickerId?: string
  statusFilter?: string
}

interface SnapshotTrade {
  doc: any
  completionDate: Date
}

export interface TradeStatsSnapshot {
  computedAt: string
  trades: SnapshotTrade[]
  // Newest year first, one entry per year that has trades (plus the current year)
  periods: Record<StatsStatusFilter, YearPeriodStats[]>
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const pad2 = (n: number) => String(n).padStart(2, '0')

// A trade counts toward the period in which its last exit happened
function getCompletionDate(trade: any): Date {
  if (trade.exits && trade.exits.length > 0) {
    const lastExitDate = trade.exits.reduce((latest: string, exit: any) => {
      const exitDate = new Date(exit.date)
      const latestDate = new Date(latest)
      return exitDate > latestDate ? exit.date : latest
    }, trade.exits[0]?.date || trade.entryDate)

    return new Date(lastExitDate)
  }
  // Fallback to entry date (shouldn't happen for closed/partial trades)
  return new Date(trade.entryDate)
}

function getTickerId(trade: any): string | undefined {
  const ticker = trade.ticker
  if (ticker === null || ticker === undefined) return undefined
  return String(typeof ticker === 'object' ? ticker.id : ticker)
}

export function filterSnapshotTrades(
  snapshot: TradeStatsSnapshot,
  { startDate, endDate, tickerId, statusFilter }: StatsQuery,
): any[] {
  const filterStartDate = startDate ? new Date(startDate) : undefined
  const filterEndDate = endDate ? new Date(endDate) : undefined
  filterEndDate?.setHours(23, 59, 59, 999) // End of day

  return snapshot.trades
    .filter(({ doc, completionDate }) => {
      if (statusFilter === 'closed-only' && doc.status !== 'closed') return false
      if (tickerId && getTickerId(doc) !== String(tickerId)) return false
      if (filterStartDate && completionDate < filterStartDate) return false
      if (filterEndDate && completionDate > filterEndDate) return false
      return true
    })
    .map(({ doc }) => doc)
}

export function computeStats(
  filteredTrades: any[],
  { startDate, endDate, tickerId, statusFilter }: StatsQuery,
): StatsResult {
  const metadata: StatsMetadata = {
    totalTrades: filteredTrades.length,
    closedTrades: filteredTrades.filter((t) => t.status === 'closed').length,
    partialTrades: filteredTrades.filter((t) => t.status === 'partial').length,
    statusFilter: statusFilter === 'closed-only' ? 'Closed Only' : 'Closed and Partial',
    dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'All Time',
    tickerFilter: tickerId ? true : false,
  }

  return { stats: calculateTradeStats(filteredTrades), metadata }
}

export function computeStatsFromSnapshot(
  snapshot: TradeStatsSnapshot,
  query: StatsQuery,
): StatsResult {
  return computeStats(filterSnapshotTrades(snapshot, query), query)
}

// Minimal per-trade fields the statistics page needs (total P/L % sum, histogram)
export interface StatsTradeRow {
  id: string | number
  status: string
  profitLossPercent: number | null
  normalizedMetrics?: { profitLossPercent: number | null }
}

export function toStatsTradeRow(doc: any): StatsTradeRow {
  return {
    id: doc.id,
    status: doc.status,
    profitLossPercent: doc.profitLossPercent ?? null,
    ...(doc.normalizedMetrics
      ? { normalizedMetrics: { profitLossPercent: doc.normalizedMetrics.profitLossPercent ?? null } }
      : {}),
  }
}

function computePeriods(
  snapshot: TradeStatsSnapshot,
  statusFilter: StatsStatusFilter,
): YearPeriodStats[] {
  const years = new Set<number>([new Date().getFullYear()])
  snapshot.trades.forEach(({ completionDate }) => years.add(completionDate.getFullYear()))

  return [...years]
    .sort((a, b) => b - a)
    .map((year) => {
      const months = MONTH_NAMES.map((label, month) => {
        const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
        return {
          period: `${year}-${month + 1}`,
          periodLabel: label,
          ...computeStatsFromSnapshot(snapshot, {
            startDate: `${year}-${pad2(month + 1)}-01`,
            endDate: `${year}-${pad2(month + 1)}-${pad2(lastDay)}`,
            statusFilter,
          }),
        }
      })

      return {
        period: String(year),
        periodLabel: String(year),
        ...computeStatsFromSnapshot(snapshot, {
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`,
          statusFilter,
        }),
        months,
      }
    })
}

async function buildSnapshot(payload: Payload): Promise<TradeStatsSnapshot> {
  const startedAt = Date.now()
  const { docs } = await payload.find({
    collection: 'trades',
    where: {
      // Hypothetical "didn't trade" entries never count toward statistics
      didNotTrade: { not_equals: true },
      status: { in: ['closed', 'partial'] },
    },
    pagination: false,
    depth: 0, // No relationship population needed for stats calculation
  })

  const snapshot: TradeStatsSnapshot = {
    computedAt: new Date().toISOString(),
    trades: docs.map((doc) => ({ doc, completionDate: getCompletionDate(doc) })),
    periods: { all: [], 'closed-only': [] },
  }
  snapshot.periods.all = computePeriods(snapshot, 'all')
  snapshot.periods['closed-only'] = computePeriods(snapshot, 'closed-only')

  payload.logger.info(
    `[tradeStats] snapshot built from ${docs.length} trades in ${Date.now() - startedAt}ms`,
  )
  return snapshot
}

// Kept on globalThis so the API routes, admin UI and hooks share one cache even if
// Next.js loads this module more than once (same trick Payload uses for its instance).
interface SnapshotState {
  snapshot: TradeStatsSnapshot | null
  building: { generation: number; promise: Promise<TradeStatsSnapshot> } | null
  generation: number
  schedulerStarted: boolean
}

const globalState = globalThis as typeof globalThis & { __tradeStatsSnapshot?: SnapshotState }
const state: SnapshotState = (globalState.__tradeStatsSnapshot ??= {
  snapshot: null,
  building: null,
  generation: 0,
  schedulerStarted: false,
})

export function invalidateTradeStatsSnapshot(): void {
  state.generation++
  state.snapshot = null
}

export function getTradeStatsSnapshot(payload: Payload): Promise<TradeStatsSnapshot> {
  if (state.snapshot) return Promise.resolve(state.snapshot)

  // Reuse an in-flight build only if no trade changed since it started
  if (state.building && state.building.generation === state.generation) {
    return state.building.promise
  }

  const generation = state.generation
  const promise = buildSnapshot(payload)
    .then((snapshot) => {
      if (generation === state.generation) state.snapshot = snapshot
      return snapshot
    })
    .finally(() => {
      if (state.building?.promise === promise) state.building = null
    })
  state.building = { generation, promise }
  return promise
}

// ────────────────────────────────────────────────────────────────────────────────
// Daily refresh at 10:00 Prague time
// ────────────────────────────────────────────────────────────────────────────────

const REFRESH_TIME_ZONE = 'Europe/Prague'
const REFRESH_HOUR = 10

// Offset (ms) of the time zone from UTC at the given instant, DST-aware
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUTC = Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second'),
  )
  return asUTC - Math.floor(date.getTime() / 1000) * 1000
}

export function msUntilNextRefresh(now: Date = new Date()): number {
  const local = new Date(now.getTime() + timeZoneOffsetMs(now, REFRESH_TIME_ZONE))
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    const wallClock = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate() + dayOffset,
      REFRESH_HOUR,
    )
    const target = wallClock - timeZoneOffsetMs(new Date(wallClock), REFRESH_TIME_ZONE)
    if (target > now.getTime()) return target - now.getTime()
  }
  return 24 * 60 * 60 * 1000
}

export function startTradeStatsScheduler(payload: Payload): void {
  // Never schedule during `next build` — the timer is unref'd anyway, but there is no server to keep warm
  if (state.schedulerStarted || process.env.NEXT_PHASE === 'phase-production-build') return
  state.schedulerStarted = true

  const scheduleNext = () => {
    const delay = msUntilNextRefresh()
    const timer = setTimeout(async () => {
      try {
        invalidateTradeStatsSnapshot()
        await getTradeStatsSnapshot(payload)
      } catch (error) {
        payload.logger.error({ err: error }, '[tradeStats] daily snapshot refresh failed')
      } finally {
        scheduleNext()
      }
    }, delay)
    // Don't keep CLI processes (e.g. `payload migrate`) alive just for this timer
    timer.unref()
    payload.logger.info(
      `[tradeStats] next snapshot refresh in ${Math.round(delay / 60000)} min (10:00 ${REFRESH_TIME_ZONE})`,
    )
  }

  scheduleNext()
}
