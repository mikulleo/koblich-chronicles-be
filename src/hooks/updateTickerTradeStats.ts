import { CollectionAfterChangeHook } from 'payload';

// Use a module-level variable to track which tickers are being processed
// to prevent infinite recursion
const updatingTickers = new Set<string | number>();

/**
 * Update ticker trade statistics
 * - Trade count
 * - Total profit/loss
 */
export const updateTickerTradeStatsHook: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  try {
    // Skip if there's no ticker
    if (!doc.ticker) return doc;
    
    // Get ticker ID (handle both populated and non-populated cases)
    const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker;
    
    // Skip if we're already processing this ticker (prevents recursion)
    if (updatingTickers.has(tickerId)) {
      return doc;
    }
    
    // Mark this ticker as being updated
    updatingTickers.add(tickerId);
    
    // Count all trades associated with this ticker
    const tradeCount = await req.payload.find({
      collection: 'trades',
      where: {
        ticker: {
          equals: tickerId,
        },
      },
      limit: 0, // Just need the count
    });
    
    // Calculate total profit/loss for this ticker
    const trades = await req.payload.find({
      collection: 'trades',
      where: {
        ticker: {
          equals: tickerId,
        },
        status: {
          in: ['closed', 'partial'],
        },
      },
      limit: 500, // Reasonable limit for calculations
    });
    
    let totalProfitLoss = 0;
    
    trades.docs.forEach(trade => {
      if (trade.profitLossAmount !== undefined && trade.profitLossAmount !== null) {
        // Handle both string and number types
        totalProfitLoss += typeof trade.profitLossAmount === 'string' 
          ? parseFloat(trade.profitLossAmount) 
          : trade.profitLossAmount;
      }
    });
    
    // Update the ticker's trade stats
    await req.payload.update({
      collection: 'tickers',
      id: tickerId,
      data: {
        tradesCount: tradeCount.totalDocs,
        profitLoss: parseFloat(totalProfitLoss.toFixed(2)),
      },
      depth: 0, // Prevent hooks from running on this update
    });
    
    // Remove this ticker from our processing set
    updatingTickers.delete(tickerId);
    
    return doc;
  } catch (error) {
    // Make sure to clean up our tracking set if an error occurs
    if (doc.ticker) {
      const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker;
      updatingTickers.delete(tickerId);
    }
    
    console.error('Error in updateTickerTradeStatsHook:', error);
    return doc;
  }
};