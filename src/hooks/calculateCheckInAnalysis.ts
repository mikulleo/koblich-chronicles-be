import { CollectionBeforeChangeHook } from 'payload'

interface Ratings {
  focus?: number
  patience?: number
  confidence?: number
  calmness?: number
  urgencyToMakeMoney?: number
  fomoLevel?: number
}

interface PostMarketRatings {
  planAdherence?: number
  emotionalStability?: number
  selectivity?: number
}

interface PostMarketBehaviors {
  forcedTrades?: boolean
  feltFomo?: boolean
  reactiveAfterLoss?: boolean
  carelessAfterWin?: boolean
}

interface PreMarket {
  completedAt?: string
  ratings?: Ratings
  contextFlags?: string[]
  intentions?: string[]
  biggestRisk?: string
}

interface PostMarket {
  completedAt?: string
  ratings?: PostMarketRatings
  behaviors?: PostMarketBehaviors
  actualTraps?: string[]
}

interface DeterministicThresholds {
  fomoThreshold?: number
  urgencyThreshold?: number
  confidenceOverThreshold?: number
  planAdherenceMinimum?: number
  selectivityMinimum?: number
  selectivityStrictMinimum?: number
  emotionalStabilityMinimum?: number
  positiveWeight?: number
  negativeWeight?: number
}

const DEFAULT_THRESHOLDS: Required<DeterministicThresholds> = {
  fomoThreshold: 4,
  urgencyThreshold: 4,
  confidenceOverThreshold: 5,
  planAdherenceMinimum: 4,
  selectivityMinimum: 3,
  selectivityStrictMinimum: 4,
  emotionalStabilityMinimum: 3,
  positiveWeight: 1.0,
  negativeWeight: 1.0,
}

/**
 * Computes analysis fields when both pre-market and post-market data are present.
 * Fetches configurable thresholds from MindsetConfig global.
 */
export const calculateCheckInAnalysis: CollectionBeforeChangeHook = async ({ data, req }) => {
  const preMarket: PreMarket | undefined = data.preMarket
  const postMarket: PostMarket | undefined = data.postMarket

  if (!preMarket?.completedAt || !postMarket?.completedAt) {
    return data
  }

  // Fetch configurable thresholds
  let thresholds: DeterministicThresholds = {}
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await req.payload.findGlobal({ slug: 'mindset-config' as any })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    thresholds = (config as any)?.deterministicThresholds || {}
  } catch {
    // Config may not exist yet — use defaults
  }

  const t = {
    fomoThreshold: thresholds.fomoThreshold ?? DEFAULT_THRESHOLDS.fomoThreshold,
    urgencyThreshold: thresholds.urgencyThreshold ?? DEFAULT_THRESHOLDS.urgencyThreshold,
    confidenceOverThreshold: thresholds.confidenceOverThreshold ?? DEFAULT_THRESHOLDS.confidenceOverThreshold,
    planAdherenceMinimum: thresholds.planAdherenceMinimum ?? DEFAULT_THRESHOLDS.planAdherenceMinimum,
    selectivityMinimum: thresholds.selectivityMinimum ?? DEFAULT_THRESHOLDS.selectivityMinimum,
    selectivityStrictMinimum: thresholds.selectivityStrictMinimum ?? DEFAULT_THRESHOLDS.selectivityStrictMinimum,
    emotionalStabilityMinimum: thresholds.emotionalStabilityMinimum ?? DEFAULT_THRESHOLDS.emotionalStabilityMinimum,
  }

  const preRatings = preMarket.ratings || {}
  const postRatings = postMarket.ratings || {}
  const behaviors = postMarket.behaviors || {}
  const intentions = preMarket.intentions || []
  const contextFlags = preMarket.contextFlags || []
  const actualTraps = postMarket.actualTraps || []

  // 1. State consistency: compare pre-market quality vs post-market quality
  // Both normalized to 1-5 scale for fair comparison
  const prePositives = [preRatings.focus, preRatings.patience, preRatings.confidence, preRatings.calmness]
    .filter((v): v is number => v !== undefined && v !== null)
  const preNegatives = [preRatings.urgencyToMakeMoney, preRatings.fomoLevel]
    .filter((v): v is number => v !== undefined && v !== null)
  const postValues = [postRatings.planAdherence, postRatings.emotionalStability, postRatings.selectivity]
    .filter((v): v is number => v !== undefined && v !== null)

  // Normalize pre-market: positive ratings stay as-is (high = good),
  // negative ratings are inverted (6 - value) so high urgency/fomo → low score
  const preAll = [
    ...prePositives,
    ...preNegatives.map((v) => 6 - v),
  ]
  const avgPre = preAll.length > 0 ? preAll.reduce((a, b) => a + b, 0) / preAll.length : 0
  const avgPost = postValues.length > 0 ? postValues.reduce((a, b) => a + b, 0) / postValues.length : 0

  // Signed drift: positive = post-market improved over pre-market, negative = declined
  const stateConsistency = preAll.length > 0 && postValues.length > 0
    ? Math.round((avgPost - avgPre) * 100) / 100
    : null

  // 2. Intention adherence: map intentions to behaviors (using configurable thresholds)
  const intentionMap: Record<string, () => boolean> = {
    avoid_forcing: () => !behaviors.forcedTrades,
    stay_patient: () => !behaviors.forcedTrades && (postRatings.selectivity || 0) >= t.selectivityMinimum,
    stick_to_plan: () => (postRatings.planAdherence || 0) >= t.planAdherenceMinimum,
    manage_risk: () => !behaviors.reactiveAfterLoss,
    avoid_fomo: () => !behaviors.feltFomo,
    stay_calm: () => (postRatings.emotionalStability || 0) >= t.emotionalStabilityMinimum,
    be_selective: () => (postRatings.selectivity || 0) >= t.selectivityStrictMinimum,
    protect_gains: () => !behaviors.carelessAfterWin,
  }

  let intentionsKept = 0
  let intentionsTotal = 0
  for (const intention of intentions) {
    const check = intentionMap[intention]
    if (check) {
      intentionsTotal++
      if (check()) intentionsKept++
    }
  }
  const intentionAdherence = intentionsTotal > 0
    ? Math.round((intentionsKept / intentionsTotal) * 100)
    : null

  // 3. Risk prediction accuracy: was biggestRisk in actualTraps?
  const riskPredictionAccuracy = preMarket.biggestRisk
    ? actualTraps.includes(preMarket.biggestRisk)
    : null

  // 4. Emotional drift patterns (using configurable thresholds)
  const driftPatterns: string[] = []
  if (contextFlags.includes('recent_loss') && behaviors.reactiveAfterLoss) {
    driftPatterns.push('post-loss reactivity')
  }
  if ((preRatings.urgencyToMakeMoney || 0) >= t.urgencyThreshold && behaviors.forcedTrades) {
    driftPatterns.push('urgency-driven overtrading')
  }
  if ((preRatings.fomoLevel || 0) >= t.fomoThreshold && behaviors.feltFomo) {
    driftPatterns.push('fomo-driven entries')
  }
  if ((preRatings.confidence || 0) >= t.confidenceOverThreshold && behaviors.carelessAfterWin) {
    driftPatterns.push('overconfidence after wins')
  }
  if (contextFlags.includes('winning_streak') && behaviors.carelessAfterWin) {
    driftPatterns.push('complacency in winning streak')
  }
  if (contextFlags.includes('losing_streak') && behaviors.forcedTrades) {
    driftPatterns.push('forcing trades during losing streak')
  }

  data.analysis = {
    stateConsistency,
    intentionAdherence,
    riskPredictionAccuracy,
    emotionalDrift: driftPatterns,
  }

  return data
}
