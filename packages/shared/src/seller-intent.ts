import { z } from 'zod';

/**
 * Wave-23 seller-intent scoring contracts (B-1, task 1188e7da).
 *
 * ── CRITICAL INVARIANT — SI1 (NO tieBreak) ───────────────────────────────────
 * breakdown = { outreachEngagement, pipelineVelocity, matchDisposition, total, notApplied }.
 * NO tieBreak field anywhere in this file, the scorer, or the service.
 * The stale wave-22 decomposer prose that listed tieBreak is overridden by the
 * ACCEPTANCE-CRITERIA (SI1). tieBreak is absent by construction; tests assert it.
 *
 * ── SI2: DIRECTION IS A DETERMINISTIC WINDOWED DELTA ─────────────────────────
 * WINDOW_DAYS and DIRECTION_EPSILON are pinned constants in the scorer.
 * direction = sign of (recent-window-score − prior-window-score);
 * |delta| < EPSILON → 'flat'.
 * NO LLM / NO external call for direction inference.
 *
 * ── SI3: REFERENCE INSTANT SEMANTICS ─────────────────────────────────────────
 * The service derives referenceInstant = workspace max-event-ts across
 * outreach_activity / pipeline_events / match_candidates. A dormant mandate
 * reads 'cooling' relative to the most-active workspace timestamp. 0/1 events
 * → defined direction ('flat'/'notApplied'), no crash/div-by-zero.
 *
 * ── SCORER PURITY ────────────────────────────────────────────────────────────
 * PURE + DETERMINISTIC: identical inputs → identical output.
 * NO Anthropic/LLM/OpenAI/SDK/network/credential/randomness.
 * NO Date.now() inside the scorer — referenceInstant is passed in via input.
 *
 * All READ shapes use .passthrough() (rule 5 — server may add fields).
 */

// ---------------------------------------------------------------------------
// Direction enum
// ---------------------------------------------------------------------------

/**
 * SellerIntentDirection — seller's recent engagement trend.
 *   'heating' — recent-window score strictly greater than prior window + epsilon.
 *   'cooling' — recent-window score strictly lower than prior window - epsilon.
 *   'flat'    — delta within epsilon bounds (steady or insufficient data).
 */
export const sellerIntentDirectionEnum = z.enum(['heating', 'cooling', 'flat']);
export type SellerIntentDirection = z.infer<typeof sellerIntentDirectionEnum>;

// ---------------------------------------------------------------------------
// SellerIntentBreakdown (NO tieBreak — SI1)
// ---------------------------------------------------------------------------

/**
 * SellerIntentBreakdown — per-signal contribution to the mandate's intent score.
 *
 * FIELD CONTRACT (SI1 — authoritative):
 *   outreachEngagement — points from outreach_activity completed touches + channel mix + recency (0-40).
 *   pipelineVelocity   — points from pipeline_events stage-progression depth + transitions (0-35).
 *   matchDisposition   — points from match_candidates accepted/flagged vs pending/rejected (0-25).
 *   total              — sum of the three signals above, clamped to [0, 100].
 *   notApplied         — signals with zero data; e.g. 'outreachEngagement: not applied — no data'.
 *
 * ABSENT (SI1): NO tieBreak field. Stable ordering is enforced in the query/service
 *   layer by (created_at, id). tieBreak is noise-as-signal and is NEVER a scored dimension.
 */
export const sellerIntentBreakdownSchema = z
  .object({
    outreachEngagement: z.number().int().min(0).max(40),
    pipelineVelocity: z.number().int().min(0).max(35),
    matchDisposition: z.number().int().min(0).max(25),
    total: z.number().int().min(0).max(100),
    notApplied: z.array(z.string()),
  })
  .passthrough();

export type SellerIntentBreakdown = z.infer<typeof sellerIntentBreakdownSchema>;

// ---------------------------------------------------------------------------
// SellerIntentScore — per-mandate score item
// ---------------------------------------------------------------------------

/**
 * SellerIntentScore — the scored seller-intent record for one mandate.
 *
 * mandateId  — the mandate's UUID (FK → mandates.id).
 * score      — integer in [0, 100]; sum of the three signal scores.
 * breakdown  — per-signal contribution (NO tieBreak — SI1).
 * direction  — windowed trend: 'heating' | 'cooling' | 'flat'.
 *   Derived from (recent-window-score − prior-window-score); |delta| < EPSILON → 'flat'.
 *   WINDOW_DAYS and DIRECTION_EPSILON are deterministic constants in the scorer (SI2).
 */
export const sellerIntentScoreSchema = z
  .object({
    mandateId: z.string().uuid(),
    score: z.number().int().min(0).max(100),
    breakdown: sellerIntentBreakdownSchema,
    direction: sellerIntentDirectionEnum,
  })
  .passthrough();

export type SellerIntentScore = z.infer<typeof sellerIntentScoreSchema>;

// ---------------------------------------------------------------------------
// SellerIntentListResponse — GET /seller-intent response
// ---------------------------------------------------------------------------

/**
 * SellerIntentListResponse — the full list response for GET /seller-intent.
 *
 * Workspace-scoped: every item reflects the caller's firm ONLY (FORCE RLS +
 * app.workspace_id GUC). Ordered by (mandate.created_at, mandate.id) in the
 * service for stable deterministic ordering — NO tieBreak field (SI1).
 *
 * Empty-state safe: returns [] for an empty workspace (no crash).
 */
export const sellerIntentListResponseSchema = z.array(sellerIntentScoreSchema);
export type SellerIntentListResponse = z.infer<typeof sellerIntentListResponseSchema>;
