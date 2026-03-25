import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: () => true,
    delete: authenticated,
    read: authenticated,
    update: authenticated,
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: {
    forgotPassword: {
      generateEmailHTML: (args) => {
        const resetURL = `https://www.koblich-chronicles.com/reset-password?token=${args?.token ?? ''}`
        return `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: 700; color: #082d7d; margin: 0;">Koblich Chronicles</h1>
              <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Trading Gym</p>
            </div>

            <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Reset your password</h2>

            <p style="font-size: 15px; line-height: 1.7; color: #334155;">
              We received a request to reset your password. Click the button below to choose a new one.
            </p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetURL}" style="display: inline-block; background-color: #082d7d; color: #ffffff; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px;">
                Reset Password
              </a>
            </div>

            <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
              If you didn&rsquo;t request this, you can safely ignore this email. The link will expire in 1 hour.
            </p>

            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              You received this because a password reset was requested for your account at koblich-chronicles.com
            </p>
          </div>
        `
      },
      generateEmailSubject: () => 'Reset your password — Koblich Chronicles',
    },
  },
  hooks: {
    beforeChange: [
      ({ req, operation, data }) => {
        // On public registration (no user logged in), force 'user' role
        if (operation === 'create' && !req.user) {
          data.roles = ['user']
        }
        // Prevent non-admins from escalating to admin
        if (operation === 'update' && req.user) {
          const userRoles = req.user.roles as string[] | undefined
          if (!userRoles?.includes('admin')) {
            delete data.roles
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        if (operation !== 'create') return doc

        const userName = doc.name || 'there'
        try {
          await req.payload.sendEmail({
            to: doc.email,
            subject: 'Welcome to Koblich Chronicles!',
            html: `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="font-size: 28px; font-weight: 700; color: #082d7d; margin: 0;">Koblich Chronicles</h1>
                  <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Trading Gym</p>
                </div>

                <h2 style="font-size: 20px; font-weight: 600; margin-bottom: 16px;">Welcome aboard, ${userName}!</h2>

                <p style="font-size: 15px; line-height: 1.7; color: #334155;">
                  Your account has been created. You now have access to the <strong>Trading Gym</strong>, including:
                </p>

                <ul style="font-size: 15px; line-height: 2; color: #334155; padding-left: 20px;">
                  <li><strong>Trade Replay</strong> &mdash; replay real trades candle-by-candle and test your own decisions</li>
                  <li><strong>Mental Edge</strong> &mdash; daily check-ins, journaling, discipline tracking, and AI-powered insights</li>
                </ul>

                <div style="text-align: center; margin: 32px 0;">
                  <a href="https://www.koblich-chronicles.com/gym" style="display: inline-block; background-color: #082d7d; color: #ffffff; font-weight: 600; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-size: 15px;">
                    Open Trading Gym
                  </a>
                </div>

                <p style="font-size: 14px; color: #64748b; line-height: 1.6;">
                  If you have any questions or feedback, reach out on
                  <a href="https://x.com/mikulkal" style="color: #082d7d; text-decoration: none; font-weight: 500;">X @mikulkal</a>.
                </p>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
                <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                  You received this because you signed up at koblich-chronicles.com
                </p>
              </div>
            `,
          })
        } catch (err) {
          req.payload.logger.error(`Failed to send welcome email to ${doc.email}: ${err}`)
        }

        return doc
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'country',
      type: 'text',
      label: 'Country',
      admin: {
        description: 'ISO country code (e.g. US, GB, CZ)',
      },
    },
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      options: [
        {
          label: 'Admin',
          value: 'admin',
        },
        {
          label: 'User',
          value: 'user',
        },
      ],
      defaultValue: ['user'],
      required: true,
    },
    {
      name: 'preferences',
      type: 'group',
      fields: [
        {
          name: 'defaultTimeframe',
          label: 'Default Stats Timeframe',
          type: 'select',
          options: [
            { label: 'All Time', value: 'all' },
            { label: 'This Year', value: 'year' },
            { label: 'This Month', value: 'month' },
            { label: 'This Week', value: 'week' },
            { label: 'Last 30 Days', value: 'last30' },
          ],
          defaultValue: 'month',
        },
        {
          name: 'defaultChartView',
          label: 'Default Chart View',
          type: 'select',
          options: [
            { label: 'Grid', value: 'grid' },
            { label: 'List', value: 'list' },
            { label: 'Timeline', value: 'timeline' },
          ],
          defaultValue: 'grid',
        },
        {
          name: 'targetPositionSize',
          label: 'Target Position Size ($)',
          type: 'number',
          defaultValue: 25000,
          admin: {
            description: 'Your standard position size in dollars (100% allocation)',
            step: 1000,
          },
        }
      ],
    },
  ],
  timestamps: true,
}
