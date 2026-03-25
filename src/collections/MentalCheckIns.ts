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
      path: '/insights',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const checkIns = await req.payload.find({
          collection: 'mental-check-ins' as AnyCollection,
          where: { user: { equals: req.user.id } },
          sort: '-date',
          limit: 365,
          depth: 0,
        })

        const docs = checkIns.docs as AnyCollection[]
        if (docs.length < 2) {
          return Response.json({ error: 'Need at least 2 check-ins for insights' }, { status: 400 })
        }

        const completeDocs = docs.filter(
          (d) => d.preMarket?.completedAt && d.postMarket?.completedAt,
        )

        // ===== TODAY'S INSIGHTS =====
        const today = docs[0]
        const todayInsights: { strengths: string[]; issues: string[] } = { strengths: [], issues: [] }

        if (today?.preMarket?.completedAt && today?.postMarket?.completedAt) {
          const pre = today.preMarket
          const post = today.postMarket
          const analysis = today.analysis || {}
          const ratings = post.ratings || {}
          const behaviors = post.behaviors || {}
          const preRatings = pre.ratings || {}

          // Strengths
          if (ratings.planAdherence >= 4) todayInsights.strengths.push('You stuck to your trading plan well today')
          if (ratings.emotionalStability >= 4) todayInsights.strengths.push('You maintained strong emotional stability')
          if (ratings.selectivity >= 4) todayInsights.strengths.push('You were selective with your entries')
          if (!behaviors.forcedTrades && !behaviors.feltFomo && !behaviors.reactiveAfterLoss && !behaviors.carelessAfterWin) {
            todayInsights.strengths.push('You avoided all negative behavioral traps today')
          }
          if (analysis.intentionAdherence === 100) todayInsights.strengths.push('Perfect intention adherence — you followed through on every intention you set')
          else if (analysis.intentionAdherence >= 75) todayInsights.strengths.push(`You followed through on ${analysis.intentionAdherence}% of your stated intentions`)
          if (analysis.riskPredictionAccuracy === true) todayInsights.strengths.push('Your risk prediction was accurate — good self-awareness')
          if (analysis.stateConsistency !== undefined && analysis.stateConsistency !== null) {
            const absDrift = Math.abs(analysis.stateConsistency)
            if (absDrift < 0.5) todayInsights.strengths.push('Your mental state was very consistent from pre-market to post-market')
            else if (analysis.stateConsistency > 0.5) todayInsights.strengths.push('Your execution improved over your pre-market state — you performed better than you started')
            else if (analysis.stateConsistency < -1.0) todayInsights.issues.push('Your execution declined significantly from your pre-market state — something pulled you off track')
          }

          // Issues
          if (behaviors.forcedTrades) todayInsights.issues.push('You forced trades today — this often leads to unnecessary losses')
          if (behaviors.feltFomo) todayInsights.issues.push('FOMO influenced your decisions today')
          if (behaviors.reactiveAfterLoss) todayInsights.issues.push('You reacted emotionally after a loss — a pattern worth addressing')
          if (behaviors.carelessAfterWin) todayInsights.issues.push('You became careless after winning — overconfidence may have crept in')
          if (ratings.planAdherence <= 2) todayInsights.issues.push('Plan adherence was low today — what pulled you off your plan?')
          if (ratings.emotionalStability <= 2) todayInsights.issues.push('Emotional stability was a challenge today')
          if (analysis.intentionAdherence !== null && analysis.intentionAdherence !== undefined && analysis.intentionAdherence < 50) {
            todayInsights.issues.push(`You only followed through on ${analysis.intentionAdherence}% of your intentions — consider setting fewer, more focused intentions`)
          }
          if ((preRatings.urgencyToMakeMoney || 0) >= 4) todayInsights.issues.push('You started the day with high urgency to make money — this often leads to overtrading')
          if ((preRatings.fomoLevel || 0) >= 4) todayInsights.issues.push('High FOMO level pre-market set a risky tone for the day')

          const traps = post.actualTraps || []
          if (traps.length > 0) {
            const trapLabels: Record<string, string> = {
              overtrading: 'overtrading', fomo_entries: 'FOMO entries', revenge_trading: 'revenge trading',
              moving_stops: 'moving stops', oversizing: 'oversizing', not_taking_setups: 'not taking setups',
              chasing: 'chasing', impatience: 'impatience',
            }
            const trapNames = traps.map((t: string) => trapLabels[t] || t)
            todayInsights.issues.push(`You fell into these traps today: ${trapNames.join(', ')}`)
          }
        }

        // ===== RECURRING PATTERNS =====
        // Trap frequency
        const trapCounts: Record<string, number> = {}
        const driftCounts: Record<string, number> = {}
        const behaviorCounts: Record<string, number> = {}
        const totalCompleteDays = completeDocs.length

        for (const doc of completeDocs) {
          for (const trap of doc.postMarket?.actualTraps || []) {
            trapCounts[trap] = (trapCounts[trap] || 0) + 1
          }
          for (const drift of doc.analysis?.emotionalDrift || []) {
            driftCounts[drift] = (driftCounts[drift] || 0) + 1
          }
          const behaviors = doc.postMarket?.behaviors || {}
          if (behaviors.forcedTrades) behaviorCounts['forcedTrades'] = (behaviorCounts['forcedTrades'] || 0) + 1
          if (behaviors.feltFomo) behaviorCounts['feltFomo'] = (behaviorCounts['feltFomo'] || 0) + 1
          if (behaviors.reactiveAfterLoss) behaviorCounts['reactiveAfterLoss'] = (behaviorCounts['reactiveAfterLoss'] || 0) + 1
          if (behaviors.carelessAfterWin) behaviorCounts['carelessAfterWin'] = (behaviorCounts['carelessAfterWin'] || 0) + 1
        }

        const trapLabels: Record<string, string> = {
          overtrading: 'overtrading', fomo_entries: 'FOMO entries', revenge_trading: 'revenge trading',
          moving_stops: 'moving stops', oversizing: 'oversizing', not_taking_setups: 'not taking setups',
          chasing: 'chasing', impatience: 'impatience',
        }
        const behaviorLabels: Record<string, string> = {
          forcedTrades: 'forcing trades', feltFomo: 'experiencing FOMO',
          reactiveAfterLoss: 'reacting emotionally after losses', carelessAfterWin: 'becoming careless after wins',
        }

        const recurringIssues: string[] = []
        const strengths: string[] = []

        // Frequent traps (>= 25% of days)
        for (const [trap, count] of Object.entries(trapCounts)) {
          const pct = Math.round((count / totalCompleteDays) * 100)
          if (pct >= 25) {
            recurringIssues.push(`${trapLabels[trap] || trap} is a recurring issue — you've fallen into this trap on ${pct}% of your trading days (${count}/${totalCompleteDays})`)
          }
        }

        // Frequent behaviors
        for (const [behavior, count] of Object.entries(behaviorCounts)) {
          const pct = Math.round((count / totalCompleteDays) * 100)
          if (pct >= 25) {
            recurringIssues.push(`${behaviorLabels[behavior] || behavior} happens frequently — on ${pct}% of your days (${count}/${totalCompleteDays})`)
          } else if (pct <= 10 && totalCompleteDays >= 5) {
            strengths.push(`You rarely struggle with ${behaviorLabels[behavior] || behavior} — only ${pct}% of the time`)
          }
        }

        // Traps that never/rarely occur = strengths
        const allTraps = ['overtrading', 'fomo_entries', 'revenge_trading', 'moving_stops', 'oversizing', 'not_taking_setups', 'chasing', 'impatience']
        for (const trap of allTraps) {
          if ((trapCounts[trap] || 0) === 0 && totalCompleteDays >= 5) {
            strengths.push(`You've never fallen into the ${trapLabels[trap] || trap} trap`)
          }
        }

        // Average adherence strength
        const adherenceValues = completeDocs
          .filter((d) => d.analysis?.intentionAdherence !== undefined && d.analysis?.intentionAdherence !== null)
          .map((d) => d.analysis.intentionAdherence as number)
        if (adherenceValues.length >= 3) {
          const avgAdherence = Math.round(adherenceValues.reduce((a: number, b: number) => a + b, 0) / adherenceValues.length)
          if (avgAdherence >= 80) strengths.push(`Your average intention adherence is strong at ${avgAdherence}%`)
          else if (avgAdherence < 50) recurringIssues.push(`Your average intention adherence is low at ${avgAdherence}% — you may be setting too many intentions or struggling to follow through`)
        }

        // ===== TREND ANALYSIS (recent 7 vs older) =====
        const trendInsights: string[] = []
        if (completeDocs.length >= 10) {
          const recent = completeDocs.slice(0, 7)
          const older = completeDocs.slice(7)

          const avgMetric = (docs: AnyCollection[], key: string) => {
            const vals = docs
              .filter((d) => d.analysis?.[key] !== undefined && d.analysis?.[key] !== null)
              .map((d) => d.analysis[key] as number)
            return vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : null
          }

          const recentAdherence = avgMetric(recent, 'intentionAdherence')
          const olderAdherence = avgMetric(older, 'intentionAdherence')
          if (recentAdherence !== null && olderAdherence !== null) {
            const diff = Math.round(recentAdherence - olderAdherence)
            if (diff >= 10) trendInsights.push(`Your intention adherence has improved by ${diff} percentage points recently — keep it up`)
            else if (diff <= -10) trendInsights.push(`Your intention adherence has dropped by ${Math.abs(diff)} percentage points recently — what changed?`)
          }

          const recentDrift = avgMetric(recent, 'stateConsistency')
          const olderDrift = avgMetric(older, 'stateConsistency')
          if (recentDrift !== null && olderDrift !== null) {
            const diff = Math.round((recentDrift - olderDrift) * 100) / 100
            if (diff >= 0.3) trendInsights.push('Your post-market execution is trending upward relative to your pre-market state — you are finishing sessions stronger recently')
            else if (diff <= -0.3) trendInsights.push('Your post-market execution is trending below your pre-market state recently — something may be dragging you down during sessions')
          }

          // Trap trend
          const recentTrapCount = recent.reduce((sum, d) => sum + (d.postMarket?.actualTraps?.length || 0), 0) / recent.length
          const olderTrapCount = older.reduce((sum, d) => sum + (d.postMarket?.actualTraps?.length || 0), 0) / older.length
          if (recentTrapCount < olderTrapCount * 0.5 && olderTrapCount > 0.3) {
            trendInsights.push('You are falling into significantly fewer emotional traps recently — great progress')
          } else if (recentTrapCount > olderTrapCount * 1.5 && recentTrapCount > 0.3) {
            trendInsights.push('You are falling into more emotional traps recently compared to before — consider what has changed')
          }
        }

        // ===== CONDITIONAL CORRELATIONS =====
        // "When context X → outcome Y"
        const conditionalInsights: Array<{ condition: string; outcome: string; rate: number; occurrences: number; total: number }> = []

        // Context flag → trap/behavior correlations
        const contextCorrelations: Array<{
          flag: string;
          flagLabel: string;
          check: (doc: AnyCollection) => boolean;
          outcomeLabel: string;
        }> = [
          { flag: 'recent_loss', flagLabel: 'you flag a recent loss', check: (d) => d.postMarket?.behaviors?.reactiveAfterLoss === true, outcomeLabel: 'you react emotionally after losses' },
          { flag: 'recent_loss', flagLabel: 'you flag a recent loss', check: (d) => (d.postMarket?.actualTraps || []).includes('revenge_trading'), outcomeLabel: 'you fall into revenge trading' },
          { flag: 'winning_streak', flagLabel: 'you are on a winning streak', check: (d) => d.postMarket?.behaviors?.carelessAfterWin === true, outcomeLabel: 'you become careless' },
          { flag: 'losing_streak', flagLabel: 'you are on a losing streak', check: (d) => d.postMarket?.behaviors?.forcedTrades === true, outcomeLabel: 'you force trades' },
          { flag: 'slept_poorly', flagLabel: 'you slept poorly', check: (d) => (d.postMarket?.ratings?.emotionalStability || 5) <= 2, outcomeLabel: 'your emotional stability drops significantly' },
          { flag: 'slept_poorly', flagLabel: 'you slept poorly', check: (d) => (d.postMarket?.ratings?.planAdherence || 5) <= 2, outcomeLabel: 'your plan adherence drops significantly' },
          { flag: 'personal_stress', flagLabel: 'you have personal stress', check: (d) => (d.postMarket?.actualTraps || []).length > 0, outcomeLabel: 'you fall into emotional traps' },
          { flag: 'market_volatile', flagLabel: 'the market is volatile', check: (d) => d.postMarket?.behaviors?.feltFomo === true, outcomeLabel: 'you experience FOMO' },
          { flag: 'big_news_day', flagLabel: "it's a big news day", check: (d) => d.postMarket?.behaviors?.forcedTrades === true, outcomeLabel: 'you force trades' },
        ]

        for (const corr of contextCorrelations) {
          const flagDays = completeDocs.filter((d) => (d.preMarket?.contextFlags || []).includes(corr.flag))
          if (flagDays.length >= 3) {
            const outcomeCount = flagDays.filter(corr.check).length
            const rate = Math.round((outcomeCount / flagDays.length) * 100)
            if (rate >= 40) {
              conditionalInsights.push({
                condition: `When ${corr.flagLabel}`,
                outcome: corr.outcomeLabel,
                rate,
                occurrences: outcomeCount,
                total: flagDays.length,
              })
            }
          }
        }

        // Pre-market rating → post-market outcome correlations
        const ratingCorrelations: Array<{
          ratingKey: string;
          ratingLabel: string;
          threshold: number;
          direction: 'high' | 'low';
          check: (doc: AnyCollection) => boolean;
          outcomeLabel: string;
        }> = [
          { ratingKey: 'urgencyToMakeMoney', ratingLabel: 'urgency to make money', threshold: 4, direction: 'high', check: (d) => d.postMarket?.behaviors?.forcedTrades === true, outcomeLabel: 'you end up forcing trades' },
          { ratingKey: 'urgencyToMakeMoney', ratingLabel: 'urgency to make money', threshold: 4, direction: 'high', check: (d) => (d.postMarket?.actualTraps || []).includes('overtrading'), outcomeLabel: 'you overtrade' },
          { ratingKey: 'fomoLevel', ratingLabel: 'FOMO level', threshold: 4, direction: 'high', check: (d) => d.postMarket?.behaviors?.feltFomo === true, outcomeLabel: 'FOMO influences your decisions' },
          { ratingKey: 'confidence', ratingLabel: 'confidence', threshold: 5, direction: 'high', check: (d) => d.postMarket?.behaviors?.carelessAfterWin === true, outcomeLabel: 'you become careless' },
          { ratingKey: 'confidence', ratingLabel: 'confidence', threshold: 5, direction: 'high', check: (d) => (d.postMarket?.ratings?.planAdherence || 5) <= 2, outcomeLabel: 'your plan adherence drops' },
          { ratingKey: 'focus', ratingLabel: 'focus', threshold: 2, direction: 'low', check: (d) => (d.postMarket?.ratings?.selectivity || 5) <= 2, outcomeLabel: 'your selectivity suffers' },
          { ratingKey: 'patience', ratingLabel: 'patience', threshold: 2, direction: 'low', check: (d) => d.postMarket?.behaviors?.forcedTrades === true, outcomeLabel: 'you force trades' },
        ]

        for (const corr of ratingCorrelations) {
          const matchingDays = completeDocs.filter((d) => {
            const val = d.preMarket?.ratings?.[corr.ratingKey] || 0
            return corr.direction === 'high' ? val >= corr.threshold : val <= corr.threshold
          })
          if (matchingDays.length >= 3) {
            const outcomeCount = matchingDays.filter(corr.check).length
            const rate = Math.round((outcomeCount / matchingDays.length) * 100)
            if (rate >= 40) {
              conditionalInsights.push({
                condition: `When your pre-market ${corr.ratingLabel} is ${corr.direction} (${corr.direction === 'high' ? '>=' : '<='} ${corr.threshold}/5)`,
                outcome: corr.outcomeLabel,
                rate,
                occurrences: outcomeCount,
                total: matchingDays.length,
              })
            }
          }
        }

        // ===== METRIC EXPLANATIONS =====
        const metricExplanations = {
          stateConsistency: {
            label: 'State Shift',
            description: 'Compares your pre-market mental quality (focus, patience, confidence, calmness — adjusted for urgency and FOMO) with your post-market execution (plan adherence, emotional stability, selectivity). Positive means you performed better than your starting state. Negative means you declined. Near zero means consistent. This is a rolling average across all your complete days.',
            interpretation: (val: number) => {
              const abs = Math.abs(val)
              if (abs < 0.25) return 'Very consistent — your execution closely matches your preparation'
              if (val > 0) {
                if (val > 1.0) return 'Strong average improvement — you tend to perform better than your starting state'
                return 'Slight average improvement — execution tends to exceed your pre-market state'
              }
              if (val < -1.0) return 'Notable average decline — your execution tends to drop from your starting state'
              return 'Slight average decline — execution tends to dip below your pre-market state'
            },
          },
          intentionAdherence: {
            label: 'Intention Adherence',
            description: 'The percentage of your stated pre-market intentions (e.g., "avoid forcing trades", "stay patient") that you actually followed through on, measured by your post-market behaviors and ratings. 100% means you kept every intention you set.',
            interpretation: (val: number) => {
              if (val >= 90) return 'Excellent discipline — you\'re following through on nearly all your intentions'
              if (val >= 70) return 'Good follow-through with room to improve'
              if (val >= 50) return 'You\'re keeping about half your intentions — consider setting fewer, more focused ones'
              return 'Significant gap between intentions and actions — try focusing on just 1-2 key intentions'
            },
          },
        }

        // Compute current averages with interpretations
        const avgDrift = completeDocs.filter((d) => d.analysis?.stateConsistency !== undefined && d.analysis?.stateConsistency !== null)
        const avgDriftVal = avgDrift.length > 0
          ? Math.round((avgDrift.reduce((sum, d) => sum + d.analysis.stateConsistency, 0) / avgDrift.length) * 100) / 100
          : null

        const avgAdh = completeDocs.filter((d) => d.analysis?.intentionAdherence !== undefined && d.analysis?.intentionAdherence !== null)
        const avgAdhVal = avgAdh.length > 0
          ? Math.round(avgAdh.reduce((sum, d) => sum + d.analysis.intentionAdherence, 0) / avgAdh.length)
          : null

        // Include the actual date of the "latest" day so the frontend can display it
        const latestDate = today?.date ? String(today.date).split('T')[0] : null
        // Date range for context
        const oldestDate = docs.length > 0 ? String(docs[docs.length - 1].date).split('T')[0] : null

        return Response.json({
          totalDays: docs.length,
          completeDays: totalCompleteDays,
          latestDate,
          oldestDate,
          todayInsights,
          recurringPatterns: {
            issues: recurringIssues,
            strengths,
          },
          trendInsights,
          conditionalInsights,
          metrics: {
            stateConsistency: {
              ...metricExplanations.stateConsistency,
              currentAverage: avgDriftVal,
              currentInterpretation: avgDriftVal !== null ? metricExplanations.stateConsistency.interpretation(avgDriftVal) : null,
            },
            intentionAdherence: {
              ...metricExplanations.intentionAdherence,
              currentAverage: avgAdhVal,
              currentInterpretation: avgAdhVal !== null ? metricExplanations.intentionAdherence.interpretation(avgAdhVal) : null,
            },
          },
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
          behaviors: doc.postMarket?.behaviors || {},
          stateConsistency: doc.analysis?.stateConsistency,
          intentionAdherence: doc.analysis?.intentionAdherence,
          riskPredictionAccuracy: doc.analysis?.riskPredictionAccuracy ?? null,
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
