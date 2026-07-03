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
-- =============================================================================
-- HAND-APPENDED: partial unique indexes for DB-enforced uniqueness constraints
-- (drizzle-kit cannot emit partial indexes — following the 0002_steep_boom_boom.sql
-- hand-append precedent).
--
-- Wave-5, B-6 CRITICAL-2 concurrency fix. Refs: 034463b1, 34cb1d18.
--
-- Index 1 — disclaimer_templates: at most ONE active disclaimer per jurisdiction.
--   Without this, two concurrent createDisclaimer/updateDisclaimer calls for the
--   same jurisdiction (READ COMMITTED, no row lock) both read max(version)=N,
--   both deactivate prior rows, and both INSERT version=N+1 active=true — leaving
--   TWO active rows. The gate's .orderBy(version DESC).limit(1) then binds
--   ambiguously; a required disclaimer can be silently evaded.
--   The partial unique index makes the second concurrent INSERT fail with
--   SQLSTATE 23505 (unique_violation), which the service's advisory lock prevents
--   from arising in normal operation (the lock serializes per-jurisdiction) and
--   which the catch path surfaces as a clean error if the lock is somehow bypassed.
--
-- Index 2 — compliance_approvals: at most ONE approved approval per resource.
--   Enforces the gate's "latest approved row" assumption at the DB layer, not just
--   ORDER BY. A second INSERT with status='approved' for the same (resource_type,
--   resource_id) fails immediately. Any approval-creation path (M6) MUST revoke
--   the prior approved row (UPDATE status='revoked') before inserting a new
--   approved one. The existing gate lookup (loadApproval → orderBy createdAt DESC
--   limit 1) continues to work: it reads the single approved row (or the most
--   recent revoked row when none is approved).
--
-- Index 3 — suppression_list: no duplicate (match_type, value) pairs.
--   value is already lowercased by the CRUD service before INSERT; this index
--   provides a DB-level backstop so two concurrent suppression inserts for the
--   same (type, value) pair cannot both succeed (second fails with 23505).
-- =============================================================================

--> statement-breakpoint
-- Index 1: one active disclaimer per jurisdiction.
CREATE UNIQUE INDEX "disclaimer_templates_jurisdiction_active_unique"
  ON "disclaimer_templates" ("jurisdiction")
  WHERE active = true;
--> statement-breakpoint
-- Index 2: one approved approval per (resource_type, resource_id).
CREATE UNIQUE INDEX "compliance_approvals_resource_approved_unique"
  ON "compliance_approvals" ("resource_type", "resource_id")
  WHERE status = 'approved';
--> statement-breakpoint
-- Index 3: no duplicate suppression entries by (match_type, value).
CREATE UNIQUE INDEX "suppression_list_match_type_value_unique"
  ON "suppression_list" ("match_type", "value");