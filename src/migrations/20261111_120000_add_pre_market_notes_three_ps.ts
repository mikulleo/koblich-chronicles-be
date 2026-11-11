import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Pre-market check-in additions:
// - mental_check_ins.pre_market_notes: free-form notes written in the check-in
// - mental_check_ins.pre_market_three_ps: 3Ps alignment (Purpose / Presence /
//   Process), Action Journal users only — see src/utilities/threePs.ts
// Idempotent so a dev-push-drifted DB doesn't fail the deploy.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mental_check_ins" ADD COLUMN IF NOT EXISTS "pre_market_notes" varchar;
    ALTER TABLE "mental_check_ins" ADD COLUMN IF NOT EXISTS "pre_market_three_ps" jsonb;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mental_check_ins" DROP COLUMN IF EXISTS "pre_market_notes";
    ALTER TABLE "mental_check_ins" DROP COLUMN IF EXISTS "pre_market_three_ps";
  `)
}
