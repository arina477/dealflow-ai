/**
 * SourcingRepository — Drizzle queries for the sourcing read surface.
 *
 * Covers:
 *   - Connection lookup (by id), create, list (wave-7 AC-SEED)
 *   - Companies list with filters (name/domain/source/status)
 *   - Company detail (with contacts, provenance, pending candidates)
 *   - Dedupe candidate lookup (by id, with pending status check)
 *
 * All reads are against the canonical tier (companies + contacts +
 * company_provenance + dedupe_candidates). Raw staging reads live in
 * IngestionService (ETL path).
 *
 * This class is a pure Drizzle query repository — no business logic, no audit,
 * no role checks. Business logic and audit live in SourcingService.
 */

import type { CompaniesListFilter } from '@dealflow/shared';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import {
  companies,
  companyProvenance,
  contacts,
  dataSourceConnections,
  dedupeCandidates,
  rawCompanies,
} from '../../db/schema/sourcing';
import { DedupeEngine, normalizeDomain, normalizeName } from './dedupe.engine';

export type ConnectionRow = typeof dataSourceConnections.$inferSelect;
export type CompanyRow = typeof companies.$inferSelect;
export type ContactRow = typeof contacts.$inferSelect;
export type CompanyProvenanceRow = typeof companyProvenance.$inferSelect;
export type DedupeCandidateRow = typeof dedupeCandidates.$inferSelect;

/** Tx type for transaction-composable writes (used by SourcingService). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class SourcingRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Connection queries
  // ---------------------------------------------------------------------------

  async findConnectionById(id: string): Promise<ConnectionRow | null> {
    const rows = await this.db
      .select()
      .from(dataSourceConnections)
      .where(eq(dataSourceConnections.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * createConnection — inserts a new data_source_connections row.
   * created_by is set to the app users.id (never the raw SuperTokens id).
   * Must be called within the caller's transaction (tx) for atomicity with audit.
   *
   * INFO fix: data_source_connections.display_name has a UNIQUE constraint
   * (migration 0005). A duplicate display_name INSERT raises SQLSTATE 23505;
   * we catch it here and surface it as ConflictException (409) so callers get
   * a meaningful "a connection with that name exists" error instead of a 500.
   */
  async createConnection(
    tx: Tx,
    input: {
      providerKey: string;
      displayName: string;
      config: Record<string, unknown>;
      createdBy: string;
    }
  ): Promise<ConnectionRow> {
    let rows: ConnectionRow[];
    try {
      rows = await tx
        .insert(dataSourceConnections)
        .values({
          providerKey: input.providerKey,
          displayName: input.displayName,
          config: input.config,
          createdBy: input.createdBy,
        })
        .returning();
    } catch (err: unknown) {
      // SQLSTATE 23505 = unique_violation — display_name UNIQUE constraint (migration 0005).
      //
      // C-2 fix: drizzle-orm wraps the raw pg driver error in a DrizzleQueryError
      // whose own .code is undefined; the real code:'23505' lives on err.cause.code.
      // We must check both levels so the ConflictException branch fires against both
      // the real drizzle-wrapped error (err.cause.code) and any bare pg error that
      // surfaces without wrapping (err.code) — e.g. from connection-level throws.
      const pgCode =
        (typeof err === 'object' &&
          err !== null &&
          'cause' in err &&
          typeof (err as { cause: unknown }).cause === 'object' &&
          (err as { cause: unknown }).cause !== null &&
          'code' in (err as { cause: Record<string, unknown> }).cause &&
          (err as { cause: Record<string, unknown> }).cause.code) ||
        (typeof err === 'object' && err !== null && 'code' in err
          ? (err as { code: unknown }).code
          : undefined);
      if (pgCode === '23505') {
        throw new ConflictException(
          `A connection with the display name "${input.displayName}" already exists`
        );
      }
      throw err;
    }
    const row = rows[0];
    if (!row) {
      throw new Error('SourcingRepository: INSERT data_source_connections returned no row');
    }
    return row;
  }

  /**
   * listConnections — returns all data_source_connections rows, ordered by
   * created_at ascending (oldest first — stable list order for the workspace).
   * Optionally augmented with a per-connection company count for the ≥2-source
   * facet; count derived from company_provenance.
   */
  async listConnections(): Promise<Array<ConnectionRow & { companyCount: number }>> {
    const rows = await this.db
      .select()
      .from(dataSourceConnections)
      .orderBy(dataSourceConnections.createdAt);

    const result = await Promise.all(
      rows.map(async (conn) => {
        const countRows = await this.db
          .select({
            count: sql<number>`cast(count(distinct ${companyProvenance.companyId}) as int)`,
          })
          .from(companyProvenance)
          .where(eq(companyProvenance.connectionId, conn.id));
        return {
          ...conn,
          companyCount: countRows[0]?.count ?? 0,
        };
      })
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // Companies list + filter
  // ---------------------------------------------------------------------------

  /**
   * listCompanies — returns canonical companies matching the optional filter.
   *
   * Filter semantics:
   *   q       → ILIKE %q% against name OR domain
   *   source  → companies that have at least one company_provenance row from
   *             that connection_id (i.e. sourced from that connection)
   *   status  → exact match on companies.status (default 'active' when omitted)
   *
   * Each result row is augmented with:
   *   contactCount   → number of canonical contacts for this company
   *   sourceCount    → number of distinct connections that contributed provenance
   *   connectionIds  → distinct data_source_connection ids that sourced this
   *                    company (via company_provenance); used by the web
   *                    ResultsMatrix to render per-company source badges.
   */
  async listCompanies(filter: CompaniesListFilter): Promise<
    Array<
      CompanyRow & {
        contactCount: number;
        sourceCount: number;
        connectionIds: string[];
      }
    >
  > {
    // Build the where conditions
    const conditions = [];

    // status filter (default: active when not specified)
    const status = filter.status ?? 'active';
    conditions.push(eq(companies.status, status));

    // text search on name / domain
    if (filter.q) {
      const pattern = `%${filter.q}%`;
      conditions.push(or(ilike(companies.name, pattern), ilike(companies.domain ?? '', pattern)));
    }

    // source filter — companies that have provenance from the specified connection
    if (filter.source) {
      const sourceConnectionId = filter.source;
      // Subquery: company ids that have provenance from this connection
      const provenanceSubquery = this.db
        .selectDistinct({ companyId: companyProvenance.companyId })
        .from(companyProvenance)
        .where(eq(companyProvenance.connectionId, sourceConnectionId));

      const provenanceRows = await provenanceSubquery;
      const eligibleIds = provenanceRows.map((r) => r.companyId);

      if (eligibleIds.length === 0) {
        return [];
      }
      conditions.push(inArray(companies.id, eligibleIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const companyRows = await this.db.select().from(companies).where(whereClause);

    // Augment with contact count, source count, and connectionIds
    const result = await Promise.all(
      companyRows.map(async (company) => {
        const [contactCountRow, sourceCountRow, connectionIdRows] = await Promise.all([
          this.db
            .select({ count: sql<number>`cast(count(*) as int)` })
            .from(contacts)
            .where(eq(contacts.companyId, company.id)),
          this.db
            .select({
              count: sql<number>`cast(count(distinct ${companyProvenance.connectionId}) as int)`,
            })
            .from(companyProvenance)
            .where(eq(companyProvenance.companyId, company.id)),
          // CRITICAL-1 fix: return distinct connection ids that sourced this
          // company so the web ResultsMatrix can render per-company source badges.
          this.db
            .selectDistinct({ connectionId: companyProvenance.connectionId })
            .from(companyProvenance)
            .where(eq(companyProvenance.companyId, company.id)),
        ]);

        return {
          ...company,
          contactCount: contactCountRow[0]?.count ?? 0,
          sourceCount: sourceCountRow[0]?.count ?? 0,
          connectionIds: connectionIdRows.map((r) => r.connectionId),
        };
      })
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // Company detail
  // ---------------------------------------------------------------------------

  async findCompanyById(id: string): Promise<CompanyRow | null> {
    const rows = await this.db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findContactsByCompanyId(companyId: string): Promise<ContactRow[]> {
    return this.db.select().from(contacts).where(eq(contacts.companyId, companyId));
  }

  async findProvenanceByCompanyId(companyId: string): Promise<CompanyProvenanceRow[]> {
    return this.db
      .select()
      .from(companyProvenance)
      .where(eq(companyProvenance.companyId, companyId));
  }

  async findPendingCandidatesByMatchedCompany(
    matchedCompanyId: string
  ): Promise<DedupeCandidateRow[]> {
    return this.db
      .select()
      .from(dedupeCandidates)
      .where(
        and(
          eq(dedupeCandidates.matchedCompanyId, matchedCompanyId),
          eq(dedupeCandidates.status, 'pending')
        )
      );
  }

  // ---------------------------------------------------------------------------
  // Dedupe candidate queries
  // ---------------------------------------------------------------------------

  async findDedupeCandidateById(id: string): Promise<DedupeCandidateRow | null> {
    const rows = await this.db
      .select()
      .from(dedupeCandidates)
      .where(eq(dedupeCandidates.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findRawCompanyById(id: string): Promise<typeof rawCompanies.$inferSelect | null> {
    const rows = await this.db.select().from(rawCompanies).where(eq(rawCompanies.id, id)).limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------------------------------------------------------
  // Transaction-composable writes (used by SourcingService.resolveDedupeCandidate)
  // ---------------------------------------------------------------------------

  /**
   * updateDedupeCandidateStatus — marks a candidate as merged or rejected.
   * MUST be called within the caller's transaction (tx) for atomicity with audit.
   */
  async updateDedupeCandidateStatus(
    tx: Tx,
    candidateId: string,
    status: 'merged' | 'rejected',
    resolvedBy: string
  ): Promise<DedupeCandidateRow> {
    const rows = await tx
      .update(dedupeCandidates)
      .set({
        status,
        resolvedBy,
        resolvedAt: sql`now()`,
      })
      .where(eq(dedupeCandidates.id, candidateId))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new Error(
        `SourcingRepository: UPDATE dedupe_candidates returned no row for id=${candidateId}`
      );
    }
    return row;
  }

  /**
   * mergeRawIntoCanonical — promotes the raw record into the matched canonical
   * company: backfills null canonical fields, writes company_provenance, and
   * promotes contacts + contact_provenance.
   *
   * CRITICAL-2 fix: previously this method only wrote company_provenance and
   * never promoted contacts, violating principle-3 ("every canonical contact
   * has ≥1 contact_provenance"). Now it delegates to DedupeEngine.mergeInto
   * so the auto-merge path and the human-resolve path share ONE implementation
   * with no drift.
   *
   * Called on dedupe-resolve action='merge' (human-approved path).
   */
  async mergeRawIntoCanonical(
    tx: Tx,
    rawCompanyId: string,
    canonicalCompanyId: string
  ): Promise<void> {
    // Load the raw row
    const rawRows = await tx
      .select()
      .from(rawCompanies)
      .where(eq(rawCompanies.id, rawCompanyId))
      .limit(1);
    const raw = rawRows[0];
    if (!raw) {
      throw new Error(`SourcingRepository: raw_company ${rawCompanyId} not found during merge`);
    }

    // Load the canonical row
    const canonRows = await tx
      .select()
      .from(companies)
      .where(eq(companies.id, canonicalCompanyId))
      .limit(1);
    const canon = canonRows[0];
    if (!canon) {
      throw new Error(
        `SourcingRepository: canonical company ${canonicalCompanyId} not found during merge`
      );
    }

    // Delegate to DedupeEngine.mergeInto which writes:
    //   1. UPDATE companies (backfill nulls only)
    //   2. company_provenance (idempotent: ON CONFLICT DO NOTHING)
    //   3. contacts upserted by normalized_email (idempotent)
    //   4. contact_provenance for every contact (idempotent: ON CONFLICT DO NOTHING)
    // This is the SAME implementation used by the auto-merge path, ensuring no
    // drift between machine-promoted and human-approved merges.
    const engine = new DedupeEngine();
    const normDomain = normalizeDomain(raw.domain);
    const normName = normalizeName(raw.name);
    await engine.mergeInto(tx, raw, canon, normDomain, normName);
  }

  /**
   * findDedupeCandidateByIdForUpdate — reads a dedupe_candidate inside a
   * transaction with a SELECT ... FOR UPDATE lock.
   *
   * CRITICAL-3 fix: the candidate read in resolveDedupeCandidate must occur
   * INSIDE the transaction (not on this.db before the tx opens). Using FOR UPDATE
   * ensures that two concurrent resolves on the same candidate serialize at the
   * DB level — the second waits until the first commits, then sees the updated
   * status and throws ConflictException.
   *
   * MUST be called within the caller's transaction (tx).
   */
  async findDedupeCandidateByIdForUpdate(tx: Tx, id: string): Promise<DedupeCandidateRow | null> {
    const rows = await tx
      .select()
      .from(dedupeCandidates)
      .where(eq(dedupeCandidates.id, id))
      .for('update')
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * updateDedupeCandidateStatusConditional — atomically transitions a candidate
   * from pending → merged|rejected, but ONLY if it is still pending.
   *
   * CRITICAL-3 fix: the WHERE status='pending' guard makes this a single-winner
   * operation. If two concurrent resolves both pass the read check, only one will
   * win this UPDATE (the first to commit). The loser gets 0 rows returned →
   * ConflictException is thrown, preventing double-merge + double-audit.
   *
   * MUST be called within the caller's transaction (tx) for atomicity with audit.
   */
  async updateDedupeCandidateStatusConditional(
    tx: Tx,
    candidateId: string,
    status: 'merged' | 'rejected',
    resolvedBy: string
  ): Promise<DedupeCandidateRow> {
    const rows = await tx
      .update(dedupeCandidates)
      .set({
        status,
        resolvedBy,
        resolvedAt: sql`now()`,
      })
      .where(and(eq(dedupeCandidates.id, candidateId), eq(dedupeCandidates.status, 'pending')))
      .returning();
    const row = rows[0];
    if (!row) {
      // Zero rows updated: either the candidate doesn't exist OR it was already
      // resolved by a concurrent request. In both cases, throw ConflictException
      // so the caller does not proceed with audit (no double-merge).
      throw new ConflictException(
        `Dedupe candidate ${candidateId} could not be resolved: it no longer has status=pending. ` +
          'A concurrent resolve may have already processed it.'
      );
    }
    return row;
  }

  /** Expose the db handle for opening transactions in SourcingService. */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
