import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds the market (country/exchange) selector to tickers. The market decides the
// symbol suffix the chart data provider needs, so Trade Replay can load candles
// for non-US listings — CEZ on market 'cz' resolves to CEZ.PR.
//
// Every existing ticker is a US listing, so they backfill to market 'us' (the
// column default) with provider_symbol = symbol, i.e. no behaviour change.
//
// Written idempotently: the schema part of this change was already dev-pushed
// into production (the local BE was pointed at the prod DB), so the enum, the
// three columns and the index exist there but the migration was never recorded.
// Guarding every DDL statement lets this run as a no-op on prod while still
// building the schema correctly on a fresh database. The backfill UPDATEs are
// already idempotent via their IS NULL guards, and prod still needs them.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN
    CREATE TYPE "public"."enum_tickers_market" AS ENUM('us', 'cz', 'de', 'de_f', 'uk', 'nl', 'fr', 'be', 'pt', 'ie', 'es', 'it', 'at', 'gr', 'fi', 'se', 'no', 'dk', 'ch', 'pl', 'hu', 'tr', 'ca', 'ca_v', 'mx', 'br', 'jp', 'hk', 'kr', 'tw', 'in', 'in_b', 'sg', 'au', 'nz', 'za', 'il', 'other');
   EXCEPTION WHEN duplicate_object THEN null; END $$;
  ALTER TABLE "tickers" ADD COLUMN IF NOT EXISTS "market" "enum_tickers_market" DEFAULT 'us' NOT NULL;
  ALTER TABLE "tickers" ADD COLUMN IF NOT EXISTS "market_suffix" varchar;
  ALTER TABLE "tickers" ADD COLUMN IF NOT EXISTS "provider_symbol" varchar;
  CREATE INDEX IF NOT EXISTS "tickers_provider_symbol_idx" ON "tickers" USING btree ("provider_symbol");

  UPDATE "tickers" SET "provider_symbol" = "symbol" WHERE "provider_symbol" IS NULL;
  UPDATE "tickers" SET "exchange" = 'NYSE / Nasdaq' WHERE "exchange" IS NULL;
  UPDATE "tickers" SET "currency" = 'USD' WHERE "currency" IS NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "tickers_provider_symbol_idx";
  ALTER TABLE "tickers" DROP COLUMN "market";
  ALTER TABLE "tickers" DROP COLUMN "market_suffix";
  ALTER TABLE "tickers" DROP COLUMN "provider_symbol";
  DROP TYPE "public"."enum_tickers_market";`)
}
