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
    /** Non-secret per-connection config (field mappings, filters, etc.). */
    config: z.record(z.unknown()).optional(),
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
