# Wave 6 — B-5 Verify
- **Lint** (`pnpm lint`): PASS (exit 0). (11 pre-existing biome warnings in dedupe.engine — non-blocking, carry to V-2.)
- **Unit/component tests** (`pnpm -r test`): PASS — shared 390 + api 247(+1 skip) + web 179 = 816. Includes: **dedupe engine cross-source (1 canonical + 2 provenance), idempotent, ambiguous→candidate, contact_provenance** (the P-0 watch-item, 31 tests); fixture cross-source dups; idempotent ETL upsert; endpoint RBAC (analyst/admin 200/201, advisor/compliance 403, anon 401); dedupe-resolve audited + actor-id-translated; screen list/filter/dedupe-review.
- **Build** (`pnpm -r build`): PASS. /sourcing/companies compiles.
- **Dev-server smoke:** sourcing runtime (real sync→dedupe→canonical against live DB) deferred to C-2 (needs live postgres w/ migration 0004). App boots + routes compile; dedupe logic unit-proven.
```yaml
lint_passed: true
unit_tests_passed: true   # 816 pass, 1 skip
build_passed: true
dev_smoke_passed: deferred-to-C2
cross_source_dedup_test: present
findings:
  - {severity: low, location: "dedupe.engine.ts", description: "11 pre-existing biome warnings — non-blocking, carry V-2"}
```
