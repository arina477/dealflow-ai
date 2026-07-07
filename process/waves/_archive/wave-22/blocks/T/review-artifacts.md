# Wave 22 — T-block review artifacts (test-hygiene wave)
**Wave topic:** scope the 12 unscoped audit assertions in outreach-activity-rls.e2e-spec.ts by workspace_id (T-4 rule 2) — CI-verified green @c168d3a
**wave_type:** [test-hygiene] — no product surface; the deliverable IS a test-reliability fix, CI-verified
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28850000460 lint+typecheck @c168d3a GREEN |
| T-2 | unit/integration | A (CI) | done | **outreach-activity-rls.e2e ran 9/9 (not skipped) with SCOPED assertions** on postgres:18 — the flake-fix verification; stable + fault-killing |
| T-3..T-7 | contract/e2e/layout/perf | — | N/A | test-only change; no new code/API/UI/perf surface |
| T-8 | security | active | done | the fix PRESERVES the audit-isolation invariant (workspace-scoped, exact +1 / exact verb — fault-killing) + STRENGTHENS test reliability (immune to concurrent-suite pollution per T-4 rule 2). Directly enforces the promoted principle. |
| T-9 | journey | active | pending | head-tester gate: confirm the test-fix CI-verified + fault-killing-preserved + no coverage gap |
