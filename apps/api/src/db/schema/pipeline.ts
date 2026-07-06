import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { mandates } from './mandate';
import { matchCandidates } from './matching';
import { outreach } from './outreach';
import { users } from './users-roles';
import { workspaces } from './workspaces';

/**
 * Wave-12 pipeline spine (B-0, task 07989285).
 *
 * Two MUTABLE tables:
 *   1. pipeline        — one row per deal target (outreach OR match_candidate); mutable stage
 *   2. pipeline_events — APPEND-ONLY event log (enrolled / stage_changed / note)
 *
 * DESIGN INVARIANTS:
 *   - Exactly one of (outreach_id, match_candidate_id) is non-null per pipeline row.
 *     A CHECK constraint enforces this at the DB level (structural, non-bypassable).
 *   - One pipeline row per deal target (idempotent enroll):
 *       outreach_id partial UNIQUE (WHERE outreach_id IS NOT NULL)
 *       match_candidate_id partial UNIQUE (WHERE match_candidate_id IS NOT NULL)
 *     PipelineService.enrollAsActor inserts and lets the DB unique constraint reject
 *     duplicates (fail-on-conflict — wave-9 double-universe race lesson: structural
 *     guard, not service-level check).
 *   - stage enum is FIXED (product-decision #137): 7 values, order reflects workflow.
 *     No configurable stages for MVP (H2-deferred).
 *   - pipeline_events is append-only — no UPDATE or DELETE path exists anywhere.
 *     from_stage / to_stage are nullable so 'enrolled' events do not require a
 *     stage transition (they record the initial shortlisted state, not a move).
 *   - actor_id / created_by / updated_by always reference users.id (app UUID,
 *     NOT raw SuperTokens id) — the wave-5 actor-id-FK lesson.
 *   - Every pipeline mutation (enroll / transition / addNote) is audited via
 *     M2 AuditService.append LAST-IN-TXN (HMAC-SHA256 chain); rollback on audit
 *     failure holds.
 *
 * ENUM NAMING (distinct from all existing enums — wave-11 outreach_approval_status lesson):
 *   pipeline_stage      — distinct (existing enums: match_run_status,
 *                          match_candidate_disposition, mandate_status,
 *                          dedupe_candidate_status, buyer_universe_status,
 *                          buyer_universe_candidate_membership_status,
 *                          compliance_rule_type, suppression_match_type,
 *                          approval_status, outreach_approval_status, outreach_status)
 *   pipeline_event_type — distinct (same list above; no conflict).
 *
 * FK TARGETS VERIFIED (from existing schema files):
 *   mandates.id          → uuid PK  (mandate.ts line 80)
 *   outreach.id          → uuid PK  (outreach.ts line 332)
 *   match_candidates.id  → uuid PK  (matching.ts line 225)
 *   users.id             → uuid PK  (users-roles.ts line 46)
 *
 * Additive-only — no existing table is altered.
 */

// ---------------------------------------------------------------------------
// pgEnum: pipeline_stage
// ---------------------------------------------------------------------------

/**
 * pipeline_stage — fixed 7-value deal lifecycle enum (product-decision #137).
 *   shortlisted — default on enrollment; deal has been identified as a target.
 *   contacted   — initial outreach has been sent / contact made.
 *   engaged     — counterparty is actively engaging (responded, attending calls).
 *   diligence   — formal due-diligence phase has started.
 *   offer       — term sheet / LOI / offer has been submitted.
 *   closed      — deal has closed (won).
 *   withdrawn   — deal has been withdrawn or abandoned (lost / declined).
 *
 * Order reflects the standard M&A workflow. Fixed for MVP; configurable H2-deferred.
 * DISTINCT from all other pgEnums in this codebase (wave-11 lesson).
 */
export const pipelineStagePgEnum = pgEnum('pipeline_stage', [
  'shortlisted',
  'contacted',
  'engaged',
  'diligence',
  'offer',
  'closed',
  'withdrawn',
]);

// ---------------------------------------------------------------------------
// pgEnum: pipeline_event_type
// ---------------------------------------------------------------------------

/**
 * pipeline_event_type — the three categories of append-only pipeline events.
 *   enrolled      — deal was enrolled into the pipeline at stage 'shortlisted'.
 *   stage_changed — deal was moved from from_stage → to_stage.
 *   note          — a free-text note was appended by an actor.
 *
 * DISTINCT name — no collision with any existing enum in this codebase.
 */
export const pipelineEventTypePgEnum = pgEnum('pipeline_event_type', [
  'enrolled',
  'stage_changed',
  'note',
]);

// ---------------------------------------------------------------------------
// 1. pipeline
// ---------------------------------------------------------------------------

/**
 * pipeline — one row per deal target in the M&A pipeline.
 *
 * DEAL TARGET CONSTRAINT (structural, load-bearing):
 *   Exactly one of (outreach_id, match_candidate_id) MUST be non-null.
 *   A CHECK constraint enforces this: one is not-null AND the other is null.
 *   The deal_source_type column is a discriminant for query readability;
 *   the CHECK is the authoritative guard.
 *
 * IDEMPOTENT ENROLL (structural guard — wave-9 lesson):
 *   Two partial UNIQUE indexes prevent duplicate pipeline rows per deal target:
 *     - UNIQUE (outreach_id) WHERE outreach_id IS NOT NULL
 *     - UNIQUE (match_candidate_id) WHERE match_candidate_id IS NOT NULL
 *   PipelineService.enrollAsActor INSERTs and lets the DB unique constraint
 *   reject duplicates (fail-on-conflict). No service-level pre-check.
 *
 * mandate_id: NOT NULL FK → mandates.id (ON DELETE CASCADE — pipeline row dies
 *   with the mandate for cleanup; deals are scoped to their mandate).
 *
 * created_by / updated_by: FK → users.id (app UUID, NOT ST id).
 *   - created_by: NOT NULL; set at INSERT.
 *   - updated_by: nullable; set at stage transition.
 *   - ON DELETE RESTRICT for created_by (pipeline rows outlive creators).
 *   - ON DELETE SET NULL for updated_by (last-updater is advisory metadata).
 *
 * stage: default 'shortlisted' — PipelineService.enrollAsActor always starts here.
 *   Transitions via PipelineService.transitionStageAsActor write a stage_changed
 *   pipeline_events row AND update this column in the same txn.
 *
 * updated_at: application-layer clock via Drizzle's .$onUpdateFn.
 *   NULL until first UPDATE (first transition).
 */
export const pipeline = pgTable(
  'pipeline',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /**
     * FK → mandates.id — the mandate this deal belongs to.
     * NOT NULL. ON DELETE CASCADE — pipeline row is deleted with the mandate.
     */
    mandateId: uuid('mandate_id').notNull(),

    /**
     * Discriminant for the deal target type.
     * 'outreach'        — the deal target is an outreach record (outreach_id set).
     * 'match_candidate' — the deal target is a match candidate (match_candidate_id set).
     * The CHECK constraint on (outreach_id, match_candidate_id) is the authoritative
     * guard; this column is for query readability and filtering.
     */
    dealSourceType: text('deal_source_type').notNull(),

    /**
     * FK → outreach.id — set when deal_source_type = 'outreach'.
     * Nullable — NULL when deal_source_type = 'match_candidate'.
     * ON DELETE CASCADE — if the outreach record is removed, remove the pipeline row.
     * PARTIAL UNIQUE enforced via index below.
     */
    outreachId: uuid('outreach_id'),

    /**
     * FK → match_candidates.id — set when deal_source_type = 'match_candidate'.
     * Nullable — NULL when deal_source_type = 'outreach'.
     * ON DELETE CASCADE — if the match candidate is removed, remove the pipeline row.
     * PARTIAL UNIQUE enforced via index below.
     */
    matchCandidateId: uuid('match_candidate_id'),

    /**
     * Current pipeline stage. Default 'shortlisted' (enrollment stage).
     * PipelineService.transitionStageAsActor validates against the fixed enum;
     * unknown stage values are rejected server-side (400) before reaching the DB.
     */
    stage: pipelineStagePgEnum('stage').notNull().default('shortlisted'),

    /**
     * FK → users.id — the advisor who enrolled this deal.
     * App users.id (NOT raw SuperTokens id — actor-id-FK lesson).
     * ON DELETE RESTRICT — pipeline rows outlive their creator.
     */
    createdBy: uuid('created_by').notNull(),

    /**
     * FK → users.id — the actor who last updated the stage.
     * NULL until first stage transition. ON DELETE SET NULL.
     */
    updatedBy: uuid('updated_by'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /**
     * Application-layer updated_at (Drizzle .$onUpdateFn).
     * NULL until first UPDATE (first stage transition).
     */
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),

    /** Wave-17 (task 0db154ff) — tenant boundary FK. RLS-enforced. */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    // -----------------------------------------------------------------------
    // Foreign keys
    // -----------------------------------------------------------------------
    foreignKey({
      name: 'pipeline_mandate_id_fk',
      columns: [table.mandateId],
      foreignColumns: [mandates.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'pipeline_outreach_id_fk',
      columns: [table.outreachId],
      foreignColumns: [outreach.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'pipeline_match_candidate_id_fk',
      columns: [table.matchCandidateId],
      foreignColumns: [matchCandidates.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'pipeline_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'pipeline_updated_by_fk',
      columns: [table.updatedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),

    foreignKey({
      name: 'pipeline_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),

    // -----------------------------------------------------------------------
    // CHECK: exactly one of (outreach_id, match_candidate_id) is non-null.
    // Enforces the deal-target structural invariant at the DB level.
    // Reads: (outreach_id IS NOT NULL AND match_candidate_id IS NULL)
    //     OR (outreach_id IS NULL AND match_candidate_id IS NOT NULL)
    // -----------------------------------------------------------------------
    check(
      'pipeline_deal_target_xor_check',
      sql`(outreach_id IS NOT NULL AND match_candidate_id IS NULL) OR (outreach_id IS NULL AND match_candidate_id IS NOT NULL)`
    ),

    // -----------------------------------------------------------------------
    // UNIQUE: one pipeline row per deal target (idempotent enroll guard).
    //
    // Two partial unique indexes:
    //   1. UNIQUE (outreach_id) WHERE outreach_id IS NOT NULL
    //      → prevents two pipeline rows for the same outreach record.
    //   2. UNIQUE (match_candidate_id) WHERE match_candidate_id IS NOT NULL
    //      → prevents two pipeline rows for the same match candidate.
    //
    // Partial indexes are chosen over a composite UNIQUE on (deal_source_type,
    // COALESCE(...)) because partial indexes are natively expressible in
    // drizzle-kit + SQL, emit clean DDL, and are directly query-optimized by PG.
    // The COALESCE approach requires a generated column or a function index
    // which drizzle-kit does not emit — manual SQL would be needed either way.
    // -----------------------------------------------------------------------
    uniqueIndex('pipeline_outreach_id_unique_idx')
      .on(table.outreachId)
      .where(sql`outreach_id IS NOT NULL`),

    uniqueIndex('pipeline_match_candidate_id_unique_idx')
      .on(table.matchCandidateId)
      .where(sql`match_candidate_id IS NOT NULL`),

    // -----------------------------------------------------------------------
    // Non-unique indexes for common read patterns
    // -----------------------------------------------------------------------

    /** Mandate-scoped board query: WHERE mandate_id = $1. */
    index('pipeline_mandate_id_idx').on(table.mandateId),

    /** Stage-column query: WHERE mandate_id = $1 AND stage = $2. */
    index('pipeline_mandate_stage_idx').on(table.mandateId, table.stage),

    /** Creator listing: WHERE created_by = $1. */
    index('pipeline_created_by_idx').on(table.createdBy),
    index('pipeline_workspace_id_idx').on(table.workspaceId),
  ]
);

// ---------------------------------------------------------------------------
// 2. pipeline_events (APPEND-ONLY)
// ---------------------------------------------------------------------------

/**
 * pipeline_events — the ordered, append-only event log for a pipeline deal.
 *
 * APPEND-ONLY INVARIANT (structural, load-bearing):
 *   There is NO UPDATE or DELETE path for this table anywhere in the codebase.
 *   PipelineService.addNoteAsActor, enrollAsActor, and transitionStageAsActor
 *   only INSERT into this table. This is the compliance-critical audit trail
 *   (separate from the M2 AuditService HMAC chain, which is also written in
 *   the same txn — the pipeline_events table is the product-level timeline;
 *   the audit_log_entries table is the tamper-evident compliance record).
 *
 * pipeline_id: FK → pipeline.id ON DELETE CASCADE NOT NULL.
 *   Cascade delete is acceptable: if a pipeline row is removed (mandate deleted),
 *   its event log is also removed. The M2 audit_log_entries remains (no cascade).
 *
 * event_type:
 *   enrolled      — from_stage/to_stage both NULL; note NULL.
 *   stage_changed — from_stage/to_stage both set; note NULL.
 *   note          — from_stage/to_stage both NULL; note text set (min 1 char).
 *
 * actor_id: FK → users.id (app UUID, NOT ST id — actor-id-FK lesson).
 *   ON DELETE RESTRICT — event records outlive the actor for compliance.
 *
 * created_at: server clock at event creation. The timeline is ordered by this
 *   column. No updated_at — rows are immutable once written.
 *
 * INDEX: (pipeline_id, created_at) — supports the ordered timeline read for
 *   a given deal (GET /pipeline/:id/events → ORDER BY created_at ASC).
 */
export const pipelineEvents = pgTable(
  'pipeline_events',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /**
     * FK → pipeline.id — which deal this event belongs to.
     * NOT NULL. ON DELETE CASCADE — event log is removed with the deal.
     */
    pipelineId: uuid('pipeline_id').notNull(),

    /**
     * The type of event. Determines which optional fields are meaningful:
     *   enrolled      → from_stage=null, to_stage=null, note=null
     *   stage_changed → from_stage=<prev>, to_stage=<new>, note=null
     *   note          → from_stage=null, to_stage=null, note=<text>
     */
    eventType: pipelineEventTypePgEnum('event_type').notNull(),

    /**
     * Previous stage (for stage_changed events only). NULL for enrolled/note.
     * The pipeline_stage enum ensures the value is always a valid stage.
     */
    fromStage: pipelineStagePgEnum('from_stage'),

    /**
     * New stage (for stage_changed events only). NULL for enrolled/note.
     * The pipeline_stage enum ensures the value is always a valid stage.
     */
    toStage: pipelineStagePgEnum('to_stage'),

    /**
     * Free-text note (for note events only). NULL for enrolled/stage_changed.
     * PipelineService.addNoteAsActor validates min length 1 (Zod).
     */
    note: text('note'),

    /**
     * FK → users.id — the actor who created this event.
     * App users.id (NOT raw SuperTokens id — actor-id-FK lesson).
     * NOT NULL. ON DELETE RESTRICT — event records outlive their actor.
     */
    actorId: uuid('actor_id').notNull(),

    /**
     * Server clock at event creation. The canonical ordering column for the
     * timeline read. Immutable after INSERT (append-only table).
     */
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /** Wave-17 (task 0db154ff) — tenant boundary FK. RLS-enforced. */
    workspaceId: uuid('workspace_id').notNull(),
  },
  (table) => [
    // -----------------------------------------------------------------------
    // Foreign keys
    // -----------------------------------------------------------------------
    foreignKey({
      name: 'pipeline_events_pipeline_id_fk',
      columns: [table.pipelineId],
      foreignColumns: [pipeline.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'pipeline_events_actor_id_fk',
      columns: [table.actorId],
      foreignColumns: [users.id],
    }).onDelete('restrict'),

    foreignKey({
      name: 'pipeline_events_workspace_id_fk',
      columns: [table.workspaceId],
      foreignColumns: [workspaces.id],
    }).onDelete('restrict'),

    // -----------------------------------------------------------------------
    // INDEX: (pipeline_id, created_at) — ordered timeline read for a deal.
    // GET /pipeline/:id/events → WHERE pipeline_id = $1 ORDER BY created_at ASC.
    // -----------------------------------------------------------------------
    index('pipeline_events_pipeline_id_created_at_idx').on(table.pipelineId, table.createdAt),
    index('pipeline_events_workspace_id_idx').on(table.workspaceId),
  ]
);
