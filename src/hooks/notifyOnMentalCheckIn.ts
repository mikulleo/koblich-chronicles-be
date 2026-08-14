import type { CollectionAfterChangeHook } from 'payload'

import { isAdmin } from '../access/adminOnly'
import { notifyAdmin, type NotificationRow } from '../utilities/adminNotifications'

const formatDay = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

const humanizeFlag = (flag: string): string => flag.replace(/_/g, ' ')

const ratingRows = (
  ratings: Record<string, unknown> | undefined,
  labels: Record<string, string>,
): NotificationRow[] =>
  Object.entries(labels)
    .filter(([key]) => typeof ratings?.[key] === 'number')
    .map(([key, label]) => ({ label, value: `${ratings?.[key]}/5` }))

const PRE_MARKET_LABELS = {
  focus: 'Focus',
  patience: 'Patience',
  confidence: 'Confidence',
  calmness: 'Calmness',
  urgencyToMakeMoney: 'Urgency to make money',
  fomoLevel: 'FOMO',
}

const POST_MARKET_LABELS = {
  planAdherence: 'Plan adherence',
  emotionalStability: 'Emotional stability',
  selectivity: 'Selectivity',
}

/**
 * Emails the admin the first time a gym user fills in a daily check-in for a
 * given day — whichever half (pre- or post-market) lands first. Later edits and
 * the second half stay quiet, so it's at most one email per user per day.
 *
 * Free-text reflections are deliberately left out of the email; the ratings
 * give the gist, the full entry lives in the admin panel.
 */
export const notifyOnMentalCheckIn: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
  if (!req.user || isAdmin({ req })) return doc

  const wasCompleted = Boolean(
    previousDoc?.preMarket?.completedAt || previousDoc?.postMarket?.completedAt,
  )
  if (wasCompleted) return doc

  const preMarketCompleted = Boolean(doc.preMarket?.completedAt)
  const postMarketCompleted = Boolean(doc.postMarket?.completedAt)
  if (!preMarketCompleted && !postMarketCompleted) return doc

  const half = preMarketCompleted ? 'Pre-market check-in' : 'Post-market review'
  const user = req.user.name ? `${req.user.name} (${req.user.email})` : req.user.email
  const day = formatDay(doc.date) ?? '—'

  const rows: NotificationRow[] = [
    { label: 'User', value: user },
    { label: 'Date', value: day },
    { label: 'Filled in', value: half },
  ]

  if (preMarketCompleted) {
    rows.push(...ratingRows(doc.preMarket?.ratings, PRE_MARKET_LABELS))
    const flags: string[] = doc.preMarket?.contextFlags ?? []
    if (flags.length) rows.push({ label: 'Context', value: flags.map(humanizeFlag).join(', ') })
    const intentions: string[] = doc.preMarket?.intentions ?? []
    if (intentions.length) rows.push({ label: 'Intentions', value: intentions.length })
  } else {
    rows.push(...ratingRows(doc.postMarket?.ratings, POST_MARKET_LABELS))
    const traps: string[] = doc.postMarket?.actualTraps ?? []
    if (traps.length) rows.push({ label: 'Traps hit', value: traps.map(humanizeFlag).join(', ') })
  }

  notifyAdmin({
    req,
    subject: `Daily check-in: ${req.user.name || req.user.email} (${day})`,
    heading: `${half} completed`,
    intro: `${user} filled in their daily mindset check-in for ${day}.`,
    rows,
    ctaPath: `/admin/collections/mental-check-ins/${doc.id}`,
    ctaLabel: 'Open check-in',
  })

  return doc
}
