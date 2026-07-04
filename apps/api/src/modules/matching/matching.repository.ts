/**
 * MatchingRepository — Drizzle queries for the match spine.
 *
 * Covers:
 *   - match_run CRUD (upsert/get-or-create by buyer_universe_id, find by id,
 *     find by mandate, update status, update ready_for_outreach)
 *   - match_candidates batch insert + update disposition + list by run
 *   - buyer_universe read (validate status='submitted' before scoring)
 *   - buyer_universe_candidates read ('included' set the scorer uses)
 *   - M3 companies + contacts read (read-only — never writes sourcing tables)
 *   - mandate_buyer_criteria read (scoring criteria)
 *   - Transaction composition (runInTransaction for the service)
 *
 * All table writes catch pg FK/unique violations by unwrapping
 * err.cause.code (DrizzleQueryError wrapper) before falling back to err.code
 * (bare pg driver) — the wave-6 DrizzleQueryError lesson.
 *
 * Business logic, audit, and role checks live in MatchingService — this
 * class is a pure Drizzle query repository.
 *
 * HARD BOUNDARY: NO Anthropic/Claude/LLM import. NO BullMQ. PURE DATA ACCESS.
 */

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { buyerUniverse, buyerUniverseCandidates } from '../../db/schema/buyer-universe';
import { mandateBuyerCriteria } from '../../db/schema/mandate';
import { matchCandidates, matchRun } from '../../db/schema/matching';
import { companies, contacts } from '../../db/schema/sourcing';

export type MatchRunRow = typeof matchRun.$inferSelect;
export type MatchCandidateRow = typeof matchCandidates.$inferSelect;
export type BuyerUniverseRow = typeof buyerUniverse.$inferSelect;
export type BuyerUniverseCandidateRow = typeof buyerUniverseCandidates.$inferSelect;
export type CompanyRow = typeof companies.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type MandateBuyerCriteriaRow = typeof mandateBuyerCriteria.$inferSelect;

/** Tx type for transaction-composable writes (used by MatchingService). */
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
export class MatchingRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Transaction helper
  // ---------------------------------------------------------------------------

  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  // ---------------------------------------------------------------------------
  // Advisory lock (defense-in-depth — mirrors buyer-universe pattern)
  // ---------------------------------------------------------------------------

  /**
   * acquireUniverseAdvisoryLockInTx — acquires a per-universe pg_advisory_xact_lock.
   * Defense-in-depth against concurrent createRunAsActor calls.
   * The DB UNIQUE on buyer_universe_id is the authoritative guard; the advisory
   * lock prevents two concurrent first-inserts from both trying the ON CONFLICT path.
   */
  async acquireUniverseAdvisoryLockInTx(tx: Tx, universeId: string): Promise<void> {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${universeId}))`);
  }

  // ---------------------------------------------------------------------------
  // buyer_universe reads (validate status='submitted' before scoring)
  // ---------------------------------------------------------------------------

  /**
   * findBuyerUniverseByMandateIdInTx — returns the buyer_universe for a mandate.
   * Returns null if not found.
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
   * findBuyerUniverseByIdInTx — returns the buyer_universe by id.
   * Returns null if not found.
   */
  async findBuyerUniverseByIdInTx(tx: Tx, universeId: string): Promise<BuyerUniverseRow | null> {
    const rows = await tx
      .select()
      .from(buyerUniverse)
      .where(eq(buyerUniverse.id, universeId))
      .limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // buyer_universe_candidates reads ('included' set for scoring)
  // ---------------------------------------------------------------------------

  /**
   * listIncludedCandidatesInTx — returns all 'included' candidates for a universe.
   * These are the candidates that the pure scorer will run on.
   */
  async listIncludedCandidatesInTx(
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

  // ---------------------------------------------------------------------------
  // M3 companies + contacts reads (read-only — never writes sourcing tables)
  // ---------------------------------------------------------------------------

  /**
   * findCompaniesByIdsInTx — returns companies by id array (in-tx consistent snapshot).
   * Used to build the company map for scoring.
   */
  async findCompaniesByIdsInTx(tx: Tx, companyIds: string[]): Promise<CompanyRow[]> {
    if (companyIds.length === 0) return [];
    return tx.select().from(companies).where(inArray(companies.id, companyIds));
  }

  /**
   * findContactsByCompanyIdsInTx — returns contacts for a list of company ids (in-tx).
   * Used to get contact completeness data for scoring.
   */
  async findContactsByCompanyIdsInTx(tx: Tx, companyIds: string[]): Promise<ContactRow[]> {
    if (companyIds.length === 0) return [];
    return tx.select().from(contacts).where(inArray(contacts.companyId, companyIds));
  }

  // ---------------------------------------------------------------------------
  // mandate_buyer_criteria reads
  // ---------------------------------------------------------------------------

  /**
   * findBuyerCriteriaByMandateIdInTx — returns the mandate's buyer criteria.
   * Returns null if no criteria row exists (no criteria = no restriction).
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
  // match_run CRUD
  // ---------------------------------------------------------------------------

  /**
   * upsertMatchRunInTx — get-or-create match_run for a buyer_universe (idempotent).
   *
   * Uses ON CONFLICT (buyer_universe_id) DO UPDATE SET buyer_universe_id=EXCLUDED.buyer_universe_id
   * so two concurrent first-inserts resolve to exactly one row (the DB UNIQUE on
   * buyer_universe_id makes the second concurrent insert hit the ON CONFLICT path).
   *
   * Returns { run, isNew } — isNew=true means this call created the row.
   */
  async upsertMatchRunInTx(
    tx: Tx,
    input: {
      mandateId: string;
      buyerUniverseId: string;
      createdBy: string;
    }
  ): Promise<{ run: MatchRunRow; isNew: boolean }> {
    let rows: MatchRunRow[];
    try {
      rows = await tx
        .insert(matchRun)
        .values({
          mandateId: input.mandateId,
          buyerUniverseId: input.buyerUniverseId,
          createdBy: input.createdBy,
        })
        .onConflictDoUpdate({
          target: matchRun.buyerUniverseId,
          // No-op update to force RETURNING the existing row.
          set: { buyerUniverseId: sql`EXCLUDED.buyer_universe_id` },
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      // 23503 = foreign_key_violation (mandate_id, universe_id, or created_by not found)
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation upserting match_run: mandate, universe, or user not found'
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('MatchingRepository: UPSERT match_run returned no row');
    }
    // isNew: updatedAt is null on a fresh insert; on ON CONFLICT DO UPDATE the
    // $onUpdateFn fires setting it. This is best-effort (used only for audit metadata).
    const isNew = row.updatedAt === null;
    return { run: row, isNew };
  }

  /**
   * findMatchRunById — look up a match run by UUID.
   * Returns null if not found (service maps to 404).
   */
  async findMatchRunById(id: string): Promise<MatchRunRow | null> {
    const rows = await this.db.select().from(matchRun).where(eq(matchRun.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * findMatchRunByIdInTx — transaction-aware match run lookup.
   */
  async findMatchRunByIdInTx(tx: Tx, id: string): Promise<MatchRunRow | null> {
    const rows = await tx.select().from(matchRun).where(eq(matchRun.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * listMatchRunsByMandateId — returns all match runs for a mandate.
   */
  async listMatchRunsByMandateId(mandateId: string): Promise<MatchRunRow[]> {
    return this.db
      .select()
      .from(matchRun)
      .where(eq(matchRun.mandateId, mandateId))
      .orderBy(sql`${matchRun.createdAt} DESC`);
  }

  /**
   * updateMatchRunStatusInTx — sets status to 'scored' after all candidates are inserted.
   * Called at end of the createRunAsActor transaction.
   */
  async updateMatchRunStatusInTx(
    tx: Tx,
    runId: string,
    status: 'pending' | 'scored'
  ): Promise<MatchRunRow> {
    const rows = await tx
      .update(matchRun)
      .set({ status })
      .where(eq(matchRun.id, runId))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Match run ${runId} not found`);
    }
    return row;
  }

  /**
   * updateMatchRunReadyForOutreachInTx — sets ready_for_outreach=true.
   * Called by handoffAsActor after the ≥1-accepted guard passes.
   */
  async updateMatchRunReadyForOutreachInTx(tx: Tx, runId: string): Promise<MatchRunRow> {
    const rows = await tx
      .update(matchRun)
      .set({ readyForOutreach: true })
      .where(eq(matchRun.id, runId))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Match run ${runId} not found`);
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // match_candidates CRUD
  // ---------------------------------------------------------------------------

  /**
   * insertMatchCandidatesBatch — batch-inserts scored candidates for a run.
   * Called inside the createRunAsActor transaction after scoring all included candidates.
   * No ON CONFLICT needed here (the run is always fresh from upsertMatchRunInTx;
   * on idempotent re-run the existing run's candidates are replaced via deletions
   * done before re-scoring — or more simply: the upsert returns the same run_id
   * and we INSERT fresh candidates; duplicate prevention is by the run being unique).
   *
   * Note: for true idempotency on re-run (same universe → same run), candidates
   * are DELETE'd from the run before re-INSERT in createRunAsActor.
   */
  async insertMatchCandidatesBatch(
    tx: Tx,
    candidates: Array<{
      matchRunId: string;
      buyerUniverseCandidateId: string;
      fitScore: number;
      scoreBreakdown: Record<string, unknown>;
    }>
  ): Promise<MatchCandidateRow[]> {
    if (candidates.length === 0) return [];
    try {
      return await tx
        .insert(matchCandidates)
        .values(
          candidates.map((c) => ({
            matchRunId: c.matchRunId,
            buyerUniverseCandidateId: c.buyerUniverseCandidateId,
            fitScore: c.fitScore,
            scoreBreakdown: c.scoreBreakdown,
          }))
        )
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation inserting match_candidates: run or universe candidate not found'
        );
      }
      throw err;
    }
  }

  /**
   * deleteMatchCandidatesByRunIdInTx — removes all existing candidates for a run.
   * Used during idempotent re-run to clear stale scores before re-inserting.
   */
  async deleteMatchCandidatesByRunIdInTx(tx: Tx, runId: string): Promise<void> {
    await tx.delete(matchCandidates).where(eq(matchCandidates.matchRunId, runId));
  }

  /**
   * listMatchCandidatesByRunId — returns all candidates for a run, ordered fit_score DESC.
   * Used by getRun / listByMandate to return the ranked list.
   */
  async listMatchCandidatesByRunId(runId: string): Promise<MatchCandidateRow[]> {
    return this.db
      .select()
      .from(matchCandidates)
      .where(eq(matchCandidates.matchRunId, runId))
      .orderBy(sql`${matchCandidates.fitScore} DESC`);
  }

  /**
   * listMatchCandidatesByRunIdInTx — tx-aware version for consistent snapshots.
   */
  async listMatchCandidatesByRunIdInTx(tx: Tx, runId: string): Promise<MatchCandidateRow[]> {
    return tx
      .select()
      .from(matchCandidates)
      .where(eq(matchCandidates.matchRunId, runId))
      .orderBy(sql`${matchCandidates.fitScore} DESC`);
  }

  /**
   * listAcceptedMatchCandidatesByRunId — returns only 'accepted' candidates, fit_score DESC.
   * Used by getShortlist.
   */
  async listAcceptedMatchCandidatesByRunId(runId: string): Promise<MatchCandidateRow[]> {
    return this.db
      .select()
      .from(matchCandidates)
      .where(
        and(eq(matchCandidates.matchRunId, runId), eq(matchCandidates.disposition, 'accepted'))
      )
      .orderBy(sql`${matchCandidates.fitScore} DESC`);
  }

  /**
   * countAcceptedCandidatesByRunId — returns the count of 'accepted' candidates.
   * Used by handoffAsActor's ≥1-accepted guard (BUILD rule 6).
   */
  async countAcceptedCandidatesByRunId(runId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(matchCandidates)
      .where(
        and(eq(matchCandidates.matchRunId, runId), eq(matchCandidates.disposition, 'accepted'))
      );
    return result[0]?.count ?? 0;
  }

  /**
   * updateCandidateDispositionScoped — updates the disposition for a single candidate,
   * scoped to a specific run (cross-run guard — wave-9 lesson).
   *
   * The predicate is: id = $candidateId AND match_run_id = $runId.
   * Returns null if no row matched (candidate does not belong to the given run).
   * The service maps null → 404 so callers cannot patch candidates from other runs.
   */
  async updateCandidateDispositionScoped(
    tx: Tx,
    runId: string,
    candidateId: string,
    disposition: 'pending' | 'accepted' | 'rejected' | 'flagged'
  ): Promise<MatchCandidateRow | null> {
    const rows = await tx
      .update(matchCandidates)
      .set({ disposition })
      .where(and(eq(matchCandidates.id, candidateId), eq(matchCandidates.matchRunId, runId)))
      .returning();
    return rows[0] ?? null;
  }
}
