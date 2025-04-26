import { CollectionAfterDeleteHook } from 'payload'

/**
 * Update ticker statistics after a chart is deleted
 */
export const updateTickerStatsAfterDeleteHook: CollectionAfterDeleteHook = async ({ doc, req }) => {
  try {
    // Skip if there's no ticker
    if (!doc.ticker) return doc

    // Get ticker ID (handle both populated and non-populated cases)
    const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker

    // Count all charts associated with this ticker
    const chartCount = await req.payload.find({
      collection: 'charts',
      where: {
        ticker: {
          equals: tickerId,
        },
      },
      limit: 0, // Just need the count
    })

    // Update the ticker's chart count
    await req.payload.update({
      collection: 'tickers',
      id: tickerId,
      data: {
        chartsCount: chartCount.totalDocs,
      },
    })

    return doc
  } catch (error) {
    console.error('Error in updateTickerStatsAfterDeleteHook:', error)
    return doc
  }
}
