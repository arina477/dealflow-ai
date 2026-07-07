import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { mandates } from './mandate';
import { matchCandidates } from './matching';
import { outreach } from './outreach';
import { pipeline } from './pipeline';
import { users } from './users-roles';
import { workspaces } from './workspaces';

/**
 * Wave-20 outreach_activity spine (B-0, task d45c73b5).
 *
 * MUTABLE internal activity ledger — NOT WORM.
 * Advisors log manual multi-channel touches (call / email / linkedin / other)
 * against deal targets: outreach, match_candidate, pipeline, or mandate rows.
 *
 * DESIGN INVARIANTS:
 *   - workspace_id: tenant boundary FK (FORCE RLS, FOR ALL USING-only policy).
 *     Column DEFAULT = NULLIF(current_setting('app.workspace_id', true),'')::uuid
 *     so an INSERT that omits workspace_id lands the caller's GUC value (or NULL
 *     when GUC is unset → NOT NULL constraint rejects → fail-closed). SF1 HIGH.
 *   - 0-or-1 deal-target link: all four FK columns (outreachId, matchCandidateId,
 *     pipelineId, mandateId) are nullable — a standalone touch needs no link.
 *     The service validates any provided FK belongs to the caller's workspace
 *     (R3/SF4 tenancy guard).
 *   - createdBy: FK → users.id (app UUID, NOT raw SuperTokens id). NOT NULL.
 *     ON DELETE RESTRICT — records outlive their creator.
 *   - Every CREATE/UPDATE/status-transition/cancel mutation APPENDS an entry to
 *     the M2 HMAC-SHA256 audit chain via AuditService.append LAST-IN-TXN (R4/SF5).
 *   - This table is NOT wired into the immutable audit_log hash-chain; it is a
 *     mutable activity ledger (rows can be updated to completed/cancelled).
 *
 * ENUM NAMING:
 *   outreach_activity_channel — DISTINCT from all existing pgEnums:
 *     outreach_approval_status, outreach_status, pipeline_stage, pipeline_event_type,
 *     match_run_status, match_candidate_disposition, mandate_status,
 *     dedupe_candidate_status, buyer_universe_status,
 *     buyer_universe_candidate_membership_status, compliance_rule_type,
 *     suppression_match_type, approval_status.
 *   outreach_activity_status  — DISTINCT from all of the above.
 *   (Wave-11 cluster lesson: distinct enum names avoid pg type namespace collisions.)
 *
 * RLS POLICY (matched to the 28 tenant tables — migration 0018):
 *   ENABLE ROW LEVEL SECURITY
 *   FORCE ROW LEVEL SECURITY
 *   CREATE POLICY "workspace_isolation" ON "outreach_activity"
 *     USING (workspace_id = NULLIF(current_setting('app.workspace_id', true),'')::uuid)
 *   NO FOR SELECT (would lose derived write-check).
 *   NO literal WITH CHECK (M8 has none — derived from USING under FOR ALL).
 *   GRANT SELECT/INSERT/UPDATE/DELETE TO dealflow_app.
 *
 * ROLLBACK: DROP TABLE outreach_activity + DROP TYPE outreach_activity_channel
 *           + DROP TYPE outreach_activity_status — zero data loss on other tables.
 *
 * HARD BOUNDARY:
 *   ZERO external send, ZERO provider API key, ZERO ESP/#141, ZERO LLM spend,
 *   ZERO new SDK. Channel values are pure record labels — no downstream dispatch.
 *
 * Additive-only — no existing table is altered.
 */

// ---------------------------------------------------------------------------
// pgEnum: outreach_activity_channel
//
// DISTINCT NAME — must not collide with any existing pgEnum in this codebase.
// Values are pure record labels; no downstream send occurs.
// ---------------------------------------------------------------------------

/**
 * outreach_activity_channel — the channel via which a manual touch is made.
 *   call     — phone call.
 *   email    — manual email (not ESP/provider-sent outreach).
 *   linkedin — LinkedIn message/connection.
 *   other    — any other channel not listed above.
 *
 * SF7 (INFO): these values are PURE record labels. No consumer reads this
 * enum to dispatch, webhook, queue, or send anything. Credential-free.
 */
export const outreachActivityChannelPgEnum = pgEnum('outreach_activity_channel', [
  'call',
  'email',
  'linkedin',
  'other',
]);

// ---------------------------------------------------------------------------
// pgEnum: outreach_activity_status
//
// DISTINCT NAME — distinct from outreach_approval_status / outreach_status.
// ---------------------------------------------------------------------------

/**
 * outreach_activity_status — lifecycle of an activity record.
 *   planned   — default on creation; scheduled but not yet done.
 *   completed — activity was performed.
 *   cancelled — activity was cancelled before completion.
 */
export const outreachActivityStatusPgEnum = pgEnum('outreach_activity_status', [
  'planned',
  'completed',
  'cancelled',
]);

// ---------------------------------------------------------------------------
// outreach_activity table
// ---------------------------------------------------------------------------

/**
 * outreach_activity — internal manual outreach activity ledger.
 *
 * Each row records one touch an advisor logged or scheduled against a deal
 * target. The deal target link (0-or-1 of the four FK columns) is advisory —
 * all four nullable FKs may be NULL for a standalone touch.
 *
 * WORKSPACE_ID COLUMN DEFAULT (SF1 HIGH):
 *   workspace_id has a column DEFAULT:
 *     NULLIF(current_setting('app.workspace_id', true),'')::uuid
 *   An INSERT that omits workspace_id captures the caller's GUC value.
 *   When the GUC is unset (empty-ALS / background job), NULLIF returns NULL
 *   → the NOT NULL constraint rejects the INSERT → fail-closed.
 *   The service ALSO throws when getWorkspaceId() returns null (belt+suspenders).
 *   NEVER a ?? DEFAULT_WORKSPACE_ID fallback in app code (SF1 HIGH).
 *
 * INDEXES:
 *   - workspace_id index: primary tenant filter (RLS + explicit WHERE).
 *   - (workspace_id, status, due_at) index: "my open touches" read path
 *     (WHERE workspace_id = $GUC AND status = 'planned' ORDER BY due_at ASC).
 */
export const outreachActivity = pgTable(
  'outreach_activity',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /**
     * Tenant boundary FK → workspaces.id. NOT NULL.
     * FORCE RLS policy enforced via the workspace_isolation policy.
     *
     * Column DEFAULT = NULLIF(current_setting('app.workspace_id', true),'')::uuid
     * so an omitted workspace_id in INSERT captures the GUC (SF1 HIGH).
     * Added in migration 0018 via ALTER COLUMN SET DEFAULT after table creation.
     * Drizzle does not emit column DEFAULT for runtime expressions — the DEFAULT
     * is applied in the hand-authored migration SQL directly.
     */
    workspaceId: uuid('workspace_id').notNull(),

    /** The channel for this touch. */
    channel: outreachActivityChannelPgEnum('channel').notNull(),

    /**
     * Lifecycle status.
     * Default 'planned' on creation.
     * Service updateStatus/cancel transitions are audited LAST-IN-TXN.
     */
    status: outreachActivityStatusPgEnum('status').notNull().default('planned'),

    /** Subject / title of the activity. NOT NULL — every touch has a subject. */
    subject: text('subject').notNull(),

    /**
     * Optional free-text notes for this activity.
     * NULL allowed — short touches may not need body text.
     */
    notes: text('notes'),

    /**
     * Optional due date/time for a planned activity.
     * NULL = no due date set (standalone or flexible schedule).
     */
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'string' }),

    /**
     * Timestamp when the activity was completed.
     * Set by the service when status transitions to 'completed'.
     * NULL for planned/cancelled activities.
     */
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),

    // ─── 0-or-1 deal-target link (all nullable) ───────────────────────────────
    // At most one of these four FKs should be set (0-or-1 link — softer than the
    // pipeline table's XOR CHECK). The service validates any provided FK belongs
    // to the caller's workspace (R3/SF4 tenancy guard).

    /**
     * Optional FK → outreach.id — link to a composed outreach record.
     * NULL if not linked to a specific outreach. ON DELETE SET NULL (activity
     * survives the outreach row being removed).
     */
    outreachId: uuid('outreach_id'),

    /**
     * Optional FK → match_candidates.id — link to a shortlisted match candidate.
     * NULL if not linked. ON DELETE SET NULL.
     */
    matchCandidateId: uuid('match_candidate_id'),

    /**
     * Optional FK → pipeline.id — link to a pipeline deal row.
     * NULL if not linked. ON DELETE SET NULL.
     */
    pipelineId: uuid('pipeline_id'),

    /**
     * Optional FK → mandates.id — scope this activity to a mandate.
     * NULL if standalone or unscoped. ON DELETE SET NULL.
     */
    mandateId: uuid('mandate_id'),

    // ─── Audit provenance ─────────────────────────────────────────────────────

    /**
     * FK → users.id — the advisor who created this activity.
     * App users.id (NOT raw SuperTokens id — actor-id-FK lesson).
     * NOT NULL. ON DELETE RESTRICT — records outlive their creator.
     * MUST be set by the service from ALS-resolved actor. NEVER client-supplied.
     * (SF4: createdBy is server-derived-only.)
     */
    createdBy: uuid('created_by').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),
  },
  (table) => [
    // ─── Foreign keys ──────────────────────────────────────────────────────────

    foreignKey({
      name: 'outreach_activity_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'outreach_activity_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'outreach_activity_outreach_id_fk',
      columns: [table.outreachId],
      foreignColumns: [outreach.id],
    }).onDelete('set null'),

    foreignKey({
      name: 'outreach_activity_match_candidate_id_fk',
      columns: [table.matchCandidateId],
      foreignColumns: [matchCandidates.id],
    }).onDelete('set null'),

    foreignKey({
      name: 'outreach_activity_pipeline_id_fk',
      columns: [table.pipelineId],
      foreignColumns: [pipeline.id],
    }).onDelete('set null'),

    foreignKey({
      name: 'outreach_activity_mandate_id_fk',
      columns: [table.mandateId],
      foreignColumns: [mandates.id],
    }).onDelete('set null'),

    // ─── Indexes ───────────────────────────────────────────────────────────────

    /**
     * Primary tenant filter index.
     * workspace_id = $GUC is the outermost filter on every RLS-scoped query.
     */
    index('outreach_activity_workspace_id_idx').on(table.workspaceId),

    /**
     * "My open touches" composite index.
     * Covers: WHERE workspace_id = $GUC AND status = 'planned' ORDER BY due_at ASC.
     * Matches the my-open-touches read path in OutreachActivityService.list.
     */
    index('outreach_activity_workspace_status_due_at_idx').on(
      table.workspaceId,
      table.status,
      table.dueAt
    ),
  ]
);
