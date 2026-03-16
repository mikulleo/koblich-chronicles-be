// src/hooks/updateTickerTags.ts
import { CollectionAfterChangeHook } from 'payload'

// Keep track of which ticker we're currently updating to prevent recursion
const updatingTickers = new Set<string | number>()
const updatingTags = new Set<string | number>()

/**
 * Update the tags associated with a ticker based on charts
 */
export const updateTickerTagsHook: CollectionAfterChangeHook = async ({ doc, req }) => {
  try {
    // Skip if there's no ticker
    if (!doc.ticker) return doc

    // Get ticker ID (handle both populated and non-populated cases)
    const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker

    // Skip if we're already processing this ticker (prevents recursion)
    if (updatingTickers.has(tickerId)) {
      return doc
    }

    // Mark that we're updating this ticker
    updatingTickers.add(tickerId)

    try {
      // Find all charts with this ticker
      const chartsResponse = await req.payload.find({
        collection: 'charts',
        where: {
          ticker: {
            equals: tickerId,
          },
        },
        depth: 0,
        limit: 200,
      })

      // Collect all unique tag IDs
      const allTagIds = new Set<number>()
      const tagCountMap: Record<string, number> = {}

      // Process each chart to build the tags list and counts
      chartsResponse.docs.forEach((chart) => {
        if (chart.tags && Array.isArray(chart.tags)) {
          chart.tags.forEach((tag) => {
            // Handle both populated and non-populated cases
            const tagId = typeof tag === 'object' ? tag.id : tag
            if (tagId) {
              const numericTagId = typeof tagId === 'string' ? parseInt(tagId, 10) : tagId

              if (!isNaN(numericTagId)) {
                allTagIds.add(numericTagId)
                const tagKey = String(numericTagId)
                tagCountMap[tagKey] = (tagCountMap[tagKey] || 0) + 1
              }
            }
          })
        }
      })

      // Update the ticker with the aggregated tags
      await req.payload.update({
        collection: 'tickers',
        id: tickerId,
        data: {
          tags: Array.from(allTagIds),
        },
        depth: 0,
      })

      // Update tag counts
      for (const [tagIdStr, count] of Object.entries(tagCountMap)) {
        const tagId = parseInt(tagIdStr, 10)

        if (updatingTags.has(tagId)) {
          continue
        }

        try {
          updatingTags.add(tagId)
          await req.payload.update({
            collection: 'tags',
            id: tagId,
            data: {
              chartsCount: count,
            },
            depth: 0,
          })
        } finally {
          updatingTags.delete(tagId)
        }
      }
    } finally {
      updatingTickers.delete(tickerId)
    }

    return doc
  } catch (error) {
    if (doc.ticker) {
      const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker
      updatingTickers.delete(tickerId)
    }

    console.error('Error in updateTickerTagsHook:', error)
    return doc
  }
}
