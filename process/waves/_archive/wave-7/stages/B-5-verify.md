# Wave 7 — B-5 Verify
- **Lint** (`pnpm lint`): PASS (exit 0).
- **Unit/component tests** (`pnpm -r test`): PASS — shared 415 + api 291(+1 skip) + web 214 = 920. Includes: connection-create RBAC + audited + actor-id-translated + create-then-list ≥2; workspace render + search + **≥2-source facet (mock ≥2 connections → 2 sources)** + sync-trigger + connection-create + Review-Import→companies; wave-3..6 green.
- **Build** (`pnpm -r build`): PASS. /sourcing workspace compiles.
- **Dev-server smoke:** workspace runtime (real create→sync→search→≥2-source facet against live DB) deferred to C-2 (the AC-SEED ≥2-source facet verified against REAL rows at C-2). App boots + routes compile; logic unit-proven.
```yaml
lint_passed: true
unit_tests_passed: true   # 920 pass, 1 skip
build_passed: true
dev_smoke_passed: deferred-to-C2
two_source_facet_test: present  # mock >=2 connections
findings: []
