import { z } from 'zod';

// ---------------------------------------------------------------------------
// Genesis anchor — the well-defined prev_hash for the first chain entry.
// 64 hex zeros matches SHA-256 hex output width; documented as the chain root.
// Both the append service and the verifier derive this constant from the
// shared package so neither side hard-codes it independently.
// ---------------------------------------------------------------------------

export const GENESIS_PREV_HASH = '0'.repeat(64);

// ---------------------------------------------------------------------------
// Chain-break reason enum — machine-stable strings returned by the verifier.
// Keep in sync with the verifier's reason-string assignments (B-2 step 2.9).
// ---------------------------------------------------------------------------

export const auditBreakReasonEnum = z.enum([
  'content-hash-mismatch',
  'prev-hash-mismatch',
  'sequence-gap',
]);

export type AuditBreakReason = z.infer<typeof auditBreakReasonEnum>;

// ---------------------------------------------------------------------------
// Action enum — audited action kinds (minimal for this wave).
// Callers wire in real action values at M6+; column accepts any text but the
// Zod enum gives shared type safety for the known set now.
// ---------------------------------------------------------------------------

export const auditActionEnum = z.enum(['verify-chain', 'compose', 'approve', 'send', 'suppress']);

export type AuditAction = z.infer<typeof auditActionEnum>;

// ---------------------------------------------------------------------------
// Append INPUT shape — the caller-supplied fields BEFORE hashing.
// The append service computes content_hash, payload_hash, prev_hash,
// entry_hash, and chain_version; callers supply everything else.
// ---------------------------------------------------------------------------

export const auditEntryInputSchema = z
  .object({
    /** User id of the actor; null for system / genesis events. */
    actorUserId: z.string().uuid().nullable(),
    /** Role snapshot at time of action (not a FK — stored as text). */
    actorRole: z.string().min(1),
    /** Action kind (shared enum). */
    action: auditActionEnum,
    /** Audited object type (e.g. "mandate", "outreach-batch"). */
    resourceType: z.string().min(1),
    /** Audited object id; null for non-object events. */
    resourceId: z.string().nullable(),
    /**
     * Hash of the communication payload content — DISTINCT from payloadHash.
     * Callers compute this before calling the service; service records it as-is.
     */
    contentHash: z.string().min(1),
    /**
     * Hash of the structured event payload — distinct from contentHash.
     * Callers compute this before calling the service; service records it as-is.
     */
    payloadHash: z.string().min(1),
  })
  .strict();

export type AuditEntryInput = z.infer<typeof auditEntryInputSchema>;

// ---------------------------------------------------------------------------
// READ shape — what the verify/list surfaces return (mirrors the DB columns).
// sequence_number is represented as a number here; consumers needing exact
// bigint precision for very large logs should use bigint at the DB boundary.
// ---------------------------------------------------------------------------

export const auditLogEntrySchema = z
  .object({
    /** Monotonically increasing PK; DB-assigned IDENTITY column. */
    sequenceNumber: z.number().int().positive(),
    /** Nullable — null for system / genesis entries. */
    actorUserId: z.string().uuid().nullable(),
    actorRole: z.string().min(1),
    action: auditActionEnum,
    resourceType: z.string().min(1),
    resourceId: z.string().nullable(),
    /** Hash of the communication payload (content). */
    contentHash: z.string().min(1),
    /** Hash of the structured event payload. */
    payloadHash: z.string().min(1),
    /** Prior entry's entry_hash; genesis entries store GENESIS_PREV_HASH. */
    prevHash: z.string().min(1),
    /** HMAC-SHA256 over the canonical serialization of this entry's fields. */
    entryHash: z.string().min(1),
    /**
     * Pins the HMAC key version (= AUDIT_LOG_HMAC_KEY_VERSION) AND the
     * canonical-serialization field-set/ordering version. A future change to
     * either the key OR the serialization field order MUST bump this value.
     */
    chainVersion: z.number().int().positive(),
    createdAt: z.string().datetime(),
  })
  .strict();

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

// ---------------------------------------------------------------------------
// AuditVerifyResponse — the verification endpoint response shape.
// Consumed by:
//   - B-2 step 2.11 (audit-log controller, return type)
//   - B-3 step 3.1/3.2 (compliance integrity screen, parsed client-side)
// ---------------------------------------------------------------------------

export const auditVerifyResponseSchema = z
  .object({
    /** true = chain intact; false = break detected. */
    ok: z.boolean(),
    /** Number of entries walked. 0 for an empty log (vacuously ok:true). */
    entriesChecked: z.number().int().nonnegative(),
    /**
     * The sequence_number of the first detected break.
     * Present only when ok=false.
     */
    firstBreakAt: z.number().int().positive().optional(),
    /**
     * Machine-stable reason string for the break.
     * Present only when ok=false.
     */
    reason: auditBreakReasonEnum.optional(),
  })
  .strict();

export type AuditVerifyResponse = z.infer<typeof auditVerifyResponseSchema>;
