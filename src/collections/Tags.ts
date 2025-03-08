import { CollectionConfig } from 'payload';

export const Tags: CollectionConfig = {
  slug: 'tags',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'color', 'chartsCount'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'color',
      type: 'select',
      options: [
        { label: 'Red', value: '#FF5252' },
        { label: 'Green', value: '#4CAF50' },
        { label: 'Blue', value: '#2196F3' },
        { label: 'Yellow', value: '#FFEB3B' },
        { label: 'Purple', value: '#9C27B0' },
        { label: 'Orange', value: '#FF9800' },
        { label: 'Teal', value: '#009688' },
        { label: 'Pink', value: '#E91E63' },
        { label: 'Gray', value: '#9E9E9E' },
      ],
      defaultValue: '#9E9E9E',
      required: true,
    },
    {
      name: 'chartsCount',
      type: 'number',
      admin: {
        position: 'sidebar',
        description: 'Number of charts using this tag',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ siblingData }) => {
            // This field is updated by a separate hook after chart creation/deletion
            // We're preserving it during direct tag edits
            return siblingData.chartsCount || 0;
          }
        ],
      },
    },
  ],
  hooks: {
    afterRead: [
      async ({ doc, req }) => {
        // You can add additional logic here if needed
        return doc;
      },
    ],
  },
};