# Test-Writing Principles — <Your Project>

Master testing guide. Universal principles ship in this seed; project-specific patterns grow over time via L-2 distill into `command-center/principles/test-layer-principles/T-{1..9}.md`.

This file is the **how-to-write-tests** reference. Stage-routing rules (when each layer fires) live in `claudomat-brain/blocks/test/test.md` and the per-stage files at `claudomat-brain/blocks/test/stages/T-{1..9}-*.md`.

---

## Contract for new rules

Template:

```
### N. Imperative rule ending in a period.
Why: one declarative sentence.

(optional) Inline code snippet of 3-8 lines demonstrating the rule.
```

- Before adding: grep for the concept; do not add a near-dup.
- One sentence per line, short, commanding.
- No war stories, wave refs, `Context:`, `Cross-ref:`, or project/stack names in universal-rule bodies. Stack-specific rules belong in `command-center/principles/test-layer-principles/T-<N>.md`.
- Number sequentially; renumber on insert.
- Group under an existing H2 unless ≥3 new rules share a theme.
- Append-only at § Auto-Updated below; do NOT edit existing entries or reorder sections.

---

## 0. Agent Workflow

Complete every step before writing test code. Stop and report if any step cannot be completed.

- [ ] 1. Read this entire file + `command-center/artifacts/user-journey-map.md`.
- [ ] 2. Identify the active T-layer per `claudomat-brain/blocks/test/test.md`. Read `command-center/principles/test-layer-principles/T-<N>.md`.
- [ ] 3. Read the source file(s) under test. Identify exported functions/methods, parameter types, return types, thrown exceptions.
- [ ] 4. Read existing co-located test files. Adopt their naming, mock setup, import ordering. If none exist, default to § 5.
- [ ] 5. Identify the § 6 priority tier (Tier 1 / 2 / 3) for the subject.
- [ ] 6. List test cases before writing code: minimum one happy-path + one error-path per exported method.
- [ ] 7. Confirm which mocks are needed per § 7.
- [ ] 8. Write the tests.
- [ ] 9. Run the project's test command (per § 4) and confirm all pass.
- [ ] 10. If a new pattern surfaced, append to § 12 Auto-Updated using the Contract template.

---

## 1. V2 stage map (T-1 through T-9)

Tests authored at one layer should NOT duplicate work done at another.

| Stage | Layer | What it tests | Authored where |
|---|---|---|---|
| **T-1** | Static | Type-check + lint pass clean | CI config + `tsconfig` / linter config |
| **T-2** | Unit | Pure-function + module logic in isolation | co-located `*.test.*` / `*.spec.*` |
| **T-3** | Contract | API / SDK / shared-schema shape contracts | contract-test directory or co-located |
| **T-4** | Integration | DB + service + API integration with real or test infra | `tests/integration/` or co-located |
| **T-5** | E2E | User-flow correctness across deployed stack via browser | `tests/e2e/` (Playwright / Cypress / etc.) |
| **T-6** | Layout | Visual regression / Figma diff / spacing rhythm | screenshot baselines + diff tool |
| **T-7** | Perf | Core Web Vitals / bundle size / regression baselines | `tests/perf/` + perf budget files |
| **T-8** | Security | Auth smoke, CSRF, session, rate-limit, OWASP probes | `tests/security/` + `/cso` skill output |
| **T-9** | Journey | `command-center/artifacts/user-journey-map.md` regen + scenario smoke | The journey-map file + scenario fixtures |

T-1 / T-2 / T-3 fire on every wave with code changes. T-4–T-9 skip per the block dispatcher's per-stage skip rules.

---

## 2. Decision tree — what to test

```
Are you writing a test for...?
├── Backend service / business-logic method?
│   ├── Mock the data layer (unit, T-2) OR use real infra (integration, T-4)
│   ├── Test happy-path + error-path (throw, validation fail)
│   └── If financial / decimal-money: test arithmetic boundaries (Tier 1)
├── Backend controller / route handler?
│   ├── Use the framework's test harness + HTTP-level assertion
│   ├── Mock services / guards
│   ├── Test status codes + response shape (success + error envelopes)
│   └── Test authorization: role-guarded endpoints reject unauthorized roles
├── Frontend component?
│   ├── Query by role / label / text — NEVER by testId
│   ├── Use the framework's user-event API (not raw DOM events)
│   └── Test interactions + state changes + error states
├── Schema validator / type guard?
│   ├── Test valid data → success
│   ├── Test invalid data → failure
│   └── Test boundary values (min, max, edge cases)
└── Utility function?
    └── Test happy-path + edge cases (empty, null, boundary)
```

Mocking decision matrix: § 7.

---

## 3. Testing stack

Fill in at `claudomat init` from `project.yaml: stack.*` and the v6 test architecture branch. Stack-specific test patterns grow into `command-center/principles/test-layer-principles/T-<N>.md`, NOT here.

| Tool | Purpose | Config |
|---|---|---|
| _(your unit / integration test runner)_ | T-2 / T-4 layers | _(config path)_ |
| _(your HTTP / SDK test harness)_ | T-3 contract layer | _(config / test-helper path)_ |
| _(your component test library)_ | Frontend tests at T-2 / T-5 | _(config)_ |
| _(your E2E browser tool)_ | T-5 layer (Playwright / Cypress / Selenium) | _(config)_ |
| _(your visual-regression tool)_ | T-6 layer (if applicable) | _(config + baseline path)_ |
| _(your perf / bundle-size tool)_ | T-7 layer (if applicable) | _(config + budget file)_ |
| _(your linter)_ | T-1 layer | _(config path)_ |
| _(your type checker)_ | T-1 layer | _(command)_ |

---

## 4. Running tests + CI requirements

### Local development

```bash
# Fill in project's actual commands at claudomat init
# <test-runner>          # Run all tests
# <test-runner --filter> # Run a specific package or layer
# <typecheck-command>    # Type-check the project
# <lint-command>         # Lint the project
```

### Before submitting a PR (B-6 Review → C-1 PR & CI)

All MUST pass locally before pushing:

1. Lint clean (T-1 input)
2. Type-check clean (T-1 input)
3. All tests pass (T-2 / T-3 / T-4 minimum)
4. Production build succeeds

CI (`C-1 PR & CI`) runs the same checks. **Failure in any step blocks merge.**

---

## 5. Test file conventions

- **Co-locate** test files at the exact same directory level as the file they test.
- **Naming pattern:** _(fill in: `*.test.ts` / `*.spec.ts` / `*_test.go` / `test_*.py` / etc.)_
- **One test file per source file.** Do not group unrelated subjects.
- **Test layer marker** (recommended): name files / directories so the active T-layer is obvious — e.g., `*.unit.test.*`, `*.contract.test.*`, `tests/e2e/*.spec.*`.

---

## 6. Risk-based test prioritization

Test in this priority sequence. If time is limited, stop at the highest-priority items.

### Tier 1 — Test immediately (financial + legal + security risk)

| Pattern | Why | Key tests |
|---|---|---|
| **State-machine money flows** | Multi-state entities with side-effects (charges, payouts, refunds) | State transitions, decimal-arithmetic boundaries, concurrent-write race conditions |
| **Authorization / dispute resolution** | Role-scoped authoritative actions | Transition matrix, resolution authorization, actor → transition mapping |
| **Identity verification** | Gates privileged capabilities | Webhook signature verification, level-gated feature enforcement |
| **Auth / session** | JWT lifecycle, session security | Token rotation, guard stacking order (401 before 403), malformed-token rejection |

### Tier 2 — Test before beta

| Pattern | Why | Key tests |
|---|---|---|
| **Provider webhooks** | External event ingestion | Signature verification, idempotency on duplicate webhook, rollback on failure |
| **Public query filters** | Visibility rules | Boundary validation, draft / removed states not exposed publicly |
| **Admin / privileged actions** | Audit trail, role escalation prevention | Role-escalation prevention, audit log writes |

### Tier 3 — Normal priority

| Pattern | Why | Key tests |
|---|---|---|
| **Unique-constraint + ownership** | Duplicate prevention, reviewer authorization | Duplicate rejection, actor-must-own-related-entity |
| **Multi-tenant isolation** | Per-user data boundaries | User A must not see user B's private data |
| **File uploads** | MIME validation | Reject non-allowed types, reject path-traversal filenames |
| **Standard CRUD modules** | Lower financial risk | Standard CRUD + validation |

---

## 7. Mocking rules

- **Mock at the boundary, not deeper.** Mock the data layer / external SDK / network — not internal helpers.
- **Unit tests mock; integration tests don't.** If a test needs a real DB / HTTP call, it's an integration test (T-4).
- **One mock setup per `describe` block.** Reset between tests with the framework's mock-clear primitive (`vi.clearAllMocks()` / `jest.clearAllMocks()` / etc.). Bleeding mock state across tests is the #1 source of flakes.
- **Never mock the system under test.**
- **Mock factories beat ad-hoc mocks.** When ≥3 tests use the same shape of mock data, extract a builder/factory to a test-helpers file.

---

## 8. Test data

### Integration tests (T-4)

- Use a dedicated test database. NEVER share with development or production.
- Reset state between tests (transaction rollback, `truncate`, or `pnpm db:seed:test`).
- Seed only what each test needs.

### Unit tests (T-2)

- Inline test data per `it` block. No shared state across tests in the same file unless explicitly justified.
- Avoid `beforeAll` hooks that mutate state — they make tests order-dependent and flaky.

### E2E tests (T-5)

- Use the prod-fixture registry at `command-center/testing/test-accounts.md` (gitignored). Never `*@example.test` or other dev-only seed credentials against production auth — those produce silent auth failures and false BLOCKED outcomes.

---

## 9. Security testing (T-8 layer)

Universal principles; project-specific probes grow into `command-center/principles/test-layer-principles/T-8.md`.

- **Test RBAC on every role-guarded endpoint.** Guards drift when routes are added without role annotations.
- **Test IDOR explicitly.** User A must not access user B's resources.
- **Test guard stacking order.** Authentication failures must return 401 BEFORE authorization failures return 403. A 403-before-401 reveals which routes exist.
- **Test malformed input on auth-bearing endpoints.** Malformed JWTs, expired tokens, tokens signed by the wrong key.
- **Test rate limiting + replay protection on mutating endpoints.** Especially webhooks, password reset, payment intents.

T-8 fires automatically when `wave_touches ∈ {auth, payments, sessions, csrf, rate-limit, user-creation}` per the V2 wave classification.

---

## 10. State machine testing

For any module with multi-state entities + transitions:

1. **Author the transition matrix as a test fixture** — explicit `(from-state, action) → to-state` table.
2. **Test every legal AND every illegal transition.** Illegal-from-this-state attempts must reject with the correct error type.
3. **Test concurrent transitions where applicable.** Race-condition behavior when two actors attempt the same transition.
4. **Test side effects.** State transitions that fire webhooks / emails / billing events must be tested with the side effect mocked at its boundary.

---

## 11. Coverage expectations

- **MUST:** Every new service method / API endpoint has at least one happy-path and one error-path test.
- **MUST:** Every bug fix includes a regression test that would have caught the bug.
- **SHOULD:** Tier 1 modules target 80% branch coverage.
- Other modules: quality over quantity, no enforced thresholds.
- Absence of a threshold is NOT permission to skip tests.

---

## 12. Anti-patterns — do not write tests like these

| Don't | Do |
|---|---|
| Assert the data layer was called | Assert the consumer-visible result is correct. Mock-call assertions tell you nothing about whether the code works. |
| `getByTestId('submit-btn')` | `getByRole('button', { name: /submit/i })`. Role/label queries double as accessibility checks. |
| Import `AppModule` / app-factory into a unit test | Instantiate only the providers under test with the rest mocked. |
| Mock-call counts bleed across `it` blocks | `afterEach(() => clearAllMocks())`. |
| `expect(...).rejects.toThrow('User not found')` | `expect(...).rejects.toThrow(NotFoundException)`. Messages are copy; types are contracts. |
| One user "sees their own message" claim = real-time works | Two clients (sender + receiver) OR verify socket-level network frames. The sender always sees their own message via REST/optimistic update. |
| Tester sees layout render → marks PASS | Read actual stat values, count rows, sample entity data — test beyond the layout guard. |
| Return inline findings only in parallel testing | Write the markdown report at the explicit path the orchestrator passed in. |

---

## 13. Auto-updated rules and patterns

Append project-discovered patterns / edge cases / rules not covered above. Follow the Contract at the top. Do NOT edit existing entries or reorder.

### Entries

_No entries yet. Append below this line using the template:_

```
### N. Imperative rule ending in a period.
Why: one declarative sentence.
(optional) Inline code snippet of 3-8 lines.
```

---

## 14. Production E2E testing — principles

Live testing against deployed environments using the project's E2E browser tool (Playwright / Cypress / etc.). Applies to any agent doing UI/UX or functional verification on production builds.

**Master rules** for production E2E live in § Rules (#11–22). Implementation patterns in § 15.

### Prod fixture registry

`command-center/testing/test-accounts.md` is the canonical, gitignored test-account registry. **Dev-seed credentials (e.g., `*@example.test`) MUST NOT be used against prod auth** — they produce silent auth failures + false BLOCKED outcomes. If a tester prompt passes a dev-seed email for prod, flag it as a prompt bug.

---

## 15. Production E2E testing — methodology

§§ 15.1-15.4 are codified in § Rules — see #13 (async instrumentation before navigation), #14 (network panel for async), #18 (no `window.<library>` checks for ES modules), #19 (no `el.onclick` checks for framework synthetic handlers).

### 15.5 Status taxonomy for production audits

Use this exact set when auditing routes for build/launch readiness. Each route gets exactly one symbol:

| Symbol | Meaning |
|---|---|
| ✅ | Live — page renders correctly with real content in production |
| 🟡 | Live but degraded — renders but missing data, broken interaction, or known minor issue |
| 🟠 | Coded but blocked — route exists in code but redirects/crashes/blank in production |
| ❌ | Not built — documented in flow but no matching route in code |
| 🚫 | Deferred — explicitly out of scope |

Token-gated routes (password reset, email verification, OAuth callback) that correctly render error states without their token are ✅, not 🟡 — they're behaving as designed.

### 15.6 Tester swarm pattern (T-5 E2E)

For wave verification, use a **N-tester swarm** (5 by default per the project's Playwright MCP allocation): N parallel tester invocations, one per Playwright MCP instance, each owning a non-overlapping scenario. Partition by user account + browser process. Different testers can use the same account if they're in different MCP processes (isolated localStorage); same account in the same process is forbidden.

### 15.7 Deliverable format for prod testing

Test reports MUST include:

- Per-fix verdict: PASS / PARTIAL / FAIL with concrete evidence
- Network panel evidence for any WebSocket / API / async behavior tested
- Console error capture (filter level: error)
- Screenshots saved with the consistent naming convention from the prompt
- Regression smoke pass results for prior fixes
- Markdown report at the explicit path provided in the prompt
- Browser closed at session end (if the project's E2E tool persists state across sessions, the rule is "do NOT `browser_close` mid-swarm" per `claudomat-brain/DISPATCHER.md` § Operational rules)

---

## Rules

Master non-negotiable rules. Every rule is enforceable; deviation requires an inline comment naming why.

### Code-level testing (§§ 0-13)

### 1. Co-locate test files next to source files.
Why: adjacency enables simple test-discovery patterns and keeps tests from drifting.

### 2. Use AAA (Arrange / Act / Assert) with comments in every test body.
Why: the three-block structure makes test intent readable at a glance.

### 3. Mock at the boundary; never load the full application into a unit test.
Why: full-app loads pull every dependency, slow the suite, and mask the unit under test.

### 4. Query frontend components by role, label, or text — never by testId.
Why: role/label queries double as accessibility checks.

### 5. Write at minimum one happy-path and one error-path per new method.
Why: a method that only passes the happy test is one null away from a 500 in production.

### 6. Run the project's test command and confirm passing before committing.
Why: local is cheaper than CI and never blocks the merge queue.

### 7. Append new rules to § 13 Auto-Updated using the Contract format.
Why: § 13 is the append-only log of project-discovered patterns; a shared format keeps it searchable.

### 8. Do not edit existing entries or reorder any section.
Why: edits destroy searchable history; reorder breaks external references to section numbers.

### 9. Test RBAC on every role-guarded endpoint.
Why: guards drift when routes are added without role annotations.

### 10. Test that user A cannot access user B's resources (IDOR prevention).
Why: cross-tenant authorization leaks are the most expensive class of security bug.

### Production E2E testing (§§ 14-15)

### 11. Before any UI / UX or functional test on production, read this file (especially §§ 14-15) and `command-center/artifacts/user-journey-map.md`.
Why: the journey map is the source of truth for what counts as a passing flow.

### 12. Test actual content (stat values, row counts, entity fields); never accept layout-only verification.
Why: "page renders" passes hide contract mismatches one layer deeper.

### 13. Install async instrumentation (WebSocket hooks, fetch interceptors) before navigating to the page that triggers them.
Why: instrumentation added after mount misses the events you're trying to capture.

### 14. Verify async behaviors via the network panel, not via DOM observation alone.
Why: DOM state is necessary but not sufficient evidence for socket, WebSocket, or long-poll correctness.

### 15. Test at least one edge case (invalid IDs, expired tokens, missing data) per fix verified.
Why: happy-path passes that crash on the empty case have not actually been verified.

### 16. Use one dedicated Playwright MCP instance per parallel tester; never call other instances.
Why: cross-contamination between parallel testers corrupts results and confuses synthesis.

### 17. Write the report file at the explicit path provided in the prompt.
Why: when N testers run in parallel, the orchestrator needs the file artifacts to synthesize.

### 18. Never check `window.<library> === undefined` to verify ES-module library state.
Why: ES module imports are not window globals; the check is meaningless.

### 19. Never check `el.onclick === null` (or equivalent) to verify framework synthetic handlers.
Why: React (and similar) synthetic handlers never appear as DOM properties.

### 20. Use cross-client verification for real-time behaviors when feasible; otherwise rely on network-layer evidence.
Why: single-client tests cannot distinguish socket delivery from REST refetch.

### 21. Test every relevant persona in the project's role enum: unauthenticated visitor + every authenticated role.
Why: "redirects to login when unauthenticated" is incomplete without "renders content when authenticated as the right role".

### 22. Use prod fixtures from `command-center/testing/test-accounts.md` for live E2E; never use dev-seed credentials against prod auth.
Why: dev-seed accounts produce silent auth failures + false BLOCKED outcomes against prod.

### 23. Never `browser_close` mid-swarm.
Why: closing the browser kills the MCP instance for subsequent batch agents. Only close at the very end of the swarm.
