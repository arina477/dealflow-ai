# Wave 16 — T-block review artifacts
**Wave topic:** M7 admin-hardening (cascade + nav + invite-dedup + reactivate + config-boundary + admin-activity)
**wave_type:** [ui, backend, auth(invite/user-state), config-security] — SECURITY-SCOPE-TIGHTENED (P-4)
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28805234334 lint+typecheck green |
| T-2 | unit | A (CI) | done | api 768 + shared 489 + web 693 |
| T-3 | contract | A (CI) | done | shared admin-activity/user-admin/data-source-config + auditActionEnum(+user-reactivate) + admin.spec C-4/E-1/A-7/A-8 |
| T-4 | integration | A (CI) | done | REAL vs CI Postgres: INVITE-CONC-1 (advisory-lock exactly-one, fault-killing) + REACTIVATE-1/2 + CASCADE-1/2/3a-string/3b-object/4 (inherits+no-retroactive+shape-round-trip) + admin-activity ACT-* (read-only 0-audit-rows + RBAC + no-secret) + recordkeeping verifyChain ok:true |
| T-5 | e2e | B (active) | done | C-2: reactivate-live (+400-on-non-uuid), admin-activity live (RBAC 403/401), cascade-inherits live, config-400-no-echo live |
| T-6 | layout | B (active) | done | C-2: /admin/activity 4-col read-only table (no hash/credential col), nav server-gated (advisor doesn't see), credential form still write-only |
| T-7 | perf | — | skipped | not heavy |
| T-8 | security | B (active) | done | CI (advisory-lock write-safe + config-secret-absent + admin-activity-no-secret + read-only) + C-2 live (no-leak, RBAC, audit-chain ok:true after user-reactivate action) + secret-grep clean |
| T-9 | journey | B (active) | pending | journey regen (/admin/activity + nav LIVE) + head-tester gate |
