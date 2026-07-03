CREATE TYPE "public"."approval_status" AS ENUM('approved', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."compliance_rule_type" AS ENUM('blocklist_check', 'disclaimer_required', 'approval_required', 'jurisdiction_check');--> statement-breakpoint
CREATE TYPE "public"."suppression_match_type" AS ENUM('email', 'domain');--> statement-breakpoint
CREATE TABLE "compliance_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"approver_user_id" uuid,
	"approver_role" text NOT NULL,
	"status" "approval_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_type" "compliance_rule_type" NOT NULL,
	"jurisdiction" text,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "disclaimer_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction" text NOT NULL,
	"body" text NOT NULL,
	"version" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "suppression_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_type" "suppression_match_type" NOT NULL,
	"value" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "compliance_approvals" ADD CONSTRAINT "compliance_approvals_approver_user_id_fk" FOREIGN KEY ("approver_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_rules" ADD CONSTRAINT "compliance_rules_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclaimer_templates" ADD CONSTRAINT "disclaimer_templates_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppression_list" ADD CONSTRAINT "suppression_list_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_approvals_resource_type_resource_id_idx" ON "compliance_approvals" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "disclaimer_templates_jurisdiction_active_idx" ON "disclaimer_templates" USING btree ("jurisdiction","active");--> statement-breakpoint
CREATE INDEX "suppression_list_match_type_value_idx" ON "suppression_list" USING btree ("match_type","value");