/**
 * seller-intent.scorer.ts — Pure deterministic seller-intent scoring function.
 *
 * Wave-23 (task 9e54cc11).
 *
 * ── HARD BOUNDARY (CRITICAL) ──────────────────────────────────────────────────
 *   NO Anthropic/Claude/LLM import or call.
 *   NO BullMQ, NO randomness, NO Math.random().
 *   NO Date.now() — recency and the trend window are computed against a
 *     caller-supplied `referenceInstant` (ISO timestamp string) passed in via input.
 *   NO tieBreak as a scored/surfaced dimension (SI1 — PRODUCT #1).
 *
 * ── PURE + DETERMINISTIC ──────────────────────────────────────────────────────
 *   Identical inputs → identical output. No IO, no network, no side effects.
 *   Tests: snapshot (byte-identical output), time-invariance (fixed referenceInstant),
 *   and grep-assert (no Date.now / Math.random in this file).
 *
 * ── SI1: NO tieBreak ──────────────────────────────────────────────────────────
 *   breakdown = { outreachEngagement, pipelineVelocity, matchDisposition, total, notApplied }.
 *   Stable ordering is enforced in the service layer by (mandate.created_at, mandate.id).
 *   tieBreak is noise-as-signal and is NEVER a scored dimension.
 *
 * ── SI2: DIRECTION — PINNED CONSTANTS ────────────────────────────────────────
 *   WINDOW_DAYS = 30      — each trend window is exactly 30 calendar days.
 *   DIRECTION_EPSILON = 5 — |delta| ≤ EPSILON → 'flat'; delta > EPSILON → 'heating'; delta < -EPSILON → 'cooling'.
 *   MS_PER_DAY = 86_400_000 — deterministic constant (NOT Date.now()).
 *   direction = sign of (recentWindowScore − priorWindowScore) with epsilon guard.
 *   Unit-tested at the epsilon boundary.
 *
 * ── SCORING DIMENSIONS (3 signals) ───────────────────────────────────────────
 *   1. outreachEngagement (0-40 pts):
 *        baseScore    = min(completedCount × 5, 25)  — 5 pts per completed, max 25
 *        channelScore = min(uniqueChannels × 3, 12)  — 3 pts per unique channel (max 4 = 12)
 *        recencyBonus = 3 if last-completed within WINDOW_DAYS of referenceInstant,
 *                       1 if within 2×WINDOW_DAYS, 0 otherwise
 *        outreachEngagement = min(baseScore + channelScore + recencyBonus, 40)
 *
 *   2. pipelineVelocity (0-35 pts):
 *        stageScore    = min(maxProgressionDepth × 5, 25) — depths: contacted=1…closed=5
 *        velocityScore = 10 if 3+ stage_changed events, 6 if 2, 3 if 1, 0 if 0
 *        pipelineVelocity = min(stageScore + velocityScore, 35)
 *
 *   3. matchDisposition (0-25 pts):
 *        ratio = (accepted + flagged) / totalCandidates
 *        matchDisposition = round(ratio × 25)
 *
 * ── SIGNAL WEIGHTS ────────────────────────────────────────────────────────────
 *   outreachEngagement (max 40) + pipelineVelocity (max 35) + matchDisposition (max 25) = 100
 *
 * ── EMPTY / SINGLE-EVENT BOUNDARY (SI3) ──────────────────────────────────────
 *   A signal with zero source data contributes 0 points and records the signal name
 *   in breakdown.notApplied. No crash, no div-by-zero.
 *   0 events in both windows → both window scores = 0 → delta = 0 → 'flat'.
 */

import type { SellerIntentBreakdown } from '@dealflow/shared';

// ---------------------------------------------------------------------------
// SI2 — Pinned deterministic constants (unit-tested boundaries in scorer.spec.ts)
// ---------------------------------------------------------------------------

/** Length of each trend comparison window in calendar days (SI2). */
export const WINDOW_DAYS = 30;

/**
 * Minimum absolute delta (in score points) between the recent and prior window
 * to call 'heating' or 'cooling'. A delta within (-EPSILON, +EPSILON) exclusive
 * yields 'flat'. Boundary: delta = EPSILON → 'flat'; delta = EPSILON+1 → 'heating'. (SI2)
 */
export const DIRECTION_EPSILON = 5;

/** Milliseconds per calendar day — deterministic constant, NOT Date.now(). */
export const MS_PER_DAY = 86_400_000;

// ---------------------------------------------------------------------------
// Stage depth map (pipeline_stage enum → progression depth)
// ---------------------------------------------------------------------------

/**
 * STAGE_DEPTH — maps each pipeline_stage enum value to a progression score.
 *   'shortlisted' = 0 (baseline; enrolled but not yet progressed).
 *   'withdrawn'   = -1 (excluded from depth scoring).
 */
const STAGE_DEPTH: Readonly<Record<string, number>> = {
  shortlisted: 0,
  contacted: 1,
  engaged: 2,
  diligence: 3,
  offer: 4,
  closed: 5,
  withdrawn: -1,
};

// ---------------------------------------------------------------------------
// Input types (no Drizzle import — pure types only)
// ---------------------------------------------------------------------------

/**
 * OutreachActivityScorerInput — the outreach_activity row fragment for scoring.
 * Only activities WHERE mandate_id IS NOT NULL AND mandate_id = $mandateId are passed.
 */
export interface OutreachActivityScorerInput {
  status: 'planned' | 'completed' | 'cancelled';
  channel: 'call' | 'email' | 'linkedin' | 'other';
  /** Set when status = 'completed'. NULL otherwise. */
  completedAt: string | null;
  createdAt: string;
}

/**
 * PipelineEventScorerInput — the pipeline_events row fragment for scoring.
 * Pre-joined through pipeline to mandate scope.
 */
export interface PipelineEventScorerInput {
  eventType: 'enrolled' | 'stage_changed' | 'note';
  fromStage: string | null;
  toStage: string | null;
  createdAt: string;
}

/**
 * MatchCandidateScorerInput — the match_candidates row fragment for scoring.
 * Pre-joined through match_run to mandate scope.
 */
export interface MatchCandidateScorerInput {
  disposition: 'pending' | 'accepted' | 'rejected' | 'flagged';
  createdAt: string;
}

/**
 * SellerIntentScorerInput — the full input to scoreMandateIntent.
 *
 * referenceInstant (SI3):
 *   The workspace max-event-ts as an ISO string, derived by the service. Passed IN
 *   so the scorer never calls Date.now() — it is PURE and DETERMINISTIC.
 *   A dormant mandate is scored relative to the most-active workspace timestamp,
 *   making its direction read 'cooling' vs the workspace's most active period.
 *   For a workspace with zero events: service falls back to mandate.createdAt,
 *   yielding empty windows → direction = 'flat' for all mandates (no crash).
 */
export interface SellerIntentScorerInput {
  mandateId: string;
  /** ISO timestamp. NO Date.now() inside scorer — referenceInstant is passed in. */
  referenceInstant: string;
  outreachActivities: OutreachActivityScorerInput[];
  pipelineEvents: PipelineEventScorerInput[];
  matchCandidates: MatchCandidateScorerInput[];
}

/**
 * SellerIntentScorerOutput — the pure scorer output.
 *
 * score      — integer in [0, 100].
 * breakdown  — per-signal breakdown (NO tieBreak — SI1).
 * direction  — windowed trend (SI2: WINDOW_DAYS=30, DIRECTION_EPSILON=5).
 */
export interface SellerIntentScorerOutput {
  score: number;
  breakdown: SellerIntentBreakdown;
  direction: 'heating' | 'cooling' | 'flat';
}

// ---------------------------------------------------------------------------
// Window filter helpers — use Date.parse (deterministic), NOT Date.now()
// ---------------------------------------------------------------------------

/**
 * filterActivitiesByWindow — activities whose effective timestamp
 * (completedAt if set, else createdAt) falls within [startMs, endMs] inclusive.
 *
 * Date.parse(ts) converts a fixed ISO string to epoch ms — deterministic, pure.
 * This is NOT Date.now() — it does NOT return the current time.
 */
function filterActivitiesByWindow(
  activities: OutreachActivityScorerInput[],
  startMs: number,
  endMs: number
): OutreachActivityScorerInput[] {
  return activities.filter((a) => {
    const ts = a.completedAt ?? a.createdAt;
    const t = Date.parse(ts);
    return t >= startMs && t <= endMs;
  });
}

/** filterEventsByWindow — pipeline_events where createdAt is in [startMs, endMs]. */
function filterEventsByWindow(
  events: PipelineEventScorerInput[],
  startMs: number,
  endMs: number
): PipelineEventScorerInput[] {
  return events.filter((e) => {
    const t = Date.parse(e.createdAt);
    return t >= startMs && t <= endMs;
  });
}

/** filterCandidatesByWindow — match_candidates where createdAt is in [startMs, endMs]. */
function filterCandidatesByWindow(
  candidates: MatchCandidateScorerInput[],
  startMs: number,
  endMs: number
): MatchCandidateScorerInput[] {
  return candidates.filter((c) => {
    const t = Date.parse(c.createdAt);
    return t >= startMs && t <= endMs;
  });
}

// ---------------------------------------------------------------------------
// Windowed signal helpers (no recency bonus — window filter is pre-applied)
// ---------------------------------------------------------------------------

/**
 * computeWindowedEngagement — outreachEngagement WITHOUT the recency bonus.
 *
 * The recency bonus is NOT included for windowed comparisons because activities
 * are already filtered to the window boundary. Including it would inflate the
 * recent window artificially and bias the direction delta.
 */
function computeWindowedEngagement(activities: OutreachActivityScorerInput[]): number {
  const completed = activities.filter((a) => a.status === 'completed');
  const baseScore = Math.min(completed.length * 5, 25);
  const uniqueChannels = new Set(completed.map((a) => a.channel)).size;
  const channelScore = Math.min(uniqueChannels * 3, 12);
  return Math.min(baseScore + channelScore, 40);
}

/** computeWindowedVelocity — pipelineVelocity for a filtered event set. */
function computeWindowedVelocity(events: PipelineEventScorerInput[]): number {
  const stageChangedEvents = events.filter((e) => e.eventType === 'stage_changed');
  const validDepths = stageChangedEvents
    .filter(
      (e) =>
        e.toStage !== null &&
        STAGE_DEPTH[e.toStage!] !== undefined &&
        (STAGE_DEPTH[e.toStage!] as number) >= 0
    )
    .map((e) => STAGE_DEPTH[e.toStage!] as number);

  const maxDepth = validDepths.length > 0 ? Math.max(...validDepths) : -1;
  const stageScore = maxDepth >= 0 ? Math.min(maxDepth * 5, 25) : 0;

  const transitionCount = stageChangedEvents.length;
  const velocityScore =
    transitionCount >= 3 ? 10 : transitionCount === 2 ? 6 : transitionCount === 1 ? 3 : 0;

  return Math.min(stageScore + velocityScore, 35);
}

/** computeWindowedDisposition — matchDisposition for a filtered candidate set. */
function computeWindowedDisposition(candidates: MatchCandidateScorerInput[]): number {
  if (candidates.length === 0) return 0;
  const positive = candidates.filter(
    (c) => c.disposition === 'accepted' || c.disposition === 'flagged'
  ).length;
  return Math.round((positive / candidates.length) * 25);
}

/**
 * computeWindowScore — sum of all three windowed signals for pre-filtered data.
 * Used for direction comparison only (not the returned score).
 */
function computeWindowScore(
  activities: OutreachActivityScorerInput[],
  events: PipelineEventScorerInput[],
  candidates: MatchCandidateScorerInput[]
): number {
  return (
    computeWindowedEngagement(activities) +
    computeWindowedVelocity(events) +
    computeWindowedDisposition(candidates)
  );
}

// ---------------------------------------------------------------------------
// scoreMandateIntent — the PURE deterministic scorer
// ---------------------------------------------------------------------------

/**
 * scoreMandateIntent — computes a deterministic seller-intent score and breakdown
 * for a single mandate.
 *
 * PURE: no IO, no LLM, no randomness, NO Date.now(). Same inputs → same output.
 *
 * @param input  — all data for this mandate + the caller-supplied referenceInstant.
 * @returns SellerIntentScorerOutput { score, breakdown (NO tieBreak), direction }
 */
export function scoreMandateIntent(input: SellerIntentScorerInput): SellerIntentScorerOutput {
  const { outreachActivities, pipelineEvents, matchCandidates } = input;

  // Parse referenceInstant once — Date.parse is deterministic (NOT Date.now()).
  const refMs = Date.parse(input.referenceInstant);

  // ──────────────────────────────────────────────────────────────────────────
  // 1. outreachEngagement (0-40 points)
  // ──────────────────────────────────────────────────────────────────────────

  const notApplied: string[] = [];
  let outreachEngagement = 0;

  if (outreachActivities.length === 0) {
    notApplied.push('outreachEngagement: not applied — no outreach activity data');
  } else {
    const completed = outreachActivities.filter((a) => a.status === 'completed');
    const baseScore = Math.min(completed.length * 5, 25);
    const uniqueChannels = new Set(completed.map((a) => a.channel)).size;
    const channelScore = Math.min(uniqueChannels * 3, 12);

    // Recency bonus: based on most-recent completed activity vs referenceInstant.
    // Uses Date.parse (deterministic, pure) — NOT Date.now().
    // Chronological comparison via Date.parse — correct regardless of UTC-offset variation
    // in the returned timestamptz strings (avoids the lexical-order-only-safe-for-UTC bug).
    let recencyBonus = 0;
    if (completed.length > 0) {
      // Seed with the first element's effective ts so the initial accumulator is a valid
      // timestamp — Date.parse('') === NaN, which breaks the >= comparison.
      const seedTs = completed[0]!.completedAt ?? completed[0]!.createdAt;
      const mostRecentTs = completed.slice(1).reduce((best, a) => {
        const ts = a.completedAt ?? a.createdAt;
        return Date.parse(ts) >= Date.parse(best) ? ts : best;
      }, seedTs);
      if (mostRecentTs.length > 0) {
        const daysSince = (refMs - Date.parse(mostRecentTs)) / MS_PER_DAY;
        if (daysSince <= WINDOW_DAYS) {
          recencyBonus = 3;
        } else if (daysSince <= 2 * WINDOW_DAYS) {
          recencyBonus = 1;
        }
      }
    }

    outreachEngagement = Math.min(baseScore + channelScore + recencyBonus, 40);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. pipelineVelocity (0-35 points)
  // ──────────────────────────────────────────────────────────────────────────

  let pipelineVelocity = 0;

  if (pipelineEvents.length === 0) {
    notApplied.push('pipelineVelocity: not applied — no pipeline event data');
  } else {
    const stageChangedEvents = pipelineEvents.filter((e) => e.eventType === 'stage_changed');
    const validDepths = stageChangedEvents
      .filter(
        (e) =>
          e.toStage !== null &&
          STAGE_DEPTH[e.toStage!] !== undefined &&
          (STAGE_DEPTH[e.toStage!] as number) >= 0
      )
      .map((e) => STAGE_DEPTH[e.toStage!] as number);

    const maxDepth = validDepths.length > 0 ? Math.max(...validDepths) : -1;
    const stageScore = maxDepth >= 0 ? Math.min(maxDepth * 5, 25) : 0;

    const transitionCount = stageChangedEvents.length;
    const velocityScore =
      transitionCount >= 3 ? 10 : transitionCount === 2 ? 6 : transitionCount === 1 ? 3 : 0;

    pipelineVelocity = Math.min(stageScore + velocityScore, 35);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. matchDisposition (0-25 points)
  // ──────────────────────────────────────────────────────────────────────────

  let matchDisposition = 0;

  if (matchCandidates.length === 0) {
    notApplied.push('matchDisposition: not applied — no match candidate data');
  } else {
    const positive = matchCandidates.filter(
      (c) => c.disposition === 'accepted' || c.disposition === 'flagged'
    ).length;
    matchDisposition = Math.round((positive / matchCandidates.length) * 25);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Total score (clamped to [0, 100])
  // ──────────────────────────────────────────────────────────────────────────

  const rawTotal = outreachEngagement + pipelineVelocity + matchDisposition;
  const total = Math.max(0, Math.min(100, rawTotal));

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Direction — SI2: windowed delta with pinned constants
  //
  // Windows (using Date.parse for epoch conversion — NOT Date.now()):
  //   recent: [refMs - WINDOW_DAYS × MS_PER_DAY, refMs]               (inclusive)
  //   prior:  [refMs - 2 × WINDOW_DAYS × MS_PER_DAY, recentStart - 1] (exclusive end)
  //
  // delta = recentWindowScore - priorWindowScore
  // direction:
  //   delta > DIRECTION_EPSILON  → 'heating'
  //   delta < -DIRECTION_EPSILON → 'cooling'
  //   otherwise                  → 'flat'
  //
  // SI3: 0 events in both windows → both scores = 0 → delta = 0 → 'flat' (no crash).
  // ──────────────────────────────────────────────────────────────────────────

  const recentWindowStartMs = refMs - WINDOW_DAYS * MS_PER_DAY;
  const priorWindowStartMs = refMs - 2 * WINDOW_DAYS * MS_PER_DAY;
  // Prior window end is exclusive (recentWindowStart - 1 ms) to avoid double-counting.
  const priorWindowEndMs = recentWindowStartMs - 1;

  const recentActs = filterActivitiesByWindow(outreachActivities, recentWindowStartMs, refMs);
  const recentEvts = filterEventsByWindow(pipelineEvents, recentWindowStartMs, refMs);
  const recentCands = filterCandidatesByWindow(matchCandidates, recentWindowStartMs, refMs);
  const recentWindowScore = computeWindowScore(recentActs, recentEvts, recentCands);

  const priorActs = filterActivitiesByWindow(
    outreachActivities,
    priorWindowStartMs,
    priorWindowEndMs
  );
  const priorEvts = filterEventsByWindow(pipelineEvents, priorWindowStartMs, priorWindowEndMs);
  const priorCands = filterCandidatesByWindow(
    matchCandidates,
    priorWindowStartMs,
    priorWindowEndMs
  );
  const priorWindowScore = computeWindowScore(priorActs, priorEvts, priorCands);

  const delta = recentWindowScore - priorWindowScore;
  const direction: 'heating' | 'cooling' | 'flat' =
    delta > DIRECTION_EPSILON ? 'heating' : delta < -DIRECTION_EPSILON ? 'cooling' : 'flat';

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Return — breakdown has NO tieBreak (SI1)
  // ──────────────────────────────────────────────────────────────────────────

  const breakdown: SellerIntentBreakdown = {
    outreachEngagement,
    pipelineVelocity,
    matchDisposition,
    total,
    notApplied,
  };

  return { score: total, breakdown, direction };
}
