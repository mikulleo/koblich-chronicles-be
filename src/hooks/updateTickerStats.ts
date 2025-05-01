import { CollectionAfterChangeHook } from 'payload'

// Use a module-level variable to track which tickers are being processed
// to prevent infinite recursion
const updatingTickers = new Set<string | number>()

/**
 * Update ticker statistics like chart count
 */
export const updateTickerStatsHook: CollectionAfterChangeHook = async ({ doc, req, operation }) => {
  try {
    // Skip if there's no ticker
    if (!doc.ticker) return doc

    // Get ticker ID (handle both populated and non-populated cases)
    const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker

    // Skip if we're already processing this ticker (prevents recursion)
    if (updatingTickers.has(tickerId)) {
      return doc
    }

    // Mark this ticker as being updated
    updatingTickers.add(tickerId)

    try {
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
        depth: 0, // Prevent hooks from running on this update
      })
    } finally {
      // Always remove the ticker from our processing set, even if there's an error
      updatingTickers.delete(tickerId)
    }

    return doc
  } catch (error) {
    // Make sure to clean up our tracking set if an error occurs
    if (doc.ticker) {
      const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker
      updatingTickers.delete(tickerId)
    }

    console.error('Error in updateTickerStatsHook:', error)
    return doc
  }
}
