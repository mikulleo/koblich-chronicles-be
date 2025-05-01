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
      console.log(`Skipping updateTickerTagsHook for ticker ${tickerId} - already processing`)
      return doc
    }

    // Mark that we're updating this ticker
    updatingTickers.add(tickerId)
    console.log(`Starting updateTickerTagsHook for ticker ${tickerId}`)

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
        limit: 200, // Reasonable limit for performance
      })

      console.log(`Found ${chartsResponse.docs.length} charts for ticker ${tickerId}`)

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
              // Make sure we're dealing with a number
              const numericTagId = typeof tagId === 'string' ? parseInt(tagId, 10) : tagId

              // Only process valid numeric IDs
              if (!isNaN(numericTagId)) {
                // Add to unique tag set
                allTagIds.add(numericTagId)

                // Update the count for this tag
                const tagKey = String(numericTagId)
                tagCountMap[tagKey] = (tagCountMap[tagKey] || 0) + 1
              }
            }
          })
        }
      })

      console.log(`Updating ticker ${tickerId} with ${allTagIds.size} tags`)

      // Update the ticker with the aggregated tags
      await req.payload.update({
        collection: 'tickers',
        id: tickerId,
        data: {
          tags: Array.from(allTagIds),
        },
        depth: 0, // Prevent hooks from running on this update
      })

      // Update tag counts
      for (const [tagIdStr, count] of Object.entries(tagCountMap)) {
        const tagId = parseInt(tagIdStr, 10)

        // Skip if we're already updating this tag
        if (updatingTags.has(tagId)) {
          console.log(`Skipping tag ${tagId} update - already processing`)
          continue
        }

        try {
          updatingTags.add(tagId)

          console.log(`Updating tag ${tagId} count to ${count}`)
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

      console.log(`Completed updateTickerTagsHook for ticker ${tickerId}`)
    } finally {
      // Always clean up the tracking set, even if an error occurs
      updatingTickers.delete(tickerId)
    }

    return doc
  } catch (error) {
    // Make sure to clean up our tracking set even if an error occurs
    if (doc.ticker) {
      const tickerId = typeof doc.ticker === 'object' ? doc.ticker.id : doc.ticker
      updatingTickers.delete(tickerId)
    }

    console.error('Error in updateTickerTagsHook:', error)
    return doc
  }
}
