/**
 * MatchingService — orchestration for the match spine.
 *
 * Responsibilities:
 *   1. createRunAsActor     — score a buyer universe's included candidates in ONE txn;
 *                             PRESERVES prior non-'pending' dispositions across re-runs.
 *   2. patchDispositionAsActor — accept/reject/flag a candidate (cross-run scoped).
 *   3. handoffAsActor       — mark ready_for_outreach=true (≥1 accepted guard, idempotent).
 *   4. getRun               — returns MatchRankedList (candidates ordered fit_score DESC).
 *   5. listByMandate        — returns all match runs for a mandate.
 *   6. getShortlist         — returns accepted candidates ordered fit_score DESC.
 *
 * ── HARD BOUNDARY (CRITICAL) ────────────────────────────────────────────────
 * NO Anthropic/Claude/LLM import or call anywhere in this service.
 * NO BullMQ, NO rationale-TEXT field (score_breakdown is structured jsonb).
 * NO API spend. Scoring is the pure deterministic scoreCandidate function.
 * The only "scoring" dependency is matching.scorer.ts — pure, no IO, no LLM.
 *
 * ── Actor identity (wave-5 lesson) ─────────────────────────────────────────
 * ALL users.id FK columns are populated from the APP users.id — NEVER the
 * raw SuperTokens user id from the session. The service translates via
 * AuthRepository.getUserWithRole(supertokensUserId) before any DB write.
 *
 * ── One-txn atomicity ───────────────────────────────────────────────────────
 * createRunAsActor opens ONE transaction: acquires pg_advisory_xact_lock for
 * the universe, validates buyer_universe.status='submitted', upserts match_run
 * (ON CONFLICT buyer_universe_id — idempotent), deletes existing candidates
 * (for idempotent re-score), reads included candidates + companies + contacts +
 * criteria, scores each with the pure scoreCandidate function, inserts all
 * match_candidates, sets run status='scored', audits LAST-IN-TXN.
 *
 * ── Idempotent create-run with disposition preservation ────────────────────
 * ON CONFLICT (buyer_universe_id) DO UPDATE atomically gets-or-creates the
 * match_run. On re-run (same universe), existing candidates are deleted and
 * re-scored (score data is deterministic so re-scoring is safe and idempotent).
 * Prior non-'pending' dispositions (accepted/rejected/flagged) are snapshotted
 * BEFORE the delete, then reconciled back after re-scoring: any candidate still
 * in the included set gets its prior disposition restored; newly-added candidates
 * start as 'pending'; candidates no longer included are dropped.
 *
 * ── Submit-guard (400 if universe not submitted) ─────────────────────────────
 * createRunAsActor verifies buyer_universe.status='submitted' before scoring.
 * Scoring an un-submitted (draft/filtered) universe is rejected with 400.
 *
 * ── Accepted-count handoff-guard ────────────────────────────────────────────
 * handoffAsActor verifies ≥1 ACCEPTED candidate (not total count — BUILD rule 6
 * semantic-predicate on accepted-count). Returns 400 if no accepted candidates.
 * Guard read uses countAcceptedCandidatesByRunIdInTx (tx-aware) so the predicate
 * shares the transaction snapshot (CRITICAL-2: no escaping-read on guard count).
 * Re-handoff on an already-handed-off run returns the current state idempotently
 * without a new audit entry (INFO-B: idempotent re-handoff).
 *
 * ── Cross-run-scoped PATCH ──────────────────────────────────────────────────
 * patchDispositionAsActor scopes the UPDATE to AND match_run_id = $runId.
 * Returns 404 if the candidate does not belong to the given run.
 *
 * ── Audit (last-in-txn) ────────────────────────────────────────────────────
 * AuditService.append is called LAST in every mutating transaction, after all
 * business writes. Audit failure rolls back the whole transaction.
 */

import { createHash } from 'node:crypto';
import type { AuditEntryInput, MatchRankedList, Shortlist } from '@dealflow/shared';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuditService } from '../audit/audit.service';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { AuthRepository } from '../auth/auth.repository';
import type { MatchCandidateRow, MatchRunRow, Tx } from './matching.repository';
// biome-ignore lint/style/useImportType: NestJS DI needs the runtime value (emitDecoratorMetadata)
import { MatchingRepository } from './matching.repository';
import type { ScorerCriteria } from './matching.scorer';
import { scoreCandidate } from './matching.scorer';

@Injectable()
export class MatchingService {
  constructor(
    private readonly repository: MatchingRepository,
    private readonly auditService: AuditService,
    private readonly authRepository: AuthRepository
  ) {}

  // ---------------------------------------------------------------------------
  // composeRankedListInTx — internal helper
  // ---------------------------------------------------------------------------

  /**
   * composeRankedListInTx — read the full MatchRankedList within an open transaction.
   * ALL reads use the tx handle for a consistent snapshot.
   */
  private async composeRankedListInTx(tx: Tx, runId: string): Promise<MatchRankedList> {
    const run = await this.repository.findMatchRunByIdInTx(tx, runId);
    if (!run) {
      throw new NotFoundException(`Match run ${runId} not found`);
    }
    const candidates = await this.repository.listMatchCandidatesByRunIdInTx(tx, runId);
    return { run: this.serializeRun(run), candidates: candidates.map(this.serializeCandidate) };
  }

  // ---------------------------------------------------------------------------
  // createRunAsActor
  // ---------------------------------------------------------------------------

  /**
   * createRunAsActor — create/re-score a match run for a mandate's buyer universe.
   *
   * Steps (all in ONE tx):
   *   1. Translate ST id → app users.id.
   *   2. Find the buyer_universe for the mandate.
   *   3. Guard: universe.status MUST be 'submitted' (else 400).
   *   4. Acquire pg_advisory_xact_lock(hashtext($universeId)) — defense-in-depth.
   *   5. Upsert match_run (ON CONFLICT buyer_universe_id — idempotent).
   *   6. Snapshot existing non-'pending' dispositions (CRITICAL-1 preservation).
   *   6b. Delete existing match_candidates (idempotent re-score).
   *   7. Read 'included' candidates + M3 companies + contacts + criteria.
   *   8. Score each with the pure scoreCandidate function (NO LLM, NO randomness).
   *      Reconcile: carry forward snapshotted dispositions for still-included candidates.
   *   9. Batch-insert match_candidates (fitScore, scoreBreakdown, reconciled disposition).
   *  10. Set run status='scored'.
   *  11. AUDIT match-run-create LAST-IN-TXN (rollback on fail).
   *  12. Return ranked run (candidates ordered fit_score DESC).
   */
  async createRunAsActor(mandateId: string, supertokensUserId: string): Promise<MatchRankedList> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // 2. Find the buyer_universe for the mandate.
      const universe = await this.repository.findBuyerUniverseByMandateIdInTx(tx, mandateId);
      if (!universe) {
        throw new NotFoundException(
          `No buyer universe found for mandate ${mandateId} — assemble and submit the universe first`
        );
      }

      // 3. Guard: universe.status MUST be 'submitted'.
      if (universe.status !== 'submitted') {
        throw new BadRequestException(
          `Cannot score: buyer universe ${universe.id} has status '${universe.status}' — submit the universe first (requires status='submitted')`
        );
      }

      // 4. Acquire per-universe advisory lock (defense-in-depth).
      await this.repository.acquireUniverseAdvisoryLockInTx(tx, universe.id);

      // 5. Upsert match_run (idempotent — ON CONFLICT buyer_universe_id).
      const { run, isNew } = await this.repository.upsertMatchRunInTx(tx, {
        mandateId,
        buyerUniverseId: universe.id,
        createdBy: appUserId,
      });

      // 6. Snapshot existing non-'pending' dispositions BEFORE delete (CRITICAL-1).
      //    On first run this returns an empty map (no-op). On re-run, preserves
      //    accepted/rejected/flagged decisions so they survive the re-score cycle.
      const priorDispositions = await this.repository.snapshotCandidateDispositionsByRunIdInTx(
        tx,
        run.id
      );

      // Delete existing match_candidates (idempotent re-score).
      //    On first run, this is a no-op. On re-run, clears stale scores.
      await this.repository.deleteMatchCandidatesByRunIdInTx(tx, run.id);

      // 7. Read 'included' candidates + companies + contacts + criteria.
      const includedCandidates = await this.repository.listIncludedCandidatesInTx(tx, universe.id);
      const companyIds = includedCandidates.map((c) => c.companyId);
      const companyRows = await this.repository.findCompaniesByIdsInTx(tx, companyIds);
      const contactRows = await this.repository.findContactsByCompanyIdsInTx(tx, companyIds);
      const criteriaRow = await this.repository.findBuyerCriteriaByMandateIdInTx(tx, mandateId);

      // Build lookup maps for O(1) access during scoring.
      const companyMap = new Map(companyRows.map((c) => [c.id, c]));
      const contactsByCompany = new Map<string, typeof contactRows>();
      for (const contact of contactRows) {
        const existing = contactsByCompany.get(contact.companyId) ?? [];
        existing.push(contact);
        contactsByCompany.set(contact.companyId, existing);
      }

      // Build scorer criteria (null when no criteria row exists).
      const criteria: ScorerCriteria | null = criteriaRow
        ? {
            industry: criteriaRow.industry,
            geo: criteriaRow.geo,
            sizeBand: criteriaRow.sizeBand,
            dealType: criteriaRow.dealType,
          }
        : null;

      // 8. Score each included candidate with the PURE scoreCandidate function.
      //    NO LLM, NO randomness, NO Date.now().
      //    Reconcile: carry forward prior non-'pending' dispositions (CRITICAL-1).
      let dispositionsPreserved = 0;
      const scoredCandidates = includedCandidates.map((candidate) => {
        // Reconcile: carry forward prior disposition if one exists for this candidate.
        const priorDisposition = priorDispositions.get(candidate.id);
        if (priorDisposition !== undefined) {
          dispositionsPreserved++;
        }

        const company = companyMap.get(candidate.companyId);
        if (!company) {
          // Company row missing — score 0 with a breakdown note.
          return {
            matchRunId: run.id,
            buyerUniverseCandidateId: candidate.id,
            fitScore: 0,
            scoreBreakdown: {
              sectorMatch: 0,
              contactCompleteness: 0,
              tieBreak: 0,
              total: 0,
              notApplied: ['company data missing — company row not found in M3'],
            },
            disposition: priorDisposition ?? ('pending' as const),
          };
        }
        const contacts = contactsByCompany.get(candidate.companyId) ?? [];
        const result = scoreCandidate(candidate, company, contacts, criteria);
        return {
          matchRunId: run.id,
          buyerUniverseCandidateId: candidate.id,
          fitScore: result.score,
          scoreBreakdown: result.breakdown,
          disposition: priorDisposition ?? ('pending' as const),
        };
      });

      // 9. Batch-insert match_candidates (with reconciled dispositions).
      await this.repository.insertMatchCandidatesBatch(tx, scoredCandidates);

      // 10. Set run status='scored'.
      await this.repository.updateMatchRunStatusInTx(tx, run.id, 'scored');

      // 11. AUDIT LAST-IN-TXN.
      const eventPayload = {
        runId: run.id,
        mandateId,
        universeId: universe.id,
        isNew,
        candidatesScored: scoredCandidates.length,
        dispositionsPreserved,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'match-run-create',
        resourceType: 'match_run',
        resourceId: run.id,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      // 12. Return ranked run (via consistent in-tx read).
      return this.composeRankedListInTx(tx, run.id);
    });
  }

  // ---------------------------------------------------------------------------
  // patchDispositionAsActor
  // ---------------------------------------------------------------------------

  /**
   * patchDispositionAsActor — accept/reject/flag a match candidate.
   *
   * Cross-run-scoped (AND match_run_id → 404 mismatch — wave-9 lesson).
   * Audited in-txn via AuditService.append.
   *
   * @param runId       — the match_run UUID (for validation + predicate scoping)
   * @param candidateId — the match_candidates UUID to update
   * @param disposition — accepted | rejected | flagged | pending
   * @param supertokensUserId — raw ST id (translated to app users.id)
   */
  async patchDispositionAsActor(
    runId: string,
    candidateId: string,
    disposition: 'pending' | 'accepted' | 'rejected' | 'flagged',
    supertokensUserId: string
  ): Promise<MatchCandidateRow> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Validate run exists.
      const run = await this.repository.findMatchRunByIdInTx(tx, runId);
      if (!run) {
        throw new NotFoundException(`Match run ${runId} not found`);
      }

      // Update the candidate scoped to this run (cross-run guard).
      // updateCandidateDispositionScoped adds AND match_run_id = $runId
      // to the predicate — returns null if no row matched.
      const updated = await this.repository.updateCandidateDispositionScoped(
        tx,
        runId,
        candidateId,
        disposition
      );

      if (!updated) {
        throw new NotFoundException(`Candidate ${candidateId} not found in match run ${runId}`);
      }

      // AUDIT LAST-IN-TXN.
      const eventPayload = {
        runId,
        candidateId,
        disposition,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'match-disposition',
        resourceType: 'match_candidate',
        resourceId: candidateId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      return updated;
    });
  }

  // ---------------------------------------------------------------------------
  // handoffAsActor
  // ---------------------------------------------------------------------------

  /**
   * handoffAsActor — mark run ready_for_outreach=true.
   *
   * Guard: ≥1 ACCEPTED candidate (not total count — BUILD rule 6 semantic-predicate
   * on accepted-count). Returns 400 if no accepted candidates.
   * NO outreach executed here — this is the M6 handoff sentinel only.
   * Audited in-txn.
   */
  async handoffAsActor(runId: string, supertokensUserId: string): Promise<MatchRankedList> {
    const actor = await this.authRepository.getUserWithRole(supertokensUserId);
    if (!actor) {
      throw new ForbiddenException('Actor identity could not be resolved from app-DB users row');
    }

    const appUserId = actor.id;
    const actorRole = actor.roleName;

    return this.repository.runInTransaction(async (tx: Tx) => {
      // Validate run exists.
      const run = await this.repository.findMatchRunByIdInTx(tx, runId);
      if (!run) {
        throw new NotFoundException(`Match run ${runId} not found`);
      }

      // INFO-B: Idempotent re-handoff guard — if already handed off, return current
      // state without a new audit entry (M6 handoff contract: idempotent-return).
      if (run.readyForOutreach) {
        return this.composeRankedListInTx(tx, runId);
      }

      // Guard: ≥1 ACCEPTED candidate (BUILD rule 6 — semantic-predicate on accepted-count,
      // NOT total count). A run with no accepted candidates cannot be handed off.
      // CRITICAL-2: use tx-aware count so the guard read shares the transaction snapshot.
      const acceptedCount = await this.repository.countAcceptedCandidatesByRunIdInTx(tx, runId);
      if (acceptedCount === 0) {
        throw new BadRequestException(
          `Match run ${runId} cannot be handed off: no accepted candidates — accept at least one buyer before handoff`
        );
      }

      // Set ready_for_outreach=true (M6 sentinel — NO outreach executed here).
      await this.repository.updateMatchRunReadyForOutreachInTx(tx, runId);

      // AUDIT LAST-IN-TXN.
      const eventPayload = {
        runId,
        acceptedCount,
        actorRole,
      };
      const payloadStr = JSON.stringify(eventPayload);
      const payloadHash = createHash('sha256').update(payloadStr).digest('hex');

      const auditInput: AuditEntryInput = {
        actorUserId: appUserId,
        actorRole,
        action: 'match-handoff',
        resourceType: 'match_run',
        resourceId: runId,
        contentHash: payloadHash,
        payloadHash,
      };
      await this.auditService.append(auditInput, tx);

      // Return the updated ranked run (consistent in-tx snapshot).
      return this.composeRankedListInTx(tx, runId);
    });
  }

  // ---------------------------------------------------------------------------
  // getRun
  // ---------------------------------------------------------------------------

  /**
   * getRun — returns MatchRankedList (run + candidates ordered fit_score DESC).
   * Throws NotFoundException (404) if the run is not found.
   */
  async getRun(runId: string): Promise<MatchRankedList> {
    const run = await this.repository.findMatchRunById(runId);
    if (!run) {
      throw new NotFoundException(`Match run ${runId} not found`);
    }
    const candidates = await this.repository.listMatchCandidatesByRunId(runId);
    return { run: this.serializeRun(run), candidates: candidates.map(this.serializeCandidate) };
  }

  // ---------------------------------------------------------------------------
  // listByMandate
  // ---------------------------------------------------------------------------

  /**
   * listByMandate — returns all match runs for a given mandate.
   */
  async listByMandate(mandateId: string): Promise<{ runs: MatchRunRow[] }> {
    const runs = await this.repository.listMatchRunsByMandateId(mandateId);
    return { runs };
  }

  // ---------------------------------------------------------------------------
  // getShortlist
  // ---------------------------------------------------------------------------

  /**
   * getShortlist — returns the shortlist (accepted candidates, fit_score DESC).
   * Throws NotFoundException (404) if the run is not found.
   */
  async getShortlist(runId: string): Promise<Shortlist> {
    const run = await this.repository.findMatchRunById(runId);
    if (!run) {
      throw new NotFoundException(`Match run ${runId} not found`);
    }
    const accepted = await this.repository.listAcceptedMatchCandidatesByRunId(runId);
    return {
      run: this.serializeRun(run),
      accepted: accepted.map(this.serializeCandidate),
    };
  }

  // ---------------------------------------------------------------------------
  // Serializers — convert DB row to wire shape
  // ---------------------------------------------------------------------------

  private serializeRun(run: MatchRunRow) {
    return {
      id: run.id,
      mandateId: run.mandateId,
      buyerUniverseId: run.buyerUniverseId,
      createdBy: run.createdBy,
      status: run.status,
      readyForOutreach: run.readyForOutreach,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt ?? null,
    };
  }

  private serializeCandidate(candidate: MatchCandidateRow) {
    return {
      id: candidate.id,
      matchRunId: candidate.matchRunId,
      buyerUniverseCandidateId: candidate.buyerUniverseCandidateId,
      fitScore: candidate.fitScore,
      scoreBreakdown: candidate.scoreBreakdown ?? null,
      disposition: candidate.disposition,
      createdAt: candidate.createdAt,
    };
  }
}
