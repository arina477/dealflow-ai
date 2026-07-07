# Wave 20 — T-block review artifacts
**Wave topic:** M9 outreach-activity tracker (first mutable M9 write surface) — LIVE @86ddc29 (write-path RLS, audit-logged mutations, additive migration 0018)
**wave_type:** [backend, ui, schema-migration, write-surface] — write-path isolation + audit-integrity hard invariants
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28841757352 lint+typecheck @86ddc29 |
| T-2 | unit | A (CI) | done | api 831+ + web 811 + shared 509; outreach-activity.spec (SF1/R1/R3/R4 unit) |
| T-3 | contract | A (CI) | done | shared outreach-activity.ts (create/update/list; input EXCLUDES workspaceId+createdBy — SF4) + rbac |
| T-4 | integration | A (CI) | done | outreach-activity-rls.e2e 9/9 + migration.e2e 12/12 REAL service as dealflow_app: R1 own-row-re-home→42501, SF1 empty-ALS-reject, R2 FORCE, R3 4-FK tenancy, R4 per-verb audit last-in-txn+rollback+verifyChain, GAP-4 populated-migration |
| T-5 | e2e | B (active) | done | C-2 live @86ddc29: /outreach-activity anon 401 (fail-closed), /outreach/activity 307, audit-verify 401 (chain intact), migration 0018 applied. Authed create/list deferred (no prod fixtures) — CI e2e authoritative |
| T-6 | layout | B (active) | done | web /outreach/activity panel tests 48 (form + list + status transitions + empty/error + RBAC); design-system reuse (MandateForm pattern, no new mockup) |
| T-7 | perf | — | skipped | indexed (workspace_id,status,due_at) my-open-touches read; no N+1 |
| T-8 | security | B (active) | done | write-path-RLS (R1 own-row-re-home + SF1 no-default-leak + R2 FORCE — as dealflow_app) + read-negative-read + all-4-FK-tenancy (R3) + createdBy-server-derived + audit-logged-mutations-last-in-txn (R4) + audit-chain-intact (C-2 verify) + additive-migration (GAP-4) + credential-free (no external send) + secret-grep clean |
| T-9 | journey | B (active) | pending | journey (+/outreach/activity + /outreach-activity API) + head-tester gate |
