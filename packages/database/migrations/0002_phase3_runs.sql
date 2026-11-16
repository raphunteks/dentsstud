ALTER TABLE "production_runs" ADD COLUMN "sequence" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "production_runs" ADD COLUMN "topic" text;--> statement-breakpoint
ALTER TABLE "production_runs" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "production_runs" ADD COLUMN "render_job_id" uuid;--> statement-breakpoint
ALTER TABLE "production_runs" ADD COLUMN "result_id" uuid;--> statement-breakpoint
ALTER TABLE "production_runs" ADD COLUMN "kind" varchar(20) DEFAULT 'PRODUCTION' NOT NULL;