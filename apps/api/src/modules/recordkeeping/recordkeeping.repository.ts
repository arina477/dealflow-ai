/**
 * RecordkeepingRepository — Drizzle read queries for the recordkeeping
 * surface over the M2 audit_log_entries chain.
 *
 * READ-ONLY over audit_log_entries: this repository NEVER writes to that table.
 * The ONLY audit write in this module is via AuditService.append (export_generated),
 * which is called from RecordkeepingService.exportAsActor via the M2 AuditService.
 *
 * Mandate-scope DERIVATION (load-bearing — the P-4 karen WRONG fix):
 * audit_log_entries has NO mandate_id column. A mandate-scoped filter MUST
 * resolve each entry's mandate via its resource_type:
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
 * Org-wide entries (compliance_rule, suppression_entry, etc.) have no mandate FK —
 * they are intentionally excluded from mandate-scoped queries.
 *
 * gate-evaluate rows are intentionally excluded from the mandate-scope derivation.
 * Gate-evaluate entries are written with resource_type='outreach-template-version'
 * (keyed to the reusable template version, which is cross-mandate). Adding an
 * outreach-template-version→mandate branch would over-capture gate decisions that
 * belong to other mandates that share the same template version. Gate-evaluate
 * entries are available in time-range or full-chain exports and are provable via
 * verifyChain; they are NOT mandate-attributable via this derivation.
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
import type { StoredAuditEntry, Tx } from '../audit/audit.repository';

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
      return this.db
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
      return this.db
        .select()
        .from(auditLogEntries)
        .where(and(...conditions.simpleConditions))
        .orderBy(sql`${auditLogEntries.sequenceNumber} DESC`)
        .limit(limit)
        .offset(offset);
    }

    return this.db
      .select()
      .from(auditLogEntries)
      .orderBy(sql`${auditLogEntries.sequenceNumber} DESC`)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Tx-scoped read for the export path.
   *
   * Same filter logic as findFiltered but:
   *   - runs inside the caller's transaction (BUILD rule 7)
   *   - orders by sequence_number ASC (for chain traversal / manifest tailHash)
   *   - no pagination (export fetches all matching entries)
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

  /** Expose runInTransaction for service-level tx composition. */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
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
    // gate-evaluate is intentionally ABSENT from this derivation: gate-evaluate
    // rows use resource_type='outreach-template-version' (cross-mandate; attributing
    // one template version's gate decision to a single mandate would over-capture
    // other mandates' compliance decisions). Use time-range or full-chain export
    // to obtain gate-evaluate entries; they are in the immutable chain.
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
      )`;
      return { mandateFragment, simpleConditions };
    }

    return { mandateFragment: null, simpleConditions };
  }
}
