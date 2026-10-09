import { CollectionConfig, PayloadRequest } from 'payload'
import { calculateTradeMetricsHook } from '../hooks/calculateTradeMetrics'
import { updateTickerTradeStatsHook } from '../hooks/updateTickerTradeStats'
import { calculateCurrentMetricsHook } from '../hooks/calculateCurrentMetrics'
import { calculateNormalizedMetricsHook } from '../hooks/calculateNormalizedMetrics'
import { updateTickerTradeStatsAfterDeleteHook } from '../hooks/updateTickerTradeStatsAfterDelete'
import { Where } from 'payload'
import {
  computeStats,
  filterSnapshotTrades,
  getTradeStatsSnapshot,
  invalidateTradeStatsSnapshot,
  toStatsTradeRow,
} from '../utilities/tradeStats'

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

export const Trades: CollectionConfig = {
  slug: 'trades',
  admin: {
    defaultColumns: [
      'ticker',
      'type',
      'entryDate',
      'status',
      'breakEvenSecured',
      'profitLossPercent',
      'rRatio',
    ],
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
      index: true,
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
      index: true,
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
      name: 'didNotTrade',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          "Hypothetical trade Leoš did NOT actually take — excluded from stats and the public trades list, but shown in the Gym replay",
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
      index: true,
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
      name: 'breakEvenSecured',
      label: 'Break-Even Secured 🥇',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        position: 'sidebar',
        description:
          'Partials booked and/or the stop raised far enough that being stopped out now is break-even or better. Live positions only — cleared automatically once the trade is fully exited.',
        condition: (data) => data?.status !== 'closed',
      },
      hooks: {
        beforeChange: [
          ({ value, siblingData }) => {
            // Break-even protection only means something while shares are still on.
            // Mirrors the status field's exits math so the flag drops in the same
            // save that closes the trade, rather than lingering as a stale medal.
            if (siblingData.exits && siblingData.exits.length > 0 && siblingData.shares) {
              const totalSharesExited = siblingData.exits.reduce(
                (sum: number, exit: ExitRecord) => sum + (parseFloat(String(exit.shares)) || 0),
                0,
              )

              if (totalSharesExited >= siblingData.shares) {
                return false
              }
            }

            return value ?? false
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
              // Use req.user directly — already available from auth, no DB query needed
              const defaultTarget = req.user?.preferences?.targetPositionSize || 25000
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
    afterChange: [
      updateTickerTradeStatsHook,
      ({ doc }) => {
        invalidateTradeStatsSnapshot()
        return doc
      },
    ],
    afterDelete: [
      updateTickerTradeStatsAfterDeleteHook,
      ({ doc }) => {
        invalidateTradeStatsSnapshot()
        return doc
      },
    ],
  },
  endpoints: [
    // Stats are served from an in-memory snapshot of the trades (see utilities/tradeStats.ts),
    // so no request hits the DB unless the snapshot was invalidated by a trade change.
    {
      path: '/stats',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const snapshot = await getTradeStatsSnapshot(req.payload)
          const query = {
            startDate: req.query?.startDate as string | undefined,
            endDate: req.query?.endDate as string | undefined,
            tickerId: req.query?.tickerId as string | undefined,
            statusFilter: req.query?.statusFilter as string | undefined,
          }
          const filteredTrades = filterSnapshotTrades(snapshot, query)

          return Response.json({
            ...computeStats(filteredTrades, query),
            // The exact trades behind these stats (for the total P/L % sum and the histogram)
            trades: filteredTrades.map(toStatsTradeRow),
            computedAt: snapshot.computedAt,
          })
        } catch (error) {
          console.error('Error calculating trade stats:', error)
          return Response.json({ message: 'Error calculating trade statistics' }, { status: 500 })
        }
      },
    },
    // Precomputed yearly + monthly stats for the "By Time Period" table, in one response
    {
      path: '/stats/periods',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const snapshot = await getTradeStatsSnapshot(req.payload)
          const statusFilter = req.query?.statusFilter === 'closed-only' ? 'closed-only' : 'all'

          return Response.json({
            years: snapshot.periods[statusFilter],
            computedAt: snapshot.computedAt,
          })
        } catch (error) {
          console.error('Error loading period trade stats:', error)
          return Response.json({ message: 'Error calculating trade statistics' }, { status: 500 })
        }
      },
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
            depth: 2,
          })

          if (!trade) {
            return Response.json({ error: 'Trade not found' }, { status: 404 })
          }

          // Get all related charts if they exist
          let storyCharts: any[] = []
          if (trade.relatedCharts && trade.relatedCharts.length > 0) {
            const chartIds = trade.relatedCharts.map((chart: any) =>
              typeof chart === 'object' ? chart.id : chart,
            )

            const chartsResult = await req.payload.find({
              collection: 'charts',
              where: {
                id: {
                  in: chartIds,
                },
              },
              sort: 'timestamp',
              limit: 100,
              depth: 1,
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
              riskPercent: trade.riskPercent,
            },
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
                  previousStop:
                    index === 0
                      ? trade.initialStopLoss
                      : (trade.modifiedStops?.[index - 1]?.price ?? undefined),
                  newStop: stop.price,
                  notes: stop.notes,
                },
              })
            })
          }

          // Exit events
          if (trade.exits && trade.exits.length > 0) {
            trade.exits.forEach((exit: any, index: number) => {
              const exitPL =
                trade.type === 'long'
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
                  notes: exit.notes,
                },
              })
            })
          }

          // Sort events chronologically
          timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

          // Calculate trade duration
          const entryDate = new Date(trade.entryDate)
          const lastEventDate =
            trade.exits && trade.exits.length > 0
              ? new Date(Math.max(...trade.exits.map((e: any) => new Date(e.date).getTime())))
              : new Date()

          const tradeDuration = Math.floor(
            (lastEventDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
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
            eventCount: timelineEvents.length,
            didNotTrade: trade.didNotTrade === true,
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
              notes: trade.notes,
            },
          })
        } catch (error) {
          console.error('Error fetching trade story:', error)
          return Response.json(
            { success: false, error: 'Failed to fetch trade story' },
            { status: 500 },
          )
        }
      },
    },
    // Add this additional endpoint for updating chart story metadata
    {
      path: '/:tradeId/story/charts/:chartId',
      method: 'patch',
      handler: async (req: PayloadRequest) => {
        try {
          const { tradeId, chartId } = req.routeParams || {}
          if (!tradeId || !chartId) {
            return Response.json({ error: 'Trade ID and Chart ID are required' }, { status: 400 })
          }

          if (typeof req.json !== 'function') {
            return Response.json({ error: 'Request body parser is not available' }, { status: 400 })
          }
          const updates = await req.json()

          // verify it belongs
          const trade = await req.payload.findByID({
            collection: 'trades',
            id: String(tradeId),
            depth: 0,
          })
          if (!trade) {
            return Response.json({ error: 'Trade not found' }, { status: 404 })
          }
          const belongs = (trade.relatedCharts || []).some(
            (c) => (typeof c === 'object' ? c.id : c) === chartId,
          )
          if (!belongs) {
            return Response.json({ error: 'Chart does not belong to this trade' }, { status: 403 })
          }

          // **DROP** the <Generic> on update, and cast data to any so TS accepts tradeStory
          const updatedChart = await req.payload.update({
            collection: 'charts',
            id: String(chartId),
            data: {
              tradeStory: updates.tradeStory,
            } as any,
          })

          return Response.json({ success: true, chart: updatedChart })
        } catch (error) {
          console.error('Error updating chart story metadata:', error)
          return Response.json(
            { success: false, error: 'Failed to update chart story metadata' },
            { status: 500 },
          )
        }
      },
    },
  ],
}
