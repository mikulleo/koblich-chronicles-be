import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: authenticated,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'User',
          value: 'user',
        },
      ],
      defaultValue: ['user'],
      required: true,
    },
    {
      name: 'preferences',
      type: 'group',
      fields: [
        {
          name: 'defaultTimeframe',
          label: 'Default Stats Timeframe',
          type: 'select',
          options: [
            { label: 'All Time', value: 'all' },
            { label: 'This Year', value: 'year' },
            { label: 'This Month', value: 'month' },
            { label: 'This Week', value: 'week' },
            { label: 'Last 30 Days', value: 'last30' },
          ],
          defaultValue: 'month',
        },
        {
          name: 'defaultChartView',
          label: 'Default Chart View',
          type: 'select',
          options: [
            { label: 'Grid', value: 'grid' },
            { label: 'List', value: 'list' },
            { label: 'Timeline', value: 'timeline' },
          ],
          defaultValue: 'grid',
        },
        {
          name: 'targetPositionSize',
          label: 'Target Position Size ($)',
          type: 'number',
          defaultValue: 25000,
          admin: {
            description: 'Your standard position size in dollars (100% allocation)',
            step: 1000,
          },
        }
      ],
    },
  ],
  timestamps: true,
}
