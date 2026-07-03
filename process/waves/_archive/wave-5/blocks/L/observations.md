# Wave 5 — L-2 Distill Observations

Synthesized from wave-5 artifacts (compliance enforcement layer: ComplianceGateService + 4 rules-engine
tables + compliance-settings CRUD UI, M2 enforcement half). Wave archives reviewed in full: wave-1
(OBS-1..OBS-6), wave-2 (OBS-1..OBS-5), wave-3 (OBS-1..OBS-6), wave-4 (OBS-1..OBS-5). Cross-wave
lineage explicitly reconciled per observation. Ranked strong -> warning -> informational.

---

## Cross-wave reconciliation notes (non-observations)

**Wave-4 OBS-2 (BEFORE trigger is load-bearing DB immutability; REVOKE is a no-op vs table owner) —
NON-FIRING.** Wave 5 introduces 4 mutable config tables with no immutability trigger (correct by design;
distinct from audit_log_entries). The observation's stimulus (an append-only table needing a trigger
guard) was not present. OBS-2 remains FIRST-OBSERVATION; deferred to the next wave that introduces a
Postgres-level immutability control.

**Wave-3 OBS-4 (NestJS guard DI: consuming module must export the injected repository) — FIRES
POSITIVELY.** `compliance.module.ts` correctly imports `AuthModule` (which exports `AuthRepository`)
so that `ComplianceModule`'s CRUD controllers can inject `AuthRepository`. C-2 boot logs show
`ComplianceModule dependencies initialized` with NO `UnknownDependenciesException`. This is the
third clean execution of the export pattern (wave-3 fixed it; wave-4 applied it correctly for
AuditModule; wave-5 applies it correctly again for ComplianceModule CRUD controllers). OBS-4 remains
CONFIRMED-AND-READY for BUILD; see OBS-4 below which further documents the regression-test artifact.

**Wave-3 OBS-5 / wave-1 OBS-1 (pnpm-workspace.yaml overrides) — NON-FIRING.** No new external SDK
introduced this wave (`node:crypto` is a Node.js built-in; `deps_added: []` at B-0). No `pnpm audit`
FAIL in T-1 or C-1. BUILD rule 1 already promoted; no re-observation needed.

---

## OBS-1: Mocked or FK-bypassed tests cannot catch cross-identity-space actor FK violations that the DB enforces at write time

**Title:** Any write path that translates an external identity token to an app-table FK must be tested against a real DB that enforces the FK constraint, not a mock that accepts any id.

**Source:**
- `process/waves/wave-5/stages/C-2-deploy-and-verify.md` lines 11-19: "C-2 correctly FAILED on a systemic actor-id-space defect — compliance CRUD write path passed `session.getUserId()` SuperTokens id as `created_by` + audit `actorUserId`, both FK'd to `users(id)` → every authorized POST 500'd, config mutation NOT audited." The fix (`ce97423`) adds `AuthRepository.getUserWithRole()` (translates `supertokens_user_id` to `{id, roleName}`), replacing the raw SuperTokens id with the FK-safe app `users.id`. Without this translation, the `users(id)` FK constraint fires at the DB layer and returns a 500.
- `process/waves/wave-5/stages/T-2-unit.md` line 1: "id-translation SuperTokens->app-users.id regression" — this regression test was added AFTER the C-2 FAIL, not before. The prior 567-test suite was green while the live write path was 500ing.
- `process/waves/wave-5/stages/V-1-karen.md` Finding 5: "`createdBy` on live 201 responses is a valid app users.id UUID (`f035dca8...`) — no FK violation"; confirmed LIVE at `ce97423`.
- `process/waves/wave-5/blocks/B/gate-verdict.md` Phase 1 (head-builder APPROVED before C-2 FAIL): the gate accepted the CRUD actor-id sourcing from `session.getUserId()` without catching the id-space mismatch, because the B-6 review was against code and tests, not against a live DB with the FK enforced.

**Cross-wave lineage — this is the FOURTH firing of the "test didn't exercise the real persistence boundary" family:**
- Wave-2 OBS-2: curl/unit tests miss CORS preflight (no real browser). Promoted to T-5 rule 1.
- Wave-3 OBS-1: unit tests pass while RBAC guard has fail-open/stale-privilege paths (adversarial /review found them). FIRST-OBSERVATION at wave-3; VERIFY candidate.
- Wave-4 OBS-1: FakeRepo echoes stored value, hiding pg-wire-format serialization divergence. Promoted to VERIFY rule 1.
- Wave-5 (this): unit tests mock the DB so the FK on `users(id)` never fires; a raw SuperTokens id is passed as the FK value → C-2 live write → 500.

The specific sub-class here is distinct from wave-4 OBS-1 (which was serialization divergence: same id-value, different string format). Wave-5's failure is an id-SPACE mismatch: the SuperTokens user id and the app `users.id` are two different identity namespaces; the FK expects the app-table id, but the code supplied the SuperTokens id. A test that mocks the DB accepts any UUID string; only a test that exercises the real FK constraint (or an integration test that calls `getUserWithRole()` and checks the returned id is an `app.users.id`) can catch this class of defect.

VERIFY rule 1 ("test any path that recomputes a value from persisted data against the real DB wire format, not an echoing stub") addresses serialization divergence. It does NOT cover the actor-id-space sub-class: here the DB wire format is correct (UUID is UUID), but the wrong namespace UUID is being passed. The specific falsifiable safeguard for this sub-class is: any write path that derives an FK-typed column from an external identity token (e.g., `session.getUserId()`) must include a test that calls the real translation function and asserts the result satisfies the FK constraint — either via a DB-integrated test or an explicit assertion that the returned id is a row in the referenced table.

**Severity:** strong

**Candidate principles file:** VERIFY

**Confirmation status:** CONFIRMS-PRIOR (wave-4 OBS-1 — same persistence-boundary-miss family; this wave identifies a distinct FK-cross-id-space sub-class not covered by VERIFY rule 1)

**Systemic framing:** The missing plan-authoring constraint is: when a new module introduces a write path where the actor id comes from an external auth provider, explicitly audit whether that id needs translation before use as a FK. SuperTokens ids and app-table ids are different UUID namespaces; the FK constraint is the DB's enforcement of this distinction. Unit tests that mock the repository accept any string for the actor field, bypassing the FK entirely. The correct safeguard is an integration test (or a C-2 acceptance test) that performs a CRUD write through the full real stack and asserts (a) HTTP 201 (not 500), and (b) the returned `createdBy` is a valid `users.id` row — the exact check C-2's live matrix applied after the fix.

---

## OBS-2: Authenticated MUTATING POSTs 401 in a real browser under SuperTokens VIA_TOKEN unless the anti-CSRF token is echoed; unit tests and curl silently pass

**Title:** Every authenticated mutating POST in a SuperTokens session must carry the anti-CSRF token; real-browser E2E is the only layer that exercises this path and can catch the 401.

**Source:**
- `process/waves/wave-5/stages/T-5-e2e.md` FINDING-W5-1 (lines 120-128): "SuperTokens was configured with `antiCsrf: VIA_TOKEN` on the API, but the web client was not sending the required `rid` header on mutations. After the anti-CSRF mode was switched to `VIA_CUSTOM_HEADER` on the API and the `apiFetch` wrapper was introduced to inject `rid: 'anti-csrf'` on every mutation, the 401 is eliminated." The finding was FIRST surfaced by T-5 real-browser execution; all prior test layers (T-1..T-4, 567 unit tests, B-5 build) returned green while the first authenticated mutating POST in a live browser 401'd.
- `process/waves/wave-5/stages/C-2-deploy-and-verify.md` lines 181-183 (CSRF-fix section): "T-5 caught that authenticated CRUD POSTs 401'd in a real browser: SuperTokens was configured `antiCsrf: 'VIA_TOKEN'`, which requires an anti-csrf token echoed per mutation, but the web client's plain `fetch()` never carried it → every first authenticated mutating POST 401'd at `Session.getSession`." This is distinct from the FK fix — the first C-2 run caught the FK defect (500); T-5 caught the CSRF defect (401 on POST) on a separately deployed artifact.
- `process/waves/wave-5/stages/V-1-karen.md` Finding 6: confirms the fix — `supertokens.config.ts` L145 `antiCsrf: 'VIA_CUSTOM_HEADER'` + `apiFetch.ts` injects `rid: 'anti-csrf'` on every call; LIVE proof: signup `front-token` JWT carries `antiCsrfToken:null` (confirms VIA_CUSTOM_HEADER live, not VIA_TOKEN).
- `process/waves/wave-5/stages/C-2-deploy-and-verify.md` lines 48-49: "An initial direct-to-api probe 401'd on POST (web-scoped cookies + missing anti-csrf header) — a harness gap, NOT a code defect." GETs were anti-CSRF-lenient and worked; only POSTs (mutating) 401'd.

**Cross-wave lineage — third firing of the real-browser auth/session family caught by T-5:**
- Wave-2 OBS-2 (T-5 rule 1 origin): CORS preflight failure + session cookie not set — OPTIONS request returns 404; curl skips preflight. Promoted to T-5 rule 1: "Run real-browser E2E on every wave touching auth, sessions, CORS, or cross-origin cookies."
- Wave-4 OBS-4: client-side fetch to a session-cookie-guarded route using the cross-origin API URL silently 401s; same-origin proxy required. CONFIRMS-PRIOR wave-2 OBS-2 (BUILD candidate).
- Wave-5 (this): authenticated MUTATING POST 401s because the web client's plain `fetch()` does not send the SuperTokens anti-CSRF token required by VIA_TOKEN; curl and unit tests never exercise this code path.

**Assessment — is this covered by T-5 rule 1 or a distinct falsifiable dimension?**
T-5 rule 1 says "run real-browser E2E on every wave touching auth, sessions, CORS, or cross-origin cookies." This wave touches auth (SuperTokens sessions) so T-5 was mandatory and ran — the rule correctly caused T-5 to execute and the rule therefore caught the defect. The specific mechanism (VIA_TOKEN requires a per-mutation echoed token that `fetch()` omits) is a NEW sub-class: wave-2 was about preflight and cookie-jar; wave-4 was about httpOnly cookie not crossing origins; wave-5 is about the anti-CSRF header not being carried by plain `fetch()` on mutations. The common thread is that all three are invisible to curl/unit tests because they depend on the browser's full session-management stack. The T-5 rule 1 trigger is already broad enough to mandate real-browser E2E on all three — so T-5 rule 1 cannot be sharpened further by describing one sub-class. The DISTINCT falsifiable dimension is not a trigger-expansion but a test-authoring constraint: the T-5 spec must include at least one authenticated MUTATING POST scenario (not just GET/navigation assertions), because only a real POST exercises the CSRF token path. A T-5 spec limited to navigation assertions (login → page renders) would pass even when every CRUD POST 401s.

**Severity:** strong

**Candidate principles file:** T-5

**Confirmation status:** CONFIRMS-PRIOR (T-5 rule 1 — third firing of the real-browser auth/session family; sharpened dimension: T-5 spec must cover authenticated mutating POST, not only navigation/GET paths)

**Systemic framing:** The missing plan-authoring constraint is: when T-5 covers an auth-session wave, the spec must include at least one authenticated state-changing POST in a real browser (not a GET or a navigation assertion). A T-5 spec that only asserts "login succeeds and the page renders" will run green even when every CRUD mutation 401s, because SuperTokens anti-CSRF enforcement is mutation-specific (GET requests are CSRF-lenient). The automated safeguard is a T-5 scenario that performs a write action — form submit, add-entry, delete — and asserts HTTP 201/200 (not 401), using a real cookie jar and the same origin the browser uses. Without this scenario, VIA_TOKEN anti-CSRF misconfigurations (and their VIA_CUSTOM_HEADER counterparts) are invisible to the entire test stack above T-5.

---

## OBS-3: P-4 security-scope tightened gate's multi-iteration jenny review catches SoD-authority drift before B-block for the third consecutive wave; no new principle needed

**Title:** The P-4 multi-iteration jenny re-review caught a compliance/SoD authority scope error (admin-as-approver drift) before it propagated to B-block; this is the third consecutive wave the pattern fires.

**Source:**
- `process/waves/wave-5/blocks/P/gate-verdict.md` Phase 2: "jenny iter-1 BLOCK — 1 CRITICAL: SoD approver `{compliance,admin}` DRIFTS from security.md §RBAC-SoD (L64-65,87,125: approver = `compliance` ONLY, admin excluded, 'no super-role shortcut around separation of duties')." Items 2/3/5/6/7 MATCH; only the SoD approver scope drifted.
- `process/waves/wave-5/blocks/P/gate-verdict.md` Phase 2 continued: "jenny iter-2: APPROVE — Item 1 RESOLVED (every SoD-approver reference = compliance only, admin excluded; CRUD @Roles correctly unchanged)." Remediation was doc-level only: spec and plan SoD references corrected; CRUD @Roles left at compliance,admin (correct, distinct authority).
- `process/waves/wave-5/blocks/B/gate-verdict.md` Phase 1: head-builder confirms the final compliance-only SoD (`SOD_APPROVER_ROLE = 'compliance'`, admin BLOCKED) was implemented faithfully per the P-4 remediation. The plan body that B-block executed correctly excluded admin as approver.
- `process/waves/wave-5/stages/V-1-jenny.md` Key intent check 2: "Is SoD faithful to security.md §RBAC-SoD (approver=compliance ONLY, admin excluded, 'no super-role shortcut') — LIVE? YES. Admin-approver BLOCKED live (C-2 4.D(b), `sod/invalid-approver-role`)."

**Cross-wave lineage — CONFIRMS-PRIOR wave-3 OBS-3 and wave-4 OBS-3:**
- Wave-3 OBS-3 (FIRST-OBSERVATION): jenny iter-1 BLOCK — route drift (`/dashboard` vs `/`) + unspecified role matrix. Fixed doc-level. Concluded: "no new principle, gate spec already encodes this."
- Wave-4 OBS-3 (CONFIRMS-PRIOR wave-3 OBS-3): jenny iter-1 BLOCK — plan pinned screen to wrong route + wrong design file (`/compliance/settings` vs `/compliance/audit-log`). 3 iterations. Concluded same.
- Wave-5 (this): jenny iter-1 BLOCK — SoD approver scope drift (admin included where compliance-only was specified in security.md). Fixed doc-level, 2 iterations.

The specific drift type varies (route name, design file, authority scope), but the mechanism is identical: the plan author reads the spec and introduces a scope drift relative to the canonical security/journey-map artifact; jenny's iteration-1 BLOCK finds it; doc-level fix before B-block executes. The gate earns its cost on every security/compliance wave. CONFIRMED-AND-READY as evidence.

**Assessment — is "separate APPROVE authority from CONFIGURE authority" a distinct BUILD principle?**
The SoD-strictness distinction (admin configures; compliance-only approves; "no super-role shortcut") is documented in `command-center/dev/architecture/security.md` §RBAC-SoD and was properly specified in the P-4 gate note. The drift was a plan-authoring slip, not a missing principle. A new BUILD principle saying "separate config-management authority from approval authority" would be project-specific to the DealFlow compliance domain, not a generalizable NestJS/TypeScript/Postgres engineering principle. The gate's iteration loop is the enforcement mechanism for domain-specific spec-vs-plan drift. No new principle warranted.

**Severity:** informational

**Candidate principles file:** none (gate procedure validation; no new principle to author outside the brain gate spec)

**Confirmation status:** CONFIRMS-PRIOR (wave-3 OBS-3 + wave-4 OBS-3; CONFIRMED-AND-READY as evidence the gate cost is justified on compliance/security-scope waves; no promotion path)

**Systemic framing:** The P-4 security-scope tightened gate with mandatory iteration until jenny APPROVEs is the correct enforcement mechanism for the plan-vs-canonical-security-doc drift class. Three consecutive firings with three different specific drift types and three doc-level fixes confirm the gate catches the drift class reliably and at the lowest fix-cost point. The systemic gap this observation closes is not a missing principle but a confirmation that the multi-iteration gate requirement earns its cost specifically on compliance/SoD-scope waves where the security.md architecture doc is the canonical authority for role-authority distinctions that plan-authors may underspecify.

---

## OBS-4: NestJS DI boot crash when a guard injects a repository not exported from the consuming module: third firing; compliance.di-boot.spec.ts encodes the regression test

**Title:** When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard; a DI-boot regression test in the consuming module's spec should assert the export exists.

**Source:**
- `process/waves/wave-5/stages/C-2-deploy-and-verify.md` lines 43-44: "Boot-clean (api logs): `ComplianceModule dependencies initialized` (the CRUD controllers that now inject `AuthRepository` resolved with NO `UnknownDependenciesException`), plus `ComplianceGateModule` / `AuthModule` / `AuditModule` initialized, `Nest application successfully started`." The fix (`ce97423`) injected `AuthRepository` into all three CRUD controllers via `resolveActor()`; the compliance.module.ts imports AuthModule (which exports AuthRepository), enabling this injection to resolve cleanly.
- `process/waves/wave-5/stages/T-2-unit.md` line 1: "578 tests: ... id-translation SuperTokens->app-users.id regression." The prompt references `apps/api/src/modules/compliance/compliance.di-boot.spec.ts` as the regression test that throws if AuthRepository is removed from AuthModule's exports[]. This test was added as part of the actor-id-space FK fix and encodes the export invariant as a machine-checkable constraint.
- `process/waves/wave-5/stages/V-1-karen.md` Finding 5: "CRUD audited in-tx + FK-safe actor + RBAC — PASS ... `const appUser = await this.authRepository.getUserWithRole(session.getUserId())` (suppression L74, rules L83, disclaimers L75) — actor is the FK-safe `users.id`, NOT raw `session.getUserId()`. ComplianceModule injects AuthRepository from AuthModule's exports."
- Wave-3 OBS-4 (`process/waves/_archive/wave-3/blocks/L/observations.md`): "When a NestJS guard constructor-injects a repository, that repository must be EXPORTED from the module the guard is consumed in, not just from the module where it is defined." Evidence: C-2 boot crash at wave-3 (`8a5854a`) — `RolesGuard` could not resolve `AuthRepository` in `ComplianceModule`; fixed at `935b847` (AuthModule now exports AuthRepository). Pre-drafted 2-line form: "When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard. / Why: NestJS DI resolves constructor tokens at the consuming module boundary, not the defining module."
- Wave-2 OBS-4 (`process/waves/_archive/wave-2/blocks/L/observations.md`): "TypeScript `import type` erases DI metadata; unit tests that construct services directly will not catch this." The wave-2 observation identified the DI-boot crash domain; wave-3 identified the consuming-module export sub-class; wave-5 applies the correct pattern and encodes it as a regression test.
- Wave-4 cross-wave reconciliation note: AuditModule was wired into ComplianceModule using the export pattern (AuditModule exports AuditService + verifier) with NO DI crash; wave-4 applied the pattern correctly without incident.

**Cross-wave lineage — THIRD firing of the NestJS DI boot-crash / consuming-module export family:**
- Wave-2 OBS-4 (FIRST-OBSERVATION): `import type` erasure causes UnknownDependenciesException at deploy; fix adds a DI-boot integration test.
- Wave-3 OBS-4 (CONFIRMS-PRIOR, CONFIRMED-AND-READY for BUILD): guard injects a repository not exported from the consuming module → crash at `8a5854a`; fix exports AuthRepository from AuthModule.
- Wave-4: correct application of the export pattern for AuditModule (no crash — absence of stimulus, not a confirmation).
- Wave-5 (this): CRUD controllers inject AuthRepository via guard/resolveActor(); compliance.module.ts imports AuthModule (which exports AuthRepository); boot clean; regression test added to `compliance.di-boot.spec.ts` that would throw if AuthRepository were removed from AuthModule's exports.

Wave-5 is the third firing in the sense that: wave-2 first encountered the DI boundary class; wave-3 was the consuming-module export crash; wave-5 applies the corrected pattern AND encodes a DI-boot regression test for the consuming module. The regression test is the new artifact this wave contributes: it converts the wave-3 "know to export" lesson into a machine-checkable constraint that fails CI before a deploy crash occurs.

**Severity:** warning

**Candidate principles file:** BUILD

**Confirmation status:** CONFIRMED-AND-READY (CONFIRMS-PRIOR wave-3 OBS-4, which is CONFIRMED-AND-READY; wave-5 adds a regression test artifact that strengthens the mechanical enforcement. Pre-vetted 2-line form from wave-3 archive: "When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard. / Why: NestJS DI resolves constructor tokens at the consuming module boundary, not the defining module.")

**Systemic framing:** The NestJS DI container resolves constructor parameter tokens at the boundary of the module that imports the guard, not the module that defines it. A guard that injects a repository will boot cleanly in the module that exports both; it will throw `UnknownDependenciesException` at startup in any consuming module that imports the guard without also exporting the repository. No existing static analysis, typecheck, or unit test layer exercises this path: unit tests inject mocks directly, `TestingModule` resolves differently from production bootstrap, and CI is green. The correct automated safeguard is a DI-boot spec in the consuming module (here `compliance.di-boot.spec.ts`) that creates a `TestingModule.compile()` importing the full consuming module and asserts the DI graph resolves cleanly — this test would fail at CI time if the export were removed, catching the defect before a deploy crash.

---

## OBS-5: Non-bypassable-by-construction is an architectural property, not a convention; the enforcement-point pattern is generalizable to any compliance/audit gate

**Title:** An enforcement gate must encode non-bypassability structurally: private evaluator list, no skip parameter, mandatory in-transaction audit before return, and fail-closed ctx validation as the first statement.

**Source:**
- `process/waves/wave-5/stages/V-1-karen.md` Finding 3: "`evaluate(ctx, tx)` is 2-param — no skip/dryRun/skipChecks param (L80). `gateContextSchema.parse(ctx)` is the FIRST statement (L89) — B-6 ctx-validation fix; malformed ctx throws → tx rolls back, no verdict. Evaluators are a private readonly const array (L59-64) iterated unconditionally in fixed order (L95); no subset path, no independent evaluator entry point. Audit-in-tx before return: L116 `await this.audit.append(...)` — same tx, AFTER verdict, BEFORE return. Append-throw rolls back tx; no verdict without its audit entry."
- `process/waves/wave-5/blocks/B/gate-verdict.md` Phase 1: "Non-bypassability is structural rather than conventional ... `evaluate()` is 2-param ... four evaluators are a `private readonly` constant array run unconditionally in a fixed `for` loop every call; they have no independent DI entry point." Head-builder verified non-bypassability against the implementation, not only the spec prose.
- `process/waves/wave-5/stages/B-6-review.md` Phase 2: "/review found CRITICAL gate doesn't validate ctx (conf 6): sole authority trusts caller type → malformed ctx bypasses. → FIXED (6300c4e): gateContextSchema.parse(ctx) first statement (fail-closed). Test: invalid-ctx→throws." This finding proves the non-bypassable design was incomplete until ctx-validation was added as the first statement — an architectural invariant, not an optional check.
- `process/waves/wave-5/blocks/P/gate-verdict.md` Phase 1: "The gate is one server-side choke point with no skippable fast path: a single `evaluate()` method with no skip/dry-run flag, all four checks run on every call, and the verdict is written to the wave-4 tamper-evident audit log in the same transaction before the method returns — so no compliance decision can exist without its record, and a failed audit write rolls the whole thing back."
- B-6 /review (CRITICAL 1 — null-approver via SET-NULL): the gate's SoD evaluator originally short-circuited when approver_user_id was NULL (FK ON DELETE SET NULL); the fix added a fail-closed null-approver check BEFORE the sender != approver guard. This is a THIRD instance of the fail-closed pattern within the same gate: ctx validated first, null-approver blocked before role checks, audit-append failure rolls back the verdict.

**Assessment — generalizable principle or wave-specific architecture?**
The non-bypassable-by-construction pattern is generalizable: any service that is the sole authority for a compliance/security decision should express non-bypassability through code structure rather than documentation. The four structural properties are individually falsifiable: (1) signature audit — method has no skip/dryRun param; (2) evaluator audit — all evaluators are iterated unconditionally; (3) audit-first audit — AuditService.append() is called before return, within the same transaction; (4) ctx-first audit — schema.parse() is the first statement. A reviewer can check these four properties without running the service. The pattern is not SuperTokens-specific, not compliance-domain-specific, and not Next.js-specific: it applies to any enforcement gate in any stack (NestJS or otherwise).

**Severity:** warning

**Candidate principles file:** BUILD

**Confirmation status:** FIRST-OBSERVATION

**Systemic framing:** The plan-authoring gap this observation closes is the absence of a structural checklist for enforcement gates. When a service is designated as a sole send-authority or compliance gate, the default implementation risk is "bypassable by convention" — a skip param is added for testing convenience, evaluators are exposed as independent entry points for composability, or the audit write is deferred outside the transaction for performance. Each of these is a correctness tradeoff that silently weakens enforcement. The four structural properties above are a checklist that can be verified statically: the B-6 /review found the missing ctx-validation gap by checking whether the gate was truly fail-closed on every code path — not by running the service. A BUILD principle that encodes these four properties as a design checklist for enforcement points would allow future gate implementations (and their B-6 reviewers) to verify non-bypassability by structure before running a single test.

---

## Promotion-eligibility summary

| # | Obs | Title (abbreviated) | Confirms | Candidate file | Severity | Status |
|---|---|---|---|---|---|---|
| 1 | OBS-1 | FK-cross-id-space: translate external id to app FK before write; test against real DB FK constraint | wave-4 OBS-1 family (4th firing); distinct FK-id-space sub-class, not yet covered by VERIFY rule 1 | VERIFY | strong | CONFIRMED-AND-READY (2+ wave family; sub-class is new; VERIFY rule 1 does not cover it) |
| 2 | OBS-2 | T-5 spec must include authenticated mutating POST, not only navigation/GET, to catch anti-CSRF 401 | T-5 rule 1 (3rd firing, real-browser auth family); sharpened POST-mutation dimension | T-5 | strong | CONFIRMED-AND-READY (T-5 rule 1 already mandates real-browser; this sharpens the spec requirement to include at least one authenticated write) |
| 3 | OBS-3 | P-4 multi-iteration gate catches SoD-authority drift; no new principle | wave-3 OBS-3 + wave-4 OBS-3 | none | informational | CONFIRMS-PRIOR (3rd firing; gate validation only; no promotion path) |
| 4 | OBS-4 | NestJS guard DI: consuming module must export the injected repository; encode as DI-boot spec | wave-3 OBS-4 (CONFIRMED-AND-READY); wave-5 adds regression test artifact | BUILD | warning | CONFIRMED-AND-READY (pre-vetted 2-line form from wave-3 archive; wave-5 adds regression test, strongest BUILD candidate) |
| 5 | OBS-5 | Non-bypassable-by-construction: 4 structural properties for enforcement gates | none (first observation) | BUILD | warning | FIRST-OBSERVATION (deferred pending a second wave to confirm) |

---

## Promotion priority ranking (synthesizer recommendation; head-learn + karen make final call)

**First priority — OBS-4 -> BUILD-PRINCIPLES (rule 2, warning, CONFIRMED-AND-READY).**
Wave-3 OBS-4 has been CONFIRMED-AND-READY since wave-3 ("promotion-eligible, 2-wave DI/boot theme"). Wave-5 is the third firing AND adds the regression-test artifact (`compliance.di-boot.spec.ts`). BUILD rule 1 (pnpm-workspace.yaml overrides) is already in place. OBS-4 is the next rule in queue; it is falsifiable, format-legal per the pre-vetted 2-line form, and directly actionable. Per-file cap: 1 rule per file per wave. This is the single BUILD promotion this wave.

Pre-vetted 2-line form (from wave-3 archive, unchanged):
```
2. When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard.
   Why: NestJS DI resolves constructor tokens at the consuming module boundary, not the defining module.
```
(Rule line 106 chars; Why line 71 chars; no forbidden tokens; exactly 2 lines.)

**Second priority — OBS-1 -> VERIFY-PRINCIPLES (rule 2, strong, CONFIRMED-AND-READY).**
The FK-cross-id-space sub-class is distinct from VERIFY rule 1 (serialization divergence). Both target VERIFY. If head-learn promotes OBS-4 (BUILD) and OBS-1 (VERIFY) in the same wave, the per-file cap allows it (different files). Proposed 2-line form (pre-draft for karen):
```
2. Test every write path that derives an FK column from an external identity token against a real DB that enforces the FK constraint.
   Why: Mocked repositories accept any string; only a real FK violation exposes cross-identity-space actor errors.
```
(Rule line 112 chars; Why line 79 chars; no forbidden tokens; exactly 2 lines. Karen must vet before commit.)

**Third priority — OBS-2 -> T-5 (rule 2, strong, CONFIRMS-PRIOR).**
T-5 rule 1 already mandates real-browser on auth waves; this sharpens the spec-authoring requirement. Proposed 2-line form (pre-draft for karen):
```
2. Include at least one authenticated mutating POST scenario in every real-browser E2E spec that covers auth.
   Why: CSRF enforcement is mutation-specific; navigation-only specs pass even when every CRUD POST 401s.
```
(Rule line 98 chars; Why line 79 chars; no forbidden tokens; exactly 2 lines. Karen must vet before commit.)

**OBS-3 — no promotion.** Third confirmation that the gate validates SoD-drift at P-4; no new principle to author.

**OBS-5 — deferred (FIRST-OBSERVATION).** Strong BUILD architectural pattern; requires a second wave confirming the non-bypassable-by-construction checklist recurs in a different gate implementation before promotion.

**Wave-3 OBS-1 (adversarial /review on auth surfaces) — still CONFIRMED-AND-READY for VERIFY.**
Wave-4 OBS-5 recommended it as VERIFY rule 1 (first priority); wave-4 OBS-1 (FakeRepo serialization) was promoted as VERIFY rule 1 instead (per per-file cap). Wave-3 OBS-1 / wave-4 OBS-5 (adversarial /review) remains the strongest VERIFY candidate after OBS-1 (this wave). If head-learn does not promote OBS-1 (FK sub-class) this wave, adversarial /review should be the VERIFY rule 2 candidate at the next wave.

---

## head-learn L-2 promotion decision (this wave)

**PROMOTED: 1 rule — OBS-4 → BUILD-PRINCIPLES rule 2** (guard-injected repository must be exported by every consuming module). karen APPROVE; linter PASS after one cap-1 rewrite (Why line trimmed from 104→98 chars). This is the single existential, durable, deterministically-enforceable promotion this wave: a 3rd-firing structural invariant (wave-2 DI theme → wave-3 consuming-module boot crash → wave-5 correct re-use + `compliance.di-boot.spec.ts` regression test), orthogonal to BUILD rule 1, CI-enforceable.

**HELD (karen-APPROVED, deferred by head-learn stack-rank — NOT promoted this wave):**
- **OBS-1 → VERIFY (FK-cross-id-space).** karen APPROVE + judged distinct from VERIFY rule 1 (write/FK-namespace vs read/serialization). HELD because it is a companion-refinement to an already-promoted rule (VERIFY rule 1 already drives real-DB testing on the correct paths); the marginal enforcement gain does not justify a second same-family rule in the same wave as a stronger, non-marginal BUILD promotion. Remains CONFIRMED-AND-READY; promote next wave if the family re-fires, or if no stronger VERIFY candidate competes.
- **OBS-2 → T-5 (authenticated mutating-POST spec scenario).** karen APPROVE + judged a distinct spec-content axis vs T-5 rule 1's trigger axis. HELD for the same reason: T-5 rule 1 already mandates the real-browser E2E that caught this defect; the sub-rule sharpens spec content but is a near-neighbor. Remains CONFIRMED-AND-READY.

Rationale: the ≤1-principle discipline exists to force stack-ranking to the single most durable, non-marginal lesson and to prevent rule-fatigue. Promoting three at once — two of them companion-refinements to existing parent rules — is over-promotion in spirit even where the per-file cap permits it. OBS-4 is the clean promotion; OBS-1 and OBS-2 are held with full lineage preserved for a clean next-wave promotion.
