import type { GlobalConfig } from 'payload'

export const MindsetConfig: GlobalConfig = {
  slug: 'mindset-config',
  admin: {
    group: 'Mental Edge',
  },
  access: {
    read: ({ req }) => {
      // Allow read from server-side hooks (no user context) or admin users
      if (!req.user) return true
      const roles = (req.user as { roles?: string[] }).roles
      return roles?.includes('admin') ?? false
    },
    update: ({ req }) => {
      if (!req.user) return false
      const roles = (req.user as { roles?: string[] }).roles
      return roles?.includes('admin') ?? false
    },
  },
  fields: [
    // ===== DETERMINISTIC THRESHOLDS =====
    {
      name: 'deterministicThresholds',
      type: 'group',
      admin: {
        description: 'Tunable thresholds for the deterministic analysis engine',
      },
      fields: [
        {
          name: 'fomoThreshold',
          type: 'number',
          defaultValue: 4,
          min: 1,
          max: 5,
          admin: {
            description: 'FOMO level at or above which fomo-driven entries drift is detected (default: 4)',
          },
        },
        {
          name: 'urgencyThreshold',
          type: 'number',
          defaultValue: 4,
          min: 1,
          max: 5,
          admin: {
            description: 'Urgency level at or above which urgency-driven overtrading drift is detected (default: 4)',
          },
        },
        {
          name: 'confidenceOverThreshold',
          type: 'number',
          defaultValue: 5,
          min: 1,
          max: 5,
          admin: {
            description: 'Confidence level at or above which overconfidence drift is detected (default: 5)',
          },
        },
        {
          name: 'planAdherenceMinimum',
          type: 'number',
          defaultValue: 4,
          min: 1,
          max: 5,
          admin: {
            description: 'Minimum planAdherence to count "stick_to_plan" intention as kept (default: 4)',
          },
        },
        {
          name: 'selectivityMinimum',
          type: 'number',
          defaultValue: 3,
          min: 1,
          max: 5,
          admin: {
            description: 'Minimum selectivity to count "stay_patient" intention as kept (default: 3)',
          },
        },
        {
          name: 'selectivityStrictMinimum',
          type: 'number',
          defaultValue: 4,
          min: 1,
          max: 5,
          admin: {
            description: 'Minimum selectivity to count "be_selective" intention as kept (default: 4)',
          },
        },
        {
          name: 'emotionalStabilityMinimum',
          type: 'number',
          defaultValue: 3,
          min: 1,
          max: 5,
          admin: {
            description: 'Minimum emotionalStability to count "stay_calm" intention as kept (default: 3)',
          },
        },
        {
          name: 'positiveWeight',
          type: 'number',
          defaultValue: 1.0,
          min: 0.1,
          max: 3.0,
          admin: {
            description: 'Weight applied to pre-market positive ratings in state consistency calculation (default: 1.0)',
          },
        },
        {
          name: 'negativeWeight',
          type: 'number',
          defaultValue: 1.0,
          min: 0.1,
          max: 3.0,
          admin: {
            description: 'Weight applied to pre-market negative ratings in state consistency calculation (default: 1.0)',
          },
        },
      ],
    },
    // ===== AI CONFIGURATION =====
    {
      name: 'aiConfig',
      type: 'group',
      admin: {
        description: 'Configuration for AI-powered coaching evaluations',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Enable AI-powered mindset evaluations',
          },
        },
        {
          name: 'model',
          type: 'select',
          defaultValue: 'claude-sonnet-5',
          options: [
            { label: 'Claude Sonnet 5', value: 'claude-sonnet-5' },
            { label: 'Claude Opus 5', value: 'claude-opus-5' },
          ],
          admin: {
            description: 'Claude model to use for evaluations',
          },
        },
        {
          name: 'maxTokens',
          type: 'number',
          defaultValue: 4000,
          min: 500,
          max: 16000,
          admin: {
            description:
              'Maximum tokens for AI response (default: 4000). Claude 5 models think by default, and thinking tokens count against this budget — keep headroom above the length of the JSON answer itself or the response gets truncated.',
          },
        },
        {
          name: 'temperature',
          type: 'number',
          defaultValue: 0.7,
          min: 0,
          max: 1,
          admin: {
            description:
              'Temperature for AI generation (0=deterministic, 1=creative, default: 0.7). Ignored on Claude 5 models — they reject sampling params, so the value is only sent to models that still accept it.',
          },
        },
        {
          name: 'lookbackDays',
          type: 'number',
          defaultValue: 7,
          min: 1,
          max: 30,
          admin: {
            description: 'Number of past days to include in AI context (default: 7)',
          },
        },
        {
          name: 'dailyRateLimit',
          type: 'number',
          defaultValue: 10,
          min: 1,
          max: 50,
          admin: {
            description: 'Maximum AI evaluations per user per day (default: 10)',
          },
        },
        {
          name: 'systemPromptOverride',
          type: 'textarea',
          admin: {
            description: 'Optional: Override the default system prompt for AI evaluations. Leave empty to use the built-in trading psychology coach persona.',
          },
        },
      ],
    },
  ],
}
