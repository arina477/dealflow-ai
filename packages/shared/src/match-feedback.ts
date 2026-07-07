import { z } from 'zod';

/**
 * Wave-19 match-feedback calibration shared contracts (B-1, task 69387b56).
 *
 * Covers the calibration response shape for GET /match-feedback.
 *
 * ── CALIBRATION OVERVIEW ─────────────────────────────────────────────────────
 * The calibration surface answers: "Does a higher fit_score actually predict
 * advisor acceptance?" It does this through two complementary views:
 *
 *   1. Overall calibration — accept-rate bucketed by fit_score band.
 *      Bands: 0-25, 26-50, 51-75, 76-100 (four equal quartile-like bands).
 *      acceptRate = accepted / decided (decided = accepted + rejected only;
 *      pending/flagged are EXCLUDED from the denominator — they are not
 *      decisions yet).
 *
 *   2. Per-dimension lift — for each score_breakdown dimension
 *      (sectorMatch / contactCompleteness), the accept-rate for candidates in
 *      the "high" half vs "low" half of that dimension's range.
 *      Each half is computed over decided candidates only (same denominator rule).
 *
 *      NOTE: tieBreak is intentionally EXCLUDED from the lift surface.
 *      tieBreak = deterministicTieBreak(candidate.id) — a pure hash of the row
 *      ID, uncorrelated with acceptance by construction. Any apparent lift on
 *      tieBreak is a sampling artifact (noise), not a signal. Surfacing it to
 *      M&A advisors as a "dimension lift" would be misleading (CODE-OF-CONDUCT
 *      §metric). Only genuinely-predictive dimensions are included here.
 *
 * ── G2: NULL-VS-ZERO CONVENTION (load-bearing) ───────────────────────────────
 * acceptRate is `number | null` — the distinction is deliberate and semantic:
 *
 *   null   — 0 DECIDED candidates in the band/cohort (insufficient data).
 *            UI must render "n/a" — this is a measurement-gap, not a 0% outcome.
 *
 *   0      — decided > 0 but 0 accepted (real 0% accept rate).
 *            UI must render "0%" — this is a real outcome, not a data gap.
 *
 * Both shapes are explicitly represented in CalibrationBand.acceptRate and
 * DimensionLiftHalf.acceptRate so the UI can render honestly. Conflating them
 * (returning 0 for both) would be a misleading metric (CODE-OF-CONDUCT §metric).
 *
 * ── DECIDED-ONLY DENOMINATOR (load-bearing) ───────────────────────────────────
 * ONLY candidates with disposition IN ('accepted', 'rejected') count toward
 * accept-rate denominators. Pending and flagged are excluded — they represent
 * unresolved decisions and including them would dilute the rate misleadingly.
 * The decidedCount field carries the denominator so the UI can show confidence.
 *
 * ── READ-ONLY ────────────────────────────────────────────────────────────────
 * This shape is returned by GET /match-feedback. No writes, no LLM/ML.
 *
 * All schemas use .passthrough() (server may add fields without client break).
 */

// ---------------------------------------------------------------------------
// Fit-score band identifiers
// ---------------------------------------------------------------------------

/**
 * FitScoreBand — the four score bands for overall calibration bucketing.
 *
 *   '0-25'   — fit_score in [0, 25]
 *   '26-50'  — fit_score in [26, 50]
 *   '51-75'  — fit_score in [51, 75]
 *   '76-100' — fit_score in [76, 100]
 */
export const fitScoreBandEnum = z.enum(['0-25', '26-50', '51-75', '76-100']);
export type FitScoreBand = z.infer<typeof fitScoreBandEnum>;

// ---------------------------------------------------------------------------
// C1 — Overall calibration band
// ---------------------------------------------------------------------------

/**
 * CalibrationBand — accept-rate for a single fit_score band.
 *
 * band         — which fit_score quartile this row covers.
 * decidedCount — count of DECIDED candidates (accepted + rejected) in this band.
 *                Pending/flagged are excluded. This is the denominator.
 * acceptedCount — count of accepted candidates in this band.
 * acceptRate   — acceptedCount / decidedCount.
 *                null  → decidedCount = 0 (no decisions → "n/a" in UI).
 *                0     → decidedCount > 0 but acceptedCount = 0 (real 0%).
 *
 * (G2 null-vs-zero convention applies — see file header.)
 */
export const calibrationBandSchema = z
  .object({
    band: fitScoreBandEnum,
    /** Count of decided (accepted + rejected) candidates in this band. */
    decidedCount: z.number().int().min(0),
    /** Count of accepted candidates in this band. */
    acceptedCount: z.number().int().min(0),
    /**
     * G2: null = 0 decided (insufficient data → UI "n/a");
     *     0    = decided > 0 but 0 accepted (real 0% → UI "0%").
     */
    acceptRate: z.number().min(0).max(1).nullable(),
  })
  .passthrough();

export type CalibrationBand = z.infer<typeof calibrationBandSchema>;

// ---------------------------------------------------------------------------
// C2 — Per-dimension lift (one half of a dimension)
// ---------------------------------------------------------------------------

/**
 * DimensionLiftHalf — accept-rate for a single cohort within one score dimension.
 *
 * cohort       — 'high' (dimension value above the midpoint) or 'low' (at or below).
 * decidedCount — decided candidates in this cohort (denominator).
 * acceptedCount — accepted candidates in this cohort.
 * acceptRate   — acceptedCount / decidedCount.
 *                null  → decidedCount = 0 (no decisions → "n/a").
 *                0     → decided > 0 but 0 accepted (real 0%).
 */
export const dimensionLiftHalfSchema = z
  .object({
    cohort: z.enum(['high', 'low']),
    decidedCount: z.number().int().min(0),
    acceptedCount: z.number().int().min(0),
    /**
     * G2: null = 0 decided (insufficient data → UI "n/a");
     *     0    = decided > 0 but 0 accepted (real 0% → UI "0%").
     */
    acceptRate: z.number().min(0).max(1).nullable(),
  })
  .passthrough();

export type DimensionLiftHalf = z.infer<typeof dimensionLiftHalfSchema>;

/**
 * DimensionLift — accept-rate lift for one score_breakdown dimension.
 *
 * dimension — one of the TWO genuinely-predictive scored dimensions:
 *               sectorMatch           — sector alignment score (0..60)
 *               contactCompleteness   — contact data quality score (0..30)
 *
 *             tieBreak is intentionally absent: it is a deterministic hash of
 *             the candidate row ID and is uncorrelated with acceptance by
 *             construction. Including it would present noise as signal to M&A
 *             advisors (CODE-OF-CONDUCT §metric — metric honesty).
 *
 * high      — cohort with dimension value above the midpoint.
 * low       — cohort with dimension value at or below the midpoint.
 *
 * Cohort-split semantics (not a median split):
 *   sectorMatch:          midpoint = 30  → high = exact-sector match (score 31..60);
 *                                          low  = partial/no sector match (score 0..30)
 *   contactCompleteness:  midpoint = 15  → high = full contact data (score 16..30);
 *                                          low  = partial/no contact data (score 0..15)
 *
 *   These are "perfect vs everything-else" thresholds, not median-of-observed-data
 *   splits. The midpoint is fixed at half the domain max, not computed per-query.
 *   Either cohort may be empty on small datasets (decidedCount=0 → acceptRate=null
 *   per G2 — no crash, no misleading 0%).
 *
 * Per-row exclusion (karen watch-item): rows where score_breakdown is NULL or
 * where the named dimension is absent are excluded from BOTH cohorts. The
 * service applies per-row exclusion — it does NOT assume score_breakdown is
 * always non-null (schema-nullable). This means decidedCount here may be lower
 * than the overall calibration's decidedCount if some rows lack breakdowns.
 */
export const dimensionLiftSchema = z
  .object({
    /** Which score_breakdown field this lift row covers (sectorMatch | contactCompleteness). */
    dimension: z.enum(['sectorMatch', 'contactCompleteness']),
    high: dimensionLiftHalfSchema,
    low: dimensionLiftHalfSchema,
  })
  .passthrough();

export type DimensionLift = z.infer<typeof dimensionLiftSchema>;

// ---------------------------------------------------------------------------
// CalibrationSummary — top-level response shape
// ---------------------------------------------------------------------------

/**
 * CalibrationSummary — the GET /match-feedback response shape.
 *
 * Workspace-scoped: reflects only the caller's firm's match_candidates
 * (FORCE RLS + app.workspace_id GUC — M8 isolation invariant).
 *
 * totalDecided — total decided candidates across ALL bands (convenience total).
 *   0 → empty workspace or all pending/flagged (all band acceptRates will be null).
 *
 * bands — four CalibrationBand rows (0-25, 26-50, 51-75, 76-100).
 *   Always exactly 4 entries; bands with no decided candidates have acceptRate=null.
 *
 * dimensionLifts — two DimensionLift rows (sectorMatch, contactCompleteness).
 *   Always exactly 2 entries; cohorts with no decided candidates have acceptRate=null.
 *   tieBreak is intentionally excluded (pure hash of row ID — noise, not signal).
 *   Rows where score_breakdown is NULL or dimension is absent are excluded per-row
 *   (karen watch-item: no assume-non-null).
 *
 * Empty-state safe:
 *   Empty workspace / 0 decided → totalDecided=0, all acceptRate=null.
 *   0 decided in a band → acceptRate=null for that band (not 0 — see G2).
 */
export const calibrationSummarySchema = z
  .object({
    /** Total DECIDED (accepted + rejected) candidates across all bands. */
    totalDecided: z.number().int().min(0),
    /** Four band rows covering fit_score [0-25, 26-50, 51-75, 76-100]. */
    bands: z.array(calibrationBandSchema),
    /**
     * Two dimension-lift rows (sectorMatch, contactCompleteness).
     * tieBreak excluded — it is a hash of row ID (noise, not signal).
     * Rows with null/absent score_breakdown are excluded per-row (per-row exclusion
     * — karen watch-item). Each row applies per-row exclusion independently.
     */
    dimensionLifts: z.array(dimensionLiftSchema),
  })
  .passthrough();

export type CalibrationSummary = z.infer<typeof calibrationSummarySchema>;
