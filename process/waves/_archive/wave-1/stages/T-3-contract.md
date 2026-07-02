# Wave 1 — T-3 Contract

**Pattern:** A (verified-via-CI). Contract surface is project-internal (Zod), no external SDK this wave → Pattern A.

## Contract surface (from B-block)
- `@dealflow/shared` `HealthResponse` Zod schema: `{ status: 'ok'|'degraded', db: 'ok'|'down', version: string }`. Single shared contract, consumed by api (server emits) and web (client validates/consumes).

## Coverage trace
- **Schema validation** — `packages/shared/src/health.test.ts` exercises the schema directly (accepts valid `ok`/`degraded` shapes; rejects invalid). ✓
- **Server emits → schema conforms** — `apps/api/test/health.e2e-spec.ts` asserts the live `/health` response parses against `HealthResponse` (200 ok-path; 503 degraded-path invariant). ✓ (also the T-4 integration evidence)
- **Client consumes → type satisfied** — `apps/web/app/page.test.tsx` renders from a `HealthResponse`-typed value; TS `strict` enforces the consumer matches the contract at compile time (T-1 typecheck green). ✓
- **Live drift check** — C-2 captured the deployed `/health` body: `{"status":"ok","db":"ok","version":"4cad0179…"}` — conforms to the contract in production.
- Negative case (503 → `status:degraded, db:down`) is asserted by the e2e spec's invariant ("never 200 on DB failure").

No external SDK contracts → no Pattern B probe needed. No infrastructure gap.

```yaml
test_pattern: ci-verified
skipped: false
contracts_audited: ["HealthResponse (status/db/version)"]
ci_evidence:
  - "C-1 test job run 28595065716 green: shared schema test + api e2e shape assertion"
  - "C-2 live /health body conforms: {status:ok,db:ok,version:4cad0179...}"
active_probe_results: []
infrastructure_gap_recorded: false
findings: []
```
