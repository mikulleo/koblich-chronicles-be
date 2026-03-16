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

/**
 * Computes analysis fields when both pre-market and post-market data are present.
 */
export const calculateCheckInAnalysis: CollectionBeforeChangeHook = ({ data }) => {
  const preMarket: PreMarket | undefined = data.preMarket
  const postMarket: PostMarket | undefined = data.postMarket

  if (!preMarket?.completedAt || !postMarket?.completedAt) {
    return data
  }

  const preRatings = preMarket.ratings || {}
  const postRatings = postMarket.ratings || {}
  const behaviors = postMarket.behaviors || {}
  const intentions = preMarket.intentions || []
  const contextFlags = preMarket.contextFlags || []
  const actualTraps = postMarket.actualTraps || []

  // 1. State consistency: compare avg pre-market positives vs avg post-market ratings
  const prePositives = [preRatings.focus, preRatings.patience, preRatings.confidence, preRatings.calmness]
    .filter((v): v is number => v !== undefined && v !== null)
  const preNegatives = [preRatings.urgencyToMakeMoney, preRatings.fomoLevel]
    .filter((v): v is number => v !== undefined && v !== null)
  const postValues = [postRatings.planAdherence, postRatings.emotionalStability, postRatings.selectivity]
    .filter((v): v is number => v !== undefined && v !== null)

  const avgPrePositive = prePositives.length > 0 ? prePositives.reduce((a, b) => a + b, 0) / prePositives.length : 0
  const avgPreNegative = preNegatives.length > 0 ? preNegatives.reduce((a, b) => a + b, 0) / preNegatives.length : 0
  const avgPost = postValues.length > 0 ? postValues.reduce((a, b) => a + b, 0) / postValues.length : 0

  // State consistency: how well pre-market state predicted post-market performance
  // High pre positive + low pre negative + high post = consistent
  // Score as difference: small diff = consistent
  const preScore = avgPrePositive - avgPreNegative
  const stateConsistency = prePositives.length > 0 && postValues.length > 0
    ? Math.round(Math.abs(preScore - avgPost) * 100) / 100
    : null

  // 2. Intention adherence: map intentions to behaviors
  const intentionMap: Record<string, () => boolean> = {
    avoid_forcing: () => !behaviors.forcedTrades,
    stay_patient: () => !behaviors.forcedTrades && (postRatings.selectivity || 0) >= 3,
    stick_to_plan: () => (postRatings.planAdherence || 0) >= 4,
    manage_risk: () => !behaviors.reactiveAfterLoss,
    avoid_fomo: () => !behaviors.feltFomo,
    stay_calm: () => (postRatings.emotionalStability || 0) >= 3,
    be_selective: () => (postRatings.selectivity || 0) >= 4,
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

  // 4. Emotional drift patterns
  const driftPatterns: string[] = []
  if (contextFlags.includes('recent_loss') && behaviors.reactiveAfterLoss) {
    driftPatterns.push('post-loss reactivity')
  }
  if ((preRatings.urgencyToMakeMoney || 0) >= 4 && behaviors.forcedTrades) {
    driftPatterns.push('urgency-driven overtrading')
  }
  if ((preRatings.fomoLevel || 0) >= 4 && behaviors.feltFomo) {
    driftPatterns.push('fomo-driven entries')
  }
  if ((preRatings.confidence || 0) >= 5 && behaviors.carelessAfterWin) {
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
