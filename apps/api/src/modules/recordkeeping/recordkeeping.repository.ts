/**
 * RecordkeepingRepository — Drizzle read queries for the recordkeeping
 * surface over the M2 audit_log_entries chain.
 *
 * READ-ONLY over audit_log_entries: this repository NEVER writes to that table.
 * The ONLY audit write in this module is via AuditService.append (export_generated),
 * which is called from RecordkeepingService.exportAsActor via the M2 AuditService.
 *
 * Mandate-scope DERIVATION (load-bearing — the P-4 karen WRONG fix):
 * audit_log_entries has a nullable hash-excluded mandate_id column (wave-14,
 * task 487b0f0c). A mandate-scoped filter resolves each entry's mandate via:
 *   'mandate'                  → resource_id IS the mandate UUID (direct match)
 *   'outreach'                 → JOIN outreach ON id WHERE outreach.mandate_id = ?
 *   'pipeline'                 → JOIN pipeline ON id WHERE pipeline.mandate_id = ?
 *   'pipeline_event'           → JOIN pipeline_events→pipeline WHERE pipeline.mandate_id = ?
 *   'match_run'                → JOIN match_run ON id WHERE match_run.mandate_id = ?
 *   'match_candidate'          → JOIN match_candidates→match_run WHERE match_run.mandate_id = ?
 *   'buyer_universe'           → JOIN buyer_universe ON id WHERE buyer_universe.mandate_id = ?
 *   'buyer_universe_candidate' → JOIN buyer_universe_candidates→buyer_universe WHERE mandate_id = ?
 *   'audit-log-export'         → resource_id IS the mandate UUID (direct match on
 *                                 prior export events for this mandate's records)
 *   'outreach-template-version' (gate-evaluate rows) →
 *                                 mandate_id column = ? (direct match on the
 *                                 hash-excluded mandate_id column populated at
 *                                 gate-evaluate time — wave-14 487b0f0c)
 * Org-wide entries (compliance_rule, suppression_entry, etc.) have no mandate FK —
 * they are intentionally excluded from mandate-scoped queries.
 *
 * gate-evaluate rows ARE now included in the mandate-scope derivation (wave-14,
 * task 487b0f0c reversal). Prior to wave-14 these rows were intentionally
 * excluded because resource_type='outreach-template-version' is cross-mandate
 * and a join-based derivation would over-capture decisions belonging to other
 * mandates sharing the same template version. The wave-14 solution records the
 * mandate context directly in the hash-excluded mandate_id column at gate-evaluate
 * time (ComplianceGateService.evaluate → appendWithMandate), so the derivation
 * can filter on mandate_id = ? with no over-capture. Entries written before
 * wave-14 have mandate_id = NULL and are correctly excluded (NULL ≠ mid).
 *
 * Advisor scope:
 * When advisorUserId is provided (role='advisor'), only entries whose resource_id
 * corresponds to an outreach record created by the advisor are returned:
 *   resource_type = 'outreach' AND resource_id IN (
 *     SELECT id::text FROM outreach WHERE created_by = advisorUserId
 *   )
 * This captures audit entries keyed directly to the advisor's own outreach records
 * (e.g. outreach-compose, outreach-send). The role-scope is exclusive: advisor only
 * gets outreach entries (no pipeline, match, etc.).
 *
 * When mandateId is ALSO provided alongside advisorUserId, the mandate is ANDed
 * into the outreach subquery so the advisor scope narrows to outreach belonging to
 * that specific mandate only (not all of the advisor's own-outreach across every
 * mandate).
 *
 * Error unwrap: DrizzleError.cause.code / err.code (wave-6 lesson).
 *
 * BUILD RULE 7: reads inside runInTransaction MUST use the tx handle.
 */

import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';

import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { auditLogEntries } from '../../db/schema/audit-log';
import { getDb } from '../../db/workspace-context';
import type { StoredAuditEntry, Tx } from '../audit/audit.repository';

// ---------------------------------------------------------------------------
// Export cap constant (SEC-4)
// ---------------------------------------------------------------------------

/**
 * Maximum number of rows returned in a single export across all scopes.
 * On cap-hit, the manifest carries truncated:true + rowsAvailable so the
 * caller can narrow the date range. NEVER emit a silently-short "complete" file.
 */
export const EXPORT_ROW_CAP = 50_000;

/**
 * Default date-range lookback when from/to are omitted (SEC-4).
 * Returns an ISO string for 12 months ago from now.
 */
export function defaultFromDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// Deal/pipeline export row shape (SEC-3)
// ---------------------------------------------------------------------------

/**
 * A single row from the deal/pipeline scope export.
 * Joins pipeline (RLS-covered) → mandates (RLS-covered).
 * The `firmLocalOrdinal` is assigned in the service layer (SEC-6).
 * No global sequence_number — that is the audit log's cross-tenant side-channel.
 */
export interface DealExportRow {
  pipelineId: string;
  mandateId: string;
  dealSourceType: string;
  outreachId: string | null;
  matchCandidateId: string | null;
  stage: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string | null;
  /** Seller name from the joined mandate — no cross-workspace join; mandates is RLS-covered. */
  mandateSellerName: string | null;
}

// ---------------------------------------------------------------------------
// Query filter shape
// ---------------------------------------------------------------------------

export interface RecordkeepingFilter {
  /** Mandate UUID — triggers the per-resource_type derivation in WHERE clause. */
  mandateId?: string;
  /** Filter by action string (e.g. 'outreach-compose'). */
  type?: string;
  /** Filter by actorUserId (app users.id UUID). */
  actor?: string;
  /** ISO datetime lower bound (inclusive). */
  from?: string;
  /** ISO datetime upper bound (inclusive). */
  to?: string;
  /** Page size (max 200, default 50). */
  limit?: number;
  /** Page offset (default 0). */
  offset?: number;
  /**
   * Advisor user id (app users.id). When present, restricts output to entries
   * about outreach records created by this advisor (own-outreach scope).
   * Mutually exclusive with org-wide access (compliance/admin).
   */
  advisorUserId?: string;
}

// ---------------------------------------------------------------------------
// DrizzleError unwrap helper (wave-6 lesson)
// ---------------------------------------------------------------------------

/**
 * Extract the pg error code from either:
 *   err.cause.code — DrizzleQueryError wraps the native pg error in .cause
 *   err.code       — bare pg driver error (e.g. connection-level throws)
 */
export function pgCode(err: unknown): string | undefined {
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
// RecordkeepingRepository
// ---------------------------------------------------------------------------

@Injectable()
export class RecordkeepingRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Filtered + paginated read over audit_log_entries.
   *
   * When `filter.mandateId` is provided, applies the full mandate-scope
   * derivation (per resource_type) using a compound OR SQL fragment.
   * When `filter.advisorUserId` is provided, restricts to outreach entries
   * owned by that advisor (own-outreach advisor scope).
   *
   * Returns entries sorted by sequence_number DESC (newest first) by default —
   * appropriate for the UI audit-log table. The export path uses a separate
   * method that orders ASC for chain traversal.
   */
  async findFiltered(filter: RecordkeepingFilter): Promise<StoredAuditEntry[]> {
    const conditions = this.buildConditions(filter);
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    // Build the base query with all conditions
    // Use raw sql for the complex mandate derivation fragment
    if (conditions.mandateFragment) {
      return getDb(this.db)
        .select()
        .from(auditLogEntries)
        .where(
          sql`${conditions.mandateFragment}${conditions.simpleConditions.length > 0 ? sql` AND ${and(...conditions.simpleConditions)}` : sql``}`
        )
        .orderBy(sql`${auditLogEntries.sequenceNumber} DESC`)
        .limit(limit)
        .offset(offset);
    }

    if (conditions.simpleConditions.length > 0) {
      return getDb(this.db)
        .select()
        .from(auditLogEntries)
        .where(and(...conditions.simpleConditions))
        .orderBy(sql`${auditLogEntries.sequenceNumber} DESC`)
        .limit(limit)
        .offset(offset);
    }

    return getDb(this.db)
      .select()
      .from(auditLogEntries)
      .orderBy(sql`${auditLogEntries.sequenceNumber} DESC`)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Tx-scoped read for the export path (original, unbounded).
   *
   * Same filter logic as findFiltered but:
   *   - runs inside the caller's transaction (BUILD rule 7)
   *   - orders by sequence_number ASC (for chain traversal / manifest tailHash)
   *   - no pagination (export fetches all matching entries)
   *
   * NOTE: Use findForExportBounded for all new export code paths. This method
   * is retained for internal use (count queries, verifyChain).
   */
  async findForExport(
    filter: Omit<RecordkeepingFilter, 'limit' | 'offset' | 'advisorUserId'>,
    tx: Tx
  ): Promise<StoredAuditEntry[]> {
    const conditions = this.buildConditions(filter);

    if (conditions.mandateFragment) {
      return tx
        .select()
        .from(auditLogEntries)
        .where(
          sql`${conditions.mandateFragment}${conditions.simpleConditions.length > 0 ? sql` AND ${and(...conditions.simpleConditions)}` : sql``}`
        )
        .orderBy(asc(auditLogEntries.sequenceNumber));
    }

    if (conditions.simpleConditions.length > 0) {
      return tx
        .select()
        .from(auditLogEntries)
        .where(and(...conditions.simpleConditions))
        .orderBy(asc(auditLogEntries.sequenceNumber));
    }

    return tx.select().from(auditLogEntries).orderBy(asc(auditLogEntries.sequenceNumber));
  }

  /**
   * SEC-4: bounded tx-scoped read for audit export.
   *
   * Same as findForExport but applies an explicit row cap (EXPORT_ROW_CAP + 1)
   * so the caller can detect truncation: if returned.length > EXPORT_ROW_CAP,
   * the cap was hit. The extra row is trimmed by the service; it is used only
   * to detect the truncation condition.
   *
   * SEC-1: runs via the tx handle (getDb-RLS path — audit_log_entries HAS FORCE
   * RLS; FORBID read_audit_chain_rls_exempt in this path).
   * Defense-in-depth workspace_id filter is NOT applied here (RLS is the load-bearing
   * guard); it is optionally applied at the service layer if desired.
   */
  async findForExportBounded(
    filter: Omit<RecordkeepingFilter, 'limit' | 'offset' | 'advisorUserId'>,
    tx: Tx,
    cap: number = EXPORT_ROW_CAP
  ): Promise<{ rows: StoredAuditEntry[]; truncated: boolean; rowsAvailable: number }> {
    // Fetch cap+1 to detect truncation without a separate COUNT(*) query.
    const conditions = this.buildConditions(filter);
    let fetched: StoredAuditEntry[];

    if (conditions.mandateFragment) {
      fetched = await tx
        .select()
        .from(auditLogEntries)
        .where(
          sql`${conditions.mandateFragment}${conditions.simpleConditions.length > 0 ? sql` AND ${and(...conditions.simpleConditions)}` : sql``}`
        )
        .orderBy(asc(auditLogEntries.sequenceNumber))
        .limit(cap + 1);
    } else if (conditions.simpleConditions.length > 0) {
      fetched = await tx
        .select()
        .from(auditLogEntries)
        .where(and(...conditions.simpleConditions))
        .orderBy(asc(auditLogEntries.sequenceNumber))
        .limit(cap + 1);
    } else {
      fetched = await tx
        .select()
        .from(auditLogEntries)
        .orderBy(asc(auditLogEntries.sequenceNumber))
        .limit(cap + 1);
    }

    const truncated = fetched.length > cap;
    const rows = truncated ? fetched.slice(0, cap) : fetched;

    // If truncated, we need the real count. Do a COUNT query.
    let rowsAvailable: number;
    if (truncated) {
      rowsAvailable = await this.countAuditRows(filter, tx);
    } else {
      rowsAvailable = rows.length;
    }

    return { rows, truncated, rowsAvailable };
  }

  /**
   * SEC-4: count audit rows matching the filter for the rowsAvailable field.
   * Only called on cap-hit to populate the manifest truncation signal.
   */
  private async countAuditRows(
    filter: Omit<RecordkeepingFilter, 'limit' | 'offset' | 'advisorUserId'>,
    tx: Tx
  ): Promise<number> {
    const conditions = this.buildConditions(filter);
    let result: Array<{ count: unknown }>;

    if (conditions.mandateFragment) {
      result = await tx
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditLogEntries)
        .where(
          sql`${conditions.mandateFragment}${conditions.simpleConditions.length > 0 ? sql` AND ${and(...conditions.simpleConditions)}` : sql``}`
        );
    } else if (conditions.simpleConditions.length > 0) {
      result = await tx
        .select({ count: sql<number>`COUNT(*)` })
        .from(auditLogEntries)
        .where(and(...conditions.simpleConditions));
    } else {
      result = await tx.select({ count: sql<number>`COUNT(*)` }).from(auditLogEntries);
    }

    return Number(result[0]?.count ?? 0);
  }

  /**
   * SEC-3: bounded deal/pipeline export via getDb/RLS (FORCE RLS scoped to
   * the current workspace; mandates and pipeline are RLS-covered tenant tables).
   *
   * SEC-10: joins ONLY RLS-covered tenant tables (pipeline, mandates). The
   * `mandates.seller_name` field is the only cross-join field and belongs to the
   * caller's own workspace (RLS ensures this). No join to global tables
   * (roles, workspaces, app_meta) for any non-caller-scoped fields.
   *
   * SEC-4: bounded by cap (cap+1 fetch → truncation signal).
   *
   * The from/to filter is applied on pipeline.created_at.
   * mandateId scopes the export to a single mandate's pipeline rows.
   */
  async findDealRowsBounded(
    filter: { mandateId?: string; from?: string; to?: string },
    tx: Tx,
    cap: number = EXPORT_ROW_CAP
  ): Promise<{ rows: DealExportRow[]; truncated: boolean; rowsAvailable: number }> {
    // Build WHERE conditions for pipeline
    const whereConditions: ReturnType<typeof eq>[] = [];
    if (filter.from) {
      // pipeline.created_at >= from
      whereConditions.push(
        sql`pipeline.created_at >= ${filter.from}` as unknown as ReturnType<typeof eq>
      );
    }
    if (filter.to) {
      whereConditions.push(
        sql`pipeline.created_at <= ${filter.to}` as unknown as ReturnType<typeof eq>
      );
    }
    if (filter.mandateId) {
      whereConditions.push(
        sql`pipeline.mandate_id = ${filter.mandateId}::uuid` as unknown as ReturnType<typeof eq>
      );
    }

    const whereClause =
      whereConditions.length > 0 ? sql`WHERE ${sql.join(whereConditions, sql` AND `)}` : sql``;

    // SEC-10: JOIN only RLS-covered tenant tables — pipeline + mandates.
    // mandates.workspace_id is enforced by FORCE RLS policy; no global-table joins.
    const rawQuery = sql`
      SELECT
        pipeline.id              AS "pipelineId",
        pipeline.mandate_id      AS "mandateId",
        pipeline.deal_source_type AS "dealSourceType",
        pipeline.outreach_id     AS "outreachId",
        pipeline.match_candidate_id AS "matchCandidateId",
        pipeline.stage           AS "stage",
        pipeline.created_by      AS "createdBy",
        pipeline.created_at      AS "createdAt",
        pipeline.updated_at      AS "updatedAt",
        mandates.seller_name     AS "mandateSellerName"
      FROM pipeline
      LEFT JOIN mandates ON mandates.id = pipeline.mandate_id
      ${whereClause}
      ORDER BY pipeline.created_at ASC
      LIMIT ${cap + 1}
    `;

    const result = await tx.execute<Record<string, unknown>>(rawQuery);
    const fetched: DealExportRow[] = result.rows.map((r) => ({
      pipelineId: r.pipelineId as string,
      mandateId: r.mandateId as string,
      dealSourceType: r.dealSourceType as string,
      outreachId: (r.outreachId as string | null) ?? null,
      matchCandidateId: (r.matchCandidateId as string | null) ?? null,
      stage: r.stage as string,
      createdBy: r.createdBy as string,
      createdAt: r.createdAt as string,
      updatedAt: (r.updatedAt as string | null) ?? null,
      mandateSellerName: (r.mandateSellerName as string | null) ?? null,
    }));

    const truncated = fetched.length > cap;
    const rows = truncated ? fetched.slice(0, cap) : fetched;

    let rowsAvailable: number;
    if (truncated) {
      // Separate COUNT query on cap-hit
      const countQuery = sql`
        SELECT COUNT(*) AS cnt
        FROM pipeline
        ${whereClause}
      `;
      const countResult = await tx.execute<{ cnt: unknown }>(countQuery);
      rowsAvailable = Number(countResult.rows[0]?.cnt ?? 0);
    } else {
      rowsAvailable = rows.length;
    }

    return { rows, truncated, rowsAvailable };
  }

  /** Expose runInTransaction for service-level tx composition. */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return getDb(this.db).transaction(work);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildConditions(filter: RecordkeepingFilter): {
    mandateFragment: ReturnType<typeof sql> | null;
    simpleConditions: ReturnType<typeof eq>[];
  } {
    const simpleConditions: ReturnType<typeof eq>[] = [];

    // Direct column filters (type, actor, from, to)
    if (filter.type) {
      simpleConditions.push(eq(auditLogEntries.action, filter.type));
    }
    if (filter.actor) {
      simpleConditions.push(eq(auditLogEntries.actorUserId, filter.actor));
    }
    if (filter.from) {
      simpleConditions.push(gte(auditLogEntries.createdAt, filter.from));
    }
    if (filter.to) {
      simpleConditions.push(lte(auditLogEntries.createdAt, filter.to));
    }

    // Advisor scope: restrict to own-outreach entries.
    // When mandateId is also provided, AND it into the outreach subquery so the
    // advisor scope is narrowed to that specific mandate's outreach records only.
    // Without this narrowing an advisor filtering by mandateId would see ALL their
    // own-outreach entries across every mandate — L3 correctness fix.
    if (filter.advisorUserId) {
      const mandateClause = filter.mandateId
        ? sql` AND mandate_id = ${filter.mandateId}::uuid`
        : sql``;

      const advisorFragment = sql`(
        ${auditLogEntries.resourceType} = 'outreach'
        AND ${auditLogEntries.resourceId} IN (
          SELECT id::text FROM outreach WHERE created_by = ${filter.advisorUserId}::uuid${mandateClause}
        )
      )`;
      // Combine with simpleConditions via AND
      if (simpleConditions.length > 0) {
        return {
          mandateFragment: sql`${advisorFragment} AND ${and(...simpleConditions)}`,
          simpleConditions: [],
        };
      }
      return { mandateFragment: advisorFragment, simpleConditions: [] };
    }

    // Mandate-scope derivation (per resource_type)
    //
    // Wave-14 (487b0f0c): gate-evaluate rows (resource_type='outreach-template-version')
    // are NOW INCLUDED via the hash-excluded mandate_id column. Prior to wave-14 these
    // were intentionally excluded (cross-mandate template version → over-capture risk).
    // The wave-14 solution records mandateId at gate-evaluate time in a separate
    // column (never in the HMAC preimage), so the derivation filters on
    // mandate_id = mid::uuid with zero over-capture. Entries from before wave-14
    // have mandate_id = NULL and are correctly excluded by this filter.
    if (filter.mandateId) {
      const mid = filter.mandateId;
      const mandateFragment = sql`(
        (${auditLogEntries.resourceType} = 'mandate' AND ${auditLogEntries.resourceId} = ${mid})
        OR (${auditLogEntries.resourceType} = 'outreach' AND ${auditLogEntries.resourceId} IN (
          SELECT id::text FROM outreach WHERE mandate_id = ${mid}::uuid
        ))
        OR (${auditLogEntries.resourceType} = 'pipeline' AND ${auditLogEntries.resourceId} IN (
          SELECT id::text FROM pipeline WHERE mandate_id = ${mid}::uuid
        ))
        OR (${auditLogEntries.resourceType} = 'pipeline_event' AND ${auditLogEntries.resourceId} IN (
          SELECT pe.id::text FROM pipeline_events pe
          JOIN pipeline p ON p.id = pe.pipeline_id
          WHERE p.mandate_id = ${mid}::uuid
        ))
        OR (${auditLogEntries.resourceType} = 'match_run' AND ${auditLogEntries.resourceId} IN (
          SELECT id::text FROM match_run WHERE mandate_id = ${mid}::uuid
        ))
        OR (${auditLogEntries.resourceType} = 'match_candidate' AND ${auditLogEntries.resourceId} IN (
          SELECT mc.id::text FROM match_candidates mc
          JOIN match_run mr ON mr.id = mc.match_run_id
          WHERE mr.mandate_id = ${mid}::uuid
        ))
        OR (${auditLogEntries.resourceType} = 'buyer_universe' AND ${auditLogEntries.resourceId} IN (
          SELECT id::text FROM buyer_universe WHERE mandate_id = ${mid}::uuid
        ))
        OR (${auditLogEntries.resourceType} = 'buyer_universe_candidate' AND ${auditLogEntries.resourceId} IN (
          SELECT buc.id::text FROM buyer_universe_candidates buc
          JOIN buyer_universe bu ON bu.id = buc.buyer_universe_id
          WHERE bu.mandate_id = ${mid}::uuid
        ))
        OR (${auditLogEntries.resourceType} = 'audit-log-export' AND ${auditLogEntries.resourceId} = ${mid})
        OR (${auditLogEntries.resourceType} = 'outreach-template-version'
            AND ${auditLogEntries.mandateId} = ${mid}::uuid)
      )`;
      return { mandateFragment, simpleConditions };
    }

    return { mandateFragment: null, simpleConditions };
  }
}
