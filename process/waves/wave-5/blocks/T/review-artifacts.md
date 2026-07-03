# Wave 5 — T-block review artifacts
**Block:** T · **Wave topic:** compliance rules engine + non-bypassable pre-send gate (M2 enforcement) · **Gate:** T-9 · **Status:** in-progress
| Stage | Deliverable | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | stages/T-1-static.md | ci-verified | done | typecheck+lint green |
| T-2 | stages/T-2-unit.md | ci-verified | done | 578 tests: SoD matrix, non-bypass, content-hash, CRUD-audit, id-translation |
| T-3 | stages/T-3-contract.md | ci-verified | done | GateVerdict/BlockReason + rules Zod + roleRoutes; nav⊆RBAC |
| T-4 | stages/T-4-integration.md | ci-verified | done | gate→evaluators→audit; CRUD→DB→audit; migration 0003; live C-2 |
| T-5 | stages/T-5-e2e.md | active | pending | real-browser settings CRUD UI |
| T-6 | stages/T-6-layout.md | active | pending | settings visual vs compliance-settings.html |
| T-7 | stages/T-7-perf.md | active | skipped | not heavy |
| T-8 | stages/T-8-security.md | active | done | SoD-compliance-only + non-bypass + config-audit LIVE (C-2); secret-grep clean |
| T-9 | stages/T-9-journey.md | active | pending | gate + journey regen |
- **wave_type:** backend + ui + auth (compliance gate + SoD = compliance-critical → T-8 MANDATORY). T-7 skip.
