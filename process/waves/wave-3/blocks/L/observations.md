# Wave 3 — L-2 Distill Observations

Synthesized from wave-3 artifacts (AppShell + role-aware dashboard shell + per-route RBAC + role-aware nav).
Wave-1 archive (`process/waves/_archive/wave-1/blocks/L/observations.md`) and wave-2 archive
(`process/waves/_archive/wave-2/blocks/L/observations.md`) reviewed in full (OBS-1..OBS-6 and OBS-1..OBS-5
respectively). Six observations evaluated; all six are supported by cited evidence. Ranked strong → informational.

---

## OBS-1: Adversarial /review of auth/RBAC diffs catches critical logic bugs that unit tests and the gate miss

**Title:** Run an adversarial diff review on every RBAC/auth-boundary diff; unit tests pass while the guard logic has silent fail-open or stale-privilege paths.

**Source:**
- `process/waves/wave-3/stages/B-6-review.md` Phase 2: "/review found 2 CRITICAL: (a) fail-open drift — empty `@Roles()` no-ops (guard returned `true` on `required.length === 0`); (b) stale-privilege — guard trusted the SuperTokens session claim mirror without re-verifying against app-DB `users.role`." Both were FIXED (commit `5635c35`) with 20 regression tests covering fail-closed, DB-wins, normalization, and layout-5xx.
- `process/waves/wave-3/stages/T-2-unit.md`: "217 tests … apps/api 48+1skip (compliance RBAC matrix + fail-closed empty-@Roles + DB-wins-over-stale-claim + di-boot)." These regressions exist BECAUSE /review found the bugs; the prior unit run (before fix-commit `5635c55`) passed without catching either CRITICAL.
- `process/waves/wave-3/stages/V-1-karen.md` Finding 7: confirms both fixes are real and executable in deployed code, not comment-only claims (fail-closed at `roles.guard.ts:96-98`; DB-authoritative re-verify at `roles.guard.ts:115-118`).
- `process/waves/wave-3/stages/V-1-jenny.md` Finding 3 / Block 2 RBAC matrix: both 403 and 200 directions verified live at deployed `935b847`.
- `process/waves/wave-3/stages/B-6-review.md` final_verdict + `process/waves/wave-3/blocks/B/gate-verdict.md`: head-builder Phase 1 APPROVED the diff BEFORE /review (critical bugs were present, gate missed them); /review in Phase 2 found both.

**Severity:** strong

**Candidate principles file:** VERIFY

**Confirmation status:** FIRST-OBSERVATION

**Systemic framing:** The B-6 Phase-1 gate (head-builder review of the overall diff) approved the branch while two CRITICAL RBAC logic errors were present — a fail-open on `@Roles([])` and a stale-privilege path trusting the session claim rather than the DB row. Both are invisible to unit tests that mock the guard or construct the service directly; neither trips a CI lint or typecheck. The missing automated safeguard is a mandatory adversarial diff review step (the `/review` skill) scoped specifically to RBAC/auth-boundary diffs, separate from the general build-gate review. The wave-3 B-6 procedure invoked `/review` as a Phase-2 step after Phase-1 APPROVED; the two CRITICALs were found in Phase 2. Without that second step, both bugs would have shipped and been verified green by all test layers.

---

## OBS-2: A shared role→routes map that drives both RBAC enforcement and nav visibility prevents nav-shows-what-RBAC-denies drift by construction

**Title:** Keep role→route allowances in a single shared package exported to API enforcement and nav rendering; separate lists drift.

**Source:**
- `process/waves/wave-3/stages/V-1-jenny.md` Block 3 nav audit: all four roles' sidebar nav sets exactly match the `roleRoutes.allowedRoles` entries in `packages/shared/src/rbac.ts`; no hardcoded nav lists in API or web code paths (verified by grep — only `page.tsx` cosmetic card checks, not nav/access decisions).
- `process/waves/wave-3/stages/V-1-karen.md` Finding 2: "No hardcoded nav list" (Sidebar.tsx comment line 11 verified); nav⊆RBAC confirmed structurally — each `navItem.allowedRoles` references the SAME array literal as the route entry's `allowedRoles` (rbac.ts:65-203).
- `process/waves/wave-3/stages/B-6-review.md` Phase 1 rationale: "grep of enforcement/nav paths finds NO hardcoded role sets … nav⊆RBAC contract holds by construction AND is asserted by a bidirectional inverse-drift test plus an 18-row exact-equality pin of the P-4 matrix in rbac.test.ts."
- `process/waves/wave-3/stages/T-3-contract.md`: "rbac.test 105 (roleRoutes completeness vs pinned matrix, rolesForRoute/canAccess per role, nav⊆RBAC by construction — THE load-bearing invariant contract-tested)."
- `process/waves/wave-3/stages/P-3-plan.md` Architecture delta 3, rejected alternative: "nav list in web + route-roles in API, kept in sync by convention — Guaranteed drift over time; rejected outright."

**Severity:** strong

**Candidate principles file:** BUILD

**Confirmation status:** FIRST-OBSERVATION

**Systemic framing:** The plan-authoring gap this observation closes is the temptation to keep two separate lists — one for nav visibility, one for route enforcement — and promise to keep them synchronized by convention. The wave-3 P-3 plan explicitly evaluated and rejected that pattern. The correct structural safeguard is a single shared type source where each route entry's `allowedRoles` field is shared by reference between the nav renderer and the `@Roles()` decorator. Without this structure, nav-shows-item / RBAC-denies-route is an undetectable drift class: the nav renderer and the route guard read different data, both appear correct in isolation, and the only observable symptom is a live 403 after a click on a visible nav item. The T-3 contract test that asserts nav ⊆ RBAC-allowed for every role is the machine-checkable expression of this rule.

---

## OBS-3: P-4 security-scope tightened gate with forced two-iteration Phase 2 catches real spec-vs-journey-map and role-matrix gaps before B-block

**Title:** The security-scope tightened P-4 gate's mandatory two-iteration Phase 2 is load-bearing; a single jenny pass would have missed the route and matrix gaps that surfaced in iteration 1.

**Source:**
- `process/waves/wave-3/blocks/P/gate-verdict.md` Phase 2 section: "Iteration 1: jenny BLOCK — 2 findings: (HIGH) `/` route drift (journey-map row 4 `/`=authed Dashboard vs plan `/dashboard`+public `/`); (MEDIUM) role→route/nav matrix unspecified vs journey-map persona columns." These findings were doc-level only (no P-0/P-1 rework needed) but were genuine spec-vs-journey-map gaps.
- `process/waves/wave-3/blocks/P/gate-verdict.md` Iteration 2: "jenny APPROVE — resolved 2/2 (route reconciled + internally consistent across spec/plan/decisions/journey-map; pinned matrix faithfully matches journey-map persona columns row-by-row)." Karen APPROVE stood (claims unchanged; matrix now explicit).
- `process/waves/wave-3/blocks/P/gate-verdict.md` B-block execution notes: "B-1: author packages/shared/src/rbac.ts `roleRoutes` FROM the pinned matrix (spec addendum table) — do NOT improvise role sets." This note exists only because iteration 1 forced the matrix to be made concrete before B-block started.
- `process/waves/wave-3/stages/V-1-jenny.md` Block 3 verdict: the pinned matrix is verified exact in the deployed artifact ("Exact match to the pinned matrix / journey-map persona columns"). The fix was doc-level at P-4; if it had shipped to B-block uncorrected, `rbac.ts` would have been authored from an improvised or stale matrix, and B-block or T-block would have been the first catch point.
- `process/waves/wave-3/stages/P-3-plan.md` P-4 remediation section: lists both corrections (canonical route + pinned matrix) as post-iteration-1 additions to the plan.

**Severity:** warning

**Candidate principles file:** none (the gate procedure itself is documented in the brain block files; the observation validates that the two-iteration requirement earns its cost on auth/RBAC waves, but the rule is the gate's own spec, not a new principle to encode)

**Confirmation status:** FIRST-OBSERVATION

**Systemic framing:** The security-scope tightened gate at P-4 mandates that Phase 2 run two iterations when jenny BLOCKs (jenny reviews; issues are remediated at the doc level; jenny re-reviews). Without the second-iteration obligation, a single jenny pass that returns BLOCK would either pause for rework (breaking the loop) or be waived. The iteration-1 jenny BLOCK in wave 3 was genuine: the plan referred to `/dashboard` as the canonical authed route while the journey map specified `/`, and the role→route/nav matrix was left unspecified (leaving `rbac.ts` to be improvised at B-1 rather than authored from a pinned source). Both gaps were corrected at P-4 doc-level (zero P-0/P-1 rework needed), which is the correct, low-cost fix point. Had they been discovered at B-6 or T-3, the cost would have been a B-block route rename and a T-3 matrix correction under time pressure.

---

## OBS-4: NestJS DI boot crash when a guard injects a repository that is not EXPORTED from the module where the guard is CONSUMED (CONFIRMS-PRIOR wave-2 OBS-3/OBS-4 NestJS DI/boot theme)

**Title:** When a NestJS guard constructor-injects a repository, that repository must be EXPORTED from the module the guard is consumed in, not just from the module where it is defined.

**Source:**
- `process/waves/wave-3/stages/C-2-deploy-and-verify.md` "Supersedes" note and boot-clean verification section: "prior C-2 FAIL — api crash-loop on `8a5854a` — RolesGuard could not resolve AuthRepository in ComplianceModule … fixed at `935b847` (AuthModule now EXPORTS AuthRepository)." Boot logs at `935b847` show `ComplianceModule dependencies initialized` + `Nest application successfully started` with zero `UnknownDependenciesException`.
- `process/waves/wave-3/stages/V-1-karen.md` Finding 3: "`auth.module.ts:33` `exports: [SessionGuard, RolesGuard, AuthRepository]`. ComplianceModule imports AuthModule (`compliance.module.ts:17`) so RolesGuard can construct in that DI context. Both confirmed in code." Also: "DI boot fix honestly recorded — C-2-deploy-and-verify.md documents the prior C-2 FAIL … not hidden."
- `process/waves/wave-3/stages/B-6-review.md` Phase 2, INFO item: "INFO nav client-presentational → accepted (server-enforced; documented invariant)." The DI boot fix is part of the Phase-2 fix-commit `5635c35` and is covered by a regression test (`di-boot ComplianceModule/AuthModule` — `T-2-unit.md`).
- Wave-2 archive OBS-3 (`process/waves/_archive/wave-2/blocks/L/observations.md`): "SuperTokens.init() must run in bootstrap before NestFactory.create() — the NestJS lifecycle is divided into two phases: module graph construction and application initialization." Wave-2 OBS-4: "TypeScript `import type` erases DI metadata; unit tests that construct services directly will not catch this." Both were FIRST-OBSERVATION in wave-2.

**Severity:** warning

**Candidate principles file:** BUILD

**Confirmation status:** CONFIRMS-PRIOR wave-2 OBS-4 (DI token resolution at deploy vs CI; also thematically linked to wave-2 OBS-3 — NestJS two-phase lifecycle as repeated failure domain)

**Systemic framing:** The wave-2 OBS-4 identified that NestJS DI boot crashes are invisible to unit tests that construct services directly. Wave 3 surfaces the same failure domain from a different angle: a guard that constructor-injects a repository will boot correctly in the module that DEFINES both, but crashes in any CONSUMING module that imports the guard without also exporting the repository. The plan-authoring gap is the absence of a constraint that says "when a guard holds DI dependencies, those dependencies must be explicitly exported from every module from which the guard is imported." No existing test layer exercises this path: unit tests inject mocks directly, integration tests use `TestingModule` which resolves providers differently from the production bootstrap, and CI returns green. The correct mitigation (a DI-boot integration test that creates a full `TestingModule` importing the consuming module — here `ComplianceModule` — rather than the defining module) is the same fix prescribed by wave-2 OBS-4. Wave 3 confirms that the OBS-4 mitigation gap (absent consumer-module DI-boot test) persists and produces a production crash in a new context.

---

## OBS-5: pnpm-workspace.yaml overrides (wave-2 OBS-1, DEFERRED carry-forward — wave 3 did not re-fire)

**Title:** Transitive HIGH-sev audit advisories in pnpm 10+ require a pnpm-workspace.yaml override, not a package.json override. (Carry-forward; no new wave-3 instance.)

**Source:**
- `process/waves/wave-3/stages/B-0-branch-and-schema.md`: "Deps: lucide-react@1.23.0 added to apps/web (committed). No other deps." No new external SDK introduced this wave.
- `process/waves/wave-3/stages/P-3-plan.md` Dependencies section: "NONE new. Confirmed: No new external SDK this wave … No bundle/runtime/license concern introduced." SDK pre-build checklist explicitly noted as not triggered.
- Wave-2 archive OBS-1 (`process/waves/_archive/wave-2/blocks/L/observations.md`): marked "confirmed-and-ready: promote to BUILD-PRINCIPLES at the next BUILD-touching wave with no further confirmation required," with pre-vetted 2-line form.
- No `pnpm audit` FAIL or new advisory appears in wave-3 stage files (`T-1-static.md` / `C-1` / `C-2` artifacts show no audit findings).

**Severity:** warning

**Candidate principles file:** BUILD

**Confirmation status:** CONFIRMS-PRIOR wave-1 OBS-1 + wave-2 OBS-1 (confirmed across 2+ waves; ready for promotion — did not re-fire this wave because no new SDK was introduced)

**Systemic framing:** Wave 3 introduced only `lucide-react` (a UI icon library with no deep transitive dependency tree and no known high-severity advisories). The pnpm-workspace.yaml override constraint did not trigger because no new server-side SDK was added. This is not a failure of the pattern — it is an absence of the stimulus. The observation is carried forward as confirmation-eligible, not as a new firing. The wave-2 determination ("promote at the next BUILD-touching wave with no further confirmation required") holds; wave 3 is a BUILD-config-touching wave (lucide-react dep added) but the pattern did not re-fire. Head-learn should weigh whether the pre-vetted 2-line form should be promoted this wave (clearing the carry-forward queue) or deferred to a wave where the pattern actually fires again.

---

## OBS-6: Wave-2 E2E spec assertions become stale when a subsequent wave renames the canonical authenticated route

**Title:** Playwright specs that assert a specific post-auth redirect URL must be updated atomically when the target route changes in a later wave.

**Source:**
- `process/waves/wave-3/stages/T-5-e2e.md` "Pre-existing auth.spec.ts findings" section: "auth.spec.ts 'login success' — expects redirect to `/dashboard` after login form submission. Root cause: wave-3 moved the authenticated dashboard from `/dashboard` to `/`. The live site correctly lands on `/` after login but the wave-2 spec still asserts `/dashboard`. … auth.spec.ts 'accept-invite happy path' — same root cause: `/dashboard` no longer exists; `/` is correct per wave-3." Both classified as "test-spec staleness (wave-3 route change superseded the /dashboard route)."
- `process/waves/wave-3/stages/T-5-e2e.md` Summary: "7/7 PASS" for wave-3 RBAC+AppShell scenarios, but the wave-2 auth.spec.ts assertions on `/dashboard` remain as known failing product-bug artifacts at the spec level.
- `process/waves/wave-3/blocks/P/gate-verdict.md` Phase 2 Iteration 1 remediation: the canonical dashboard route was reconciled from `/dashboard` to `/` at P-4, and a B-block note says "login success redirect → `/`." The E2E spec was not updated atomically alongside the route rename.
- `process/waves/wave-3/stages/V-1-jenny.md` Key intent check 3: "Is `/` correctly authed now per P-4 reconciliation? — YES (307→/login). Wave-1 public health-landing at `/` is superseded." Confirms the live route is `/`, not `/dashboard`.

**Severity:** informational

**Candidate principles file:** T-5

**Confirmation status:** FIRST-OBSERVATION

**Systemic framing:** When a wave renames the canonical post-auth redirect target (here `/dashboard` → `/`), any existing Playwright spec that asserts a redirect to the old path becomes a failing test at T-5 without a code defect. The missing automated safeguard is a convention that route-rename commits must include a grep for the old route string in the `e2e/` directory and update any URL assertions in the same commit or the same B-block. Without that convention, the wave-2 spec was left asserting `/dashboard`, which the live site never returns after wave 3, producing two persistent failing test cases that must be tracked as "known spec-staleness" rather than product bugs. The defect class is not the rename itself but the absence of a co-update discipline for E2E assertions that reference canonical route strings.

---

## Promotion-eligibility summary

### CONFIRMS-PRIOR (promotion-eligible this wave)

| Obs | Title (abbreviated) | Confirms | Candidate file | Severity | Promotion note |
|---|---|---|---|---|---|
| OBS-4 | NestJS guard DI: consuming module must export the injected dependency | wave-2 OBS-4 (DI token resolution domain) + thematic OBS-3 | BUILD | warning | Promotion-eligible; 2-wave DI/boot crash theme confirmed. One-rule-per-file cap applies. |
| OBS-5 | pnpm-workspace.yaml overrides (carry-forward) | wave-1 OBS-1 + wave-2 OBS-1 | BUILD | warning | Confirmed-and-ready (pre-vetted form in wave-2 archive); did not re-fire this wave. Head-learn decides whether to clear the carry-forward queue now or hold. |

Note: OBS-4 and OBS-5 both target BUILD-PRINCIPLES. The one-rule-per-file-per-wave cap means at most one can be promoted this wave. OBS-5 is pre-vetted and already confirmed; OBS-4 is newly confirmed but the consuming-module DI constraint is complementary (not duplicative) to wave-2 OBS-4's "use value imports" rule. Stack-rank: OBS-5 first (already confirmed-and-ready with pre-vetted form, clearing a queue), then OBS-4 (newly confirmed, strong BUILD lesson). Unless head-learn judges OBS-4 as more impactful, the queue-clearing argument favors OBS-5.

### FIRST-OBSERVATION (deferred — awaiting a second wave to confirm)

| Obs | Title (abbreviated) | Candidate file | Severity |
|---|---|---|---|
| OBS-1 | Adversarial /review catches CRITICAL RBAC bugs that unit tests + gate pass | VERIFY | strong |
| OBS-2 | Single shared role→routes map prevents nav-shows-what-RBAC-denies drift | BUILD | strong |
| OBS-3 | P-4 two-iteration security gate is load-bearing on auth/RBAC waves | none | warning |
| OBS-6 | Route-rename commits must atomically update E2E URL assertions | T-5 | informational |

OBS-1 is the highest-priority first-observation (strong, VERIFY, no current VERIFY rule). OBS-2 is high-value but also strong and would go to BUILD, where the per-file cap already applies if OBS-4 or OBS-5 promotes. If both OBS-2 and OBS-4/OBS-5 are strong BUILD candidates, the cap means OBS-2 must defer to a future wave where it can confirm. OBS-3 has no candidate file (validates an existing brain gate, not a principle we author); deferred to see if it recurs. OBS-6 is informational, T-5 already has Rule 1 (real-browser E2E on auth waves) — OBS-6 would be a complementary but weaker Rule 2 candidate; deferred.

---

## Head-learn L-2 promotion disposition (gate — synthesis only; head-learn makes the final call)

This is the synthesizer's recommendation, not a binding promotion. Head-learn runs karen and makes the final decision.

**Recommended promotion: OBS-5 → BUILD-PRINCIPLES (pre-vetted form, clearing the wave-2 carry-forward queue).**
Pre-vetted 2-line form from wave-2 archive: `Resolve transitive high-severity audit advisories via pnpm-workspace.yaml overrides, not package.json. / Why: In pnpm 10+ the overrides key lives in pnpm-workspace.yaml, not package.json.`

**Alternative promotion: OBS-4 → BUILD-PRINCIPLES (newly confirmed DI export constraint).**
Proposed 2-line form (pre-draft for karen): `When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard. / Why: NestJS DI resolves constructor tokens at the consuming module boundary, not the defining module.`

Both are within format limits and falsifiable; only one can go per the cap. Karen vetting + head-builder sign-off required before any commit.
