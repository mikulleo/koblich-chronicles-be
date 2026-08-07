import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds exchange + currency metadata to tickers so non-US listings (XETRA, LSE,
// Prague, Tokyo …) can be labelled. The symbol itself still drives chart data —
// it must carry the provider's exchange suffix, e.g. SAP.DE / RIO.L / CEZ.PR.
//
// NOTE: the generated migration also re-emitted the mindset_config AI-model enum
// rewrite, which 20260803_090000_update_mindset_model_ids_claude_5 already applied
// by hand (the drizzle snapshot just hadn't captured it). Those statements were
// removed — re-running them on an already-migrated database is pure risk. The
// accompanying .json snapshot keeps the state so it is not re-emitted next time.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tickers" ADD COLUMN IF NOT EXISTS "exchange" varchar;
    ALTER TABLE "tickers" ADD COLUMN IF NOT EXISTS "currency" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tickers" DROP COLUMN IF EXISTS "exchange";
    ALTER TABLE "tickers" DROP COLUMN IF EXISTS "currency";
  `)
}
