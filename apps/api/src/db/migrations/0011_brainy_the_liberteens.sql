CREATE TYPE "public"."pipeline_event_type" AS ENUM('enrolled', 'stage_changed', 'note');--> statement-breakpoint
CREATE TYPE "public"."pipeline_stage" AS ENUM('shortlisted', 'contacted', 'engaged', 'diligence', 'offer', 'closed', 'withdrawn');--> statement-breakpoint
CREATE TABLE "pipeline" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"deal_source_type" text NOT NULL,
	"outreach_id" uuid,
	"match_candidate_id" uuid,
	"stage" "pipeline_stage" DEFAULT 'shortlisted' NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "pipeline_deal_target_xor_check" CHECK ((outreach_id IS NOT NULL AND match_candidate_id IS NULL) OR (outreach_id IS NULL AND match_candidate_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "pipeline_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" uuid NOT NULL,
	"event_type" "pipeline_event_type" NOT NULL,
	"from_stage" "pipeline_stage",
	"to_stage" "pipeline_stage",
	"note" text,
	"actor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_mandate_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_outreach_id_fk" FOREIGN KEY ("outreach_id") REFERENCES "public"."outreach"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_match_candidate_id_fk" FOREIGN KEY ("match_candidate_id") REFERENCES "public"."match_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline" ADD CONSTRAINT "pipeline_updated_by_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_pipeline_id_fk" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipeline"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_events" ADD CONSTRAINT "pipeline_events_actor_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_outreach_id_unique_idx" ON "pipeline" USING btree ("outreach_id") WHERE outreach_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_match_candidate_id_unique_idx" ON "pipeline" USING btree ("match_candidate_id") WHERE match_candidate_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pipeline_mandate_id_idx" ON "pipeline" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "pipeline_mandate_stage_idx" ON "pipeline" USING btree ("mandate_id","stage");--> statement-breakpoint
CREATE INDEX "pipeline_created_by_idx" ON "pipeline" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "pipeline_events_pipeline_id_created_at_idx" ON "pipeline_events" USING btree ("pipeline_id","created_at");