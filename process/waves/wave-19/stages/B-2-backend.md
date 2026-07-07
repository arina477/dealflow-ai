# Wave 19 — B-2-backend
MatchFeedbackService + repository (getDb on EVERY query — no raw off-GUC; decided-only denominators; G2 null-vs-zero; karen per-row-exclusion for nullable score_breakdown) + MatchFeedbackController GET /match-feedback (@Roles advisor+admin, 403/401) + module registered. Commit ac303d6. G1 cross-firm e2e (match-feedback-isolation.e2e): REAL MatchFeedbackService via workspaceAls.run as dealflow_app (MFC-1..4), MFC-4 fault-killing (getDb→raw collapses totals → fails), NOT re-implemented SQL — the wave-18 hollow-test lesson pre-empted. 22 unit (empty-state null path, decided-but-0-accepted 0 path, per-row-exclusion null-breakdown, RBAC). Deviations: none.
```yaml
skipped: false
deviations: []
```

## B-6 review fix

**Finding: tieBreak noise dimension dropped from per-dimension lift (metric honesty).**

`tieBreak = deterministicTieBreak(candidate.id)` is a pure hash of the row ID — uncorrelated with acceptance by construction. Presenting a tieBreak lift to M&A advisors invited them to read signal into sampling noise, a CODE-OF-CONDUCT §metric violation.

Changes:
- `packages/shared/src/match-feedback.ts`: `dimension` enum narrowed from `'sectorMatch' | 'contactCompleteness' | 'tieBreak'` to `'sectorMatch' | 'contactCompleteness'`. `CalibrationSummary.dimensionLifts` comment updated (3→2 entries). `DimensionLift` JSDoc updated with tieBreak-exclusion rationale and explicit cohort-split semantics documentation.
- `apps/api/src/modules/match-feedback/match-feedback.repository.ts`: `DIMENSIONS` constant reduced from 3 to 2 entries. `DIMENSION_MAX` / `DIMENSION_MIDPOINT` records updated accordingly. Added `DIMENSIONS` declaration comment (tieBreak exclusion rationale) and `DIMENSION_MIDPOINT` block comment documenting the cohort-split semantics as "domain midpoint, not a median of observed data" — high/low thresholds and null-safety on empty cohorts confirmed.
- `apps/api/src/modules/match-feedback/match-feedback.spec.ts`: `makeRepo()` default emptyLifts reduced from 3→2 entries (tieBreak removed). Test A-4 updated to `toHaveLength(2)` + asserts tieBreak absent. Test D-2 mock reduced to 2 entries. Tests per-row-C1 and per-row-C2 mocks reduced to 2 entries.
- `apps/api/test/match-feedback-isolation.e2e-spec.ts`: MFC-3 updated to `toHaveLength(2)` + asserts `not.toContain('tieBreak')`.
- `apps/web/app/(app)/insights/page.test.tsx` (typecheck fix): POPULATED_CALIBRATION and EMPTY_CALIBRATION fixtures reduced to 2 dimension entries (tieBreak removed). G2 null-cohort test case moved to sectorMatch high cohort. Test comment updated.

Cohort-split semantics confirmed non-degenerate on tiny data: an empty cohort yields `decidedCount=0` → `acceptRate=null` (G2 null path) — no division by zero, no crash.

Typecheck: clean (`pnpm -w typecheck` — 4/4 tasks pass).
Unit tests: 22/22 match-feedback tests pass.
Deviations: none from directive. Frontend page.test.tsx fixture updated here (typecheck prerequisite) — the UI component's tieBreak row removal and small-sample caveat label remain for the frontend fix-up pass.
