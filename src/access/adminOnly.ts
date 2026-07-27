import type { PayloadRequest } from 'payload'

/**
 * Boolean admin check — usable for both collection-level and field-level access
 * (field-level access must return a boolean, not a where clause).
 */
export const isAdmin = ({ req }: { req: PayloadRequest }): boolean =>
  Boolean(req.user?.roles?.includes('admin'))
