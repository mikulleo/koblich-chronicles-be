/**
 * Canonical taxonomy of trading-mindset patterns.
 *
 * Free-text `patternsIdentified` strings are unusable for aggregation — the model
 * never repeats the exact wording, so every pattern ends up with a count of 1.
 * The AI therefore also tags each evaluation with codes from this closed list,
 * which the frontend can count across days to build real "recurring patterns".
 *
 * Codes intentionally reuse the vocabulary the trader already sees elsewhere
 * (check-in traps, negative behaviors, context flags) so the wording stays
 * consistent across the whole Mental Edge section.
 *
 * The frontend mirrors this list in
 * `koblich-chronicles-fe/src/lib/mental-edge/pattern-taxonomy.ts` — keep both in
 * sync when adding a code (and add a DB migration only if the field shape changes).
 */

export type PatternCategory = 'execution' | 'emotional' | 'process' | 'context' | 'strength'

export interface PatternDefinition {
  code: string
  label: string
  category: PatternCategory
  /** Shown to the AI so it knows when the code applies. */
  hint: string
}

export const PATTERN_TAXONOMY: PatternDefinition[] = [
  // ===== EXECUTION — what happened in the market =====
  {
    code: 'overtrading',
    label: 'Overtrading',
    category: 'execution',
    hint: 'Took more trades than the plan called for, or kept trading past the point of edge.',
  },
  {
    code: 'fomo_entries',
    label: 'FOMO entries',
    category: 'execution',
    hint: 'Entered because price was moving without them, not because the setup triggered.',
  },
  {
    code: 'revenge_trading',
    label: 'Revenge trading',
    category: 'execution',
    hint: 'Traded to win money back after a loss.',
  },
  {
    code: 'chasing',
    label: 'Chasing extended moves',
    category: 'execution',
    hint: 'Entered late, well past the intended entry level.',
  },
  {
    code: 'moving_stops',
    label: 'Moving stops',
    category: 'execution',
    hint: 'Widened or removed a stop to avoid being taken out.',
  },
  {
    code: 'oversizing',
    label: 'Oversizing',
    category: 'execution',
    hint: 'Took more risk per trade than the plan allows.',
  },
  {
    code: 'undersizing',
    label: 'Undersizing A+ setups',
    category: 'execution',
    hint: 'Took too little size on the highest-conviction setups.',
  },
  {
    code: 'not_taking_setups',
    label: 'Missing valid setups',
    category: 'execution',
    hint: 'Saw a setup that matched the plan and did not take it.',
  },
  {
    code: 'cutting_winners_early',
    label: 'Cutting winners early',
    category: 'execution',
    hint: 'Exited a working trade before the target out of discomfort.',
  },
  {
    code: 'holding_losers',
    label: 'Holding losers too long',
    category: 'execution',
    hint: 'Stayed in a losing trade past the invalidation point, hoping for a recovery.',
  },
  {
    code: 'forced_trades',
    label: 'Forcing trades',
    category: 'execution',
    hint: 'Manufactured a setup in a market that offered nothing.',
  },

  // ===== EMOTIONAL — the internal state driving the behavior =====
  {
    code: 'impatience',
    label: 'Impatience',
    category: 'emotional',
    hint: 'Could not sit and wait; needed to be in something.',
  },
  {
    code: 'urgency_to_make_money',
    label: 'Urgency to make money',
    category: 'emotional',
    hint: 'Traded from a need to produce a result rather than from the process.',
  },
  {
    code: 'frustration_spiral',
    label: 'Frustration spiral',
    category: 'emotional',
    hint: 'One bad outcome escalated into progressively worse decisions.',
  },
  {
    code: 'fear_hesitation',
    label: 'Fear / hesitation',
    category: 'emotional',
    hint: 'Froze or hesitated at the trigger because of fear of losing.',
  },
  {
    code: 'overconfidence_after_wins',
    label: 'Overconfidence after wins',
    category: 'emotional',
    hint: 'Got loose with rules after a win or a winning streak.',
  },
  {
    code: 'pnl_fixation',
    label: 'P&L fixation',
    category: 'emotional',
    hint: 'Decisions driven by the open P&L number rather than the chart.',
  },
  {
    code: 'emotional_carryover',
    label: 'Emotional carryover',
    category: 'emotional',
    hint: "Yesterday's result still shaping today's decisions.",
  },

  // ===== PROCESS — the routine around the trading =====
  {
    code: 'skipped_prep',
    label: 'Skipped pre-market prep',
    category: 'process',
    hint: 'Started the session without a plan or a proper watchlist.',
  },
  {
    code: 'plan_not_followed',
    label: 'Plan written but not followed',
    category: 'process',
    hint: 'Had a clear plan and deviated from it during the session.',
  },
  {
    code: 'weak_review',
    label: 'Shallow post-market review',
    category: 'process',
    hint: 'Review was skipped or too superficial to learn from.',
  },
  {
    code: 'repeat_rule_violation',
    label: 'Repeating a known rule violation',
    category: 'process',
    hint: 'Broke a rule they have already identified and committed to.',
  },
  {
    code: 'too_many_intentions',
    label: 'Too many intentions at once',
    category: 'process',
    hint: 'Set so many focus points that none of them stuck.',
  },

  // ===== CONTEXT — outside conditions bleeding into the session =====
  {
    code: 'poor_sleep_impact',
    label: 'Poor sleep affecting decisions',
    category: 'context',
    hint: 'Low sleep or fatigue visibly degraded focus and patience.',
  },
  {
    code: 'external_stress',
    label: 'External stress bleeding in',
    category: 'context',
    hint: 'Personal or work stress carried into the trading session.',
  },
  {
    code: 'blind_spot_risk',
    label: 'Blind spot on the real risk',
    category: 'context',
    hint: 'The risk they actually fell into was not the one they predicted.',
  },

  // ===== STRENGTHS — patterns worth reinforcing =====
  {
    code: 'disciplined_no_trade',
    label: 'Disciplined no-trade day',
    category: 'strength',
    hint: 'Correctly sat out when there was nothing worth taking.',
  },
  {
    code: 'strong_risk_management',
    label: 'Strong risk management',
    category: 'strength',
    hint: 'Stops honored, sizing correct, losses kept small.',
  },
  {
    code: 'high_intention_adherence',
    label: 'Stuck to stated intentions',
    category: 'strength',
    hint: 'Followed through on the intentions set pre-market.',
  },
  {
    code: 'fast_emotional_reset',
    label: 'Fast emotional reset',
    category: 'strength',
    hint: 'Took a hit and returned to a neutral state quickly.',
  },
  {
    code: 'honest_self_reflection',
    label: 'Honest self-reflection',
    category: 'strength',
    hint: 'Journaling was specific, honest and self-aware.',
  },
]

export const PATTERN_CODES: string[] = PATTERN_TAXONOMY.map((p) => p.code)

/** Renders the taxonomy for the system prompt so the model knows what each code means. */
export function buildPatternTaxonomyPrompt(): string {
  const byCategory = PATTERN_TAXONOMY.reduce<Record<string, PatternDefinition[]>>((acc, p) => {
    ;(acc[p.category] ||= []).push(p)
    return acc
  }, {})

  const categoryTitles: Record<PatternCategory, string> = {
    execution: 'Execution patterns',
    emotional: 'Emotional patterns',
    process: 'Process patterns',
    context: 'Context patterns',
    strength: 'Strengths (positive patterns worth reinforcing)',
  }

  const sections = (Object.keys(categoryTitles) as PatternCategory[]).map((category) => {
    const lines = (byCategory[category] || []).map((p) => `- ${p.code}: ${p.label} — ${p.hint}`)
    return `${categoryTitles[category]}:\n${lines.join('\n')}`
  })

  return `## Pattern tagging

Besides the free-text "patternsIdentified", you MUST also fill "patternTags" using ONLY the fixed codes below. These codes are counted across days to surface the trader's genuinely recurring patterns, so consistency matters more than nuance.

Rules for patternTags:
- Use only codes from the list. Never invent a code.
- Tag only what the data for this evaluation actually supports — do not pad the list.
- Typically 2-5 tags. Use zero tags if nothing in the list genuinely applies.
- Never repeat the same code twice in one evaluation.
- Include a strength code when the data supports it; this is not only about problems.
- For each tag, "evidence" is ONE short sentence (max ~20 words) quoting or pointing at the specific data point from this evaluation that justifies it.
- Anything that does not fit a code belongs in "patternsIdentified" only.

${sections.join('\n\n')}`
}
