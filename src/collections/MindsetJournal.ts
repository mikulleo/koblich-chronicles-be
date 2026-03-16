import { CollectionConfig } from 'payload'
import { authenticated } from '../access/authenticated'
import { userOwned } from '../access/userOwned'
import { setUserOwner } from '../hooks/setUserOwner'
import { populateJournalPrompts } from '../hooks/populateJournalPrompts'

export const MindsetJournal: CollectionConfig = {
  slug: 'mindset-journal',
  admin: {
    useAsTitle: 'title',
    group: 'Mental Edge',
    defaultColumns: ['title', 'entryType', 'date', 'user'],
  },
  access: {
    create: authenticated,
    read: userOwned,
    update: userOwned,
    delete: userOwned,
  },
  hooks: {
    beforeChange: [setUserOwner, populateJournalPrompts],
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
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
      defaultValue: () => new Date().toISOString(),
    },
    {
      name: 'entryType',
      type: 'select',
      required: true,
      options: [
        { label: 'Pre-Market Note', value: 'pre_market_note' },
        { label: 'Post-Market Reflection', value: 'post_market_reflection' },
        { label: 'Mistake Review', value: 'mistake_review' },
        { label: 'Trigger Review', value: 'trigger_review' },
        { label: 'Weekly Review', value: 'weekly_review' },
        { label: 'Rule Violation Review', value: 'rule_violation_review' },
      ],
      admin: {
        description: 'Type of journal entry',
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Title for this journal entry',
      },
    },
    {
      name: 'guidedPrompts',
      type: 'array',
      admin: {
        description: 'Guided prompts auto-filled based on entry type',
      },
      fields: [
        {
          name: 'prompt',
          type: 'text',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'response',
          type: 'textarea',
          admin: {
            description: 'Your response to this prompt',
          },
        },
      ],
    },
    {
      name: 'freeContent',
      type: 'textarea',
      admin: {
        description: 'Free-form journaling content',
      },
    },
    {
      name: 'linkedTraps',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Overtrading', value: 'overtrading' },
        { label: 'FOMO Entries', value: 'fomo_entries' },
        { label: 'Revenge Trading', value: 'revenge_trading' },
        { label: 'Moving Stops', value: 'moving_stops' },
        { label: 'Oversizing', value: 'oversizing' },
        { label: 'Not Taking Setups', value: 'not_taking_setups' },
        { label: 'Chasing', value: 'chasing' },
        { label: 'Impatience', value: 'impatience' },
      ],
      admin: {
        description: 'Emotional traps related to this entry',
        position: 'sidebar',
      },
    },
    {
      name: 'linkedDate',
      type: 'date',
      admin: {
        description: 'Date this entry refers to (if different from entry date)',
        date: {
          pickerAppearance: 'dayOnly',
        },
        position: 'sidebar',
      },
    },
  ],
}
