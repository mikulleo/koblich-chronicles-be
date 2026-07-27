import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { authenticated } from '../access/authenticated'
import { isAdmin } from '../access/adminOnly'
import { setUserOwner } from '../hooks/setUserOwner'

/**
 * User-submitted trades ("Symbol Dropbox").
 *
 * Visibility rules:
 * - Owner always sees their own submissions.
 * - Admin sees everything.
 * - Everyone else only sees submissions where the submitter opted in
 *   (makePublic) AND Leoš has reviewed them (reviewStatus: reviewed).
 *
 * Leoš later fills in `leosReview` (his own data + comments) and flips
 * `reviewStatus` to 'reviewed' — both fields are admin-only.
 */

const publicClause: Where = {
  and: [
    { makePublic: { equals: true } },
    { reviewStatus: { equals: 'reviewed' } },
  ],
}

const dateField = (name: string, required = false) => ({
  name,
  type: 'date' as const,
  required,
  admin: {
    date: { pickerAppearance: 'dayOnly' as const },
  },
})

export const TradeSubmissions: CollectionConfig = {
  slug: 'trade-submissions',
  admin: {
    group: 'Trading',
    useAsTitle: 'tickerSymbol',
    defaultColumns: ['tickerSymbol', 'user', 'tradeType', 'reviewStatus', 'makePublic', 'createdAt'],
    description: 'Trades submitted by gym users for Leoš to review',
  },
  access: {
    create: authenticated,
    read: ({ req }) => {
      if (isAdmin({ req })) return true
      if (!req.user) return publicClause
      return {
        or: [{ user: { equals: req.user.id } }, publicClause],
      }
    },
    update: ({ req }) => {
      if (isAdmin({ req })) return true
      if (!req.user) return false
      // Owner may edit only until Leoš has reviewed it
      const ownedAndPending: Where = {
        and: [
          { user: { equals: req.user.id } },
          { reviewStatus: { not_equals: 'reviewed' } },
        ],
      }
      return ownedAndPending
    },
    delete: ({ req }) => {
      if (isAdmin({ req })) return true
      if (!req.user) return false
      return { user: { equals: req.user.id } }
    },
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
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'tickerSymbol',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Stock symbol, e.g. AAPL' },
      hooks: {
        beforeValidate: [({ value }) => String(value ?? '').trim().toUpperCase()],
      },
    },
    {
      name: 'tradeType',
      type: 'select',
      options: [
        { label: 'Long', value: 'long' },
        { label: 'Short', value: 'short' },
      ],
      required: true,
      defaultValue: 'long',
    },
    { ...dateField('entryDate', true), admin: { description: 'Date you bought' } },
    {
      name: 'entryPrice',
      type: 'number',
      required: true,
      admin: { step: 0.01, description: 'Price at entry' },
    },
    {
      name: 'positionSizePct',
      type: 'number',
      required: true,
      defaultValue: 100,
      min: 1,
      max: 100,
      admin: {
        description: '% of a full position (100 = full, 50 = half, 25 = quarter)',
      },
    },
    {
      name: 'initialStopLoss',
      type: 'number',
      required: true,
      admin: { step: 0.01, description: 'Initial stop loss price' },
    },
    {
      name: 'movedStops',
      type: 'array',
      admin: { description: 'Stop loss moves' },
      fields: [
        dateField('date', true),
        { name: 'price', type: 'number', required: true, admin: { step: 0.01 } },
        { name: 'comment', type: 'textarea' },
      ],
    },
    {
      name: 'exits',
      type: 'array',
      minRows: 1,
      required: true,
      admin: { description: 'Sells / reductions (at least one — full or partial)' },
      fields: [
        dateField('date', true),
        { name: 'price', type: 'number', required: true, admin: { step: 0.01 } },
        {
          name: 'sizePct',
          type: 'number',
          required: true,
          min: 1,
          max: 100,
          admin: { description: '% of the position sold in this exit' },
        },
        { name: 'comment', type: 'textarea' },
      ],
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Overall notes about the trade' },
    },
    {
      name: 'makePublic',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: "Submitter's consent to show this trade to all users after review",
      },
    },
    {
      name: 'reviewStatus',
      type: 'select',
      options: [
        { label: 'Pending review', value: 'pending' },
        { label: 'Reviewed', value: 'reviewed' },
      ],
      defaultValue: 'pending',
      required: true,
      index: true,
      access: {
        create: isAdmin,
        update: isAdmin,
      },
      admin: { position: 'sidebar' },
    },
    {
      name: 'leosReview',
      type: 'group',
      access: {
        create: isAdmin,
        update: isAdmin,
        // Owners shouldn't see a half-finished review
        read: ({ req, doc }) => isAdmin({ req }) || doc?.reviewStatus === 'reviewed',
      },
      admin: { description: "Leoš's own take on this trade (admin only)" },
      fields: [
        {
          name: 'wouldTrade',
          type: 'select',
          options: [
            { label: 'I would have traded this', value: 'yes' },
            { label: 'I would have passed', value: 'no' },
          ],
        },
        dateField('entryDate'),
        { name: 'entryPrice', type: 'number', admin: { step: 0.01 } },
        { name: 'initialStopLoss', type: 'number', admin: { step: 0.01 } },
        {
          name: 'stops',
          type: 'array',
          admin: { description: 'Where Leoš would have moved stops' },
          fields: [
            dateField('date', true),
            { name: 'price', type: 'number', required: true, admin: { step: 0.01 } },
            { name: 'comment', type: 'textarea' },
          ],
        },
        {
          name: 'exits',
          type: 'array',
          admin: { description: 'Where Leoš would have sold' },
          fields: [
            dateField('date', true),
            { name: 'price', type: 'number', required: true, admin: { step: 0.01 } },
            { name: 'sizePct', type: 'number', min: 1, max: 100 },
            { name: 'comment', type: 'textarea' },
          ],
        },
        { name: 'commentary', type: 'textarea', admin: { description: 'Overall commentary' } },
      ],
    },
  ],
  endpoints: [
    {
      path: '/:id/story',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          const id = req.routeParams?.id
          if (!id) {
            return Response.json({ error: 'Submission ID is required' }, { status: 400 })
          }

          // IMPORTANT: enforce collection access — the local API defaults to
          // overrideAccess: true, which would leak private submissions.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let sub: any
          try {
            sub = await req.payload.findByID({
              collection: 'trade-submissions',
              id: String(id),
              depth: 0,
              overrideAccess: false,
              user: req.user,
            })
          } catch {
            return Response.json({ error: 'Submission not found' }, { status: 404 })
          }

          // Exits are % based, so replay math runs on a fixed 100-share pseudo position;
          // actual sizing vs a full position is carried by normalizationFactor.
          const totalShares = 100
          const positionSizePct =
            Number(sub.positionSizePct) > 0 ? Math.min(Number(sub.positionSizePct), 100) : 100
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const exits: any[] = (sub.exits ?? []).map((x: any) => ({
            price: x.price,
            date: x.date,
            shares: Math.round((totalShares * (Number(x.sizePct) || 100)) / 100),
            reason: '',
            notes: x.comment ?? '',
          }))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const modifiedStops: any[] = (sub.movedStops ?? []).map((s: any) => ({
            price: s.price,
            date: s.date,
            notes: s.comment ?? '',
          }))

          const totalSharesExited = exits.reduce((sum, x) => sum + (Number(x.shares) || 0), 0)
          const status = totalSharesExited >= totalShares ? 'closed' : 'partial'

          // Pseudo-trade shaped like a Trades doc so the FE replay pipeline works.
          // ticker has no id on purpose — that disables FE add-on detection.
          const pseudoTrade = {
            id: sub.id,
            ticker: { symbol: sub.tickerSymbol },
            type: sub.tradeType,
            entryDate: sub.entryDate,
            entryPrice: sub.entryPrice,
            shares: totalShares,
            initialStopLoss: sub.initialStopLoss,
            modifiedStops,
            exits,
            status,
            normalizationFactor: positionSizePct / 100,
            notes: sub.notes ?? '',
          }

          /* ── Timeline (same event shape as the Trades story endpoint) ── */
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const timelineEvents: any[] = []

          timelineEvents.push({
            date: sub.entryDate,
            type: 'entry',
            title: 'Position Entry',
            description: `Entered ${sub.tradeType} position (${positionSizePct}% of a full position)`,
            details: {
              price: sub.entryPrice,
              shares: totalShares,
              initialStop: sub.initialStopLoss,
            },
          })

          modifiedStops.forEach((stop, index) => {
            timelineEvents.push({
              date: stop.date,
              type: 'stopModified',
              title: `Stop Loss Modified (#${index + 1})`,
              description: 'Adjusted stop loss level',
              details: {
                previousStop: index === 0 ? sub.initialStopLoss : modifiedStops[index - 1].price,
                newStop: stop.price,
                notes: stop.notes,
              },
            })
          })

          exits.forEach((exit, index) => {
            timelineEvents.push({
              date: exit.date,
              type: 'exit',
              title: `Position Exit (#${index + 1})`,
              description: `Sold ${exit.shares}% of the position`,
              details: {
                price: exit.price,
                shares: exit.shares,
                reason: '',
                notes: exit.notes,
              },
            })
          })

          timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

          /* ── Metadata ── */
          const entryDate = new Date(sub.entryDate)
          const lastExitDate =
            exits.length > 0
              ? new Date(Math.max(...exits.map((e) => new Date(e.date).getTime())))
              : new Date()
          const duration = Math.floor(
            (lastExitDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24),
          )

          const entryPrice = Number(sub.entryPrice) || 0
          let totalReturnPercent = 0
          let rRatio = 0
          if (entryPrice > 0 && totalSharesExited > 0) {
            const weighted = exits.reduce((sum, x) => {
              let pct = ((Number(x.price) - entryPrice) / entryPrice) * 100
              if (sub.tradeType === 'short') pct = -pct
              return sum + pct * (Number(x.shares) || 0)
            }, 0)
            totalReturnPercent = Number((weighted / totalSharesExited).toFixed(2))
            const riskPerShare = Math.abs(entryPrice - (Number(sub.initialStopLoss) || 0))
            if (riskPerShare > 0) {
              rRatio = Number((((totalReturnPercent / 100) * entryPrice) / riskPerShare).toFixed(2))
            }
          }

          const storyMetadata = {
            ticker: { symbol: sub.tickerSymbol },
            tradeType: sub.tradeType,
            setupType: 'submission',
            status,
            duration,
            totalReturnPercent,
            rRatio,
            chartCount: 0,
            eventCount: timelineEvents.length,
          }

          /* ── Review block (leosReview already field-access-filtered by Payload) ── */
          const ownerId = typeof sub.user === 'object' ? sub.user?.id : sub.user
          const submission = {
            reviewStatus: sub.reviewStatus ?? 'pending',
            makePublic: sub.makePublic === true,
            isOwner: Boolean(req.user && String(req.user.id) === String(ownerId)),
            leosReview: sub.leosReview ?? null,
          }

          return Response.json({
            success: true,
            trade: pseudoTrade,
            story: {
              metadata: storyMetadata,
              timeline: timelineEvents,
              charts: [],
              chartsByRole: {},
              notes: sub.notes ?? '',
            },
            submission,
          })
        } catch (error) {
          console.error('Error building submission story:', error)
          return Response.json(
            { success: false, error: 'Failed to fetch submission story' },
            { status: 500 },
          )
        }
      },
    },
  ],
}
