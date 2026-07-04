/**
 * DedupeEngine — raw_companies (staging) → canonical companies + contacts.
 *
 * This is the correctness-critical piece of the wave-6 deal-sourcing data spine.
 * It is the PRIMARY deliverable from postgres-pro (P-4 designation).
 *
 * ── Design overview ──────────────────────────────────────────────────────────
 *
 * The engine operates ENTIRELY within a caller-supplied Drizzle transaction so
 * that a mid-batch failure rolls back all canonical + provenance writes while
 * leaving the staging tier (raw_companies) untouched. The ETL service invokes
 * the engine AFTER its staging upsert, in a SEPARATE transaction.
 *
 * TWO-TIER MODEL:
 *   Staging   → raw_companies  (written by ETL; read-only to engine)
 *   Canonical → companies + contacts + *_provenance  (written by engine only)
 *
 * ── Normalization ────────────────────────────────────────────────────────────
 *
 * normalizeDomain(domain):
 *   1. Lowercase.
 *   2. Strip protocol prefix (http://, https://, ftp://).
 *   3. Strip leading www.
 *   4. Strip path/query/fragment (keep only the host part).
 *   5. Trim whitespace.
 *   Returns null if the result is empty.
 *
 * normalizeName(name):
 *   1. Lowercase, trim.
 *   2. Collapse internal whitespace to single space.
 *   3. Strip common corporate suffixes: inc, llc, ltd, corp, co, plc, gmbh,
 *      limited, incorporated (word-boundary match, trailing punctuation stripped).
 *   4. Strip remaining punctuation (non-alphanumeric, non-space).
 *   5. Trim again.
 *   Returns null if the result is empty.
 *
 * normalizeEmail(email):
 *   1. Lowercase, trim.
 *   Returns null if the result is empty.
 *
 * ── Match rules (deterministic; documented) ──────────────────────────────────
 *
 * Priority 1 — DOMAIN MATCH (auto-merge, high-confidence):
 *   raw.normalized_domain === canonical.normalized_domain (both non-null).
 *   → Merge: backfill null canonical fields from raw (first-writer-wins for
 *     non-null canonical fields). Write company_provenance + contact_provenance.
 *     Do NOT create a second canonical company.
 *
 * Priority 2 — NAME MATCH (auto-merge, medium-confidence):
 *   normalized name (both non-null) is an exact string match AND no conflicting
 *   domain (i.e., neither record has a domain OR both have the same domain).
 *   → Auto-merge (same semantics as domain match).
 *
 * Priority 3 — AMBIGUOUS (below auto-merge threshold → review queue):
 *   Raw has a normalized name that partially overlaps with a canonical name
 *   (token-overlap heuristic below the exact-match bar), OR name matches but
 *   domains conflict. → INSERT dedupe_candidate (status=pending). Do NOT
 *   auto-merge. Do NOT create a new canonical.
 *   The partial-token ambiguity check uses: normalized name token set overlap
 *   (all tokens of the shorter name appear in the longer name) but is NOT an
 *   exact match → ambiguous.
 *
 * Priority 4 — NEW COMPANY (no match):
 *   Raw matches nothing in the canonical tier.
 *   → INSERT new canonical company + promote contacts. Write provenance.
 *
 * ── Contact merge ────────────────────────────────────────────────────────────
 *
 * Within a single company (canonical), contacts are merged by normalized_email:
 *   - Same normalized_email → same canonical contact (UPDATE / no-op).
 *   - Different email (or no email) → new canonical contact.
 *   - Contact with no email → always a new canonical contact (no merge key).
 * contact_provenance is written for every contact involved (new or merged).
 *
 * ── Cross-source dedup (LOAD-BEARING) ────────────────────────────────────────
 *
 * Company A from connection-1 and company A from connection-2 (same normalized
 * domain, different raw_company_id): the second promotion finds the canonical
 * company already exists (via domain match), merges into it, and writes a SECOND
 * company_provenance row (different connection_id + raw_company_id). Result: ONE
 * canonical company, TWO company_provenance rows. Proven by test (a) below.
 *
 * ── Idempotency ──────────────────────────────────────────────────────────────
 *
 * Re-running promoteStaging over the same staging data:
 *   - companies: normalized_domain partial-unique + promote-if-absent logic
 *     → no new canonical row. (ON CONFLICT on normalized_domain partial unique.)
 *   - company_provenance: UNIQUE(company_id, raw_company_id) → ON CONFLICT DO NOTHING.
 *   - contacts: unique on (company_id, normalized_email) promotion logic → no dup.
 *   - contact_provenance: UNIQUE(contact_id, raw_company_id) → ON CONFLICT DO NOTHING.
 *   - dedupe_candidates (ambiguous path): two-layer guard:
 *       1. promoteStaging excludes raw rows that already have a PENDING candidate
 *          (pendingCandidateIdSet check before promoteOne is called).
 *       2. insertDedupeCandidate uses .onConflictDoNothing on the partial-unique
 *          index UNIQUE(raw_company_id, matched_company_id) WHERE status='pending'
 *          as a DB-level backstop; on conflict it re-reads and returns the
 *          existing id instead of throwing.
 *   Proven by test (b) [domain-path] and test (g) [candidate-path] below.
 *
 * ── Transaction composition ──────────────────────────────────────────────────
 *
 * The public method promoteStaging(tx) takes a Drizzle tx handle.
 * Callers own the transaction boundary — the engine composes into the caller's tx.
 * This makes the engine independently callable (ETL sync endpoint calls it after
 * staging upsert; future scheduled jobs can call it standalone).
 *
 * ── No immutability machinery ────────────────────────────────────────────────
 *
 * These tables are standard-DML mutable (no triggers, no REVOKE/GRANT controls).
 * The audit trail for HUMAN decisions (dedupe-resolve) is provided by
 * AuditService.append in the resolve endpoint's transaction (B-2-part-2).
 * Machine promotions (auto-merge) are NOT audited (high-volume, deterministic).
 */

import { and, eq, isNotNull, sql } from 'drizzle-orm';
// ---------------------------------------------------------------------------
// Re-export Tx type (sourcing module re-uses the same Drizzle tx type)
// ---------------------------------------------------------------------------
import type { Database } from '../../db/db.provider';
import {
  companies,
  companyProvenance,
  contactProvenance,
  contacts,
  dedupeCandidates,
  rawCompanies,
} from '../../db/schema/sourcing';
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

// ---------------------------------------------------------------------------
// Normalization utilities (pure functions — no DB dependency; independently testable)
// ---------------------------------------------------------------------------

/**
 * normalizeDomain — canonical domain form for dedupe matching.
 * Strips protocol, www prefix, and path. Lowercases. Returns null for empty.
 */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.trim().toLowerCase();
  // Strip protocol prefix
  d = d.replace(/^[a-z][a-z0-9+\-.]*:\/\//, '');
  // Strip www. prefix
  d = d.replace(/^www\./, '');
  // Strip path, query, fragment — keep only host[:port]
  const slashIdx = d.indexOf('/');
  if (slashIdx !== -1) d = d.slice(0, slashIdx);
  const queryIdx = d.indexOf('?');
  if (queryIdx !== -1) d = d.slice(0, queryIdx);
  const fragIdx = d.indexOf('#');
  if (fragIdx !== -1) d = d.slice(0, fragIdx);
  d = d.trim();
  return d.length > 0 ? d : null;
}

/**
 * normalizeName — canonical name form for dedupe matching.
 * Lowercases, trims, collapses whitespace, strips corporate suffixes + punctuation.
 * Returns null for empty results.
 *
 * Suffix stripping is done in two passes:
 *   Pass 1: remove punctuation (commas, dots, etc.) so "Corp, Inc." →
 *           "Corp Inc" before suffix matching (handles "Acme Corp, Inc.").
 *   Pass 2: strip corporate suffixes from end, repeatedly until stable.
 *   Pass 3: strip any remaining non-alphanumeric/space chars + re-collapse.
 */
export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let n = raw.trim().toLowerCase().replace(/\s+/g, ' ');

  // Pass 1 — strip punctuation first (before suffix matching) so "Corp, Inc."
  // becomes "Corp Inc" and suffix regex can match "Inc" at the end.
  n = n.replace(/[^a-z0-9\s]/g, ' ').trim();
  n = n.replace(/\s+/g, ' ').trim();

  // Pass 2 — strip corporate suffixes from the end, repeatedly until stable.
  // Matches either a space-prefixed suffix or (for standalone single-word inputs)
  // the full string being just a suffix.
  // Word-boundary match at end of string (after punctuation is already removed).
  const CORP_SUFFIX_RE =
    /(?:^|\s)(inc|llc|ltd|corp|co|plc|gmbh|limited|incorporated|lp|llp|sa|ag|bv|nv)$/;
  let prev = '';
  while (prev !== n) {
    prev = n;
    n = n.replace(CORP_SUFFIX_RE, '').trim();
  }

  // Pass 3 — final whitespace collapse.
  n = n.replace(/\s+/g, ' ').trim();
  return n.length > 0 ? n : null;
}

/**
 * normalizeEmail — canonical email form for contact merge.
 * Lowercases + trims. Returns null for empty.
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  return e.length > 0 ? e : null;
}

// ---------------------------------------------------------------------------
// Ambiguity detection (token-overlap heuristic for the review queue)
// ---------------------------------------------------------------------------

/**
 * isAmbiguousNameMatch — returns true if normalized names are NOT an exact match
 * but share enough tokens to be potentially the same company (below auto-merge).
 *
 * Rule: ALL tokens of the shorter name appear in the longer name's token set,
 * but the names are NOT identical → ambiguous (review queue).
 * This catches "Acme" vs "Acme Holdings" (one is a subset of the other).
 */
export function isAmbiguousNameMatch(nameA: string, nameB: string): boolean {
  if (nameA === nameB) return false; // exact = auto-merge, not ambiguous
  const tokensA = new Set(nameA.split(' '));
  const tokensB = new Set(nameB.split(' '));
  const [shorter, longer] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  // All tokens of the shorter name must appear in the longer set
  for (const tok of shorter) {
    if (!longer.has(tok)) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** A raw_companies row as read from the staging tier. */
type RawRow = typeof rawCompanies.$inferSelect;

/** A canonical companies row as read from the canonical tier. */
type CanonicalCompany = typeof companies.$inferSelect;

/** Result of a single raw row promotion. */
export type PromotionResult =
  | { kind: 'new'; companyId: string }
  | { kind: 'merged'; companyId: string }
  | { kind: 'candidate'; candidateId: string }
  | { kind: 'skipped'; reason: string };

/** Aggregate result of a full promoteStaging call. */
export interface PromoteStagingResult {
  promoted: number;
  merged: number;
  candidates: number;
  skipped: number;
  results: PromotionResult[];
}

// ---------------------------------------------------------------------------
// DedupeEngine
// ---------------------------------------------------------------------------

/**
 * DedupeEngine — stateless service; transaction-composable.
 *
 * Not a NestJS @Injectable — it is a pure service class that the sourcing
 * module instantiates and injects manually. This keeps it framework-free and
 * independently testable without NestJS DI overhead.
 */
export class DedupeEngine {
  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * promoteStaging(tx, connectionId?) — reads raw_companies not yet fully
   * promoted and promotes each into the canonical tier.
   *
   * "Not yet fully promoted" = raw rows that have NO company_provenance row yet
   * (their lineage has not been written). A raw row that already has a provenance
   * row was promoted on a prior run; re-promotion is skipped (idempotency).
   *
   * If connectionId is supplied, only raw rows from that connection are processed
   * (used for per-sync dedupe passes). If null, all unpromoted rows are processed.
   *
   * ATOMICITY: the entire batch runs in the supplied tx. A throw from any
   * individual promotion rolls back all writes in this call.
   */
  async promoteStaging(tx: Tx, connectionId?: string | null): Promise<PromoteStagingResult> {
    // Read unpromoted raw rows — those with no company_provenance entry AND no
    // pending dedupe_candidate yet. The second exclusion is the idempotency guard
    // for the ambiguous-candidate path: a raw row that already has a pending
    // candidate must NOT re-enter promoteOne on re-run (it would insert a duplicate
    // candidate). Together, these two exclusions make all three promotion outcomes
    // (new/merged/candidate) fully idempotent across re-runs.
    //
    // We fetch both exclusion sets first, then filter in application memory.
    const promotedRawIds = await tx
      .select({ rawCompanyId: companyProvenance.rawCompanyId })
      .from(companyProvenance);

    const promotedIdSet = new Set(promotedRawIds.map((r) => r.rawCompanyId));

    // Fetch raw_company_ids that already have a pending dedupe_candidate row.
    const pendingCandidateRawIds = await tx
      .select({ rawCompanyId: dedupeCandidates.rawCompanyId })
      .from(dedupeCandidates)
      .where(eq(dedupeCandidates.status, 'pending'));

    const pendingCandidateIdSet = new Set(pendingCandidateRawIds.map((r) => r.rawCompanyId));

    // Build base query for unpromoted raw rows
    const whereClause = connectionId ? eq(rawCompanies.connectionId, connectionId) : undefined;

    const allRaw = await tx.select().from(rawCompanies).where(whereClause);

    // Filter out already-promoted rows and rows already in the pending candidate queue.
    // (avoids a complex SQL NOT IN with potentially large subquery)
    const unpromotedRaw = allRaw.filter(
      (r) => !promotedIdSet.has(r.id) && !pendingCandidateIdSet.has(r.id)
    );

    const result: PromoteStagingResult = {
      promoted: 0,
      merged: 0,
      candidates: 0,
      skipped: 0,
      results: [],
    };

    for (const raw of unpromotedRaw) {
      const outcome = await this.promoteOne(tx, raw);
      result.results.push(outcome);
      switch (outcome.kind) {
        case 'new':
          result.promoted++;
          break;
        case 'merged':
          result.merged++;
          break;
        case 'candidate':
          result.candidates++;
          break;
        case 'skipped':
          result.skipped++;
          break;
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Internal: promote a single raw row
  // ---------------------------------------------------------------------------

  private async promoteOne(tx: Tx, raw: RawRow): Promise<PromotionResult> {
    const normDomain = normalizeDomain(raw.domain);
    const normName = normalizeName(raw.name);

    // ── Priority 1: Domain match ──────────────────────────────────────────
    if (normDomain !== null) {
      const domainMatch = await this.findCanonicalByDomain(tx, normDomain);
      if (domainMatch !== null) {
        await this.mergeInto(tx, raw, domainMatch, normDomain, normName);
        return { kind: 'merged', companyId: domainMatch.id };
      }
    }

    // ── Priority 2: Name match (exact, no conflicting domain) ─────────────
    if (normName !== null) {
      const nameMatch = await this.findCanonicalByName(tx, normName);
      if (nameMatch !== null) {
        // Verify no domain conflict: if both have domains, they must match
        const canonNormDomain = normalizeDomain(nameMatch.domain);
        const domainConflict =
          normDomain !== null && canonNormDomain !== null && normDomain !== canonNormDomain;

        if (!domainConflict) {
          // Exact name match, no conflicting domain → auto-merge
          await this.mergeInto(tx, raw, nameMatch, normDomain, normName);
          return { kind: 'merged', companyId: nameMatch.id };
        }
        // Domain conflict → ambiguous → fall through to candidate check
      }
    }

    // ── Priority 3: Ambiguous (token-overlap heuristic) ───────────────────
    if (normName !== null) {
      const candidate = await this.findAmbiguousCandidate(tx, normName);
      if (candidate !== null) {
        const candidateId = await this.insertDedupeCandidate(
          tx,
          raw.id,
          candidate.id,
          0.6,
          `Partial name-token overlap: "${normName}" ≈ "${candidate.normalizedName ?? ''}"`
        );
        return { kind: 'candidate', candidateId };
      }
    }

    // ── Priority 4: No match → new canonical ─────────────────────────────
    if (normName === null && normDomain === null) {
      // Edge: raw has no usable name or domain — skip (document, don't drop silently)
      return {
        kind: 'skipped',
        reason: `raw_company ${raw.id} has no usable name or domain after normalization`,
      };
    }

    const newCompanyId = await this.createCanonical(tx, raw, normDomain, normName);
    return { kind: 'new', companyId: newCompanyId };
  }

  // ---------------------------------------------------------------------------
  // Internal: canonical lookup methods
  // ---------------------------------------------------------------------------

  private async findCanonicalByDomain(
    tx: Tx,
    normDomain: string
  ): Promise<CanonicalCompany | null> {
    const rows = await tx
      .select()
      .from(companies)
      .where(eq(companies.normalizedDomain, normDomain))
      .limit(1);
    return rows[0] ?? null;
  }

  private async findCanonicalByName(tx: Tx, normName: string): Promise<CanonicalCompany | null> {
    const rows = await tx
      .select()
      .from(companies)
      .where(eq(companies.normalizedName, normName))
      .limit(1);
    return rows[0] ?? null;
  }

  /**
   * findAmbiguousCandidate — look for a canonical company whose normalized_name
   * token-overlaps with normName (but is not an exact match).
   *
   * Approach: fetch all canonical companies with a non-null normalized_name
   * (bounded by existing universe size), then apply the isAmbiguousNameMatch
   * heuristic in application memory. At MVP scale this is acceptable; at larger
   * scale a pg_trgm index + similarity threshold would replace this.
   */
  private async findAmbiguousCandidate(tx: Tx, normName: string): Promise<CanonicalCompany | null> {
    const rows = await tx.select().from(companies).where(isNotNull(companies.normalizedName));

    for (const row of rows) {
      if (row.normalizedName && isAmbiguousNameMatch(normName, row.normalizedName)) {
        return row;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Internal: merge into existing canonical
  // ---------------------------------------------------------------------------

  /**
   * mergeInto — merges a raw row into an existing canonical company.
   *
   * Merge semantics:
   *   - Canonical keeps its identity (id stable).
   *   - NULL canonical fields are backfilled from raw (first-writer-wins for
   *     non-null canonical fields).
   *   - contributed_fields records which fields this raw row actually provided.
   *
   * Writes:
   *   1. UPDATE companies (backfill nulls only).
   *   2. company_provenance row (idempotent: ON CONFLICT DO NOTHING).
   *   3. For each contact in raw.raw.contacts: upsert contact + contact_provenance.
   */
  private async mergeInto(
    tx: Tx,
    raw: RawRow,
    canonical: CanonicalCompany,
    normDomain: string | null,
    normName: string | null
  ): Promise<void> {
    // Compute which fields the raw record contributes (backfill nulls)
    const contributed: Record<string, boolean> = {};

    const updates: Partial<typeof companies.$inferInsert> = {};
    if (canonical.domain === null && raw.domain !== null) {
      updates.domain = raw.domain;
      contributed.domain = true;
    }
    if (canonical.normalizedDomain === null && normDomain !== null) {
      updates.normalizedDomain = normDomain;
      contributed.normalizedDomain = true;
    }
    if (canonical.normalizedName === null && normName !== null) {
      updates.normalizedName = normName;
      contributed.normalizedName = true;
    }
    if (canonical.name === 'UNKNOWN' || canonical.name === '') {
      if (raw.name) {
        updates.name = raw.name;
        contributed.name = true;
      }
    }

    if (Object.keys(updates).length > 0) {
      await tx.update(companies).set(updates).where(eq(companies.id, canonical.id));
    }

    // Write company_provenance (idempotent: UNIQUE(company_id, raw_company_id))
    await tx
      .insert(companyProvenance)
      .values({
        companyId: canonical.id,
        rawCompanyId: raw.id,
        connectionId: raw.connectionId,
        contributedFields: Object.keys(contributed).length > 0 ? contributed : null,
      })
      .onConflictDoNothing();

    // Promote contacts from this raw row
    await this.promoteContacts(tx, raw, canonical.id);
  }

  // ---------------------------------------------------------------------------
  // Internal: create new canonical company
  // ---------------------------------------------------------------------------

  /**
   * createCanonical — inserts a new canonical company row and its provenance.
   *
   * Uses ON CONFLICT(normalized_domain) DO NOTHING (for the partial-unique case)
   * followed by a re-read, so if two concurrent calls race on the same domain,
   * only one canonical is created and the second call picks up the winner.
   *
   * Returns the canonical company id.
   */
  private async createCanonical(
    tx: Tx,
    raw: RawRow,
    normDomain: string | null,
    normName: string | null
  ): Promise<string> {
    const insertValues: typeof companies.$inferInsert = {
      name: raw.name ?? 'UNKNOWN',
      domain: raw.domain ?? null,
      normalizedDomain: normDomain,
      normalizedName: normName,
      sector: null,
      status: 'active',
    };

    let canonicalId: string;

    if (normDomain !== null) {
      // Use ON CONFLICT on normalized_domain partial-unique to handle races
      // The partial-unique index is on normalized_domain WHERE NOT NULL.
      // We insert, and if a conflict fires, we fetch the existing row.
      const inserted = await tx
        .insert(companies)
        .values(insertValues)
        .onConflictDoNothing()
        .returning({ id: companies.id });

      if (inserted.length > 0 && inserted[0] !== undefined) {
        canonicalId = inserted[0].id;
      } else {
        // Race: another promotion already created the canonical for this domain
        const existing = await this.findCanonicalByDomain(tx, normDomain);
        if (existing === null) {
          throw new Error(
            `DedupeEngine: ON CONFLICT DO NOTHING fired but canonical not found for domain "${normDomain}"`
          );
        }
        // Merge into the winner instead
        await this.mergeInto(tx, raw, existing, normDomain, normName);
        return existing.id;
      }
    } else {
      // Name-only match: no domain → no partial-unique conflict possible.
      // Insert directly.
      const inserted = await tx
        .insert(companies)
        .values(insertValues)
        .returning({ id: companies.id });
      if (!inserted[0]) throw new Error('DedupeEngine: INSERT companies returned no row');
      canonicalId = inserted[0].id;
    }

    // Write provenance (this is a new canonical → no conflict possible here)
    await tx.insert(companyProvenance).values({
      companyId: canonicalId,
      rawCompanyId: raw.id,
      connectionId: raw.connectionId,
      contributedFields: {
        name: true,
        domain: normDomain !== null,
        normalizedDomain: normDomain !== null,
        normalizedName: normName !== null,
      },
    });

    // Promote contacts
    await this.promoteContacts(tx, raw, canonicalId);

    return canonicalId;
  }

  // ---------------------------------------------------------------------------
  // Internal: contact promotion
  // ---------------------------------------------------------------------------

  /**
   * promoteContacts — extracts contacts from raw.raw (the full source payload)
   * and merges them into the canonical contacts table under the given company.
   *
   * Contact merge key: normalized_email (within the same canonical company).
   *   - Same normalized_email → no new contact (idempotent via ON CONFLICT).
   *   - No email → always a new canonical contact (no merge key).
   *
   * contact_provenance is written for every contact (new or merged into existing).
   * Uses ON CONFLICT DO NOTHING for idempotency on re-runs.
   *
   * The contacts are read from raw.raw.contacts (an array of NormalizedContact
   * objects written by the ETL layer, which validates against the shared Zod schema).
   */
  private async promoteContacts(tx: Tx, raw: RawRow, canonicalCompanyId: string): Promise<void> {
    // Extract contacts from the raw JSON payload
    const rawContacts = this.extractContacts(raw.raw);

    for (const rc of rawContacts) {
      const normEmail = normalizeEmail(rc.email);

      let contactId: string;

      if (normEmail !== null) {
        // Try to find existing canonical contact by normalized_email in this company
        const existing = await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(
            and(eq(contacts.companyId, canonicalCompanyId), eq(contacts.normalizedEmail, normEmail))
          )
          .limit(1);

        if (existing.length > 0 && existing[0] !== undefined) {
          // Merge: contact already exists (first-writer-wins; record provenance only).
          contactId = existing[0].id;
        } else {
          // New contact
          const inserted = await tx
            .insert(contacts)
            .values({
              companyId: canonicalCompanyId,
              name: rc.name ?? null,
              email: rc.email ?? null,
              normalizedEmail: normEmail,
              title: rc.title ?? null,
            })
            .returning({ id: contacts.id });
          if (!inserted[0]) throw new Error('DedupeEngine: INSERT contacts returned no row');
          contactId = inserted[0].id;
        }
      } else {
        // No email → always a new contact (no merge key available)
        const inserted = await tx
          .insert(contacts)
          .values({
            companyId: canonicalCompanyId,
            name: rc.name ?? null,
            email: rc.email ?? null,
            normalizedEmail: null,
            title: rc.title ?? null,
          })
          .returning({ id: contacts.id });
        if (!inserted[0])
          throw new Error('DedupeEngine: INSERT contacts (no-email) returned no row');
        contactId = inserted[0].id;
      }

      // Write contact_provenance (idempotent: ON CONFLICT DO NOTHING)
      // UNIQUE(contact_id, raw_company_id) ensures re-runs are no-ops.
      await tx
        .insert(contactProvenance)
        .values({
          contactId,
          rawCompanyId: raw.id,
          connectionId: raw.connectionId,
        })
        .onConflictDoNothing();
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: insert a dedupe candidate
  // ---------------------------------------------------------------------------

  private async insertDedupeCandidate(
    tx: Tx,
    rawCompanyId: string,
    matchedCompanyId: string | null,
    score: number,
    reason: string
  ): Promise<string> {
    // Use the partial-unique index (raw_company_id, matched_company_id) WHERE status='pending'
    // as the conflict target. On conflict = a pending candidate already exists for this
    // (raw, canonical) pair → no-op (do not throw, do not insert duplicate).
    // The promoteStaging exclusion filter (pendingCandidateIdSet) normally prevents
    // re-entry here, but this is the DB-level backstop for any gap in that filter.
    const inserted = await tx
      .insert(dedupeCandidates)
      .values({
        rawCompanyId,
        matchedCompanyId,
        score,
        reason,
        status: 'pending',
      })
      .onConflictDoNothing({
        target: [dedupeCandidates.rawCompanyId, dedupeCandidates.matchedCompanyId],
        where: sql`status = 'pending'`,
      })
      .returning({ id: dedupeCandidates.id });

    if (inserted.length > 0 && inserted[0] !== undefined) {
      // Fresh insert succeeded — return the new candidate id.
      return inserted[0].id;
    }

    // Conflict fired: a pending candidate for this (raw, canonical) pair already exists.
    // Re-read it to return its id (the caller records the candidateId in PromotionResult).
    const existing = await tx
      .select({ id: dedupeCandidates.id })
      .from(dedupeCandidates)
      .where(eq(dedupeCandidates.rawCompanyId, rawCompanyId))
      .limit(1);

    if (existing.length > 0 && existing[0] !== undefined) {
      return existing[0].id;
    }

    // Should be unreachable: conflict fired but re-read found nothing.
    throw new Error(
      `DedupeEngine: onConflictDoNothing fired for dedupe_candidate but re-read returned no row (rawCompanyId=${rawCompanyId})`
    );
  }

  // ---------------------------------------------------------------------------
  // Internal: extract contacts from raw JSON payload
  // ---------------------------------------------------------------------------

  private extractContacts(raw: unknown): Array<{ name?: string; email?: string; title?: string }> {
    if (typeof raw !== 'object' || raw === null) return [];
    const obj = raw as Record<string, unknown>;
    const contacts = obj.contacts;
    if (!Array.isArray(contacts)) return [];
    return contacts.filter((c): c is { name?: string; email?: string; title?: string } => {
      return typeof c === 'object' && c !== null;
    });
  }
}

// ---------------------------------------------------------------------------
// Singleton factory (for use outside NestJS DI, e.g. tests)
// ---------------------------------------------------------------------------

let _engineInstance: DedupeEngine | null = null;

/**
 * getDedupeEngine() — returns a module-level singleton DedupeEngine.
 * Used by tests and by any non-DI call site.
 */
export function getDedupeEngine(): DedupeEngine {
  if (_engineInstance === null) {
    _engineInstance = new DedupeEngine();
  }
  return _engineInstance;
}
