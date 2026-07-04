import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { disclaimerTemplates } from './compliance-rules';
import { mandates } from './mandate';
import { matchCandidates } from './matching';
import { users } from './users-roles';

/**
 * Wave-11 outreach spine (B-0, task 102a2f00).
 *
 * Three MUTABLE tables:
 *   1. outreach_templates         — named template containers (per owner)
 *   2. outreach_template_versions — append-style versioned content + approval state
 *   3. outreach                   — composed outreach records with gate verdict
 *
 * COMPLIANCE INVARIANTS (all three must be server-enforced — load-bearing):
 *   VERSION-BINDING:
 *     approval_status = 'approved' AND approved_content_hash = current content_hash
 *     → isUsableForSend(version) === true (service predicate). A post-approval
 *     draft creates a new version row whose approved_content_hash is initially NULL
 *     → isUsableForSend false until re-approved.
 *   NON-BYPASSABLE GATE:
 *     OutreachService.composeAsActor ALWAYS calls ComplianceGateService.evaluate(ctx, tx).
 *     There is NO code path that sets outreach.status = 'send_eligible' without a
 *     passing evaluate() verdict. This is structural — not a convention.
 *   SoD (outreach-composer ≠ template-approver):
 *     At compose time, actor.id !== templateVersion.approvedBy → blocked.
 *     ApprovalService.grantApproval is compliance-role ONLY (advisor 403).
 *
 * ENUM NAMING:
 *   outreach_approval_status — DISTINCT from the M2 'approval_status' enum
 *   (which is [approved|revoked] for compliance_approvals). This enum covers
 *   [pending|approved|rejected] for template version lifecycle. Postgres type
 *   namespace collision is avoided by the distinct name.
 *
 * HARD BOUNDARY (CRITICAL):
 *   NO Anthropic/Claude/LLM import or call anywhere in this module.
 *   NO transactional-email SDK (nodemailer/sendgrid/postmark/resend/ses).
 *   NO send call. outreach.status = 'send_eligible' is the pre-send gate product;
 *   actual email send is a deferred M6+ bundle.
 *
 * Additive-only — no existing table is altered.
 */

// ---------------------------------------------------------------------------
// pgEnum: outreach_approval_status
//
// DISTINCT NAME — do NOT reuse 'approval_status' (the M2 [approved|revoked]
// enum on compliance_approvals). Postgres pgEnum types are cluster-scoped;
// a duplicate name would be a type collision at migration apply time.
// karen note: enum must be named 'outreach_approval_status' exactly.
// ---------------------------------------------------------------------------

/**
 * outreach_approval_status — lifecycle of a template version's approval.
 *   pending  — default on creation; awaiting compliance review.
 *   approved — compliance granted; approved_content_hash is set.
 *   rejected — compliance rejected; version is not usable.
 *
 * Values differ from the M2 approval_status ('approved' | 'revoked') to
 * accurately model the template-version lifecycle (pending/approved/rejected
 * vs approved/revoked for resource-level compliance_approvals).
 */
export const outreachApprovalStatusPgEnum = pgEnum('outreach_approval_status', [
  'pending',
  'approved',
  'rejected',
]);

// ---------------------------------------------------------------------------
// pgEnum: outreach_status
// ---------------------------------------------------------------------------

/**
 * outreach_status — lifecycle of a composed outreach record.
 *   compose       — default on creation; gate has not yet been run (should
 *                   not normally persist; compose ALWAYS runs the gate).
 *   send_eligible — gate passed (allowed:true); outreach may proceed to send.
 *   blocked       — gate failed (allowed:false); blocked by one or more
 *                   evaluators. The gate_verdict jsonb contains the block reasons.
 *
 * CRITICAL: 'send_eligible' is ONLY set by OutreachService.composeAsActor
 * AFTER ComplianceGateService.evaluate() returns allowed:true. There is no
 * other code path that sets this status — the gate is structurally non-bypassable.
 */
export const outreachStatusPgEnum = pgEnum('outreach_status', [
  'compose',
  'send_eligible',
  'blocked',
]);

// ---------------------------------------------------------------------------
// 1. outreach_templates
// ---------------------------------------------------------------------------

/**
 * outreach_templates — named template containers.
 *
 * Each row is a named template shell. Versioned content lives in
 * outreach_template_versions (1:N; append-only).
 *
 * - name: human-readable template name.
 * - mandate_scope: optional — links template to a specific mandate (uuid) or
 *   a scope descriptor (text). NULL = firm-wide template. Stored as text
 *   so it can hold either a UUID or a descriptive label without an FK
 *   constraint (the scope is advisory, not referential).
 * - owner_id: FK → users.id (SET NULL on user deletion — template persists).
 * - created_at/updated_at: standard timestamps.
 */
export const outreachTemplates = pgTable(
  'outreach_templates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** Human-readable template name. */
    name: text('name').notNull(),

    /**
     * Optional scope — a mandate UUID or a descriptive label.
     * NULL = firm-wide template (not scoped to a specific mandate).
     * Stored as text (not a FK) so advisors can also supply descriptive scopes.
     */
    mandateScope: text('mandate_scope'),

    /**
     * FK → users.id — the owner (advisor/analyst) who created this template.
     * SET NULL on user deletion — the template persists after the owner leaves.
     */
    ownerId: uuid('owner_id'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),
  },
  (table) => [
    foreignKey({
      name: 'outreach_templates_owner_id_fk',
      columns: [table.ownerId],
      foreignColumns: [users.id],
    }).onDelete('set null'),

    /** Owner-scoped listing: WHERE owner_id = $1. */
    index('outreach_templates_owner_id_idx').on(table.ownerId),
  ]
);

// ---------------------------------------------------------------------------
// 2. outreach_template_versions
// ---------------------------------------------------------------------------

/**
 * outreach_template_versions — append-style versioned content.
 *
 * An "edit" of an approved version MUST always produce a NEW row (version_number
 * + 1 via TemplateService.draftNewVersion). Approved versions are IMMUTABLE —
 * the service must never UPDATE an approved version row in place. This is the
 * append-style versioning invariant enforced by the service layer.
 *
 * VERSION-BINDING (load-bearing):
 *   isUsableForSend(version) === true IFF:
 *     approval_status === 'approved'
 *     AND approved_content_hash === content_hash (current)
 *   A new draft (draftNewVersion) resets approval_status → 'pending' and
 *   approved_content_hash → NULL, making the new version NOT usable until
 *   compliance re-approves. This is the compliance-critical binding invariant.
 *
 * - version_number: monotonically increasing per template_id (app-enforced).
 *   PARTIAL UNIQUE on (template_id, version_number) prevents duplicates.
 * - subject / body: the rendered template content.
 * - disclaimer_template_id: FK → disclaimer_templates (M2 required-block).
 *   requestApproval returns 400 if the referenced disclaimer is not valid.
 * - content_hash: keyless SHA-256 over the canonicalized version content
 *   (reuses the M2 computeContentHash from content-hash.ts).
 * - approval_status: 'pending' | 'approved' | 'rejected' (outreach_approval_status).
 * - approved_content_hash: set by ApprovalService.grantApproval to the content_hash
 *   at approval time. A post-approval draft resets this to NULL.
 * - approved_by: FK → users.id — the compliance user who approved this version.
 *   Used by OutreachService.composeAsActor for the SoD check (composer ≠ approved_by).
 *   SET NULL on user deletion (approval record retained with snapshot).
 */
export const outreachTemplateVersions = pgTable(
  'outreach_template_versions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → outreach_templates.id. ON DELETE CASCADE — version dies with template. */
    templateId: uuid('template_id').notNull(),

    /**
     * Monotonically increasing version number per template.
     * The service queries MAX(version_number) per template_id and increments.
     * PARTIAL UNIQUE (template_id, version_number) ensures no duplicate versions.
     */
    versionNumber: integer('version_number').notNull(),

    /** Subject line of the outreach email template. */
    subject: text('subject').notNull(),

    /** Full body text of the outreach email template. */
    body: text('body').notNull(),

    /**
     * FK → disclaimer_templates.id (M2 required-block).
     * Ensures this version references a valid compliance disclaimer.
     * requestApproval returns 400 if no valid disclaimer_templates row exists.
     * ON DELETE RESTRICT — cannot remove a disclaimer used by an active version.
     */
    disclaimerTemplateId: uuid('disclaimer_template_id').notNull(),

    /**
     * Keyless SHA-256 hex (64 chars) of the canonicalized version content
     * (subject + body). Computed via computeContentHash from content-hash.ts
     * — the SAME M2 function used by the compliance gate's content-hash binding.
     * Any edit to subject/body MUST produce a new version row with a new hash.
     */
    contentHash: text('content_hash').notNull(),

    /**
     * Approval state for this version.
     * Default 'pending' on creation.
     * The service may only set 'approved' via ApprovalService.grantApproval
     * (compliance role only). Editing an approved version creates a new version.
     */
    approvalStatus: outreachApprovalStatusPgEnum('approval_status').notNull().default('pending'),

    /**
     * The content_hash at the time compliance approved this version.
     * NULL until ApprovalService.grantApproval runs.
     * VERSION-BINDING check: isUsableForSend requires
     *   approvalStatus === 'approved' AND approvedContentHash === contentHash.
     * If content_hash drifts from approvedContentHash (post-approval edit produced
     * a new version), the old approval does not transfer — the new version's
     * approvedContentHash starts NULL and must be re-approved.
     */
    approvedContentHash: text('approved_content_hash'),

    /**
     * FK → users.id — the compliance user who approved this version.
     * SET NULL on user deletion. Used for:
     *   1. SoD: OutreachService checks composer.id !== version.approvedBy.
     *   2. Audit trail (ApprovalService records approved_by = actor.id).
     * NULL until grantApproval runs; remains NULL on rejection.
     */
    approvedBy: uuid('approved_by'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    foreignKey({
      name: 'outreach_template_versions_template_id_fk',
      columns: [table.templateId],
      foreignColumns: [outreachTemplates.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'outreach_template_versions_disclaimer_template_id_fk',
      columns: [table.disclaimerTemplateId],
      foreignColumns: [disclaimerTemplates.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'outreach_template_versions_approved_by_fk',
      columns: [table.approvedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),

    /**
     * PARTIAL UNIQUE (template_id, version_number) — no duplicate version numbers
     * per template. The service enforces monotonic increment; the DB enforces uniqueness.
     */
    unique('outreach_template_versions_template_version_unique').on(
      table.templateId,
      table.versionNumber
    ),

    /** Template-scoped version listing: WHERE template_id = $1. */
    index('outreach_template_versions_template_id_idx').on(table.templateId),

    /** Approval-status-scoped query: WHERE approval_status = $1. */
    index('outreach_template_versions_approval_status_idx').on(table.approvalStatus),
  ]
);

// ---------------------------------------------------------------------------
// 3. outreach
// ---------------------------------------------------------------------------

/**
 * outreach — composed outreach records.
 *
 * Each row is the product of OutreachService.composeAsActor. The gate is ALWAYS
 * called before this row is written; gate_verdict records the full GateVerdict
 * jsonb and status reflects whether the gate allowed or blocked.
 *
 * NON-BYPASSABLE GATE (load-bearing):
 *   status = 'send_eligible' is ONLY written when evaluate() returned allowed:true.
 *   status = 'blocked' is written when evaluate() returned allowed:false.
 *   The 'compose' default is never the final persisted state (compose ALWAYS runs
 *   the gate inline and writes the verdict before committing the row).
 *   This invariant is structural — there is no code path in composeAsActor that
 *   writes 'send_eligible' without a passing gate verdict.
 *
 * - mandate_id: FK → mandates.id — the mandate this outreach belongs to.
 * - match_candidate_id: FK → match_candidates.id — the shortlist buyer target
 *   (disposition='accepted' is the shortlist compose target per matching.ts).
 * - template_version_id: FK → outreach_template_versions.id — the approved version used.
 * - gate_verdict: JSONB of GateVerdict (allowed, blocks, requiredDisclaimers).
 * - status: compose | send_eligible | blocked (outreach_status enum).
 * - created_by: FK → users.id — the advisor who composed the outreach.
 */
export const outreach = pgTable(
  'outreach',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → mandates.id — which mandate this outreach belongs to. ON DELETE CASCADE. */
    mandateId: uuid('mandate_id').notNull(),

    /**
     * FK → match_candidates.id — the shortlist buyer target.
     * Disposition 'accepted' (matching.ts:222) is the compose prerequisite.
     * ON DELETE CASCADE — if the candidate is removed, remove the outreach record.
     */
    matchCandidateId: uuid('match_candidate_id').notNull(),

    /**
     * FK → outreach_template_versions.id — the approved version used.
     * isUsableForSend(version) must be true at compose time (version-binding).
     * ON DELETE RESTRICT — cannot delete a version that has been used for outreach.
     */
    templateVersionId: uuid('template_version_id').notNull(),

    /**
     * Full GateVerdict jsonb (allowed + blocks + requiredDisclaimers).
     * Written by OutreachService.composeAsActor from the evaluate() return value.
     * Persisted for audit and debugging regardless of allowed/blocked status.
     */
    gateVerdict: jsonb('gate_verdict').notNull(),

    /**
     * Outreach lifecycle status.
     * CRITICAL: 'send_eligible' is ONLY set when gate passed (allowed:true).
     * 'blocked' is set when gate failed (allowed:false). 'compose' is the
     * transient default; the service always resolves it inline.
     */
    status: outreachStatusPgEnum('status').notNull().default('compose'),

    /**
     * FK → users.id — the advisor who composed (created) this outreach.
     * App users.id (NOT raw SuperTokens id — actor-id-FK lesson).
     * ON DELETE RESTRICT — outreach records must outlive their creator.
     */
    createdBy: uuid('created_by').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    foreignKey({
      name: 'outreach_mandate_id_fk',
      columns: [table.mandateId],
      foreignColumns: [mandates.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'outreach_match_candidate_id_fk',
      columns: [table.matchCandidateId],
      foreignColumns: [matchCandidates.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'outreach_template_version_id_fk',
      columns: [table.templateVersionId],
      foreignColumns: [outreachTemplateVersions.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'outreach_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),

    /** Mandate-scoped outreach listing: WHERE mandate_id = $1. */
    index('outreach_mandate_id_idx').on(table.mandateId),

    /** Status-scoped listing: WHERE status = $1. */
    index('outreach_status_idx').on(table.status),

    /** Created-by listing: WHERE created_by = $1. */
    index('outreach_created_by_idx').on(table.createdBy),
  ]
);
