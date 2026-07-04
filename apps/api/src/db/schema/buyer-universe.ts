import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { mandates } from './mandate';
import { companies } from './sourcing';
import { users } from './users-roles';

/**
 * Wave-9 buyer-universe spine (B-0, task 92a8ff3f).
 *
 * Two MUTABLE tables:
 *   1. buyer_universe           — top-level universe record (1:1 per mandate for now)
 *   2. buyer_universe_candidates — per-company candidates with lifecycle status
 *
 * DESIGN INVARIANTS:
 *   - buyer_universe has 1 row per mandate (enforced at the service level via UPSERT;
 *     no DB UNIQUE on mandate_id — allows re-assemble idempotence without conflict).
 *   - buyer_universe_candidates has a PLAIN COMPOSITE UNIQUE on
 *     (buyer_universe_id, company_id) — both NOT NULL, no partial WHERE.
 *     This ensures idempotent re-assemble: inserting the same company a second
 *     time hits ON CONFLICT DO NOTHING and is a safe no-op.
 *   - created_by references users.id (app UUID, NOT supertokens_user_id). The
 *     service translates via AuthRepository.getUserWithRole (wave-5 actor-id-FK lesson).
 *   - company_id references the M3 canonical companies table (read-only consumer;
 *     BuyerUniverseService never writes to companies).
 *
 * M4/M5 BOUNDARY:
 *   NO score / rank / fit column exists on either table. Those belong to M5 (ranking).
 *   Any schema addition that adds such columns must be rejected at B-6 gate.
 *
 * Additive-only — no existing table is altered.
 */

// ---------------------------------------------------------------------------
// pgEnum: buyer_universe_status
// ---------------------------------------------------------------------------

/**
 * buyer_universe_status — lifecycle of a buyer universe assembly.
 *   draft     — default on creation; assemble has run but filter has not.
 *   filtered  — filter step completed; candidates have include/exclude status.
 *   submitted — ready-to-rank (M5 handoff); submit step completed.
 */
export const buyerUniverseStatusPgEnum = pgEnum('buyer_universe_status', [
  'draft',
  'filtered',
  'submitted',
]);

// ---------------------------------------------------------------------------
// pgEnum: buyer_universe_candidate_membership_status
// ---------------------------------------------------------------------------

/**
 * buyer_universe_candidate_membership_status — per-candidate filter decision.
 *   candidate — default; not yet filtered.
 *   included  — passed the mandate's buyer criteria filter.
 *   excluded  — failed one or more filter dimensions.
 */
export const buyerUniverseCandidateMembershipStatusPgEnum = pgEnum(
  'buyer_universe_candidate_membership_status',
  ['candidate', 'included', 'excluded']
);

// ---------------------------------------------------------------------------
// 1. buyer_universe
// ---------------------------------------------------------------------------

/**
 * buyer_universe — the top-level buyer universe record.
 *
 * mandate_id: NOT NULL FK to mandates.id. A universe is assembled for a
 *   specific mandate. ON DELETE CASCADE — deleting the mandate also deletes
 *   its universe (and candidates via the cascade chain).
 *
 * created_by: NOT NULL FK to users.id (app UUID). SET to restrict on user
 *   deletion (universe records must outlive their creator for recordkeeping).
 *
 * status: default 'draft' — transitions via filter → filtered, submit → submitted.
 *
 * updated_at: application-layer clock via Drizzle's .$onUpdateFn.
 *   NULL until first update.
 */
export const buyerUniverse = pgTable(
  'buyer_universe',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /**
     * FK → mandates.id — which mandate this universe belongs to.
     * The BuyerUniverseService creates at most one universe per mandate
     * (UPSERTs by mandate_id at the service level). ON DELETE CASCADE.
     */
    mandateId: uuid('mandate_id').notNull(),

    /**
     * App users.id of the advisor who assembled the universe.
     * The BuyerUniverseService translates the session's ST id via getUserWithRole
     * before this FK is populated. The wave-5 actor-id-FK lesson.
     */
    createdBy: uuid('created_by').notNull(),

    /**
     * Lifecycle status. 'draft' on creation; transitions to 'filtered' after
     * filterAsActor, and 'submitted' after submitAsActor.
     */
    status: buyerUniverseStatusPgEnum('status').notNull().default('draft'),

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
      name: 'buyer_universe_mandate_id_fk',
      columns: [table.mandateId],
      foreignColumns: [mandates.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'buyer_universe_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('restrict'),

    /**
     * One-universe-per-mandate: a mandate has exactly one buyer universe.
     * Enforced at the DB level to prevent duplicate universes under concurrent
     * assembleAsActor calls (CRITICAL-3). The service also acquires a
     * pg_advisory_xact_lock(hashtext($mandateId)) before the find-or-insert for
     * defense-in-depth.
     */
    unique('buyer_universe_mandate_id_unique').on(table.mandateId),

    /** Mandate-scoped lookup: find the universe for a given mandate. */
    index('buyer_universe_mandate_id_idx').on(table.mandateId),

    /** Status-scoped listing: WHERE status = $1. */
    index('buyer_universe_status_idx').on(table.status),
  ]
);

// ---------------------------------------------------------------------------
// 2. buyer_universe_candidates
// ---------------------------------------------------------------------------

/**
 * buyer_universe_candidates — per-company candidates within a buyer universe.
 *
 * buyer_universe_id: NOT NULL FK to buyer_universe.id. ON DELETE CASCADE.
 *
 * company_id: NOT NULL FK to companies.id (the M3 canonical company). ON DELETE
 *   CASCADE — if the canonical company is deleted, remove it from universes.
 *
 * membership_status: per-candidate filter decision. Default 'candidate'.
 *   Set to 'included' or 'excluded' by filterAsActor.
 *
 * provenance: free-text field explaining how/why this candidate landed here
 *   (e.g. 'assembled from sourcing', 'excluded: industry mismatch').
 *   Nullable — populated at assemble and enriched at filter.
 *
 * COMPOSITE UNIQUE on (buyer_universe_id, company_id):
 *   Plain composite unique — both columns are NOT NULL; NO partial WHERE.
 *   Enables idempotent re-assemble: inserting the same (universe, company)
 *   pair a second time hits ON CONFLICT DO NOTHING and is a safe no-op.
 *   (jenny LOW clarification: plain composite unique, not partial.)
 *
 * M4/M5 BOUNDARY: NO score / rank / fit column. These belong to M5 (ranking).
 */
export const buyerUniverseCandidates = pgTable(
  'buyer_universe_candidates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → buyer_universe.id — which universe this candidate belongs to. */
    buyerUniverseId: uuid('buyer_universe_id').notNull(),

    /**
     * FK → companies.id — the M3 canonical company (prospective buyer).
     * BuyerUniverseService is a READ-ONLY consumer of the companies table:
     * it selects from companies but never INSERTs/UPDATEs/DELETEs there.
     */
    companyId: uuid('company_id').notNull(),

    /**
     * Per-candidate filter decision. Default 'candidate' on assemble.
     * Set to 'included' or 'excluded' by filterAsActor after applying
     * the mandate's mandateBuyerCriteria dimensions.
     */
    membershipStatus: buyerUniverseCandidateMembershipStatusPgEnum('membership_status')
      .notNull()
      .default('candidate'),

    /**
     * Free-text provenance / reason string.
     * Populated at assemble (e.g. 'assembled from sourcing').
     * Updated at filter (e.g. 'included: industry match', 'excluded: geo mismatch').
     * Nullable — may be absent for edge-case candidates.
     */
    provenance: text('provenance'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    foreignKey({
      name: 'buyer_universe_candidates_buyer_universe_id_fk',
      columns: [table.buyerUniverseId],
      foreignColumns: [buyerUniverse.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'buyer_universe_candidates_company_id_fk',
      columns: [table.companyId],
      foreignColumns: [companies.id],
    }).onDelete('cascade'),

    /**
     * Idempotent re-assemble backstop: plain composite UNIQUE on
     * (buyer_universe_id, company_id) — both NOT NULL, no partial WHERE.
     * INSERT ... ON CONFLICT DO NOTHING makes re-assemble safe.
     */
    unique('buyer_universe_candidates_universe_company_unique').on(
      table.buyerUniverseId,
      table.companyId
    ),

    /** Universe-scoped candidate listing: WHERE buyer_universe_id = $1. */
    index('buyer_universe_candidates_universe_id_idx').on(table.buyerUniverseId),

    /**
     * Membership-filter index: WHERE buyer_universe_id = $1
     *   AND membership_status = 'included' (used by enrich + gaps queries).
     */
    index('buyer_universe_candidates_status_idx').on(table.buyerUniverseId, table.membershipStatus),
  ]
);
