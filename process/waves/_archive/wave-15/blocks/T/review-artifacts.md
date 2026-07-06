# Wave 15 — T-block review artifacts
**Wave topic:** M7 admin (user-mgmt + workspace settings + data-source conn + shell polish)
**wave_type:** [ui, backend, auth(user-creation/role/deactivate + credentials)] — SECURITY-SCOPE-TIGHTENED
**Block exit gate:** T-9
| Stage | Layer | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | static | A (CI) | done | CI 28792309258 lint+typecheck green |
| T-2 | unit | A (CI) | done | 489 shared + 731 api + 642 web |
| T-3 | contract | A (CI) | done | admin.spec (20 unit + A-4/5/6 409) + shared admin zod + auditActionEnum |
| T-4 | integration | A (CI) | done | admin-concurrency.e2e 8/8 REAL vs Postgres: CONC-1 write-skew guard (2 concurrent last-admin → exactly one) + SEC-1/2/3/4 credential-never-leaks + AES-GCM round-trip |
| T-5 | e2e | B (active) | done | C-2: admin endpoints live, RBAC (advisor 403/anon 401), credential-never-returned live, last-admin guard endpoint |
| T-6 | layout | B (active) | done | C-2: 3 admin pages render authed, credential write-only, no send/AI, advisor-blocked |
| T-7 | perf | — | skipped | not heavy |
| T-8 | security | B (active) | done | CI write-skew + credential-never-leaks + C-2 live (CREDENTIALS_ENC_KEY set+working, credential-never-returned, RBAC) + secret-grep clean |
| T-9 | journey | B (active) | pending | journey regen (3 admin pages LIVE) + head-tester gate |
