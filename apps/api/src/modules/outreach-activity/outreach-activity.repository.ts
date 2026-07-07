/**
 * OutreachActivityRepository — Drizzle queries for the wave-20 outreach_activity table.
 *
 * All tenant reads/writes go through getDb() (RLS-scoped handle from ALS).
 * Transaction composition: runInTransaction exposes the tx handle so the service
 * can call business writes AND audit.append in the SAME transaction (SF5).
 *
 * FK tenancy reads (R3/SF4):
 *   findOutreachByIdInTx, findMatchCandidateByIdInTx, findPipelineByIdInTx,
 *   findMandateByIdInTx — all use the tx handle (RLS-scoped). A firm-B row is
 *   invisible under firm-A's GUC → returns null → service throws NotFoundException.
 *
 * SF1 HIGH: workspace_id is NOT derived from a DEFAULT_WORKSPACE_ID fallback.
 *   The INSERT passes `NULLIF(current_setting('app.workspace_id', true),'')::uuid`
 *   as a SQL expression for workspace_id. The DB computes it from the session GUC.
 *   When GUC is unset, NULLIF returns NULL → NOT NULL constraint rejects → fail-closed.
 *   Combined with the service throwing when getWorkspaceId()=null, this is the
 *   belt+suspenders SF1 pattern.
 *
 * Error unwrap: pg error codes extracted from DrizzleQueryError.cause.code
 *   (wave-6 DrizzleQueryError lesson).
 */

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { mandates } from '../../db/schema/mandate';
import { matchCandidates } from '../../db/schema/matching';
import { outreachActivity } from '../../db/schema/outreach-activity';
import { outreach } from '../../db/schema/outreach';
import { pipeline } from '../../db/schema/pipeline';
import { getDb } from '../../db/workspace-context';

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

export type OutreachActivityRow = typeof outreachActivity.$inferSelect;

/** Drizzle transaction handle (derived from the Database type). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// DrizzleError unwrap helper (wave-6 lesson)
// ---------------------------------------------------------------------------

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
// Repository
// ---------------------------------------------------------------------------

@Injectable()
export class OutreachActivityRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ── Transaction helper ────────────────────────────────────────────────────

  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return getDb(this.db).transaction(work);
  }

  // ── INSERT outreach_activity ──────────────────────────────────────────────

  /**
   * insertActivity — INSERT a new outreach_activity row.
   *
   * SF1 HIGH: workspace_id is derived from the GUC via an explicit SQL expression
   *   `NULLIF(current_setting('app.workspace_id', true),'')::uuid`.
   *   Drizzle requires a value for NOT NULL columns — we pass the SQL expression
   *   directly so the DB computes it from the session GUC. When the GUC is unset,
   *   NULLIF returns NULL → NOT NULL constraint rejects → fail-closed.
   *
   * The service layer THROWS before calling this if getWorkspaceId()=null (primary guard).
   * This method is the secondary (DB-level) belt+suspenders guard.
   *
   * createdBy MUST be the ALS-resolved actor users.id — never client-supplied (SF4).
   * Called INSIDE a transaction (tx handle from runInTransaction).
   */
  async insertActivity(
    tx: Tx,
    input: {
      channel: OutreachActivityRow['channel'];
      status: OutreachActivityRow['status'];
      subject: string;
      notes?: string | null;
      dueAt?: string | null;
      outreachId?: string | null;
      matchCandidateId?: string | null;
      pipelineId?: string | null;
      mandateId?: string | null;
      createdBy: string;
    }
  ): Promise<OutreachActivityRow> {
    let rows: OutreachActivityRow[];
    try {
      rows = await tx
        .insert(outreachActivity)
        .values({
          // workspace_id: SQL expression that reads the session GUC (SF1 HIGH).
          // NULLIF(current_setting('app.workspace_id', true),'')::uuid returns NULL
          // when GUC is unset → NOT NULL constraint rejects → fail-closed.
          // We do NOT hardcode a DEFAULT_WORKSPACE_ID fallback here.
          workspaceId: sql`NULLIF(current_setting('app.workspace_id', true),'')::uuid`,
          channel: input.channel,
          status: input.status ?? 'planned',
          subject: input.subject,
          notes: input.notes ?? null,
          dueAt: input.dueAt ?? null,
          outreachId: input.outreachId ?? null,
          matchCandidateId: input.matchCandidateId ?? null,
          pipelineId: input.pipelineId ?? null,
          mandateId: input.mandateId ?? null,
          createdBy: input.createdBy,
        })
        .returning();
    } catch (err: unknown) {
      const code = pgCode(err);
      if (code === '23503') {
        throw new BadRequestException('FK violation in outreach_activity insert');
      }
      if (code === '23502') {
        // NOT NULL constraint violated — GUC was unset and column DEFAULT returned NULL.
        throw new ForbiddenException(
          'outreach_activity INSERT rejected: workspace_id is NULL (GUC not set). ' +
            'This is a fail-closed SF1 guard — a service-level throw should have prevented this.'
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('OutreachActivityRepository: INSERT returned no row');
    }
    return row;
  }

  // ── READ by id (tx-scoped) ────────────────────────────────────────────────

  /**
   * findActivityByIdInTx — read an outreach_activity row by UUID (tx-scoped, RLS).
   * Returns null if not found or invisible to the current GUC.
   * BUILD rule 7: must use tx handle inside transactions.
   */
  async findActivityByIdInTx(tx: Tx, id: string): Promise<OutreachActivityRow | null> {
    const rows = await tx
      .select()
      .from(outreachActivity)
      .where(eq(outreachActivity.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  // ── UPDATE ────────────────────────────────────────────────────────────────

  /**
   * updateActivityInTx — partial update of an outreach_activity row (tx-scoped, RLS).
   * Throws NotFoundException if not found or invisible.
   * Note: RLS USING under FOR ALL also enforces the write-check — an UPDATE that
   * would move workspace_id outside the current GUC is REJECTED (42501).
   */
  async updateActivityInTx(
    tx: Tx,
    id: string,
    fields: Partial<Pick<
      OutreachActivityRow,
      | 'status'
      | 'subject'
      | 'notes'
      | 'dueAt'
      | 'completedAt'
      | 'outreachId'
      | 'matchCandidateId'
      | 'pipelineId'
      | 'mandateId'
    >>
  ): Promise<OutreachActivityRow> {
    const rows = await tx
      .update(outreachActivity)
      .set(fields)
      .where(eq(outreachActivity.id, id))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`outreach_activity ${id} not found`);
    }
    return row;
  }

  // ── LIST (RLS-scoped) ─────────────────────────────────────────────────────

  /**
   * listActivities — list outreach_activity rows for the current workspace (RLS).
   * Optional status filter; ordered by (status='planned' first, then due_at ASC).
   * Uses the (workspace_id, status, due_at) composite index for the planned filter.
   */
  async listActivities(filter?: {
    status?: OutreachActivityRow['status'];
  }): Promise<OutreachActivityRow[]> {
    const query = getDb(this.db).select().from(outreachActivity);
    if (filter?.status) {
      return query.where(eq(outreachActivity.status, filter.status));
    }
    return query;
  }

  // ── FK tenancy reads (R3/SF4) ─────────────────────────────────────────────
  // These reads run inside the tx with RLS active. A firm-B row is invisible
  // under firm-A's GUC → returns null → service throws NotFoundException.

  /**
   * findOutreachByIdInTx — verify an outreach row belongs to the caller's workspace.
   * R3/SF4: if firm-B's outreach_id is provided, RLS makes it invisible → null.
   */
  async findOutreachByIdInTx(tx: Tx, id: string): Promise<{ id: string } | null> {
    const rows = await tx
      .select({ id: outreach.id })
      .from(outreach)
      .where(eq(outreach.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findMatchCandidateByIdInTx — verify a match_candidates row belongs to the caller's workspace.
   */
  async findMatchCandidateByIdInTx(tx: Tx, id: string): Promise<{ id: string } | null> {
    const rows = await tx
      .select({ id: matchCandidates.id })
      .from(matchCandidates)
      .where(eq(matchCandidates.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findPipelineByIdInTx — verify a pipeline row belongs to the caller's workspace.
   */
  async findPipelineByIdInTx(tx: Tx, id: string): Promise<{ id: string } | null> {
    const rows = await tx
      .select({ id: pipeline.id })
      .from(pipeline)
      .where(eq(pipeline.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findMandateByIdInTx — verify a mandates row belongs to the caller's workspace.
   */
  async findMandateByIdInTx(tx: Tx, id: string): Promise<{ id: string } | null> {
    const rows = await tx
      .select({ id: mandates.id })
      .from(mandates)
      .where(eq(mandates.id, id))
      .limit(1);
    return rows[0] ?? null;
  }
}
