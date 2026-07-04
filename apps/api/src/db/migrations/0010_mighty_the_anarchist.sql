CREATE TYPE "public"."outreach_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."outreach_status" AS ENUM('compose', 'send_eligible', 'blocked');--> statement-breakpoint
CREATE TABLE "outreach" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandate_id" uuid NOT NULL,
	"match_candidate_id" uuid NOT NULL,
	"template_version_id" uuid NOT NULL,
	"gate_verdict" jsonb NOT NULL,
	"status" "outreach_status" DEFAULT 'compose' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_template_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"disclaimer_template_id" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"approval_status" "outreach_approval_status" DEFAULT 'pending' NOT NULL,
	"approved_content_hash" text,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outreach_template_versions_template_version_unique" UNIQUE("template_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "outreach_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mandate_scope" text,
	"owner_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_mandate_id_fk" FOREIGN KEY ("mandate_id") REFERENCES "public"."mandates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_match_candidate_id_fk" FOREIGN KEY ("match_candidate_id") REFERENCES "public"."match_candidates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_template_version_id_fk" FOREIGN KEY ("template_version_id") REFERENCES "public"."outreach_template_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach" ADD CONSTRAINT "outreach_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_template_versions" ADD CONSTRAINT "outreach_template_versions_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."outreach_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_template_versions" ADD CONSTRAINT "outreach_template_versions_disclaimer_template_id_fk" FOREIGN KEY ("disclaimer_template_id") REFERENCES "public"."disclaimer_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_template_versions" ADD CONSTRAINT "outreach_template_versions_approved_by_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_templates" ADD CONSTRAINT "outreach_templates_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_mandate_id_idx" ON "outreach" USING btree ("mandate_id");--> statement-breakpoint
CREATE INDEX "outreach_status_idx" ON "outreach" USING btree ("status");--> statement-breakpoint
CREATE INDEX "outreach_created_by_idx" ON "outreach" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "outreach_template_versions_template_id_idx" ON "outreach_template_versions" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "outreach_template_versions_approval_status_idx" ON "outreach_template_versions" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "outreach_templates_owner_id_idx" ON "outreach_templates" USING btree ("owner_id");