import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from './users-roles';

/**
 * Wave-6 deal-sourcing data spine (B-2, tasks ff378a95 + db274731).
 *
 * Seven MUTABLE tables (four staging/canonical data + two provenance + one review queue):
 *   1. data_source_connections — registered external deal-source providers
 *   2. raw_companies           — staging: one row per (connection, source_record_id)
 *   3. companies               — canonical: deduped company universe
 *   4. contacts                — canonical: contacts linked to canonical companies
 *   5. company_provenance      — lineage: canonical company ← raw source(s)
 *   6. contact_provenance      — lineage: canonical contact ← raw source(s) (principle-3)
 *   7. dedupe_candidates       — review queue: ambiguous merge candidates (human review)
 *
 * MUTABILITY NOTE:
 *   All tables use standard DML (INSERT/UPDATE/DELETE all permitted).
 *   They are NOT subject to audit_log_entries immutability controls.
 *   Material human mutations (dedupe-candidate resolve) are audited via
 *   AuditService.append in the same transaction (wave-5 pattern).
 *
 * SECRETS NOTE:
 *   data_source_connections.provider_key stores only the Railway-env credential
 *   NAME (e.g. 'GRATA_API_KEY'), NEVER the secret value itself.
 *   Adapters resolve process.env[providerKey] at runtime; no secret column exists.
 *
 * PROVENANCE INVARIANT (databases.md principle 3):
 *   Every canonical company row has ≥1 company_provenance row linking it to the
 *   raw_companies staging row(s) it was promoted from.
 *   Every canonical contact row has ≥1 contact_provenance row — contact_provenance
 *   is the load-bearing principle-3 table for contact lineage (feature #9 consumer).
 *   Both provenance tables have NOT NULL on all lineage columns; the dedupe engine
 *   writes them atomically with the canonical promotion.
 *
 * PARTIAL-UNIQUE INDEX:
 *   companies(normalized_domain) WHERE normalized_domain IS NOT NULL — hand-appended
 *   in migration 0004 (drizzle-kit cannot emit partial indexes; per 0002/0003 precedent).
 *   This is the DB-level dedup backstop: even under a future concurrent/async dedupe
 *   path, two promotions for the same normalized domain cannot both commit.
 *
 * Additive-only — no existing table (users/roles/invites/app_meta/audit_log_entries/
 * compliance_*) is touched.
 */

// ---------------------------------------------------------------------------
// pgEnum
// ---------------------------------------------------------------------------

/**
 * dedupe_candidate_status — lifecycle of a dedupe review item.
 *   pending  — awaiting human review (the default on INSERT).
 *   merged   — human resolved: raw promoted into matched_company_id.
 *   rejected — human resolved: keep-separate (raw stays as its own canonical
 *              or remains unresolved; documented edge behavior).
 */
export const dedupeCandidateStatusPgEnum = pgEnum('dedupe_candidate_status', [
  'pending',
  'merged',
  'rejected',
]);

// ---------------------------------------------------------------------------
// 1. data_source_connections
// ---------------------------------------------------------------------------

/**
 * data_source_connections — registered external deal-source providers.
 *
 * provider_key: the Railway-env credential NAME (e.g. 'GRATA_API_KEY').
 *   - NEVER stores a secret value.
 *   - The fixture adapter uses provider_key='FIXTURE' (no env credential needed).
 *   - Real adapters resolve process.env[provider_key] at fetch time; a missing
 *     env entry surfaces the connection as unusable (not a crash).
 *
 * config: non-secret per-connection config (field mappings, filters, etc.).
 *   Stored as JSONB; validated by the adapter at use time.
 *
 * enabled: soft-toggle; disabled connections are skipped by the ETL service.
 *   On-demand sync of a disabled connection returns a 404.
 *
 * created_by: nullable FK to users; SET NULL on deletion (convention — the
 *   connection row survives the creating user's account deletion).
 */
export const dataSourceConnections = pgTable(
  'data_source_connections',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /**
     * Railway-env credential NAME — NOT the secret value.
     * Adapters call process.env[providerKey] at runtime.
     * Assertion: no column named 'secret', 'api_key', 'credential' on this table.
     */
    providerKey: text('provider_key').notNull(),

    /** Human-readable label shown in the UI (e.g. 'Grata', 'Internal Fixture'). */
    displayName: text('display_name').notNull(),

    /** true = available for sync; false = skipped by ETL. */
    enabled: boolean('enabled').notNull().default(true),

    /**
     * Non-secret per-connection configuration (field mappings, filters, etc.).
     * Adapter-specific shape; validated by the adapter class, not by a schema.
     */
    config: jsonb('config').notNull().default(sql`'{}'`),

    /** Nullable FK — row survives if the creating user is deleted. */
    createdBy: uuid('created_by'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    foreignKey({
      name: 'data_source_connections_created_by_fk',
      columns: [table.createdBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),
  ]
);

// ---------------------------------------------------------------------------
// 2. raw_companies (STAGING)
// ---------------------------------------------------------------------------

/**
 * raw_companies — staging tier: one row per (connection, source_record_id).
 *
 * Every ingest upserts by the UNIQUE(connection_id, source_record_id) key:
 * a re-sync of the same record UPDATES the existing row (sets raw to the fresh
 * payload, updates ingested_at) rather than inserting a duplicate. This makes
 * the ETL idempotent at the staging layer.
 *
 * The top-level scalar columns (name, domain, normalized_domain) are denormalized
 * from `raw` for the dedupe match scans. Contact data is embedded in `raw`
 * (and later extracted into canonical contacts at promotion time).
 *
 * The staging tier is NEVER written by the dedupe engine — only the ETL service
 * writes here. Dedupe reads staging and writes canonical + provenance.
 */
export const rawCompanies = pgTable(
  'raw_companies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → data_source_connections.id — which connection produced this row. */
    connectionId: uuid('connection_id').notNull(),

    /** Provider's stable identifier for this record (the upsert / idempotency key). */
    sourceRecordId: text('source_record_id').notNull(),

    /** Company name as returned by the source (pre-normalization). */
    name: text('name'),

    /** Domain as returned by the source (pre-normalization). */
    domain: text('domain'),

    /**
     * Persisted normalized domain (lowercase, www-stripped, path-stripped).
     * Computed at ETL ingest time and stored so dedupe match scans use an index.
     */
    normalizedDomain: text('normalized_domain'),

    /**
     * Full raw source payload — the complete record as the provider returned it.
     * Stored verbatim; the canonical extraction logic reads from here.
     */
    raw: jsonb('raw').notNull(),

    /** Server clock at ingest time (DB default; updated on re-sync upsert). */
    ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    foreignKey({
      name: 'raw_companies_connection_id_fk',
      columns: [table.connectionId],
      foreignColumns: [dataSourceConnections.id],
    }).onDelete('cascade'),

    /**
     * Idempotent upsert key: one staging row per (connection, provider-record).
     * The ETL uses ON CONFLICT(connection_id, source_record_id) DO UPDATE.
     * Ensures re-syncing the same source does not pile up duplicate staging rows.
     */
    unique('raw_companies_connection_source_unique').on(table.connectionId, table.sourceRecordId),

    /** Dedupe match scan: look up staging rows by normalized_domain. */
    index('raw_companies_normalized_domain_idx').on(table.normalizedDomain),

    /** Connection-scoped listing (sync summary queries). */
    index('raw_companies_connection_id_idx').on(table.connectionId),
  ]
);

// ---------------------------------------------------------------------------
// 3. companies (CANONICAL)
// ---------------------------------------------------------------------------

/**
 * companies — canonical deduped company universe.
 *
 * Rows in this table are the output of the dedupe engine's promotion step.
 * The dedupe engine is the ONLY writer of canonical companies. The screen
 * and downstream modules (M4/M5) read from here.
 *
 * normalized_domain + normalized_name are persisted match keys, computed at
 * promotion time and stored for efficient dedupe lookups.
 *
 * PARTIAL-UNIQUE INDEX on normalized_domain (WHERE NOT NULL):
 *   Hand-appended in migration 0004 (see below). This is the DB-level idempotency
 *   backstop: the dedupe engine's promote-if-absent logic prevents duplicates in
 *   the single-run path, and this index prevents them under any future concurrent
 *   path. A second INSERT of the same normalized_domain fails with SQLSTATE 23505.
 *
 * status: 'active' | 'archived' — soft-delete convention (no hard DELETE).
 *   archived companies are hidden from the default screen filter.
 *
 * updated_at: Drizzle .$onUpdateFn — set by the application on every UPDATE.
 *   NULL until the first update.
 */
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** Canonical company name (may be backfilled / updated by merge). */
    name: text('name').notNull(),

    /** Display domain (may be null if only name-matched). */
    domain: text('domain'),

    /**
     * Persisted match key: lowercase, www-stripped, protocol-stripped, path-stripped.
     * NULL if the company was matched/created by name only (no domain available).
     * The partial-unique index on this column (WHERE NOT NULL) enforces dedup.
     */
    normalizedDomain: text('normalized_domain'),

    /**
     * Persisted match key: lowercase, suffix-stripped, whitespace-collapsed.
     * Used as the fallback match signal when no domain is available.
     * Indexed (non-unique) for name-based dedupe scans.
     */
    normalizedName: text('normalized_name'),

    /** Industry sector — optional, populated from source data when available. */
    sector: text('sector'),

    /**
     * Soft-delete status: 'active' (default) | 'archived'.
     * The screen's default filter shows active; archived are accessible via filter.
     */
    status: text('status').notNull().default('active'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /** Drizzle sets this on every UPDATE. NULL until first update. */
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),
  },
  (table) => [
    /**
     * Primary dedupe lookup: find a canonical company by normalized domain.
     * The dedupe engine's match step queries WHERE normalized_domain = $1.
     * Note: the PARTIAL-UNIQUE constraint (WHERE normalized_domain IS NOT NULL)
     * is hand-appended in migration 0004 — drizzle-kit cannot emit partial indexes.
     * This regular index coexists with that partial-unique and is the scan index.
     */
    index('companies_normalized_domain_idx').on(table.normalizedDomain),

    /** Fallback dedupe lookup: find a canonical company by normalized name. */
    index('companies_normalized_name_idx').on(table.normalizedName),

    /**
     * Screen filter index: status + name + domain composite.
     * Covers the list query: WHERE status = 'active' ORDER BY name.
     */
    index('companies_status_name_domain_idx').on(table.status, table.name, table.domain),
  ]
);

// ---------------------------------------------------------------------------
// 4. contacts (CANONICAL)
// ---------------------------------------------------------------------------

/**
 * contacts — canonical contacts linked to canonical companies.
 *
 * Contacts are extracted from raw_companies.raw at promotion time and merged
 * by normalized_email: two contacts with the same normalized email (regardless
 * of which source they came from) resolve to ONE canonical contact row.
 *
 * normalized_email: lowercase, trimmed. The dedupe engine uses this as the
 * contact merge key. Indexed for fast contact-merge lookup.
 *
 * updated_at: Drizzle .$onUpdateFn.
 */
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → companies.id — every contact belongs to a canonical company. */
    companyId: uuid('company_id').notNull(),

    /** Contact's display name (may be null if source did not provide). */
    name: text('name'),

    /** Email address as provided by the source. */
    email: text('email'),

    /**
     * Persisted merge key: lowercase, trimmed.
     * The dedupe engine merges contacts with the same normalized_email.
     * Indexed for fast lookup during contact promotion.
     */
    normalizedEmail: text('normalized_email'),

    /** Job title / role at the company. */
    title: text('title'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).$onUpdateFn(() =>
      new Date().toISOString()
    ),
  },
  (table) => [
    foreignKey({
      name: 'contacts_company_id_fk',
      columns: [table.companyId],
      foreignColumns: [companies.id],
    }).onDelete('cascade'),

    /** Company-scoped contact listing (detail page). */
    index('contacts_company_id_idx').on(table.companyId),

    /** Contact merge lookup: find existing canonical contact by normalized email. */
    index('contacts_normalized_email_idx').on(table.normalizedEmail),
  ]
);

// ---------------------------------------------------------------------------
// 5. company_provenance
// ---------------------------------------------------------------------------

/**
 * company_provenance — lineage join: canonical company ← raw source(s).
 *
 * Invariants (databases.md principle 3):
 *   - company_id, raw_company_id, connection_id are all NOT NULL.
 *   - Every canonical company has ≥1 provenance row inserted at promotion time.
 *   - Merges ADD a new provenance row (lineage from both sources preserved).
 *
 * UNIQUE(company_id, raw_company_id) — idempotency backstop:
 *   Re-running the dedupe engine over the same staging does NOT create duplicate
 *   provenance rows. An ON CONFLICT(company_id, raw_company_id) DO NOTHING
 *   in the engine makes re-runs safe.
 *   Hand-appended in migration 0004 (drizzle-kit cannot emit this fully in all cases;
 *   confirmed in hand-append section following 0002/0003 precedent).
 *
 * contributed_fields: JSONB snapshot of which canonical fields this raw record
 *   contributed on the merge (e.g. {"name": true, "domain": true}). Used for
 *   field-level lineage tracing in the detail screen. NULL = not tracked (legacy).
 */
export const companyProvenance = pgTable(
  'company_provenance',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → canonical companies.id — which canonical company this row links. */
    companyId: uuid('company_id').notNull(),

    /** FK → raw_companies.id — which raw staging row contributed to this canonical. */
    rawCompanyId: uuid('raw_company_id').notNull(),

    /** FK → data_source_connections.id — which connection the raw row came from. */
    connectionId: uuid('connection_id').notNull(),

    /**
     * JSONB snapshot of which canonical fields this raw record contributed.
     * e.g. {"name": true, "domain": true, "sector": false}
     * Null if not tracked (e.g. from a rejected dedupe candidate resolve).
     */
    contributedFields: jsonb('contributed_fields'),

    /** Server clock at promotion time. */
    ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    foreignKey({
      name: 'company_provenance_company_id_fk',
      columns: [table.companyId],
      foreignColumns: [companies.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'company_provenance_raw_company_id_fk',
      columns: [table.rawCompanyId],
      foreignColumns: [rawCompanies.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'company_provenance_connection_id_fk',
      columns: [table.connectionId],
      foreignColumns: [dataSourceConnections.id],
    }).onDelete('cascade'),

    /**
     * Idempotency: a raw record contributes to a canonical company at most once.
     * UNIQUE(company_id, raw_company_id) — hand-appended in migration 0004.
     * Declared here as a regular unique constraint so drizzle-kit emits it;
     * verified in migration hand-append section.
     */
    unique('company_provenance_company_raw_unique').on(table.companyId, table.rawCompanyId),

    /** Company-scoped provenance listing (detail page). */
    index('company_provenance_company_id_idx').on(table.companyId),
  ]
);

// ---------------------------------------------------------------------------
// 6. contact_provenance  (PRINCIPLE-3 CONTACT LINEAGE — DO NOT DROP)
// ---------------------------------------------------------------------------

/**
 * contact_provenance — lineage join: canonical contact ← raw source(s).
 *
 * Mirrors company_provenance for the contact dimension.
 * databases.md reusability principle 3 names contact_data_sources as an
 * invariant (non-null source_connection_id + ingested_at per contact); this
 * table is the wave-6 implementation of that invariant for contacts.
 * Feature #9 (the data-quality screen / companies-contacts screen) is a named
 * consumer — it shows per-contact source lineage.
 *
 * Invariants:
 *   - contact_id, raw_company_id, connection_id are all NOT NULL.
 *   - Every canonical contact has ≥1 contact_provenance row inserted at
 *     promotion time (atomically with company_provenance in the same tx).
 *
 * UNIQUE(contact_id, raw_company_id) — idempotency: re-running dedupe does NOT
 *   create duplicate contact provenance rows.
 *   Hand-appended in migration 0004 (per 0002/0003 precedent).
 */
export const contactProvenance = pgTable(
  'contact_provenance',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → contacts.id — which canonical contact this row links. */
    contactId: uuid('contact_id').notNull(),

    /**
     * FK → raw_companies.id — the staging row that sourced this contact.
     * (Contacts are extracted from the raw company record at promotion time.)
     */
    rawCompanyId: uuid('raw_company_id').notNull(),

    /** FK → data_source_connections.id — which connection the raw row came from. */
    connectionId: uuid('connection_id').notNull(),

    /** Server clock at promotion time. */
    ingestedAt: timestamp('ingested_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),
  },
  (table) => [
    foreignKey({
      name: 'contact_provenance_contact_id_fk',
      columns: [table.contactId],
      foreignColumns: [contacts.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'contact_provenance_raw_company_id_fk',
      columns: [table.rawCompanyId],
      foreignColumns: [rawCompanies.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'contact_provenance_connection_id_fk',
      columns: [table.connectionId],
      foreignColumns: [dataSourceConnections.id],
    }).onDelete('cascade'),

    /**
     * Idempotency: a raw company record contributes to a contact at most once.
     * UNIQUE(contact_id, raw_company_id) — hand-appended in migration 0004.
     */
    unique('contact_provenance_contact_raw_unique').on(table.contactId, table.rawCompanyId),

    /** Contact-scoped listing. */
    index('contact_provenance_contact_id_idx').on(table.contactId),
  ]
);

// ---------------------------------------------------------------------------
// 7. dedupe_candidates
// ---------------------------------------------------------------------------

/**
 * dedupe_candidates — review queue for ambiguous merge candidates.
 *
 * When the dedupe engine encounters a raw record that matches a canonical company
 * AMBIGUOUSLY (partial/fuzzy signal below the auto-merge threshold — e.g. name
 * token overlap without domain agreement), it writes a row here instead of
 * auto-merging. A human reviewer then resolves: merge or reject (keep-separate).
 *
 * Auto-merge threshold (deterministic, no ML):
 *   exact normalized_domain match OR exact normalized_name match → auto-merge.
 *   Everything weaker (partial name tokens, name match with conflicting domain)
 *   → dedupe_candidate (pending).
 *
 * score: rule-derived confidence label (0–1), for human context only.
 *   Not a probabilistic ML score — a deterministic signal strength (e.g. 0.7
 *   for name-only match, 0.9 for domain+name). NULL if no signal applicable.
 *
 * resolved_by: nullable FK to users; SET NULL on user deletion.
 *   resolved_at: timestamp set when status → merged | rejected.
 *
 * The resolve endpoint (POST /sourcing/dedupe-candidates/:id/resolve) is
 * implemented in B-2-part-2 (backend-developer). This table + the engine that
 * writes pending rows are the B-2 deliverable here.
 */
export const dedupeCandidates = pgTable(
  'dedupe_candidates',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),

    /** FK → raw_companies.id — the raw record that was ambiguous. */
    rawCompanyId: uuid('raw_company_id').notNull(),

    /**
     * FK → companies.id — the canonical company the raw record might merge into.
     * Nullable: null if no candidate match was found (raw matches nothing but
     * is below the new-canonical threshold for auto-creation — unusual edge case).
     */
    matchedCompanyId: uuid('matched_company_id'),

    /**
     * Rule-derived confidence label (0.0–1.0); for human reviewer context only.
     * NULL = no applicable score (e.g. no domain available for comparison).
     */
    score: real('score'),

    /** Human-readable explanation of why this match is ambiguous. */
    reason: text('reason'),

    /**
     * Review lifecycle status — default 'pending'.
     * pending  → awaiting human review.
     * merged   → human resolved: raw promoted into matched_company_id.
     * rejected → human resolved: keep-separate.
     */
    status: dedupeCandidateStatusPgEnum('status').notNull().default('pending'),

    /** FK → users.id; null if unresolved or resolving user was deleted. */
    resolvedBy: uuid('resolved_by'),

    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .notNull()
      .default(sql`now()`),

    /** Set when status transitions from pending to merged or rejected. */
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    foreignKey({
      name: 'dedupe_candidates_raw_company_id_fk',
      columns: [table.rawCompanyId],
      foreignColumns: [rawCompanies.id],
    }).onDelete('cascade'),

    foreignKey({
      name: 'dedupe_candidates_matched_company_id_fk',
      columns: [table.matchedCompanyId],
      foreignColumns: [companies.id],
    }).onDelete('set null'),

    foreignKey({
      name: 'dedupe_candidates_resolved_by_fk',
      columns: [table.resolvedBy],
      foreignColumns: [users.id],
    }).onDelete('set null'),

    /**
     * Review queue filter index: list pending candidates.
     * Covers: WHERE status = 'pending' ORDER BY created_at.
     */
    index('dedupe_candidates_status_idx').on(table.status),

    /**
     * Company-scoped pending candidate lookup.
     * Covers: WHERE matched_company_id = $1 AND status = 'pending'.
     */
    index('dedupe_candidates_matched_company_id_idx').on(table.matchedCompanyId),

    /**
     * PARTIAL-UNIQUE idempotency backstop for the ambiguous-candidate path.
     *   UNIQUE(raw_company_id, matched_company_id) WHERE status = 'pending'
     * Partial on status='pending' so a resolved (rejected/merged) candidate does
     * NOT block a legitimately re-raised one after a new sync cycle.
     * Hand-appended in migration 0004 (drizzle-kit cannot emit partial indexes —
     * follows companies_normalized_domain_partial_unique precedent in the same
     * migration file). The engine's insertDedupeCandidate uses
     * .onConflictDoNothing({ target: [rawCompanyId, matchedCompanyId],
     *                         targetWhere: sql`status = 'pending'` })
     * to safely no-op on re-runs rather than throwing on the constraint.
     */
  ]
);
