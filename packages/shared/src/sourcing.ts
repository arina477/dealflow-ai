import { z } from 'zod';

// ---------------------------------------------------------------------------
// NormalizedSourceRecord — the normalized ingest shape returned by any
// DataSourceAdapter.fetchCompanies() implementation.
// Framework-free: used by both the API ETL layer and shared contract tests.
// ---------------------------------------------------------------------------

export const normalizedContactSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    title: z.string().min(1).optional(),
  })
  .strict();

export type NormalizedContact = z.infer<typeof normalizedContactSchema>;

export const normalizedSourceRecordSchema = z
  .object({
    /** Provider's stable identifier for this record (used as the upsert key). */
    sourceRecordId: z.string().min(1),
    /** Company name as returned by the source. */
    name: z.string().min(1),
    /** Domain as returned by the source (pre-normalization). */
    domain: z.string().optional(),
    /** Contacts associated with this company from the source. */
    contacts: z.array(normalizedContactSchema),
    /** Full raw source payload — stored as-is in raw_companies.raw. */
    raw: z.record(z.unknown()).optional(),
  })
  .strict();

export type NormalizedSourceRecord = z.infer<typeof normalizedSourceRecordSchema>;

// ---------------------------------------------------------------------------
// DataSourceAdapter — the pluggable vendor-swap contract.
// This is a TypeScript interface (not Zod) because it describes behaviour,
// not a data shape. Every real or fixture adapter implements this interface.
//
// The `connection` parameter is typed minimally here so @dealflow/shared
// remains framework-free; the API layer passes the full Drizzle row at
// runtime. The interface isolates vendor swap to one class — swapping a
// provider touches only the single adapter implementation that holds that
// provider_key, never ETL or dedupe logic.
// ---------------------------------------------------------------------------

export interface DataSourceConnection {
  id: string;
  providerKey: string;
  displayName: string;
  enabled: boolean;
  /** Non-secret field mappings / filter config — stored as jsonb. */
  config: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
}

export interface DataSourceAdapter {
  /** The provider_key this adapter handles (e.g. 'FIXTURE', 'GRATA'). */
  readonly providerKey: string;
  /**
   * Fetches and normalizes companies from the external source.
   * The connection row supplies display_name + config; credentials are
   * resolved from process.env[providerKey] by the adapter, never from the DB.
   */
  fetchCompanies(connection: DataSourceConnection): Promise<NormalizedSourceRecord[]>;
}

// ---------------------------------------------------------------------------
// Entity read shapes — mirror DB canonical tables.
// These are the shapes the API returns and the web screen consumes.
// ---------------------------------------------------------------------------

/** Mirrors the canonical `companies` table row. */
export const companySchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    domain: z.string().optional().nullable(),
    /** Persisted match key (lowercase, www-stripped, path-stripped). */
    normalizedDomain: z.string().optional().nullable(),
    /** Persisted match key (lowercase, suffix-stripped, whitespace-collapsed). */
    normalizedName: z.string().optional().nullable(),
    sector: z.string().optional().nullable(),
    /** 'active' | 'archived' — soft-delete via status per convention. */
    status: z.string().min(1),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().nullable(),
  })
  .strict();

export type Company = z.infer<typeof companySchema>;

/** Mirrors the canonical `contacts` table row. */
export const contactSchema = z
  .object({
    id: z.string().uuid(),
    companyId: z.string().uuid(),
    name: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    normalizedEmail: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime().nullable(),
  })
  .strict();

export type Contact = z.infer<typeof contactSchema>;

/** Mirrors the `data_source_connections` table row (read shape). */
export const dataSourceConnectionSchema = z
  .object({
    id: z.string().uuid(),
    /** Railway-env credential name — NEVER a secret value. */
    providerKey: z.string().min(1),
    displayName: z.string().min(1),
    enabled: z.boolean(),
    /** Non-secret: field mappings / filter config. */
    config: z.record(z.unknown()),
    createdBy: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type DataSourceConnectionRecord = z.infer<typeof dataSourceConnectionSchema>;

/** Mirrors the `company_provenance` table row. */
export const companyProvenanceSchema = z
  .object({
    id: z.string().uuid(),
    /** FK → canonical companies.id */
    companyId: z.string().uuid(),
    /** FK → raw_companies.id */
    rawCompanyId: z.string().uuid(),
    /** FK → data_source_connections.id */
    connectionId: z.string().uuid(),
    /** Which canonical fields this raw record contributed (jsonb). */
    contributedFields: z.record(z.unknown()).nullable(),
    ingestedAt: z.string().datetime(),
  })
  .strict();

export type CompanyProvenance = z.infer<typeof companyProvenanceSchema>;

/** Mirrors the `contact_provenance` table row. */
export const contactProvenanceSchema = z
  .object({
    id: z.string().uuid(),
    /** FK → canonical contacts.id */
    contactId: z.string().uuid(),
    /** FK → raw_companies.id (the staging row that sourced this contact). */
    rawCompanyId: z.string().uuid(),
    /** FK → data_source_connections.id */
    connectionId: z.string().uuid(),
    ingestedAt: z.string().datetime(),
  })
  .strict();

export type ContactProvenance = z.infer<typeof contactProvenanceSchema>;

/** Mirrors the `dedupe_candidates` table row. */
export const dedupeCandidateStatusEnum = z.enum(['pending', 'merged', 'rejected']);

export type DedupeCandidateStatus = z.infer<typeof dedupeCandidateStatusEnum>;

export const dedupeCandidateSchema = z
  .object({
    id: z.string().uuid(),
    /** FK → raw_companies.id (the raw record that was ambiguous). */
    rawCompanyId: z.string().uuid(),
    /** FK → canonical companies.id (null if no candidate match found). */
    matchedCompanyId: z.string().uuid().nullable(),
    /** Rule-derived confidence label (0–1); null = no score applicable. */
    score: z.number().min(0).max(1).nullable(),
    /** Human-readable reason string for the match / ambiguity. */
    reason: z.string().optional().nullable(),
    status: dedupeCandidateStatusEnum,
    /** FK → users.id; null if unresolved or user was deleted. */
    resolvedBy: z.string().uuid().nullable(),
    createdAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
  })
  .strict();

export type DedupeCandidate = z.infer<typeof dedupeCandidateSchema>;

// ---------------------------------------------------------------------------
// API input / response shapes
// ---------------------------------------------------------------------------

/**
 * SyncSummary — response body for POST /sourcing/connections/:id/sync.
 * Describes how many raw_companies rows were newly ingested vs. updated
 * in place during the sync run.
 */
export const syncSummarySchema = z
  .object({
    ingested: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
  })
  .strict();

export type SyncSummary = z.infer<typeof syncSummarySchema>;

/**
 * DedupeResolveInput — request body for POST /sourcing/dedupe-candidates/:id/resolve.
 * 'merge'  → promote the raw record into matched_company_id (canonical + provenance updated).
 * 'reject' → keep-separate (candidate closed; raw may become its own canonical or stay).
 */
export const dedupeResolveInputSchema = z
  .object({
    action: z.enum(['merge', 'reject']),
  })
  .strict();

export type DedupeResolveInput = z.infer<typeof dedupeResolveInputSchema>;

// ---------------------------------------------------------------------------
// Filter / query types for the companies list screen
// ---------------------------------------------------------------------------

/**
 * CompaniesListFilter — query parameters for GET /sourcing/companies.
 * All fields optional; absent = no filter applied for that dimension.
 */
export const companiesListFilterSchema = z
  .object({
    /** Free-text search on name or domain (applied as prefix/contains). */
    q: z.string().optional(),
    /** Filter to companies sourced from a specific connection (UUID). */
    source: z.string().uuid().optional(),
    /** Filter by company status ('active' | 'archived'). */
    status: z.enum(['active', 'archived']).optional(),
  })
  .strict();

export type CompaniesListFilter = z.infer<typeof companiesListFilterSchema>;
