# Test Architecture

Branch: Test · Project: DealFlow AI · Stack: Vitest + Supertest + React Testing Library + Playwright MCP · Authored v6 architecture.

## Summary

DealFlow AI is an internal/pilot AI platform for an M&A advisory firm. Its compliance-first mandate — tamper-evident audit log, pre-send compliance gate, and separation-of-duties RBAC — makes three test domains structurally non-negotiable at T-1 coverage targets regardless of wave scope:

1. **Matching-engine correctness** — the AI buyer-seller ranking is the product's core value claim; wrong scores produce wrong deals.
2. **Audit-log tamper evidence and integrity** — the hash chain is the compliance record; if it can be silently broken, FINRA/SOX recordkeeping is void.
3. **Pre-send compliance gate enforcement** — a bypassed gate is a regulatory violation; the gate must be provably non-bypassable, not a UI nicety.
4. **RBAC and role separation** — separation of duties (the sender is never the approver) is a structural compliance requirement, not a feature.

All four are classified **Tier 1** per `test-writing-principles.md § 6`. They receive 80%+ branch coverage targets and are the first tests authored every wave that touches their domain. The remaining product surface follows Tier 2 / Tier 3 prioritization in standard order.

The test suite spans nine T-layers (T-1 through T-9). T-1 / T-2 / T-3 run on every wave. T-4 through T-9 fire per the block dispatcher's per-stage skip rules. **E2E (T-5) and layout (T-6) are currently blocked on Playwright Chrome binary installation — see Risk / open items.**

---

## Inventory

### T-1 — Static (lint + typecheck)

Tool: Biome (lint) + `tsc --noEmit` (typecheck). Config: `biome.json` at monorepo root; `tsconfig.json` per package (`apps/api`, `apps/web`, `packages/shared`).

Fires as the first CI job on every push. No wave skips. Shared Zod schemas in `@dealflow/shared` must type-check across both the NestJS DTO bridge (`@anatine/zod-nestjs`) and the Next.js client. Schema drift between packages surfaces here.

### T-2 — Unit (Vitest)

Tool: Vitest. Config: `vitest.config.ts` per package. Test file naming: `*.unit.test.ts` for explicit layer marking; plain `*.test.ts` also acceptable when the layer is unambiguous from location.

Co-locate test files next to the source file they cover. One test file per source file.

**Matching engine (Tier 1)**

Module: `apps/api/src/matching/`. Coverage target: 80% branch.

| Test case | Layer | Notes |
|---|---|---|
| Score computation — happy path with valid mandate + buyer profiles | T-2 unit | Mock LLM boundary; assert numeric score range and rationale field presence |
| Score computation — missing buyer criteria fields (partial data) | T-2 unit | Must degrade gracefully; no throws on null contact fields |
| Ranking order — N buyers sorted by descending score | T-2 unit | Stable sort; ties broken deterministically |
| Rationale generation — LLM output parsed and bounded | T-2 unit | Test against a fixture LLM response; mock the AI provider boundary |
| Score computation — mandate with zero matching criteria | T-2 unit | Edge case: must return a valid (lowest-rank) result, not throw |
| Shortlist accept/reject state transitions | T-2 unit | Transition matrix: pending → accepted, pending → rejected, accepted → flagged; illegal transitions must reject |
| Concurrent shortlist update (optimistic lock) | T-4 integration | Two advisors updating the same buyer concurrently — last write does not silently clobber |

**Audit log — tamper evidence and integrity (Tier 1)**

Module: `apps/api/src/audit/`. Coverage target: 80% branch.

| Test case | Layer | Notes |
|---|---|---|
| Append writes a row with correct hash (SHA-256 of content + prev-hash) | T-2 unit | Mock DB at boundary; assert hash field is computed correctly for a known input |
| Hash chain — row N's `prev_hash` equals row N-1's `hash` | T-4 integration | Requires real DB; insert 3 rows sequentially and walk the chain |
| Tamper detection — mutating any field of a stored row breaks chain verification | T-4 integration | Update a row's content directly (bypassing app layer); run chain-verify; assert INVALID |
| Tamper detection — deleting a middle row breaks chain | T-4 integration | Delete row N of a 5-row chain; verify detects gap |
| Append-only enforcement — UPDATE on `audit_log_entries` rejected at DB layer | T-4 integration | Assert SQLSTATE 42501 (permission denied) on direct UPDATE attempt with the app role |
| Append-only enforcement — DELETE on `audit_log_entries` rejected at DB layer | T-4 integration | Same: assert permission denied on DELETE |
| Export package — exported records match stored rows; hash chain included | T-4 integration | Request export for a date range; verify row count and chain validity in the package |
| HMAC key rotation — chain verification uses correct key version | T-2 unit | Verify key-version field is stored and used for verification, not just the latest key |
| Compliance officer can read audit log; non-compliance roles cannot | T-4 integration | See RBAC section below |

**Pre-send compliance gate (Tier 1)**

Module: `apps/api/src/compliance/`. Coverage target: 80% branch.

| Test case | Layer | Notes |
|---|---|---|
| Gate blocks send when recipient is on suppression/blocklist | T-2 unit | Mock blocklist lookup; assert `BLOCKED` outcome |
| Gate blocks send when required disclaimer is absent from template | T-2 unit | Template missing jurisdiction disclaimer; assert `BLOCKED` |
| Gate blocks send when approval-gating flag is set and approval is pending | T-2 unit | Mandate has `approval_required: true`; no approval record; assert `BLOCKED` |
| Gate allows send when all rules pass | T-2 unit | Clean template, no suppression, approval present; assert `ALLOWED` |
| Gate cannot be bypassed via direct send-service call (skipping gate) | T-4 integration | Call outreach-send service directly without a gate-pass token; assert 403 |
| Approval workflow — compliance officer can approve; advisor cannot self-approve | T-4 integration | Advisor tries to approve own outreach; assert 403. Compliance officer approves; assert 200 |
| Approval revocation — approved record revoked before send; gate re-blocks | T-2 unit | Revoke approval; call gate again; assert `BLOCKED` |
| Compliance rules CRUD — only compliance role can write rules | T-4 integration | See RBAC section |
| Suppression list — add entry; verify gate blocks that recipient on next check | T-4 integration | End-to-end through rule engine |
| Jurisdiction-specific disclaimer — rule fires only for matching jurisdiction | T-2 unit | Rule scoped to `jurisdiction: US-NY`; non-NY mandate passes without it |

**RBAC and role separation (Tier 1)**

Module: `apps/api/src/auth/guards/` + all role-annotated controllers. Coverage target: 80% branch on guard logic.

| Test case | Layer | Notes |
|---|---|---|
| Unauthenticated request → 401 before 403 on every protected route | T-4 integration | Guard stacking order: authentication checked before authorization |
| Malformed JWT → 401 | T-4 integration | Expired token, wrong-key signature, truncated token |
| Role mismatch → 403 after valid auth | T-4 integration | Valid analyst token hits advisor-only endpoint |
| Separation of duties — sender cannot be approver | T-4 integration | Outreach created by advisor X; X's approval attempt → 403; compliance officer Y → 200 |
| Admin can manage users; non-admin cannot | T-4 integration | Advisor calls `POST /admin/users`; assert 403 |
| Compliance role can read audit log; advisor/analyst/admin cannot | T-4 integration | Assert 403 for all non-compliance roles on `GET /compliance/audit-log` |
| Compliance role can manage compliance rules; others cannot | T-4 integration | Assert 403 for advisor/analyst/admin on `POST /compliance/settings` |
| Role downgrade takes effect immediately — no stale claim | T-4 integration | Admin changes user's role; user's next request with old token is rejected on role re-verification |
| IDOR — user A cannot access user B's mandate | T-4 integration | Two advisors; A calls `GET /mandates/:id` with B's mandate id; assert 403 or 404 |
| Invite token — expired token rejected; consumed token rejected | T-4 integration | Clock-advance test for expiry; replay test for consumed token |

**Standard modules (Tier 2 / Tier 3)**

| Module | Tier | Key test cases |
|---|---|---|
| Mandate service | T-2 | CRUD happy/error; status-machine transitions (draft → active → closed); duplicate-mandate rejection |
| Buyer universe builder | T-2 | Filter logic; enrichment-source boundary mocked; empty-result handling |
| Outreach template service | T-2 | Merge-field substitution; missing-field detection; required-compliance-block injection |
| Outreach send service | T-2 | Send dispatched with correct headers; tracking IDs generated; provider boundary mocked |
| Email event webhook processor | T-4 | Signature verification; idempotency on duplicate event ID; audit log written on each event |
| Pipeline / deal-stage service | T-2 | Stage-advance transitions; notes append; next-action scheduling |
| Ingestion / sourcing jobs | T-4 | Dedup logic; enrichment queue dispatch; provenance field set |
| Company/contact data store | T-2 | CRUD; ownership; unique-constraint enforcement |
| User management service | T-4 | Invite creation; invite expiry; role assignment; Admin-revoke sessions |

### T-3 — Contract (Zod schema + API shape)

Tool: Vitest. Co-located in `packages/shared/src/` or `tests/contract/`.

All shared Zod schemas in `@dealflow/shared` have contract tests: valid data → parse succeeds; invalid data → parse fails with expected error path; boundary values for length/range constraints.

API response shapes validated at the HTTP layer (Supertest) for every endpoint using the shared schema as the assertion: response body must satisfy the Zod schema, not just have the right status code. This catches NestJS serializer drift from shared contracts early without needing full E2E.

Key contracts requiring dedicated files:

- `AuditLogEntrySchema` — hash + prev_hash + version fields required and typed
- `ComplianceGateResultSchema` — outcome enum (`ALLOWED | BLOCKED | PENDING_APPROVAL`), blocking reasons array
- `MatchScoreSchema` — score range `[0,1]`, rationale non-empty string, buyer and mandate IDs present
- `OutboundEmailSchema` — recipient not on suppression list is a pre-condition asserted at contract level
- `RBACClaimSchema` — role enum bounded to `advisor | analyst | compliance | admin`

### T-4 — Integration (Supertest + real test DB)

Tool: Supertest (HTTP) + Vitest (runner) + Drizzle against a dedicated test PostgreSQL instance. Test files in `tests/integration/` or co-located as `*.integration.test.ts`.

The test database is seeded from `packages/db/seeds/test-seed.ts` before each test suite and torn down (truncate all tables, preserve schema) after. No shared state across test files. Transaction rollback is preferred over truncate for speed within a single test file.

**Audit-log database-layer tests** require the real Postgres permission grant setup (the app role has INSERT-only on `audit_log_entries`) — these tests cannot be mocked and must run against a real DB with the correct role grants applied.

**Environment:** `NODE_ENV=test`; a separate `TEST_DATABASE_URL` env var points to the test DB. The test DB is provisioned in CI as a Railway service or a Docker Compose Postgres container (see devops.md CI job spec). Never `TEST_DATABASE_URL=PRODUCTION_DATABASE_URL`.

### T-5 — E2E (Playwright MCP swarm)

Tool: Playwright MCP (live browser, 5-instance swarm default). Test files in `tests/e2e/`. One spec file per user flow (F1–F15).

**BLOCKED — see Risk / open items. Do not attempt T-5 until the Chrome binary is installed.**

When unblocked, the swarm maps directly to the 20 MVP screens and 13 flows in the user journey map:

| Swarm partition | Flows covered | Screens |
|---|---|---|
| Tester 1 | F1, F2 (Advisor — mandate create + match review) | Pages 5, 6, 7, 9 |
| Tester 2 | F3 (Advisor — outreach compose + compliance gate + send) | Pages 10, 15 |
| Tester 3 | F6, F7, F8, F9 (Analyst — sourcing + buyer universe + templates) | Pages 8, 12, 13, 14 |
| Tester 4 | F10, F11, F12 (Compliance — queue + audit log + rules) | Pages 15, 16, 17 |
| Tester 5 | F13, F14, F15 + auth flows (Admin + unauthenticated) | Pages 1, 2, 3, 18, 19, 20 |

Each tester uses a dedicated persona account from `command-center/testing/test-accounts.md`. Different testers running in separate MCP processes may reuse the same account when their scenario partitions are non-overlapping; same account in the same process is forbidden.

Compliance-critical E2E flows (F3 compliance gate, F10 approval workflow, F11 audit log) receive evidence-grade reporting per `test-writing-principles.md § 15.7`: network panel capture, console error capture, screenshot per step.

### T-6 — Layout (visual regression)

Tool: Playwright screenshot diff (baseline stored in `tests/layout/baselines/`). **BLOCKED on same Chrome binary dependency as T-5.**

Baseline captures scoped to the three compliance screens (Pages 15, 16, 17) and the Dashboard (Page 4) as the highest visual-regression risk surfaces. Full 20-screen baseline generated on first unblocked run.

### T-7 — Performance

Tool: Lighthouse CI (bundle size + Web Vitals). Budget file: `tests/perf/budget.json`. Deferred to H2 unless a specific wave introduces a performance regression trigger. Not in MVP CI gate.

### T-8 — Security

Tool: custom Supertest probes in `tests/security/`. Fires automatically when a wave touches `auth | sessions | csrf | rate-limit | user-creation | outreach-send | compliance-gate`.

Security probes mapped to the security architecture (`architecture/security.md`):

| Probe | Asserts |
|---|---|
| Auth smoke — every role | Login succeeds; session cookie is `httpOnly` + `Secure` + `SameSite=Lax`; token not in response body |
| CSRF — state-changing endpoints | POST/PUT/PATCH/DELETE without anti-CSRF token → 403 |
| Rate limiting — login + password-reset | 6th attempt within window → 429 |
| Replay — invite token | Second use of consumed invite token → 4xx |
| Replay — email-event webhook | Duplicate event ID delivered twice → idempotent (202 both times, single DB write) |
| IDOR — cross-mandate access | Advisor A reads Advisor B's mandate by ID → 403 or 404 |
| Audit log permission — direct UPDATE | App-role UPDATE on `audit_log_entries` → SQLSTATE 42501 |
| Compliance gate bypass — direct call | Outreach send without gate-pass token → 403 |
| RBAC stacking order | Unauthenticated → 401; wrong role → 403 (never 403 before 401) |

### T-9 — Journey

Regenerates `command-center/artifacts/user-journey-map.md` from the deployed staging environment. Fires at wave close. Verifies every route in the page inventory (Pages 1–20) returns the correct HTTP status for the correct persona; documents any regression against the prior wave's map.

---

## Conventions

**Co-location.** Unit test files live at the same directory level as the source file they cover: `matching.service.ts` → `matching.service.unit.test.ts`. Integration tests that cross module boundaries live in `tests/integration/`. E2E tests live in `tests/e2e/`. Security probes live in `tests/security/`.

**File naming.** Explicit layer suffix preferred: `*.unit.test.ts`, `*.integration.test.ts`, `*.contract.test.ts`. E2E files: `<flow-name>.spec.ts` (e.g. `f03-compliant-outreach.spec.ts`).

**AAA structure.** Every `it` block uses explicit `// Arrange`, `// Act`, `// Assert` comments. No exceptions — the compliance and security tests especially must be auditable by a non-engineer reading the test output.

**Mock policy.**
- Unit tests (T-2): mock at the boundary (DB repository, LLM provider, email send provider, email-event webhook). Never mock NestJS internals or the service under test itself.
- Integration tests (T-4): no mocks for DB. Mock the LLM provider, email send provider, and external enrichment/data-source APIs at their HTTP boundary using `nock` or equivalent. Never mock the compliance gate in integration tests that test the compliance gate itself.
- `vi.clearAllMocks()` in `afterEach` on every describe block that uses mocks. Bleeding mock state is the primary source of flaky tests.
- Mock factories are mandatory when ≥3 tests share the same mock shape — extract to `tests/helpers/<module>.factory.ts`.

**Live E2E policy.** T-5 uses prod fixture accounts from `command-center/testing/test-accounts.md` (gitignored). Dev-seed credentials (`*@example.test`) must never be used against staging or production auth. Never `browser_close` mid-swarm; close only at swarm end.

**Assertion style.** Assert on types and contracts, not string messages: `expect(err).toBeInstanceOf(ForbiddenException)` not `expect(err.message).toBe('Forbidden')`. Exception messages are copy; exception types are contracts.

**Guard-order assertion.** Every RBAC integration test asserts the 401-before-403 stacking order explicitly — an unauthenticated probe must return 401, not 403, on every protected route.

---

## Reusability Principles

**Persona-based test users.** The four roles map to four named test personas. Each persona has a corresponding factory and, for integration tests, a seeded DB row. Persona identities live in `tests/helpers/personas.ts` (local dev) and `command-center/testing/test-accounts.md` (prod fixture registry, gitignored).

| Persona constant | Role | Primary test domains |
|---|---|---|
| `ADVISOR_USER` | advisor | F1, F2, F3, F4, matching, outreach, pipeline |
| `ANALYST_USER` | analyst | F6, F7, F8, F9, sourcing, buyer-universe, templates |
| `COMPLIANCE_USER` | compliance | F10, F11, F12, audit-log, compliance-gate, RBAC separation-of-duties |
| `ADMIN_USER` | admin | F13, F14, F15, user management, RBAC admin paths |

A fifth persona, `UNAUTHENTICATED`, is represented by a plain Supertest agent with no session cookie — used for 401-before-403 guard-order probes and T-5 login-screen verification.

**Shared test factories.** Factories live in `tests/helpers/`. Each factory returns an object or DB-inserted record for a given module. Factories accept partial overrides so individual tests express only what varies:

| Factory | Returns | Used by |
|---|---|---|
| `mandateFactory(overrides?)` | `Mandate` DB record | matching, pipeline, compliance-gate tests |
| `buyerFactory(overrides?)` | `Company` DB record | matching, buyer-universe tests |
| `auditLogEntryFactory(overrides?)` | `AuditLogEntry` with valid hash | audit-log chain tests |
| `complianceRuleFactory(overrides?)` | `ComplianceRule` DB record | gate-enforcement, suppression tests |
| `outreachFactory(overrides?)` | `OutreachCampaign` DB record | compliance-gate, send, audit tests |
| `inviteTokenFactory(overrides?)` | `InviteToken` with expiry | auth, RBAC tests |
| `userFactory(role, overrides?)` | `User` DB record + SuperTokens stub | all integration tests |

**Seed scripts.** `packages/db/seeds/test-seed.ts` uses the factories above to seed a canonical baseline state before each integration test suite: one mandate per advisor, one buyer universe, a seeded audit log with 5 entries and a valid chain, one pending compliance approval, and one suppression-list entry. Individual tests extend or override this baseline rather than rebuilding from scratch.

**Compliance chain fixture.** A pre-computed 5-entry audit log chain with known hashes is checked into `tests/fixtures/audit-chain-valid.json`. Tests that verify hash-chain integrity use this fixture as the baseline, then apply a specific mutation (row edit, row delete, row insert out of order) and assert the correct verification outcome. This makes tamper-detection tests deterministic and fast without DB round-trips.

**LLM provider mock.** `tests/helpers/llm-mock.ts` exports a `mockMatchingResponse(score, rationale)` helper that stubs the AI provider boundary (HTTP intercept via `nock`). All matching-engine unit and integration tests use this helper; no test makes a real LLM call.

---

## Cross-references

**Security architecture (`architecture/security.md`):** The RBAC design (role enum, guard stacking, separation-of-duties invariant, invite-token lifecycle) and the audit-log security design (append-only DB grant, HMAC key, chain verification algorithm) are specified there. Tests here implement the verification of those specs — the test layer does not re-specify the design.

**Databases architecture (`architecture/databases.md`):** The `audit_log_entries` table's INSERT-only permission grant for the app role is a database-layer control. T-4 integration tests that assert `SQLSTATE 42501` on UPDATE/DELETE depend on this grant being correctly applied by the migration. If the grant drifts, those tests fail — which is the intended behaviour.

**DevOps architecture (`architecture/devops.md`):** CI runs T-1, T-2, T-3, T-4, T-8 on every PR. T-5, T-6, T-9 run post-merge on staging. The test database is provisioned as a Docker Compose Postgres service in the CI job (see devops.md for the job spec). `TEST_DATABASE_URL` is set as a CI environment variable; it must never equal `DATABASE_URL`.

**CI test gates (devops.md):** T-1 (lint + typecheck) and the T-2 / T-3 / T-4 / T-8 suites are merge-blocking. A single test failure in any of these layers blocks the PR. T-5 / T-6 regressions on staging are wave-blocking (must resolve before V-3 fast-fix gate closes).

**Seed data (`packages/db/seeds/`):** Integration tests depend on the test seed script being idempotent and isolated. Any DB migration that changes the `audit_log_entries` schema must update both the production migration and `test-seed.ts` in the same PR — a migration without a seed update is a discipline violation caught at T-4 time.

**User journey map (`command-center/artifacts/user-journey-map.md`):** T-5 E2E specs are partitioned by the 13 flows (F1–F15) and 20 pages defined there. T-9 regenerates the map from the staging deployment. Any page added to the map that does not have a corresponding E2E spec is an open gap tracked in Risk / open items.

---

## Stack-specific Decisions

**Vitest over Jest.** The monorepo uses Vitest as the single test runner for T-2, T-3, and T-4. Reasons: native ESM support (no transform config for `@dealflow/shared` Zod schemas), faster HMR in watch mode during development, and compatible with the Turborepo pipeline (`turbo run test`). No Jest configuration exists; do not introduce it.

**Supertest for T-4 HTTP integration.** NestJS integration tests use Supertest against a `TestingModule`-created app instance, not against a live deployed server. This gives real HTTP semantics (headers, status codes, cookies) without needing a running process. The SuperTokens session middleware is loaded in the test module; a test helper (`tests/helpers/auth.ts`) provides `loginAs(persona)` → session cookie for reuse across tests.

**`nock` for external HTTP mocking.** All external HTTP calls (LLM provider, email send provider, enrichment APIs, email-event webhooks inbound) are intercepted at the `node:http` layer using `nock` in integration tests. `nock.cleanAll()` runs in `afterEach`. This means integration tests never make real external calls — the compliance gate and outreach send tests run in milliseconds and deterministically.

**Drizzle test client.** Integration tests import the Drizzle client configured against `TEST_DATABASE_URL`. Schema migrations are applied to the test DB once at CI startup (not per test). The test seed script handles row-level state. Never run `drizzle-kit push` in CI — only apply pre-generated migration files.

**Playwright MCP swarm.** The project's E2E allocation is 5 Playwright MCP instances. Swarm specs are authored as individual `spec.ts` files, one per flow. The orchestrator spawns N parallel tester sub-agents (up to 5), one per MCP instance, each owning a non-overlapping flow partition. Per `test-writing-principles.md Rule 23`: never `browser_close` mid-swarm. Per `test-writing-principles.md Rule 22`: prod fixture accounts from `test-accounts.md` only.

**React Testing Library for component tests.** Next.js App Router components are tested with React Testing Library + `@testing-library/user-event`. Query by role/label/text; never by `data-testid`. Components that read from the Next.js router are wrapped with a test router provider. Server Components that fetch data are tested via Storybook or RTL with mocked fetch — not by importing the data-fetching layer into the component test.

**Audit-log hash verification in tests.** The HMAC key used in tests is a deterministic fixture key (`TEST_AUDIT_HMAC_KEY=test-only-do-not-use-in-prod`) set in the test environment. Tests that verify hash values use this fixture key so expected-hash values can be hard-coded in the fixture file. This key must never appear in production secrets.

---

## Risk / Open Items

### CRITICAL — Playwright Chrome binary not installed

**Playwright Chrome (Chromium) binary is not installed in the current development environment.** The `playwright install chromium` step has not been run. This blocks:

- All T-5 E2E tests (Playwright MCP swarm across 20 screens)
- All T-6 layout / visual regression tests
- Any T-9 Journey step that requires a browser (route-status audit against staging)

**Action required (host-side, before first UI wave's T-5):** run `pnpm exec playwright install chromium` (or the equivalent per CI platform) in the environment where tests execute. This must be confirmed before T-5 is scheduled in the wave plan. Do not attempt to run the Playwright swarm without first verifying `playwright --version` and a successful `playwright install` run. In CI, add an explicit `npx playwright install --with-deps chromium` step before the E2E job.

Until this is resolved: T-5 and T-6 are skipped per the block dispatcher's skip rules. All other layers (T-1 through T-4, T-8) are unaffected.

### Open — LLM provider not yet selected

The AI matching engine's test boundary (`llm-mock.ts`) is defined but the concrete provider SDK is not finalized (decided in v6 SDK branch). When the SDK is selected, update `tests/helpers/llm-mock.ts` to intercept the provider's specific HTTP endpoint/SDK boundary. The mock interface (`mockMatchingResponse`) remains stable regardless of provider.

### Open — Email send provider not yet selected

Same pattern as LLM: `nock` intercept stubs are written against a placeholder base URL. Update to the real provider URL when the SDK branch finalizes the provider selection.

### Open — Background job queue technology not finalized

Integration tests for ingestion, enrichment, outreach-send queue, and email-event webhook processor assume a queue boundary (job dispatch is mocked). When the queue technology (likely Redis-backed) is selected, add T-4 integration tests that verify job enqueue and dequeue behaviour against a real in-process queue or test container.

### Open — T-5 E2E coverage gap tracking

Any flow added to `command-center/artifacts/user-journey-map.md` that does not have a corresponding `tests/e2e/<flow>.spec.ts` file is an open gap. As of v6 architecture authoring, all 13 flows (F1–F15) are mapped but no spec files are written yet — this is expected at architecture phase. Gap tracking resolves as E2E specs are authored wave by wave once Chrome binary is installed.

### Deferred to H2 — Performance baseline (T-7)

Lighthouse CI budget is defined but not CI-gated in MVP. Promote to merge-blocking gate when the first performance regression is observed or when H2 begins.

### Deferred to H2 — Multi-tenant isolation tests

IDOR tests cover single-workspace cross-user isolation (Tier 3 in test-writing-principles.md). Full multi-tenant workspace isolation (Feature #20, pilot-partner workspace) is an H2 feature; its isolation tests are deferred until H2 scope is active.
