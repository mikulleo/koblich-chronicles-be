// src/collections/Charts.ts
import { CollectionConfig, PayloadRequest } from 'payload';
import { updateTickerStatsHook } from '../hooks/updateTickerStats';
import { updateTickerTagsHook } from '../hooks/updateTickerTags';

export const Charts: CollectionConfig = {
  slug: 'charts',
  admin: {
    defaultColumns: ['image', 'ticker', 'timestamp', 'tags'],
    useAsTitle: 'id',
    group: 'Stock Data',
    listSearchableFields: ['ticker.symbol', 'notes'],
  },
  access: {
    read: () => true,
  },
  fields: [
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
          pickerAppearance: 'dayAndTime',
        },
      },
      defaultValue: () => new Date(),
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
                  const startPrice = parseFloat(siblingData.startPrice);
                  const endPrice = parseFloat(siblingData.endPrice);
                  
                  if (startPrice && endPrice) {
                    return ((endPrice - startPrice) / startPrice) * 100;
                  }
                }
                return null;
              }
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
            return value || null;
          }
        ],
      },
    },
  ],
  hooks: {
    /*
    afterChange: [
      // Execute hooks sequentially with proper error handling
      async (args) => {
        // First, update the ticker stats
        const docAfterStats = await updateTickerStatsHook(args);
        
        // Then update ticker tags - but only if updateTickerTagsHook function exists
        // This is to handle the case where the function was commented out in the original code
        if (typeof updateTickerTagsHook === 'function') {
          return await updateTickerTagsHook({ ...args, doc: docAfterStats });
        }
        
        return docAfterStats;
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
            });
            
            await req.payload.update({
              collection: 'charts',
              id: doc.id,
              data: {
                keyboardNavId: count.totalDocs,
              },
              depth: 0,
            });
          } catch (err) {
            console.error('Error updating keyboardNavId:', err);
          }
        }
        return doc;
      },
    ],*/
  },
  endpoints: [
    {
      path: '/next/:id',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const id = req.routeParams?.id;
          const filter = req.query?.filter;

          if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
            return Response.json({ message: 'Invalid Chart ID' }, { status: 400 });
          }

          // Get the current chart to find its keyboardNavId
          const currentChart = await req.payload.findByID({
            collection: 'charts',
            id,
            depth: 0, // No need to load relationships
          });

          if (!currentChart) {
            return Response.json({ message: 'Chart not found' }, { status: 404 });
          }

          // Find the next chart based on keyboardNavId
          const query = {
            keyboardNavId: {
              greater_than: currentChart.keyboardNavId,
            },
          };

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
          });

          if (nextCharts.docs.length > 0) {
            return Response.json(nextCharts.docs[0]);
          } else {
            // Wrap around to the first chart
            const firstCharts = await req.payload.find({
              collection: 'charts',
              sort: 'keyboardNavId',
              limit: 1,
              depth: 1, // Load first-level relationships
            });

            if (firstCharts.docs.length > 0) {
              return Response.json(firstCharts.docs[0]);
            } else {
              return Response.json({ message: 'No charts available' }, { status: 404 });
            }
          }
        } catch (error) {
          console.error('Error fetching next chart:', error);
          return Response.json({ message: 'Error fetching next chart' }, { status: 500 });
        }
      },
    },
    {
      path: '/previous/:id',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const id = req.routeParams?.id;
          const filter = req.query?.filter;

          if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
            return Response.json({ message: 'Invalid Chart ID' }, { status: 400 });
          }

          // Get the current chart to find its keyboardNavId
          const currentChart = await req.payload.findByID({
            collection: 'charts',
            id,
            depth: 0, // No need to load relationships
          });

          if (!currentChart) {
            return Response.json({ message: 'Chart not found' }, { status: 404 });
          }

          // Find the previous chart based on keyboardNavId
          const query = {
            keyboardNavId: {
              less_than: currentChart.keyboardNavId,
            },
          };

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
          });

          if (prevCharts.docs.length > 0) {
            return Response.json(prevCharts.docs[0]);
          } else {
            // Wrap around to the last chart
            const lastCharts = await req.payload.find({
              collection: 'charts',
              sort: '-keyboardNavId',
              limit: 1,
              depth: 1, // Load first-level relationships
            });

            if (lastCharts.docs.length > 0) {
              return Response.json(lastCharts.docs[0]);
            } else {
              return Response.json({ message: 'No charts available' }, { status: 404 });
            }
          }
        } catch (error) {
          console.error('Error fetching previous chart:', error);
          return Response.json({ message: 'Error fetching previous chart' }, { status: 500 });
        }
      },
    },
    // New endpoint for filtering charts by tag
    {
      path: '/by-tag/:tagId',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const tagId = req.routeParams?.tagId;
          const page = parseInt(req.query?.page as string || '1', 10);
          const limit = parseInt(req.query?.limit as string || '20', 10);

          if (!tagId) {
            return Response.json({ message: 'Tag ID is required' }, { status: 400 });
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
          });

          return Response.json(charts);
        } catch (error) {
          console.error('Error fetching charts by tag:', error);
          return Response.json({ message: 'Error fetching charts by tag' }, { status: 500 });
        }
      },
    },
  ],
};