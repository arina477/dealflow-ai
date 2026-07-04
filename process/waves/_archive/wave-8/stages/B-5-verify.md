# Wave 8 — B-5 Verify
- Lint (pnpm lint): PASS.
- Unit/component tests (pnpm -r test): PASS — shared 440 + api 347(+1 skip) + web 304. Includes: mandate schema/RBAC/one-txn-rollback/actor-id/audit-in-txn/derive-disclaimer/3-acks-required/DrizzleError-unwrap (api mandate.spec 40 + di-boot 5); list+filter+empty-state+RBAC; create 3-sections+3-acks+POST(rid)+jurisdiction-no-picker; detail SSR-hydrated (0 client page-route fetch)+analyst-read-only+deferred-placeholders+PG-wire-timestamp; wave-2..7 green.
- Build: PASS. 3 /mandates routes compile.
- Dev-smoke: runtime (real create→derive-disclaimer→list→detail against live DB) deferred to C-2. Logic unit-proven.
```yaml
lint_passed: true
unit_tests_passed: true   # 1091 pass, 1 skip
build_passed: true
dev_smoke_passed: deferred-to-C2
