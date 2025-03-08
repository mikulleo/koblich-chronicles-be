import { CollectionBeforeChangeHook } from 'payload';

/**
 * Calculate normalized metrics based on position size vs target position size
 * With corrected percentage normalization
 */
export const calculateNormalizedMetricsHook: CollectionBeforeChangeHook = async ({ data, req, operation }) => {
  if (!data.positionSize) {
    return data;
  }

  try {
    // Use the stored target position size for this trade
    const targetPositionSize = data.targetPositionSize || 25000; // Default if not set
    
    // Calculate normalization factor (position size as percentage of target)
    const normalizationFactor = data.positionSize / targetPositionSize;
    data.normalizationFactor = parseFloat(normalizationFactor.toFixed(4));
    
    // Don't proceed if we don't have profit/loss data
    if (!data.profitLossAmount || !data.profitLossPercent) {
      console.log("no profit/loss data");
      return data;
    }
    
    // Initialize normalized metrics if they don't exist
    if (!data.normalizedMetrics) {
      console.log("no normalized metrics");
      data.normalizedMetrics = {};
    }
    
    // For closed or partially closed trades
    if (data.status === 'closed' || data.status === 'partial') {
      if (normalizationFactor > 0) {
        // Normalize profit/loss amount
        const normalizedPLAmount = data.profitLossAmount; // not needed to normalize, $ PL is the same
        data.normalizedMetrics.profitLossAmount = parseFloat(normalizedPLAmount.toFixed(2));
        console.log("normalizedPLAmount", normalizedPLAmount);
        
        // CORRECTED: For percentage, we need to adjust based on position size
        // Example: If you took half-size position and made 2%, at full size you'd still make 2%
        // But when calculating AVERAGES, the 2% on a half-size position should only count half as much
        // We'll handle this by using the normalization factor in the trade object
        
        data.normalizedMetrics.profitLossPercent = data.profitLossPercent * normalizationFactor;
        data.normalizedMetrics.profitLossPercent = parseFloat(data.normalizedMetrics.profitLossPercent.toFixed(2));
        console.log("normalizedPLPercent", data.profitLossPercent);
        
        // Normalize R-ratio if available
        if (data.rRatio) {
          data.normalizedMetrics.rRatio = parseFloat((data.rRatio).toFixed(2));
          console.log("normalizedRRatio", data.rRatio);
        }
      }
    } 
    // For open trades with current metrics
    else if (data.status === 'open' && data.currentMetrics) {
      if (normalizationFactor > 0) {
        // Normalize current profit/loss amount
        const normalizedCurrentPLAmount = data.currentMetrics.profitLossAmount; // not needed to normalize, $ PL is the same
        data.normalizedMetrics.profitLossAmount = parseFloat(normalizedCurrentPLAmount.toFixed(2));
        console.log("normalizedCurrentPLAmount", normalizedCurrentPLAmount);
        
        // Keep percentage same, we'll use normalization factor when calculating stats
        data.normalizedMetrics.profitLossPercent = data.currentMetrics.profitLossPercent * normalizationFactor;
        data.normalizedMetrics.profitLossPercent = parseFloat(data.normalizedMetrics.profitLossPercent.toFixed(2));
        console.log("normalizedCurrentPLPercent", data.currentMetrics.profitLossPercent);
        
        // Normalize R-ratio if available
        if (data.currentMetrics.rRatio) {
          data.normalizedMetrics.rRatio = parseFloat((data.currentMetrics.rRatio).toFixed(2));
          console.log("normalizedCurrentRRatio", data.currentMetrics.rRatio);
        }
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error calculating normalized metrics:', error);
    return data;
  }
};