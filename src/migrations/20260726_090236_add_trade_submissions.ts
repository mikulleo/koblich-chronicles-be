import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_trade_submissions_trade_type" AS ENUM('long', 'short');
  CREATE TYPE "public"."enum_trade_submissions_review_status" AS ENUM('pending', 'reviewed');
  CREATE TYPE "public"."enum_trade_submissions_leos_review_would_trade" AS ENUM('yes', 'no');
  CREATE TABLE "trade_submissions_moved_stops" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"price" numeric NOT NULL,
  	"comment" varchar
  );
  
  CREATE TABLE "trade_submissions_exits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"price" numeric NOT NULL,
  	"size_pct" numeric NOT NULL,
  	"comment" varchar
  );
  
  CREATE TABLE "trade_submissions_leos_review_stops" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"price" numeric NOT NULL,
  	"comment" varchar
  );
  
  CREATE TABLE "trade_submissions_leos_review_exits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"price" numeric NOT NULL,
  	"size_pct" numeric,
  	"comment" varchar
  );
  
  CREATE TABLE "trade_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"ticker_symbol" varchar NOT NULL,
  	"trade_type" "enum_trade_submissions_trade_type" DEFAULT 'long' NOT NULL,
  	"entry_date" timestamp(3) with time zone NOT NULL,
  	"entry_price" numeric NOT NULL,
  	"position_size_pct" numeric DEFAULT 100 NOT NULL,
  	"initial_stop_loss" numeric NOT NULL,
  	"notes" varchar,
  	"make_public" boolean DEFAULT false,
  	"review_status" "enum_trade_submissions_review_status" DEFAULT 'pending' NOT NULL,
  	"leos_review_would_trade" "enum_trade_submissions_leos_review_would_trade",
  	"leos_review_entry_date" timestamp(3) with time zone,
  	"leos_review_entry_price" numeric,
  	"leos_review_initial_stop_loss" numeric,
  	"leos_review_commentary" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trade_submissions_id" integer;
  ALTER TABLE "trade_submissions_moved_stops" ADD CONSTRAINT "trade_submissions_moved_stops_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_submissions_exits" ADD CONSTRAINT "trade_submissions_exits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_submissions_leos_review_stops" ADD CONSTRAINT "trade_submissions_leos_review_stops_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_submissions_leos_review_exits" ADD CONSTRAINT "trade_submissions_leos_review_exits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."trade_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "trade_submissions" ADD CONSTRAINT "trade_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "trade_submissions_moved_stops_order_idx" ON "trade_submissions_moved_stops" USING btree ("_order");
  CREATE INDEX "trade_submissions_moved_stops_parent_id_idx" ON "trade_submissions_moved_stops" USING btree ("_parent_id");
  CREATE INDEX "trade_submissions_exits_order_idx" ON "trade_submissions_exits" USING btree ("_order");
  CREATE INDEX "trade_submissions_exits_parent_id_idx" ON "trade_submissions_exits" USING btree ("_parent_id");
  CREATE INDEX "trade_submissions_leos_review_stops_order_idx" ON "trade_submissions_leos_review_stops" USING btree ("_order");
  CREATE INDEX "trade_submissions_leos_review_stops_parent_id_idx" ON "trade_submissions_leos_review_stops" USING btree ("_parent_id");
  CREATE INDEX "trade_submissions_leos_review_exits_order_idx" ON "trade_submissions_leos_review_exits" USING btree ("_order");
  CREATE INDEX "trade_submissions_leos_review_exits_parent_id_idx" ON "trade_submissions_leos_review_exits" USING btree ("_parent_id");
  CREATE INDEX "trade_submissions_user_idx" ON "trade_submissions" USING btree ("user_id");
  CREATE INDEX "trade_submissions_ticker_symbol_idx" ON "trade_submissions" USING btree ("ticker_symbol");
  CREATE INDEX "trade_submissions_review_status_idx" ON "trade_submissions" USING btree ("review_status");
  CREATE INDEX "trade_submissions_updated_at_idx" ON "trade_submissions" USING btree ("updated_at");
  CREATE INDEX "trade_submissions_created_at_idx" ON "trade_submissions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trade_submissions_fk" FOREIGN KEY ("trade_submissions_id") REFERENCES "public"."trade_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_trade_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("trade_submissions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "trade_submissions_moved_stops" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_submissions_exits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_submissions_leos_review_stops" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_submissions_leos_review_exits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trade_submissions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "trade_submissions_moved_stops" CASCADE;
  DROP TABLE "trade_submissions_exits" CASCADE;
  DROP TABLE "trade_submissions_leos_review_stops" CASCADE;
  DROP TABLE "trade_submissions_leos_review_exits" CASCADE;
  DROP TABLE "trade_submissions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_trade_submissions_fk";
  
  DROP INDEX "payload_locked_documents_rels_trade_submissions_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "trade_submissions_id";
  DROP TYPE "public"."enum_trade_submissions_trade_type";
  DROP TYPE "public"."enum_trade_submissions_review_status";
  DROP TYPE "public"."enum_trade_submissions_leos_review_would_trade";`)
}
