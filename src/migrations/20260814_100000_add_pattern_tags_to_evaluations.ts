import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds aiAnalysis.patternTags to mindset evaluations: an array of
// { code, evidence } objects drawn from a fixed taxonomy (see
// src/utilities/mindsetPatterns.ts). Free-text patternsIdentified stays as the
// narrative detail; the codes are what the Insights dashboard counts across days
// to build the "Recurring Patterns" ranking. Existing rows keep NULL and are
// handled on the frontend by keyword-mapping their free-text patterns.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mindset_evaluations" ADD COLUMN IF NOT EXISTS "ai_analysis_pattern_tags" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mindset_evaluations" DROP COLUMN IF EXISTS "ai_analysis_pattern_tags";
  `)
}
