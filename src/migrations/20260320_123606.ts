import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DO $$ BEGIN CREATE TYPE "public"."enum_mental_check_ins_pre_market_context_flags" AS ENUM('recent_loss', 'recent_win', 'winning_streak', 'losing_streak', 'slept_poorly', 'personal_stress', 'market_volatile', 'account_at_high', 'account_at_low', 'big_news_day', 'end_of_week', 'end_of_month'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_mental_check_ins_pre_market_intentions" AS ENUM('avoid_forcing', 'stay_patient', 'stick_to_plan', 'manage_risk', 'avoid_fomo', 'stay_calm', 'be_selective', 'protect_gains'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_mental_check_ins_post_market_actual_traps" AS ENUM('overtrading', 'fomo_entries', 'revenge_trading', 'moving_stops', 'oversizing', 'not_taking_setups', 'chasing', 'impatience'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_mental_check_ins_pre_market_biggest_risk" AS ENUM('overtrading', 'fomo_entries', 'revenge_trading', 'moving_stops', 'oversizing', 'not_taking_setups', 'chasing', 'impatience'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_mindset_journal_linked_traps" AS ENUM('overtrading', 'fomo_entries', 'revenge_trading', 'moving_stops', 'oversizing', 'not_taking_setups', 'chasing', 'impatience'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_mindset_journal_entry_type" AS ENUM('pre_market_note', 'post_market_reflection', 'mistake_review', 'trigger_review', 'weekly_review', 'rule_violation_review'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_discipline_rules_category" AS ENUM('risk_management', 'entry_rules', 'exit_rules', 'position_sizing', 'emotional', 'routine'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_discipline_log_entries_status" AS ENUM('respected', 'violated'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_discipline_log_entries_mental_state_at_violation" AS ENUM('frustrated', 'overconfident', 'fearful', 'impatient', 'revenge_trading', 'fomo', 'bored', 'tired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_mindset_evaluations_evaluation_type" AS ENUM('daily_post_market', 'weekly_summary', 'on_demand'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_mindset_evaluations_status" AS ENUM('pending', 'completed', 'failed', 'rate_limited'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  DO $$ BEGIN CREATE TYPE "public"."enum_mindset_config_ai_config_model" AS ENUM('claude-sonnet-4-20250514', 'claude-opus-4-20250514'); EXCEPTION WHEN duplicate_object THEN null; END $$;
  CREATE TABLE IF NOT EXISTS "mental_check_ins_pre_market_context_flags" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_mental_check_ins_pre_market_context_flags",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "mental_check_ins_pre_market_intentions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_mental_check_ins_pre_market_intentions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "mental_check_ins_post_market_actual_traps" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_mental_check_ins_post_market_actual_traps",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "mental_check_ins" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"pre_market_completed_at" timestamp(3) with time zone,
  	"pre_market_ratings_focus" numeric,
  	"pre_market_ratings_patience" numeric,
  	"pre_market_ratings_confidence" numeric,
  	"pre_market_ratings_calmness" numeric,
  	"pre_market_ratings_urgency_to_make_money" numeric,
  	"pre_market_ratings_fomo_level" numeric,
  	"pre_market_biggest_risk" "enum_mental_check_ins_pre_market_biggest_risk",
  	"post_market_completed_at" timestamp(3) with time zone,
  	"post_market_ratings_plan_adherence" numeric,
  	"post_market_ratings_emotional_stability" numeric,
  	"post_market_ratings_selectivity" numeric,
  	"post_market_behaviors_forced_trades" boolean DEFAULT false,
  	"post_market_behaviors_felt_fomo" boolean DEFAULT false,
  	"post_market_behaviors_reactive_after_loss" boolean DEFAULT false,
  	"post_market_behaviors_careless_after_win" boolean DEFAULT false,
  	"post_market_reflections_what_went_well" varchar,
  	"post_market_reflections_what_went_poorly" varchar,
  	"post_market_reflections_lessons_learned" varchar,
  	"post_market_reflections_tomorrow_focus" varchar,
  	"post_market_reflections_emotional_highlight" varchar,
  	"analysis_state_consistency" numeric,
  	"analysis_intention_adherence" numeric,
  	"analysis_risk_prediction_accuracy" boolean,
  	"analysis_emotional_drift" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "mindset_journal_guided_prompts" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prompt" varchar,
  	"response" varchar
  );
  
  CREATE TABLE IF NOT EXISTS "mindset_journal_linked_traps" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_mindset_journal_linked_traps",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "mindset_journal" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"entry_type" "enum_mindset_journal_entry_type" NOT NULL,
  	"title" varchar NOT NULL,
  	"free_content" varchar,
  	"linked_date" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "discipline_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"category" "enum_discipline_rules_category" NOT NULL,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "discipline_log_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"rule_id" integer NOT NULL,
  	"status" "enum_discipline_log_entries_status" DEFAULT 'respected' NOT NULL,
  	"notes" varchar,
  	"mental_state_at_violation" "enum_discipline_log_entries_mental_state_at_violation"
  );
  
  CREATE TABLE IF NOT EXISTS "discipline_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"summary_total_rules" numeric,
  	"summary_respected" numeric,
  	"summary_violated" numeric,
  	"summary_compliance_rate" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "mindset_evaluations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"evaluation_type" "enum_mindset_evaluations_evaluation_type" DEFAULT 'daily_post_market' NOT NULL,
  	"input_snapshot_check_in_id" varchar,
  	"input_snapshot_discipline_log_id" varchar,
  	"input_snapshot_recent_trade_ids" jsonb,
  	"input_snapshot_data_hash" varchar,
  	"deterministic_analysis_state_consistency" numeric,
  	"deterministic_analysis_intention_adherence" numeric,
  	"deterministic_analysis_risk_prediction_accuracy" boolean,
  	"deterministic_analysis_emotional_drift" jsonb,
  	"ai_analysis_coaching_feedback" varchar,
  	"ai_analysis_patterns_identified" jsonb,
  	"ai_analysis_actionable_insights" jsonb,
  	"ai_analysis_risk_alerts" jsonb,
  	"ai_analysis_strengths_highlighted" jsonb,
  	"ai_analysis_focus_for_tomorrow" varchar,
  	"ai_analysis_overall_score" numeric,
  	"token_usage_input_tokens" numeric,
  	"token_usage_output_tokens" numeric,
  	"token_usage_estimated_cost" numeric,
  	"status" "enum_mindset_evaluations_status" DEFAULT 'pending' NOT NULL,
  	"error_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS "mindset_config" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"deterministic_thresholds_fomo_threshold" numeric DEFAULT 4,
  	"deterministic_thresholds_urgency_threshold" numeric DEFAULT 4,
  	"deterministic_thresholds_confidence_over_threshold" numeric DEFAULT 5,
  	"deterministic_thresholds_plan_adherence_minimum" numeric DEFAULT 4,
  	"deterministic_thresholds_selectivity_minimum" numeric DEFAULT 3,
  	"deterministic_thresholds_selectivity_strict_minimum" numeric DEFAULT 4,
  	"deterministic_thresholds_emotional_stability_minimum" numeric DEFAULT 3,
  	"deterministic_thresholds_positive_weight" numeric DEFAULT 1,
  	"deterministic_thresholds_negative_weight" numeric DEFAULT 1,
  	"ai_config_enabled" boolean DEFAULT false,
  	"ai_config_model" "enum_mindset_config_ai_config_model" DEFAULT 'claude-sonnet-4-20250514',
  	"ai_config_max_tokens" numeric DEFAULT 1500,
  	"ai_config_temperature" numeric DEFAULT 0.7,
  	"ai_config_lookback_days" numeric DEFAULT 7,
  	"ai_config_daily_rate_limit" numeric DEFAULT 10,
  	"ai_config_system_prompt_override" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "mental_check_ins_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "mindset_journal_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "discipline_rules_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "discipline_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "mindset_evaluations_id" integer;
  DO $$ BEGIN
   ALTER TABLE "mental_check_ins_pre_market_context_flags" ADD CONSTRAINT "mental_check_ins_pre_market_context_flags_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mental_check_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "mental_check_ins_pre_market_intentions" ADD CONSTRAINT "mental_check_ins_pre_market_intentions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mental_check_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "mental_check_ins_post_market_actual_traps" ADD CONSTRAINT "mental_check_ins_post_market_actual_traps_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mental_check_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "mental_check_ins" ADD CONSTRAINT "mental_check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "mindset_journal_guided_prompts" ADD CONSTRAINT "mindset_journal_guided_prompts_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."mindset_journal"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "mindset_journal_linked_traps" ADD CONSTRAINT "mindset_journal_linked_traps_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mindset_journal"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "mindset_journal" ADD CONSTRAINT "mindset_journal_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "discipline_rules" ADD CONSTRAINT "discipline_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "discipline_log_entries" ADD CONSTRAINT "discipline_log_entries_rule_id_discipline_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."discipline_rules"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "discipline_log_entries" ADD CONSTRAINT "discipline_log_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."discipline_log"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "discipline_log" ADD CONSTRAINT "discipline_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "mindset_evaluations" ADD CONSTRAINT "mindset_evaluations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "mental_check_ins_pre_market_context_flags_order_idx" ON "mental_check_ins_pre_market_context_flags" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "mental_check_ins_pre_market_context_flags_parent_idx" ON "mental_check_ins_pre_market_context_flags" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "mental_check_ins_pre_market_intentions_order_idx" ON "mental_check_ins_pre_market_intentions" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "mental_check_ins_pre_market_intentions_parent_idx" ON "mental_check_ins_pre_market_intentions" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "mental_check_ins_post_market_actual_traps_order_idx" ON "mental_check_ins_post_market_actual_traps" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "mental_check_ins_post_market_actual_traps_parent_idx" ON "mental_check_ins_post_market_actual_traps" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "mental_check_ins_user_idx" ON "mental_check_ins" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "mental_check_ins_updated_at_idx" ON "mental_check_ins" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "mental_check_ins_created_at_idx" ON "mental_check_ins" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "mindset_journal_guided_prompts_order_idx" ON "mindset_journal_guided_prompts" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "mindset_journal_guided_prompts_parent_id_idx" ON "mindset_journal_guided_prompts" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "mindset_journal_linked_traps_order_idx" ON "mindset_journal_linked_traps" USING btree ("order");
  CREATE INDEX IF NOT EXISTS "mindset_journal_linked_traps_parent_idx" ON "mindset_journal_linked_traps" USING btree ("parent_id");
  CREATE INDEX IF NOT EXISTS "mindset_journal_user_idx" ON "mindset_journal" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "mindset_journal_updated_at_idx" ON "mindset_journal" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "mindset_journal_created_at_idx" ON "mindset_journal" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "discipline_rules_user_idx" ON "discipline_rules" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "discipline_rules_updated_at_idx" ON "discipline_rules" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "discipline_rules_created_at_idx" ON "discipline_rules" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "discipline_log_entries_order_idx" ON "discipline_log_entries" USING btree ("_order");
  CREATE INDEX IF NOT EXISTS "discipline_log_entries_parent_id_idx" ON "discipline_log_entries" USING btree ("_parent_id");
  CREATE INDEX IF NOT EXISTS "discipline_log_entries_rule_idx" ON "discipline_log_entries" USING btree ("rule_id");
  CREATE INDEX IF NOT EXISTS "discipline_log_user_idx" ON "discipline_log" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "discipline_log_updated_at_idx" ON "discipline_log" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "discipline_log_created_at_idx" ON "discipline_log" USING btree ("created_at");
  CREATE INDEX IF NOT EXISTS "mindset_evaluations_user_idx" ON "mindset_evaluations" USING btree ("user_id");
  CREATE INDEX IF NOT EXISTS "mindset_evaluations_updated_at_idx" ON "mindset_evaluations" USING btree ("updated_at");
  CREATE INDEX IF NOT EXISTS "mindset_evaluations_created_at_idx" ON "mindset_evaluations" USING btree ("created_at");
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mental_check_ins_fk" FOREIGN KEY ("mental_check_ins_id") REFERENCES "public"."mental_check_ins"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mindset_journal_fk" FOREIGN KEY ("mindset_journal_id") REFERENCES "public"."mindset_journal"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discipline_rules_fk" FOREIGN KEY ("discipline_rules_id") REFERENCES "public"."discipline_rules"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_discipline_log_fk" FOREIGN KEY ("discipline_log_id") REFERENCES "public"."discipline_log"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  DO $$ BEGIN
   ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mindset_evaluations_fk" FOREIGN KEY ("mindset_evaluations_id") REFERENCES "public"."mindset_evaluations"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION
   WHEN duplicate_object THEN null;
  END $$;
  
  CREATE INDEX IF NOT EXISTS "charts_timestamp_idx" ON "charts" USING btree ("timestamp");
  CREATE INDEX IF NOT EXISTS "charts_keyboard_nav_id_idx" ON "charts" USING btree ("keyboard_nav_id");
  CREATE INDEX IF NOT EXISTS "trades_entry_date_idx" ON "trades" USING btree ("entry_date");
  CREATE INDEX IF NOT EXISTS "trades_status_idx" ON "trades" USING btree ("status");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_mental_check_ins_id_idx" ON "payload_locked_documents_rels" USING btree ("mental_check_ins_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_mindset_journal_id_idx" ON "payload_locked_documents_rels" USING btree ("mindset_journal_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_discipline_rules_id_idx" ON "payload_locked_documents_rels" USING btree ("discipline_rules_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_discipline_log_id_idx" ON "payload_locked_documents_rels" USING btree ("discipline_log_id");
  CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_mindset_evaluations_id_idx" ON "payload_locked_documents_rels" USING btree ("mindset_evaluations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "mental_check_ins_pre_market_context_flags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mental_check_ins_pre_market_intentions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mental_check_ins_post_market_actual_traps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mental_check_ins" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mindset_journal_guided_prompts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mindset_journal_linked_traps" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mindset_journal" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discipline_rules" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discipline_log_entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "discipline_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mindset_evaluations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mindset_config" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "mental_check_ins_pre_market_context_flags" CASCADE;
  DROP TABLE "mental_check_ins_pre_market_intentions" CASCADE;
  DROP TABLE "mental_check_ins_post_market_actual_traps" CASCADE;
  DROP TABLE "mental_check_ins" CASCADE;
  DROP TABLE "mindset_journal_guided_prompts" CASCADE;
  DROP TABLE "mindset_journal_linked_traps" CASCADE;
  DROP TABLE "mindset_journal" CASCADE;
  DROP TABLE "discipline_rules" CASCADE;
  DROP TABLE "discipline_log_entries" CASCADE;
  DROP TABLE "discipline_log" CASCADE;
  DROP TABLE "mindset_evaluations" CASCADE;
  DROP TABLE "mindset_config" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mental_check_ins_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mindset_journal_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_discipline_rules_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_discipline_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mindset_evaluations_fk";
  
  DROP INDEX IF EXISTS "charts_timestamp_idx";
  DROP INDEX IF EXISTS "charts_keyboard_nav_id_idx";
  DROP INDEX IF EXISTS "trades_entry_date_idx";
  DROP INDEX IF EXISTS "trades_status_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_mental_check_ins_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_mindset_journal_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_discipline_rules_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_discipline_log_id_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_mindset_evaluations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "mental_check_ins_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "mindset_journal_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "discipline_rules_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "discipline_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "mindset_evaluations_id";
  DROP TYPE "public"."enum_mental_check_ins_pre_market_context_flags";
  DROP TYPE "public"."enum_mental_check_ins_pre_market_intentions";
  DROP TYPE "public"."enum_mental_check_ins_post_market_actual_traps";
  DROP TYPE "public"."enum_mental_check_ins_pre_market_biggest_risk";
  DROP TYPE "public"."enum_mindset_journal_linked_traps";
  DROP TYPE "public"."enum_mindset_journal_entry_type";
  DROP TYPE "public"."enum_discipline_rules_category";
  DROP TYPE "public"."enum_discipline_log_entries_status";
  DROP TYPE "public"."enum_discipline_log_entries_mental_state_at_violation";
  DROP TYPE "public"."enum_mindset_evaluations_evaluation_type";
  DROP TYPE "public"."enum_mindset_evaluations_status";
  DROP TYPE "public"."enum_mindset_config_ai_config_model";`)
}
