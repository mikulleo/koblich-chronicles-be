import { CollectionConfig, PayloadRequest, Where } from 'payload'
import { authenticated } from '../access/authenticated'
import { userOwned } from '../access/userOwned'
import { setUserOwner } from '../hooks/setUserOwner'
import { calculateCheckInAnalysis } from '../hooks/calculateCheckInAnalysis'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCollection = any

export const MentalCheckIns: CollectionConfig = {
  slug: 'mental-check-ins',
  admin: {
    useAsTitle: 'date',
    group: 'Mental Edge',
    defaultColumns: ['date', 'preMarket.completedAt', 'postMarket.completedAt', 'user'],
  },
  access: {
    create: authenticated,
    read: userOwned,
    update: userOwned,
    delete: userOwned,
  },
  hooks: {
    beforeChange: [setUserOwner, calculateCheckInAnalysis],
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
    // ===== PRE-MARKET CHECK-IN =====
    {
      name: 'preMarket',
      type: 'group',
      admin: {
        description: 'Pre-market mental state assessment',
      },
      fields: [
        {
          name: 'completedAt',
          type: 'date',
          admin: {
            description: 'When the pre-market check-in was completed',
          },
        },
        {
          name: 'ratings',
          type: 'group',
          fields: [
            {
              name: 'focus',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How focused do you feel? (1-5)' },
            },
            {
              name: 'patience',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How patient do you feel? (1-5)' },
            },
            {
              name: 'confidence',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How confident do you feel? (1-5)' },
            },
            {
              name: 'calmness',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How calm do you feel? (1-5)' },
            },
            {
              name: 'urgencyToMakeMoney',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How strong is your urgency to make money? (1=none, 5=intense)' },
            },
            {
              name: 'fomoLevel',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How much FOMO are you feeling? (1=none, 5=intense)' },
            },
          ],
        },
        {
          name: 'contextFlags',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Recent Loss', value: 'recent_loss' },
            { label: 'Recent Win', value: 'recent_win' },
            { label: 'Winning Streak', value: 'winning_streak' },
            { label: 'Losing Streak', value: 'losing_streak' },
            { label: 'Slept Poorly', value: 'slept_poorly' },
            { label: 'Personal Stress', value: 'personal_stress' },
            { label: 'Market Volatile', value: 'market_volatile' },
            { label: 'Account at High', value: 'account_at_high' },
            { label: 'Account at Low', value: 'account_at_low' },
            { label: 'Big News Day', value: 'big_news_day' },
            { label: 'End of Week', value: 'end_of_week' },
            { label: 'End of Month', value: 'end_of_month' },
          ],
          admin: {
            description: 'Current context that may affect your trading',
          },
        },
        {
          name: 'intentions',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Avoid Forcing Trades', value: 'avoid_forcing' },
            { label: 'Stay Patient', value: 'stay_patient' },
            { label: 'Stick to Plan', value: 'stick_to_plan' },
            { label: 'Manage Risk', value: 'manage_risk' },
            { label: 'Avoid FOMO', value: 'avoid_fomo' },
            { label: 'Stay Calm', value: 'stay_calm' },
            { label: 'Be Selective', value: 'be_selective' },
            { label: 'Protect Gains', value: 'protect_gains' },
          ],
          admin: {
            description: 'What you intend to focus on today',
          },
        },
        {
          name: 'biggestRisk',
          type: 'select',
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
            description: 'What is your biggest risk today?',
          },
        },
      ],
    },
    // ===== POST-MARKET REVIEW =====
    {
      name: 'postMarket',
      type: 'group',
      admin: {
        description: 'Post-market performance review',
      },
      fields: [
        {
          name: 'completedAt',
          type: 'date',
          admin: {
            description: 'When the post-market review was completed',
          },
        },
        {
          name: 'ratings',
          type: 'group',
          fields: [
            {
              name: 'planAdherence',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How well did you stick to your plan? (1-5)' },
            },
            {
              name: 'emotionalStability',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How emotionally stable were you? (1-5)' },
            },
            {
              name: 'selectivity',
              type: 'number',
              min: 1,
              max: 5,
              admin: { description: 'How selective were you with entries? (1-5)' },
            },
          ],
        },
        {
          name: 'behaviors',
          type: 'group',
          fields: [
            {
              name: 'forcedTrades',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Did you force any trades today?' },
            },
            {
              name: 'feltFomo',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Did you experience FOMO?' },
            },
            {
              name: 'reactiveAfterLoss',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Did you react emotionally after a loss?' },
            },
            {
              name: 'carelessAfterWin',
              type: 'checkbox',
              defaultValue: false,
              admin: { description: 'Did you become careless after a win?' },
            },
          ],
        },
        {
          name: 'reflections',
          type: 'group',
          fields: [
            {
              name: 'whatWentWell',
              type: 'textarea',
              admin: { description: 'What went well today?' },
            },
            {
              name: 'whatWentPoorly',
              type: 'textarea',
              admin: { description: 'What went poorly today?' },
            },
            {
              name: 'lessonsLearned',
              type: 'textarea',
              admin: { description: 'Key lessons from today' },
            },
            {
              name: 'tomorrowFocus',
              type: 'textarea',
              admin: { description: 'What to focus on tomorrow' },
            },
            {
              name: 'emotionalHighlight',
              type: 'textarea',
              admin: { description: 'Most significant emotional moment and how you handled it' },
            },
          ],
        },
        {
          name: 'actualTraps',
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
            description: 'What emotional traps did you actually fall into today?',
          },
        },
      ],
    },
    // ===== ANALYSIS (computed) =====
    {
      name: 'analysis',
      type: 'group',
      admin: {
        readOnly: true,
        description: 'Auto-calculated analysis (populated when both pre and post market are complete)',
      },
      fields: [
        {
          name: 'stateConsistency',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Difference between pre-market state and post-market performance (lower = more consistent)',
          },
        },
        {
          name: 'intentionAdherence',
          type: 'number',
          admin: {
            readOnly: true,
            description: 'Percentage of stated intentions that were followed',
          },
        },
        {
          name: 'riskPredictionAccuracy',
          type: 'checkbox',
          admin: {
            readOnly: true,
            description: 'Whether the predicted biggest risk actually occurred',
          },
        },
        {
          name: 'emotionalDrift',
          type: 'json',
          admin: {
            readOnly: true,
            description: 'Detected emotional drift patterns',
          },
        },
      ],
    },
  ],
  endpoints: [
    {
      path: '/weekly-summary',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url || '', 'http://localhost')
        const weekStart = url.searchParams.get('weekStart')

        if (!weekStart) {
          return Response.json({ error: 'weekStart parameter required' }, { status: 400 })
        }

        // Calculate week end (7 days from start)
        const startDate = new Date(weekStart)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 6)

        const checkIns = await req.payload.find({
          collection: 'mental-check-ins' as AnyCollection,
          where: {
            user: { equals: req.user.id },
            date: {
              greater_than_equal: startDate.toISOString(),
              less_than_equal: endDate.toISOString(),
            },
          },
          sort: 'date',
          limit: 7,
          depth: 0,
        })

        // Aggregate weekly data
        const docs = checkIns.docs as AnyCollection[]

        const trapCounts: Record<string, number> = {}
        const behaviorCounts: Record<string, number> = {}
        const driftPatterns: Record<string, number> = {}
        let totalIntentionAdherence = 0
        let intentionCount = 0
        let totalStateConsistency = 0
        let consistencyCount = 0
        let riskPredictions = 0
        let riskCorrect = 0

        for (const doc of docs) {
          // Count traps
          const traps = doc.postMarket?.actualTraps || []
          for (const trap of traps) {
            trapCounts[trap] = (trapCounts[trap] || 0) + 1
          }

          // Count behaviors
          const behaviors = doc.postMarket?.behaviors || {}
          for (const [key, value] of Object.entries(behaviors)) {
            if (value === true) {
              behaviorCounts[key] = (behaviorCounts[key] || 0) + 1
            }
          }

          // Aggregate analysis
          if (doc.analysis?.intentionAdherence !== undefined && doc.analysis.intentionAdherence !== null) {
            totalIntentionAdherence += doc.analysis.intentionAdherence
            intentionCount++
          }
          if (doc.analysis?.stateConsistency !== undefined && doc.analysis.stateConsistency !== null) {
            totalStateConsistency += doc.analysis.stateConsistency
            consistencyCount++
          }
          if (doc.analysis?.riskPredictionAccuracy !== undefined) {
            riskPredictions++
            if (doc.analysis.riskPredictionAccuracy) riskCorrect++
          }

          // Count drift patterns
          const drifts = doc.analysis?.emotionalDrift || []
          for (const drift of drifts) {
            driftPatterns[drift] = (driftPatterns[drift] || 0) + 1
          }
        }

        return Response.json({
          weekStart,
          weekEnd: endDate.toISOString().split('T')[0],
          daysLogged: checkIns.totalDocs,
          trapCounts,
          behaviorCounts,
          driftPatterns,
          averageIntentionAdherence: intentionCount > 0 ? Math.round(totalIntentionAdherence / intentionCount) : null,
          averageStateConsistency: consistencyCount > 0 ? Math.round(totalStateConsistency / consistencyCount * 100) / 100 : null,
          riskPredictionRate: riskPredictions > 0 ? Math.round((riskCorrect / riskPredictions) * 100) : null,
          dailyData: docs.map((doc) => ({
            date: doc.date,
            preMarketRatings: doc.preMarket?.ratings,
            postMarketRatings: doc.postMarket?.ratings,
            traps: doc.postMarket?.actualTraps || [],
            analysis: doc.analysis,
          })),
        })
      },
    },
    {
      path: '/trends',
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

        const checkIns = await req.payload.find({
          collection: 'mental-check-ins' as AnyCollection,
          where,
          sort: 'date',
          limit: 365,
          depth: 0,
        })

        const docs = checkIns.docs as AnyCollection[]

        // Build time-series data
        const trends = docs.map((doc) => ({
          date: doc.date,
          preMarket: doc.preMarket?.ratings || {},
          postMarket: doc.postMarket?.ratings || {},
          stateConsistency: doc.analysis?.stateConsistency,
          intentionAdherence: doc.analysis?.intentionAdherence,
          traps: doc.postMarket?.actualTraps || [],
          contextFlags: doc.preMarket?.contextFlags || [],
          driftPatterns: doc.analysis?.emotionalDrift || [],
        }))

        return Response.json({
          totalDays: checkIns.totalDocs,
          trends,
        })
      },
    },
  ],
}
