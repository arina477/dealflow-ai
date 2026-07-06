import { z } from 'zod';
import { roleEnum } from './auth';

// ---------------------------------------------------------------------------
// BlockReason — discriminated union of block kinds the gate can emit.
// Each variant carries a machine-stable `code` (for rendering) and a `message`
// (human-readable detail). `code` matches the kind so the discriminant is the
// same field renderers already branch on.
// ---------------------------------------------------------------------------

export const blockReasonEnum = z.enum([
  'suppression',
  'sod',
  'content-hash-mismatch',
  'missing-disclaimer',
  'no-approval',
  'version-binding',
]);

export type BlockReasonCode = z.infer<typeof blockReasonEnum>;

export const suppressionBlockSchema = z
  .object({
    code: z.literal('suppression'),
    /** The recipient address that triggered the suppression hit. */
    recipient: z.string().min(1),
    /** The suppression_list match_type that fired ('email' | 'domain'). */
    matchType: z.enum(['email', 'domain']),
    /** The matched value from the suppression list entry. */
    matchedValue: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const sodBlockSchema = z
  .object({
    code: z.literal('sod'),
    /**
     * Machine-stable sub-reason for the SoD failure:
     *   - 'sender-is-approver' — approver_user_id === senderUserId (self-approval)
     *   - 'invalid-approver-role' — approver_role !== 'compliance'
     *   - 'approval-revoked'  — status === 'revoked'
     *   - 'approver-unknown'  — approver_user_id is NULL (approver account deleted,
     *     FK SET-NULL). We can no longer PROVE sender ≠ approver, so the approval
     *     cannot satisfy SoD → fail closed and BLOCK.
     * (The no-approval-ROW case is emitted under the distinct 'no-approval' code,
     * not a sod sub-reason.)
     */
    reason: z.enum([
      'sender-is-approver',
      'invalid-approver-role',
      'approval-revoked',
      'approver-unknown',
    ]),
    message: z.string().min(1),
  })
  .strict();

export const contentHashMismatchBlockSchema = z
  .object({
    code: z.literal('content-hash-mismatch'),
    /** The content_hash stored in the approval row. */
    approvedHash: z.string().min(1),
    /** The hash recomputed from ctx.content at evaluate() time. */
    currentHash: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const missingDisclaimerBlockSchema = z
  .object({
    code: z.literal('missing-disclaimer'),
    /** The jurisdiction for which a required disclaimer is unsatisfied. */
    jurisdiction: z.string().min(1),
    /** The active disclaimer template id that must be satisfied. */
    disclaimerTemplateId: z.string().uuid(),
    message: z.string().min(1),
  })
  .strict();

export const noApprovalBlockSchema = z
  .object({
    code: z.literal('no-approval'),
    message: z.string().min(1),
  })
  .strict();

/**
 * versionBindingBlockSchema — emitted by OutreachService.composeAsActor's
 * version-binding pre-check (L-1 fix). Distinct from 'no-approval' (emitted by
 * sodEvaluator when no compliance_approvals row exists). This code fires when the
 * template version itself is not usable: either approvalStatus !== 'approved', or
 * approvedContentHash !== contentHash (content drifted after approval).
 * A compliance reviewer reading gate_verdict can now distinguish:
 *   'no-approval'     → no compliance_approvals row for this resource
 *   'version-binding' → version-level state blocked (not approved / content drift)
 */
export const versionBindingBlockSchema = z
  .object({
    code: z.literal('version-binding'),
    message: z.string().min(1),
  })
  .strict();

/**
 * A discriminated union of every block a gate evaluator can emit.
 * Discriminated on `code` so callers can exhaustively switch/match.
 */
export const blockReasonSchema = z.discriminatedUnion('code', [
  suppressionBlockSchema,
  sodBlockSchema,
  contentHashMismatchBlockSchema,
  missingDisclaimerBlockSchema,
  noApprovalBlockSchema,
  versionBindingBlockSchema,
]);

export type BlockReason = z.infer<typeof blockReasonSchema>;

// ---------------------------------------------------------------------------
// GateVerdict — the single output type of ComplianceGateService.evaluate().
// `allowed` is true iff blocks is empty AND all required disclaimers are
// satisfied; the gate computes this — callers never override it.
// ---------------------------------------------------------------------------

export const gateVerdictSchema = z
  .object({
    /** true = send is permitted; false = at least one hard block exists. */
    allowed: z.boolean(),
    /**
     * All block reasons accumulated by the four evaluators.
     * Empty array on allowed:true (not undefined — callers iterate this safely).
     */
    blocks: z.array(blockReasonSchema),
    /**
     * Disclaimer template ids whose bodies must be included in the content
     * before the gate will allow. Populated by the disclaimer evaluator;
     * empty on allowed:true.
     */
    requiredDisclaimers: z.array(z.string()),
  })
  .strict();

export type GateVerdict = z.infer<typeof gateVerdictSchema>;

// ---------------------------------------------------------------------------
// GateContext — the input shape for ComplianceGateService.evaluate().
// All fields are server-supplied; none are trusted from a client payload
// (the API layer extracts senderUserId / senderRole from the verified session).
// ---------------------------------------------------------------------------

export const gateContextSchema = z
  .object({
    /**
     * App-DB `users.id` (UUID) of the outreach sender — NOT the SuperTokens
     * user id. The M6 send endpoint MUST resolve the SuperTokens session id to
     * the app users row (e.g. via AuthRepository.getUserWithRole) and pass the
     * resulting `users.id` here. Passing a raw SuperTokens id will FK-violate
     * the audit `actor_user_id` column (which references `users(id)`).
     */
    senderUserId: z.string().uuid(),
    /** DB-authoritative role of the sender (not a stale JWT claim). */
    senderRole: roleEnum,
    /** Resolved recipient email addresses for this outreach batch. */
    recipients: z.array(z.string().email()).min(1),
    /**
     * Jurisdiction code(s) that apply to this outreach
     * (determines which disclaimer templates are required).
     */
    jurisdiction: z.string().min(1),
    /** Full text of the outreach content (used for hash recompute + disclaimer check). */
    content: z.string().min(1),
    /**
     * SHA-256 hex hash of `content`, computed by the caller before calling evaluate().
     * The gate recomputes the hash internally and compares; the caller-supplied value
     * is used to look up the compliance_approvals row.
     */
    contentHash: z.string().length(64),
    /** Audited object type (e.g. 'outreach'). */
    resourceType: z.string().min(1),
    /** Audited object id (the mandate/outreach-batch being sent). */
    resourceId: z.string().min(1),
    /**
     * Wave-14 (task 487b0f0c) — mandate context for the gate-evaluate audit row.
     *
     * The mandate this gate evaluation is being performed on behalf of.
     * OutreachService.composeAsActor populates this from input.mandateId so
     * ComplianceGateService.verdictAuditEntry can record it in the hash-excluded
     * mandate_id column of audit_log_entries.
     *
     * NOTE: outreachId is NOT available at gate-evaluate time — the gate runs
     * BEFORE the outreach INSERT, so only mandateId is recorded here. This is
     * sufficient for the recordkeeping mandate-derivation (see
     * recordkeeping.repository.ts § gate-evaluate branch).
     *
     * HASH-EXCLUDED: mandateId is written to the DB column but NEVER included in
     * the HMAC preimage (not part of HashableEntryFields). The gate-evaluate
     * audit entry's entry_hash is computed over the same fields as before.
     */
    mandateId: z.string().uuid(),
  })
  .strict();

export type GateContext = z.infer<typeof gateContextSchema>;
