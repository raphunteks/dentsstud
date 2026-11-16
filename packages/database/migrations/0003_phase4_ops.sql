CREATE TABLE "error_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"source" varchar(20) NOT NULL,
	"message" text NOT NULL,
	"stack" text,
	"context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"user_id" uuid,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"status" varchar(24) NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "error_reports_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
ALTER TABLE "app_releases" ADD COLUMN "filename" varchar(255) DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_releases" ADD COLUMN "size_bytes" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app_releases" ADD COLUMN "sha512" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "error_reports" ADD CONSTRAINT "error_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "error_reports_status_last_idx" ON "error_reports" USING btree ("status","last_seen_at");--> statement-breakpoint
CREATE INDEX "production_runs_user_created_idx" ON "production_runs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "production_runs_order_idx" ON "production_runs" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "video_results_run_idx" ON "video_results" USING btree ("run_id");