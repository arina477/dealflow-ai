# Wave 2 — L-2 Distill Observations

Synthesized from wave-2 artifacts (auth backbone: SuperTokens + NestJS + invite-only + RBAC data model +
auth screens). Five observations evaluated; all five are supported by cited evidence.
Wave-1 archive (`process/waves/_archive/wave-1/blocks/L/observations.md`) reviewed in full (OBS-1..OBS-6).

---

## OBS-1: Transitive HIGH-sev audit advisories in pnpm 10+ require a pnpm-workspace.yaml override, not a package.json override

**Title:** Every new SDK integration must be audited for transitive HIGH-sev advisories; the fix belongs in `pnpm-workspace.yaml` `overrides`, not in `package.json`.

**Source:**
- `process/waves/wave-2/stages/C-1-pr-ci-merge.md` — audit FAIL on first CI cycle: GHSA-p6gq-j5cr-w38f (HIGH) in `nodemailer` `<=9.0.0` (resolved `8.0.11`), transitive via `supertokens-node`. Fix: `nodemailer: '>=9.0.1'` added to `pnpm-workspace.yaml` `overrides` (pnpm 11), lockfile regenerated, `pnpm audit --audit-level=high` exit 0 on cycle 2. Fix committed `98eade8`; merged `bbae29b`.
- C-1 explicitly labels this "known wave-1 pattern (transitive high-sev in a SuperTokens/Nest dependency chain)" and notes the authorization path: "a minimal `pnpm.overrides` dependency-override is legitimate C/devops config — applied in-block, not routed to a B-stage."
- Confirms wave-1 OBS-1 (`process/waves/_archive/wave-1/blocks/L/observations.md` § OBS-1): wave-1 used the same pattern for multer >=2.2.0 in `pnpm-workspace.yaml`. Wave-2 recurrence on a different SDK (supertokens-node) and a different advisory (GHSA-p6gq-j5cr-w38f) confirms the pattern is structural, not incident-specific.
- Also confirms wave-1 OBS-4: fix applied as a patched-version override (not `ignoreGhsas` suppression); the advisory no longer resolves to a vulnerable version in the lockfile.

**Severity:** warning

**Candidate principles file:** BUILD

**Confirmation status:** CONFIRMS-PRIOR (wave-1 OBS-1; secondarily OBS-4)

**Systemic framing:** The plan-authoring gap is the absence of a pre-integration step that audits new SDK transitive dependency trees before the branch opens. `supertokens-node@24.0.2` introduced `nodemailer 8.0.11` transitively; the advisory existed at install time but was only surfaced when CI ran `pnpm audit --audit-level=high` at C-1. The missing safeguard is not the CI audit gate (which correctly fired), but a convention for pre-plan dep-audit of new SDKs so that the override can be drafted in B-0 alongside the install, eliminating a mandatory fix-up cycle at C-1. The pnpm-workspace.yaml placement is non-obvious (a pnpm-version-specific key location), so without a documented constraint, each new integration risks the same CI failure.

---

## OBS-2: Real-browser Playwright E2E is the only test layer that can detect CORS preflight failures and cross-origin session cookie defects in auth flows

**Title:** CORS preflight and cross-origin session cookie defects in auth flows are invisible to curl smoke, unit, contract, and integration tests; real-browser Playwright E2E is required to catch them.

**Source:**
- `process/waves/wave-2/stages/T-5-e2e.md` — Run 2 (superseded): FINDING-1 (OPTIONS preflight 404 → CORS TypeError, blocking login) and FINDING-2 (SuperTokens session delivered as headers not Set-Cookie, /dashboard bounced to /login) both caused real-browser test failures (e2e-1 FAIL, e2e-3 FAIL). All prior test layers (T-1 static, T-2 unit 61 tests, T-3 contract Zod, T-4 integration real-Postgres) returned green on the same code.
- `process/waves/wave-2/blocks/T/gate-verdict.md` (attempt 2 rationale): "two failures caught two CRITICAL browser-only defects that the API-curl smoke and all 50 RTL component tests missed... That is the antithesis of coverage theater: the E2E layer earned its cost by finding defects no other layer could."
- `process/waves/wave-2/stages/C-2-deploy-and-verify.md` (re-run #2 root-cause): "SuperTokens middleware and CORS registered after app.init() — OPTIONS preflights return 404." The fix (middleware/CORS registered before app.listen()) was only discoverable by a client that issues real OPTIONS preflight requests; curl bypasses CORS preflight entirely.
- Confirms wave-1 OBS-5 (`process/waves/_archive/wave-1/blocks/L/observations.md` § OBS-5): wave-1 predicted "real user flows will go unverified" if T-5 degrades to HTTP smoke. Wave-2 vindicated this: (a) Playwright binary absent → T-9 attempt 1 ESCALATED as infra-readiness hard-stop; (b) once binary available via pw-compat shim, T-5 caught the two CRITICAL bugs wave-1 predicted would be missed.

**Severity:** strong

**Candidate principles file:** T-5

**Confirmation status:** CONFIRMS-PRIOR (wave-1 OBS-5)

**Systemic framing:** curl and programmatic HTTP clients do not implement the browser's CORS preflight protocol: they skip the OPTIONS request that browsers send for cross-origin requests with non-simple methods or headers. As a result, a SuperTokens backend that mistakenly registers middleware after the router (returning 404 on OPTIONS) will appear correct to every curl-based test. Similarly, the SuperTokens SDK's session-transfer-method selection (`header` vs `cookie`) is only observable when a real browser attempts to persist the session cookie across navigation — server-side RTL/JSDOM tests never execute the browser's cookie jar. The missing plan-authoring constraint is: any wave that touches CORS configuration, SDK middleware ordering, or session-token transfer method must gate T-5 on a real browser binary. The automated safeguard gap is the absence of a pre-T-5 environment check that fails fast when no browser binary is present, rather than allowing the stage to degrade silently to HTTP smoke.

---

## OBS-3: NestJS bootstrap calls supertokens.getAllCORSHeaders() before onModuleInit runs; SuperTokens.init() must be called independently in bootstrap before NestFactory.create()

**Title:** SuperTokens.init() must run in bootstrap before NestFactory.create(), not inside onModuleInit, because NestFactory.create() does not fire lifecycle hooks.

**Source:**
- `process/waves/wave-2/stages/C-2-deploy-and-verify.md` (re-run #2 root-cause section): "main.ts calls `supertokens.getAllCORSHeaders()` inside `bootstrap()`, immediately after `NestFactory.create(AppModule)` and BEFORE `app.listen()`. `SuperTokens.init()` is invoked from `AuthModule.onModuleInit()`. `NestFactory.create()` does NOT run `onModuleInit` lifecycle hooks — those fire on `app.init()`, which happens implicitly inside `app.listen()`." Crash: `Error: Initialisation not done. Did you forget to call the SuperTokens.init function?` at deployment `9772b283`, confirmed in `deploymentLogs`.
- `process/waves/wave-2/stages/V-1-karen.md` (F3-a): confirmed working fix — `apps/api/src/main.ts` calls `initSupertokens(...)` BEFORE `NestFactory.create()`, then `app.enableCors(...)` and middleware registered BEFORE `app.listen()`.
- The defect was masked in local development (no live Core connection → early env-check exit) and undetected by all 61 CI tests (unit tests stub the module; no integration test boots the full app bootstrap sequence).

**Severity:** strong

**Candidate principles file:** BUILD

**Confirmation status:** FIRST-OBSERVATION

**Systemic framing:** The NestJS lifecycle is divided into two phases: module graph construction (NestFactory.create) and application initialization (app.init, deferred inside app.listen). Code in bootstrap() between these two calls executes in a partially-initialized application where no lifecycle hooks have fired. The P-3 plan wired SuperTokens.init() inside AuthModule.onModuleInit — a reasonable placement for modular initialization — without accounting for the constraint that bootstrap() calls supertokens.getAllCORSHeaders() before onModuleInit runs. The missing constraint at plan-authoring time is: SuperTokens.init() is a process-global singleton that must exist before any call to supertokens.* functions in bootstrap(); the only safe placement is before NestFactory.create(). No existing test layer exercised this path: unit tests construct modules directly (bypassing bootstrap()), integration tests use TestingModule (which calls init() internally and hides the ordering), and the CI environment lacks a live Core connection, causing an early exit before the ordering defect fires.

---

## OBS-4: TypeScript import type erases emitDecoratorMetadata; DI-injected classes must use value imports or the NestJS container cannot resolve them

**Title:** Using `import type` for DI-injected classes strips their runtime token, causing UnknownDependenciesException at deploy; unit tests that construct services directly will not catch this.

**Source:**
- `process/waves/wave-2/stages/C-1-pr-ci-merge.md` (boot-fix re-run, fix-cycle note): "the C-2 deploy attempt for wave-2 hit a NestJS DI boot crash (UnknownDependenciesException) at api bootstrap — DI-injected classes (AuthRepository, Reflector) were `import type`-only, so their runtime tokens were erased and the DI container could not resolve them." Branch wave-2-auth-boot-fix (commit `2719c2a`) converts those to value imports and adds a DI-boot regression test. PR #3, CI cycle 3 (SHA `aa6fc50`), merged `4e09807`.
- The prior CI run (cycle 2, PR #3 head `2719c2a`) passed typecheck, lint, build, and audit but failed only on `test` — unrelated to the DI erasure fix. The `import type` defect itself produced a green CI run on all 5 checks before the deploy exposed it.
- This class of defect is only visible when the full NestJS DI container is instantiated (e.g., via `TestingModule.createTestingModule({ imports: [AppModule] })`); the existing auth.service.spec.ts constructed the service directly, bypassing the container and its token-resolution step.

**Severity:** warning

**Candidate principles file:** BUILD

**Confirmation status:** FIRST-OBSERVATION

**Systemic framing:** TypeScript's `import type` syntax is erased entirely by the compiler; it leaves no runtime token for Reflect.metadata to record. NestJS DI resolves constructor parameter tokens via the emitDecoratorMetadata compile-time emission of those runtime tokens; when a token is erased, the container throws UnknownDependenciesException at bootstrap. The plan-authoring gap is the absence of an explicit constraint distinguishing type imports from value imports in DI-wired NestJS modules: both compile cleanly (TypeScript enforces type-correctness regardless), both pass linting, and both pass any unit test that constructs the class with mocked constructor arguments. The missing automated safeguard is a DI-boot integration test that creates a full NestJS testing module with real providers (not class-level construction with injected mocks), so that token-erasure defects surface at CI time rather than at deploy time. The fix commit (`aa6fc50`) added exactly this regression test, which is the correct mitigation.

---

## OBS-5: gh run watch --exit-status reflects the last-streamed job result, not the overall run conclusion; the merge signal must be derived from the run conclusion independently

**Title:** Do not use `gh run watch --exit-status` alone as the CI merge signal; always verify `gh run view conclusion=success` and `gh pr checks` independently.

**Source:**
- `process/waves/wave-2/stages/C-1-pr-ci-merge.md` (boot-fix C-1 fix-cycle, cycle 2 rejection + cycle 3 resolution): "The overall-conclusion verification (the trap that bit cycle 2): `gh run watch --exit-status` returned 0 — NOT trusted alone. `gh run view --json conclusion` → `status=completed | conclusion=success`. Per-job conclusions: build/audit/test/typecheck/lint all `success`. `gh pr checks 3` → all 5 required checks `pass`. Merge signal confirmed on three independent reads." Cycle 2 failed on `test` (2 suites failing `DATABASE_URL: Required`) while `gh run watch --exit-status` returned 0 because the last-streamed job (typecheck) passed.
- PR #3 cycle 2 result: watch exit 0, but `@dealflow/api#test` FAIL → run conclusion was FAILURE; correctly REJECTED without merge. The risk is merging on a false exit-0 when a non-final job fails.

**Severity:** warning

**Candidate principles file:** CI

**Confirmation status:** FIRST-OBSERVATION

**Systemic framing:** `gh run watch` streams job output in completion order, not in a fixed order; the command's exit code reflects the exit status of the last job whose output it streamed, which is non-deterministic with respect to which jobs passed or failed. A run with one failing job and one fast-passing job can return exit 0 if the passing job finishes last. The plan-authoring gap is the absence of an explicit verification protocol for the merge signal: any C-1 stage procedure that treats `watch --exit-status == 0` as the sole green signal has an undetected false-pass path. The missing safeguard is a two-step merge check: (1) `gh run view --json conclusion` must equal `success`, and (2) `gh pr checks` must show all required checks passing. These are independent signals that cross-validate the overall run verdict and the per-check verdicts.

---

## Promotion-eligibility summary

### CONFIRMS-PRIOR (promotion-eligible this wave)

| Obs | Title (abbreviated) | Confirms | Candidate file | Severity |
|---|---|---|---|---|
| OBS-1 | pnpm-workspace.yaml overrides for transitive HIGH-sev advisories | wave-1 OBS-1 (+ OBS-4) | BUILD | warning |
| OBS-2 | Real-browser E2E required for CORS/cookie auth defects | wave-1 OBS-5 | T-5 | strong |

Both OBS-1 and OBS-2 have appeared across 2+ waves and are eligible for promotion to BUILD-PRINCIPLES and T-5.md respectively, pending karen rule-quality vetting and approver sign-off (head-builder for OBS-1, head-tester for OBS-2). Per-file cap: maximum 1 rule promoted per file per wave.

### FIRST-OBSERVATION (deferred — awaiting a second wave to confirm)

| Obs | Title (abbreviated) | Candidate file | Severity |
|---|---|---|---|
| OBS-3 | NestJS: SuperTokens.init() before NestFactory.create() | BUILD | strong |
| OBS-4 | TypeScript import type erases DI metadata; use value imports | BUILD | warning |
| OBS-5 | gh run watch --exit-status is not a reliable merge signal | CI | warning |

All three are new this wave. Retained here for cross-wave synthesis. OBS-3 and OBS-4 both target BUILD-PRINCIPLES; note the one-rule-per-file-per-wave cap means only one can be promoted per future wave. OBS-3 has higher severity and broader applicability (any NestJS + external SDK with a process-global init singleton) and should be prioritized. OBS-4 has a concrete automated safeguard (DI-boot integration test) that reduces the priority of a written rule once the test is in place.

---

## Head-learn L-2 promotion disposition (gate)

**Promotions this wave: 1.**

- **PROMOTED — OBS-2 → `command-center/principles/test-layer-principles/T-5.md` rule 1** (severity strong, CONFIRMS-PRIOR wave-1 OBS-5). karen APPROVE (format + evidence-vs-claim + falsifiable/generalizable); deterministic linter OK (rule 93 chars, Why 98 chars, exactly 2 lines, no forbidden tokens). Committed `5c0eb6b`. Rule: "Run real-browser E2E on every wave touching auth, sessions, CORS, or cross-origin cookies."
- **DEFERRED — OBS-1 → BUILD (not promoted this wave).** OBS-1 independently clears the 2-wave-confirmation gate (recurs wave-1 OBS-1/OBS-4) and would be format-legal, but head-learn holds to **at most ONE principle promoted per wave**, prioritizing the existential reliability lesson (OBS-2, strong) over build-config hygiene (OBS-1, warning). OBS-1 is **confirmed-and-ready**: promote to BUILD-PRINCIPLES at the next BUILD-touching wave with no further confirmation required. Proposed 2-line form (pre-vetted for format): `Resolve transitive high-severity audit advisories via pnpm-workspace.yaml overrides, not package.json. / Why: In pnpm 10+ the overrides key lives in pnpm-workspace.yaml, not package.json.`
- OBS-3 / OBS-4 / OBS-5 remain FIRST-OBSERVATION; deferred per the 2-wave rule. If a future BUILD wave must choose among OBS-1 (confirmed), OBS-3, OBS-4, stack-rank OBS-1 first (already confirmed) unless OBS-3 recurs (strong + broader).
