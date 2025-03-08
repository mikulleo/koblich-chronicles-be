import { CollectionConfig, PayloadRequest } from 'payload';

export const Tickers: CollectionConfig = {
  slug: 'tickers',
  admin: {
    useAsTitle: 'symbol',
    defaultColumns: ['symbol', 'name', 'chartsCount', 'sector'],
    group: 'Stock Data',
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
            return siblingData.chartsCount || 0;
          }
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
            return siblingData.tradesCount || 0;
          }
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
            return siblingData.profitLoss || 0;
          }
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
            return Response.json({ error: 'ID is required' }, { status: 400 });
          }
          
          const charts = await req.payload.find({
            collection: 'charts',
            where: {
              ticker: {
                equals: id,
              },
            },
            sort: '-timestamp',
          });

          return Response.json(charts);
        } catch (error) {
          console.error('Error fetching charts:', error);
          return Response.json({ error: 'Failed to fetch charts' }, { status: 500 });
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
            return Response.json({ error: 'ID is required' }, { status: 400 });
          }
          
          const trades = await req.payload.find({
            collection: 'trades',
            where: {
              ticker: {
                equals: id,
              },
            },
            sort: '-entryDate',
          });

          return Response.json(trades);
        } catch (error) {
          console.error('Error fetching trades:', error);
          return Response.json({ error: 'Failed to fetch trades' }, { status: 500 });
        }
      },
    },
  ],
};