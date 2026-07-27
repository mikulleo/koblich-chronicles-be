import type { CollectionConfig, PayloadRequest } from 'payload'
import { isAdmin } from '../access/adminOnly'
import {
  GYM_POINTS,
  MAX_SESSION_SECONDS,
  getGymProgress,
} from '../utilities/gymProgress'

/**
 * Gym activity log — one row per replay session (completed or just studied).
 *
 * Rows are ONLY created through the /record-replay endpoint below so points
 * are always computed server-side; direct REST creates are disabled to keep
 * users from forging points. Submission points are not stored here at all —
 * the progress aggregate counts trade-submissions directly.
 */
export const GymActivity: CollectionConfig = {
  slug: 'gym-activity',
  admin: {
    group: 'Trading',
    defaultColumns: ['user', 'source', 'refId', 'completed', 'durationSeconds', 'points', 'createdAt'],
    description: 'Replay study sessions recorded by the Trading Gym (endpoint-only writes)',
  },
  access: {
    // Created exclusively via the custom endpoint (local API with overrideAccess)
    create: () => false,
    read: ({ req }) => {
      if (isAdmin({ req })) return true
      if (!req.user) return false
      return { user: { equals: req.user.id } }
    },
    update: isAdmin,
    delete: isAdmin,
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
      name: 'source',
      type: 'select',
      options: [
        { label: "Leoš's trade", value: 'trade' },
        { label: 'User submission', value: 'submission' },
      ],
      required: true,
      defaultValue: 'trade',
    },
    {
      name: 'refId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'ID of the replayed trade or submission' },
    },
    {
      name: 'completed',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Replay was watched through to the summary' },
    },
    {
      name: 'firstCompletion',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'First time this user completed this replay' },
    },
    {
      name: 'durationSeconds',
      type: 'number',
      required: true,
      defaultValue: 0,
      min: 0,
      admin: { description: 'Active study time in this session (seconds)' },
    },
    {
      name: 'points',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Completion points awarded (study-time points are derived at read time)' },
    },
  ],
  endpoints: [
    {
      path: '/record-replay',
      method: 'post',
      handler: async (req: PayloadRequest) => {
        try {
          if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body: any = typeof req.json === 'function' ? await req.json() : {}
          const refId = String(body?.refId ?? '').trim()
          const source = body?.source === 'submission' ? 'submission' : 'trade'
          const completed = body?.completed === true
          const durationSeconds = Math.min(
            Math.max(Math.floor(Number(body?.durationSeconds) || 0), 0),
            MAX_SESSION_SECONDS,
          )

          if (!refId) {
            return Response.json({ error: 'refId is required' }, { status: 400 })
          }
          // Ignore sessions too short to mean anything
          if (!completed && durationSeconds < 30) {
            return Response.json({ success: true, skipped: true })
          }

          // Verify the replayed doc exists and is visible to this user
          try {
            if (source === 'trade') {
              await req.payload.findByID({ collection: 'trades', id: refId, depth: 0 })
            } else {
              await req.payload.findByID({
                collection: 'trade-submissions',
                id: refId,
                depth: 0,
                overrideAccess: false,
                user: req.user,
              })
            }
          } catch {
            return Response.json({ error: 'Replayed trade not found' }, { status: 404 })
          }

          let points = 0
          let firstCompletion = false
          if (completed) {
            const prior = await req.payload.find({
              collection: 'gym-activity',
              where: {
                and: [
                  { user: { equals: req.user.id } },
                  { refId: { equals: refId } },
                  { source: { equals: source } },
                  { completed: { equals: true } },
                ],
              },
              limit: 1,
              depth: 0,
              overrideAccess: true,
            })
            firstCompletion = prior.totalDocs === 0
            points = firstCompletion
              ? GYM_POINTS.replayFirstComplete
              : GYM_POINTS.replayRepeatComplete
          }

          const before = await getGymProgress(req.payload, req.user.id)

          await req.payload.create({
            collection: 'gym-activity',
            data: {
              user: req.user.id,
              source,
              refId,
              completed,
              firstCompletion,
              durationSeconds,
              points,
            },
            overrideAccess: true,
          })

          const progress = await getGymProgress(req.payload, req.user.id)
          const pointsAwarded = progress.totalPoints - before.totalPoints
          const leveledUp = progress.level.level > before.level.level

          return Response.json({ success: true, pointsAwarded, leveledUp, progress })
        } catch (error) {
          console.error('Error recording gym activity:', error)
          return Response.json({ success: false, error: 'Failed to record activity' }, { status: 500 })
        }
      },
    },
    {
      path: '/progress',
      method: 'get',
      handler: async (req: PayloadRequest) => {
        try {
          if (!req.user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 })
          }
          const progress = await getGymProgress(req.payload, req.user.id)
          return Response.json({ success: true, progress })
        } catch (error) {
          console.error('Error fetching gym progress:', error)
          return Response.json({ success: false, error: 'Failed to fetch progress' }, { status: 500 })
        }
      },
    },
  ],
}
