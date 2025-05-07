import { CollectionConfig } from 'payload'

export const Donations: CollectionConfig = {
  slug: 'donations',
  admin: {
    useAsTitle: 'transactionId',
    defaultColumns: ['amount', 'currency', 'status', 'donor', 'createdAt'],
    group: 'Finances',
  },
  access: {
    create: () => true, // Anyone can create a donation
    read: () => true, // Public read access
    //update: ({ req }) => req.user?.roles?.includes('admin'), // Only admins can update
    //delete: ({ req }) => req.user?.roles?.includes('admin'), // Only admins can delete
  },
  fields: [
    {
      name: 'amount',
      type: 'number',
      required: true,
      min: 1,
      admin: {
        description: 'Donation amount',
      },
    },
    {
      name: 'currency',
      type: 'select',
      required: true,
      options: [
        { label: 'CZK', value: 'CZK' },
        { label: 'EUR', value: 'EUR' },
        { label: 'USD', value: 'USD' },
      ],
      defaultValue: 'CZK',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Initiated', value: 'initiated' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Canceled', value: 'canceled' },
        { label: 'Refunded', value: 'refunded' },
      ],
      defaultValue: 'initiated',
    },
    {
      name: 'transactionId',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'paymentId',
      type: 'text',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'donor',
      type: 'group',
      fields: [
        {
          name: 'name',
          type: 'text',
        },
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'message',
          type: 'textarea',
        },
      ],
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        readOnly: true,
        description: 'Additional payment data',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        // If new donation, generate UUID as transactionId
        if (operation === 'create' && !data.transactionId) {
          import('uuid').then((uuid) => {
            data.transactionId = uuid.v4()
          })
        }
        return data
      },
    ],
  },
}
