import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."checkin_risk_prediction" AS ENUM('accurate', 'inaccurate', 'worry_not_fulfilled', 'emotionally_set', 'blind_spot');
  CREATE TYPE "public"."eval_risk_prediction" AS ENUM('accurate', 'inaccurate', 'worry_not_fulfilled', 'emotionally_set', 'blind_spot');
  ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DATA TYPE text;
  ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DEFAULT 'claude-sonnet-4-6'::text;
  DROP TYPE "public"."enum_mindset_config_ai_config_model";
  CREATE TYPE "public"."enum_mindset_config_ai_config_model" AS ENUM('claude-sonnet-4-6', 'claude-opus-4-8');
  ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DEFAULT 'claude-sonnet-4-6'::"public"."enum_mindset_config_ai_config_model";
  ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DATA TYPE "public"."enum_mindset_config_ai_config_model" USING "ai_config_model"::"public"."enum_mindset_config_ai_config_model";
  ALTER TABLE "mental_check_ins" ALTER COLUMN "analysis_risk_prediction_accuracy" SET DATA TYPE "public"."checkin_risk_prediction" USING NULL::"public"."checkin_risk_prediction";
  ALTER TABLE "mindset_evaluations" ALTER COLUMN "deterministic_analysis_risk_prediction_accuracy" SET DATA TYPE "public"."eval_risk_prediction" USING NULL::"public"."eval_risk_prediction";
  ALTER TABLE "trades" ADD COLUMN "did_not_trade" boolean DEFAULT false;
  UPDATE "trades" SET "did_not_trade" = false WHERE "did_not_trade" IS NULL;
  CREATE INDEX "trades_did_not_trade_idx" ON "trades" USING btree ("did_not_trade");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DATA TYPE text;
  ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DEFAULT 'claude-sonnet-4-20250514'::text;
  DROP TYPE "public"."enum_mindset_config_ai_config_model";
  CREATE TYPE "public"."enum_mindset_config_ai_config_model" AS ENUM('claude-sonnet-4-20250514', 'claude-opus-4-20250514');
  ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DEFAULT 'claude-sonnet-4-20250514'::"public"."enum_mindset_config_ai_config_model";
  ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DATA TYPE "public"."enum_mindset_config_ai_config_model" USING "ai_config_model"::"public"."enum_mindset_config_ai_config_model";
  DROP INDEX "trades_did_not_trade_idx";
  ALTER TABLE "mental_check_ins" ALTER COLUMN "analysis_risk_prediction_accuracy" SET DATA TYPE boolean;
  ALTER TABLE "mindset_evaluations" ALTER COLUMN "deterministic_analysis_risk_prediction_accuracy" SET DATA TYPE boolean;
  ALTER TABLE "trades" DROP COLUMN "did_not_trade";
  DROP TYPE "public"."checkin_risk_prediction";
  DROP TYPE "public"."eval_risk_prediction";`)
}
