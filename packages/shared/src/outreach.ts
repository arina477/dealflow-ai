import { z } from 'zod';

/**
 * Wave-11 outreach shared contracts (B-1, task 102a2f00).
 *
 * Covers:
 *   - outreachTemplateSchema / outreachTemplateVersionSchema — READ shapes (passthrough)
 *   - Input schemas for create / draft / approval-request / approval-grant / compose
 *   - gateVerdictSchema (re-exported from compliance-gate; inlined here for the
 *     outreach record's gate_verdict field shape)
 *   - outreachSchema — the persisted outreach record READ shape
 *
 * READ schemas use .passthrough() (rule 5 — server may add fields without client break).
 * INPUT schemas use .strict() (mass-assignment guard — unexpected keys are rejected).
 *
 * Timestamps use z.string() (ISO-8601 text from Drizzle's mode:'string').
 */

// ---------------------------------------------------------------------------
// Enums (mirror the DB pgEnums — keep in sync)
// ---------------------------------------------------------------------------

/**
 * Outreach template version approval lifecycle.
 * DISTINCT from the M2 approvalStatusEnum ('approved' | 'revoked').
 */
export const outreachApprovalStatusEnum = z.enum(['pending', 'approved', 'rejected']);
export type OutreachApprovalStatus = z.infer<typeof outreachApprovalStatusEnum>;

/**
 * Composed outreach record lifecycle.
 *   compose       — default on creation (transient; gate always resolves inline)
 *   send_eligible — gate passed (allowed:true)
 *   blocked       — gate failed (allowed:false)
 */
export const outreachStatusEnum = z.enum(['compose', 'send_eligible', 'blocked']);
export type OutreachStatus = z.infer<typeof outreachStatusEnum>;

// ---------------------------------------------------------------------------
// READ shapes — passthrough (rule 5)
// ---------------------------------------------------------------------------

/**
 * OutreachTemplate — the template container row.
 */
export const outreachTemplateSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    mandateScope: z.string().nullable(),
    ownerId: z.string().uuid().nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .passthrough();

export type OutreachTemplate = z.infer<typeof outreachTemplateSchema>;

/**
 * OutreachTemplateVersion — one version row (append-style versioning).
 * Includes all approval state fields for the version-binding invariant.
 */
export const outreachTemplateVersionSchema = z
  .object({
    id: z.string().uuid(),
    templateId: z.string().uuid(),
    versionNumber: z.number().int().positive(),
    subject: z.string().min(1),
    body: z.string().min(1),
    disclaimerTemplateId: z.string().uuid(),
    contentHash: z.string().length(64),
    /** approval_status — outreachApprovalStatusEnum values (pending|approved|rejected). */
    approvalStatus: outreachApprovalStatusEnum,
    /**
     * approved_content_hash — the content_hash at approval time.
     * NULL until grantApproval runs. VERSION-BINDING: must equal contentHash for
     * isUsableForSend to return true.
     */
    approvedContentHash: z.string().length(64).nullable(),
    /** approved_by — the compliance user who approved this version. NULL until approved. */
    approvedBy: z.string().uuid().nullable(),
    createdAt: z.string(),
  })
  .passthrough();

export type OutreachTemplateVersion = z.infer<typeof outreachTemplateVersionSchema>;

/**
 * GateVerdictRecord — the stored gate_verdict jsonb shape on an outreach row.
 * Mirrors GateVerdict from compliance-gate.ts (passthrough for forward-compat).
 */
export const gateVerdictRecordSchema = z
  .object({
    allowed: z.boolean(),
    blocks: z.array(z.record(z.unknown())),
    requiredDisclaimers: z.array(z.string()),
  })
  .passthrough();

export type GateVerdictRecord = z.infer<typeof gateVerdictRecordSchema>;

/**
 * Outreach — the composed outreach record.
 */
export const outreachSchema = z
  .object({
    id: z.string().uuid(),
    mandateId: z.string().uuid(),
    matchCandidateId: z.string().uuid(),
    templateVersionId: z.string().uuid(),
    gateVerdict: gateVerdictRecordSchema,
    status: outreachStatusEnum,
    createdBy: z.string().uuid(),
    createdAt: z.string(),
  })
  .passthrough();

export type Outreach = z.infer<typeof outreachSchema>;

// ---------------------------------------------------------------------------
// INPUT schemas — strict() (mass-assignment guard)
// ---------------------------------------------------------------------------

/**
 * TemplateCreateInput — create a new outreach template (+ v1 draft).
 * Advisor/analyst role.
 */
export const templateCreateInputSchema = z
  .object({
    /** Human-readable template name. */
    name: z.string().min(1).max(255),
    /**
     * Optional mandate scope — a mandate UUID or descriptive label.
     * NULL = firm-wide template.
     */
    mandateScope: z.string().max(255).nullable().optional(),
    /** Subject line for version 1. */
    subject: z.string().min(1),
    /** Body text for version 1. */
    body: z.string().min(1),
    /**
     * disclaimer_template_id — FK → disclaimer_templates.
     * The M2 required-block: a valid active disclaimer must be referenced.
     * requestApproval returns 400 if this does not reference a valid row.
     */
    disclaimerTemplateId: z.string().uuid(),
  })
  .strict();

export type TemplateCreateInput = z.infer<typeof templateCreateInputSchema>;

/**
 * VersionDraftInput — draft a new version of an existing template.
 * Advisor/analyst role. ALWAYS creates a new version row (never mutates approved).
 */
export const versionDraftInputSchema = z
  .object({
    /** Updated subject line. */
    subject: z.string().min(1),
    /** Updated body text. */
    body: z.string().min(1),
    /**
     * disclaimer_template_id — may change the referenced disclaimer.
     * Must reference a valid disclaimer_templates row.
     */
    disclaimerTemplateId: z.string().uuid(),
  })
  .strict();

export type VersionDraftInput = z.infer<typeof versionDraftInputSchema>;

/**
 * ApprovalRequestInput — request compliance review of a version.
 * Advisor/analyst role. Returns 400 if the version lacks a valid disclaimer.
 */
export const approvalRequestInputSchema = z
  .object({
    /**
     * Optional notes for the compliance reviewer (not stored in DB — passed
     * through for notification purposes in future bundles).
     */
    notes: z.string().max(1000).optional(),
  })
  .strict();

export type ApprovalRequestInput = z.infer<typeof approvalRequestInputSchema>;

/**
 * ApprovalGrantInput — grant approval of a version.
 * Compliance role ONLY (SoD: cannot be the same user as the composer).
 */
export const approvalGrantInputSchema = z
  .object({
    /**
     * Optional reviewer notes (not stored in DB — for audit narrative
     * in future notification bundles).
     */
    notes: z.string().max(1000).optional(),
  })
  .strict();

export type ApprovalGrantInput = z.infer<typeof approvalGrantInputSchema>;

/**
 * ApprovalRejectInput — reject a version under review.
 * Compliance role ONLY.
 */
export const approvalRejectInputSchema = z
  .object({
    /** Required reason for rejection (stored in audit payload). */
    reason: z.string().min(1).max(1000),
  })
  .strict();

export type ApprovalRejectInput = z.infer<typeof approvalRejectInputSchema>;

/**
 * OutreachComposeInput — compose an outreach from an approved template version.
 * Advisor role. Triggers the non-bypassable pre-send gate.
 *
 * The gate is ALWAYS called server-side. The caller provides the mandate/candidate/
 * template version; the service resolves all gate-context fields server-side.
 */
export const outreachComposeInputSchema = z
  .object({
    /** The mandate this outreach belongs to. */
    mandateId: z.string().uuid(),
    /** The shortlist buyer target (match_candidates.id with disposition='accepted'). */
    matchCandidateId: z.string().uuid(),
    /** The template version to use (must pass isUsableForSend server-side). */
    templateVersionId: z.string().uuid(),
    /**
     * Recipient email addresses. The gate's suppression evaluator checks these
     * against the suppression list.
     */
    recipients: z.array(z.string().email()).min(1),
    /**
     * Jurisdiction code for the disclaimer evaluator.
     * Typically derived from the mandate's compliance profile; passed explicitly
     * so the gate context is fully specified by the caller without a DB join.
     */
    jurisdiction: z.string().min(1),
  })
  .strict();

export type OutreachComposeInput = z.infer<typeof outreachComposeInputSchema>;
