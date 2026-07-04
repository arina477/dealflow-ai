CREATE TYPE "public"."match_candidate_disposition" AS ENUM('pending', 'accepted', 'rejected', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."match_run_status" AS ENUM('pending', 'scored');--> statement-breakpoint
CREATE TABLE "match_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_run_id" uuid NOT NULL,
	"buyer_universe_candidate_id" uuid NOT NULL,
	"fit_score" integer NOT NULL,
	"score_breakdown" jsonb,
	"disposition" "match_candidate_disposition" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_candidates_fit_score_check" CHECK (fit_score >= 0 AND fit_score <= 100)
);
--> statement-breakpoint
CREATE TABLE "match_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"buyer_universe_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"status" "match_run_status" DEFAULT 'pending' NOT NULL,
	"ready_for_outreach" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "match_run_buyer_universe_id_unique" UNIQUE("buyer_universe_id")
);
--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_match_run_id_fk" FOREIGN KEY ("match_run_id") REFERENCES "public"."match_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_candidates" ADD CONSTRAINT "match_candidates_buyer_universe_candidate_id_fk" FOREIGN KEY ("buyer_universe_candidate_id") REFERENCES "public"."buyer_universe_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_run" ADD CONSTRAINT "match_run_mandate_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_run" ADD CONSTRAINT "match_run_buyer_universe_id_fk" FOREIGN KEY ("buyer_universe_id") REFERENCES "public"."buyer_universe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_run" ADD CONSTRAINT "match_run_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_candidates_run_id_idx" ON "match_candidates" USING btree ("match_run_id");--> statement-breakpoint
CREATE INDEX "match_candidates_run_disposition_idx" ON "match_candidates" USING btree ("match_run_id","disposition");--> statement-breakpoint
CREATE INDEX "match_run_mandate_id_idx" ON "match_run" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "match_run_buyer_universe_id_idx" ON "match_run" USING btree ("buyer_universe_id");--> statement-breakpoint
CREATE INDEX "match_run_status_idx" ON "match_run" USING btree ("status");