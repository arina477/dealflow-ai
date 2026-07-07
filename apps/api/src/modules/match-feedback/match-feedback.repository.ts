/**
 * MatchFeedbackRepository — workspace-scoped calibration queries over match_candidates.
 *
 * Wave-19 (task 5568ad44 / e206a56a).
 *
 * ── WORKSPACE-ISOLATION INVARIANT (load-bearing) ─────────────────────────────
 * EVERY query in this repository uses getDb(this.db) — the ALS request-handle
 * bound to the per-request dedicated pg Client that has had
 *   SELECT set_config('app.workspace_id', $wsId, false)
 * called on it by WorkspaceInterceptor. Under dealflow_app (NOSUPERUSER FORCE RLS)
 * this GUC causes every row-level security policy to filter by workspace_id.
 *
 * NEVER use this.db directly in a query method — that would use the module-level
 * Drizzle singleton (no GUC set → all tenant rows returned → cross-firm calibration
 * leak, undoing the M8/wave-18 isolation layer).
 *
 * ── READ-ONLY ────────────────────────────────────────────────────────────────
 * This repository has ZERO writes. No INSERT, UPDATE, DELETE. No audit row.
 *
 * ── DECIDED-ONLY DENOMINATOR ─────────────────────────────────────────────────
 * ONLY candidates with disposition IN ('accepted', 'rejected') count toward
 * accept-rate denominators. Pending and flagged are excluded.
 *
 * ── G2 NULL-VS-ZERO ──────────────────────────────────────────────────────────
 * acceptRate = null  when decidedCount = 0 (no data → UI "n/a").
 * acceptRate = 0     when decidedCount > 0 but acceptedCount = 0 (real 0%).
 *
 * ── KAREN WATCH-ITEM: PER-ROW EXCLUSION ──────────────────────────────────────
 * score_breakdown is schema-NULLABLE (matchCandidates.scoreBreakdown has no
 * .notNull()). The dimension-lift query applies per-row exclusion: rows where
 * score_breakdown is NULL, or where the named dimension key is absent/null,
 * are excluded entirely from both cohorts for that dimension. No assume-non-null.
 * This is enforced via SQL JSONB field extraction with NULLIF / IS NOT NULL guards.
 */

import type { CalibrationBand, DimensionLift, DimensionLiftHalf, FitScoreBand } from '@dealflow/shared';
import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import type { Database } from '../../db/db.provider';
import { DB } from '../../db/db.provider';
import { matchCandidates } from '../../db/schema/matching';
import { getDb } from '../../db/workspace-context';

// ---------------------------------------------------------------------------
// Band boundary constants
// ---------------------------------------------------------------------------

/** Four fit_score bands for overall calibration. */
const BANDS: Array<{ band: FitScoreBand; lo: number; hi: number }> = [
  { band: '0-25', lo: 0, hi: 25 },
  { band: '26-50', lo: 26, hi: 50 },
  { band: '51-75', lo: 51, hi: 75 },
  { band: '76-100', lo: 76, hi: 100 },
];

/** The three scored dimensions from score_breakdown. */
const DIMENSIONS = ['sectorMatch', 'contactCompleteness', 'tieBreak'] as const;
type Dimension = (typeof DIMENSIONS)[number];

/** Midpoint for each dimension (used to split high vs low cohort). */
const DIMENSION_MAX: Record<Dimension, number> = {
  sectorMatch: 60,       // 0, 20, 30, 60 — midpoint 30
  contactCompleteness: 30, // 0, 15, 30 — midpoint 15
  tieBreak: 10,          // 0..10 — midpoint 5
};

const DIMENSION_MIDPOINT: Record<Dimension, number> = {
  sectorMatch: DIMENSION_MAX.sectorMatch / 2,
  contactCompleteness: DIMENSION_MAX.contactCompleteness / 2,
  tieBreak: DIMENSION_MAX.tieBreak / 2,
};

@Injectable()
export class MatchFeedbackRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  // ---------------------------------------------------------------------------
  // Overall calibration — accept-rate by fit_score band
  // ---------------------------------------------------------------------------

  /**
   * getBandCalibration — computes accept-rate by fit_score band.
   *
   * Uses getDb(this.db) → GUC-set dedicated client → FORCE RLS applies →
   * only workspace-scoped match_candidates returned.
   *
   * DECIDED-ONLY: WHERE disposition IN ('accepted', 'rejected').
   * Pending/flagged excluded from denominator.
   *
   * One GROUP-BY query: fit_score band × disposition, then aggregate in JS.
   *
   * G2 null-vs-zero: acceptRate=null when decidedCount=0; 0 when decided>0 but accepted=0.
   *
   * Returns exactly 4 CalibrationBand rows (one per band).
   */
  async getBandCalibration(): Promise<CalibrationBand[]> {
    // Single query: fetch disposition + fit_score for all decided candidates.
    // We aggregate in JS (avoids complex SQL CASE-WHEN band construction while
    // staying correct under FORCE RLS via getDb).
    const rows = await getDb(this.db)
      .select({
        fitScore: matchCandidates.fitScore,
        disposition: matchCandidates.disposition,
      })
      .from(matchCandidates)
      .where(inArray(matchCandidates.disposition, ['accepted', 'rejected']));

    // Accumulate per-band counts.
    const bandCounts = new Map<
      FitScoreBand,
      { decidedCount: number; acceptedCount: number }
    >(
      BANDS.map(({ band }) => [band, { decidedCount: 0, acceptedCount: 0 }])
    );

    for (const row of rows) {
      const score = Number(row.fitScore);
      const band = bandForScore(score);
      if (!band) continue; // score out of [0,100] — guard (schema CHECK enforces, but be safe)
      const acc = bandCounts.get(band)!;
      acc.decidedCount += 1;
      if (row.disposition === 'accepted') acc.acceptedCount += 1;
    }

    return BANDS.map(({ band }) => {
      const { decidedCount, acceptedCount } = bandCounts.get(band)!;
      // G2: null when no decided data; 0 when decided > 0 but none accepted.
      const acceptRate: number | null =
        decidedCount === 0 ? null : acceptedCount / decidedCount;
      return { band, decidedCount, acceptedCount, acceptRate };
    });
  }

  // ---------------------------------------------------------------------------
  // Per-dimension lift
  // ---------------------------------------------------------------------------

  /**
   * getDimensionLifts — per-dimension accept-rate lift (high vs low cohort).
   *
   * Uses getDb(this.db) → FORCE RLS → workspace-scoped.
   *
   * KAREN WATCH-ITEM (per-row exclusion): rows where score_breakdown IS NULL or
   * the named dimension key is absent/null are excluded per-row for that dimension.
   * We fetch score_breakdown as raw JSON and apply exclusion in JS — correct and
   * avoids relying on JSONB operators that could error on null shapes.
   *
   * For each dimension, candidates are split into two cohorts by the dimension
   * value relative to the midpoint:
   *   high — dimension value > midpoint
   *   low  — dimension value <= midpoint
   *
   * Only decided candidates (accepted + rejected) are counted. Pending/flagged
   * are excluded.
   *
   * G2 null-vs-zero: acceptRate=null when cohort decidedCount=0.
   *
   * Returns exactly 3 DimensionLift rows (one per dimension).
   */
  async getDimensionLifts(): Promise<DimensionLift[]> {
    // Fetch disposition + score_breakdown for all decided candidates.
    // score_breakdown may be null (schema-nullable) — handled per-row in JS.
    const rows = await getDb(this.db)
      .select({
        disposition: matchCandidates.disposition,
        scoreBreakdown: matchCandidates.scoreBreakdown,
      })
      .from(matchCandidates)
      .where(inArray(matchCandidates.disposition, ['accepted', 'rejected']));

    // Per-dimension accumulation.
    type DimCohort = { high: { decided: number; accepted: number }; low: { decided: number; accepted: number } };
    const dimCounts = new Map<Dimension, DimCohort>(
      DIMENSIONS.map((dim) => [
        dim,
        { high: { decided: 0, accepted: 0 }, low: { decided: 0, accepted: 0 } },
      ])
    );

    for (const row of rows) {
      const breakdown = row.scoreBreakdown;
      // KAREN WATCH-ITEM: per-row exclusion — skip entirely if score_breakdown is null.
      if (breakdown == null) continue;

      for (const dim of DIMENSIONS) {
        const rawVal = (breakdown as Record<string, unknown>)[dim];
        // Per-row exclusion: skip this row for this dimension if the field is absent/null/non-number.
        if (rawVal == null || typeof rawVal !== 'number') continue;

        const dimVal = rawVal as number;
        const midpoint = DIMENSION_MIDPOINT[dim];
        const cohort = dimVal > midpoint ? 'high' : 'low';
        const acc = dimCounts.get(dim)!;
        acc[cohort].decided += 1;
        if (row.disposition === 'accepted') acc[cohort].accepted += 1;
      }
    }

    return DIMENSIONS.map((dimension) => {
      const counts = dimCounts.get(dimension)!;
      return {
        dimension,
        high: liftHalf('high', counts.high.decided, counts.high.accepted),
        low: liftHalf('low', counts.low.decided, counts.low.accepted),
      };
    });
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Map a fit_score integer to its FitScoreBand. Returns null for out-of-range values. */
function bandForScore(score: number): FitScoreBand | null {
  if (score <= 25) return '0-25';
  if (score <= 50) return '26-50';
  if (score <= 75) return '51-75';
  if (score <= 100) return '76-100';
  return null;
}

/** Build a DimensionLiftHalf with G2 null-vs-zero acceptRate. */
function liftHalf(cohort: 'high' | 'low', decidedCount: number, acceptedCount: number): DimensionLiftHalf {
  const acceptRate: number | null = decidedCount === 0 ? null : acceptedCount / decidedCount;
  return { cohort, decidedCount, acceptedCount, acceptRate };
}
