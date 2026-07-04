# Wave 7 — T-block review artifacts
**Block:** T · **Wave topic:** sourcing-workspace page (search + ≥2-source + trigger-sync + connection-create) · **Gate:** T-9 · **Status:** in-progress
| Stage | Deliverable | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | stages/T-1-static.md | ci-verified | done | typecheck+lint green |
| T-2 | stages/T-2-unit.md | ci-verified | done | 927+ tests: connection-create RBAC/audit/actor-id, ≥2-source facet, providerKey-400, dup-409(DrizzleQueryError shape), badges |
| T-3 | stages/T-3-contract.md | ci-verified | done | connectionCreateSchema + roleRoutes; nav⊆RBAC |
| T-4 | stages/T-4-integration.md | ci-verified | done | connection create/list→DB; reuse ETL/sync; migration 0005; live C-2 |
| T-5 | stages/T-5-e2e.md | active | done | 4/5 PASS (workspace+RBAC+regression); S2=test-data collision (create LIVE C-2) |
| T-6 | stages/T-6-layout.md | active | done | workspace §10-conformant (TopBar→polish) |
| T-7 | stages/T-7-perf.md | active | skipped | not heavy |
| T-8 | stages/T-8-security.md | active | done | T-8-LITE: connection-create RBAC+audit+actor-id + secret-grep clean; reuse wave-6 |
| T-9 | stages/T-9-journey.md | active | pending | gate + journey regen |
- **wave_type:** backend + ui (reuse-heavy). T-8-LITE. T-7 skip.
