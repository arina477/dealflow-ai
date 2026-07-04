# Wave 10 — V-3 Fast-fix (F-1 score_breakdown render)
V-1 Medium F-1 (score_breakdown drawer rendered blank/NaN — write/read shape drift) → FIXED (4b70249 UI + 3b581c4 API reconcile + cf71da8 fixture). The scorer's real ScoreBreakdown shape (flat: sectorMatch/contactCompleteness/tieBreak/total/notApplied) is now: shared scoreBreakdownSchema (typed) + drizzle jsonb .$type<ScoreBreakdown> (API reconcile, Option A) + the UI drawer renders real per-dimension bars + "not applied" rows (no NaN, rule-based framing, AI-strip holds).
## CI-RED RECOVERY (orchestrator process lesson): the F-1 shared-schema tightening had a CROSS-PACKAGE blast radius — I pushed after a single-package (web) local verify; the API service typecheck + an API fixture broke. Fixed forward (Option A $type + fixture notApplied). LESSON: a shared-package schema change MUST be verified with FULL `pnpm -r typecheck && pnpm -r test` (all packages) before push — a web-only verify masks API breakage (+ turbo/vitest cache can mask it locally too — CI runs fresh). Main restored green @ cf71da8.

## V-3 CLOSE (F-1 live-verified @ 57449b6)
head-ci-cd PASS: score_breakdown drawer renders REAL per-dimension values (Sector 30/60, Contact 30/30, Tie-break 9/10, gauge 69) — ZERO NaN; not-applied path correct; AI-strip holds (rule-based, no AI-capability phrases); matching-flow regression green (create-run + scorer-discriminates [69,62,61,61] + disposition-accept-sticks-across-re-run + handoff-guard + RBAC). deployed=verified @ 57449b6.
## Carry-forward (test-fix, non-blocking): the T-5 matches-shortlist.spec.ts calls the API origin cross-origin (401/404) → never exercised the scored ranked-list/drawer path (passed via soft assertions). Fix the E2E to route through the web-origin /matches-data proxy + rid header (real scored-path coverage). → backlog/next-wave test-maintenance.
```yaml
fast_fix_verdict: CLOSE
fast_fix_queue_resolved: [F-1-score_breakdown-render]
deployed_equals_verified: true
deploy: 57449b6
carry_forward: [t5-e2e-web-origin-proxy-test-fix]
