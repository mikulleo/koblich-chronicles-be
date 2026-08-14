import type { CollectionAfterChangeHook } from 'payload'

import { isAdmin } from '../access/adminOnly'
import { notifyAdmin } from '../utilities/adminNotifications'

const formatDay = (value: unknown): string | null => {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

/**
 * Emails the admin when a gym user drops a new symbol into the Symbol Dropbox.
 * Only fires on create, and never for the admin's own submissions.
 */
export const notifyOnTradeSubmission: CollectionAfterChangeHook = ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  if (!req.user || isAdmin({ req })) return doc

  const submitter = req.user.name ? `${req.user.name} (${req.user.email})` : req.user.email
  const exitCount = Array.isArray(doc.exits) ? doc.exits.length : 0

  notifyAdmin({
    req,
    subject: `New trade submission: ${doc.tickerSymbol}`,
    heading: `${doc.tickerSymbol} submitted for review`,
    intro: `${submitter} submitted a trade to the Symbol Dropbox.`,
    rows: [
      { label: 'Symbol', value: doc.tickerSymbol },
      { label: 'Submitted by', value: submitter },
      { label: 'Direction', value: doc.tradeType === 'short' ? 'Short' : 'Long' },
      { label: 'Entry', value: `${formatDay(doc.entryDate) ?? '—'} @ ${doc.entryPrice}` },
      { label: 'Position size', value: `${doc.positionSizePct}% of full` },
      { label: 'Initial stop', value: doc.initialStopLoss },
      { label: 'Exits logged', value: exitCount },
      { label: 'Public after review', value: doc.makePublic ? 'Yes' : 'No' },
      { label: 'Notes', value: doc.notes },
    ],
    ctaPath: `/admin/collections/trade-submissions/${doc.id}`,
    ctaLabel: 'Review submission',
  })

  return doc
}
