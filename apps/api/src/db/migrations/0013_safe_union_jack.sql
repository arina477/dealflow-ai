CREATE TABLE "workspace_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"firm_name" text,
	"firm_address" text,
	"regulatory_ids" text,
	"primary_contact_name" text,
	"primary_contact_email" text,
	"default_jurisdiction" text,
	"default_disclaimer_template_id" uuid,
	"default_suppression_scope" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "data_source_connections" ADD COLUMN "encrypted_credentials" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_created_by_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_default_disclaimer_template_id_fk" FOREIGN KEY ("default_disclaimer_template_id") REFERENCES "public"."disclaimer_templates"("id") ON DELETE set null ON UPDATE no action;