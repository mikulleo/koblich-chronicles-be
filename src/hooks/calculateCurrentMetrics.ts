import { CollectionBeforeChangeHook } from 'payload';

/**
 * Calculate real-time metrics for open and partially closed positions
 * based on current price and trade data
 */
export const calculateCurrentMetricsHook: CollectionBeforeChangeHook = ({ data, operation }) => {
  // Skip if this is a closed position or no current price
  if (data.status === 'closed' || !data.currentPrice) {
    return data;
  }

  try {  
    const currentPrice = parseFloat(data.currentPrice);
    const entryPrice = parseFloat(data.entryPrice);
    const initialShares = parseFloat(data.shares);
    const initialStop = parseFloat(data.initialStopLoss);
    
    // Skip if any required values are missing or NaN
    if (isNaN(currentPrice) || isNaN(entryPrice) || isNaN(initialShares) || isNaN(initialStop)) {
      return data;
    }
    
    // Calculate remaining shares (for partially closed positions)
    let exitedShares = 0;
    let exitedValue = 0;
    let realizedPL = 0;
    
    if (data.exits && data.exits.length > 0) {
      data.exits.forEach((exit: { shares: string; price: string }) => {
        const exitShares = parseFloat(exit.shares);
        const exitPrice = parseFloat(exit.price);
        
        if (!isNaN(exitShares) && !isNaN(exitPrice)) {
          exitedShares += exitShares;
          exitedValue += exitShares * exitPrice;
          
          // Calculate realized P/L from this exit
          if (data.type === 'long') {
            realizedPL += (exitPrice - entryPrice) * exitShares;
          } else {
            realizedPL += (entryPrice - exitPrice) * exitShares;
          }
        }
      });
    }
    
    const remainingShares = initialShares - exitedShares;
    
    // Skip if no remaining shares (should be a closed position)
    if (remainingShares <= 0) {
      return data;
    }
    
    // Get the most recent stop loss price (modified or initial)
    let currentStop = initialStop;
    if (data.modifiedStops && data.modifiedStops.length > 0) {
      // Sort by date descending to get most recent
      const sortedStops = [...data.modifiedStops].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      
      if (sortedStops[0] && !isNaN(parseFloat(sortedStops[0].price))) {
        currentStop = parseFloat(sortedStops[0].price);
      }
    }
    
    // Calculate metrics based on trade type (long vs short)
    const isLong = data.type === 'long';
    let unrealizedPL, currentRiskAmount, currentRiskPercent;
    
    // Calculate unrealized profit/loss on remaining shares
    if (isLong) {
      unrealizedPL = (currentPrice - entryPrice) * remainingShares;
      currentRiskAmount = Math.max(0, (currentPrice - currentStop) * remainingShares);
      currentRiskPercent = currentPrice !== 0 ? (Math.max(0, currentPrice - currentStop) / currentPrice) * 100 : 0;
    } else {
      // For short positions, profit when price goes down
      unrealizedPL = (entryPrice - currentPrice) * remainingShares;
      currentRiskAmount = Math.max(0, (currentStop - currentPrice) * remainingShares);
      currentRiskPercent = currentPrice !== 0 ? (Math.max(0, currentStop - currentPrice) / currentPrice) * 100 : 0;
    }
    
    // Calculate total current profit/loss (realized + unrealized)
    const totalCurrentPL = realizedPL + unrealizedPL;
    const totalInvestment = initialShares * entryPrice;
    const totalCurrentPLPercent = totalInvestment !== 0 ? (totalCurrentPL / totalInvestment) * 100 : 0;
    
    // Calculate initial risk (for R-ratio)
    let initialRiskPerShare;
    if (isLong) {
      initialRiskPerShare = Math.max(0, entryPrice - initialStop);
    } else {
      initialRiskPerShare = Math.max(0, initialStop - entryPrice);
    }
    
    const initialRiskAmount = initialRiskPerShare * initialShares;
    
    // Calculate current R-ratio
    const currentRRatio = initialRiskAmount !== 0 ? totalCurrentPL / initialRiskAmount : 0;
    
    // Calculate break-even shares
    // This is how many shares to sell at current price to break even if stopped out on the rest
    let breakEvenShares = 0;
    
    if (isLong) {
      if (currentPrice > currentStop && currentPrice !== currentStop) {
        // For long positions:
        // (shares to sell) = (remaining shares * (entry - stop) - realized P/L) / (current - stop)
        const numerator = (remainingShares * (entryPrice - currentStop)) - realizedPL;
        breakEvenShares = numerator / (currentPrice - currentStop);
      }
    } else {
      if (currentPrice < currentStop && currentPrice !== currentStop) {
        // For short positions:
        // (shares to sell) = (remaining shares * (stop - entry) - realized P/L) / (stop - current)
        const numerator = (remainingShares * (currentStop - entryPrice)) - realizedPL;
        breakEvenShares = numerator / (currentStop - currentPrice);
      }
    }
    
    // Ensure break-even shares is between 0 and remaining shares
    breakEvenShares = Math.max(0, Math.min(breakEvenShares, remainingShares));
    
    // Update the current metrics
    if (!data.currentMetrics) {
      data.currentMetrics = {};
    }
    
    data.currentMetrics = {
      ...data.currentMetrics,
      profitLossAmount: parseFloat(totalCurrentPL.toFixed(2)),
      profitLossPercent: parseFloat(totalCurrentPLPercent.toFixed(2)),
      riskAmount: parseFloat(currentRiskAmount.toFixed(2)),
      riskPercent: parseFloat(currentRiskPercent.toFixed(2)),
      rRatio: parseFloat(currentRRatio.toFixed(2)),
      breakEvenShares: parseFloat(breakEvenShares.toFixed(2)),
      lastUpdated: new Date(),
    };
    
    return data;
  } catch (error) {
    console.error('Error calculating current metrics:', error);
    return data;
  }
};