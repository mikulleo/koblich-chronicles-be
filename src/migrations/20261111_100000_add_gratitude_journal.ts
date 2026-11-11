import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// New journal entry type 'gratitude' (offered to Action Journal users).
// Idempotent so a dev-push-drifted DB doesn't fail the deploy.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_mindset_journal_entry_type" ADD VALUE IF NOT EXISTS 'gratitude';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop a single enum value; 'gratitude' stays (harmless —
  // the option is simply no longer offered by the config).
}
