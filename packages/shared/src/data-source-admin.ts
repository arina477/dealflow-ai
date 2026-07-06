import { z } from 'zod';

// ---------------------------------------------------------------------------
// Data source connection admin read shape
// ---------------------------------------------------------------------------

/**
 * DataSourceConnectionAdminRecord — what GET /admin/integrations returns per row.
 *
 * SECURITY INVARIANT: `encrypted_credentials` is NEVER included in this read shape.
 * The `hasCredential` flag signals whether a credential has been stored, without
 * revealing the value or the ciphertext.
 */
export const dataSourceConnectionAdminRecordSchema = z
  .object({
    id: z.string().uuid(),
    /** Railway-env key name for this adapter (e.g. 'GRATA_API_KEY'). */
    providerKey: z.string().min(1),
    /** Human-readable display name (e.g. 'Grata'). */
    displayName: z.string().min(1),
    /** true = connection is active and will be used by the ETL service. */
    enabled: z.boolean(),
    /**
     * true = an encrypted credential is stored for this connection.
     * false = no credential stored yet.
     * The plaintext is NEVER returned by the read path.
     */
    hasCredential: z.boolean(),
    createdAt: z.string().datetime(),
    /** Nullable UUID of the app user who created this connection row. */
    createdBy: z.string().uuid().nullable(),
  })
  .strict();

export type DataSourceConnectionAdminRecord = z.infer<typeof dataSourceConnectionAdminRecordSchema>;

export const dataSourceConnectionAdminListResponseSchema = z
  .object({
    connections: z.array(dataSourceConnectionAdminRecordSchema),
  })
  .strict();

export type DataSourceConnectionAdminListResponse = z.infer<
  typeof dataSourceConnectionAdminListResponseSchema
>;

// ---------------------------------------------------------------------------
// Data source config typed-boundary schema (Wave-16, task 2560fecc — P-4 Finding 2)
// ---------------------------------------------------------------------------

/**
 * dataSourceConnectionConfigSchema — the TYPED, ENUMERATED whitelist for the
 * non-secret per-connection config JSONB column.
 *
 * WHY THIS EXISTS (P-4 Finding 2, CRITICAL):
 *   The previous `z.record(z.unknown())` was a free-JSONB secret sink: any
 *   admin could store a plaintext API key or secret in the config field,
 *   bypassing the encrypted_credentials column and defeating encrypted-at-rest.
 *   This schema is a TYPED BOUNDARY — it rejects any field not on this
 *   whitelist and constrains every allowed field to a non-secret type.
 *
 * WHITELIST DERIVATION (grep results, wave-16 B-1):
 *   Grepped apps/api/src/modules data-source files, apps/web admin integrations
 *   page, and all adapter files. Findings:
 *     - No adapter reads ANY named config field today (fixture adapter ignores
 *       config entirely; no real provider adapter is shipped).
 *     - The UI placeholder documents { fieldMapping: { name: "company_name" } }
 *       as the intended use case for the field.
 *     - Existing stored rows are all empty-object (the JSONB default).
 *   Therefore the whitelist today is:
 *     fieldMapping  - object mapping internal field names to source field names.
 *                     Each value is a bounded-length non-secret string (max 128 chars).
 *                     Non-secret: field names from a provider's API schema, not secrets.
 *     syncBatchSize - positive integer (1-10000). Controls ETL batch size.
 *                     Non-secret: a performance tuning parameter.
 *     regionSlug    - bounded identifier string (e.g. "us-east-1", "eu").
 *                     Max 64 chars, alphanumeric + hyphens only (not a secret).
 *
 * BACKWARD COMPATIBILITY:
 *   All three fields are optional. The empty-object default ({}) stored in
 *   existing rows passes this schema. No migration needed.
 *
 * NO FREE-TEXT SLOT:
 *   There is no `z.string()` without a max-length bound, and no `z.unknown()`
 *   slot. Any field not listed here is rejected by .strict(). If a legitimate
 *   future field needs an arbitrary string (e.g. a description), it must be
 *   added to this whitelist with an explicit max-length bound. Secrets MUST use
 *   the `credential` field (encrypted at rest by the service) — never config.
 *
 * SERVICE REJECTION (B-2 responsibility):
 *   DataSourceAdminService must return a UNIFORM STATIC 400 message on
 *   config validation failure — it MUST NOT echo the offending config value
 *   in the error (wave-15 B-6 M1 "no input echo" rework mirrors this pattern).
 */
export const dataSourceConnectionConfigSchema = z
  .object({
    /**
     * Field-mapping dictionary: maps internal canonical field names to the
     * provider's API field names. Example: { "name": "company_name" }.
     * Values are bounded-length non-secret strings (provider field names).
     * No free-text slot — each value is limited to 128 characters.
     */
    fieldMapping: z.record(z.string().max(128)).optional(),
    /**
     * ETL batch size override (positive integer, 1–10000).
     * Non-secret tuning parameter. Absent = adapter default.
     */
    syncBatchSize: z.number().int().min(1).max(10000).optional(),
    /**
     * Provider region slug (e.g. "us-east-1", "eu", "apac").
     * Alphanumeric + hyphens only, max 64 chars. Non-secret infrastructure hint.
     */
    regionSlug: z
      .string()
      .max(64)
      .regex(/^[a-z0-9-]+$/, 'regionSlug must be lowercase alphanumeric and hyphens only')
      .optional(),
  })
  .strict();

export type DataSourceConnectionConfig = z.infer<typeof dataSourceConnectionConfigSchema>;

// ---------------------------------------------------------------------------
// Upsert input (create or update a connection + optionally set the credential)
// ---------------------------------------------------------------------------

/**
 * DataSourceConnectionUpsertInput — POST /admin/integrations (create) or
 * PATCH /admin/integrations/:id (update).
 *
 * SECURITY: `credential` is the plaintext value entered in the admin form.
 * It is encrypted (AES-256-GCM) by DataSourceAdminService BEFORE reaching the DB.
 * The plaintext NEVER touches audit rows, error messages, or logs.
 * The field is optional — an upsert without `credential` leaves any existing
 * encrypted_credentials unchanged.
 *
 * `config` is now a TYPED BOUNDARY (dataSourceConnectionConfigSchema) — not a
 * free-JSONB sink. The service MUST reject (400 uniform-static no-echo) any
 * config value that fails this schema. See dataSourceConnectionConfigSchema
 * for the complete whitelist rationale.
 */
export const dataSourceConnectionUpsertSchema = z
  .object({
    providerKey: z.string().min(1),
    displayName: z.string().min(1),
    /**
     * Plaintext credential (admin-entered, e.g. an API key).
     * Optional — omit to leave the existing stored credential unchanged.
     * The service encrypts this BEFORE writing to the DB.
     */
    credential: z.string().min(1).optional(),
    /**
     * Non-secret per-connection config — TYPED BOUNDARY (P-4 Finding 2).
     * Replaces the former z.record(z.unknown()). Only whitelisted non-secret
     * fields are accepted; unknown keys are rejected. Absent = store {} default.
     * Secrets MUST use the `credential` field, NEVER config.
     */
    config: dataSourceConnectionConfigSchema.optional(),
  })
  .strict();

export type DataSourceConnectionUpsertInput = z.infer<typeof dataSourceConnectionUpsertSchema>;

// ---------------------------------------------------------------------------
// Toggle input
// ---------------------------------------------------------------------------

/**
 * DataSourceConnectionToggleInput — PATCH /admin/integrations/:id/toggle body.
 */
export const dataSourceConnectionToggleSchema = z
  .object({
    enabled: z.boolean(),
  })
  .strict();

export type DataSourceConnectionToggleInput = z.infer<typeof dataSourceConnectionToggleSchema>;
