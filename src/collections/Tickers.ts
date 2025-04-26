import { CollectionConfig, PayloadRequest } from 'payload'
export const Tickers: CollectionConfig = {
  slug: 'tickers',
  admin: {
    useAsTitle: 'symbol',
    defaultColumns: ['symbol', 'name', 'chartsCount', 'sector'],
    group: 'Stock Data',
    components: {
      // Add refresh button before the list view
      beforeList: ['/components/TickerUpdate/TickerCollectionListAction'],

      // Add Description component with refresh button for single ticker
      Description: '/components/TickerUpdate/TickerDescription',
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'symbol',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Stock ticker symbol (e.g., AAPL)',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Full company name (e.g., Apple Inc.)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Brief description of the company',
      },
    },
    {
      name: 'sector',
      type: 'text',
      admin: {
        description: 'Industry sector (e.g., Technology)',
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        description: 'Tags associated with this ticker across all charts',
        position: 'sidebar',
      },
    },
    {
      name: 'chartsCount',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Number of chart entries for this ticker',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // This field is updated by a separate hook after chart creation/deletion
            // We're preserving it during direct ticker edits
            return siblingData.chartsCount || 0
          },
        ],
      },
    },
    {
      name: 'tradesCount',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Number of trades for this ticker',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // This field is updated by a separate hook after trade creation/deletion
            return siblingData.tradesCount || 0
          },
        ],
      },
    },
    {
      name: 'profitLoss',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Total profit/loss for this ticker',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // This field is updated by a separate hook after trade updates
            return siblingData.profitLoss || 0
          },
        ],
      },
    },
  ],
  endpoints: [
    {
      path: '/:id/charts',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const id = req.routeParams?.id

          if (!id) {
            return Response.json({ error: 'ID is required' }, { status: 400 })
          }

          const charts = await req.payload.find({
            collection: 'charts',
            where: {
              ticker: {
                equals: id,
              },
            },
            sort: '-timestamp',
          })

          return Response.json(charts)
        } catch (error) {
          console.error('Error fetching charts:', error)
          return Response.json({ error: 'Failed to fetch charts' }, { status: 500 })
        }
      },
    },
    {
      path: '/:id/trades',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const id = req.routeParams?.id

          if (!id) {
            return Response.json({ error: 'ID is required' }, { status: 400 })
          }

          const trades = await req.payload.find({
            collection: 'trades',
            where: {
              ticker: {
                equals: id,
              },
            },
            sort: '-entryDate',
          })

          return Response.json(trades)
        } catch (error) {
          console.error('Error fetching trades:', error)
          return Response.json({ error: 'Failed to fetch trades' }, { status: 500 })
        }
      },
    },
    // New endpoint to refresh ticker counts
    {
      path: '/refresh-counts',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          let tickerId: string | number | undefined

          // Parse the body correctly
          // In Payload's request object, req.body might be already parsed
          if (req.body && typeof req.body === 'object' && 'tickerId' in req.body) {
            if (typeof req.body.tickerId === 'string' || typeof req.body.tickerId === 'number') {
              tickerId = req.body.tickerId
            }
          }

          let tickers

          // If a specific ticker ID is provided, only refresh that one
          if (tickerId) {
            tickers = await req.payload.find({
              collection: 'tickers',
              where: {
                id: {
                  equals: tickerId,
                },
              },
              limit: 1,
            })
          } else {
            // Otherwise refresh all tickers
            tickers = await req.payload.find({
              collection: 'tickers',
              limit: 1000,
            })
          }

          const results = await Promise.all(
            tickers.docs.map(async (ticker) => {
              try {
                // Count charts for this ticker
                const chartCount = await req.payload.find({
                  collection: 'charts',
                  where: {
                    ticker: {
                      equals: ticker.id,
                    },
                  },
                  limit: 0, // Just need the count
                })

                // Count trades for this ticker
                const tradeCount = await req.payload.find({
                  collection: 'trades',
                  where: {
                    ticker: {
                      equals: ticker.id,
                    },
                  },
                  limit: 0, // Just need the count
                })

                // Calculate total profit/loss for this ticker
                const trades = await req.payload.find({
                  collection: 'trades',
                  where: {
                    ticker: {
                      equals: ticker.id,
                    },
                    status: {
                      in: ['closed', 'partial'],
                    },
                  },
                  limit: 500, // Reasonable limit for calculations
                })

                let totalProfitLoss = 0

                trades.docs.forEach((trade) => {
                  if (trade.profitLossAmount !== undefined && trade.profitLossAmount !== null) {
                    // Handle both string and number types
                    totalProfitLoss +=
                      typeof trade.profitLossAmount === 'string'
                        ? parseFloat(trade.profitLossAmount)
                        : trade.profitLossAmount
                  }
                })

                // Update the ticker's counts
                await req.payload.update({
                  collection: 'tickers',
                  id: ticker.id,
                  data: {
                    chartsCount: chartCount.totalDocs,
                    tradesCount: tradeCount.totalDocs,
                    profitLoss: parseFloat(totalProfitLoss.toFixed(2)),
                  },
                  depth: 0, // Prevent hooks from running on this update
                })

                return {
                  id: ticker.id,
                  symbol: ticker.symbol,
                  chartsCount: chartCount.totalDocs,
                  tradesCount: tradeCount.totalDocs,
                  profitLoss: parseFloat(totalProfitLoss.toFixed(2)),
                }
              } catch (error) {
                console.error(`Error refreshing counts for ticker ${ticker.id}:`, error)
                return {
                  id: ticker.id,
                  symbol: ticker.symbol,
                  error: 'Failed to refresh counts',
                }
              }
            }),
          )

          return Response.json({
            success: true,
            message: tickerId ? 'Ticker counts refreshed' : 'All ticker counts refreshed',
            results,
          })
        } catch (error) {
          console.error('Error refreshing ticker counts:', error)
          return Response.json(
            {
              success: false,
              error: 'Failed to refresh ticker counts',
            },
            { status: 500 },
          )
        }
      },
    },
  ],
}
