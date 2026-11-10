import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// 3-3-1 Action Journal (see src/utilities/actionJournal.ts):
// - mental_check_ins.post_market_reflections_action_journal: structured 3-3-1
//   reflection with pillar tags (legacy reflection fields keep a mirrored copy)
// - mindset_journal.action_journal: same shape for post-market journal entries
// - new journal entry type 'coaching_session_summary'
// Every statement is idempotent so a dev-push-drifted DB doesn't fail the deploy.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mental_check_ins" ADD COLUMN IF NOT EXISTS "post_market_reflections_action_journal" jsonb;
    ALTER TABLE "mindset_journal" ADD COLUMN IF NOT EXISTS "action_journal" jsonb;
    ALTER TYPE "public"."enum_mindset_journal_entry_type" ADD VALUE IF NOT EXISTS 'coaching_session_summary';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop a single enum value; 'coaching_session_summary' stays
  // (harmless — the option is simply no longer offered by the config).
  await db.execute(sql`
    ALTER TABLE "mental_check_ins" DROP COLUMN IF EXISTS "post_market_reflections_action_journal";
    ALTER TABLE "mindset_journal" DROP COLUMN IF EXISTS "action_journal";
  `)
}
