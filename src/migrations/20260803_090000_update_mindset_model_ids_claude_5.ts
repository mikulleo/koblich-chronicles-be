import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Moves the mindset AI config onto the Claude 5 generation (claude-sonnet-5 /
// claude-opus-5). The Payload config was updated first; this migration recreates
// the Postgres enum and remaps the stored value so the saved global stays valid.
//
// Also bumps ai_config_max_tokens from the old 1500 default: Claude 5 models think
// by default and thinking tokens count against max_tokens, so 1500 risks truncating
// the JSON answer. Only rows still sitting on the old default are touched — a value
// the user tuned themselves is left alone.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" DROP DEFAULT;

    CREATE TYPE "public"."enum_mindset_config_ai_config_model_new" AS ENUM('claude-sonnet-5', 'claude-opus-5');

    ALTER TABLE "mindset_config"
      ALTER COLUMN "ai_config_model" TYPE "public"."enum_mindset_config_ai_config_model_new"
      USING (
        CASE "ai_config_model"::text
          WHEN 'claude-opus-4-8' THEN 'claude-opus-5'
          ELSE 'claude-sonnet-5'
        END::"public"."enum_mindset_config_ai_config_model_new"
      );

    DROP TYPE "public"."enum_mindset_config_ai_config_model";
    ALTER TYPE "public"."enum_mindset_config_ai_config_model_new" RENAME TO "enum_mindset_config_ai_config_model";

    ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DEFAULT 'claude-sonnet-5';

    UPDATE "mindset_config" SET "ai_config_max_tokens" = 4000 WHERE "ai_config_max_tokens" = 1500;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" DROP DEFAULT;

    CREATE TYPE "public"."enum_mindset_config_ai_config_model_old" AS ENUM('claude-sonnet-4-6', 'claude-opus-4-8');

    ALTER TABLE "mindset_config"
      ALTER COLUMN "ai_config_model" TYPE "public"."enum_mindset_config_ai_config_model_old"
      USING (
        CASE "ai_config_model"::text
          WHEN 'claude-opus-5' THEN 'claude-opus-4-8'
          ELSE 'claude-sonnet-4-6'
        END::"public"."enum_mindset_config_ai_config_model_old"
      );

    DROP TYPE "public"."enum_mindset_config_ai_config_model";
    ALTER TYPE "public"."enum_mindset_config_ai_config_model_old" RENAME TO "enum_mindset_config_ai_config_model";

    ALTER TABLE "mindset_config" ALTER COLUMN "ai_config_model" SET DEFAULT 'claude-sonnet-4-6';

    UPDATE "mindset_config" SET "ai_config_max_tokens" = 1500 WHERE "ai_config_max_tokens" = 4000;
  `)
}
