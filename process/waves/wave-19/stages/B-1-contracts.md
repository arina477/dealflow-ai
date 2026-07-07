# Wave 19 — B-1 Contracts (shared match-feedback calibration)

**Task:** 69387b56 | **Commit:** 764c51c | **Status:** done

## Files delivered

- `packages/shared/src/match-feedback.ts` — new file (CalibrationSummary, CalibrationBand, DimensionLift, DimensionLiftHalf, FitScoreBand Zod schemas + TS types)
- `packages/shared/src/index.ts` — re-exports wired
- `packages/shared/src/rbac.ts` — `/match-feedback` route entry added (advisor+admin)

## Shape summary

**CalibrationSummary** (GET /match-feedback response):
- `totalDecided: number` — total decided (accepted+rejected) candidates across all bands
- `bands: CalibrationBand[]` — 4 entries for fit_score quartile bands (0-25, 26-50, 51-75, 76-100)
- `dimensionLifts: DimensionLift[]` — 3 entries (sectorMatch, contactCompleteness, tieBreak)

**CalibrationBand**:
- `band: FitScoreBand` — which quartile
- `decidedCount: number` — decided (accepted+rejected) count in band (denominator)
- `acceptedCount: number` — accepted count in band
- `acceptRate: number | null` — G2 convention applied

**DimensionLift**: `dimension` + `high: DimensionLiftHalf` + `low: DimensionLiftHalf`

**DimensionLiftHalf**: `cohort ('high'|'low')` + `decidedCount` + `acceptedCount` + `acceptRate: number | null`

## G2 null-vs-zero convention (pinned at contract layer)

`acceptRate: number | null`:
- `null` — 0 decided candidates in the band/cohort (insufficient data → UI "n/a"). Not a 0% outcome.
- `0` — decided > 0 but 0 accepted (real 0% → UI "0%"). A measured outcome.

Encoded in Zod as `z.number().min(0).max(1).nullable()` on both CalibrationBand and DimensionLiftHalf.

## Decided-only denominator

Only `disposition IN ('accepted', 'rejected')` count toward accept-rate denominators. Pending/flagged excluded (unresolved decisions — including them would dilute the rate misleadingly). Documented in schema JSDoc.

## RBAC

`/match-feedback` → `['advisor', 'admin']` in `roleRoutes`. No navItem (API-only, rendered as /insights section by B-3). Mirrors `/analytics` pattern.

## Karen watch-item (per-row exclusion)

Documented in `DimensionLift` schema JSDoc: rows where `score_breakdown IS NULL` or dimension key absent are excluded per-row from both cohorts for that dimension. Service applies per-row exclusion, not assume-non-null.

## Typecheck

`pnpm -w typecheck`: CLEAN.

## Deviations

None. All P-4 B-BLOCK OBLIGATIONS for B-1 honored.
