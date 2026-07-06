import { z } from 'zod';

/**
 * Wave-18 analytics shared contracts (B-1, task a5ba8068).
 *
 * Covers the 4 metric-family summary shape for GET /analytics.
 *
 * F1 — Mandate throughput: counts by mandate_status (draft / active).
 * F2 — Outreach compliance-gate outcomes: pass-rate / blocked-rate over
 *       outreach.status (compose / send_eligible / blocked).
 *       NAMING CONTRACT: fields are gatePassRate / blockedRate — NOT responseRate.
 *       These measure the pre-send compliance gate only; no email send data exists.
 * F3 — Advisor productivity: per-actor activity (mandates created / pipeline rows).
 * F4 — Match disposition: counts by match_candidate_disposition.
 *
 * All schemas use .passthrough() (rule 5 — server may add fields without client break).
 * All numeric fields default to 0 / null (empty-state safe — no undefined-only fields).
 */

// ---------------------------------------------------------------------------
// F1 — Mandate throughput
// ---------------------------------------------------------------------------

/**
 * MandateThroughput — counts of mandates by lifecycle status.
 *
 * totalDraft  — count of mandates WHERE status = 'draft'.
 * totalActive — count of mandates WHERE status = 'active'.
 * total       — totalDraft + totalActive (convenience sum).
 */
export const mandateThroughputSchema = z
  .object({
    totalDraft: z.number().int().min(0),
    totalActive: z.number().int().min(0),
    total: z.number().int().min(0),
  })
  .passthrough();

export type MandateThroughput = z.infer<typeof mandateThroughputSchema>;

// ---------------------------------------------------------------------------
// F2 — Outreach compliance-gate outcomes
// ---------------------------------------------------------------------------

/**
 * OutreachGateOutcomes — pre-send compliance gate outcome distribution.
 *
 * NAMING CONTRACT (load-bearing — P-4 PHASE-2 KAREN CORRECTION):
 *   gatePassRate  — ratio send_eligible / total  (gate PASSED; eligible to send).
 *   blockedRate   — ratio blocked / total         (gate FAILED; blocked outreach).
 *   NOT "responseRate" — outreach.status is a compliance-gate status, not a
 *   send/response status; no email has ever been dispatched (deferred M6+).
 *
 * totalCompose       — count WHERE status = 'compose'   (transient; gate pending).
 * totalSendEligible  — count WHERE status = 'send_eligible'.
 * totalBlocked       — count WHERE status = 'blocked'.
 * total              — sum of all three counts.
 * gatePassRate       — totalSendEligible / total (null when total = 0; div-by-zero safe).
 * blockedRate        — totalBlocked / total       (null when total = 0; div-by-zero safe).
 */
export const outreachGateOutcomesSchema = z
  .object({
    totalCompose: z.number().int().min(0),
    totalSendEligible: z.number().int().min(0),
    totalBlocked: z.number().int().min(0),
    total: z.number().int().min(0),
    /** null when total = 0 (no outreach records — div-by-zero safe). */
    gatePassRate: z.number().min(0).max(1).nullable(),
    /** null when total = 0 (no outreach records — div-by-zero safe). */
    blockedRate: z.number().min(0).max(1).nullable(),
  })
  .passthrough();

export type OutreachGateOutcomes = z.infer<typeof outreachGateOutcomesSchema>;

// ---------------------------------------------------------------------------
// F3 — Advisor productivity
// ---------------------------------------------------------------------------

/**
 * AdvisorActivityRow — per-actor activity summary.
 *
 * userId           — app users.id (UUID).
 * mandatesCreated  — count of mandates.created_by = userId.
 * pipelineRows     — count of pipeline.created_by = userId.
 */
export const advisorActivityRowSchema = z
  .object({
    userId: z.string().uuid(),
    mandatesCreated: z.number().int().min(0),
    pipelineRows: z.number().int().min(0),
  })
  .passthrough();

export type AdvisorActivityRow = z.infer<typeof advisorActivityRowSchema>;

/**
 * AdvisorProductivity — aggregate productivity stats for F3.
 *
 * rows  — per-actor breakdown (may be empty if no activity).
 * total — count of distinct active users with any activity (convenience).
 */
export const advisorProductivitySchema = z
  .object({
    rows: z.array(advisorActivityRowSchema),
    total: z.number().int().min(0),
  })
  .passthrough();

export type AdvisorProductivity = z.infer<typeof advisorProductivitySchema>;

// ---------------------------------------------------------------------------
// F4 — Match disposition
// ---------------------------------------------------------------------------

/**
 * MatchDisposition — counts of match_candidates by disposition.
 *
 * totalPending  — count WHERE disposition = 'pending'.
 * totalAccepted — count WHERE disposition = 'accepted'.
 * totalRejected — count WHERE disposition = 'rejected'.
 * totalFlagged  — count WHERE disposition = 'flagged'.
 * total         — sum of all four counts.
 */
export const matchDispositionSchema = z
  .object({
    totalPending: z.number().int().min(0),
    totalAccepted: z.number().int().min(0),
    totalRejected: z.number().int().min(0),
    totalFlagged: z.number().int().min(0),
    total: z.number().int().min(0),
  })
  .passthrough();

export type MatchDisposition = z.infer<typeof matchDispositionSchema>;

// ---------------------------------------------------------------------------
// AnalyticsSummary — the top-level 4-family response shape
// ---------------------------------------------------------------------------

/**
 * AnalyticsSummary — the GET /analytics response shape.
 *
 * Workspace-scoped: every field reflects the caller's firm ONLY (FORCE RLS +
 * app.workspace_id GUC — the M8 isolation invariant). The service layer
 * guarantees all queries use getDb(this.db) — no raw off-GUC pool access.
 *
 * Empty-state safe: every field defaults to 0 / null, never undefined-only.
 *   An empty workspace (no data) returns:
 *     mandateThroughput: { totalDraft:0, totalActive:0, total:0 }
 *     outreachGateOutcomes: { …all counts 0, gatePassRate:null, blockedRate:null }
 *     advisorProductivity: { rows:[], total:0 }
 *     matchDisposition: { …all counts 0, total:0 }
 */
export const analyticsSummarySchema = z
  .object({
    mandateThroughput: mandateThroughputSchema,
    outreachGateOutcomes: outreachGateOutcomesSchema,
    advisorProductivity: advisorProductivitySchema,
    matchDisposition: matchDispositionSchema,
  })
  .passthrough();

export type AnalyticsSummary = z.infer<typeof analyticsSummarySchema>;
