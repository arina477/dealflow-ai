# Wave 5 — B-5 Verify
- **Lint** (`pnpm lint`): PASS (exit 0, 3/3). No new warnings.
- **Unit/component tests** (`pnpm -r test`): PASS — shared 275 + api 158(+1 skip) + web 134 = 567. Includes: gate non-bypass (all evaluators every call + audit-in-tx + rollback), **SoD compliance-only matrix (admin BLOCKED)**, suppression/disclaimer/content-hash evaluators, CRUD per-role RBAC + mutation-audited-in-tx + disclaimer-new-version, settings UI 3-section + interactions.
- **Build** (`pnpm -r build`): PASS. /compliance/settings compiles.
- **Dev-server smoke:** gate + CRUD runtime (real evaluate + audited mutations against live DB) deferred to C-2 (needs live postgres w/ migration 0003 + wave-4 audit). App boots + routes compile; logic unit-proven.
```yaml
lint_passed: true
unit_tests_passed: true   # 567 pass, 1 skip
build_passed: true
dev_smoke_passed: deferred-to-C2
findings: []
sod_compliance_only_test: present  # admin blocked as approver
```
