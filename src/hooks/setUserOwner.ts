import { CollectionBeforeChangeHook } from 'payload'

/**
 * Sets the user field to the current authenticated user on create.
 * Prevents changing the user field on update.
 */
export const setUserOwner: CollectionBeforeChangeHook = ({ data, req, operation, originalDoc }) => {
  if (operation === 'create') {
    if (req.user) {
      data.user = req.user.id
    }
  }

  if (operation === 'update') {
    // Prevent changing the owner
    if (originalDoc?.user) {
      data.user = typeof originalDoc.user === 'object' ? originalDoc.user.id : originalDoc.user
    }
  }

  return data
}
