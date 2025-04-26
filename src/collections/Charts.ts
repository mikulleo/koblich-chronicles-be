// src/collections/Charts.ts
import { CollectionConfig, PayloadRequest } from 'payload'
import { updateTickerStatsHook } from '../hooks/updateTickerStats'
import { updateTickerTagsHook } from '../hooks/updateTickerTags'
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
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Notes about this chart pattern or observation',
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
      updateTickerStatsHook,
      updateTickerTagsHook,
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
  ],
}
