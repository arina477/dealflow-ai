/**
 * AnalyticsRepository — workspace-scoped aggregation queries for the 4 metric families.
 *
 * Wave-18 (task a5ba8068).
 *
 * ── WORKSPACE-ISOLATION INVARIANT (load-bearing) ─────────────────────────────
 * EVERY query in this repository uses getDb(this.db) — the ALS request-handle
 * bound to the per-request dedicated pg Client that has had
 *   SELECT set_config('app.workspace_id', $wsId, false)
 * called on it by WorkspaceInterceptor. Under dealflow_app (NOSUPERUSER FORCE RLS)
 * this GUC causes every row-level security policy to filter by workspace_id.
 *
 * NEVER use this.db directly in a query method — that would use the module-level
 * Drizzle singleton (no GUC set → all tenant rows returned across ALL firms →
 * cross-firm data leak, undoing the M8 isolation layer). The this.db field is
 * the fallback only for non-request contexts (health checks, bootstrap) which
 * are not served by this repository.
 *
 * ── READ-ONLY ────────────────────────────────────────────────────────────────
 * This repository has ZERO writes. No INSERT, UPDATE, or DELETE. No audit row
 * is appended for analytics reads (consistent with the admin-activity read pattern).
 *
 * ── EMPTY-STATE SAFE ─────────────────────────────────────────────────────────
 * Every method handles the zero-row case:
 *   - COUNT aggregates return 0 for empty result sets (Postgres aggregate behaviour).
 *   - F2 rate fields: division is guarded (total=0 → null rates, not NaN/Infinity).
 *   - F3 returns an empty array for a workspace with no pipeline/mandate activity.
 */

import type {
  AdvisorActivityRow,
  MandateThroughput,
  MatchDisposition,
  OutreachGateOutcomes,
} from '@dealflow/shared';
import { Inject, Injectable } from '@nestjs/common';
import { count, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { mandates } from '../../db/schema/mandate';
import { matchCandidates } from '../../db/schema/matching';
import { outreach } from '../../db/schema/outreach';
import { pipeline } from '../../db/schema/pipeline';
import { getDb } from '../../db/workspace-context';

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // F1 — Mandate throughput (counts by mandate_status)
  // ---------------------------------------------------------------------------

  /**
   * getMandateThroughput — counts mandates by status for the request workspace.
   *
   * Uses getDb(this.db) → GUC-set dedicated client → FORCE RLS applies →
   * only workspace-scoped mandates returned.
   *
   * Returns { totalDraft, totalActive, total } (all 0 for empty workspace).
   */
  async getMandateThroughput(): Promise<MandateThroughput> {
    // Single GROUP-BY query for efficiency: one round-trip, two buckets.
    const rows = await getDb(this.db)
      .select({
        status: mandates.status,
        cnt: count(),
      })
      .from(mandates)
      .groupBy(mandates.status);

    let totalDraft = 0;
    let totalActive = 0;
    for (const row of rows) {
      if (row.status === 'draft') totalDraft = Number(row.cnt);
      else if (row.status === 'active') totalActive = Number(row.cnt);
    }

    return { totalDraft, totalActive, total: totalDraft + totalActive };
  }

  // ---------------------------------------------------------------------------
  // F2 — Outreach compliance-gate outcomes (send_eligible pass-rate / blocked-rate)
  // ---------------------------------------------------------------------------

  /**
   * getOutreachGateOutcomes — counts outreach by status and computes gate rates.
   *
   * NAMING CONTRACT: fields are gatePassRate / blockedRate — NOT responseRate.
   * outreach.status is a compliance-gate lifecycle column:
   *   compose       — transient; gate has not yet resolved.
   *   send_eligible — gate PASSED (allowed: true); eligible to send.
   *   blocked       — gate FAILED (allowed: false); not eligible.
   * No email send has ever been dispatched (deferred M6+); "response rate" would
   * be semantically wrong here.
   *
   * Div-by-zero guard: total=0 → gatePassRate=null, blockedRate=null.
   */
  async getOutreachGateOutcomes(): Promise<OutreachGateOutcomes> {
    const rows = await getDb(this.db)
      .select({
        status: outreach.status,
        cnt: count(),
      })
      .from(outreach)
      .groupBy(outreach.status);

    let totalCompose = 0;
    let totalSendEligible = 0;
    let totalBlocked = 0;
    for (const row of rows) {
      if (row.status === 'compose') totalCompose = Number(row.cnt);
      else if (row.status === 'send_eligible') totalSendEligible = Number(row.cnt);
      else if (row.status === 'blocked') totalBlocked = Number(row.cnt);
    }

    const total = totalCompose + totalSendEligible + totalBlocked;

    // Div-by-zero guard: return null rates when no outreach records exist.
    const gatePassRate = total > 0 ? totalSendEligible / total : null;
    const blockedRate = total > 0 ? totalBlocked / total : null;

    return { totalCompose, totalSendEligible, totalBlocked, total, gatePassRate, blockedRate };
  }

  // ---------------------------------------------------------------------------
  // F3 — Advisor productivity (per-actor: mandates created + pipeline rows)
  // ---------------------------------------------------------------------------

  /**
   * getAdvisorProductivity — per-actor activity within the request workspace.
   *
   * Joins mandates (created_by) and pipeline (created_by) via a UNION-based
   * GROUP-BY. Uses two separate sub-queries merged in application code to avoid
   * a complex SQL FULL OUTER JOIN (Drizzle doesn't emit FULL OUTER natively).
   *
   * Both queries use getDb(this.db) → FORCE RLS → workspace-scoped.
   *
   * Returns an array of { userId, mandatesCreated, pipelineRows } sorted by
   * total descending (most active first). Empty for a workspace with no activity.
   */
  async getAdvisorProductivity(): Promise<AdvisorActivityRow[]> {
    // Sub-query 1: mandates created per user in this workspace.
    const mandateRows = await getDb(this.db)
      .select({
        userId: mandates.createdBy,
        cnt: count(),
      })
      .from(mandates)
      .groupBy(mandates.createdBy);

    // Sub-query 2: pipeline rows created per user in this workspace.
    const pipelineRows = await getDb(this.db)
      .select({
        userId: pipeline.createdBy,
        cnt: count(),
      })
      .from(pipeline)
      .groupBy(pipeline.createdBy);

    // Merge by userId in application code.
    const activityMap = new Map<string, { mandatesCreated: number; pipelineRows: number }>();

    for (const row of mandateRows) {
      const existing = activityMap.get(row.userId) ?? { mandatesCreated: 0, pipelineRows: 0 };
      activityMap.set(row.userId, {
        ...existing,
        mandatesCreated: existing.mandatesCreated + Number(row.cnt),
      });
    }

    for (const row of pipelineRows) {
      const existing = activityMap.get(row.userId) ?? { mandatesCreated: 0, pipelineRows: 0 };
      activityMap.set(row.userId, {
        ...existing,
        pipelineRows: existing.pipelineRows + Number(row.cnt),
      });
    }

    // Sort by total activity descending (most active advisor first).
    return Array.from(activityMap.entries())
      .map(([userId, activity]) => ({ userId, ...activity }))
      .sort((a, b) => b.mandatesCreated + b.pipelineRows - (a.mandatesCreated + a.pipelineRows));
  }

  // ---------------------------------------------------------------------------
  // F4 — Match disposition (counts by match_candidate_disposition)
  // ---------------------------------------------------------------------------

  /**
   * getMatchDisposition — counts match_candidates by disposition for this workspace.
   *
   * Uses getDb(this.db) → FORCE RLS → workspace-scoped match_candidates only.
   *
   * Returns { totalPending, totalAccepted, totalRejected, totalFlagged, total }.
   * All counts are 0 for an empty workspace.
   */
  async getMatchDisposition(): Promise<MatchDisposition> {
    const rows = await getDb(this.db)
      .select({
        disposition: matchCandidates.disposition,
        cnt: count(),
      })
      .from(matchCandidates)
      .groupBy(matchCandidates.disposition);

    let totalPending = 0;
    let totalAccepted = 0;
    let totalRejected = 0;
    let totalFlagged = 0;

    for (const row of rows) {
      if (row.disposition === 'pending') totalPending = Number(row.cnt);
      else if (row.disposition === 'accepted') totalAccepted = Number(row.cnt);
      else if (row.disposition === 'rejected') totalRejected = Number(row.cnt);
      else if (row.disposition === 'flagged') totalFlagged = Number(row.cnt);
    }

    const total = totalPending + totalAccepted + totalRejected + totalFlagged;

    return { totalPending, totalAccepted, totalRejected, totalFlagged, total };
  }
}
