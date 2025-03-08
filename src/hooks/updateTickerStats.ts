import { CollectionAfterChangeHook } from 'payload';

/**
 * Update ticker statistics like chart count
 */
export const updateTickerStatsHook: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  try {
    // Skip if there's no ticker
    if (!doc.ticker) return doc;
    
    // Get ticker ID (handle both populated and non-populated cases)
    const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker;
    
    // Count all charts associated with this ticker
    const chartCount = await req.payload.find({
      collection: 'charts',
      where: {
        ticker: {
          equals: tickerId,
        },
      },
      limit: 0, // Just need the count
    });
    
    // Update the ticker's chart count
    await req.payload.update({
      collection: 'tickers',
      id: tickerId,
      data: {
        chartsCount: chartCount.totalDocs,
      },
    });
    
    return doc;
  } catch (error) {
    console.error('Error in updateTickerStatsHook:', error);
    return doc;
  }
};