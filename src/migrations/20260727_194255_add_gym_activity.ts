import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_gym_activity_source" AS ENUM('trade', 'submission');
  CREATE TABLE "gym_activity" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"source" "enum_gym_activity_source" DEFAULT 'trade' NOT NULL,
  	"ref_id" varchar NOT NULL,
  	"completed" boolean DEFAULT false,
  	"first_completion" boolean DEFAULT false,
  	"duration_seconds" numeric DEFAULT 0 NOT NULL,
  	"points" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "gym_activity_id" integer;
  ALTER TABLE "gym_activity" ADD CONSTRAINT "gym_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "gym_activity_user_idx" ON "gym_activity" USING btree ("user_id");
  CREATE INDEX "gym_activity_ref_id_idx" ON "gym_activity" USING btree ("ref_id");
  CREATE INDEX "gym_activity_updated_at_idx" ON "gym_activity" USING btree ("updated_at");
  CREATE INDEX "gym_activity_created_at_idx" ON "gym_activity" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_gym_activity_fk" FOREIGN KEY ("gym_activity_id") REFERENCES "public"."gym_activity"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_gym_activity_id_idx" ON "payload_locked_documents_rels" USING btree ("gym_activity_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "gym_activity" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "gym_activity" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_gym_activity_fk";
  
  DROP INDEX "payload_locked_documents_rels_gym_activity_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "gym_activity_id";
  DROP TYPE "public"."enum_gym_activity_source";`)
}
