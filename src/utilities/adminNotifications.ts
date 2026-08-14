import type { PayloadRequest } from 'payload'

import { getServerSideURL } from './getURL'

/**
 * Admin activity notifications — "somebody did something in the gym" emails.
 *
 * Recipient is configurable via ADMIN_NOTIFICATION_EMAIL; set
 * ADMIN_NOTIFICATIONS_ENABLED=false to mute them (handy locally, where
 * .env.local points at a real SMTP account).
 */

const FALLBACK_RECIPIENT = 'mikulkal@hotmail.com'

export const getAdminNotificationRecipient = (): string =>
  process.env.ADMIN_NOTIFICATION_EMAIL || FALLBACK_RECIPIENT

const notificationsEnabled = (): boolean => process.env.ADMIN_NOTIFICATIONS_ENABLED !== 'false'

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

export type NotificationRow = { label: string; value: string | number | null | undefined }

type NotifyAdminArgs = {
  req: PayloadRequest
  subject: string
  heading: string
  intro: string
  rows: NotificationRow[]
  /** Path on the admin host, e.g. /admin/collections/trade-submissions/123 */
  ctaPath?: string
  ctaLabel?: string
}

const buildHTML = ({
  heading,
  intro,
  rows,
  ctaHref,
  ctaLabel,
}: {
  heading: string
  intro: string
  rows: NotificationRow[]
  ctaHref?: string
  ctaLabel?: string
}): string => {
  const rowsHTML = rows
    .filter((row) => row.value !== null && row.value !== undefined && row.value !== '')
    .map(
      (row) => `
        <tr>
          <td style="padding: 6px 12px 6px 0; font-size: 14px; color: #64748b; vertical-align: top; white-space: nowrap;">${escapeHtml(row.label)}</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1a1a2e; font-weight: 500;">${escapeHtml(row.value)}</td>
        </tr>`,
    )
    .join('')

  const ctaHTML =
    ctaHref && ctaLabel
      ? `
        <div style="text-align: center; margin: 32px 0;">
          <a href="${escapeHtml(ctaHref)}" style="display: inline-block; background-color: #082d7d; color: #ffffff; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>`
      : ''

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 28px; font-weight: 700; color: #082d7d; margin: 0;">Koblich Chronicles</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Trading Gym &mdash; activity notification</p>
      </div>

      <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">${escapeHtml(heading)}</h2>

      <p style="font-size: 15px; line-height: 1.7; color: #334155;">${escapeHtml(intro)}</p>

      <table style="border-collapse: collapse; margin: 24px 0; width: 100%;">
        <tbody>${rowsHTML}</tbody>
      </table>
      ${ctaHTML}
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        Automated notification from koblich-chronicles.com
      </p>
    </div>
  `
}

/**
 * Fire-and-forget: the user's save shouldn't wait on (or fail because of) an
 * SMTP round-trip for an email only the admin cares about.
 */
export const notifyAdmin = ({
  req,
  subject,
  heading,
  intro,
  rows,
  ctaPath,
  ctaLabel,
}: NotifyAdminArgs): void => {
  if (!notificationsEnabled()) return

  const to = getAdminNotificationRecipient()
  const ctaHref = ctaPath ? `${getServerSideURL().replace(/\/$/, '')}${ctaPath}` : undefined

  void req.payload
    .sendEmail({
      to,
      subject,
      html: buildHTML({ heading, intro, rows, ctaHref, ctaLabel }),
    })
    .catch((err) => {
      req.payload.logger.error(`Failed to send admin notification "${subject}" to ${to}: ${err}`)
    })
}
