/**
 * SellerIntentRepository — workspace-scoped raw data aggregation for seller-intent scoring.
 *
 * Wave-23 (task 9e54cc11).
 *
 * ── WORKSPACE-ISOLATION INVARIANT (load-bearing) ─────────────────────────────
 * EVERY query in this repository uses getDb(this.db) — the ALS request-handle
 * bound to the per-request dedicated pg Client that has had
 *   SELECT set_config('app.workspace_id', $wsId, false)
 * called on it by WorkspaceInterceptor. Under dealflow_app (NOSUPERUSER FORCE RLS)
 * this GUC causes every row-level security policy to filter by workspace_id.
 *
 * NEVER use this.db directly in a query method — that would use the module-level
 * Drizzle singleton (no GUC set → all tenant rows returned → cross-firm leak).
 *
 * ── READ-ONLY ────────────────────────────────────────────────────────────────
 * ZERO writes. No INSERT, UPDATE, DELETE. No audit row.
 *
 * ── BATCH FETCH STRATEGY ─────────────────────────────────────────────────────
 * Four queries fetch all workspace-scoped data in batch rather than N+1 per mandate:
 *   Q1: All mandates → mandateIds for Q2–Q4 filtering.
 *   Q2: All outreach_activity WHERE mandate_id IN (mandateIds).
 *   Q3: All pipeline_events INNER JOIN pipeline WHERE pipeline.mandate_id IN (mandateIds).
 *   Q4: All match_candidates INNER JOIN match_run WHERE match_run.mandate_id IN (mandateIds).
 * FORCE RLS on each table ensures workspace isolation at the DB layer.
 *
 * ── SI3: REFERENCE INSTANT ───────────────────────────────────────────────────
 * referenceInstant = workspace max-event-ts derived in application code from the
 * fetched rows (Q2–Q4). Fallback: mandate max createdAt (Q1). This means a dormant
 * mandate scores 'cooling' relative to the most-active mandate in the workspace.
 * A workspace with zero events yields referenceInstant = oldest mandate createdAt
 * → both direction windows are empty → all mandates get direction = 'flat'.
 */

import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { mandates } from '../../db/schema/mandate';
import { matchCandidates, matchRun } from '../../db/schema/matching';
import { outreachActivity } from '../../db/schema/outreach-activity';
import { pipeline, pipelineEvents } from '../../db/schema/pipeline';
import { getDb } from '../../db/workspace-context';
import type {
  MatchCandidateScorerInput,
  OutreachActivityScorerInput,
  PipelineEventScorerInput,
} from './seller-intent.scorer';

// ---------------------------------------------------------------------------
// Repository output types
// ---------------------------------------------------------------------------

export interface MandateRow {
  id: string;
  createdAt: string;
}

export interface ActivityRow extends OutreachActivityScorerInput {
  mandateId: string;
}

export interface PipelineEventRow extends PipelineEventScorerInput {
  mandateId: string;
}

export interface CandidateRow extends MatchCandidateScorerInput {
  mandateId: string;
}

export interface SellerIntentRawData {
  mandates: MandateRow[];
  activities: ActivityRow[];
  pipelineEventRows: PipelineEventRow[];
  candidateRows: CandidateRow[];
  /** SI3: workspace max-event-ts (ISO string). Falls back to mandate max createdAt if no events. */
  referenceInstant: string;
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

@Injectable()
export class SellerIntentRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * getAll — fetches all workspace-scoped raw data for seller-intent scoring.
   *
   * Uses getDb(this.db) → ALS GUC-bound Drizzle handle → FORCE RLS → workspace-only rows.
   *
   * Returns SellerIntentRawData containing:
   *   - mandates     — all workspace mandates (ordered by created_at ASC, id ASC for stable ordering)
   *   - activities   — all outreach_activity rows linked to those mandates (mandate_id IS NOT NULL)
   *   - pipelineEventRows — all pipeline_events rows joined through pipeline to get mandate scope
   *   - candidateRows — all match_candidates rows joined through match_run to get mandate scope
   *   - referenceInstant — workspace max-event-ts (SI3)
   *
   * EMPTY STATE (SI3): if no events exist, referenceInstant falls back to the latest mandate
   * createdAt, yielding direction='flat' for all mandates (both windows empty).
   */
  async getAll(): Promise<SellerIntentRawData> {
    const db = getDb(this.db);

    // ── Q1: All workspace mandates (stable order: created_at ASC, id ASC) ──────

    const mandateRows: MandateRow[] = await db
      .select({ id: mandates.id, createdAt: mandates.createdAt })
      .from(mandates);

    if (mandateRows.length === 0) {
      // Empty workspace — return empty raw data with a sentinel referenceInstant.
      // The sentinel '1970-01-01T00:00:00.000Z' yields empty windows → direction='flat'.
      return {
        mandates: [],
        activities: [],
        pipelineEventRows: [],
        candidateRows: [],
        referenceInstant: '1970-01-01T00:00:00.000Z',
      };
    }

    const mandateIds = mandateRows.map((m) => m.id);

    // ── Q2: outreach_activity WHERE mandate_id IS NOT NULL AND mandate_id IN (ids) ──

    const activityRows: ActivityRow[] = await db
      .select({
        mandateId: outreachActivity.mandateId,
        status: outreachActivity.status,
        channel: outreachActivity.channel,
        completedAt: outreachActivity.completedAt,
        createdAt: outreachActivity.createdAt,
      })
      .from(outreachActivity)
      .where(
        and(
          isNotNull(outreachActivity.mandateId),
          inArray(outreachActivity.mandateId, mandateIds)
        )
      )
      .then((rows) =>
        rows.map((r) => ({
          mandateId: r.mandateId as string,
          status: r.status,
          channel: r.channel,
          completedAt: r.completedAt,
          createdAt: r.createdAt,
        }))
      );

    // ── Q3: pipeline_events INNER JOIN pipeline WHERE pipeline.mandate_id IN (ids) ──

    const pipelineEventRowsRaw = await db
      .select({
        eventType: pipelineEvents.eventType,
        fromStage: pipelineEvents.fromStage,
        toStage: pipelineEvents.toStage,
        createdAt: pipelineEvents.createdAt,
        mandateId: pipeline.mandateId,
      })
      .from(pipelineEvents)
      .innerJoin(pipeline, eq(pipelineEvents.pipelineId, pipeline.id))
      .where(inArray(pipeline.mandateId, mandateIds));

    const pipelineEventRowsResult: PipelineEventRow[] = pipelineEventRowsRaw.map((r) => ({
      eventType: r.eventType,
      fromStage: r.fromStage,
      toStage: r.toStage,
      createdAt: r.createdAt,
      mandateId: r.mandateId,
    }));

    // ── Q4: match_candidates INNER JOIN match_run WHERE match_run.mandate_id IN (ids) ──

    const candidateRowsRaw = await db
      .select({
        disposition: matchCandidates.disposition,
        createdAt: matchCandidates.createdAt,
        mandateId: matchRun.mandateId,
      })
      .from(matchCandidates)
      .innerJoin(matchRun, eq(matchCandidates.matchRunId, matchRun.id))
      .where(inArray(matchRun.mandateId, mandateIds));

    const candidateRowsResult: CandidateRow[] = candidateRowsRaw.map((r) => ({
      disposition: r.disposition,
      createdAt: r.createdAt,
      mandateId: r.mandateId,
    }));

    // ── SI3: derive referenceInstant = workspace max-event-ts ─────────────────
    //
    // Max across: outreach_activity (completedAt ?? createdAt), pipeline_events.createdAt,
    // match_candidates.createdAt. Falls back to mandate max createdAt if no events.
    // A dormant mandate scored against a high referenceInstant reads 'cooling' vs
    // the workspace's most active period.

    const allTimestamps: string[] = [
      ...activityRows.map((a) => a.completedAt ?? a.createdAt),
      ...pipelineEventRowsResult.map((e) => e.createdAt),
      ...candidateRowsResult.map((c) => c.createdAt),
    ];

    let referenceInstant: string;
    if (allTimestamps.length > 0) {
      referenceInstant = allTimestamps.reduce((a, b) => (a > b ? a : b));
    } else {
      // No events: fall back to mandate max createdAt.
      referenceInstant = mandateRows.reduce((a, b) =>
        a.createdAt > b.createdAt ? a : b
      ).createdAt;
    }

    return {
      mandates: mandateRows,
      activities: activityRows,
      pipelineEventRows: pipelineEventRowsResult,
      candidateRows: candidateRowsResult,
      referenceInstant,
    };
  }
}
