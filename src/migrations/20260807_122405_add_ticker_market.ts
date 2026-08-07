import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds the market (country/exchange) selector to tickers. The market decides the
// symbol suffix the chart data provider needs, so Trade Replay can load candles
// for non-US listings — CEZ on market 'cz' resolves to CEZ.PR.
//
// Every existing ticker is a US listing, so they backfill to market 'us' (the
// column default) with provider_symbol = symbol, i.e. no behaviour change.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tickers_market" AS ENUM('us', 'cz', 'de', 'de_f', 'uk', 'nl', 'fr', 'be', 'pt', 'ie', 'es', 'it', 'at', 'gr', 'fi', 'se', 'no', 'dk', 'ch', 'pl', 'hu', 'tr', 'ca', 'ca_v', 'mx', 'br', 'jp', 'hk', 'kr', 'tw', 'in', 'in_b', 'sg', 'au', 'nz', 'za', 'il', 'other');
  ALTER TABLE "tickers" ADD COLUMN "market" "enum_tickers_market" DEFAULT 'us' NOT NULL;
  ALTER TABLE "tickers" ADD COLUMN "market_suffix" varchar;
  ALTER TABLE "tickers" ADD COLUMN "provider_symbol" varchar;
  CREATE INDEX "tickers_provider_symbol_idx" ON "tickers" USING btree ("provider_symbol");

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
