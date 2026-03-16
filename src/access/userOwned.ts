import type { Access } from 'payload'

/**
 * Access control that filters records to only those owned by the current user.
 * Returns a where clause so filtering happens at the DB level.
 */
export const userOwned: Access = ({ req: { user } }) => {
  if (!user) return false

  return {
    user: {
      equals: user.id,
    },
  }
}
