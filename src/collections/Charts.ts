// src/collections/Charts.ts
import { CollectionConfig, PayloadRequest } from 'payload'
import { updateTickerStatsAfterDeleteHook } from '../hooks/updateTickerStatsAfterDelete'

// Helper function to format chart display names
const formatChartTitle = (chart: any): string => {
  // Safely extract ticker info
  let tickerDisplay = '—'
  if (chart.ticker) {
    if (typeof chart.ticker === 'object' && chart.ticker.symbol) {
      tickerDisplay = chart.ticker.symbol
    } else if (typeof chart.ticker === 'string' || typeof chart.ticker === 'number') {
      tickerDisplay = `Ticker ID:${chart.ticker}`
    }
  }

  // Format date
  const dateStr = chart.timestamp
    ? typeof chart.timestamp === 'string'
      ? new Date(chart.timestamp).toLocaleDateString()
      : chart.timestamp.toLocaleDateString()
    : '—'

  // Get timeframe
  const timeframe = chart.timeframe || '—'

  // Return formatted title
  return `ID:${chart.id || 'new'} | ${tickerDisplay} | ${dateStr} | ${timeframe}`
}

export const Charts: CollectionConfig = {
  slug: 'charts',
  admin: {
    defaultColumns: ['image', 'ticker', 'timestamp', 'timeframe', 'tags'],
    // Use displayTitle field for admin display
    useAsTitle: 'displayTitle',
    group: 'Stock Data',
    listSearchableFields: ['ticker.symbol', 'notes', 'displayTitle'],
    pagination: {
      defaultLimit: 10000,
      limits: [10, 25, 50, 100, 200, 500, 1000, 10000],
    },
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'displayTitle',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Auto-generated display title for relationships',
      },
      hooks: {
        beforeChange: [
          async ({ data, siblingData, value }) => {
            // Keep existing value during updates
            return value || null
          },
        ],
      },
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      admin: {
        description: 'Upload a stock chart screenshot',
      },
    },
    {
      name: 'ticker',
      type: 'relationship',
      relationTo: 'tickers',
      required: true,
      admin: {
        description: 'Select the ticker symbol for this chart',
      },
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      admin: {
        description: 'When was this chart captured',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
      defaultValue: () => new Date(),
    },
    {
      name: 'timeframe',
      type: 'select',
      options: [
        { label: 'Daily', value: 'daily' },
        { label: 'Weekly', value: 'weekly' },
        { label: 'Monthly', value: 'monthly' },
        { label: 'Intraday', value: 'intraday' },
        { label: 'Other', value: 'other' },
      ],
      required: true,
      defaultValue: 'daily',
      admin: {
        description: 'Chart timeframe (daily, weekly, etc.)',
        position: 'sidebar',
      },
    },
    // Replace single notes field with a group of categorized notes
    {
      name: 'notes',
      type: 'group',
      admin: {
        description: 'Categorized notes about this chart pattern or observation',
      },
      fields: [
        {
          name: 'setupEntry',
          label: 'Setup / Entry',
          type: 'textarea',
          admin: {
            description: 'Notes about the chart setup and entry points',
          },
        },
        {
          name: 'trend',
          label: 'Trend',
          type: 'textarea',
          admin: {
            description: 'Notes about the overall trend',
          },
        },
        {
          name: 'fundamentals',
          label: 'Fundamentals',
          type: 'textarea',
          admin: {
            description: 'Notes about fundamental analysis',
          },
        },
        {
          name: 'other',
          label: 'Other',
          type: 'textarea',
          admin: {
            description: "Additional notes that don't fit the categories above",
          },
        },
      ],
      // Migration hook to convert existing notes to the new structure
      hooks: {
        beforeChange: [
          async ({ siblingData, value }) => {
            // Check if we're getting data from the old format (single text field)
            if (
              typeof siblingData.notes === 'string' &&
              siblingData.notes.trim() !== '' &&
              (!value || Object.keys(value).length === 0)
            ) {
              // Migrate the old notes to the 'other' category
              return {
                setupEntry: '',
                trend: '',
                fundamentals: '',
                other: siblingData.notes || '',
              }
            }
            return value
          },
        ],
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
      admin: {
        description: 'Tags for categorizing this chart',
      },
    },
    {
      name: 'annotations',
      type: 'json',
      admin: {
        description: 'Saved annotations (for future use)',
        readOnly: true,
        hidden: true,
      },
    },
    {
      name: 'measurements',
      type: 'array',
      admin: {
        description: 'Price measurements and calculations',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of this measurement (e.g., "Pullback", "Breakout")',
          },
        },
        {
          name: 'startPrice',
          type: 'number',
          required: true,
          admin: {
            description: 'Starting price point',
            step: 0.01,
          },
        },
        {
          name: 'endPrice',
          type: 'number',
          required: true,
          admin: {
            description: 'Ending price point',
            step: 0.01,
          },
        },
        {
          name: 'percentageChange',
          type: 'number',
          admin: {
            description: 'Calculated percentage change',
            readOnly: true,
            step: 0.01,
          },
          hooks: {
            beforeChange: [
              ({ siblingData }) => {
                if (siblingData.startPrice && siblingData.endPrice) {
                  const startPrice = parseFloat(siblingData.startPrice)
                  const endPrice = parseFloat(siblingData.endPrice)

                  if (startPrice && endPrice) {
                    return ((endPrice - startPrice) / startPrice) * 100
                  }
                }
                return null
              },
            ],
          },
        },
      ],
    },
    {
      name: 'annotatedImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Annotated version of this chart (if available)',
      },
    },
    {
      name: 'keyboardNavId',
      type: 'number',
      admin: {
        hidden: true,
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          async ({ value }) => {
            // Keep existing value during update operations
            return value || null
          },
        ],
      },
    },
  ],
  hooks: {
    // Combine all hooks into a single property
    afterRead: [
      async ({ doc, req }) => {
        // If ticker is present but not populated, try to populate it
        if (doc.ticker && typeof doc.ticker !== 'object') {
          try {
            // Explicitly fetch the ticker to get its symbol
            const tickerDoc = await req.payload.findByID({
              collection: 'tickers',
              id: doc.ticker,
              depth: 0,
            })

            if (tickerDoc) {
              // Create a populated ticker object
              doc.ticker = {
                id: doc.ticker,
                symbol: tickerDoc.symbol,
              }
            }
          } catch (error) {
            console.error('Error populating ticker in chart:', error)
          }
        }

        // Use the helper function to set the display title
        doc.displayTitle = formatChartTitle(doc)

        return doc
      },
    ],
    beforeChange: [
      ({ data, operation }) => {
        // For create operations, set a preliminary display title
        if (operation === 'create') {
          data.displayTitle = formatChartTitle(data)
        }

        return data
      },
    ],
    afterChange: [
      // NON-BLOCKING version of the ticker update hook that won't cause timeouts
      async ({ doc, req }) => {
        // Only run if we have a ticker
        if (!doc?.ticker) return doc

        try {
          // Get ticker ID (handle both populated and non-populated cases)
          const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker

          // Use a non-blocking approach to update the ticker's chart count
          // This will execute the update in the background and not block the response
          setTimeout(async () => {
            try {
              // Use a simpler, more direct query to count charts for this ticker
              const countResult = await req.payload.find({
                collection: 'charts',
                where: {
                  ticker: {
                    equals: tickerId,
                  },
                },
                limit: 0,
              })

              const chartCount = countResult.totalDocs || 0

              // Update the ticker with a simple, focused update operation
              await req.payload.update({
                collection: 'tickers',
                id: tickerId,
                data: {
                  chartsCount: chartCount,
                },
                depth: 0,
              })

              console.log(`Successfully updated ticker ${tickerId} chart count to ${chartCount}`)
            } catch (err) {
              console.error(`Background ticker update error for ${tickerId}:`, err)
            }
          }, 100) // Small delay to ensure this runs after the current transaction completes

          // Handle tags for the ticker (simplified implementation)
          if (doc.tags) {
            setTimeout(async () => {
              try {
                // Find all charts for this ticker
                const chartsForTicker = await req.payload.find({
                  collection: 'charts',
                  where: {
                    ticker: {
                      equals: tickerId,
                    },
                  },
                  depth: 0,
                  limit: 200,
                })

                // Collect all unique tag IDs
                const allTagIds = new Set<number>()
                chartsForTicker.docs.forEach((chart) => {
                  if (chart.tags && Array.isArray(chart.tags)) {
                    chart.tags.forEach((tag) => {
                      const tagId = typeof tag === 'object' ? tag.id : tag
                      if (tagId) {
                        const numericTagId = typeof tagId === 'string' ? parseInt(tagId, 10) : tagId
                        if (!isNaN(numericTagId)) {
                          allTagIds.add(numericTagId)
                        }
                      }
                    })
                  }
                })

                // Update the ticker with the aggregated tags
                if (allTagIds.size > 0) {
                  await req.payload.update({
                    collection: 'tickers',
                    id: tickerId,
                    data: {
                      tags: Array.from(allTagIds),
                    },
                    depth: 0,
                  })
                }
              } catch (error) {
                console.error('Error updating ticker tags:', error)
              }
            }, 150)
          }
        } catch (error) {
          console.error('Error in chart afterChange hook:', error)
        }

        return doc
      },
      // Handle keyboard navigation ID as a separate hook
      async ({ doc, operation, req }) => {
        if (operation === 'create') {
          try {
            // Update the keyboardNavId for keyboard navigation
            const count = await req.payload.find({
              collection: 'charts',
              limit: 0,
              depth: 0,
            })

            // Use setTimeout to avoid transaction blocking
            setTimeout(async () => {
              try {
                await req.payload.update({
                  collection: 'charts',
                  id: doc.id,
                  data: {
                    keyboardNavId: count.totalDocs,
                  },
                  depth: 0,
                })
              } catch (err) {
                console.error('Error updating keyboardNavId:', err)
              }
            }, 200)
          } catch (err) {
            console.error('Error getting count for keyboardNavId:', err)
          }
        }
        return doc
      },
    ],
    // Add the afterDelete hook
    afterDelete: [updateTickerStatsAfterDeleteHook],
  },
  endpoints: [
    {
      path: '/next/:id',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const id = req.routeParams?.id
          const filter = req.query?.filter

          if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
            return Response.json({ error: 'Invalid Chart ID' }, { status: 400 })
          }

          // Get the current chart to find its keyboardNavId
          const currentChart = await req.payload.findByID({
            collection: 'charts',
            id,
            depth: 0, // No need to load relationships
          })

          if (!currentChart) {
            return Response.json({ error: 'Chart not found' }, { status: 404 })
          }

          // Find the next chart based on keyboardNavId
          const query = {
            keyboardNavId: {
              greater_than: currentChart.keyboardNavId,
            },
          }

          // Apply additional filters if provided
          if (filter) {
            // You would need to parse and apply the filter here
            // This is a simplified example
          }

          const nextCharts = await req.payload.find({
            collection: 'charts',
            where: query,
            sort: 'keyboardNavId',
            limit: 1,
            depth: 1, // Load first-level relationships
          })

          if (nextCharts.docs.length > 0) {
            return Response.json(nextCharts.docs[0])
          } else {
            // Wrap around to the first chart
            const firstCharts = await req.payload.find({
              collection: 'charts',
              sort: 'keyboardNavId',
              limit: 1,
              depth: 1, // Load first-level relationships
            })

            if (firstCharts.docs.length > 0) {
              return Response.json(firstCharts.docs[0])
            } else {
              return Response.json({ error: 'No charts available' }, { status: 404 })
            }
          }
        } catch (error) {
          console.error('Error fetching next chart:', error)
          return Response.json({ error: 'Error fetching next chart' }, { status: 500 })
        }
      },
    },
    {
      path: '/previous/:id',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const id = req.routeParams?.id
          const filter = req.query?.filter

          if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
            return Response.json({ error: 'Invalid Chart ID' }, { status: 400 })
          }

          // Get the current chart to find its keyboardNavId
          const currentChart = await req.payload.findByID({
            collection: 'charts',
            id,
            depth: 0, // No need to load relationships
          })

          if (!currentChart) {
            return Response.json({ error: 'Chart not found' }, { status: 404 })
          }

          // Find the previous chart based on keyboardNavId
          const query = {
            keyboardNavId: {
              less_than: currentChart.keyboardNavId,
            },
          }

          // Apply additional filters if provided
          if (filter) {
            // You would need to parse and apply the filter here
            // This is a simplified example
          }

          const prevCharts = await req.payload.find({
            collection: 'charts',
            where: query,
            sort: '-keyboardNavId',
            limit: 1,
            depth: 1, // Load first-level relationships
          })

          if (prevCharts.docs.length > 0) {
            return Response.json(prevCharts.docs[0])
          } else {
            // Wrap around to the last chart
            const lastCharts = await req.payload.find({
              collection: 'charts',
              sort: '-keyboardNavId',
              limit: 1,
              depth: 1, // Load first-level relationships
            })

            if (lastCharts.docs.length > 0) {
              return Response.json(lastCharts.docs[0])
            } else {
              return Response.json({ error: 'No charts available' }, { status: 404 })
            }
          }
        } catch (error) {
          console.error('Error fetching previous chart:', error)
          return Response.json({ error: 'Error fetching previous chart' }, { status: 500 })
        }
      },
    },
    // New endpoint for filtering charts by timeframe
    {
      path: '/by-timeframe/:timeframe',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const timeframe = req.routeParams?.timeframe
          const page = parseInt((req.query?.page as string) || '1', 10)
          const limit = parseInt((req.query?.limit as string) || '20', 10)

          if (!timeframe) {
            return Response.json({ error: 'Timeframe is required' }, { status: 400 })
          }

          const charts = await req.payload.find({
            collection: 'charts',
            where: {
              timeframe: {
                equals: timeframe,
              },
            },
            page,
            limit,
            sort: '-timestamp',
            depth: 1, // Load first-level relationships
          })

          return Response.json(charts)
        } catch (error) {
          console.error('Error fetching charts by timeframe:', error)
          return Response.json({ error: 'Error fetching charts by timeframe' }, { status: 500 })
        }
      },
    },
    // New endpoint for filtering charts by tag
    {
      path: '/by-tag/:tagId',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const tagId = req.routeParams?.tagId
          const page = parseInt((req.query?.page as string) || '1', 10)
          const limit = parseInt((req.query?.limit as string) || '20', 10)

          if (!tagId) {
            return Response.json({ error: 'Tag ID is required' }, { status: 400 })
          }

          const charts = await req.payload.find({
            collection: 'charts',
            where: {
              tags: {
                contains: tagId,
              },
            },
            page,
            limit,
            sort: '-timestamp',
            depth: 1, // Load first-level relationships
          })

          return Response.json(charts)
        } catch (error) {
          console.error('Error fetching charts by tag:', error)
          return Response.json({ error: 'Error fetching charts by tag' }, { status: 500 })
        }
      },
    },
    // Add an endpoint to manually refresh ticker stats
    {
      path: '/refresh-ticker-stats/:tickerId',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          const tickerId = req.routeParams?.tickerId

          if (!tickerId) {
            return Response.json({ error: 'Ticker ID is required' }, { status: 400 })
          }

          // Count charts for this ticker
          const chartCount = await req.payload.find({
            collection: 'charts',
            where: {
              ticker: {
                equals: tickerId,
              },
            },
            limit: 0,
          })

          // Update the ticker
          await req.payload.update({
            collection: 'tickers',
            id: String(tickerId),
            data: {
              chartsCount: chartCount.totalDocs,
            },
            depth: 0,
          })

          return Response.json({
            success: true,
            message: `Updated ticker ${tickerId} chart count to ${chartCount.totalDocs}`,
          })
        } catch (error) {
          console.error('Error refreshing ticker stats:', error)
          return Response.json({ error: 'Error refreshing ticker stats' }, { status: 500 })
        }
      },
    },
  ],
}
