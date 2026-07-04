CREATE TYPE "public"."mandate_status" AS ENUM('draft', 'active');--> statement-breakpoint
CREATE TABLE "mandate_buyer_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"industry" text,
	"geo" text,
	"size_band" text,
	"deal_type" text
);
--> statement-breakpoint
CREATE TABLE "mandate_compliance_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"jurisdiction" text NOT NULL,
	"disclaimer_template_id" uuid NOT NULL,
	"suppression_scope" jsonb,
	"lawful_authorization" boolean DEFAULT false NOT NULL,
	"ai_results_validated" boolean DEFAULT false NOT NULL,
	"conflict_dbs_reviewed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "mandate_compliance_profile_mandate_id_unique" UNIQUE("mandate_id")
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by" uuid NOT NULL,
	"seller_name" text NOT NULL,
	"seller_industry" text,
	"seller_geo" text[],
	"seller_size_band" text,
	"description" text,
	"deal_type" text,
	"status" "mandate_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "mandate_buyer_criteria" ADD CONSTRAINT "mandate_buyer_criteria_mandate_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandate_compliance_profile" ADD CONSTRAINT "mandate_compliance_profile_mandate_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandate_compliance_profile" ADD CONSTRAINT "mandate_compliance_profile_disclaimer_template_id_fk" FOREIGN KEY ("disclaimer_template_id") REFERENCES "public"."disclaimer_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mandate_buyer_criteria_mandate_id_idx" ON "mandate_buyer_criteria" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "mandates_status_created_at_idx" ON "mandates" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "mandates_created_by_idx" ON "mandates" USING btree ("created_by");