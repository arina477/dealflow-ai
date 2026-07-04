/**
 * BuyerUniverseRepository — Drizzle queries for the buyer-universe spine.
 *
 * Covers:
 *   - buyer_universe CRUD (upsert/get-or-create, find by id, find by mandate, update status)
 *   - buyer_universe_candidates insert (onConflictDoNothing for idempotent re-assemble),
 *     update membership_status, list with contacts join (enrich)
 *   - Transaction composition (runInTransaction for the service)
 *
 * M3 reads (companies, contacts): read-only. This repository NEVER writes to
 * the companies or contacts tables.
 *
 * All table writes catch pg FK/unique violations by unwrapping
 * err.cause.code (DrizzleQueryError wrapper) before falling back to err.code
 * (bare pg driver) — the wave-6 DrizzleQueryError lesson.
 *
 * Business logic, audit, and role checks live in BuyerUniverseService — this
 * class is a pure Drizzle query repository.
 */

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { buyerUniverse, buyerUniverseCandidates } from '../../db/schema/buyer-universe';
import { mandateBuyerCriteria, mandates } from '../../db/schema/mandate';
import { companies, contacts } from '../../db/schema/sourcing';

export type BuyerUniverseRow = typeof buyerUniverse.$inferSelect;
export type BuyerUniverseCandidateRow = typeof buyerUniverseCandidates.$inferSelect;
export type MandateRow = typeof mandates.$inferSelect;
export type MandateBuyerCriteriaRow = typeof mandateBuyerCriteria.$inferSelect;
export type CompanyRow = typeof companies.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;

/** Tx type for transaction-composable writes (used by BuyerUniverseService). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Extract the pg error code from either:
 *   err.cause.code — DrizzleQueryError wraps the native pg error in .cause
 *   err.code       — bare pg driver error (e.g. connection-level throws)
 *
 * The wave-6 DrizzleQueryError lesson: drizzle-orm wraps query errors in a
 * DrizzleQueryError whose own `.code` is undefined; the SQLSTATE lives on
 * err.cause.code. Check both so the catch branch fires regardless of wrapper.
 */
function pgCode(err: unknown): string | undefined {
  const causeCode =
    typeof err === 'object' &&
    err !== null &&
    'cause' in err &&
    typeof (err as { cause: unknown }).cause === 'object' &&
    (err as { cause: unknown }).cause !== null &&
    'code' in (err as { cause: Record<string, unknown> }).cause
      ? (err as { cause: Record<string, unknown> }).cause.code
      : undefined;

  const directCode =
    typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code: unknown }).code
      : undefined;

  return (causeCode ?? directCode) as string | undefined;
}

@Injectable()
export class BuyerUniverseRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Transaction helper
  // ---------------------------------------------------------------------------

  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  // ---------------------------------------------------------------------------
  // Mandate + buyer criteria reads (M4 — read-only)
  // ---------------------------------------------------------------------------

  /**
   * findMandateById — look up a mandate by UUID (read-only; used for criteria).
   * Returns null if not found.
   */
  async findMandateById(id: string): Promise<MandateRow | null> {
    const rows = await this.db.select().from(mandates).where(eq(mandates.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * findMandateByIdInTx — transaction-aware mandate lookup.
   */
  async findMandateByIdInTx(tx: Tx, id: string): Promise<MandateRow | null> {
    const rows = await tx.select().from(mandates).where(eq(mandates.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * findBuyerCriteriaByMandateId — returns the buyer criteria for a mandate (read-only).
   * Returns null if no row exists.
   */
  async findBuyerCriteriaByMandateId(mandateId: string): Promise<MandateBuyerCriteriaRow | null> {
    const rows = await this.db
      .select()
      .from(mandateBuyerCriteria)
      .where(eq(mandateBuyerCriteria.mandateId, mandateId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findBuyerCriteriaByMandateIdInTx — transaction-aware buyer criteria lookup.
   */
  async findBuyerCriteriaByMandateIdInTx(
    tx: Tx,
    mandateId: string
  ): Promise<MandateBuyerCriteriaRow | null> {
    const rows = await tx
      .select()
      .from(mandateBuyerCriteria)
      .where(eq(mandateBuyerCriteria.mandateId, mandateId))
      .limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // M3 companies read (read-only)
  // ---------------------------------------------------------------------------

  /**
   * listActiveCompanies — returns all active canonical companies from M3.
   * Used by assembleAsActor to build the initial candidate pool.
   * This repository NEVER writes to the companies table.
   */
  async listActiveCompanies(): Promise<CompanyRow[]> {
    return this.db
      .select()
      .from(companies)
      .where(eq(companies.status, 'active'))
      .orderBy(sql`${companies.name} ASC`);
  }

  /**
   * listActiveCompaniesInTx — transaction-aware active company listing.
   * orderBy name ASC — presentation-stability only; NO ranking semantics
   * (M5 owns ranking). Never interpret this order as fit/score order.
   */
  async listActiveCompaniesInTx(tx: Tx): Promise<CompanyRow[]> {
    return tx
      .select()
      .from(companies)
      .where(eq(companies.status, 'active'))
      .orderBy(sql`${companies.name} ASC`);
  }

  // ---------------------------------------------------------------------------
  // M3 contacts read (read-only)
  // ---------------------------------------------------------------------------

  /**
   * findContactsByCompanyIds — returns contacts for a list of company UUIDs.
   * Used by enrichAsActor to attach contacts to included candidates.
   * This repository NEVER writes to the contacts table.
   */
  async findContactsByCompanyIds(companyIds: string[]): Promise<ContactRow[]> {
    if (companyIds.length === 0) return [];
    return this.db.select().from(contacts).where(inArray(contacts.companyId, companyIds));
  }

  /**
   * findContactsByCompanyIdsInTx — transaction-aware contacts lookup (CRITICAL-5).
   * Must be used inside runInTransaction so the snapshot is consistent with other
   * in-tx reads (listIncludedCandidatesByUniverseIdInTx, findBuyerUniverseByIdInTx).
   */
  async findContactsByCompanyIdsInTx(tx: Tx, companyIds: string[]): Promise<ContactRow[]> {
    if (companyIds.length === 0) return [];
    return tx.select().from(contacts).where(inArray(contacts.companyId, companyIds));
  }

  // ---------------------------------------------------------------------------
  // buyer_universe CRUD
  // ---------------------------------------------------------------------------

  /**
   * acquireMandateAdvisoryLockInTx — acquires a per-mandate pg_advisory_xact_lock.
   * Defense-in-depth against concurrent assembleAsActor calls (CRITICAL-3).
   * The DB UNIQUE on mandate_id is the authoritative guard; the advisory lock
   * prevents two concurrent first-inserts from both trying the ON CONFLICT path.
   * Lock is released automatically at transaction end.
   */
  async acquireMandateAdvisoryLockInTx(tx: Tx, mandateId: string): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${mandateId}))`);
  }

  /**
   * upsertBuyerUniverseInTx — get-or-create buyer_universe for a mandate (CRITICAL-3).
   *
   * Uses ON CONFLICT (mandate_id) DO UPDATE SET mandate_id=EXCLUDED.mandate_id RETURNING
   * so two concurrent first-inserts resolve to exactly one row (the DB UNIQUE on
   * mandate_id makes the second concurrent insert hit the ON CONFLICT path).
   *
   * Returns { universe, isNew } — isNew=true means this call created the row.
   */
  async upsertBuyerUniverseInTx(
    tx: Tx,
    input: {
      mandateId: string;
      createdBy: string;
    }
  ): Promise<{ universe: BuyerUniverseRow; isNew: boolean }> {
    let rows: BuyerUniverseRow[];
    try {
      rows = await tx
        .insert(buyerUniverse)
        .values({
          mandateId: input.mandateId,
          createdBy: input.createdBy,
        })
        .onConflictDoUpdate({
          target: buyerUniverse.mandateId,
          // No-op update to force RETURNING the existing row.
          set: { mandateId: sql`EXCLUDED.mandate_id` },
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      // 23503 = foreign_key_violation (mandate_id or created_by not found)
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation upserting buyer_universe: mandate or user not found'
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('BuyerUniverseRepository: UPSERT buyer_universe returned no row');
    }
    // isNew: if created_at equals updated_at (null) and createdBy matches input,
    // this was a fresh insert. A simpler heuristic: the row's updatedAt is null
    // on a fresh insert; on an ON CONFLICT DO UPDATE it would get the $onUpdateFn
    // trigger applied — but since the set is a no-op UPDATE, Drizzle's $onUpdateFn
    // does fire. We distinguish by checking if the row's createdBy matches our input
    // — but that's unreliable for existing rows. Use a safer approach: try INSERT
    // INTO then check RETURNING via xmax (0 = inserted, >0 = updated).
    // Simpler and safe: re-read from returning. The `updatedAt` is null only on
    // a brand-new row (first insert). On DO UPDATE, $onUpdateFn fires.
    const isNew = row.updatedAt === null && row.createdBy === input.createdBy;
    // Note: isNew is best-effort (used only for audit metadata, not for correctness).
    // The important correctness invariant is that exactly one universe row exists.
    return { universe: row, isNew };
  }

  /**
   * findBuyerUniverseByMandateIdInTx — find existing universe for a mandate (in tx).
   * Returns null if none exists.
   */
  async findBuyerUniverseByMandateIdInTx(
    tx: Tx,
    mandateId: string
  ): Promise<BuyerUniverseRow | null> {
    const rows = await tx
      .select()
      .from(buyerUniverse)
      .where(eq(buyerUniverse.mandateId, mandateId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findBuyerUniverseById — look up a universe by UUID.
   * Returns null if not found (service maps to 404).
   */
  async findBuyerUniverseById(id: string): Promise<BuyerUniverseRow | null> {
    const rows = await this.db
      .select()
      .from(buyerUniverse)
      .where(eq(buyerUniverse.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findBuyerUniverseByIdInTx — transaction-aware universe lookup.
   */
  async findBuyerUniverseByIdInTx(tx: Tx, id: string): Promise<BuyerUniverseRow | null> {
    const rows = await tx.select().from(buyerUniverse).where(eq(buyerUniverse.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * listBuyerUniversesByMandateId — returns all universes for a given mandate.
   * With the mandate_id UNIQUE constraint there will be at most 1 row, but
   * the method signature is kept as an array for API compatibility.
   */
  async listBuyerUniversesByMandateId(mandateId: string): Promise<BuyerUniverseRow[]> {
    return this.db
      .select()
      .from(buyerUniverse)
      .where(eq(buyerUniverse.mandateId, mandateId))
      .orderBy(sql`${buyerUniverse.createdAt} DESC`);
  }

  /**
   * updateBuyerUniverseStatus — updates the status of a universe (draft → filtered → submitted).
   * Called inside a transaction for atomicity with the audit append.
   */
  async updateBuyerUniverseStatus(
    tx: Tx,
    id: string,
    status: 'draft' | 'filtered' | 'submitted'
  ): Promise<BuyerUniverseRow> {
    const rows = await tx
      .update(buyerUniverse)
      .set({ status })
      .where(eq(buyerUniverse.id, id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Buyer universe ${id} not found`);
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // buyer_universe_candidates CRUD
  // ---------------------------------------------------------------------------

  /**
   * insertCandidatesBatchCountNew — batch-inserts candidates for a universe and
   * returns the count of newly inserted rows (CRITICAL-7).
   *
   * Uses ON CONFLICT DO NOTHING on the composite unique (buyer_universe_id, company_id)
   * to make re-assemble idempotent: re-inserting the same (universe, company) pair
   * is a safe no-op. The count of new rows lets assembleAsActor decide whether to
   * reset universe status → 'draft' (re-assemble added companies to a non-draft universe).
   */
  async insertCandidatesBatchCountNew(
    tx: Tx,
    candidates: Array<{
      buyerUniverseId: string;
      companyId: string;
      provenance: string;
    }>
  ): Promise<number> {
    if (candidates.length === 0) return 0;
    let inserted: { id: string }[] = [];
    try {
      inserted = await tx
        .insert(buyerUniverseCandidates)
        .values(
          candidates.map((c) => ({
            buyerUniverseId: c.buyerUniverseId,
            companyId: c.companyId,
            provenance: c.provenance,
          }))
        )
        .onConflictDoNothing()
        .returning({ id: buyerUniverseCandidates.id });
    } catch (err: unknown) {
      const code = pgCode(err);
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation inserting buyer_universe_candidates: universe or company not found'
        );
      }
      throw err;
    }
    return inserted.length;
  }

  /**
   * insertCandidatesBatch — batch-inserts candidates for a universe.
   * Uses ON CONFLICT DO NOTHING on the composite unique (buyer_universe_id, company_id)
   * to make re-assemble idempotent: re-inserting the same (universe, company) pair
   * is a safe no-op.
   *
   * @deprecated Use insertCandidatesBatchCountNew when the new-count is needed.
   */
  async insertCandidatesBatch(
    tx: Tx,
    candidates: Array<{
      buyerUniverseId: string;
      companyId: string;
      provenance: string;
    }>
  ): Promise<void> {
    await this.insertCandidatesBatchCountNew(tx, candidates);
  }

  /**
   * listCandidatesByUniverseId — returns all candidates for a universe.
   */
  async listCandidatesByUniverseId(universeId: string): Promise<BuyerUniverseCandidateRow[]> {
    return this.db
      .select()
      .from(buyerUniverseCandidates)
      .where(eq(buyerUniverseCandidates.buyerUniverseId, universeId))
      .orderBy(sql`${buyerUniverseCandidates.createdAt} ASC`);
  }

  /**
   * listCandidatesByUniverseIdInTx — transaction-aware candidate listing.
   */
  async listCandidatesByUniverseIdInTx(
    tx: Tx,
    universeId: string
  ): Promise<BuyerUniverseCandidateRow[]> {
    return tx
      .select()
      .from(buyerUniverseCandidates)
      .where(eq(buyerUniverseCandidates.buyerUniverseId, universeId))
      .orderBy(sql`${buyerUniverseCandidates.createdAt} ASC`);
  }

  /**
   * listIncludedCandidatesByUniverseId — returns only 'included' candidates.
   * Used by getGaps (not inside a transaction).
   */
  async listIncludedCandidatesByUniverseId(
    universeId: string
  ): Promise<BuyerUniverseCandidateRow[]> {
    return this.db
      .select()
      .from(buyerUniverseCandidates)
      .where(
        and(
          eq(buyerUniverseCandidates.buyerUniverseId, universeId),
          eq(buyerUniverseCandidates.membershipStatus, 'included')
        )
      )
      .orderBy(sql`${buyerUniverseCandidates.createdAt} ASC`);
  }

  /**
   * listIncludedCandidatesByUniverseIdInTx — transaction-aware included candidates listing.
   * CRITICAL-5: use this inside runInTransaction so the snapshot is consistent with
   * other in-tx reads (findBuyerUniverseByIdInTx, findContactsByCompanyIdsInTx).
   */
  async listIncludedCandidatesByUniverseIdInTx(
    tx: Tx,
    universeId: string
  ): Promise<BuyerUniverseCandidateRow[]> {
    return tx
      .select()
      .from(buyerUniverseCandidates)
      .where(
        and(
          eq(buyerUniverseCandidates.buyerUniverseId, universeId),
          eq(buyerUniverseCandidates.membershipStatus, 'included')
        )
      )
      .orderBy(sql`${buyerUniverseCandidates.createdAt} ASC`);
  }

  /**
   * updateCandidateMembership — updates membership_status and/or provenance
   * for a single candidate by candidateId only. Called inside a transaction.
   *
   * @deprecated Use updateCandidateMembershipScoped for cross-universe safety (INFO fix).
   */
  async updateCandidateMembership(
    tx: Tx,
    candidateId: string,
    patch: {
      membershipStatus?: 'candidate' | 'included' | 'excluded';
      provenance?: string;
    }
  ): Promise<BuyerUniverseCandidateRow> {
    const updateValues: Record<string, unknown> = {};
    if (patch.membershipStatus !== undefined)
      updateValues.membershipStatus = patch.membershipStatus;
    if (patch.provenance !== undefined) updateValues.provenance = patch.provenance;

    if (Object.keys(updateValues).length === 0) {
      const rows = await tx
        .select()
        .from(buyerUniverseCandidates)
        .where(eq(buyerUniverseCandidates.id, candidateId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new NotFoundException(`Candidate ${candidateId} not found`);
      return row;
    }

    const rows = await tx
      .update(buyerUniverseCandidates)
      .set(updateValues as Partial<typeof buyerUniverseCandidates.$inferInsert>)
      .where(eq(buyerUniverseCandidates.id, candidateId))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Candidate ${candidateId} not found`);
    }
    return row;
  }

  /**
   * updateCandidateMembershipScoped — updates membership_status and/or provenance
   * for a single candidate, scoped to a specific universe (INFO: cross-resource guard).
   *
   * The predicate is: candidateId = $candidateId AND buyer_universe_id = $universeId.
   * Returns null if no row matched (candidate does not belong to the given universe).
   * The service maps null → 404 so callers cannot update candidates from other universes.
   */
  async updateCandidateMembershipScoped(
    tx: Tx,
    universeId: string,
    candidateId: string,
    patch: {
      membershipStatus?: 'candidate' | 'included' | 'excluded';
      provenance?: string;
    }
  ): Promise<BuyerUniverseCandidateRow | null> {
    const updateValues: Record<string, unknown> = {};
    if (patch.membershipStatus !== undefined)
      updateValues.membershipStatus = patch.membershipStatus;
    if (patch.provenance !== undefined) updateValues.provenance = patch.provenance;

    if (Object.keys(updateValues).length === 0) {
      // No-op patch: verify the candidate belongs to this universe.
      const rows = await tx
        .select()
        .from(buyerUniverseCandidates)
        .where(
          and(
            eq(buyerUniverseCandidates.id, candidateId),
            eq(buyerUniverseCandidates.buyerUniverseId, universeId)
          )
        )
        .limit(1);
      return rows[0] ?? null;
    }

    const rows = await tx
      .update(buyerUniverseCandidates)
      .set(updateValues as Partial<typeof buyerUniverseCandidates.$inferInsert>)
      .where(
        and(
          eq(buyerUniverseCandidates.id, candidateId),
          eq(buyerUniverseCandidates.buyerUniverseId, universeId)
        )
      )
      .returning();
    return rows[0] ?? null;
  }

  /**
   * batchUpdateCandidateMembership — updates membership_status + provenance for
   * multiple candidates at once. Used by filterAsActor for bulk include/exclude.
   * Each candidate update is applied individually (Drizzle does not support
   * bulk conditional updates easily) within the same transaction.
   */
  async batchUpdateCandidateMembership(
    tx: Tx,
    updates: Array<{
      id: string;
      membershipStatus: 'included' | 'excluded';
      provenance: string;
    }>
  ): Promise<void> {
    if (updates.length === 0) return;
    await Promise.all(
      updates.map((u) =>
        tx
          .update(buyerUniverseCandidates)
          .set({
            membershipStatus: u.membershipStatus,
            provenance: u.provenance,
          })
          .where(eq(buyerUniverseCandidates.id, u.id))
      )
    );
  }

  /**
   * findCandidateById — look up a single candidate by its UUID.
   * Returns null if not found.
   */
  async findCandidateById(id: string): Promise<BuyerUniverseCandidateRow | null> {
    const rows = await this.db
      .select()
      .from(buyerUniverseCandidates)
      .where(eq(buyerUniverseCandidates.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * countCandidatesByUniverseId — returns the total number of candidates for a universe.
   * @deprecated Use countIncludedCandidatesByUniverseId for submit guard (CRITICAL-4).
   */
  async countCandidatesByUniverseId(universeId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(buyerUniverseCandidates)
      .where(eq(buyerUniverseCandidates.buyerUniverseId, universeId));
    return result[0]?.count ?? 0;
  }

  /**
   * countIncludedCandidatesByUniverseId — returns the count of INCLUDED candidates.
   * CRITICAL-4: the submit guard must check this, not total count, to reject
   * all-excluded universes (0 included, totalCount>0, status='filtered').
   */
  async countIncludedCandidatesByUniverseId(universeId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(buyerUniverseCandidates)
      .where(
        and(
          eq(buyerUniverseCandidates.buyerUniverseId, universeId),
          eq(buyerUniverseCandidates.membershipStatus, 'included')
        )
      );
    return result[0]?.count ?? 0;
  }

  /**
   * countUntriagedCandidatesByUniverseId — returns the count of candidates with
   * membership_status='candidate' (not yet triaged as included|excluded).
   * CRITICAL-7: the submit guard rejects if this is > 0 (re-assemble added companies
   * after filter — must re-filter before submit).
   */
  async countUntriagedCandidatesByUniverseId(universeId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(buyerUniverseCandidates)
      .where(
        and(
          eq(buyerUniverseCandidates.buyerUniverseId, universeId),
          eq(buyerUniverseCandidates.membershipStatus, 'candidate')
        )
      );
    return result[0]?.count ?? 0;
  }
}
