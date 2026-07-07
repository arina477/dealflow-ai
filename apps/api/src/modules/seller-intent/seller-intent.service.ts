/**
 * SellerIntentService — orchestrates workspace-scoped seller-intent scoring.
 *
 * Wave-23 (task 9e54cc11).
 *
 * ── WORKSPACE-ISOLATION INVARIANT (load-bearing) ─────────────────────────────
 * All database access flows through SellerIntentRepository methods, each of which
 * uses getDb(this.db) → ALS request-handle → GUC-set dedicated pg Client →
 * FORCE RLS → per-firm data. This service holds no Drizzle handle and issues no
 * direct DB calls, so the isolation invariant is enforced structurally at the
 * repository layer.
 *
 * FAIL-CLOSED (SI3): getWorkspaceId() is checked at the START of getList(). If it
 * returns null (no ALS request context — e.g. background job, health check, or
 * e2e no-ALS fault-killing call), the service THROWS rather than silently falling
 * back to the module-level singleton (which would return all-tenant data).
 *
 * ── READ-ONLY ────────────────────────────────────────────────────────────────
 * This service has ZERO writes. No audit row is appended (same as analytics/match-feedback).
 *
 * ── PURE SCORER DELEGATION ────────────────────────────────────────────────────
 * The scoring logic lives entirely in scoreMandateIntent (seller-intent.scorer.ts).
 * The service only fetches raw data (via repository), groups by mandateId, and calls
 * the pure scorer once per mandate. No LLM, no network, no randomness.
 *
 * ── SI3: REFERENCE INSTANT ────────────────────────────────────────────────────
 * referenceInstant = workspace max-event-ts (derived in the repository). A dormant
 * mandate scores 'cooling' relative to the most-active workspace timestamp. See
 * SellerIntentRepository.getAll() documentation for the derivation and fallback.
 *
 * ── STABLE ORDERING ───────────────────────────────────────────────────────────
 * The result list is ordered by (mandate.createdAt ASC, mandate.id ASC) — NOT by
 * score. This is deterministic and does NOT use a tieBreak scored dimension (SI1).
 */

import type { SellerIntentListResponse, SellerIntentScore } from '@dealflow/shared';
import { Injectable } from '@nestjs/common';
import { getWorkspaceId } from '../../db/workspace-context';
// biome-ignore lint/style/useImportType: value import required for emitDecoratorMetadata DI resolution
import { SellerIntentRepository } from './seller-intent.repository';
import { scoreMandateIntent } from './seller-intent.scorer';

@Injectable()
export class SellerIntentService {
  constructor(private readonly sellerIntentRepository: SellerIntentRepository) {}

  /**
   * getList — returns the workspace-scoped seller-intent score list.
   *
   * FAIL-CLOSED: throws if getWorkspaceId() === null (no ALS context — SI3).
   * PURE scorer delegation: scoreMandateIntent() is pure-deterministic (no Date.now()).
   * READ-ONLY: appends ZERO audit rows.
   * STABLE ORDER: results sorted by (mandate.createdAt ASC, mandate.id ASC) — NO tieBreak (SI1).
   * EMPTY WORKSPACE: returns [] for a workspace with no mandates (SI3 safe).
   *
   * @throws Error if called outside a workspace-scoped ALS request context.
   */
  async getList(): Promise<SellerIntentListResponse> {
    // FAIL-CLOSED: throw if no workspace context (SI3).
    const workspaceId = getWorkspaceId();
    if (workspaceId === null) {
      throw new Error(
        'seller-intent: getWorkspaceId() returned null — no ALS request context (fail-closed). ' +
          'This endpoint requires a workspace-scoped request context set by WorkspaceInterceptor.'
      );
    }

    // Fetch all workspace data in batch (4 queries via getDb() → FORCE RLS).
    const raw = await this.sellerIntentRepository.getAll();

    if (raw.mandates.length === 0) {
      return [];
    }

    // Group activities, events, and candidates by mandateId.
    const activitiesByMandate = new Map<string, (typeof raw.activities)[number][]>();
    for (const act of raw.activities) {
      const bucket = activitiesByMandate.get(act.mandateId) ?? [];
      bucket.push(act);
      activitiesByMandate.set(act.mandateId, bucket);
    }

    const eventsByMandate = new Map<string, (typeof raw.pipelineEventRows)[number][]>();
    for (const evt of raw.pipelineEventRows) {
      const bucket = eventsByMandate.get(evt.mandateId) ?? [];
      bucket.push(evt);
      eventsByMandate.set(evt.mandateId, bucket);
    }

    const candidatesByMandate = new Map<string, (typeof raw.candidateRows)[number][]>();
    for (const cand of raw.candidateRows) {
      const bucket = candidatesByMandate.get(cand.mandateId) ?? [];
      bucket.push(cand);
      candidatesByMandate.set(cand.mandateId, bucket);
    }

    // Score each mandate with the pure scorer.
    const scores: SellerIntentScore[] = raw.mandates.map((m) => {
      const result = scoreMandateIntent({
        mandateId: m.id,
        referenceInstant: raw.referenceInstant,
        outreachActivities: activitiesByMandate.get(m.id) ?? [],
        pipelineEvents: eventsByMandate.get(m.id) ?? [],
        matchCandidates: candidatesByMandate.get(m.id) ?? [],
      });

      return {
        mandateId: m.id,
        score: result.score,
        breakdown: result.breakdown,
        direction: result.direction,
      };
    });

    // Stable deterministic ordering: createdAt ASC, id ASC (NO tieBreak scored dimension — SI1).
    scores.sort((a, b) => {
      const mA = raw.mandates.find((m) => m.id === a.mandateId)!;
      const mB = raw.mandates.find((m) => m.id === b.mandateId)!;
      if (mA.createdAt < mB.createdAt) return -1;
      if (mA.createdAt > mB.createdAt) return 1;
      return a.mandateId < b.mandateId ? -1 : a.mandateId > b.mandateId ? 1 : 0;
    });

    return scores;
  }
}
