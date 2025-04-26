import { CollectionAfterDeleteHook } from 'payload'

/**
 * Update ticker trade statistics after a trade is deleted
 */
export const updateTickerTradeStatsAfterDeleteHook: CollectionAfterDeleteHook = async ({
  doc,
  req,
}) => {
  try {
    // Skip if there's no ticker
    if (!doc.ticker) return doc

    // Get ticker ID (handle both populated and non-populated cases)
    const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker

    // Count all trades associated with this ticker
    const tradeCount = await req.payload.find({
      collection: 'trades',
      where: {
        ticker: {
          equals: tickerId,
        },
      },
      limit: 0, // Just need the count
    })

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
    })

    let totalProfitLoss = 0

    trades.docs.forEach((trade) => {
      if (trade.profitLossAmount !== undefined && trade.profitLossAmount !== null) {
        // Handle both string and number types
        totalProfitLoss +=
          typeof trade.profitLossAmount === 'string'
            ? parseFloat(trade.profitLossAmount)
            : trade.profitLossAmount
      }
    })

    // Update the ticker's trade stats
    await req.payload.update({
      collection: 'tickers',
      id: tickerId,
      data: {
        tradesCount: tradeCount.totalDocs,
        profitLoss: parseFloat(totalProfitLoss.toFixed(2)),
      },
      depth: 0, // Prevent hooks from running on this update
    })

    return doc
  } catch (error) {
    console.error('Error in updateTickerTradeStatsAfterDeleteHook:', error)
    return doc
  }
}
