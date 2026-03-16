import { CollectionConfig, PayloadRequest, Where } from 'payload'
import { authenticated } from '../access/authenticated'
import { userOwned } from '../access/userOwned'
import { setUserOwner } from '../hooks/setUserOwner'
import { calculateDisciplineSummary } from '../hooks/calculateDisciplineSummary'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCollection = any

export const DisciplineLog: CollectionConfig = {
  slug: 'discipline-log',
  admin: {
    useAsTitle: 'date',
    group: 'Mental Edge',
    defaultColumns: ['date', 'summary.complianceRate', 'summary.violated', 'user'],
  },
  access: {
    create: authenticated,
    read: userOwned,
    update: userOwned,
    delete: userOwned,
  },
  hooks: {
    beforeChange: [setUserOwner, calculateDisciplineSummary],
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
      name: 'entries',
      type: 'array',
      admin: {
        description: 'Daily rule compliance entries',
      },
      fields: [
        {
          name: 'rule',
          type: 'relationship',
          relationTo: 'discipline-rules' as AnyCollection,
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          options: [
            { label: 'Respected', value: 'respected' },
            { label: 'Violated', value: 'violated' },
          ],
          defaultValue: 'respected',
        },
        {
          name: 'notes',
          type: 'textarea',
          admin: {
            description: 'Notes about this rule today',
          },
        },
        {
          name: 'mentalStateAtViolation',
          type: 'select',
          options: [
            { label: 'Frustrated', value: 'frustrated' },
            { label: 'Overconfident', value: 'overconfident' },
            { label: 'Fearful', value: 'fearful' },
            { label: 'Impatient', value: 'impatient' },
            { label: 'Revenge Trading', value: 'revenge_trading' },
            { label: 'FOMO', value: 'fomo' },
            { label: 'Bored', value: 'bored' },
            { label: 'Tired', value: 'tired' },
          ],
          admin: {
            description: 'Mental state when rule was violated',
            condition: (_, siblingData) => siblingData?.status === 'violated',
          },
        },
      ],
    },
    {
      name: 'summary',
      type: 'group',
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Auto-calculated compliance summary',
      },
      fields: [
        {
          name: 'totalRules',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'respected',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'violated',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'complianceRate',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Percentage of rules respected',
          },
        },
      ],
    },
  ],
  endpoints: [
    {
      path: '/streaks',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const logs = await req.payload.find({
          collection: 'discipline-log' as AnyCollection,
          where: {
            user: { equals: req.user.id },
          },
          sort: '-date',
          limit: 365,
          depth: 0,
        })

        // Calculate current streak of 100% compliance
        let currentStreak = 0
        let bestStreak = 0
        let tempStreak = 0

        for (const log of logs.docs as AnyCollection[]) {
          const complianceRate = log.summary?.complianceRate
          if (complianceRate === 100) {
            tempStreak++
            if (tempStreak > bestStreak) bestStreak = tempStreak
          } else {
            if (currentStreak === 0) currentStreak = tempStreak
            tempStreak = 0
          }
        }
        if (currentStreak === 0) currentStreak = tempStreak
        if (tempStreak > bestStreak) bestStreak = tempStreak

        // Calculate average compliance
        const totalCompliance = (logs.docs as AnyCollection[]).reduce((sum: number, log: AnyCollection) => {
          return sum + (log.summary?.complianceRate || 0)
        }, 0)
        const averageCompliance = logs.totalDocs > 0 ? Math.round(totalCompliance / logs.totalDocs) : 0

        return Response.json({
          currentStreak,
          bestStreak,
          totalDays: logs.totalDocs,
          averageCompliance,
        })
      },
    },
    {
      path: '/analytics',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url || '', 'http://localhost')
        const startDate = url.searchParams.get('startDate')
        const endDate = url.searchParams.get('endDate')

        const where: Where = {
          user: { equals: req.user.id },
        }
        if (startDate) {
          where['date'] = { ...(where['date'] as object || {}), greater_than_equal: startDate }
        }
        if (endDate) {
          where['date'] = { ...(where['date'] as object || {}), less_than_equal: endDate }
        }

        const logs = await req.payload.find({
          collection: 'discipline-log' as AnyCollection,
          where,
          sort: '-date',
          limit: 365,
          depth: 1,
        })

        // Aggregate violations by mental state
        const violationsByMentalState: Record<string, number> = {}
        const violationsByRule: Record<string, { title: string; count: number }> = {}

        for (const log of logs.docs as AnyCollection[]) {
          const entries = (log.entries || []) as Array<{
            rule: string | { id: string; title?: string }
            status: string
            mentalStateAtViolation?: string
          }>

          for (const entry of entries) {
            if (entry.status === 'violated') {
              if (entry.mentalStateAtViolation) {
                violationsByMentalState[entry.mentalStateAtViolation] =
                  (violationsByMentalState[entry.mentalStateAtViolation] || 0) + 1
              }
              const ruleId = typeof entry.rule === 'object' ? entry.rule.id : entry.rule
              const ruleTitle = typeof entry.rule === 'object' ? entry.rule.title || ruleId : ruleId
              if (!violationsByRule[ruleId]) {
                violationsByRule[ruleId] = { title: ruleTitle as string, count: 0 }
              }
              violationsByRule[ruleId].count++
            }
          }
        }

        return Response.json({
          totalDays: logs.totalDocs,
          violationsByMentalState,
          violationsByRule: Object.values(violationsByRule).sort((a, b) => b.count - a.count),
          dailyCompliance: (logs.docs as AnyCollection[]).map((log: AnyCollection) => ({
            date: log.date,
            complianceRate: log.summary?.complianceRate || 0,
          })),
        })
      },
    },
  ],
}
