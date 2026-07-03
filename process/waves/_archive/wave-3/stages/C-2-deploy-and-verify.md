# C-2 — Deploy & verify (wave 3) — RE-RUN after B-block boot fix

**Wave 3 scope:** AppShell + role-aware dashboard at `/` + per-route RBAC enforcement.
**Deploy commit:** `935b847` (full `935b84725a9b7a13fbeaf680970f45603fdba43e`), main @ HEAD == origin/main.
**Mode:** automatic. **Gate owner:** head-ci-cd.
**Supersedes:** the prior C-2 FAIL (api crash-loop on `8a5854a` — RolesGuard could not resolve AuthRepository in ComplianceModule). That B-block DI defect is fixed at `935b847` (AuthModule now EXPORTS AuthRepository) and re-verified live below.

---

## Outcome (headline)

**ci_stage_verdict: PASS.** Both `dealflow-api` and `dealflow-web` deployed **SUCCESS** on the exact merge
commit `935b847`. The api **booted clean** — deploymentLogs show `ComplianceModule dependencies initialized`
followed by `Nest application successfully started` + `API listening on port 3001`, with **zero**
`UnknownDependenciesException` (the prior crash cause is gone). `/health` serves `version: 935b847` (matches
the deployed hash — no health-mirage). The wave's load-bearing deliverable — per-route RBAC enforcement served
by the api — is **verified live**: compliance→200, advisor→403 (no leak), unauth→401. Login regression passes:
real login sets a first-party session cookie, authed web `/` renders a role-aware dashboard (not bounced),
unauth web `/` redirects to /login. Canary skipped (0 DAU < 1000). Production is on aligned `935b847` across
api + web.

---

## Credential + provisioning (Action 0/1)

- Railway credential present and usable (token from `~/.config/claudomat/runtime.env`, `RAILWAY_TOKEN`/`APP_RAILWAY_TOKEN`; `Project-Access-Token` header; deploy-scoped GraphQL probe returned `data.project` with no `errors`).
- Project `ce095f75-1f3d-4af9-939e-fe8532541475` (`app-arina-5ywq3s`), environment production `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`.
- Services confirmed (IDs match wave spec): dealflow-api `dcdb4ab4-…`, dealflow-web `06b07f19-…`, postgres `43bbb393-…`, supertokens-core `80790c7f-…`, supertokens-db `acf6eb46-…`.
- NO new infra, NO schema change, NO new env vars this wave (as scoped).

## Schema safety check (additive-only Drizzle guard)

- Diff `bc558f7d..935b847` contains **zero** application migration / `.sql` / drizzle files. The only `schema`-matching paths are `process/**/B-0-branch-and-schema.md` transcript docs (not code). Destructive-DDL scan (`DROP TABLE|DROP COLUMN|ALTER COLUMN|TRUNCATE|DELETE FROM`) over the delta returns **NONE**. **PASS — additive-only, no migration, no destructive DDL.** Consistent with "NO migration this wave."

## Rollback path armed (before any mutation)

Cached last-good SUCCESS deployment IDs prior to triggering:
- api rollback target: `ac721862-1138-44da-8b24-3c4adbec24bd` (SUCCESS, version `bc558f7d`) — was active before this deploy.
- web rollback target: `89704a4a-05e9-4671-ab10-8545eb865648` (SUCCESS, `8a5854a`) — was active before this deploy.
- Rollback NOT needed — both new deploys reached SUCCESS and booted clean; Railway immutable-deploy would have retained last-good had either failed.

## Deploy trigger (Action 2) — deploymentId captured

Updated api env `GIT_SHA=935b847` (targeted `variableUpsert`; verified other 20 vars untouched — SUPERTOKENS_*, WEB_ORIGIN, INTERNAL_API_BASE_URL, DATABASE_URL preserved; var_count stayed 21). Then `serviceInstanceDeployV2(commitSha: 935b847…)` for both services — each mutation returned a deploymentId (guards against Railway "Wait for CI" phantom-skip; deploy was explicitly commanded over GraphQL, not webhook-inferred).

- api new deployment: `9312744d-c0fb-4c32-94d9-325c30fd6d6f`
- web new deployment: `750184ad-961e-49de-beb3-20a9a96f17bf`

## Inline poll to terminal (Action 4, ≤10min budget)

Polled each deployment by its specific deploymentId (not edges[0]):

| target | trail | terminal status | elapsed |
|---|---|---|---|
| web (`750184ad`) | BUILDING → SUCCESS | **SUCCESS** | ~81s |
| api (`9312744d`) | BUILDING → DEPLOYING → SUCCESS | **SUCCESS** | ~222s |

Both confirmed `status: SUCCESS` with `meta.commitHash == 935b84725a9b7a13fbeaf680970f45603fdba43e`.

## Boot-clean verification (api DI fix — the load-bearing re-run reason)

`deploymentLogs(9312744d)` boot trail:

```
[NestFactory] Starting Nest application...
[InstanceLoader] AppModule dependencies initialized
[InstanceLoader] HealthModule dependencies initialized
[InstanceLoader] ComplianceModule dependencies initialized   <-- the module that crashed before, now resolves
[InstanceLoader] AuthModule dependencies initialized
[RoutesResolver] HealthController {/health}
[RoutesResolver] AuthController {/auth}
[RoutesResolver] ComplianceController {/compliance}
[RouterExplorer] Mapped {/compliance/summary, GET} route
[NestApplication] Nest application successfully started
API listening on port 3001
```

- POSITIVE: `Nest application successfully started` present. ✓
- NEGATIVE: `UnknownDependenciesException` / "can't resolve dependencies" / `[ExceptionHandler]` — **NONE**. ✓
- The `/compliance/summary` route is mapped and the compliance-controller boot-assert (fail-closed non-empty @Roles) did not throw. **BOOT CLEAN — DI fix confirmed live.**

## Health probe (Action 3) — version-grounded, not a bare 200

- `curl https://dealflow-api-production-66d4.up.railway.app/health` → HTTP 200, body `{"status":"ok","db":"ok","version":"935b847"}`. **version == deployed hash** — new code IS live (health-mirage explicitly avoided by asserting the version field, not the 200).
- web `https://dealflow-web-production-a4f7.up.railway.app/` reachable.

## Live RBAC verification matrix (cookie jar, fresh unique test emails, minted via POST /auth/invite)

Minted two fresh users via `POST /auth/invite {email, role}` → `POST /auth/signup {inviteToken, password}` (Set-Cookie session, role claim). `/auth/me` confirmed server-verified role claims (compliance / advisor). RolesGuard reads the role from the SuperTokens session claim, not client input.

| Check | Actor | Expected | Result |
|---|---|---|---|
| GET /compliance/summary | compliance-role (session cookie) | 200 `{pendingCount,items}` | **200** — `{"pendingCount":0,"items":[]}` (correct shape) ✓ |
| GET /compliance/summary | advisor-role (session cookie) | 403 deny, no leak | **403** — `{"message":"Forbidden","statusCode":403}` — no resource data, no role info ✓ |
| GET /compliance/summary | unauthenticated (no cookie) | 401 | **401** ✓ |

Enforcement is correct in both directions: compliance→200 and advisor→403 (not the inverse), unauth→401. This is exactly the enforcement the prior C-2 could not verify (api never booted).

## Login regression (load-bearing)

Login flows through `POST /auth/signin` (SuperTokens EmailPassword auto-route) via the web-origin same-origin rewrite (`next.config.ts` `/auth/signin` → api), so the session cookie is **first-party on the web domain**.

| Check | Expected | Result |
|---|---|---|
| login (correct password) | success + session cookie set | **`{status:"OK"}`** + first-party `sAccessToken`/`sRefreshToken` on web domain ✓ |
| login (wrong password) | rejected (not a rubber-stamp) | **`{status:"WRONG_CREDENTIALS_ERROR"}`** — success/failure distinguishable ✓ |
| authed web `/` (with session cookie) | 200 role-aware dashboard, NOT bounced | **200**, no redirect; compliance user sees Compliance nav (×9), advisor user sees Mandates nav — **role-aware, genuinely gated (not a static shell)** ✓ |
| unauth web `/` (no cookie) | redirect to /login | **307 → /login** ✓ |
| web /login page | renders | **200** ✓ |
| /auth/*, /health ungated | reachable on new code | AuthController {/auth} + HealthController {/health} mapped at boot; /health 200; unauth /compliance/summary 401 (allowlist RBAC only gates decorated routes) ✓ |

## Canary (Action 5) — skipped

```yaml
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 real users < 1000)."
```

## Production state after C-2

- api: serving `935b847` (`9312744d` SUCCESS active). Prior FAILED `8a5854a` attempts inactive; prior good `bc558f7d` (`ac721862`) superseded.
- web: serving `935b847` (`750184ad` SUCCESS active). **api + web now aligned on the same commit** — the version-mismatch flagged in the prior C-2 is resolved.

---

## Verdict

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway api 9312744d-c0fb-4c32-94d9-325c30fd6d6f: status SUCCESS, meta.commitHash 935b84725a9b7a13fbeaf680970f45603fdba43e"
  - "railway web 750184ad-961e-49de-beb3-20a9a96f17bf: status SUCCESS, meta.commitHash 935b84725a9b7a13fbeaf680970f45603fdba43e"
  - "api deploymentLogs: 'ComplianceModule dependencies initialized' + 'Nest application successfully started' + 'API listening on port 3001'; ZERO UnknownDependenciesException (DI boot fix confirmed live)"
  - "api /health: 200 {\"status\":\"ok\",\"db\":\"ok\",\"version\":\"935b847\"} — version matches deployed hash (no health-mirage)"
  - "RBAC live: compliance-role GET /compliance/summary -> 200 {pendingCount:0,items:[]}; advisor-role -> 403 {message:Forbidden,statusCode:403} (no leak); unauth -> 401"
  - "login regression: POST /auth/signin correct-pw -> {status:OK} + first-party session cookie; wrong-pw -> {status:WRONG_CREDENTIALS_ERROR}; authed web / -> 200 role-aware dashboard (compliance nav vs advisor Mandates nav differ); unauth web / -> 307 /login; /login -> 200"
  - "schema safety: diff bc558f7d..935b847 has zero migration/.sql/drizzle files, zero destructive DDL -> additive-only PASS"
  - "rollback armed pre-mutation: api ac721862 / web 89704a4a (SUCCESS) — not needed (both new deploys SUCCESS + clean boot)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 935b847, deploymentId: 9312744d-c0fb-4c32-94d9-325c30fd6d6f, health_url: "https://dealflow-api-production-66d4.up.railway.app/health", version_served: 935b847}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 935b847, deploymentId: 750184ad-961e-49de-beb3-20a9a96f17bf, health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "0 DAU < 1000 threshold"
canary_window: {}
canary_monitor_id: ""
canary_alerts: []
note: "C-2 re-run PASS on 935b847 (boot fix merged). api + web both SUCCESS + aligned on same commit. api boots clean (ComplianceModule resolves, Nest started, no UnknownDependenciesException). RBAC verified live (compliance 200 / advisor 403 / unauth 401). Login regression PASS (login works, authed / role-aware & not bounced, unauth->login). /health version==935b847. Schema additive-only. Rollback was armed (api ac721862 / web 89704a4a), not needed. Canary skipped (0 DAU)."

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Both dealflow-api and dealflow-web deployed SUCCESS on the exact merge commit 935b847 (deploymentIds
    9312744d / 750184ad, meta.commitHash matches, and 935b847 is main HEAD — provenance verified). The api
    booted clean: deploymentLogs show ComplianceModule dependencies initialized and Nest application
    successfully started with zero UnknownDependenciesException, proving the B-block DI export fix
    (AuthModule now exports AuthRepository) resolved the prior crash-loop. Health is version-grounded, not a
    bare 200 — /health returns version 935b847, matching the deployed hash, so the health-mirage failure mode
    is excluded. The wave's load-bearing per-route RBAC enforcement is verified LIVE against the deployed
    hash with fresh unique cookie-jar users minted via POST /auth/invite: compliance-role -> 200
    {pendingCount,items}, advisor-role -> 403 with no data/role leak, unauthenticated -> 401 — correct in
    both directions. Login regression passes: correct password yields {status:OK} + a first-party session
    cookie, wrong password yields {status:WRONG_CREDENTIALS_ERROR} (so success is genuinely distinguished),
    the authed web / renders a role-aware dashboard (compliance nav differs from advisor Mandates nav —
    proving real role-gating, not a static shell) and is NOT bounced, and unauth / redirects to /login.
    Schema safety passed (additive-only, zero migration/destructive DDL). Rollback was armed before mutating
    (api ac721862 / web 89704a4a) but was not needed. Canary skips per the 0-DAU < 1000 threshold. No green
    was fabricated: every check is grounded in the deployed 935b847 artifact (deploymentId + meta.commitHash
    + boot logs + version field + live authenticated probes), not in green CI or a stale-cache signal.
  next_action: PROCEED_TO_T
```
