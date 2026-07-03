# Wave 3 — T-block review artifacts
**Block:** T · **Wave topic:** AppShell + role-aware dashboard + per-route RBAC · **Gate:** T-9 · **Status:** gate-passed
| Stage | Deliverable | Pattern | Status | Notes |
|---|---|---|---|---|
| T-1 | stages/T-1-static.md | ci-verified | done | typecheck+lint green; low casts (icon-map + test fixtures) |
| T-2 | stages/T-2-unit.md | ci-verified | done | rbac 105 + compliance matrix + AppShell per-role + di-boot; 217 total |
| T-3 | stages/T-3-contract.md | ci-verified | done | rbac.ts roleRoutes + nav⊆RBAC contract test + /compliance/summary |
| T-4 | stages/T-4-integration.md | ci-verified | done | compliance RBAC (DB-role mocked unit + live C-2); no schema |
| T-5 | stages/T-5-e2e.md | active | done | 7/7 real-browser PASS (RBAC nav + login regression) |
| T-6 | stages/T-6-layout.md | active | done | AppShell visual baseline §10-conformant |
| T-7 | stages/T-7-perf.md | active | skipped | not heavy |
| T-8 | stages/T-8-security.md | active | done | RBAC matrix live (C-2) + secret-grep clean + session (wave-2) |
| T-9 | stages/T-9-journey.md | active | gate-passed | head-tester APPROVED; journey regen (AppShell+RBAC live) |
- **wave_type:** ui + auth (RBAC) + backend. T-8 runs (RBAC auth-adjacent). T-7 skip.

```yaml
test_block_status: complete
stages_run: [T-1,T-2,T-3,T-4,T-5,T-6,T-8,T-9]
stages_skipped: [T-7 (not heavy)]
findings_total: 2
findings_critical: 0
ready_for_verify: true
note: real-browser E2E 7/7 + live RBAC matrix (C-2); compliance-first RBAC invariants verified
```
