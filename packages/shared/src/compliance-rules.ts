import { z } from 'zod';

// ---------------------------------------------------------------------------
// pgEnum mirrors — kept in the shared layer so the API Drizzle schema and the
// web client form validation both reference the same string-union values.
// ---------------------------------------------------------------------------

/**
 * Mirrors the `compliance_rule_type` pgEnum from the DB schema.
 * Values are the canonical rule type identifiers.
 */
export const complianceRuleTypeEnum = z.enum([
  'blocklist_check',
  'disclaimer_required',
  'approval_required',
  'jurisdiction_check',
]);

export type ComplianceRuleType = z.infer<typeof complianceRuleTypeEnum>;

/**
 * Mirrors the `suppression_match_type` pgEnum.
 */
export const suppressionMatchTypeEnum = z.enum(['email', 'domain']);

export type SuppressionMatchType = z.infer<typeof suppressionMatchTypeEnum>;

/**
 * Mirrors the `approval_status` pgEnum.
 */
export const approvalStatusEnum = z.enum(['approved', 'revoked']);

export type ApprovalStatus = z.infer<typeof approvalStatusEnum>;

// ---------------------------------------------------------------------------
// ComplianceRule — READ shape (mirrors `compliance_rules` table row).
// ---------------------------------------------------------------------------

export const complianceRuleSchema = z
  .object({
    id: z.string().uuid(),
    ruleType: complianceRuleTypeEnum,
    /**
     * Jurisdiction this rule applies to; null = global (applies to all jurisdictions).
     */
    jurisdiction: z.string().min(1).nullable(),
    /**
     * Variable rule parameters. Shape is rule_type-specific and validated
     * by the API service at write time; the shared schema accepts any object
     * for forward-compatibility.
     */
    config: z.record(z.unknown()),
    enabled: z.boolean(),
    /** UUID of the user who created this rule; null if that user was deleted. */
    createdBy: z.string().uuid().nullable(),
    // PG-wire timestamptz format ("2026-07-04 04:42:20.996353+00") is NOT
    // ISO-8601 and is rejected by z.string().datetime(). This is a READ shape
    // for API-returned timestamps; strict ISO validation is wrong here.
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export type ComplianceRule = z.infer<typeof complianceRuleSchema>;

// ---------------------------------------------------------------------------
// ComplianceRule — CREATE input schema (POST /compliance/rules body).
// ---------------------------------------------------------------------------

export const ruleCreateSchema = z
  .object({
    ruleType: complianceRuleTypeEnum,
    jurisdiction: z.string().min(1).nullable().optional(),
    config: z.record(z.unknown()),
    enabled: z.boolean().optional().default(true),
  })
  .strict();

export type RuleCreate = z.infer<typeof ruleCreateSchema>;

// ---------------------------------------------------------------------------
// ComplianceRule — UPDATE input schema (PATCH /compliance/rules/:id body).
// All fields optional — callers send only the fields they want to change.
// The `enabled` field supports toggle-via-PATCH.
// ---------------------------------------------------------------------------

export const ruleUpdateSchema = z
  .object({
    ruleType: complianceRuleTypeEnum.optional(),
    jurisdiction: z.string().min(1).nullable().optional(),
    config: z.record(z.unknown()).optional(),
    enabled: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided for an update',
  });

export type RuleUpdate = z.infer<typeof ruleUpdateSchema>;

// ---------------------------------------------------------------------------
// SuppressionEntry — READ shape (mirrors `suppression_list` table row).
// ---------------------------------------------------------------------------

export const suppressionEntrySchema = z
  .object({
    id: z.string().uuid(),
    matchType: suppressionMatchTypeEnum,
    /**
     * Normalized lower-case email address or domain suffix.
     * Unique per (matchType, value) in the DB.
     */
    value: z.string().min(1),
    /** Human-readable reason for the suppression; null if not provided. */
    reason: z.string().min(1).nullable(),
    createdBy: z.string().uuid().nullable(),
    // PG-wire format — see complianceRuleSchema note above.
    createdAt: z.string(),
  })
  .strict();

export type SuppressionEntry = z.infer<typeof suppressionEntrySchema>;

// ---------------------------------------------------------------------------
// SuppressionEntry — CREATE input schema (POST /compliance/suppression body).
// ---------------------------------------------------------------------------

export const suppressionCreateSchema = z
  .object({
    matchType: suppressionMatchTypeEnum,
    /**
     * Email address (for matchType='email') or domain suffix (for matchType='domain').
     * Will be normalized to lower-case by the API service before persistence.
     */
    value: z.string().min(1),
    reason: z.string().min(1).nullable().optional(),
  })
  .strict();

export type SuppressionCreate = z.infer<typeof suppressionCreateSchema>;

// ---------------------------------------------------------------------------
// DisclaimerTemplate — READ shape (mirrors `disclaimer_templates` table row).
// Append-style versioned: each edit creates a new row (version+1) and
// deactivates the prior row. One `active=true` row per jurisdiction at any time.
// ---------------------------------------------------------------------------

export const disclaimerTemplateSchema = z
  .object({
    id: z.string().uuid(),
    jurisdiction: z.string().min(1),
    body: z.string().min(1),
    /**
     * Monotonically increasing version number per jurisdiction.
     * The active disclaimer is the row with the highest version AND active=true.
     */
    version: z.number().int().positive(),
    active: z.boolean(),
    createdBy: z.string().uuid().nullable(),
    // PG-wire format — see complianceRuleSchema note above.
    createdAt: z.string(),
  })
  .strict();

export type DisclaimerTemplate = z.infer<typeof disclaimerTemplateSchema>;

// ---------------------------------------------------------------------------
// DisclaimerTemplate — CREATE input schema (POST /compliance/disclaimers body).
// The API service increments `version` and deactivates prior rows; callers
// do NOT supply `version` or `active`.
// ---------------------------------------------------------------------------

export const disclaimerCreateSchema = z
  .object({
    jurisdiction: z.string().min(1),
    body: z.string().min(1),
  })
  .strict();

export type DisclaimerCreate = z.infer<typeof disclaimerCreateSchema>;

// ---------------------------------------------------------------------------
// DisclaimerTemplate — UPDATE input schema (PATCH /compliance/disclaimers/:id).
// An "edit" is actually an append: the API service inserts a new version row
// and deactivates the prior. Callers supply the new body (and optionally a
// new jurisdiction, though that is unusual).
// ---------------------------------------------------------------------------

export const disclaimerUpdateSchema = z
  .object({
    jurisdiction: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one field must be provided for an update',
  });

export type DisclaimerUpdate = z.infer<typeof disclaimerUpdateSchema>;

// ---------------------------------------------------------------------------
// ComplianceApproval — READ shape (mirrors `compliance_approvals` table row).
// Written by the approver (compliance role) via an approve endpoint (M6+).
// The gate reads this row server-side — never from a client payload.
// ---------------------------------------------------------------------------

export const complianceApprovalSchema = z
  .object({
    id: z.string().uuid(),
    /** Audited object type (e.g. 'outreach'). */
    resourceType: z.string().min(1),
    /** Audited object id (the mandate/outreach-batch being approved). */
    resourceId: z.string().min(1),
    /**
     * SHA-256 hex of the content at approval time.
     * The gate recomputes and compares — any post-approval edit invalidates this.
     */
    contentHash: z.string().length(64),
    /** UUID of the approving user; null if that user was deleted. */
    approverUserId: z.string().uuid().nullable(),
    /**
     * Role snapshot of the approving user at approval time.
     * ONLY 'compliance' is a valid SoD approver (admin excluded per security.md §RBAC-SoD).
     */
    approverRole: z.string().min(1),
    status: approvalStatusEnum,
    // PG-wire format — see complianceRuleSchema note above.
    createdAt: z.string(),
  })
  .strict();

export type ComplianceApproval = z.infer<typeof complianceApprovalSchema>;

// ---------------------------------------------------------------------------
// ComplianceApproval — CREATE input schema (future approve endpoint).
// The API service populates approverUserId + approverRole from the session;
// callers supply only the resource + contentHash to bind the approval to.
// ---------------------------------------------------------------------------

export const approvalCreateSchema = z
  .object({
    resourceType: z.string().min(1),
    resourceId: z.string().min(1),
    contentHash: z.string().length(64),
  })
  .strict();

export type ApprovalCreate = z.infer<typeof approvalCreateSchema>;
