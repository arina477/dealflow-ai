# C-2 — Deploy & verify (wave-5: compliance rules engine + non-bypassable pre-send gate, M2 enforcement)

**Owner:** head-ci-cd (spawn-pattern C-block head).
**Deploy commit:** `a58b699513248d93eaf8d8adbb2dc939f085fa3e` (`a58b699`).
**Platform:** Railway (GraphQL only; project `ce095f75…`, env `production` `0e84f0b6…`).
**Token:** `APP_RAILWAY_TOKEN` (DealFlow app credential; the brain's `RAILWAY_TOKEN` was absent, mapped `RAILWAY_TOKEN:=APP_RAILWAY_TOKEN`).
**Mode:** automatic.

## VERDICT: FAIL — route to B-block (Iron Law tripped)

The DEPLOY succeeded and is infra-green, but LIVE verification found a **systemic actor-id-space
defect** in the compliance CRUD write path that trips the Iron Law on two counts: **CRUD RBAC
broken** (every authorized POST returns HTTP 500) AND **config mutation NOT audited** (the in-tx
audit rolls back with the failed write). This is a B-block code defect, not an infra/env issue —
routed back per the C-block Iron Law (no debug-by-deploy; classify + return).

---

## SHA provenance (the anti-Ghost-Green check) — PASS
- CI on `main` for `a58b699`: run `28683534918`, all **5 jobs** `success` — **audit, lint, typecheck, build, test**. The `audit` (pnpm audit) gate passed.
- The immediately-prior commit `597ba85` had CI `failure`; `a58b699` ("fix require→aliased import … CI dist resolution") is the fix. The green is on the EXACT HEAD SHA, not a stale/cached sibling. No Ghost Green.
- Deployed commit (both services, via Railway `serviceInstanceDeployV2 commitSha`) == `a58b699` == CI-green SHA == HEAD. No `SKIPPED`.

## Step 1 — Env / secrets — PASS
- `AUDIT_LOG_HMAC_KEY` **SET** (+ `AUDIT_LOG_HMAC_KEY_VERSION`) on dealflow-api. No new env var this wave (as expected — key already set wave-4). Keyring found it at boot (no crash-loop).
- `GIT_SHA` set to `a58b699` on both services (the `/health` version source) via GraphQL `variableUpsert` before deploy triggered.
- `DATABASE_URL`, `WEB_ORIGIN`, `SUPERTOKENS_*`, `INTERNAL_API_BASE_URL` all bound. No missing-env-var boot risk.

## Step 2 — Migration 0003 (4 config tables + 3 partial-unique indexes) — PASS
- Mechanism: api `serviceInstance.preDeployCommand = ["pnpm --filter @dealflow/api exec drizzle-kit migrate"]` — one-shot, BEFORE the new image is routed traffic (correct additive-then-serve sequencing). Confirmed via GraphQL `serviceInstance` query.
- **Static analysis: strictly additive.** 3 new ENUM types, 4 `CREATE TABLE`, 4 FK constraints on the NEW tables (`ON DELETE set null`), 6 new indexes. ZERO `DROP` / `ALTER … DROP/ALTER COLUMN` / destructive DDL against existing tables. No lock on live-traffic tables → zero-downtime-safe. These are MUTABLE config tables (no immutability trigger, unlike `audit_log_entries`).
- Applied: api deploy logs show `[✓] migrations applied successfully!`
- **Post-deploy DB verification (live prod DB via temporary TCP proxy, deleted after use):**
  - `drizzle.__drizzle_migrations` count = **4** (0000–0003) — migration 0003 recorded.
  - 4 tables present: `compliance_approvals`, `compliance_rules`, `disclaimer_templates`, `suppression_list`.
  - 3 partial-unique indexes present with correct predicates:
    - `disclaimer_templates_jurisdiction_active_unique … WHERE (active = true)` — one active per jurisdiction.
    - `compliance_approvals_resource_approved_unique … WHERE (status = 'approved')` — one approved per resource.
    - `suppression_list_match_type_value_unique` (unique on match_type, value) — no duplicate suppressions.

## Step 3 — Redeploy + boot — PASS
- `serviceInstanceDeployV2(commitSha=a58b699…)` both services:
  - dealflow-api deployment `1e2840a5-1209-4326-8768-61e1a40a190f` → SUCCESS (~91s; BUILDING→DEPLOYING→SUCCESS).
  - dealflow-web deployment `ffdc7134-d74a-4ae7-834a-4f1cad22998b` → SUCCESS.
- Boot-clean (api logs): `ComplianceGateModule dependencies initialized`, `Nest application successfully started`, `API listening on port 3001`. No `UnknownDependencies`, no keyring throw.
- **CRUD controllers all registered:** `/compliance/rules` GET/POST/:id PATCH/:id DELETE; `/compliance/suppression` GET/POST/:id DELETE; `/compliance/disclaimers` GET/POST/:id PATCH; `/compliance/audit-log/verify` GET; `/compliance/summary` GET.
- Health probed against the api's OWN deployment URL (not a stale global route): `GET https://dealflow-api-production-66d4.up.railway.app/health` → `{"status":"ok","db":"ok","version":"a58b699"}`. Version == deployed SHA (health-check-mirage defeated).
- web `/login` → 200; `/` → 307→/login (unauth AppShell guard, correct); `/compliance/settings` → 307 (protected route redirect, correct).

## Step 4 — LIVE compliance verification — MIXED; **hard FAIL on the write/audit path**

### RBAC matrix (real SuperTokens sessions, delegated to deployment-engineer; verified against deployed api)
| Endpoint | compliance | admin | advisor | analyst | unauth |
|---|---|---|---|---|---|
| GET /compliance/rules | 200 | 200 | 403 | 403 | 401 |
| POST /compliance/rules | **500** | **500** | 403 | 403 | 401 |
| GET /compliance/suppression | 200 | 200 | 403 | 403 | 401 |
| POST /compliance/suppression | **500** | **500** | 403 | 403 | 401 |
| GET /compliance/disclaimers | 200 | 200 | 403 | 403 | 401 |
| POST /compliance/disclaimers | **500** | **500** | 403 | 403 | 401 |

- **Guard layer (read + auth) is CORRECT:** unauth→401, advisor/analyst→403, compliance/admin authorized on reads (200). The RolesGuard/SessionGuard RBAC allow-list works.
- **Write layer is BROKEN:** every authorized POST (compliance AND admin) returns **HTTP 500**, on all three write tables.

### ROOT CAUSE (pinned, not inferred) — actor-id-space mismatch → FK violation → tx rollback
- The compliance CRUD controllers derive the actor via `actorFromRequest()` → `session.getUserId()`, which returns the **SuperTokens** user id (text; e.g. `d771b4a8…`).
- `RulesService.createRule` (and suppression/disclaimers equivalents) pass that value into **two** FK-constrained spots, BOTH referencing `users(id)`:
  1. the table's `created_by` column → FK `compliance_rules_created_by_fk` / `suppression_list_created_by_fk` / `disclaimer_templates_created_by_fk` → `users(id)`.
  2. `AuditEntryInput.actorUserId` → FK `audit_log_entries_actor_user_id_fk` → `users(id)`.
- But `users.id` (uuid, app PK) and `users.supertokens_user_id` (text) are **DISTINCT columns with distinct values** (confirmed: compliance user `id=2b2017dc…` vs `supertokens_user_id=d771b4a8…`). The session's `getUserId()` yields the SuperTokens id, which is **never** a `users.id`.
- Therefore the INSERT violates the `created_by` FK, the whole `db.transaction` rolls back, and the request 500s. **Live evidence (api runtime logs):** `insert or update on table "compliance_rules" violates foreign key constraint "compliance_rules_created_by_fk"` (+ suppression + disclaimer variants); 11 FK violations across the test window.
- **Blast radius:** all three config-mutation write paths (rules, suppression, disclaimers). Every real authorized user hits this — it is NOT a test-harness artifact. Fix = translate `supertokens_user_id → users.id` before using it as the actor id (or re-key the FKs on `supertokens_user_id`). Backend NestJS/Drizzle defect → B-2.

### Config-mutation-audited — FAIL (consequence of the above)
- Because the write tx rolls back on the FK violation, the in-tx `AuditService.append('rule-change'/'suppression-change'/…)` verdict is **also rolled back**. No config change persists and none is audited. `entriesChecked` cannot increase. The wave's core acceptance criterion ("config changes are audited in-tx") is not satisfiable in the live deploy while this defect stands. (Note: the audit `actorUserId` FK would independently fail for the same reason even if `created_by` were fixed — both actor writes need the id-space fix.)

### Disclaimer versioning — NOT EXERCISABLE
- POST /compliance/disclaimers 500s (same FK defect), so the create→PATCH version-increment / one-active-per-jurisdiction behavior could not be exercised live. The partial-unique index that enforces the 1-active invariant IS present in the schema (Step 2), but the service path that relies on it is blocked by the write defect.

### The GATE (SoD compliance-only) — NOT EXERCISED LIVE; code-verified only
- The gate's `evaluate()`/`evaluateStandalone()` has no HTTP surface this wave (M6 send-path is its real caller, not built this wave) — expected.
- The scripted `evaluateStandalone` live check (seed approval + suppression, assert compliance-approver→allowed / **admin-approver→BLOCKED** / suppressed→blocked / verdict audited) was **NOT run**: the FK-defect discovery re-prioritized this stage to a FAIL/return, and seeding `compliance_approvals` for the gate script would itself hit the same `approver_user_id`→`users(id)` FK id-space question that the CRUD defect surfaced (the approval-creation path is M6, unbuilt). Running the gate script on a deploy already known to be returning to B would verify against soon-to-change code.
- **Code-level SoD IS confirmed present at a58b699** (read of `sod.evaluator.ts`): `SOD_APPROVER_ROLE = 'compliance'` EXACTLY; admin explicitly excluded → `sod` block `invalid-approver-role`; self-approval blocked; null-approver fails closed (`approver-unknown`); revoked blocked. Unit-proven (B-2: 158 tests, "SoD=compliance-only PROVEN"; compliance-gate.service.spec covers evaluateStandalone audits-in-tx + fails-closed). **The admin-approver-BLOCKED invariant is unit-proven but was NOT exercised live this stage.** T-8 Security must run the live SoD gate check on the fixed redeploy.

### Settings UI — partial
- web `/compliance/settings` protected route redirects unauth→login (307, correct). The 3 sections render for a compliance session (per B-3: 3-section CRUD UI shipped), BUT any create/save action from the UI hits the same 500 write defect — the UI cannot successfully persist a rule/suppression/disclaimer against this deploy.

### Regression (prior-wave) — PASS
- Login: web `/login` renders 200. Dashboard `/` → 307→/login unauth (correct AppShell guard).
- Read RBAC on `/compliance/audit-log/verify`: unauth→401 (guard active). Wave-4 audit-log integrity view path intact at the guard layer.
- api `db:ok` in /health confirms Postgres connectivity. No Redis/BullMQ in api deps this wave (M6+ scope) — N/A.

## Step 5 — Canary — SKIPPED
- Real-user traffic = 0 DAU < `canary_threshold_dau` 1000. Synthetic live verification above is the post-deploy signal.

## Rollback path (armed before deploy)
- Previous known-good cached PRE-deploy: dealflow-api `2b22927f-08ab-4681-83ec-4445c0cbcf3b` (commit `cd06e8a`, SUCCESS) + dealflow-web `ee02f22b-a82b-4953-90d4-bc84eefdcdc3` (commit `cd06e8a`, SUCCESS).
- **Rollback NOT triggered.** The a58b699 deploy is infra-healthy and boots clean; the defect is in the CRUD write path, not a crash-loop or outage. Reads work; the wave-4 backbone is unaffected. Reverting to cd06e8a would remove the (correct, additive) 0003 schema for no benefit. The correct remediation is a forward B-block fix + redeploy, not a rollback. Rollback remains armed if a regression is later found.

## Infra hygiene
- Temporary Railway TCP proxy on `postgres` (`reseau.proxy.rlwy.net:58514`, id `c8cd5ca7…`) created for live DB verification → **DELETED after use** (confirmed 0 proxies remain). No lingering public DB exposure. No secrets committed or logged.
- Test users provisioned by the RBAC probe (cleanup for T-block / N-block): `rbac-test-{compliance,admin,advisor,analyst}-1783113742..4@dealflow-c2rbac.test` (ids `9e829ba2…`, `562e9a84…`, `8531c183…`, `ceba7b79…`). Note: these were created via a direct-invite-insert path; the genuine app signup flow is what T-8 should use.

## Handoff to B-block (Iron Law route)
- **Classification:** backend (NestJS/Drizzle) actor-id-space defect in compliance CRUD services → B-2 backend.
- **Defect:** `session.getUserId()` (SuperTokens id) is passed directly as `created_by` and audit `actorUserId`, both FK'd to `users(id)`; the app keys SuperTokens identity on the separate `users.supertokens_user_id` column. Every authorized config write 500s (FK violation) and nothing is audited.
- **Fix direction (B-block owns; NOT applied here):** map `supertokens_user_id → users.id` in `actorFromRequest` (or a session→app-user resolver) before the CRUD services use it, so `created_by` and the audit `actorUserId` are valid `users.id` values. Re-verify: authorized POST → 201, config-mutation-audited `entriesChecked` increases, disclaimer versioning 1-active, and the live SoD gate script (admin-approver BLOCKED).
- After the B-fix is committed + pushed + CI-green, re-enter C-1 → C-2 for the corrected commit.

---

```yaml
ci_stage_verdict: FAIL
armed_verification_failed: false
verdict_source: railway github
verdict_evidence:
  - "railway dealflow-api: deployment 1e2840a5 SUCCESS, commit a58b699 (BUILDING→DEPLOYING→SUCCESS ~91s)"
  - "railway dealflow-web: deployment ffdc7134 SUCCESS, commit a58b699"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok,db:ok,version:a58b699}"
  - "api boot: 'ComplianceGateModule dependencies initialized' + 'Nest application successfully started' (keyring OK, no crash-loop)"
  - "migration 0003 applied: '[✓] migrations applied successfully!'; 4 tables (compliance_rules/suppression_list/disclaimer_templates/compliance_approvals) + 3 partial-unique indexes (active-per-jurisdiction / approved-per-resource / suppression match_type+value) verified LIVE in DB; strictly additive"
  - "AUDIT_LOG_HMAC_KEY set (no new env var this wave) + GIT_SHA=a58b699 on both services"
  - "gh CI run 28683534918 main a58b699: 5/5 jobs success (audit,lint,typecheck,build,test) — SHA provenance CI==deployed==HEAD, no SKIPPED"
  - "RBAC reads: compliance/admin 200, advisor/analyst 403, unauth 401 on GET rules/suppression/disclaimers (guard layer CORRECT)"
  - "DEFECT — RBAC writes: POST rules/suppression/disclaimers → 500 for compliance AND admin; api logs: 'violates foreign key constraint compliance_rules_created_by_fk' (+suppression+disclaimer); 11 FK violations"
  - "ROOT CAUSE: created_by/audit actorUserId = session.getUserId() (SuperTokens id) but FK → users(id); users.supertokens_user_id is a SEPARATE column (id=2b2017dc vs stid=d771b4a8). Every authorized config write rolls back → NOT persisted, NOT audited"
  - "canary skipped (0 DAU < 1000)"
  - "temp TCP proxy created for DB verify then DELETED (0 proxies remain); no prod DB left exposed"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: a58b699, deployment_id: 1e2840a5-1209-4326-8768-61e1a40a190f, health_url: "https://dealflow-api-production-66d4.up.railway.app/health", uptime: fresh}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: a58b699, deployment_id: ffdc7134-d74a-4ae7-834a-4f1cad22998b, health_url: "https://dealflow-web-production-a4f7.up.railway.app/login"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU 0 < threshold 1000; synthetic live verification is the post-deploy signal."
rollback_armed: "api 2b22927f (cd06e8a) + web ee02f22b (cd06e8a), both SUCCESS — cached pre-deploy; NOT triggered (deploy infra-healthy; defect is a forward-fix, not a rollback)"
note: >
  Deploy infra-GREEN (a58b699 live, boots clean, migration 0003 applied additive with all 4 tables +
  3 partial-unique indexes verified live). But LIVE verification found a systemic actor-id-space defect:
  the compliance CRUD write path passes session.getUserId() (SuperTokens id) as created_by + audit
  actorUserId, both FK'd to users(id), while the app keys SuperTokens identity on users.supertokens_user_id
  (a separate column). Every authorized POST (compliance + admin) 500s on FK violation and rolls back —
  so CRUD RBAC is broken on writes AND config mutation is NOT audited. Iron Law tripped → FAIL, route to
  B-2. Reads/guards/SoD-code are correct; gate SoD-compliance-only is unit-proven but was NOT exercised
  live (deferred to the fixed redeploy's T-8). Disclaimer versioning not exercisable (write path blocked).

head_signoff:
  verdict: REJECTED
  stage: C-2
  reviewers: {deployment-engineer: "RBAC matrix probe — reads correct, writes 500 (surfaced the FK defect)"}
  failed_checks:
    - "CRUD RBAC (writes): authorized POST rules/suppression/disclaimers → 500, not 201 (FK violation on created_by → users.id)"
    - "Config mutation audited: audit append rolls back with the failed write; entriesChecked cannot increase; core acceptance criterion unmet live"
    - "Disclaimer versioning: not exercisable live (write path 500s)"
    - "Gate SoD-compliance-only (admin approver BLOCKED): unit-proven only; NOT exercised live this stage"
    - "Settings UI: renders, but any create/save action hits the 500 write defect"
  rationale: >
    The deploy is infra-green and every DEPLOY-phase check ticks from a concrete artifact — SHA provenance
    triple-matched (CI 5/5 green == deployed == HEAD, no SKIPPED), keyring secret present, api boots clean
    with ComplianceGateModule + all CRUD controllers registered, /health reports the exact deployed hash
    a58b699 against the container's own URL (not a stale global route), and migration 0003 is confirmed
    strictly-additive with all 4 tables and all 3 partial-unique indexes verified LIVE in the production DB.
    But C-2 does not exit on a green infra deploy — it exits on VERIFIED compliance behavior, and live
    verification found a hard defect: the compliance CRUD write path passes session.getUserId() (a
    SuperTokens id) as both created_by and the audit actorUserId, both foreign-keyed to users(id), while
    the app stores SuperTokens identity in the SEPARATE users.supertokens_user_id column. Every authorized
    config write (compliance AND admin) 500s on the FK violation and the whole transaction rolls back —
    proven from the api runtime logs (11 FK violations across compliance_rules/suppression_list/
    disclaimer_templates), not inferred. This trips the Iron Law twice: CRUD RBAC is broken on writes, and
    config mutation is NOT audited (the in-tx audit rolls back with the failed write). Per the C-block Iron
    Law I do not fix this — I classify (backend NestJS/Drizzle actor-id-mapping defect) and return it to
    B-2. The gate's SoD-compliance-only invariant (admin approver BLOCKED) is code-present and unit-proven
    at a58b699 but was deliberately NOT exercised live, because the deploy is already returning to B and the
    approval-seeding path shares the same actor-id-space question the CRUD defect surfaced; its live proof
    is deferred to the fixed redeploy's T-8. Rollback was armed pre-deploy but correctly NOT triggered —
    the deploy is healthy and the 0003 schema is correct; the remedy is a forward B-fix + redeploy. Temp
    DB proxy was created for verification and deleted (no lingering prod DB exposure).
  next_action: REWORK_B-2
```
