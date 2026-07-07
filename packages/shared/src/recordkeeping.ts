/**
 * Wave-13 recordkeeping contracts — types consumed by both the API
 * (RecordkeepingController/Service) and the frontend audit-log page.
 *
 * Design notes:
 *
 * auditLogEntryReadSchema — .passthrough() (not .strict()). The read surface
 *   tolerates extra columns that may appear on the DB row; this prevents a future
 *   DB column addition from breaking existing clients before they are updated.
 *   createdAt uses z.string() (not z.string().datetime()) for the same reason:
 *   the DB may return various timestamp representations that .datetime() would
 *   reject. The tamper-evidence fields (sequenceNumber, prevHash, entryHash) are
 *   included so callers can independently verify the chain entries.
 *
 * auditVerifyResponseSchema — re-exported from audit.ts (DO NOT mirror a new
 *   copy — that would be a drift risk). Import it directly from @dealflow/shared.
 *
 * listFilterSchema — .passthrough() on the query side for future extension.
 *   All filter fields are optional; the absence of all filters returns the full
 *   org-wide log (for compliance/admin) or the advisor's own-outreach entries.
 *
 * exportScopeSchema — .strict() on the input side; extra keys on POST body are
 *   rejected with 400 BadRequestException.
 *
 * exportManifestSchema — the offline re-verification manifest. chainRoot is
 *   always GENESIS_PREV_HASH ('0'.repeat(64)) for the current single chain.
 *   tailHash is the entry_hash of the last entry in the exported scope; null
 *   when the scope contains zero entries (valid empty export).
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// auditLogEntryReadSchema — passthrough READ shape (mirrors audit_log_entries)
// ---------------------------------------------------------------------------

/**
 * Schema for reading a single audit log entry.
 *
 * Differences from the strict `auditLogEntrySchema` in audit.ts:
 *   - .passthrough(): extra DB columns are tolerated (not stripped/rejected).
 *   - action: z.string() (not the enum) — allows entries with any action value,
 *     including future action kinds not yet in the shared enum.
 *   - createdAt: z.string() — no datetime() constraint; accepts any pg
 *     timestamptz representation that Drizzle may return in mode:'string'.
 */
export const auditLogEntryReadSchema = z
  .object({
    sequenceNumber: z.number().int().positive(),
    actorUserId: z.string().uuid().nullable(),
    actorRole: z.string().min(1),
    /** String (not the auditActionEnum) — passthrough for unknown future actions. */
    action: z.string().min(1),
    resourceType: z.string().min(1),
    resourceId: z.string().nullable(),
    contentHash: z.string().min(1),
    payloadHash: z.string().min(1),
    prevHash: z.string().min(1),
    entryHash: z.string().min(1),
    chainVersion: z.number().int().positive(),
    createdAt: z.string(),
  })
  .passthrough();

export type AuditLogEntryRead = z.infer<typeof auditLogEntryReadSchema>;

// ---------------------------------------------------------------------------
// listFilterSchema — filtered read input (.passthrough for query extension)
// ---------------------------------------------------------------------------

/**
 * Input schema for GET /compliance/audit-log.
 *
 * All fields are optional. When mandateId is provided, the repository applies
 * the mandate-scope derivation (per resource_type: mandate-* → direct;
 * outreach/pipeline/match_run/buyer_universe → joined via their mandate_id FK;
 * match_candidate/buyer_universe_candidate → two-hop join). Org-wide entries
 * (compliance_rule, suppression_entry, etc.) are excluded from mandate-scoped
 * queries because they have no mandate FK.
 *
 * .passthrough() lets future query params survive without a schema change.
 */
export const listFilterSchema = z
  .object({
    /** Mandate UUID — triggers the per-resource_type mandate derivation in the repo. */
    mandateId: z.string().uuid().optional(),
    /** Filter by audit action type (e.g. 'outreach-compose', 'pipeline-enroll'). */
    type: z.string().min(1).optional(),
    /** Filter by actorUserId (app users.id UUID). */
    actor: z.string().uuid().optional(),
    /** ISO datetime lower bound (inclusive) on createdAt. */
    from: z.string().optional(),
    /** ISO datetime upper bound (inclusive) on createdAt. */
    to: z.string().optional(),
    /** Page size (max 200, default 50). */
    limit: z.coerce.number().int().positive().max(200).default(50).optional(),
    /** Page offset (default 0). */
    offset: z.coerce.number().int().nonnegative().default(0).optional(),
  })
  .passthrough();

export type ListFilter = z.infer<typeof listFilterSchema>;

// ---------------------------------------------------------------------------
// exportScopeSchema — export scope input (.strict — unknown keys are 400)
// ---------------------------------------------------------------------------

/**
 * Input schema for POST /compliance/audit-log/export.
 *
 * .strict(): any extra keys on the request body are rejected with 400.
 * All fields are optional. Notably: workspace_id / firmId / tenant are FORBIDDEN
 * (SEC-2 — workspace is server-resolved from the session GUC; client must not supply it).
 *
 * format: 'csv' | 'json' — output serialization (default 'csv').
 * scope:  'audit' | 'deal' | 'both' — what data to include (default 'both').
 * from / to: optional ISO datetime bounds (default: last 12 months if omitted).
 * mandateId: optional scoping to a single mandate.
 */
export const exportScopeSchema = z
  .object({
    /** Optional mandate UUID — scopes the export to entries for this mandate. */
    mandateId: z.string().uuid().optional(),
    /** Optional ISO datetime lower bound (inclusive) on createdAt. */
    from: z.string().optional(),
    /** Optional ISO datetime upper bound (inclusive) on createdAt. */
    to: z.string().optional(),
    /**
     * Output format.
     *   'csv'  — RFC-4180 CSV with injection-safe escaping (SEC-5).
     *   'json' — JSON manifest + entries array (original format).
     * Default: 'csv'.
     */
    format: z.enum(['csv', 'json']).default('csv'),
    /**
     * Scope of data to export.
     *   'audit' — audit log entries only.
     *   'deal'  — deal/pipeline activity only (SEC-3).
     *   'both'  — audit log entries + deal/pipeline activity (default).
     * Default: 'both'.
     */
    scope: z.enum(['audit', 'deal', 'both']).default('both'),
  })
  .strict();

export type ExportScope = z.infer<typeof exportScopeSchema>;

// ---------------------------------------------------------------------------
// exportManifestSchema — the offline re-verification manifest (READ shape)
// ---------------------------------------------------------------------------

/**
 * The export manifest — embedded in every export package.
 *
 * Enables independent OFFLINE re-verification:
 *   1. `chainRoot` (= GENESIS_PREV_HASH) anchors the chain origin.
 *   2. `tailHash` is the entry_hash of the last entry in the export; a verifier
 *      can confirm the last entry links correctly to the prior chain position.
 *   3. `verifyResult` (in the full package, not in this manifest schema) proves
 *      the FULL chain was intact at export time.
 *   4. `scope` records the exact filter criteria so the export is reproducible.
 *   5. `truncated` / `rowsReturned` / `rowsAvailable` (SEC-4) — EXPLICIT cap
 *      signal. When truncated=true the export hit the row cap and the file is
 *      NOT a "complete" export — caller must narrow the date range.
 *   6. `firmLocalOrdinal` note: exported rows carry a per-firm ordinal (1..N),
 *      NOT the global sequence_number (cross-tenant side-channel, SEC-6).
 *
 * tailHash is nullable because an export with zero entries has no tail.
 */
export const exportManifestSchema = z
  .object({
    scope: exportScopeSchema,
    /** ISO datetime when the export was generated. */
    generatedAt: z.string(),
    /** App users.id (UUID) of the actor who triggered the export; nullable for system. */
    generatingActor: z.string().uuid().nullable(),
    /**
     * The chain root anchor = GENESIS_PREV_HASH ('0'.repeat(64)).
     * Constant for the current single-chain design; a future multi-chain or
     * checkpoint design would use the relevant anchor here.
     */
    chainRoot: z.string().min(1),
    /**
     * entry_hash of the last entry in the exported scope.
     * Null when entryCount is 0 (empty scope export).
     */
    tailHash: z.string().min(1).nullable(),
    /** Number of audit entries in this export (rows actually returned). */
    entryCount: z.number().int().nonnegative(),
    /**
     * SEC-4: true when the row cap was hit and the export is NOT a complete dataset.
     * When true, the caller MUST narrow the date range to obtain a complete export.
     * Never silently emit a short "complete" file — this flag makes truncation explicit.
     */
    truncated: z.boolean(),
    /**
     * SEC-4: total rows returned in this export (across all scopes).
     * Equal to or less than rowsAvailable.
     */
    rowsReturned: z.number().int().nonnegative(),
    /**
     * SEC-4: total rows available in the date range (before cap was applied).
     * When truncated=false this equals rowsReturned.
     * When truncated=true this exceeds rowsReturned — indicates how many were skipped.
     */
    rowsAvailable: z.number().int().nonnegative(),
  })
  .strict();

export type ExportManifest = z.infer<typeof exportManifestSchema>;

// ---------------------------------------------------------------------------
// Re-export auditVerifyResponseSchema from audit.ts
//
// DO NOT mirror a new copy here — that is a drift risk. Any downstream consumer
// that needs auditVerifyResponseSchema should import it from @dealflow/shared
// (this re-export keeps it discoverable alongside the other recordkeeping types).
// ---------------------------------------------------------------------------

export { auditVerifyResponseSchema } from './audit';
