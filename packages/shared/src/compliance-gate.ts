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
 * A discriminated union of every block a gate evaluator can emit.
 * Discriminated on `code` so callers can exhaustively switch/match.
 */
export const blockReasonSchema = z.discriminatedUnion('code', [
  suppressionBlockSchema,
  sodBlockSchema,
  contentHashMismatchBlockSchema,
  missingDisclaimerBlockSchema,
  noApprovalBlockSchema,
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
    /** Verified session userId of the outreach sender. */
    senderUserId: z.string().uuid(),
    /** Role snapshot from the verified session (not a client claim). */
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
  })
  .strict();

export type GateContext = z.infer<typeof gateContextSchema>;
