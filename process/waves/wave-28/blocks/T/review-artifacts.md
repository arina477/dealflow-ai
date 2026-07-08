# Wave 28 — T-block review artifacts (SECURITY-SCOPE-TIGHTENED-light; product-feature + UI)
**Wave topic:** M10 RETENTION policy — RLS config table + RBAC/RLS API (audit-logged, WORM-preserving) + settings UI. LIVE @775cd67, migration 0020 applied to prod. | **Block exit gate:** T-9
**wave_type:** product-feature + UI | **T-8 Security: MANDATORY (RLS-config-isolation + WORM-preservation)**
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28927123301 lint+typecheck @775cd67 GREEN |
| T-2 | unit | A (CI) | done | api 1123 + web 956 + shared 509 pass, 0 skip/fail |
| T-3 | contract | A (CI) | done | retention.ts .strict (no workspace_id) + retention.policy.updated audit-enum |
| T-4 | integration/DB | A (CI) | done | **migration 0020 APPLIED + RLS enforcing (log shows workspace_isolation REJECTING a foreign-workspace write); RET-ISO (firm A≠firm B config, foreign-write-rejected as dealflow_app) + RET-WORM (verifyChain ok:true after config change) RAN+PASSED (20 tests, not skipped)** |
| T-5 | e2e | A (CI) | done | web retention page tests (56 new, incl no-purge-control asserts) |
| T-6/T-7 | layout/perf | partial | done | UI adopted D-3 design; perf N/A |
| T-8 | SECURITY (MANDATORY-tightened) | active | pending | head-tester: RLS-config-isolation + WORM-preservation-no-purge genuinely tested; RBAC; secret-grep |
| T-9 | journey | active | pending | head-tester gate: +/compliance/retention |
