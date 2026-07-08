# Wave 29 — T-block review artifacts (product-feature + UI; security-adjacent)
**Wave topic:** M10 records-VIEW deal-activity browse — paginated RLS-scoped READ-ONLY API + /compliance/audit-log scope/tab. LIVE @8526999 (LAST M10 light vertical). | **Block exit gate:** T-9
**wave_type:** product-feature + UI | **T-8 Security: RLS-browse-isolation + READ-ONLY + advisor-RBAC**
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28931715146 lint+typecheck @8526999 GREEN |
| T-2 | unit | A (CI) | done | api 1017 + web 989; DA-* 14 tests |
| T-3 | contract | A (CI) | done | dealActivityBrowseFilterSchema .strict (no workspace_id, limit max 50) |
| T-4 | integration/DB | A (CI) | done | **DA-ISO (firm A browse=0 firm B, as dealflow_app) + DA-RBAC (advisor/analyst→403) + DA-RO (audit-count unchanged) + DA-PAGE RAN+PASSED in CI (14 tests, 1501ms real-DB, NOT skipped/ghost-green — DB-unreachable warnings absent)** |
| T-5 | e2e | A (CI) | done | web scope/tab tests (38 new incl advisor-isolation + read-only-boundary) |
| T-6/T-7 | layout/perf | partial | done | UI reuses AuditLogTable (D-SKIP); perf N/A (paginated 25/page) |
| T-8 | security | active | pending | head-tester: RLS-browse-isolation + READ-ONLY + advisor-RBAC genuinely tested; secret-grep |
| T-9 | journey | active | pending | head-tester gate: +/compliance deal-activity browse |
