import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Add performance indexes for frequently queried columns
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "trades_status_idx" ON "trades" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "trades_entry_date_idx" ON "trades" USING btree ("entry_date");
    CREATE INDEX IF NOT EXISTS "charts_timestamp_idx" ON "charts" USING btree ("timestamp");
    CREATE INDEX IF NOT EXISTS "charts_keyboard_nav_id_idx" ON "charts" USING btree ("keyboard_nav_id");
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "trades_status_idx";
    DROP INDEX IF EXISTS "trades_entry_date_idx";
    DROP INDEX IF EXISTS "charts_timestamp_idx";
    DROP INDEX IF EXISTS "charts_keyboard_nav_id_idx";
  `)
}
