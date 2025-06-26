import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_charts_notes_trade_story_chart_role" AS ENUM('entry', 'management', 'stopAdjustment', 'exit', 'analysis', 'context', 'reference');
  CREATE TYPE "public"."enum_charts_notes_trade_story_emotional_state" AS ENUM('confident', 'cautious', 'uncertain', 'fearful', 'greedy', 'neutral');
  ALTER TYPE "public"."enum_donations_status" ADD VALUE 'refunded';
  ALTER TABLE "charts" ADD COLUMN "notes_trade_story_chart_role" "enum_charts_notes_trade_story_chart_role" DEFAULT 'reference';
  ALTER TABLE "charts" ADD COLUMN "notes_trade_story_story_sequence" numeric;
  ALTER TABLE "charts" ADD COLUMN "notes_trade_story_decision_notes" varchar;
  ALTER TABLE "charts" ADD COLUMN "notes_trade_story_emotional_state" "enum_charts_notes_trade_story_emotional_state";
  ALTER TABLE "charts" ADD COLUMN "notes_trade_story_market_context" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "charts" DROP COLUMN IF EXISTS "notes_trade_story_chart_role";
  ALTER TABLE "charts" DROP COLUMN IF EXISTS "notes_trade_story_story_sequence";
  ALTER TABLE "charts" DROP COLUMN IF EXISTS "notes_trade_story_decision_notes";
  ALTER TABLE "charts" DROP COLUMN IF EXISTS "notes_trade_story_emotional_state";
  ALTER TABLE "charts" DROP COLUMN IF EXISTS "notes_trade_story_market_context";
  ALTER TABLE "public"."donations" ALTER COLUMN "status" SET DATA TYPE text;
  DROP TYPE "public"."enum_donations_status";
  CREATE TYPE "public"."enum_donations_status" AS ENUM('initiated', 'completed', 'failed', 'canceled');
  ALTER TABLE "public"."donations" ALTER COLUMN "status" SET DATA TYPE "public"."enum_donations_status" USING "status"::"public"."enum_donations_status";
  DROP TYPE "public"."enum_charts_notes_trade_story_chart_role";
  DROP TYPE "public"."enum_charts_notes_trade_story_emotional_state";`)
}
