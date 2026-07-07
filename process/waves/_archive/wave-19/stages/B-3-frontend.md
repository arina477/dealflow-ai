# Wave 19 — B-3-frontend
CalibrationSection on the existing /insights page (no new route): 4-band table + 3-dimension-lift table; G2 honest rendering (null→n/a vs 0→0.0%, non-conflation asserted); empty/error states; RBAC via assertRole('/insights'); /match-feedback proxy rewrite; NO charts-lib/real-time/export. Commit 3e66359. Web typecheck clean; 767 pass (18 calibration + 8 RBAC). Deviations: none.
```yaml
skipped: false
deviations: []
```

## B-6 review fix

/review adversarial pass found two metric-honesty gaps (CODE-OF-CONDUCT §metric). Both fixed in `apps/web/app/(app)/insights/page.tsx`:

1. **tieBreak row removed** — `dimensionLabel()` `'tieBreak'` case dropped; comment updated from "3 per-dimension lifts (sectorMatch/contactCompleteness/tieBreak)" to 2. The rendering was already data-driven (`calibration.dimensionLifts.map`); the fixture in `page.test.tsx` already excluded tieBreak. The "renders all 3 score dimension labels" test was renamed + the `queryByText(/tie-break/i)` now asserts `.toBeNull()`.

2. **Small-sample honesty caveat** — added `LOW_SAMPLE_THRESHOLD = 5` constant and `fmtAcceptRateWithCaveat(rate, decidedCount)` helper. When `decidedCount < 5` (and `rate !== null`): rate cell shows `"X.X% (n=N)"` and color is set to `#9ca3af` (zinc-400, muted — not confident emerald). Applies to both the 4 fit_score bands AND both halves of every dimension-lift cohort. G2 null→"n/a" path is unchanged (decidedCount=0 yields null acceptRate, rendered as plain "n/a" with no `(n=0)` annotation).

New tests added in the B-6 describe block: tieBreak absent; exactly 2 dimensions render; `(n=X)` annotation present on low-sample cells; no annotation when decidedCount≥5; G2 null path unaffected.

Web typecheck: clean. Tests: 773 pass (6 new). Deviations: none.
