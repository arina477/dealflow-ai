/**
 * SourcingRepository — Drizzle queries for the sourcing read surface.
 *
 * Covers:
 *   - Connection lookup (by id)
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
import { Inject, Injectable } from '@nestjs/common';
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
   */
  async listCompanies(filter: CompaniesListFilter): Promise<
    Array<
      CompanyRow & {
        contactCount: number;
        sourceCount: number;
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

    // Augment with contact count and source count
    const result = await Promise.all(
      companyRows.map(async (company) => {
        const [contactCountRow, sourceCountRow] = await Promise.all([
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
        ]);

        return {
          ...company,
          contactCount: contactCountRow[0]?.count ?? 0,
          sourceCount: sourceCountRow[0]?.count ?? 0,
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
   * company: backfills null canonical fields and writes company_provenance.
   * Called on dedupe-resolve action='merge'.
   *
   * Uses ON CONFLICT DO NOTHING on company_provenance to be safe against
   * duplicate provenance from a retry.
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

    // Backfill null canonical fields from raw (first-writer-wins for non-null fields)
    const contributed: Record<string, boolean> = {};
    const updates: Partial<typeof companies.$inferInsert> = {};

    if (canon.domain === null && raw.domain !== null) {
      updates.domain = raw.domain;
      contributed.domain = true;
    }
    if (canon.normalizedDomain === null && raw.normalizedDomain !== null) {
      updates.normalizedDomain = raw.normalizedDomain;
      contributed.normalizedDomain = true;
    }

    if (Object.keys(updates).length > 0) {
      await tx.update(companies).set(updates).where(eq(companies.id, canonicalCompanyId));
    }

    // Write company_provenance (idempotent: ON CONFLICT DO NOTHING)
    await tx
      .insert(companyProvenance)
      .values({
        companyId: canonicalCompanyId,
        rawCompanyId,
        connectionId: raw.connectionId,
        contributedFields: Object.keys(contributed).length > 0 ? contributed : null,
      })
      .onConflictDoNothing();
  }

  /** Expose the db handle for opening transactions in SourcingService. */
  runInTransaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}
