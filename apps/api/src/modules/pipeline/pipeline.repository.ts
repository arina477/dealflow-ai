/**
 * PipelineRepository — Drizzle queries for the pipeline spine.
 *
 * Covers:
 *   - Eligible-source reads (outreach status check, match_candidate
 *     disposition + match_run.ready_for_outreach check)
 *   - pipeline INSERT + find by id
 *   - pipeline UPDATE (stage transition)
 *   - pipeline_events INSERT (enrolled / stage_changed / note)
 *   - pipeline_events list by pipeline_id (ordered timeline)
 *   - pipeline list / group-by-stage (board read)
 *   - Transaction composition (runInTransaction for all services)
 *
 * Error unwrap:
 *   All table writes catch pg errors by unwrapping err.cause.code
 *   (DrizzleQueryError wrapper) before falling back to err.code
 *   (bare pg driver) — the wave-6 DrizzleQueryError lesson.
 *
 * Business logic, audit, and role checks live in the service layer — this
 * class is a pure Drizzle query repository.
 *
 * BUILD RULE 7: every read inside runInTransaction MUST use the tx handle,
 * not this.db, to ensure reads are consistent within the transaction.
 */

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { getDb, getWorkspaceId } from '../../db/workspace-context';
import { DEFAULT_WORKSPACE_ID } from '../../db/schema/workspaces';
import { matchCandidates, matchRun } from '../../db/schema/matching';
import { outreach } from '../../db/schema/outreach';
import { pipeline, pipelineEvents } from '../../db/schema/pipeline';

// ---------------------------------------------------------------------------
// Row type aliases
// ---------------------------------------------------------------------------

export type PipelineRow = typeof pipeline.$inferSelect;
export type PipelineEventRow = typeof pipelineEvents.$inferSelect;

/** Tx type for transaction-composable writes (mirrors the outreach/matching pattern). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// DrizzleError unwrap helper (wave-6 lesson)
// ---------------------------------------------------------------------------

/**
 * Extract the pg error code from either:
 *   err.cause.code — DrizzleQueryError wraps the native pg error in .cause
 *   err.code       — bare pg driver error (e.g. connection-level throws)
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

// ---------------------------------------------------------------------------
// Eligible-source read shapes
// ---------------------------------------------------------------------------

export interface OutreachEligibilityRow {
  id: string;
  status: string;
  /** The mandate this outreach belongs to — used by enrollAsActor to validate provenance. */
  mandateId: string;
}

export interface MatchCandidateEligibilityRow {
  id: string;
  disposition: string;
  matchRunId: string;
  readyForOutreach: boolean;
  /** The mandate the match_run belongs to — used by enrollAsActor to validate provenance. */
  mandateId: string;
}

@Injectable()
export class PipelineRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Transaction helper
  // ---------------------------------------------------------------------------

  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return getDb(this.db).transaction(work);
  }

  // ---------------------------------------------------------------------------
  // Eligible-source reads (BUILD rule 7: tx-scoped inside transactions)
  // ---------------------------------------------------------------------------

  /**
   * findOutreachByIdInTx — read an outreach row's eligibility fields.
   * Used by enrollAsActor to check status='send_eligible' (eligible-source guard).
   * BUILD rule 7: must use tx handle.
   */
  async findOutreachByIdInTx(tx: Tx, outreachId: string): Promise<OutreachEligibilityRow | null> {
    const rows = await tx
      .select({ id: outreach.id, status: outreach.status, mandateId: outreach.mandateId })
      .from(outreach)
      .where(eq(outreach.id, outreachId))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findMatchCandidateEligibilityInTx — read match_candidates + match_run.ready_for_outreach.
   * Used by enrollAsActor to check:
   *   (a) disposition = 'accepted'
   *   (b) match_run.ready_for_outreach = true
   * Both conditions required for an eligible match_candidate source.
   * BUILD rule 7: must use tx handle.
   */
  async findMatchCandidateEligibilityInTx(
    tx: Tx,
    matchCandidateId: string
  ): Promise<MatchCandidateEligibilityRow | null> {
    const rows = await tx
      .select({
        id: matchCandidates.id,
        disposition: matchCandidates.disposition,
        matchRunId: matchCandidates.matchRunId,
        readyForOutreach: matchRun.readyForOutreach,
        mandateId: matchRun.mandateId,
      })
      .from(matchCandidates)
      .innerJoin(matchRun, eq(matchRun.id, matchCandidates.matchRunId))
      .where(eq(matchCandidates.id, matchCandidateId))
      .limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // pipeline INSERT
  // ---------------------------------------------------------------------------

  /**
   * insertPipeline — insert a pipeline row at stage 'shortlisted'.
   * Catches 23505 (unique_violation) — thrown when the deal target already has
   * a pipeline row (partial UNIQUE on outreach_id or match_candidate_id WHERE NOT NULL).
   * The caller (PipelineService.enrollAsActor) maps this to 409 ConflictException.
   * Called INSIDE a transaction.
   */
  async insertPipeline(
    tx: Tx,
    input: {
      mandateId: string;
      dealSourceType: string;
      outreachId: string | null;
      matchCandidateId: string | null;
      createdBy: string;
    }
  ): Promise<PipelineRow> {
    let rows: PipelineRow[];
    try {
      rows = await tx
        .insert(pipeline)
        .values({
          mandateId: input.mandateId,
          dealSourceType: input.dealSourceType,
          outreachId: input.outreachId ?? undefined,
          matchCandidateId: input.matchCandidateId ?? undefined,
          stage: 'shortlisted',
          createdBy: input.createdBy,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      // 23505 = unique_violation — deal target already enrolled (idempotent guard).
      if (code === '23505') {
        throw new ConflictException(
          'This deal target is already enrolled in the pipeline. Duplicate enrollment refused.'
        );
      }
      // 23503 = foreign_key_violation — mandate, user, outreach, or match_candidate not found.
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation in pipeline insert: mandate, user, or deal source not found'
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('PipelineRepository: INSERT pipeline returned no row');
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // pipeline READ (tx-scoped)
  // ---------------------------------------------------------------------------

  /**
   * findPipelineByIdInTx — read a pipeline row by UUID (tx-scoped).
   * BUILD rule 7: always use tx handle inside transactions.
   */
  async findPipelineByIdInTx(tx: Tx, id: string): Promise<PipelineRow | null> {
    const rows = await tx.select().from(pipeline).where(eq(pipeline.id, id)).limit(1);
    return rows[0] ?? null;
  }

  /**
   * findPipelineById — read a pipeline row by UUID (outside tx).
   * Used for read endpoints that do not need transaction consistency.
   */
  async findPipelineById(id: string): Promise<PipelineRow | null> {
    const rows = await getDb(this.db).select().from(pipeline).where(eq(pipeline.id, id)).limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // pipeline UPDATE (stage transition)
  // ---------------------------------------------------------------------------

  /**
   * updatePipelineStageInTx — set pipeline.stage + updated_by.
   * Called inside a transaction by PipelineService.transitionStageAsActor.
   * Returns the updated row; throws 404 if not found (no rows affected).
   * BUILD rule 7: must use tx handle.
   */
  async updatePipelineStageInTx(
    tx: Tx,
    id: string,
    toStage: string,
    updatedBy: string
  ): Promise<PipelineRow> {
    const rows = await tx
      .update(pipeline)
      .set({ stage: toStage as PipelineRow['stage'], updatedBy })
      .where(eq(pipeline.id, id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Pipeline ${id} not found`);
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // pipeline_events INSERT (append-only)
  // ---------------------------------------------------------------------------

  /**
   * insertPipelineEvent — append a pipeline_events row.
   * APPEND-ONLY: there is NO update or delete path for pipeline_events.
   * Called inside a transaction.
   */
  async insertPipelineEvent(
    tx: Tx,
    input: {
      pipelineId: string;
      eventType: 'enrolled' | 'stage_changed' | 'note';
      fromStage?: string | null;
      toStage?: string | null;
      note?: string | null;
      actorId: string;
    }
  ): Promise<PipelineEventRow> {
    let rows: PipelineEventRow[];
    try {
      rows = await tx
        .insert(pipelineEvents)
        .values({
          pipelineId: input.pipelineId,
          eventType: input.eventType,
          fromStage: (input.fromStage ?? null) as PipelineEventRow['fromStage'],
          toStage: (input.toStage ?? null) as PipelineEventRow['toStage'],
          note: input.note ?? null,
          actorId: input.actorId,
          workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID,
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      if (code === '23503') {
        throw new BadRequestException(
          'FK violation in pipeline_events insert: pipeline or actor not found'
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('PipelineRepository: INSERT pipeline_events returned no row');
    }
    return row;
  }

  // ---------------------------------------------------------------------------
  // pipeline_events READ (ordered timeline)
  // ---------------------------------------------------------------------------

  /**
   * listEventsByPipelineId — ordered event timeline for a deal.
   * Returns enrolled + stage_changed + note events in created_at ASC order.
   * Used by GET /pipeline/:id/events.
   */
  async listEventsByPipelineId(pipelineId: string): Promise<PipelineEventRow[]> {
    return getDb(this.db)
      .select()
      .from(pipelineEvents)
      .where(eq(pipelineEvents.pipelineId, pipelineId))
      .orderBy(sql`${pipelineEvents.createdAt} ASC`);
  }

  // ---------------------------------------------------------------------------
  // Board read — deals grouped by stage
  // ---------------------------------------------------------------------------

  /**
   * listPipelineForBoard — list all pipeline rows, optionally filtered by mandateId.
   * Used by PipelineService.getBoard to build the stage-columned board response.
   * Results are ordered by created_at ASC within each stage.
   */
  async listPipelineForBoard(filter?: { mandateId?: string }): Promise<PipelineRow[]> {
    if (filter?.mandateId) {
      return getDb(this.db)
        .select()
        .from(pipeline)
        .where(and(eq(pipeline.mandateId, filter.mandateId)))
        .orderBy(sql`${pipeline.createdAt} ASC`);
    }
    return getDb(this.db).select().from(pipeline).orderBy(sql`${pipeline.createdAt} ASC`);
  }
}
