CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"invited_by" uuid,
	"role_id" uuid NOT NULL,
	"expiry" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supertokens_user_id" text NOT NULL,
	"email" text NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_supertokens_user_id_unique" UNIQUE("supertokens_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_unconsumed_idx" ON "invites" USING btree ("token") WHERE consumed_at IS NULL;--> statement-breakpoint
CREATE INDEX "users_supertokens_user_id_idx" ON "users" USING btree ("supertokens_user_id");
--> statement-breakpoint
-- Seed: exactly 4 roles required by spec (task e15f71dd AC: "roles table is seeded
-- with exactly four roles - advisor, analyst, compliance, admin - all present from
-- first migration"). ON CONFLICT DO NOTHING makes re-runs idempotent.
INSERT INTO "roles" ("name") VALUES
  ('advisor'),
  ('analyst'),
  ('compliance'),
  ('admin')
ON CONFLICT ("name") DO NOTHING;