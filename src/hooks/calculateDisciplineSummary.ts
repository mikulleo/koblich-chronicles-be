import { CollectionBeforeChangeHook } from 'payload'

interface DisciplineEntry {
  rule: string | { id: string }
  status: 'respected' | 'violated'
  notes?: string
  mentalStateAtViolation?: string
}

/**
 * Calculates discipline log summary stats from entries.
 */
export const calculateDisciplineSummary: CollectionBeforeChangeHook = ({ data }) => {
  const entries: DisciplineEntry[] = data.entries || []

  const totalRules = entries.length
  const respected = entries.filter((e) => e.status === 'respected').length
  const violated = entries.filter((e) => e.status === 'violated').length
  const complianceRate = totalRules > 0 ? Math.round((respected / totalRules) * 100) : 0

  data.summary = {
    totalRules,
    respected,
    violated,
    complianceRate,
  }

  return data
}
