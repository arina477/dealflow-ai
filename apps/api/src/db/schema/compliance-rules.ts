import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users-roles';
import { workspaces } from './workspaces';

/**
 * Wave-5 compliance rules engine (B-2, task 0595a835).
 *
 * Four MUTABLE config tables:
 *   1. compliance_rules       — rule registry (blocklist/disclaimer/approval/jurisdiction)
 *   2. suppression_list       — email+domain suppression entries
 *   3. disclaimer_templates   — versioned, jurisdiction-scoped disclaimer bodies
 *   4. compliance_approvals   — per-resource approval snapshots with SoD role enforcement
 *
 * MUTABILITY NOTE:
 *   These tables are standard-DML (INSERT / UPDATE / DELETE all permitted to the app role).
 *   They are explicitly NOT subject to the immutability controls added for audit_log_entries
 *   (no REVOKE/GRANT restriction, no BEFORE UPDATE/DELETE trigger, no TRUNCATE guard).
 *   Their audit trail is provided by appending to the immutable audit_log_entries table
 *   inside every mutation transaction (responsibility of the B-2 backend / gate service).
 *
 * pgEnum declarations:
 *   - compliance_rule_type   — mirrors complianceRuleTypeEnum in packages/shared
 *   - suppression_match_type — mirrors suppressionMatchTypeEnum in packages/shared
 *   - approval_status        — mirrors approvalStatusEnum in packages/shared
 *
 * Additive-only — no existing table (users/roles/invites/app_meta/audit_log_entries)
 * is altered.
 */

// ---------------------------------------------------------------------------
// pgEnums
// ---------------------------------------------------------------------------

/**
 * compliance_rule_type — mirrors complianceRuleTypeEnum (packages/shared/src/compliance-rules.ts).
 * Keep in sync: adding a value here requires a matching entry in the shared Zod enum.
 */
export const complianceRuleTypePgEnum = pgEnum('compliance_rule_type', [
  'blocklist_check',
  'disclaimer_required',
  'approval_required',
  'jurisdiction_check',
]);

/**
 * suppression_match_type — mirrors suppressionMatchTypeEnum.
 * 'email' | 'domain' — values are stable and intentionally narrow.
 */
export const suppressionMatchTypePgEnum = pgEnum('suppression_match_type', ['email', 'domain']);

/**
 * approval_status — mirrors approvalStatusEnum.
 * 'approved' | 'revoked' — revocation is a soft-delete (row stays, status flips).
 */
export const approvalStatusPgEnum = pgEnum('approval_status', ['approved', 'revoked']);

// ---------------------------------------------------------------------------
// 1. compliance_rules
// ---------------------------------------------------------------------------

/**
 * compliance_rules — the rule registry.
 *
 * Each row defines one active compliance constraint that the gate evaluator
 * must check before allowing an outreach action to proceed.
 *
 * - rule_type: discriminator (see complianceRuleTypePgEnum).
 * - jurisdiction: ISO-3166 code or other label; NULL = global (applies to all).
 * - config: rule-type-specific parameters (validated by the CRUD service at write time).
 * - enabled: soft-toggle without deleting history.
 * - created_by: FK to users; SET NULL on user deletion (audit trail via audit_log_entries).
 * - updated_at: application-layer clock via Drizzle's .$onUpdateFn (first live use per
 *   databases.md convention). The DB column has no DEFAULT — it is NULL until the first
 *   UPDATE, mirroring the shared ComplianceRule schema (updatedAt: ...nullable()).
 */
export const complianceRules = pgTable(
  'compliance_rules',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    ruleType: complianceRuleTypePgEnum('rule_type').notNull(),

    /**
     * Jurisdiction this rule applies to.
     * NULL means the rule applies globally (no jurisdiction filter).
     */
    jurisdiction: text('jurisdiction'),

    /**
     * Rule-type-specific parameters stored as JSONB.
     * The gate evaluator and CRUD service validate the shape at runtime.
     */
    config: jsonb('config').notNull(),

    /** Soft-toggle — disabled rules are skipped by the gate evaluator. */
    enabled: boolean('enabled').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /** Nullable FK — if the creating user is deleted, the rule row is retained. */
    createdBy: uuid('created_by'),

    /**
     * Application-layer updated_at timestamp.
     * Drizzle sets this automatically on every UPDATE via .$onUpdateFn.
     * NULL until the first update (consistent with the shared schema's .nullable()).
     */
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),
    /** Wave-17 (task 0db154ff) — tenant boundary FK. RLS-enforced. */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'compliance_rules_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'compliance_rules_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),
    index('compliance_rules_workspace_id_idx').on(table.workspaceId),
  ]
);

// ---------------------------------------------------------------------------
// 2. suppression_list
// ---------------------------------------------------------------------------

/**
 * suppression_list — email and domain suppression entries.
 *
 * The gate's blocklist evaluator reads this table to determine whether
 * an outreach recipient must be suppressed before sending.
 *
 * - match_type: 'email' or 'domain' — discriminates lookup strategy.
 * - value: normalized lower-case email or domain suffix (normalization is the
 *   CRUD service's responsibility; the DB stores the already-normalized form).
 * - reason: optional human-readable justification (legal request, opt-out, etc.).
 * - created_by: nullable FK; SET NULL on user deletion.
 *
 * Index on (match_type, value): the gate's suppression evaluator looks up
 * entries by match_type + exact value. This composite index covers that query
 * directly and is the primary read path for the gate.
 */
export const suppressionList = pgTable(
  'suppression_list',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    matchType: suppressionMatchTypePgEnum('match_type').notNull(),

    /**
     * Normalized lower-case email address or domain suffix.
     * The CRUD service enforces normalization before INSERT.
     */
    value: text('value').notNull(),

    /** Optional reason for suppression — legal hold, opt-out request, etc. */
    reason: text('reason'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    createdBy: uuid('created_by'),

    /** Wave-17 (task 0db154ff) — tenant boundary FK. RLS-enforced. */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'suppression_list_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'suppression_list_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),
    /**
     * Gate suppression lookup index: (match_type, value).
     * Covers: SELECT * FROM suppression_list WHERE match_type = $1 AND value = $2
     */
    index('suppression_list_match_type_value_idx').on(table.matchType, table.value),
    index('suppression_list_workspace_id_idx').on(table.workspaceId),
  ]
);

// ---------------------------------------------------------------------------
// 3. disclaimer_templates
// ---------------------------------------------------------------------------

/**
 * disclaimer_templates — versioned, jurisdiction-scoped disclaimer bodies.
 *
 * Append-style versioning: an "edit" inserts a new row (version + 1) and
 * deactivates the prior row for that jurisdiction. The CRUD service enforces
 * this invariant — the schema merely supports multiple rows per jurisdiction
 * with different version numbers and an active flag.
 *
 * At any point in time at most one row per jurisdiction should have active=true.
 * The gate reads the active row for a given jurisdiction.
 *
 * - version: monotonically increasing integer per jurisdiction (managed by CRUD service).
 * - active: false on all historical versions; true on the current version only.
 * - created_by: nullable FK; SET NULL on user deletion.
 *
 * Index on (jurisdiction, active): the gate looks up the active disclaimer for a
 * given jurisdiction. This index covers that query.
 */
export const disclaimerTemplates = pgTable(
  'disclaimer_templates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** ISO-3166 or other jurisdiction label; required (no global disclaimer rows). */
    jurisdiction: text('jurisdiction').notNull(),

    /** Full disclaimer text body — rendered into outreach content by the gate. */
    body: text('body').notNull(),

    /**
     * Monotonically increasing version number per jurisdiction.
     * The CRUD service queries MAX(version) per jurisdiction and increments.
     */
    version: integer('version').notNull(),

    /**
     * true = current active version for this jurisdiction.
     * The CRUD service flips this to false on the prior version when inserting
     * a new one. Schema supports multiple rows; enforcement is application-layer.
     */
    active: boolean('active').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    createdBy: uuid('created_by'),

    /** Wave-17 (task 0db154ff) — tenant boundary FK. RLS-enforced. */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'disclaimer_templates_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'disclaimer_templates_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),
    /**
     * Gate disclaimer lookup index: (jurisdiction, active).
     * Covers: SELECT * FROM disclaimer_templates WHERE jurisdiction = $1 AND active = true
     */
    index('disclaimer_templates_jurisdiction_active_idx').on(table.jurisdiction, table.active),
    index('disclaimer_templates_workspace_id_idx').on(table.workspaceId),
  ]
);

// ---------------------------------------------------------------------------
// 4. compliance_approvals
// ---------------------------------------------------------------------------

/**
 * compliance_approvals — per-resource compliance approval snapshots.
 *
 * Written by the compliance role via an approve endpoint.
 * The gate's SoD evaluator reads this table server-side to confirm a valid
 * active approval exists before permitting a send.
 *
 * SoD constraint (column-level note):
 *   approver_role is unconstrained text at the DB level — any role name can be
 *   stored. The gate's SoD evaluator ONLY accepts approver_role = 'compliance'
 *   (admin is excluded per security.md §RBAC-SoD). That business logic lives in
 *   the B-2 gate/evaluator, not in a DB CHECK constraint, so the column stays
 *   unconstrained for forward-compatibility.
 *
 * - resource_type / resource_id: identifies the approved object (e.g. 'outreach', '<uuid>').
 * - content_hash: SHA-256 hex of the content at approval time. The gate recomputes
 *   and compares; any post-approval edit invalidates the approval.
 * - approver_user_id: nullable FK; SET NULL on user deletion. The approver_role
 *   snapshot is retained regardless.
 * - approver_role: role snapshot at approval time (NOT a live FK to roles).
 * - status: 'approved' | 'revoked'. Revocation is a DML UPDATE (SET status='revoked')
 *   — hence MUTABLE; the audit trail is via audit_log_entries.
 *
 * Index on (resource_type, resource_id): the gate looks up the active approval for
 * a given resource. Covers: WHERE resource_type = $1 AND resource_id = $2 AND status = 'approved'
 */
export const complianceApprovals = pgTable(
  'compliance_approvals',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** Audited object type (e.g. 'outreach', 'mandate'). */
    resourceType: text('resource_type').notNull(),

    /** Audited object id (UUID or other identifier as text). */
    resourceId: text('resource_id').notNull(),

    /**
     * SHA-256 hex (64 chars) of the content at approval time.
     * Gate recomputes and compares on every send attempt; mismatch = stale approval.
     */
    contentHash: text('content_hash').notNull(),

    /**
     * Nullable FK to users — if the approver's account is deleted the approval
     * record is retained (SET NULL) with the role snapshot preserved.
     */
    approverUserId: uuid('approver_user_id'),

    /**
     * Role snapshot at approval time. The B-2 gate SoD evaluator ONLY accepts
     * 'compliance' here; any other value is treated as an invalid approval.
     * Stored as unconstrained text for forward-compatibility.
     */
    approverRole: text('approver_role').notNull(),

    status: approvalStatusPgEnum('status').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /** Wave-17 (task 0db154ff) — tenant boundary FK. RLS-enforced. */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'compliance_approvals_approver_user_id_fk',
      columns: [table.approverUserId],
      foreignColumns: [users.id],
    }).onDelete('set null'),
    foreignKey({
      name: 'compliance_approvals_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),
    /**
     * Gate approval lookup index: (resource_type, resource_id).
     * Covers: WHERE resource_type = $1 AND resource_id = $2 [AND status = 'approved']
     */
    index('compliance_approvals_resource_type_resource_id_idx').on(
      table.resourceType,
      table.resourceId
    ),
    index('compliance_approvals_workspace_id_idx').on(table.workspaceId),
  ]
);
