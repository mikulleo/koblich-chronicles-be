import { CollectionBeforeChangeHook } from 'payload';

// Define interface for trade exit record
interface TradeExit {
  price: number | string;
  shares: number | string;
  date?: string | Date;
  reason?: string;
  notes?: string;
}

/**
 * Calculate trade metrics before saving a trade
 * - Risk amount ($)
 * - Risk percentage
 * - Profit/Loss amount ($)
 * - Profit/Loss percentage
 * - R-Ratio (profit/loss relative to initial risk)
 */
export const calculateTradeMetricsHook: CollectionBeforeChangeHook = ({ data, req }) => {
  // Make copies of the data to work with
  const tradeData = { ...data };
  
  // Skip calculations if we're missing critical fields
  if (!tradeData.entryPrice || !tradeData.initialStopLoss || !tradeData.shares) {
    return tradeData;
  }

  // Parse values to ensure they're numbers
  const entryPrice = parseFloat(tradeData.entryPrice);
  const initialStop = parseFloat(tradeData.initialStopLoss);
  const shares = parseFloat(tradeData.shares);
  
  // Calculate risk based on trade type (long vs short)
  let riskPerShare, riskPercent;
  
  if (tradeData.type === 'long') {
    // For long trades, risk is entry minus stop
    riskPerShare = entryPrice - initialStop;
    riskPercent = (riskPerShare / entryPrice) * 100;
  } else {
    // For short trades, risk is stop minus entry
    riskPerShare = initialStop - entryPrice;
    riskPercent = (riskPerShare / entryPrice) * 100;
  }
  
  // Calculate total risk amount
  const riskAmount = riskPerShare * shares;
  
  // Set risk fields
  tradeData.riskAmount = parseFloat(riskAmount.toFixed(2));
  tradeData.riskPercent = parseFloat(riskPercent.toFixed(2));
  
  // Calculate profit/loss if there are exits
  if (tradeData.exits && tradeData.exits.length > 0) {
    let totalPL = 0;
    let sharesExited = 0;
    
    // Calculate P/L for each exit
    tradeData.exits.forEach((exit: TradeExit) => {
      const exitPrice = parseFloat(exit.price as string);
      const exitShares = parseFloat(exit.shares as string);
      
      if (!isNaN(exitPrice) && !isNaN(exitShares)) {
        let plPerShare;
        
        if (tradeData.type === 'long') {
          // For long trades, profit is exit minus entry
          plPerShare = exitPrice - entryPrice;
        } else {
          // For short trades, profit is entry minus exit
          plPerShare = entryPrice - exitPrice;
        }
        
        totalPL += plPerShare * exitShares;
        sharesExited += exitShares;
      }
    });
    
    // Only calculate if we have valid exits
    if (sharesExited > 0) {
      // Calculate P/L amount and percentage
      const plAmount = totalPL;
      const plPercent = (plAmount / (entryPrice * sharesExited)) * 100;
      
      // Calculate R-Ratio
      const rRatio = riskAmount > 0 ? plAmount / riskAmount : 0;
      
      // Set P/L fields
      tradeData.profitLossAmount = parseFloat(plAmount.toFixed(2));
      tradeData.profitLossPercent = parseFloat(plPercent.toFixed(2));
      tradeData.rRatio = parseFloat(rRatio.toFixed(2));
    }
  }
  
  return tradeData;
};