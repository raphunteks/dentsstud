CREATE TABLE "member_tts_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(60) NOT NULL,
	"status" varchar(24) NOT NULL,
	"credential_ref" text,
	"credential_hint" varchar(32),
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_error" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "member_tts_accounts_uq" UNIQUE("user_id","provider"),
	CONSTRAINT "member_tts_accounts_provider_check" CHECK ("provider" IN ('gemini','elevenlabs','cadangan'))
);
--> statement-breakpoint
ALTER TABLE "tts_provider_configs" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "tts_provider_configs" ADD COLUMN "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tts_provider_configs" ADD COLUMN "last_status" varchar(24);--> statement-breakpoint
ALTER TABLE "member_tts_accounts" ADD CONSTRAINT "member_tts_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;