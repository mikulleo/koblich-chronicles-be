import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds trades.breakEvenSecured: a manual "gold medal" tag for live positions where
// booked partials and/or a raised stop mean being stopped out now is break-even or
// better. Indexed because the stats endpoint counts secured live positions and the
// trade log filters on it. Existing rows default to false.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "break_even_secured" boolean DEFAULT false;
    UPDATE "trades" SET "break_even_secured" = false WHERE "break_even_secured" IS NULL;
    CREATE INDEX IF NOT EXISTS "trades_break_even_secured_idx" ON "trades" USING btree ("break_even_secured");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "trades_break_even_secured_idx";
    ALTER TABLE "trades" DROP COLUMN IF EXISTS "break_even_secured";
  `)
}
