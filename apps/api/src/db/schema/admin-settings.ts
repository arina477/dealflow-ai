import { sql } from 'drizzle-orm';
import { foreignKey, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { disclaimerTemplates } from './compliance-rules';
import { users } from './users-roles';
import { workspaces } from './workspaces';

/**
 * Wave-15 admin settings data model (B-0, tasks 648a86a6 + 41c017f7).
 *
 * workspace_settings — single-row-per-firm firm profile + default compliance profile.
 *   Uniqueness is enforced by the application (upsert semantics — one row, always the same id).
 *   The firm_id column is the row identity; application code uses a known constant or
 *   selects the first (and only) row.
 *
 * Design constraints:
 *   - Single-row per firm: no multi-tenancy at this stage.
 *   - default_disclaimer_template_id → FK into disclaimer_templates (nullable — may not be set).
 *   - Default compliance cascade: new mandates inherit default_jurisdiction +
 *     default_disclaimer_template_id + default_suppression_scope via MandateService.
 *   - No retroactive mutation of existing mandates when defaults change.
 *   - All mutations are audited LAST-IN-TXN via AuditService.append.
 *
 * Additive-only — no existing table is altered in this file.
 */

// ---------------------------------------------------------------------------
// workspace_settings
// ---------------------------------------------------------------------------

export const workspaceSettings = pgTable(
  'workspace_settings',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    // ── Firm profile fields ──────────────────────────────────────────────────

    /** Legal name of the firm (e.g. 'Acme Capital Management LLC'). */
    firmName: text('firm_name'),

    /** Registered address — plain text for now (no sub-field structure). */
    firmAddress: text('firm_address'),

    /**
     * Regulatory identifier(s) — e.g. CRD number, FINRA member ID.
     * Plain text; may contain a comma-delimited list of identifiers.
     * Future waves can decompose into structured columns if needed.
     */
    regulatoryIds: text('regulatory_ids'),

    /** Primary contact person full name. */
    primaryContactName: text('primary_contact_name'),

    /** Primary contact email address. */
    primaryContactEmail: text('primary_contact_email'),

    // ── Default compliance profile fields ────────────────────────────────────

    /**
     * Default jurisdiction for new mandates (ISO-3166 or other label).
     * New mandates inherit this value via MandateService when set.
     * NULL = no firm-level default (mandate must specify its own).
     */
    defaultJurisdiction: text('default_jurisdiction'),

    /**
     * FK → disclaimer_templates.id — the active disclaimer template that new
     * mandates inherit by default. The gate reads the active template for the
     * mandate's jurisdiction; this is the firm-level selector seed.
     * NULL = no firm-level default.
     */
    defaultDisclaimerTemplateId: uuid('default_disclaimer_template_id'),

    /**
     * Default suppression scope for new mandates.
     * Mirrors the suppression_scope concept from mandate_compliance_profile.
     * 'firm' = apply the firm's full suppression list to all outreach.
     * 'mandate' = only mandate-specific suppressions apply (no firm override).
     * NULL = no firm-level default.
     */
    defaultSuppressionScope: text('default_suppression_scope'),

    // ── Metadata ─────────────────────────────────────────────────────────────

    /** Nullable FK — row survives if the creating user is deleted. */
    createdBy: uuid('created_by'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),

    /**
     * Wave-17 (task 0db154ff) — tenant boundary FK. RLS-enforced.
     * workspace_settings is a singleton per firm; this FK scopes it to its workspace.
     */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'workspace_settings_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),

    foreignKey({
      name: 'workspace_settings_default_disclaimer_template_id_fk',
      columns: [table.defaultDisclaimerTemplateId],
      foreignColumns: [disclaimerTemplates.id],
    }).onDelete('set null'),

    foreignKey({
      name: 'workspace_settings_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),

    index('workspace_settings_workspace_id_idx').on(table.workspaceId),
  ]
);
