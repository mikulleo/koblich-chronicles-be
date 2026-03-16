// src/collections/Charts.ts
import { CollectionConfig, PayloadRequest, Where } from 'payload'
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
      defaultLimit: 100,
      limits: [10, 25, 50, 100, 200, 500, 1000],
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
          async ({ value }) => {
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
      index: true,
      admin: {
        description: 'Select the ticker symbol for this chart',
      },
    },
    {
      name: 'timestamp',
      type: 'date',
      required: true,
      index: true,
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
        // Add these fields to your existing Charts collection in src/collections/Charts.ts

        // Add after the existing fields, before hooks
        {
          name: 'tradeStory',
          type: 'group',
          admin: {
            description: 'Trade story metadata for timeline features',
          },
          fields: [
            {
              name: 'chartRole',
              type: 'select',
              options: [
                { label: 'Entry Signal', value: 'entry' },
                { label: 'Position Management', value: 'management' },
                { label: 'Stop Adjustment', value: 'stopAdjustment' },
                { label: 'Exit Signal', value: 'exit' },
                { label: 'Post-Trade Analysis', value: 'analysis' },
                { label: 'Market Context', value: 'context' },
                { label: 'General Reference', value: 'reference' },
              ],
              defaultValue: 'reference',
              admin: {
                description: 'What role does this chart play in the trade story?',
              },
            },
            {
              name: 'storySequence',
              type: 'number',
              admin: {
                description: 'Order in the trade story (1, 2, 3...)',
                step: 1,
                placeholder: 'Leave empty for automatic ordering by timestamp',
              },
            },
            {
              name: 'decisionNotes',
              type: 'textarea',
              admin: {
                description:
                  'What were you thinking at this moment? Decision process, market read, etc.',
                rows: 3,
              },
            },
            {
              name: 'emotionalState',
              type: 'select',
              options: [
                { label: 'Confident', value: 'confident' },
                { label: 'Cautious', value: 'cautious' },
                { label: 'Uncertain', value: 'uncertain' },
                { label: 'Fearful', value: 'fearful' },
                { label: 'Greedy', value: 'greedy' },
                { label: 'Neutral', value: 'neutral' },
              ],
              admin: {
                description: 'Your emotional state when viewing this chart',
              },
            },
            {
              name: 'marketContext',
              type: 'textarea',
              admin: {
                description: 'Market conditions, news, or sector activity at this time',
                rows: 2,
              },
            },
          ],
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
      index: true,
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
      async ({ doc }) => {
        // Ticker population is handled by Payload's built-in depth parameter.
        // No need to manually fetch — just set the display title from whatever is available.
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
      // Consolidated ticker stats update — single async operation instead of 3 setTimeouts
      async ({ doc, operation, req }) => {
        if (!doc?.ticker) return doc

        const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker

        // Fire a single background task that batches all ticker updates into one
        // Using setImmediate-style scheduling to run after the current transaction
        setTimeout(async () => {
          try {
            // 1. Count charts for this ticker (single query, reused for both count and tags)
            const chartsForTicker = await req.payload.find({
              collection: 'charts',
              where: { ticker: { equals: tickerId } },
              depth: 0,
              limit: 500,
            })

            const chartCount = chartsForTicker.totalDocs || 0

            // 2. Collect unique tag IDs from all charts in one pass
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

            // 3. Single ticker update with both chart count and tags
            await req.payload.update({
              collection: 'tickers',
              id: tickerId,
              data: {
                chartsCount: chartCount,
                ...(allTagIds.size > 0 ? { tags: Array.from(allTagIds) } : {}),
              },
              depth: 0,
            })

            // 4. Set keyboardNavId on create (uses the count we already have)
            if (operation === 'create') {
              await req.payload.update({
                collection: 'charts',
                id: doc.id,
                data: { keyboardNavId: chartCount },
                depth: 0,
              })
            }
          } catch (err) {
            console.error(`Chart afterChange background update error for ticker ${tickerId}:`, err)
          }
        }, 100)

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
    {
      path: '/export',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        // Resolve allowed origin for CORS on this binary response
        const origin = req.headers.get('origin') || ''
        const allowedOrigins = [
          process.env.PAYLOAD_PUBLIC_SERVER_URL,
          'http://localhost:3000',
          'http://localhost:3001',
          'https://www.koblich-chronicles.com',
          'https://koblich-chronicles-fe-3g6s.vercel.app',
          'https://koblich-chronicles-fe-3g6s-leos-mikulkas-projects.vercel.app',
        ].filter(Boolean) as string[]
        const corsOrigin = allowedOrigins.includes(origin) ? origin : ''
        const corsHeaders: Record<string, string> = corsOrigin
          ? {
              'Access-Control-Allow-Origin': corsOrigin,
              'Access-Control-Allow-Methods': 'GET, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            }
          : {}

        try {
          const { tickerId, startDate, endDate, timeframe, tags } = req.query

          const query: Where = {}

          if (tickerId) {
            query.ticker = { equals: tickerId as string | number }
          }

          // Default to current year if no date range specified
          const effectiveStartDate = startDate || '2025-01-01'
          const effectiveEndDate = endDate || '2025-12-31'

          query.timestamp = {
            greater_than_equal: new Date(effectiveStartDate as string),
            less_than_equal: new Date(effectiveEndDate as string),
          }

          if (timeframe) {
            query.timeframe = { equals: timeframe as string }
          }

          if (tags) {
            const tagArray = Array.isArray(tags) ? tags : [tags]
            query.tags = { in: tagArray as (string | number)[] }
          }

          // Fetch charts with full depth for relationships
          const charts = await req.payload.find({
            collection: 'charts',
            where: query,
            depth: 2,
            limit: 1000,
            sort: 'timestamp',
          })

          if (!charts.docs || charts.docs.length === 0) {
            return Response.json(
              { error: 'No charts found matching the criteria' },
              { status: 404 },
            )
          }

          // Import the PDF generation utility
          const { generateChartsPDF } = await import('@/utilities/pdfExportToHtml')

          // Type for charts with populated relationships
          interface ChartWithRelations {
            id: string | number
            timestamp: string
            timeframe: string
            ticker: {
              id: string | number
              symbol: string
              name?: string
              sector?: string
            }
            tags?: Array<{ id: string | number; name: string }>
            notes?: {
              setupEntry?: string
              trend?: string
              fundamentals?: string
              other?: string
            }
            image: { url: string; filename: string }
            annotatedImage?: { url: string; filename: string }
          }

          // Generate PDF (returns Buffer directly with Puppeteer)
          const pdfBuffer = await generateChartsPDF(
            charts.docs as ChartWithRelations[],
            req.payload,
          )

          const filename = `charts-export-${new Date().toISOString().split('T')[0]}.pdf`

          return new Response(pdfBuffer, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${filename}"`,
              'Content-Length': pdfBuffer.length.toString(),
            },
          })
        } catch (error) {
          console.error('Export error:', error)
          return Response.json(
            { error: 'Failed to export charts' },
            { status: 500, headers: corsHeaders },
          )
        }
      },
    },
  ],
}
