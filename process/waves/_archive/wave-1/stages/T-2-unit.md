# Wave 1 — T-2 Unit

**Pattern:** A (verified-via-CI). Unit suite ran in CI at C-1; T-2 audits coverage, does not re-run.

## CI evidence
- `test` job on CI run `28595065716` (SHA `feeb7ad…` == PR head): **pass**. Vitest across all workspaces; the job also stands up a `postgres:18` service for the integration spec (T-4).

## Coverage audit — unit/component specs present
- `packages/shared/src/health.test.ts` — unit test for the `HealthResponse` Zod schema (valid + invalid shapes). ✓ covers the wave's contract module.
- `apps/api/src/health/health.service.spec.ts` — unit test for the health service (ok vs degraded branch on DB reachability). ✓ covers the service's decision logic.
- `apps/web/app/page.test.tsx` — component test: page renders health status from a mocked fetch. ✓ covers the web consumer.
- Wave surface (shared Zod contract, api health service, web page) each has a dedicated unit/component test — coverage adequate for a foundation slice.

## Flake observation
- C-1 merged on the first green re-run after the audit fix; no test-job flakes recorded (only the `audit` check failed pre-fix, deterministically). `new_flakes: none`.

## Discipline note (→ T-2 principles at L-2)
- Health service test correctly isolates the DB decision (ok/degraded) at unit level; the real-DB path is covered separately at T-4 (no DB mocking in the integration layer — follows the "don't mock the database at integration" rule).

```yaml
test_pattern: ci-verified
skipped: false
evidence:
  - "C-1 test job: run 28595065716 green (Vitest, all workspaces)"
modules_audited: ["@dealflow/shared HealthResponse", "apps/api health.service", "apps/web page"]
new_flakes: []
findings: []
```
