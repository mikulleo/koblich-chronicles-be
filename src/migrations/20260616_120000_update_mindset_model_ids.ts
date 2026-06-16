import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Claude Sonnet 4 (claude-sonnet-4-20250514) and Opus 4 (claude-opus-4-20250514)
// were retired on 2026-06-15 and now return 404 from the Anthropic API. The Payload
// config was already updated to the replacement IDs (claude-sonnet-4-6 / claude-opus-4-8),
// but the Postgres enum and the stored mindset_config value still referenced the old IDs.
// This migration recreates the enum with the new values and remaps any stored value.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" DROP DEFAULT;

    CREATE TYPE "public"."enum_mindset_config_ai_config_model_new" AS ENUM('claude-sonnet-4-6', 'claude-opus-4-8');

    ALTER TABLE "mindset_config"
      ALTER COLUMN "ai_config_model" TYPE "public"."enum_mindset_config_ai_config_model_new"
      USING (
        CASE "ai_config_model"::text
          WHEN 'claude-opus-4-20250514' THEN 'claude-opus-4-8'
          ELSE 'claude-sonnet-4-6'
        END::"public"."enum_mindset_config_ai_config_model_new"
      );

    DROP TYPE "public"."enum_mindset_config_ai_config_model";
    ALTER TYPE "public"."enum_mindset_config_ai_config_model_new" RENAME TO "enum_mindset_config_ai_config_model";

    ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DEFAULT 'claude-sonnet-4-6';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" DROP DEFAULT;

    CREATE TYPE "public"."enum_mindset_config_ai_config_model_old" AS ENUM('claude-sonnet-4-20250514', 'claude-opus-4-20250514');

    ALTER TABLE "mindset_config"
      ALTER COLUMN "ai_config_model" TYPE "public"."enum_mindset_config_ai_config_model_old"
      USING (
        CASE "ai_config_model"::text
          WHEN 'claude-opus-4-8' THEN 'claude-opus-4-20250514'
          ELSE 'claude-sonnet-4-20250514'
        END::"public"."enum_mindset_config_ai_config_model_old"
      );

    DROP TYPE "public"."enum_mindset_config_ai_config_model";
    ALTER TYPE "public"."enum_mindset_config_ai_config_model_old" RENAME TO "enum_mindset_config_ai_config_model";

    ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DEFAULT 'claude-sonnet-4-20250514';
  `)
}
