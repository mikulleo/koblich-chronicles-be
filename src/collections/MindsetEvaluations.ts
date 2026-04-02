import { CollectionConfig, PayloadRequest } from 'payload'
import { authenticated } from '../access/authenticated'
import { userOwned } from '../access/userOwned'
import { setUserOwner } from '../hooks/setUserOwner'
import { generateMindsetEvaluation } from '../utilities/claudeClient'
import crypto from 'crypto'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCollection = any

const DEFAULT_SYSTEM_PROMPT = `You are an elite trading psychology coach with deep expertise in behavioral finance, emotional regulation, and peak performance for active traders.

Your role is to analyze a trader's mental check-in data and discipline logs to provide actionable, personalized coaching feedback.

Guidelines:
- Be direct and honest, but encouraging
- Reference specific data points from their check-ins
- Identify recurring patterns across multiple days
- Prioritize actionable insights over general advice
- Highlight both strengths and areas for improvement
- Use trading-specific language the trader will relate to
- Flag risk alerts when you see dangerous emotional patterns developing
- NEVER suggest paper trading, simulated trading, or demo accounts — the trader is trading live and your advice must reflect that
- Pay close attention to the trader's own written reflections and journal entries — they contain the most authentic insights into their mindset

You MUST respond with valid JSON in the following structure:
{
  "coachingFeedback": "Main coaching narrative (2-4 paragraphs)",
  "patternsIdentified": ["pattern1", "pattern2"],
  "actionableInsights": ["specific action 1", "specific action 2"],
  "riskAlerts": ["alert if any dangerous patterns detected"],
  "strengthsHighlighted": ["strength 1", "strength 2"],
  "focusForTomorrow": "Single clear focus area for the next session",
  "overallScore": 7
}

The overallScore should be 1-10 where:
1-3: Significant concerns, multiple red flags
4-5: Below average, notable issues to address
6-7: Solid performance with room for improvement
8-9: Strong performance, minor refinements
10: Exceptional mental discipline`

function computeDataHash(data: Record<string, unknown>): string {
  const str = JSON.stringify(data, Object.keys(data).sort())
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 16)
}

export const MindsetEvaluations: CollectionConfig = {
  slug: 'mindset-evaluations',
  admin: {
    useAsTitle: 'date',
    group: 'Mental Edge',
    defaultColumns: ['date', 'evaluationType', 'status', 'aiAnalysis.overallScore', 'user'],
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
      name: 'evaluationType',
      type: 'select',
      required: true,
      options: [
        { label: 'Daily Post-Market', value: 'daily_post_market' },
        { label: 'Weekly Summary', value: 'weekly_summary' },
        { label: 'On Demand', value: 'on_demand' },
      ],
      defaultValue: 'daily_post_market',
    },
    // ===== INPUT SNAPSHOT =====
    {
      name: 'inputSnapshot',
      type: 'group',
      admin: {
        description: 'Snapshot of input data used for this evaluation',
      },
      fields: [
        {
          name: 'checkInId',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'disciplineLogId',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'dataHash',
          type: 'text',
          admin: { readOnly: true, description: 'Hash of input data for deduplication' },
        },
      ],
    },
    // ===== DETERMINISTIC ANALYSIS =====
    {
      name: 'deterministicAnalysis',
      type: 'group',
      admin: {
        readOnly: true,
        description: 'Deterministic analysis snapshot from the check-in',
      },
      fields: [
        {
          name: 'stateConsistency',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'intentionAdherence',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'riskPredictionAccuracy',
          type: 'select',
          dbName: 'eval_risk_prediction',
          enumName: 'eval_risk_prediction',
          options: [
            { label: 'Accurate', value: 'accurate' },
            { label: 'Inaccurate', value: 'inaccurate' },
            { label: 'Worry Not Fulfilled', value: 'worry_not_fulfilled' },
            { label: 'Emotionally Set', value: 'emotionally_set' },
            { label: 'Blind Spot', value: 'blind_spot' },
          ],
          admin: { readOnly: true },
        },
        {
          name: 'emotionalDrift',
          type: 'json',
          admin: { readOnly: true },
        },
      ],
    },
    // ===== AI ANALYSIS =====
    {
      name: 'aiAnalysis',
      type: 'group',
      admin: {
        description: 'AI-generated coaching evaluation',
      },
      fields: [
        {
          name: 'coachingFeedback',
          type: 'textarea',
          admin: { readOnly: true },
        },
        {
          name: 'patternsIdentified',
          type: 'json',
          admin: { readOnly: true },
        },
        {
          name: 'actionableInsights',
          type: 'json',
          admin: { readOnly: true },
        },
        {
          name: 'riskAlerts',
          type: 'json',
          admin: { readOnly: true },
        },
        {
          name: 'strengthsHighlighted',
          type: 'json',
          admin: { readOnly: true },
        },
        {
          name: 'focusForTomorrow',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'overallScore',
          type: 'number',
          min: 1,
          max: 10,
          admin: { readOnly: true, description: 'Overall mental performance score (1-10)' },
        },
      ],
    },
    // ===== TOKEN USAGE =====
    {
      name: 'tokenUsage',
      type: 'group',
      admin: {
        position: 'sidebar',
        description: 'API usage tracking',
      },
      fields: [
        {
          name: 'inputTokens',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'outputTokens',
          type: 'number',
          admin: { readOnly: true },
        },
        {
          name: 'estimatedCost',
          type: 'number',
          admin: { readOnly: true, description: 'Estimated cost in USD' },
        },
      ],
    },
    // ===== STATUS =====
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Rate Limited', value: 'rate_limited' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'errorMessage',
      type: 'text',
      admin: {
        position: 'sidebar',
        readOnly: true,
        condition: (data) => data?.status === 'failed',
      },
    },
  ],
  endpoints: [
    // POST /evaluate — trigger AI evaluation
    {
      path: '/evaluate',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Parse request body
        let body: { type?: string; date?: string; force?: boolean } = {}
        try {
          if (typeof req.json === 'function') {
            body = await req.json()
          }
        } catch {
          // empty body is ok
        }

        const evaluationType = body.type || 'daily_post_market'
        const dateStr = body.date ?? new Date().toISOString().split('T')[0]!
        const forceRegenerate = body.force === true

        // Fetch config
        let config: AnyCollection
        try {
          config = await req.payload.findGlobal({ slug: 'mindset-config' as AnyCollection })
        } catch {
          config = {}
        }

        const aiConfig = config?.aiConfig || {}

        // Check if AI is enabled
        if (!aiConfig.enabled) {
          return Response.json({ error: 'AI evaluations are not enabled. Enable them in Mindset Config.' }, { status: 400 })
        }

        let pendingEval: AnyCollection | null = null

        try {
          // Rate limit check: max 3 evaluations per evaluation date
          const evalDateStart = new Date(dateStr)
          evalDateStart.setHours(0, 0, 0, 0)
          const evalDateEnd = new Date(dateStr)
          evalDateEnd.setHours(23, 59, 59, 999)

          const dateEvaluations = await req.payload.find({
            collection: 'mindset-evaluations' as AnyCollection,
            overrideAccess: true,
            where: {
              user: { equals: req.user.id },
              date: {
                greater_than_equal: evalDateStart.toISOString(),
                less_than_equal: evalDateEnd.toISOString(),
              },
              status: { equals: 'completed' },
            },
            limit: 0,
          })

          const perDateLimit = 3
          if (dateEvaluations.totalDocs >= perDateLimit) {
            return Response.json({
              error: `Regeneration limit reached for this date (${perDateLimit} evaluations per day)`,
              remaining: 0,
            }, { status: 429 })
          }

          // Gather data based on evaluation type
          const lookbackDays = aiConfig.lookbackDays || 7

          // For weekly summaries, the date range covers the week (dateStr = week start)
          // For daily evaluations, look back from the given date
          let rangeStart: Date
          let rangeEnd: Date

          if (evaluationType === 'weekly_summary') {
            rangeStart = new Date(dateStr)
            rangeEnd = new Date(dateStr)
            rangeEnd.setDate(rangeEnd.getDate() + 6)
            // Cap at today so we don't look into the future
            const now = new Date()
            if (rangeEnd > now) rangeEnd = now
          } else {
            rangeEnd = new Date(dateStr)
            rangeStart = new Date(dateStr)
            rangeStart.setDate(rangeStart.getDate() - lookbackDays)
          }

          // Fetch today's check-in (for daily type only)
          let todayCheckIn: AnyCollection | undefined
          if (evaluationType !== 'weekly_summary') {
            const todayCheckIns = await req.payload.find({
              collection: 'mental-check-ins' as AnyCollection,
              overrideAccess: true,
              where: {
                user: { equals: req.user.id },
                date: { equals: new Date(dateStr).toISOString() },
              },
              limit: 1,
              depth: 0,
            })
            todayCheckIn = todayCheckIns.docs[0] as AnyCollection | undefined
          }

          // Fetch check-ins for the date range
          const recentCheckIns = await req.payload.find({
            collection: 'mental-check-ins' as AnyCollection,
            overrideAccess: true,
            where: {
              user: { equals: req.user.id },
              date: {
                greater_than_equal: rangeStart.toISOString(),
                less_than_equal: rangeEnd.toISOString(),
              },
            },
            sort: '-date',
            limit: 14,
            depth: 0,
          })

          // Fetch recent journal entries
          const recentJournals = await req.payload.find({
            collection: 'mindset-journal' as AnyCollection,
            overrideAccess: true,
            where: {
              user: { equals: req.user.id },
              date: {
                greater_than_equal: rangeStart.toISOString(),
                less_than_equal: rangeEnd.toISOString(),
              },
            },
            sort: '-date',
            limit: 10,
            depth: 0,
          })

          // Fetch discipline log + streaks
          const recentDiscipline = await req.payload.find({
            collection: 'discipline-log' as AnyCollection,
            overrideAccess: true,
            where: {
              user: { equals: req.user.id },
              date: {
                greater_than_equal: rangeStart.toISOString(),
                less_than_equal: rangeEnd.toISOString(),
              },
            },
            sort: '-date',
            limit: 14,
            depth: 1,
          })

          // Build data snapshot for hashing
          const inputData = {
            checkIn: todayCheckIn || null,
            recentCheckIns: recentCheckIns.docs.map((d: AnyCollection) => d.id),
            journals: recentJournals.docs.map((d: AnyCollection) => d.id),
            discipline: recentDiscipline.docs.map((d: AnyCollection) => d.id),
            evaluationType,
          }
          const dataHash = computeDataHash(inputData)

          // Check for duplicate evaluation (skip if force regenerating)
          if (!forceRegenerate) {
            const existingEval = await req.payload.find({
              collection: 'mindset-evaluations' as AnyCollection,
              overrideAccess: true,
              where: {
                user: { equals: req.user.id },
                'inputSnapshot.dataHash': { equals: dataHash },
                status: { equals: 'completed' },
              },
              limit: 1,
            })

            if (existingEval.docs.length > 0) {
              return Response.json(existingEval.docs[0])
            }
          }

          // Create pending evaluation
          pendingEval = await req.payload.create({
            collection: 'mindset-evaluations' as AnyCollection,
            data: {
              user: req.user.id,
              date: new Date(dateStr).toISOString(),
              evaluationType,
              inputSnapshot: {
                checkInId: todayCheckIn?.id || null,
                disciplineLogId: recentDiscipline.docs[0]?.id || null,
                dataHash,
              },
              deterministicAnalysis: todayCheckIn?.analysis || {},
              status: 'pending',
            },
            req,
          })

          // Build prompts
          const systemPrompt = aiConfig.systemPromptOverride || DEFAULT_SYSTEM_PROMPT

          const userPrompt = buildUserPrompt(
            evaluationType,
            dateStr,
            todayCheckIn,
            recentCheckIns.docs as AnyCollection[],
            recentJournals.docs as AnyCollection[],
            recentDiscipline.docs as AnyCollection[],
          )

          // Call Claude API
          const result = await generateMindsetEvaluation(
            systemPrompt,
            userPrompt,
            {
              model: aiConfig.model || 'claude-sonnet-4-20250514',
              maxTokens: aiConfig.maxTokens || 1500,
              temperature: aiConfig.temperature ?? 0.7,
            },
          )

          // Parse AI response
          let aiAnalysis: AnyCollection
          try {
            aiAnalysis = JSON.parse(result.content)
          } catch {
            // Try to extract JSON from the response
            const jsonMatch = result.content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              aiAnalysis = JSON.parse(jsonMatch[0])
            } else {
              throw new Error('Failed to parse AI response as JSON')
            }
          }

          // Update evaluation to completed
          const updatedEval = await req.payload.update({
            collection: 'mindset-evaluations' as AnyCollection,
            id: pendingEval.id,
            data: {
              aiAnalysis: {
                coachingFeedback: aiAnalysis.coachingFeedback || '',
                patternsIdentified: aiAnalysis.patternsIdentified || [],
                actionableInsights: aiAnalysis.actionableInsights || [],
                riskAlerts: aiAnalysis.riskAlerts || [],
                strengthsHighlighted: aiAnalysis.strengthsHighlighted || [],
                focusForTomorrow: aiAnalysis.focusForTomorrow || '',
                overallScore: Math.min(10, Math.max(1, Number(aiAnalysis.overallScore) || 5)),
              },
              tokenUsage: {
                inputTokens: result.usage?.input_tokens || 0,
                outputTokens: result.usage?.output_tokens || 0,
                estimatedCost: estimateCost(
                  aiConfig.model || 'claude-sonnet-4-20250514',
                  result.usage?.input_tokens || 0,
                  result.usage?.output_tokens || 0,
                ),
              },
              status: 'completed',
            },
            overrideAccess: true,
          })

          // Return with remaining count
          const completedAfter = await req.payload.find({
            collection: 'mindset-evaluations' as AnyCollection,
            overrideAccess: true,
            where: {
              user: { equals: req.user.id },
              date: {
                greater_than_equal: evalDateStart.toISOString(),
                less_than_equal: evalDateEnd.toISOString(),
              },
              status: { equals: 'completed' },
            },
            limit: 0,
          })

          return Response.json({
            ...updatedEval,
            _regenerationsRemaining: Math.max(0, perDateLimit - completedAfter.totalDocs),
          })
        } catch (error) {
          console.error('[MindsetEvaluation] Evaluation failed:', error)

          // Mark evaluation as failed if it was created
          if (pendingEval?.id) {
            try {
              await req.payload.update({
                collection: 'mindset-evaluations' as AnyCollection,
                id: pendingEval.id,
                data: {
                  status: 'failed',
                  errorMessage: error instanceof Error ? error.message : 'Unknown error',
                },
                overrideAccess: true,
              })
            } catch (updateError) {
              console.error('[MindsetEvaluation] Failed to mark evaluation as failed:', updateError)
            }
          }

          const message = error instanceof Error ? error.message : 'Unknown error'
          return Response.json(
            { error: 'AI evaluation failed', details: message },
            { status: 500 },
          )
        }
      },
    },
    // GET /latest — return most recent evaluation for a date
    {
      path: '/latest',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url || '', 'http://localhost')
        const dateStr = url.searchParams.get('date')

        const where: AnyCollection = {
          user: { equals: req.user.id },
          status: { equals: 'completed' },
        }

        if (dateStr) {
          where.date = { equals: new Date(dateStr).toISOString() }
        }

        const evaluations = await req.payload.find({
          collection: 'mindset-evaluations' as AnyCollection,
          overrideAccess: true,
          where,
          sort: '-createdAt',
          limit: 1,
          depth: 0,
        })

        if (evaluations.docs.length === 0) {
          return Response.json(null)
        }

        return Response.json(evaluations.docs[0])
      },
    },
    // DELETE /remove/:id — delete a specific evaluation
    {
      path: '/remove',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        let body: { id?: string } = {}
        try {
          if (typeof req.json === 'function') {
            body = await req.json()
          }
        } catch {
          // empty body
        }

        if (!body.id) {
          return Response.json({ error: 'Evaluation id is required' }, { status: 400 })
        }

        // Verify ownership
        const existing = await req.payload.findByID({
          collection: 'mindset-evaluations' as AnyCollection,
          id: body.id,
          overrideAccess: true,
          depth: 0,
        })

        if (!existing) {
          return Response.json({ error: 'Evaluation not found' }, { status: 404 })
        }

        const ownerId = typeof existing.user === 'object' ? existing.user.id : existing.user
        if (ownerId !== req.user.id) {
          return Response.json({ error: 'Unauthorized' }, { status: 403 })
        }

        await req.payload.delete({
          collection: 'mindset-evaluations' as AnyCollection,
          id: body.id,
          overrideAccess: true,
        })

        return Response.json({ success: true })
      },
    },
    // GET /remaining — get remaining regenerations for a date
    {
      path: '/remaining',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        if (!req.user) {
          return Response.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url || '', 'http://localhost')
        const dateStr = url.searchParams.get('date') ?? new Date().toISOString().split('T')[0]!

        const evalDateStart = new Date(dateStr)
        evalDateStart.setHours(0, 0, 0, 0)
        const evalDateEnd = new Date(dateStr)
        evalDateEnd.setHours(23, 59, 59, 999)

        const dateEvaluations = await req.payload.find({
          collection: 'mindset-evaluations' as AnyCollection,
          overrideAccess: true,
          where: {
            user: { equals: req.user.id },
            date: {
              greater_than_equal: evalDateStart.toISOString(),
              less_than_equal: evalDateEnd.toISOString(),
            },
            status: { equals: 'completed' },
          },
          limit: 0,
        })

        const perDateLimit = 3
        return Response.json({
          date: dateStr,
          used: dateEvaluations.totalDocs,
          limit: perDateLimit,
          remaining: Math.max(0, perDateLimit - dateEvaluations.totalDocs),
        })
      },
    },
  ],
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  // Pricing per million tokens (approximate)
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-sonnet-4-20250514': { input: 3, output: 15 },
    'claude-opus-4-20250514': { input: 15, output: 75 },
  }
  const rates = pricing[model] || pricing['claude-sonnet-4-20250514']!
  return Math.round(((inputTokens * rates.input + outputTokens * rates.output) / 1_000_000) * 10000) / 10000
}

function formatCheckInDetail(ci: AnyCollection, label: string): string[] {
  const lines: string[] = []
  lines.push(`### ${label}`)
  if (ci.preMarket?.ratings) {
    lines.push(`#### Pre-Market Ratings:`)
    lines.push(JSON.stringify(ci.preMarket.ratings, null, 2))
    if (ci.preMarket.contextFlags?.length > 0) {
      lines.push(`Context Flags: ${ci.preMarket.contextFlags.join(', ')}`)
    }
    if (ci.preMarket.intentions?.length > 0) {
      lines.push(`Intentions: ${ci.preMarket.intentions.join(', ')}`)
    }
    if (ci.preMarket.biggestRisk) {
      lines.push(`Predicted Biggest Risk: ${ci.preMarket.biggestRisk}`)
    }
  }
  if (ci.postMarket?.ratings) {
    lines.push(`#### Post-Market Ratings:`)
    lines.push(JSON.stringify(ci.postMarket.ratings, null, 2))
    if (ci.postMarket.behaviors) {
      const behaviors = Object.entries(ci.postMarket.behaviors)
        .filter(([, v]) => v === true)
        .map(([k]) => k)
      if (behaviors.length > 0) {
        lines.push(`Negative Behaviors: ${behaviors.join(', ')}`)
      }
    }
    if (ci.postMarket.actualTraps?.length > 0) {
      lines.push(`Traps Fallen Into: ${ci.postMarket.actualTraps.join(', ')}`)
    }
    if (ci.postMarket.reflections) {
      const r = ci.postMarket.reflections
      if (r.whatWentWell) lines.push(`- What went well: ${r.whatWentWell}`)
      if (r.whatWentPoorly) lines.push(`- What went poorly: ${r.whatWentPoorly}`)
      if (r.lessonsLearned) lines.push(`- Lessons learned: ${r.lessonsLearned}`)
      if (r.emotionalHighlight) lines.push(`- Emotional highlight: ${r.emotionalHighlight}`)
    }
  }
  if (ci.analysis) {
    lines.push(`#### Analysis:`)
    lines.push(`- State Drift: ${ci.analysis.stateConsistency ?? 'N/A'}`)
    lines.push(`- Intention Adherence: ${ci.analysis.intentionAdherence ?? 'N/A'}%`)
    const riskLabels: Record<string, string> = {
      accurate: 'Accurate',
      inaccurate: 'Inaccurate',
      worry_not_fulfilled: 'Worry Not Fulfilled',
      emotionally_set: 'Emotionally Set',
      blind_spot: 'Blind Spot',
    }
    lines.push(`- Risk Prediction: ${riskLabels[ci.analysis.riskPredictionAccuracy] ?? 'N/A'}`)
    if (ci.analysis.emotionalDrift?.length > 0) {
      lines.push(`- Drift Patterns: ${ci.analysis.emotionalDrift.join(', ')}`)
    }
  }
  return lines
}

function buildUserPrompt(
  evaluationType: string,
  dateStr: string,
  todayCheckIn: AnyCollection,
  recentCheckIns: AnyCollection[],
  journals: AnyCollection[],
  disciplineLogs: AnyCollection[],
): string {
  const sections: string[] = []

  sections.push(`## Evaluation Type: ${evaluationType}`)
  sections.push(`## Date: ${dateStr}`)

  if (evaluationType === 'weekly_summary') {
    // Weekly: show all check-ins with full detail
    sections.push(`\n## Weekly Check-Ins (${recentCheckIns.length} days)`)
    for (const ci of recentCheckIns) {
      const date = ci.date?.split('T')[0] || 'unknown'
      sections.push(...formatCheckInDetail(ci, `Day: ${date}`))
      sections.push('') // blank line between days
    }
  } else {
    // Daily: today's check-in in detail, others as summary
    if (todayCheckIn) {
      sections.push(`## Today's Check-In`)
      sections.push(...formatCheckInDetail(todayCheckIn, "Today's Data").slice(1))
    }

    const otherCheckIns = recentCheckIns.filter((c) => c.id !== todayCheckIn?.id)
    if (otherCheckIns.length > 0) {
      sections.push(`\n## Recent Check-In History (last ${otherCheckIns.length} days)`)
      for (const ci of otherCheckIns) {
        const date = ci.date?.split('T')[0] || 'unknown'
        const adherence = ci.analysis?.intentionAdherence
        const drift = ci.analysis?.stateConsistency
        const traps = ci.postMarket?.actualTraps || []
        const driftPatterns = ci.analysis?.emotionalDrift || []
        sections.push(`- ${date}: adherence=${adherence ?? 'N/A'}%, drift=${drift ?? 'N/A'}, traps=[${traps.join(',')}], driftPatterns=[${driftPatterns.join(',')}]`)
      }
    }
  }

  // Journal entries
  if (journals.length > 0) {
    sections.push(`\n## Recent Journal Entries`)
    for (const j of journals) {
      const date = j.date?.split('T')[0] || 'unknown'
      sections.push(`- ${date} (${j.entryType}): ${j.title}`)
      if (j.freeContent) {
        sections.push(`  Content: ${j.freeContent.slice(0, 500)}`)
      }
      if (j.guidedPrompts?.length > 0) {
        for (const gp of j.guidedPrompts) {
          if (gp.response) {
            sections.push(`  Q: ${gp.prompt}`)
            sections.push(`  A: ${gp.response.slice(0, 300)}`)
          }
        }
      }
    }
  }

  // Discipline logs
  if (disciplineLogs.length > 0) {
    sections.push(`\n## Recent Discipline Logs`)
    for (const dl of disciplineLogs) {
      const date = dl.date?.split('T')[0] || 'unknown'
      const compliance = dl.summary?.complianceRate ?? 'N/A'
      const violated = dl.summary?.violated ?? 0
      sections.push(`- ${date}: compliance=${compliance}%, violated=${violated} rules`)
      if (dl.entries) {
        const violations = dl.entries.filter((e: AnyCollection) => e.status === 'violated')
        for (const v of violations) {
          const ruleTitle = typeof v.rule === 'object' ? v.rule.title : v.rule
          sections.push(`  - Violated: "${ruleTitle}" (mental state: ${v.mentalStateAtViolation || 'not specified'})`)
        }
      }
    }
  }

  return sections.join('\n')
}
