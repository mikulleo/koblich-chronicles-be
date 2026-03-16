import { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { userOwned } from '../access/userOwned'
import { setUserOwner } from '../hooks/setUserOwner'

export const DisciplineRules: CollectionConfig = {
  slug: 'discipline-rules',
  admin: {
    useAsTitle: 'title',
    group: 'Mental Edge',
    defaultColumns: ['title', 'category', 'isActive', 'user'],
  },
  access: {
    create: authenticated,
    read: userOwned,
    update: userOwned,
    delete: userOwned,
  },
  hooks: {
    beforeChange: [setUserOwner],
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of your trading rule',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Detailed description of the rule and why it matters',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Risk Management', value: 'risk_management' },
        { label: 'Entry Rules', value: 'entry_rules' },
        { label: 'Exit Rules', value: 'exit_rules' },
        { label: 'Position Sizing', value: 'position_sizing' },
        { label: 'Emotional', value: 'emotional' },
        { label: 'Routine', value: 'routine' },
      ],
      admin: {
        description: 'Category of trading rule',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this rule is currently active',
        position: 'sidebar',
      },
    },
  ],
}
