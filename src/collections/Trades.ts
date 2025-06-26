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
   // ONLY replace the stats endpoint handler with this:
// Everything else in your Trades collection stays EXACTLY the same

{
  path: '/stats',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    try {
      const startDate = req.query?.startDate as string | undefined
      const endDate = req.query?.endDate as string | undefined
      const tickerId = req.query?.tickerId as string | undefined
      const statusFilter = req.query?.statusFilter as string | undefined

      // Build the query (UNCHANGED except removing date filters)
      const query: Record<string, any> = {}

      // Handle status filter (UNCHANGED)
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

      // REMOVED: Date filtering on entryDate
      // OLD CODE (removed):
      // if (startDate) {
      //   query.entryDate = query.entryDate || {}
      //   query.entryDate.greater_than_equal = new Date(startDate)
      // }
      // if (endDate) {
      //   query.entryDate = query.entryDate || {}
      //   query.entryDate.less_than_equal = new Date(endDate)
      // }

      // Add ticker filter if provided (UNCHANGED)
      if (tickerId) {
        query.ticker = {
          equals: tickerId,
        }
      }

      // Fetch ALL trades matching status/ticker (NEW: no date filtering)
      const trades = await req.payload.find({
        collection: 'trades',
        where: query,
        limit: 1000,
      })

      // NEW: Filter by last exit date instead of entry date
      let filteredTrades = trades.docs
      
      if (startDate || endDate) {
        filteredTrades = trades.docs.filter(trade => {
          // Get the last exit date for this trade
          let completionDate: Date
          
          if (trade.exits && trade.exits.length > 0) {
            // Find the most recent exit date
            const lastExitDate = trade.exits.reduce((latest: string, exit: any) => {
              const exitDate = new Date(exit.date)
              const latestDate = new Date(latest)
              return exitDate > latestDate ? exit.date : latest
            }, trade.exits[0]?.date || trade.entryDate)
            
            completionDate = new Date(lastExitDate)
          } else {
            // Fallback to entry date (shouldn't happen for closed/partial trades)
            completionDate = new Date(trade.entryDate)
          }
          
          // Apply date filtering using completion date
          if (startDate) {
            const filterStartDate = new Date(startDate)
            if (completionDate < filterStartDate) {
              return false
            }
          }
          
          if (endDate) {
            const filterEndDate = new Date(endDate)
            filterEndDate.setHours(23, 59, 59, 999) // End of day
            if (completionDate > filterEndDate) {
              return false
            }
          }
          
          return true
        })
      }

      // Calculate counts (CHANGED: use filteredTrades instead of trades.docs)
      const closedTradesCount = filteredTrades.filter((t) => t.status === 'closed').length
      const partialTradesCount = filteredTrades.filter((t) => t.status === 'partial').length

      // Calculate statistics (UNCHANGED - same function, same logic)
      const stats = calculateTradeStats(filteredTrades)

      // Metadata (UNCHANGED except totalTrades count)
      const metadata = {
        totalTrades: filteredTrades.length, // CHANGED: was trades.totalDocs
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
{
  path: '/:id/story',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    const tradeId = req.routeParams?.id
    
    // Fetch trade with related charts
    const trade = await req.payload.findByID({
      collection: 'trades',
      id: tradeId,
      depth: 2
    })
    
    // Get all related charts sorted by timestamp
    const storyCharts = await req.payload.find({
      collection: 'charts',
      where: {
        id: {
          in: (trade.relatedCharts || []).map(c => typeof c === 'object' ? c.id : c)
        }
      },
      sort: 'timestamp',
      depth: 1
    })
    
    // Build the story timeline
    const timeline = {
      trade,
      charts: storyCharts.docs,
      keyEvents: [
        {
          date: trade.entryDate,
          type: 'entry',
          description: `Entered ${trade.type} position`,
          price: trade.entryPrice,
          shares: trade.shares
        },
        ...trade.modifiedStops?.map(stop => ({
          date: stop.date,
          type: 'stopModified',
          description: 'Modified stop loss',
          price: stop.price,
          notes: stop.notes
        })) || [],
        ...trade.exits?.map(exit => ({
          date: exit.date,
          type: 'exit',
          description: `Exited ${exit.shares} shares`,
          price: exit.price,
          reason: exit.reason,
          notes: exit.notes
        })) || []
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }
    
    return Response.json(timeline)
  }
},
{
  path: '/:id/story',
  method: 'get',
  handler: async (req: PayloadRequest) => {
    try {
      const tradeId = req.routeParams?.id

      if (!tradeId) {
        return Response.json({ error: 'Trade ID is required' }, { status: 400 })
      }

      // Fetch the trade with full depth
      const trade = await req.payload.findByID({
        collection: 'trades',
        id: String(tradeId),
        depth: 2
      })

      if (!trade) {
        return Response.json({ error: 'Trade not found' }, { status: 404 })
      }

      // Get all related charts if they exist
      let storyCharts = []
      if (trade.relatedCharts && trade.relatedCharts.length > 0) {
        const chartIds = trade.relatedCharts.map((chart: any) => 
          typeof chart === 'object' ? chart.id : chart
        )

        const chartsResult = await req.payload.find({
          collection: 'charts',
          where: {
            id: {
              in: chartIds
            }
          },
          sort: 'timestamp',
          limit: 100,
          depth: 1
        })

        storyCharts = chartsResult.docs
      }

      // Build timeline events
      const timelineEvents = []

      // Entry event
      timelineEvents.push({
        date: trade.entryDate,
        type: 'entry',
        title: 'Position Entry',
        description: `Entered ${trade.type} position`,
        details: {
          price: trade.entryPrice,
          shares: trade.shares,
          positionSize: trade.positionSize,
          initialStop: trade.initialStopLoss,
          riskAmount: trade.riskAmount,
          riskPercent: trade.riskPercent
        }
      })

      // Stop modification events
      if (trade.modifiedStops && trade.modifiedStops.length > 0) {
        trade.modifiedStops.forEach((stop: any, index: number) => {
          timelineEvents.push({
            date: stop.date,
            type: 'stopModified',
            title: `Stop Loss Modified (#${index + 1})`,
            description: 'Adjusted stop loss level',
            details: {
              previousStop: index === 0 ? trade.initialStopLoss : trade.modifiedStops[index - 1].price,
              newStop: stop.price,
              notes: stop.notes
            }
          })
        })
      }

      // Exit events
      if (trade.exits && trade.exits.length > 0) {
        trade.exits.forEach((exit: any, index: number) => {
          const exitPL = trade.type === 'long' 
            ? (exit.price - trade.entryPrice) * exit.shares
            : (trade.entryPrice - exit.price) * exit.shares

          timelineEvents.push({
            date: exit.date,
            type: 'exit',
            title: `Position Exit (#${index + 1})`,
            description: `Exited ${exit.shares} shares`,
            details: {
              price: exit.price,
              shares: exit.shares,
              reason: exit.reason,
              profitLoss: exitPL,
              notes: exit.notes
            }
          })
        })
      }

      // Sort events chronologically
      timelineEvents.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      // Calculate trade duration
      const entryDate = new Date(trade.entryDate)
      const lastEventDate = trade.exits && trade.exits.length > 0
        ? new Date(Math.max(...trade.exits.map((e: any) => new Date(e.date).getTime())))
        : new Date()
      
      const tradeDuration = Math.floor(
        (lastEventDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Build story metadata
      const storyMetadata = {
        ticker: trade.ticker,
        tradeType: trade.type,
        setupType: trade.setupType,
        status: trade.status,
        duration: tradeDuration,
        totalReturn: trade.profitLossAmount || 0,
        totalReturnPercent: trade.profitLossPercent || 0,
        rRatio: trade.rRatio || 0,
        chartCount: storyCharts.length,
        eventCount: timelineEvents.length
      }

      // Group charts by role
      const chartsByRole = storyCharts.reduce((acc: any, chart: any) => {
        const role = chart.tradeStory?.chartRole || 'reference'
        if (!acc[role]) acc[role] = []
        acc[role].push(chart)
        return acc
      }, {})

      return Response.json({
        success: true,
        trade,
        story: {
          metadata: storyMetadata,
          timeline: timelineEvents,
          charts: storyCharts,
          chartsByRole,
          notes: trade.notes
        }
      })
    } catch (error) {
      console.error('Error fetching trade story:', error)
      return Response.json(
        { success: false, error: 'Failed to fetch trade story' },
        { status: 500 }
      )
    }
  }
},
// Add this additional endpoint for updating chart story metadata
{
  path: '/:tradeId/story/charts/:chartId',
  method: 'patch',
  handler: async (req: PayloadRequest) => {
    try {
      const { tradeId, chartId } = req.routeParams || {}
      const updates = await req.json()

      if (!tradeId || !chartId) {
        return Response.json({ error: 'Trade ID and Chart ID are required' }, { status: 400 })
      }

      // Verify the chart belongs to this trade
      const trade = await req.payload.findByID({
        collection: 'trades',
        id: String(tradeId),
        depth: 0
      })

      if (!trade) {
        return Response.json({ error: 'Trade not found' }, { status: 404 })
      }

      const chartBelongsToTrade = trade.relatedCharts?.some((chart: any) => 
        (typeof chart === 'object' ? chart.id : chart) === chartId
      )

      if (!chartBelongsToTrade) {
        return Response.json({ error: 'Chart does not belong to this trade' }, { status: 403 })
      }

      // Update the chart's trade story metadata
      const updatedChart = await req.payload.update({
        collection: 'charts',
        id: String(chartId),
        data: {
          tradeStory: updates.tradeStory
        }
      })

      return Response.json({
        success: true,
        chart: updatedChart
      })
    } catch (error) {
      console.error('Error updating chart story metadata:', error)
      return Response.json(
        { success: false, error: 'Failed to update chart story metadata' },
        { status: 500 }
      )
    }
  }
}
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
