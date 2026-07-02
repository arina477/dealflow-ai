# Wave 1 — T-4 Integration

**Pattern:** A (verified-via-CI). CI provisions a real `postgres:18` service and runs the integration spec against it → Pattern A.

## Pattern determination
- `.github/workflows/ci.yml` `test` job attaches a `postgres:18` service (health-checked) and sets `DATABASE_URL` + a distinct `TEST_DATABASE_URL` (separate DB in the same container, per architecture R-17). CI runs integration against a real DB — Pattern A, no missing-infra path.

## Boundary coverage trace
- **Schema migration (B-0):** `app_meta` table via `0000_small_xorn.sql` (additive). Exercised by the e2e spec issuing a real query through Drizzle against the CI Postgres. ✓ Also confirmed live at C-2 (`db:ok` requires the migration applied + a successful `SELECT`).
- **Service → DB boundary (B-2):** `health.service` does a real Drizzle `SELECT 1`; `apps/api/test/health.e2e-spec.ts` (Supertest) invokes `GET /health` end-to-end (route → service → DB → response) against the real test DB. ✓
- **DB-down path:** the e2e asserts the 503/`degraded` invariant path (never 200 when the DB is unreachable). ✓
- Rule adherence: integration layer hits a real Postgres (no pg-mem / no DB mocking) per test-writing-principles. ✓

## Evidence
- C-1 `test` job (run `28595065716`) green with the Postgres service — integration spec passed on the merge commit.
- C-2 live probe: `/health` → `{status:ok, db:ok, ...}` — the DB round-trip works in production, not just CI.

```yaml
test_pattern: ci-verified
skipped: false
boundaries_audited: ["app_meta migration query", "health route→service→Drizzle→Postgres", "DB-down 503 invariant"]
ci_evidence:
  - "C-1 test job run 28595065716 green with postgres:18 service; health.e2e-spec real-DB"
  - "C-2 live /health db:ok — production DB round-trip verified"
active_run_output: ""
infrastructure_gap_recorded: false
findings: []
```
