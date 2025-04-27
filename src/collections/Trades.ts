import { CollectionConfig, PayloadRequest } from 'payload'
import { calculateTradeMetricsHook } from '../hooks/calculateTradeMetrics'
import { updateTickerTradeStatsHook } from '../hooks/updateTickerTradeStats'
import { calculateCurrentMetricsHook } from '@/hooks/calculateCurrentMetrics'
import { calculateNormalizedMetricsHook } from '@/hooks/calculateNormalizedMetrics'
import { updateTickerTradeStatsAfterDeleteHook } from '@/hooks/updateTickerTradeStatsAfterDelete'
import { Where } from 'payload'

// Define interfaces for type safety
interface ExitRecord {
  price: number | string
  shares: number | string
  date: string | Date
  reason?: string
  notes?: string
}

// Interface for trade statistics
interface TradeForStats {
  id?: string | number
  profitLossAmount: number
  profitLossPercent: number
  rRatio?: number
  daysHeld?: number
  entryPrice: number
  shares: number
  status: 'open' | 'partial' | 'closed'
  normalizedMetrics?: {
    profitLossAmount: number
    profitLossPercent: number
    rRatio?: number
  }
  normalizationFactor?: number
  positionSize: number
}

interface NormalizedStats {
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

interface TradeStats {
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

export const Trades: CollectionConfig = {
  slug: 'trades',
  admin: {
    defaultColumns: ['ticker', 'type', 'entryDate', 'status', 'profitLossPercent', 'rRatio'],
    useAsTitle: 'id',
    group: 'Trading',
    listSearchableFields: ['ticker.symbol', 'notes'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'ticker',
      type: 'relationship',
      relationTo: 'tickers',
      required: true,
      admin: {
        description: 'Select the ticker symbol for this trade',
      },
    },
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Long', value: 'long' },
        { label: 'Short', value: 'short' },
      ],
      required: true,
      defaultValue: 'long',
    },
    {
      name: 'entryDate',
      type: 'date',
      required: true,
      admin: {
        description: 'Date of trade entry',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
      defaultValue: () => new Date(),
    },
    {
      name: 'entryPrice',
      type: 'number',
      required: true,
      admin: {
        description: 'Price at entry',
        step: 0.01,
      },
    },
    {
      name: 'shares',
      type: 'number',
      required: true,
      admin: {
        description: 'Number of shares/contracts',
      },
    },
    {
      name: 'initialStopLoss',
      type: 'number',
      required: true,
      admin: {
        description: 'Initial stop loss price',
        step: 0.01,
      },
    },
    {
      name: 'relatedCharts',
      type: 'relationship',
      relationTo: 'charts',
      hasMany: true,
      admin: {
        description: 'Charts associated with this trade',
      },
      // Filter options to only show charts with the same ticker
      filterOptions: ({ data }) => {
        // Only apply filter if we have a ticker selected
        if (data?.ticker) {
          const tickerId = typeof data.ticker === 'object' ? data.ticker.id : data.ticker

          if (tickerId) {
            // Return a Where query
            return {
              ticker: {
                equals: tickerId,
              },
            } as Where
          }
        }

        // Return true to show all options when no ticker is selected
        return true
      },
    },
    {
      name: 'setupType',
      type: 'select',
      options: [
        { label: 'Breakout', value: 'breakout' },
        { label: 'Pullback', value: 'pullback' },
        { label: 'Reversal', value: 'reversal' },
        { label: 'Gap', value: 'gap' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Type of trading setup',
        position: 'sidebar',
      },
    },
    {
      name: 'modifiedStops',
      type: 'array',
      admin: {
        description: 'Track changes to stop loss',
      },
      fields: [
        {
          name: 'price',
          type: 'number',
          required: true,
          admin: {
            step: 0.01,
          },
        },
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
          defaultValue: () => new Date(),
        },
        {
          name: 'notes',
          type: 'textarea',
        },
      ],
    },
    // current price Type Group
    {
      name: 'currentPrice',
      type: 'number',
      admin: {
        description: 'Current market price for open or partially closed positions',
        position: 'sidebar',
        step: 0.01,
        condition: (data) => data.status !== 'closed',
      },
    },
    {
      name: 'currentMetrics',
      type: 'group',
      admin: {
        description: 'Real-time metrics for open positions',
        position: 'sidebar',
        condition: (data) => data.status !== 'closed',
      },
      fields: [
        {
          name: 'profitLossAmount',
          label: 'Current P/L ($)',
          type: 'number',
          admin: {
            readOnly: true,
            step: 0.01,
          },
        },
        {
          name: 'profitLossPercent',
          label: 'Current P/L (%)',
          type: 'number',
          admin: {
            readOnly: true,
            step: 0.01,
          },
        },
        {
          name: 'rRatio',
          label: 'Current R-Ratio',
          type: 'number',
          admin: {
            readOnly: true,
            step: 0.01,
          },
        },
        {
          name: 'riskAmount',
          label: 'Current Risk Amount ($)',
          type: 'number',
          admin: {
            readOnly: true,
            step: 0.01,
          },
        },
        {
          name: 'riskPercent',
          label: 'Current Risk (%)',
          type: 'number',
          admin: {
            readOnly: true,
            step: 0.01,
          },
        },
        {
          name: 'breakEvenShares',
          label: 'Break-even Shares',
          type: 'number',
          admin: {
            description: 'Shares to sell at current price to break even if stopped out',
            readOnly: true,
            step: 0.01,
          },
        },
        {
          name: 'lastUpdated',
          label: 'Last Updated',
          type: 'date',
          admin: {
            readOnly: true,
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
        },
      ],
    },
    {
      name: 'exits',
      type: 'array',
      admin: {
        description: 'Exit details (partial or full)',
      },
      fields: [
        {
          name: 'price',
          type: 'number',
          required: true,
          admin: {
            description: 'Exit price',
            step: 0.01,
          },
        },
        {
          name: 'shares',
          type: 'number',
          required: true,
          admin: {
            description: 'Number of shares/contracts exited',
          },
        },
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: {
            description: 'Date of exit',
            date: {
              pickerAppearance: 'dayAndTime',
            },
          },
          defaultValue: () => new Date(),
        },
        {
          name: 'reason',
          type: 'select',
          options: [
            { label: 'Into strength', value: 'strength' },
            { label: 'Stop hit', value: 'stop' },
            { label: 'Backstop', value: 'backstop' },
            { label: 'Violation', value: 'violation' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'notes',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Closed', value: 'closed' },
        { label: 'Partially Closed', value: 'partial' },
      ],
      required: true,
      defaultValue: 'open',
      admin: {
        position: 'sidebar',
        description: 'Trade status',
      },
      hooks: {
        beforeChange: [
          ({ value, siblingData }) => {
            // Auto-calculate status based on exits
            if (siblingData.exits && siblingData.exits.length > 0) {
              // Calculate total shares exited
              const totalSharesExited = siblingData.exits.reduce(
                (sum: number, exit: ExitRecord) => sum + (parseFloat(String(exit.shares)) || 0),
                0,
              )

              if (totalSharesExited >= siblingData.shares) {
                return 'closed'
              } else if (totalSharesExited > 0) {
                return 'partial'
              }
            }

            // Default or manually set value
            return value || 'open'
          },
        ],
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Trade notes and rationale',
      },
    },

    // Calculated fields
    {
      name: 'riskAmount',
      type: 'number',
      admin: {
        description: 'Calculated risk amount ($)',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'riskPercent',
      type: 'number',
      admin: {
        description: 'Calculated risk percentage',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'profitLossAmount',
      type: 'number',
      admin: {
        description: 'Profit/Loss Amount ($)',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'profitLossPercent',
      type: 'number',
      admin: {
        description: 'Profit/Loss Percentage',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'rRatio',
      type: 'number',
      admin: {
        description: 'R-Multiple (gain/loss relative to initial risk)',
        position: 'sidebar',
        readOnly: true,
        step: 0.01,
      },
    },
    {
      name: 'daysHeld',
      type: 'number',
      admin: {
        description: 'Days position has been/was held',
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // For open trades, calculate days from entry to today
            // For closed trades, calculate days from entry to last exit
            let endDate: Date

            if (
              siblingData.status === 'closed' &&
              siblingData.exits &&
              siblingData.exits.length > 0
            ) {
              // Find the latest exit date
              endDate = siblingData.exits.reduce((latest: Date, exit: ExitRecord) => {
                const exitDate = new Date(exit.date)
                return exitDate > latest ? exitDate : latest
              }, new Date(0))
            } else {
              // For open or partially closed trades, use today
              endDate = new Date()
            }

            const entryDate = new Date(siblingData.entryDate)
            const diffTime = Math.abs(endDate.getTime() - entryDate.getTime())
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            return diffDays || 0
          },
        ],
      },
    },
    {
      name: 'positionSize',
      type: 'number',
      admin: {
        description: 'Actual position size in dollars (entry price × shares)',
        position: 'sidebar',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            if (siblingData.entryPrice && siblingData.shares) {
              const entryPrice = parseFloat(siblingData.entryPrice)
              const shares = parseFloat(siblingData.shares)

              if (!isNaN(entryPrice) && !isNaN(shares)) {
                return parseFloat((entryPrice * shares).toFixed(2))
              }
            }
            return siblingData.positionSize
          },
        ],
      },
    },
    {
      name: 'targetPositionSize',
      type: 'number',
      admin: {
        description: 'Target position size at time of trade entry',
        position: 'sidebar',
      },
      hooks: {
        beforeChange: [
          async ({ value, operation, req }) => {
            // Only set the target position size on trade creation, not on updates
            if (operation === 'create') {
              // Get user's current target position size preference
              let defaultTarget = 25000 // Default value

              if (req.user && req.user.id) {
                try {
                  const user = await req.payload.findByID({
                    collection: 'users',
                    id: req.user.id,
                  })

                  if (user?.preferences?.targetPositionSize) {
                    defaultTarget = user.preferences.targetPositionSize
                  }
                } catch (error) {
                  console.error('Error fetching user preferences:', error)
                }
              }

              // Return user's target position size or the provided value if it exists
              return value || defaultTarget
            }

            // For updates, keep the existing value
            return value
          },
        ],
      },
    },
    {
      name: 'normalizationFactor',
      type: 'number',
      admin: {
        description: 'Position size as percentage of target size',
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'normalizedMetrics',
      type: 'group',
      admin: {
        description: 'Metrics normalized to standard position size',
        position: 'sidebar',
      },
      fields: [
        {
          name: 'profitLossAmount',
          label: 'Normalized P/L ($)',
          type: 'number',
          admin: {
            readOnly: true,
            step: 0.01,
          },
        },
        {
          name: 'profitLossPercent',
          label: 'Normalized P/L (%)',
          type: 'number',
          admin: {
            readOnly: true,
            step: 0.01,
          },
        },
        {
          name: 'rRatio',
          label: 'Normalized R-Ratio',
          type: 'number',
          admin: {
            readOnly: true,
            step: 0.01,
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      calculateTradeMetricsHook,
      calculateCurrentMetricsHook,
      calculateNormalizedMetricsHook,
    ],
    afterChange: [updateTickerTradeStatsHook],
    afterDelete: [updateTickerTradeStatsAfterDeleteHook],
  },
  endpoints: [
    {
      path: '/stats',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const startDate = req.query?.startDate as string | undefined
          const endDate = req.query?.endDate as string | undefined
          const tickerId = req.query?.tickerId as string | undefined
          const statusFilter = req.query?.statusFilter as string | undefined

          // Build the query
          const query: Record<string, any> = {}

          // Handle status filter
          if (statusFilter === 'closed-only') {
            query.status = {
              equals: 'closed',
            }
          } else {
            // Default: include both closed and partially closed trades
            query.status = {
              in: ['closed', 'partial'],
            }
          }

          // Add date filters if provided
          if (startDate) {
            query.entryDate = query.entryDate || {}
            query.entryDate.greater_than_equal = new Date(startDate)
          }

          if (endDate) {
            query.entryDate = query.entryDate || {}
            query.entryDate.less_than_equal = new Date(endDate)
          }

          // Add ticker filter if provided
          if (tickerId) {
            query.ticker = {
              equals: tickerId,
            }
          }

          // Fetch the trades
          const trades = await req.payload.find({
            collection: 'trades',
            where: query,
            limit: 1000,
          })

          const closedTradesCount = trades.docs.filter((t) => t.status === 'closed').length
          const partialTradesCount = trades.docs.filter((t) => t.status === 'partial').length

          // Calculate statistics
          const stats = calculateTradeStats(trades.docs)

          // Add more detailed metadata about the filter used
          const metadata = {
            totalTrades: trades.totalDocs,
            closedTrades: closedTradesCount,
            partialTrades: partialTradesCount,
            statusFilter: statusFilter === 'closed-only' ? 'Closed Only' : 'Closed and Partial',
            dateRange: startDate && endDate ? `${startDate} to ${endDate}` : 'All Time',
            tickerFilter: tickerId ? true : false,
          }

          return Response.json({ stats, metadata })
        } catch (error) {
          console.error('Error calculating trade stats:', error)
          return Response.json({ message: 'Error calculating trade statistics' }, { status: 500 })
        }
      },
    },
  ],
}

// Helper function to calculate trade statistics
function calculateTradeStats(trades: any[]): TradeStats {
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
