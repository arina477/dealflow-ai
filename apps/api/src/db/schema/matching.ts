import type { ScoreBreakdown } from '@dealflow/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { buyerUniverse, buyerUniverseCandidates } from './buyer-universe';
import { mandates } from './mandate';
import { users } from './users-roles';

/**
 * Wave-10 match spine (B-0, task 47ed7ddd).
 *
 * Two MUTABLE tables:
 *   1. match_run        — top-level match run (1:1 per buyer_universe — idempotent)
 *   2. match_candidates — per-candidate score rows with disposition lifecycle
 *
 * DESIGN INVARIANTS:
 *   - match_run has UNIQUE on buyer_universe_id — one run per universe. This
 *     is the idempotency key: upsert match_run by buyer_universe_id UNIQUE.
 *   - match_candidates links to both match_run and buyer_universe_candidates;
 *     ON DELETE CASCADE from match_run (deleting the run removes all score rows).
 *   - fit_score is an INTEGER with a CHECK (fit_score >= 0 AND fit_score <= 100).
 *     drizzle-kit may not emit the CHECK inline; it is hand-appended in the SQL.
 *   - score_breakdown is JSONB — structured rule-contribution breakdown, NOT prose.
 *   - created_by references users.id (app UUID, NOT supertokens_user_id). The
 *     service translates via AuthRepository.getUserWithRole (wave-5 actor-id-FK lesson).
 *   - ready_for_outreach: boolean flag set by handoffAsActor (M6 preparation).
 *     Guard: ≥1 ACCEPTED candidate required before handoff (BUILD rule 6).
 *
 * HARD BOUNDARY (CRITICAL):
 *   NO Anthropic/Claude/LLM import or call anywhere in this module.
 *   NO BullMQ, NO rationale-TEXT field (score_breakdown is structured jsonb).
 *   NO AI/LLM dep in package.json.
 *   Scoring is pure deterministic integer (pure scoreCandidate function in scorer).
 *
 * M5/M6 BOUNDARY:
 *   match_run.ready_for_outreach is the M6 handoff sentinel — TRUE means the
 *   run is ready for outreach. NO outreach is executed in this module (M6 owns that).
 *
 * Additive-only — no existing table is altered.
 */

// ---------------------------------------------------------------------------
// pgEnum: match_run_status
// ---------------------------------------------------------------------------

/**
 * match_run_status — lifecycle of a match run.
 *   pending — default on creation; scoring has not yet completed.
 *   scored  — scoring completed; all match_candidates have fit_score + breakdown.
 */
export const matchRunStatusPgEnum = pgEnum('match_run_status', ['pending', 'scored']);

// ---------------------------------------------------------------------------
// pgEnum: match_candidate_disposition
// ---------------------------------------------------------------------------

/**
 * match_candidate_disposition — per-candidate disposition decision.
 *   pending  — default on scoring; not yet reviewed by advisor.
 *   accepted — advisor included this buyer in the shortlist.
 *   rejected — advisor excluded this buyer from outreach.
 *   flagged  — advisor flagged for further review (conflict, question, etc.).
 */
export const matchCandidateDispositionPgEnum = pgEnum('match_candidate_disposition', [
  'pending',
  'accepted',
  'rejected',
  'flagged',
]);

// ---------------------------------------------------------------------------
// 1. match_run
// ---------------------------------------------------------------------------

/**
 * match_run — the top-level match run record.
 *
 * mandate_id: NOT NULL FK to mandates.id. Denormalized for direct mandate-scoped
 *   queries (avoids join through buyer_universe). ON DELETE CASCADE.
 *
 * buyer_universe_id: NOT NULL FK to buyer_universe.id. UNIQUE — one run per
 *   universe (idempotent). ON DELETE CASCADE — if the universe is deleted,
 *   remove its match run.
 *
 * created_by: NOT NULL FK to users.id (app UUID). SET to restrict on user
 *   deletion (match runs must outlive their creator for recordkeeping).
 *
 * status: default 'pending' — transitions to 'scored' once all candidates are
 *   scored in the one-txn createRunAsActor call.
 *
 * ready_for_outreach: boolean default false — set to true by handoffAsActor
 *   (M6 preparation sentinel). Guard: ≥1 ACCEPTED candidate required.
 *
 * updated_at: application-layer clock via Drizzle's .$onUpdateFn.
 *   NULL until first update.
 */
export const matchRun = pgTable(
  'match_run',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /**
     * FK → mandates.id — which mandate this run belongs to.
     * Denormalized for direct mandate-scoped queries. ON DELETE CASCADE.
     */
    mandateId: uuid('mandate_id').notNull(),

    /**
     * FK → buyer_universe.id — the universe being ranked.
     * UNIQUE: one run per universe (idempotency key).
     * ON DELETE CASCADE — universe deletion removes the run.
     */
    buyerUniverseId: uuid('buyer_universe_id').notNull(),

    /**
     * App users.id of the advisor who triggered the run.
     * The MatchingService translates the session's ST id via getUserWithRole
     * before this FK is populated. The wave-5 actor-id-FK lesson.
     */
    createdBy: uuid('created_by').notNull(),

    /**
     * Lifecycle status. 'pending' on creation; 'scored' after all candidates
     * are scored in the same transaction.
     */
    status: matchRunStatusPgEnum('status').notNull().default('pending'),

    /**
     * M6 handoff sentinel. FALSE on creation; set to TRUE by handoffAsActor
     * when ≥1 ACCEPTED candidate exists. NO outreach executed here.
     */
    readyForOutreach: boolean('ready_for_outreach').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /**
     * Application-layer updated_at (Drizzle .$onUpdateFn).
     * NULL until first UPDATE.
     */
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),
  },
  (table) => [
    foreignKey({
      name: 'match_run_mandate_id_fk',
      columns: [table.mandateId],
      foreignColumns: [mandates.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'match_run_buyer_universe_id_fk',
      columns: [table.buyerUniverseId],
      foreignColumns: [buyerUniverse.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'match_run_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),

    /**
     * One-run-per-universe idempotency: buyer_universe_id UNIQUE.
     * createRunAsActor uses ON CONFLICT (buyer_universe_id) DO UPDATE to
     * get-or-create atomically (mirrors the buyer_universe_id UNIQUE
     * idempotency pattern from buyer-universe.ts mandate_id UNIQUE).
     */
    unique('match_run_buyer_universe_id_unique').on(table.buyerUniverseId),

    /** Mandate-scoped run listing: WHERE mandate_id = $1. */
    index('match_run_mandate_id_idx').on(table.mandateId),

    /** Universe-scoped run lookup: WHERE buyer_universe_id = $1 (also covered by UNIQUE). */
    index('match_run_buyer_universe_id_idx').on(table.buyerUniverseId),

    /** Status-scoped listing: WHERE status = $1. */
    index('match_run_status_idx').on(table.status),
  ]
);

// ---------------------------------------------------------------------------
// 2. match_candidates
// ---------------------------------------------------------------------------

/**
 * match_candidates — per-candidate score rows within a match run.
 *
 * match_run_id: NOT NULL FK to match_run.id. ON DELETE CASCADE — deleting the
 *   run also deletes all score rows.
 *
 * buyer_universe_candidate_id: NOT NULL FK to buyer_universe_candidates.id.
 *   ON DELETE CASCADE — if the universe candidate is removed, remove score rows.
 *
 * fit_score: INTEGER (0–100). The pure deterministic score for this candidate.
 *   A CHECK constraint ensures the value is in bounds. drizzle-kit may not emit
 *   the CHECK inline — it is hand-appended in the SQL migration.
 *
 * score_breakdown: JSONB — structured rule-contribution breakdown. Fields include
 *   sectorMatch, contactCompleteness, tieBreak, notApplied (unsupported dims).
 *   NOT prose — no rationale text field exists anywhere.
 *
 * disposition: default 'pending' — transitions via patchDispositionAsActor
 *   (accepted, rejected, flagged). Used by handoffAsActor's guard (≥1 accepted).
 *
 * created_at: server clock at scoring time (populated once at INSERT; no
 *   updated_at — disposition changes are tracked through the audit log).
 */
export const matchCandidates = pgTable(
  'match_candidates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → match_run.id — which run this score belongs to. ON DELETE CASCADE. */
    matchRunId: uuid('match_run_id').notNull(),

    /**
     * FK → buyer_universe_candidates.id — the scored candidate.
     * ON DELETE CASCADE — if the universe candidate is removed, remove score rows.
     */
    buyerUniverseCandidateId: uuid('buyer_universe_candidate_id').notNull(),

    /**
     * Pure deterministic fit score (0–100 integer).
     * CHECK (fit_score >= 0 AND fit_score <= 100) — hand-appended in migration
     * if drizzle-kit does not emit the CHECK constraint.
     * NOT NULL — every candidate in a completed ('scored') run has a score.
     */
    fitScore: integer('fit_score').notNull(),

    /**
     * Structured rule-contribution breakdown.
     * Shape: { sectorMatch: number, contactCompleteness: number, tieBreak: number,
     *          total: number, notApplied: string[] }
     * NOT prose — no rationale text field. The breakdown shows rule contributions.
     * $type<ScoreBreakdown> tells Drizzle the precise TS type for this JSONB column
     * (matches matching.scorer.ts ScoreBreakdown interface exactly).
     */
    scoreBreakdown: jsonb('score_breakdown').$type<ScoreBreakdown>(),

    /**
     * Per-candidate advisor disposition. 'pending' on scoring.
     * Transitions: accepted | rejected | flagged via patchDispositionAsActor.
     * handoffAsActor requires ≥1 'accepted' candidate (BUILD rule 6).
     */
    disposition: matchCandidateDispositionPgEnum('disposition').notNull().default('pending'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    foreignKey({
      name: 'match_candidates_match_run_id_fk',
      columns: [table.matchRunId],
      foreignColumns: [matchRun.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'match_candidates_buyer_universe_candidate_id_fk',
      columns: [table.buyerUniverseCandidateId],
      foreignColumns: [buyerUniverseCandidates.id],
    }).onDelete('cascade'),

    /** Run-scoped candidate listing: WHERE match_run_id = $1. */
    index('match_candidates_run_id_idx').on(table.matchRunId),

    /**
     * Disposition-scoped query: WHERE match_run_id = $1 AND disposition = 'accepted'.
     * Used by handoffAsActor's guard (count accepted).
     */
    index('match_candidates_run_disposition_idx').on(table.matchRunId, table.disposition),

    /**
     * fit_score CHECK (0–100): drizzle-kit may omit the CHECK constraint.
     * It is hand-appended in migration 0009 after table creation.
     */
    check('match_candidates_fit_score_check', sql`fit_score >= 0 AND fit_score <= 100`),
  ]
);
