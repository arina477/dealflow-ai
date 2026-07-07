/**
 * retention.ts — shared Zod contracts for the M10 retention policy config.
 * Wave-28, task d3cc1337 (B-1).
 *
 * Exports:
 *   retentionPeriodDaysSchema — bounded integer (30..10950, ~30yr max).
 *   retentionPolicySchema     — the GET response shape (period + cutoff + provenance).
 *   setRetentionPolicySchema  — the PUT request shape (period only; workspace resolved server-side).
 *
 * SECURITY:
 *   setRetentionPolicySchema is .strict(): unknown keys (e.g. workspace_id, firmId)
 *   are rejected → 400. The workspace is always resolved server-side from the ALS
 *   GUC (getWorkspaceId()); it MUST NOT appear in the client request body.
 *
 * [SEC-C] The 'retention.policy.updated' action is added to auditActionEnum in audit.ts
 *   so that AuditService.append() type-checks the action cast at compile time.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

/**
 * Retention window in days.
 *   MIN 30  — shortest meaningful policy (a 1-day window would immediately expire everything).
 *   MAX 10950 — 30 years (well beyond any current FINRA/SEC requirement; prevents accidents).
 *   DEFAULT 2555 — ~7 years (common FINRA/SEC recordkeeping baseline).
 */
export const RETENTION_PERIOD_DAYS_MIN = 30;
export const RETENTION_PERIOD_DAYS_MAX = 10_950;
export const RETENTION_PERIOD_DAYS_DEFAULT = 2_555;

export const retentionPeriodDaysSchema = z
  .number()
  .int({ message: 'retention_period_days must be an integer' })
  .min(RETENTION_PERIOD_DAYS_MIN, {
    message: `retention_period_days must be at least ${RETENTION_PERIOD_DAYS_MIN} days`,
  })
  .max(RETENTION_PERIOD_DAYS_MAX, {
    message: `retention_period_days must be at most ${RETENTION_PERIOD_DAYS_MAX} days (~30 years)`,
  });

// ---------------------------------------------------------------------------
// GET response — policy read shape
// ---------------------------------------------------------------------------

export const retentionPolicySchema = z
  .object({
    /**
     * The configured retention window in days.
     * Reflects the workspace_retention_policy row value (or the default if no row exists yet).
     */
    retentionPeriodDays: retentionPeriodDaysSchema,

    /**
     * Derived read-only cutoff date: records with created_at < cutoffDate are
     * eligible for deletion under this policy. Computed as (now - retentionPeriodDays).
     * ISO-8601 date string (UTC). Informational — no purge is triggered by this endpoint.
     */
    cutoffDate: z.string().datetime({ message: 'cutoffDate must be a valid ISO-8601 datetime' }),

    // Provenance — who last updated the policy and when (null if never explicitly set).
    updatedBy: z.string().uuid().nullable(),
    updatedAt: z.string().datetime().nullable(),
  })
  .strict();

export type RetentionPolicy = z.infer<typeof retentionPolicySchema>;

// ---------------------------------------------------------------------------
// PUT request — set-policy shape
// ---------------------------------------------------------------------------

/**
 * Request body for PUT /compliance/retention.
 *
 * .strict() ensures unknown keys (workspace_id, firmId, tenant, etc.) are
 * rejected by Zod before reaching the service — 400 response.
 * workspace_id is ALWAYS resolved server-side from getWorkspaceId() (ALS/GUC);
 * it MUST NOT be a client-supplied parameter (SEC-A / SEC-2).
 */
export const setRetentionPolicySchema = z
  .object({
    retentionPeriodDays: retentionPeriodDaysSchema,
  })
  .strict();

export type SetRetentionPolicyInput = z.infer<typeof setRetentionPolicySchema>;
