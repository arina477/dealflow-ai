# C-2 — Deploy & verify (wave 3)

**Wave 3 scope:** AppShell + role-aware dashboard at `/` + per-route RBAC enforcement.
**Deploy commit:** `8a5854a` (full `8a5854ad04de4d3b888cd778a5351c947a9930b3`), main @ HEAD == origin/main.
**Mode:** automatic. **Gate owner:** head-ci-cd.

---

## Outcome (headline)

**ci_stage_verdict: FAIL.** The `dealflow-api` deployment on `8a5854a` **crash-looped on boot** with a
NestJS dependency-injection resolution error and never reached "Nest application successfully started."
`dealflow-web` deployed SUCCESS on `8a5854a`, but the wave's entire point — per-route RBAC enforcement,
served by the api — is **UNVERIFIABLE** because the api never booted. Per the Iron Law this is a code
(B-block) defect and is NOT fixed in C. Routed back to B-block.

**Production is SAFE.** Railway's immutable-deploy safety retained the last-good api deployment
(`ac721862`, version `bc558f7d`) as active; the FAILED `8a5854a` api build never took traffic. No outage.
No rollback mutation was required (the armed rollback path was not needed).

---

## Credential + provisioning (Action 0/1)

- Railway credential present and usable (token in `APP_RAILWAY_TOKEN`; `Project-Access-Token` header; deploy-scoped GraphQL probe returned `data.project` with no `errors`).
- Project `ce095f75-1f3d-4af9-939e-fe8532541475` (`app-arina-5ywq3s`), environment production `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`.
- Services confirmed (IDs match wave spec): dealflow-api `dcdb4ab4-…`, dealflow-web `06b07f19-…`, postgres `43bbb393-…`, supertokens-core `80790c7f-…`, supertokens-db `acf6eb46-…`.
- NO new infra, NO schema change, NO new env vars this wave (as scoped).

## Schema safety check (additive-only Drizzle guard)

- Diff `bc558f7d..8a5854a` contains **zero** application migration / `.sql` / drizzle files. Only `process/` transcript docs match `schema` (B-0-branch-and-schema.md — not code). **PASS — no migration, no destructive DDL.** Consistent with "NO migration this wave."

## Rollback path armed (before any mutation)

Cached last-good SUCCESS deployment IDs prior to triggering:
- api rollback target: `ac721862-1138-44da-8b24-3c4adbec24bd` (SUCCESS, version `bc558f7d`)
- web rollback target: `a4c60302-2c08-4abf-b426-1d41fca507d9` (SUCCESS)

## Deploy trigger (Action 2) — deploymentId captured

Updated api env `GIT_SHA=8a5854a` (targeted `variableUpsert`; other vars untouched — SUPERTOKENS_*, WEB_ORIGIN, INTERNAL_API_BASE_URL preserved and verified). Then `serviceInstanceDeployV2(commitSha: 8a5854ad…)` for both services — mutation returned deploymentId (guards against Railway "Wait for CI" phantom-skip; deploy was explicitly commanded, not webhook-inferred).

- api new deployment: `fa196291-8dad-4a23-9b4f-4e99b0a9005a`
- web new deployment: `89704a4a-05e9-4671-ab10-8545eb865648`

## Inline poll to terminal (Action 4, ≤10min budget)

| target | terminal status | elapsed |
|---|---|---|
| web (`89704a4a`) | **SUCCESS** | ~204s |
| api (`fa196291`) | **FAILED** | ~366s |

## Root cause (api boot failure) — classified, NOT fixed here

`deploymentLogs(fa196291)` — deterministic, repeated on both boot attempts:

```
[NestFactory] Starting Nest application...
[InstanceLoader] AppModule dependencies initialized
[ExceptionHandler] UnknownDependenciesException [Error]: Nest can't resolve dependencies of the
  RolesGuard (Reflector, ?). Please make sure that the argument AuthRepository at index [1] is
  available in the ComplianceModule module.
  type: 'RolesGuard', context.dependencies: [ Reflector, AuthRepository ], name: AuthRepository
```

**Diagnosis:** the new `RolesGuard` (`apps/api/src/modules/auth/guards/roles.guard.ts`) constructor-injects
`AuthRepository` at index [1] — this is the "guard now does a DB read" wiring the wave introduced. But
`ComplianceModule` (`apps/api/src/modules/compliance/compliance.module.ts`) registers `RolesGuard`
(as `APP_GUARD` or a controller-scoped guard) **without importing the module that provides/exports
`AuthRepository`**. Nest cannot construct the guard → boot crash → crash-loop → FAILED. This is precisely
the DI-wiring boot risk the wave flagged. It is a **B-block code defect**, not infra/env.

**Classification tag:** `debugging` / NestJS runtime DI resolution (application source). Route per Iron Law
back to B-block — fix `ComplianceModule` to import/provide `AuthRepository` (or the module that exports it),
commit + push, re-run C-1 CI, then re-enter C-2. Also note: `auth.di-boot.spec.ts` / `compliance.service.spec.ts`
exist in the diff but did not catch this — the DI graph is only fully resolved at real app bootstrap; a
B-5-level `app.init()` boot smoke or a compile-time DI test would have caught it pre-C.

## Live verification matrix — BLOCKED (api never booted)

The wave's load-bearing checks CANNOT be evaluated; api is not serving `8a5854a`:

| Check | Target | Result |
|---|---|---|
| /health version == 8a5854a | api | **FAIL** — serves `bc558f7d` (old good code; new build never took traffic) |
| boot clean ("Nest application successfully started", DB-read guard, compliance boot-assert non-empty roles) | api | **FAIL** — crash-loop on DI resolution before boot completes |
| compliance-role user → GET /compliance/summary → 200 | RBAC | **UNVERIFIABLE** — endpoint's api not booted on new code |
| advisor-role user → GET /compliance/summary → 403 | RBAC | **UNVERIFIABLE** |
| unauthenticated → GET /compliance/summary → 401 | RBAC | **UNVERIFIABLE** |
| login regression: sign in → session cookie → web `/` → 200 authed | login | **UNVERIFIABLE** — new web ↔ old api version mismatch; not a fair test |
| unauth → web `/` → redirect to /login | login | **UNVERIFIABLE** |
| /auth/*, /health ungated | api | **UNVERIFIABLE** on new code |

Health-check-mirage note: api `/health` returns HTTP 200 right now, but the body version is `bc558f7d`
(old), NOT `8a5854a`. Probing the global domain for a bare 200 would have fabricated a green — verdict is
grounded on the version field + the FAILED deploymentId, not on the 200.

## Canary (Action 5) — skipped

```yaml
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 real users < 1000); moot — api deploy FAILED, nothing new to canary."
```

## Production state after C-2

- api: serving last-good `bc558f7d` (`ac721862` SUCCESS active); the two `8a5854a` attempts (`fa196291`, `ffa7c317`) are FAILED and inactive. No traffic degradation.
- web: `8a5854a` SUCCESS live (`89704a4a`) — but now version-mismatched against the old api. Web should be reverted to its last-good (`a4c60302`) OR held until the api boot fix lands, at the founder/B-block's discretion during the fix cycle. Not reverted automatically to avoid a second unverified mutation; flagged for the fix wave.

---

## Verdict

```yaml
ci_stage_verdict: FAIL
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway api fa196291-8dad-4a23-9b4f-4e99b0a9005a: status FAILED on 8a5854a (NestJS DI UnknownDependenciesException: RolesGuard cannot resolve AuthRepository in ComplianceModule)"
  - "railway web 89704a4a-05e9-4671-ab10-8545eb865648: status SUCCESS on 8a5854a"
  - "api /health: 200 but version=bc558f7d (OLD) — new code NOT live; health-mirage avoided via version field"
  - "schema safety: diff bc558f7d..8a5854a has zero migration/.sql files — additive-only PASS"
  - "rollback armed pre-mutation: api ac721862 / web a4c60302 (SUCCESS) — not needed, immutable-deploy retained last-good"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: FAILED, commit: 8a5854a, deploymentId: fa196291-8dad-4a23-9b4f-4e99b0a9005a, active_version: bc558f7d, health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 8a5854a, deploymentId: 89704a4a-05e9-4671-ab10-8545eb865648, health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "0 DAU < 1000 threshold; also moot — api deploy FAILED"
canary_window: {}
canary_monitor_id: ""
canary_alerts: []
note: "api boot FAIL on 8a5854a = NestJS DI wiring defect (RolesGuard needs AuthRepository, ComplianceModule does not provide/import it). B-block code defect; Iron Law -> route back to B, do NOT fix in C. Production safe (old good code still serving). last-completed-action=Action 4 (inline-poll returned FAILED for api after 366s). Web SUCCESS but version-mismatched; hold/revert web during the api fix cycle."

head_signoff:
  verdict: REJECTED
  stage: C-2
  reviewers: {}
  failed_checks:
    - "api deployment reached SUCCESS on the exact merge commit (api FAILED — crash-loop on boot)"
    - "api boots clean: 'Nest application successfully started', guard DB-read wiring, compliance non-empty-roles boot-assert (crash before boot completes)"
    - "/health version == deployed hash (serves old bc558f7d, not 8a5854a)"
    - "RBAC live matrix compliance->200 / advisor->403 / unauth->401 (unverifiable; api not booted)"
    - "login regression: login works + web / renders authed (unverifiable; web<->api version mismatch)"
  rationale: >
    The dealflow-api deployment on 8a5854a crash-loops on boot with a deterministic NestJS
    UnknownDependenciesException — RolesGuard constructor-injects AuthRepository at index [1], but
    ComplianceModule (which registers the guard) does not import/provide the module that exports
    AuthRepository. The app never reaches "Nest application successfully started," so the entire wave
    deliverable (per-route RBAC enforcement served by the api) is unverifiable. This is a B-block code
    defect (module DI graph), not infra/env, so per the C-block Iron Law it is NOT fixed in C — it returns
    to the Build block. Schema safety passed (no migrations). Rollback was armed before mutating; it was
    not needed because Railway's immutable-deploy retained the last-good api (bc558f7d) as active, so
    production never degraded. Web deployed SUCCESS but is now version-mismatched against the old api and
    should be held/reverted during the fix cycle. No green may be fabricated from the api's stale-200
    /health — the version field proves the new code is not live.
  next_action: REWORK_B-block
```
