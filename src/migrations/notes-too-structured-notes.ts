// src/migrations/notes-to-structured-notes.ts
import { Payload } from 'payload'

export const migrateNotes = async (payload: Payload): Promise<void> => {
  console.log('Starting migration of chart notes to structured format...')

  // Fetch all charts that have the old notes format (string)
  // This query helps us identify charts that need migration
  try {
    const charts = await payload.find({
      collection: 'charts',
      limit: 1000, // Adjust based on your collection size
      depth: 0,
    })

    console.log(`Found ${charts.docs.length} charts to check for migration`)

    let migratedCount = 0

    // Process each chart
    for (const chart of charts.docs) {
      // Check if notes is a string and needs migration
      // or if notes is missing entirely
      if (
        (typeof chart.notes === 'string' && chart.notes.trim() !== '') ||
        (!chart.notes && chart.id)
      ) {
        console.log(`Migrating notes for chart ID: ${chart.id}`)

        // Create the new notes structure
        const newNotes = {
          setupEntry: '',
          trend: '',
          fundamentals: '',
          other: typeof chart.notes === 'string' ? chart.notes : '',
        }

        // Update the chart with the new structure
        await payload.update({
          collection: 'charts',
          id: chart.id,
          data: {
            notes: newNotes,
          },
        })

        migratedCount++
      }
    }

    console.log(`Migration completed. Migrated ${migratedCount} charts.`)
  } catch (error) {
    console.error('Error during notes migration:', error)
    throw error
  }
}

// Example usage:
//
// In your payload.config.ts file, you can run this once on server start:
//
// import { migrateNotes } from './migrations/notes-to-structured-notes'
//
// export default buildConfig({
//   // ... your config
//   onInit: async (payload) => {
//     // Run migrations
//     await migrateNotes(payload)
//
//     // Other initialization code
//   },
// })
