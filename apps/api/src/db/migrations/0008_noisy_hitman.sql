CREATE TYPE "public"."buyer_universe_candidate_membership_status" AS ENUM('candidate', 'included', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."buyer_universe_status" AS ENUM('draft', 'filtered', 'submitted');--> statement-breakpoint
CREATE TABLE "buyer_universe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"status" "buyer_universe_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "buyer_universe_mandate_id_unique" UNIQUE("mandate_id")
);
--> statement-breakpoint
CREATE TABLE "buyer_universe_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_universe_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"membership_status" "buyer_universe_candidate_membership_status" DEFAULT 'candidate' NOT NULL,
	"provenance" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_universe_candidates_universe_company_unique" UNIQUE("buyer_universe_id","company_id")
);
--> statement-breakpoint
ALTER TABLE "buyer_universe" ADD CONSTRAINT "buyer_universe_mandate_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_universe" ADD CONSTRAINT "buyer_universe_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_universe_candidates" ADD CONSTRAINT "buyer_universe_candidates_buyer_universe_id_fk" FOREIGN KEY ("buyer_universe_id") REFERENCES "public"."buyer_universe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyer_universe_candidates" ADD CONSTRAINT "buyer_universe_candidates_company_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "buyer_universe_mandate_id_idx" ON "buyer_universe" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "buyer_universe_status_idx" ON "buyer_universe" USING btree ("status");--> statement-breakpoint
CREATE INDEX "buyer_universe_candidates_universe_id_idx" ON "buyer_universe_candidates" USING btree ("buyer_universe_id");--> statement-breakpoint
CREATE INDEX "buyer_universe_candidates_status_idx" ON "buyer_universe_candidates" USING btree ("buyer_universe_id","membership_status");