# Wave 26 — T-block review artifacts (docs + preflight wave)
**Wave topic:** M10 FINAL-hardening — RLS connection-split deploy contract + assertUrlsDistinct startup preflight. LIVE @0825370, app booted past both startup guards. | **Block exit gate:** T-9
**wave_type:** docs/devops-hardening + a small startup preflight | **T-8 Security stage: applies (security-adjacent — [RLS-GUARD]/preflight)**
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28889547491 lint+typecheck @0825370 GREEN |
| T-2 | unit | A (CI) | done | url-distinct-preflight.spec (PREFLIGHT-1/2/3) RAN+PASSED; [RLS-GUARD] RLS suite green (MG1 frozen); 2427 pass / 0 fail |
| T-3..T-7 | contract/e2e/layout/perf | N/A | done | docs + a startup assertion; no new API/UI/perf surface |
| T-8 | security (adjacent) | active | pending | head-tester: [RLS-GUARD] frozen + preflight boot-safe + the contract/AC concrete; the app-booted-past-both-guards prod proof; secret-grep |
| T-9 | journey | active | pending | head-tester gate |
