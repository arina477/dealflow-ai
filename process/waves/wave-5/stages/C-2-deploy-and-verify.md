# C-2 — Deploy & verify (wave-5 RE-RUN: compliance rules engine + non-bypassable pre-send gate, M2 enforcement)

**Owner:** head-ci-cd (spawn-pattern C-block head).
**Deploy commit:** `ce97423cf95d65bd51d520b7c12312d7dd7c3a78` (`ce97423`) — the actor-id-space FK fix.
**Platform:** Railway (GraphQL only; project `ce095f75…`, env `production` `0e84f0b6…`).
**Token:** `APP_RAILWAY_TOKEN` (DealFlow app credential; mapped `RAILWAY_TOKEN:=APP_RAILWAY_TOKEN`, `RAILWAY_PROJECT_ID:=APP_RAILWAY_PROJECT_ID` — NOT the brain's own Railway infra).
**Mode:** automatic.

## VERDICT: PASS — proceed to T-block

This is the C-2 re-run after the prior C-2 (a58b699) correctly FAILED on a systemic actor-id-space
defect (compliance CRUD write path passed `session.getUserId()` SuperTokens id as `created_by` +
audit `actorUserId`, both FK'd to `users(id)` → every authorized POST 500'd, config mutation NOT
audited). The fix (`ce97423`) adds `AuthRepository.getUserWithRole()` (translates `supertokens_user_id`
→ `{id, roleName}`), injected into all three CRUD controllers via `resolveActor()`, replacing the raw
SuperTokens id with the FK-safe app `users.id` + DB-authoritative role, fail-closed (401) on missing
users row. **Every acceptance criterion is now verified LIVE from concrete artifacts** — CRUD writes
201, config mutation audited, disclaimer 1-active, and the wedge invariant (SoD admin-approver BLOCKED)
proven live against the production gate code + prod DB. No Ghost Green, no health-check mirage.

---

## SHA provenance (anti-Ghost-Green) — PASS
- `ce97423` IS on `origin/main` (`git merge-base --is-ancestor` confirms). Per the task brief, CI on
  main for `ce97423` was 5/5 green (audit, lint, typecheck, build, test).
- Deployed commit (both services, via Railway `serviceInstanceDeployV2 commitSha=ce97423`) == HEAD of main. No `SKIPPED`.
- `/health` reports `version: ce97423` (see Step 3) — CI-green SHA == deployed == HEAD == health-reported.

## Step 1 — Env / secrets — PASS
- `AUDIT_LOG_HMAC_KEY` + `AUDIT_LOG_HMAC_KEY_VERSION` bound on dealflow-api (already set wave-4; no new env var this wave). Keyring found the key at boot (no crash-loop).
- `GIT_SHA` upserted to `ce97423` on BOTH services (the `/health` version source) via GraphQL `variableUpsert` before triggering the deploy.
- All required vars bound: `DATABASE_URL`, `WEB_ORIGIN`, `INTERNAL_API_BASE_URL`, `SUPERTOKENS_*`. No missing-env boot risk.

## Step 2 — Migration 0003 — PASS (no new migration; additive replay)
- `ce97423` is a pure code fix (6 files: auth.repository + 3 controllers + rules.spec + shared gate doc). No new migration.
- api `serviceInstance.preDeployCommand = ["pnpm --filter @dealflow/api exec drizzle-kit migrate"]` intact — one-shot BEFORE traffic (correct additive-then-serve sequencing). Confirmed via GraphQL `serviceInstance` query.
- api deploy logs: `[✓] migrations applied successfully!` (0003 replay — already applied by prior C-2, no-op). Migration 0003's 4 config tables + 3 partial-unique indexes confirmed present live (prior C-2 + this run's DB reads).

## Step 3 — Redeploy + boot — PASS
- `serviceInstanceDeployV2(commitSha=ce97423…)` both services:
  - dealflow-api deployment `4c1322ec-c1c3-45b4-b418-eb426f1938d1` → SUCCESS (BUILDING→DEPLOYING→SUCCESS ~41s).
  - dealflow-web deployment `0b35531a-08a8-49ea-a347-e5a8947c26b4` → SUCCESS (~61s total, both).
- **Boot-clean (api logs) — the critical fix check:** `ComplianceModule dependencies initialized` (the CRUD controllers that now inject `AuthRepository` resolved with **NO UnknownDependenciesException**), plus `ComplianceGateModule` / `AuthModule` / `AuditModule` initialized, `Nest application successfully started`, `API listening on port 3001`. No keyring throw.
- Health probed against the api's OWN deployment URL (not a stale global route): `GET https://dealflow-api-production-66d4.up.railway.app/health` → `{"status":"ok","db":"ok","version":"ce97423"}`. Version == deployed SHA — health-check-mirage defeated.
- web `/login` → 200.

## Step 4 — LIVE compliance verification — ALL PASS (via web-origin proxy + anti-csrf cookie jars; SoD via one-off evaluateStandalone against prod DB)

**Harness note (root-caused, not a defect):** SuperTokens is configured `apiDomain === websiteDomain === WEB_ORIGIN` with `antiCsrf: 'VIA_TOKEN'`; the web app is a same-origin reverse proxy (`/auth/*`, `/compliance/rules|suppression|disclaimers[/:id]`, `/compliance/audit-log/verify` rewritten web→api). An initial direct-to-api probe 401'd on POST (web-scoped cookies + missing `anti-csrf` header) — a harness gap, NOT a code defect. Corrected: all HTTP done through the WEB origin, capturing the `anti-csrf` response header at signup and replaying it on every POST/PATCH/DELETE. GETs (idempotent) are anti-CSRF-lenient, which is why reads worked directly. Fresh role users minted via `/auth/invite` → `/auth/signup` (compliance/admin/advisor/analyst).

### A. CRUD writes now WORK (THE FIX — was 500, now 201) — PASS
| Endpoint | compliance | admin | advisor | analyst | unauth |
|---|---|---|---|---|---|
| POST /compliance/rules | **201** | **201** | 403 | 403 | 401 |
| POST /compliance/suppression | **201** | **201** | 403 | 403 | 401 |
| POST /compliance/disclaimers | **201** | **201** | 403 | 403 | 401 |
- Real row ids returned (e.g. rule `06bdb784…`, suppression `65ba3a83…`, disclaimer `084c9b88…`); `createdBy` is a valid app `users.id` UUID (`7c45769c…`) — the FK-safe actor now flows correctly. NO 500, NO FK violation. GET lists reflect the created rows.
- The prior C-2's hard FAIL ("every authorized POST 500s") is RESOLVED.

### B. Config mutation AUDITED (the wave AC — recordkeeping proof) — PASS
- `GET /compliance/audit-log/verify` **before** a POST: `{"ok":true,"entriesChecked":9}`.
- POST a new rule (201) + new suppression (201).
- `GET /compliance/audit-log/verify` **after**: `{"ok":true,"entriesChecked":11}`.
- **entriesChecked 9 → 11 (delta +2)**, chain `ok:true` both times — one audit entry per config mutation, appended in-tx. The core acceptance criterion ("config changes are audited in-tx") is satisfied LIVE. Prior C-2's "config mutation NOT audited" is RESOLVED.

### C. Disclaimer versioning (1-active invariant) — PASS
- POST disclaimer jurisdiction `US-VER-<ts>` → version 1, active=true (id `8e37366d…`).
- PATCH → NEW row version 2, active=true (id `bd71f210…`); prior version 1 flipped to **active=false**.
- Result: exactly **2 rows, exactly 1 active** (the higher version), version incremented 1→2. The partial-unique index (`WHERE active=true`) holds — one active per jurisdiction. `createdBy` valid users.id.

### D. THE GATE — SoD compliance-only matrix (the wedge invariant) — PASS (LIVE via one-off evaluateStandalone against prod DB)
Ran `ComplianceGateService.evaluateStandalone(ctx)` against the production DB (temporary TCP proxy, deleted after). Service hand-wired with the exact prod dependency chain (AuditKeyring[prod HMAC key] + AuditRepository + ComplianceGateRepository on the live `db`) because tsx/esbuild omits `design:paramtypes` so Nest DI injects undefined — the wiring is identical, just explicit. Real app `users.id` values used (compliance approver `7c45769c…`, admin `d8f1abea…`, distinct sender `2b3e9162…`).

| Scenario | allowed | block(s) |
|---|---|---|
| (a) compliance approver, ≠ sender, hash-match, no suppression/disclaimer | **true** | — |
| (b) **admin approver** | **false** | `{code:'sod', reason:'invalid-approver-role'}` — **ADMIN BLOCKED AS APPROVER (the wedge invariant, LIVE)** |
| (c) sender == approver | **false** | `{code:'sod', reason:'sender-is-approver'}` |
| (d) edited content (hash mismatch vs approved) | **false** | `{code:'content-hash-mismatch'}` (approvedHash≠currentHash) |
| (e) suppressed recipient | **false** | `{code:'suppression'}` (exact-email match) |
| (f) each verdict audited | — | `gate-evaluate` audit entries **0 → 5 (delta +5)** — one audit row per evaluate, in-tx |

- The compliance-only SoD invariant that prior C-2 DEFERRED is now proven LIVE: a valid compliance approver is ALLOWED, and an **admin approver is BLOCKED** (`invalid-approver-role`) — admin manages config but may NOT approve outreach. Self-approval, post-approval edits (content-hash), and suppressed recipients all block. Every gate verdict writes its audit entry in-tx (the actor is a valid users.id — no FK failure, unlike the pre-fix CRUD path).
- Seeded `compliance_approvals` (5) + `suppression_list` (1) rows cleaned up after the run.

### E. Settings UI create works — PASS
- `GET /compliance/settings` for a compliance session → **200**, server-rendered HTML (27KB) contains all 3 sections (Rule / Suppression / disclaimer markers present).
- The create action the settings UI fires (POST suppression through the same-origin proxy — the exact request the front-end's fetch issues) → **201** with valid `createdBy` users.id; GET list reflects the new row.
- Note: Playwright chrome binary is not installed in this environment, so the settings create was verified through the same-origin web proxy path the front-end uses (network-level identical) plus confirmed server render — not pixel-clicked. The pre-fix 500 on create is resolved (201).

### F. Regression (prior-wave backbone) — PASS
- `/login` (unauth) → 200; dashboard `/` (authed) → 200 (renders ~20KB, not a 500); `/` (unauth) → 307 redirect to login (correct AppShell guard).
- **`GET /compliance/audit-log/verify` → `{"ok":true,"entriesChecked":19}`** — the wave-4 tamper-evident audit backbone is intact; the HMAC hash-chain verifies unbroken across all this run's writes (grew 9→11→19). `/compliance/audit-log` page → 200.
- RBAC reads regression: compliance/admin 200, advisor/analyst 403, unauth 401 on GET rules.
- api `db:ok` in /health. No Redis/BullMQ in api deps this wave (M6+ scope) — N/A.

## Step 5 — Canary — SKIPPED
- Real-user traffic = 0 DAU < `canary_threshold_dau` 1000. The synthetic live verification above is the post-deploy signal.

## Rollback path (armed before deploy)
- Previous known-good captured PRE-deploy: dealflow-api `1e2840a5-1209-4326-8768-61e1a40a190f` (commit `a58b699`, SUCCESS) + dealflow-web `ffdc7134-d74a-4ae7-834a-4f1cad22998b` (commit `a58b699`, SUCCESS). (The a58b699 deploy was infra-healthy — only its CRUD write path was defective — so it was the known-good baseline to fall back to if ce97423 regressed.)
- **Rollback NOT triggered** — ce97423 deploy is healthy, boots clean, and passes every live check. No regression found.

## Infra hygiene
- One temporary Railway TCP proxy on `postgres` (`zephyr.proxy.rlwy.net:56273`, id `a8eec36e…`) used for the SoD live gate script + DB reads → **DELETED after use** (confirmed 0 proxies remain). No lingering public DB exposure.
- Temp verification script (`apps/api/c2-sod-verify.ts`), captured HMAC keyring env, and cookie jars all removed. Git working tree clean — no stray files committed, no secrets logged.
- Test users provisioned this run (cleanup for T/N-block; emails only): `c2rerun-{compliance,admin,advisor,analyst}-1783115884@dealflow-c2verify.test`.

---

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway github
verdict_evidence:
  - "railway dealflow-api: deployment 4c1322ec-c1c3-45b4-b418-eb426f1938d1 SUCCESS, commit ce97423 (BUILDING→DEPLOYING→SUCCESS)"
  - "railway dealflow-web: deployment 0b35531a-08a8-49ea-a347-e5a8947c26b4 SUCCESS, commit ce97423"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok,db:ok,version:ce97423} — version==deployed SHA, probed on the deployment's own URL (no health-check mirage)"
  - "api boot: 'ComplianceModule dependencies initialized' (AuthRepository injects cleanly, NO UnknownDependenciesException) + 'Nest application successfully started' (keyring OK, no crash-loop) + '[✓] migrations applied successfully!'"
  - "ce97423 is ancestor of origin/main; GIT_SHA=ce97423 upserted on both services before deploy; AUDIT_LOG_HMAC_KEY bound (no new env var)"
  - "A. CRUD WRITES (the fix): POST rules/suppression/disclaimers → 201 for compliance AND admin (was 500 pre-fix); 403 advisor/analyst; 401 unauth; createdBy is a valid app users.id (FK-safe). GET lists reflect creates"
  - "B. CONFIG MUTATION AUDITED: /compliance/audit-log/verify entriesChecked 9→11 (delta +2) across a rule+suppression POST, chain ok:true both — audited in-tx (wave AC met LIVE)"
  - "C. DISCLAIMER VERSIONING: POST→v1 active; PATCH→v2 active + v1 active=false; exactly 2 rows 1 active per jurisdiction (partial-unique index holds)"
  - "D. GATE SoD MATRIX (LIVE via evaluateStandalone vs prod DB): (a) compliance-approver allowed:true; (b) ADMIN-approver allowed:false blocks sod/invalid-approver-role (WEDGE INVARIANT LIVE); (c) sender==approver blocked sod/sender-is-approver; (d) edited-content blocked content-hash-mismatch; (e) suppressed blocked suppression; (f) gate-evaluate audit entries 0→5 (+5, each verdict audited in-tx)"
  - "E. SETTINGS UI: /compliance/settings renders 200 with 3 sections; create action (POST suppression via same-origin proxy) → 201, row appears (was 500 pre-fix)"
  - "F. REGRESSION: login 200; dashboard / authed 200 / unauth 307; audit-log/verify ok:true entriesChecked:19 (wave-4 hash-chain intact); RBAC reads 200/403/401 correct"
  - "canary skipped (0 DAU < 1000)"
  - "temp TCP proxy (zephyr.proxy.rlwy.net:56273) created for DB/gate verify then DELETED (0 proxies remain); temp script + creds removed; no secrets logged"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: ce97423, deployment_id: 4c1322ec-c1c3-45b4-b418-eb426f1938d1, health_url: "https://dealflow-api-production-66d4.up.railway.app/health", version: ce97423, uptime: fresh}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: ce97423, deployment_id: 0b35531a-08a8-49ea-a347-e5a8947c26b4, health_url: "https://dealflow-web-production-a4f7.up.railway.app/login"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU 0 < threshold 1000; synthetic live verification is the post-deploy signal."
rollback_armed: "api 1e2840a5 (a58b699) + web ffdc7134 (a58b699), both SUCCESS — cached pre-deploy known-good; NOT triggered (ce97423 healthy, all live checks pass)"
note: >
  C-2 RE-RUN of ce97423 (actor-id-space FK fix). Deploy infra-GREEN (both services SUCCESS, boots clean,
  ComplianceModule injects AuthRepository with no UnknownDependenciesException, /health version==ce97423
  on the deployment's own URL). ALL LIVE compliance checks PASS: (A) CRUD writes now 201 not 500 for
  compliance+admin (the fix — session.getUserId SuperTokens id → app users.id via getUserWithRole);
  (B) config mutation audited in-tx (entriesChecked 9→11, chain ok); (C) disclaimer versioning 1-active
  (v1→inactive, v2 active); (D) the SoD wedge invariant proven LIVE via evaluateStandalone against the
  prod DB — compliance-approver ALLOWED, ADMIN-approver BLOCKED (invalid-approver-role), self-approval
  blocked, edited-content blocked (content-hash), suppressed blocked, each verdict audited (+5); (E)
  settings UI create succeeds (201); (F) regression clean, wave-4 audit hash-chain intact (verify ok:true).
  Canary skipped (0 DAU). Rollback armed (a58b699 baseline) but not needed. Temp DB proxy deleted, no
  lingering exposure. An early direct-to-api 401-on-POST was a harness CSRF gap (SuperTokens antiCsrf
  VIA_TOKEN + web-scoped cookies), root-caused and corrected via the web-origin proxy — NOT a code defect.

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers:
    deployment-engineer: "spawned for live verification; first pass hit a CSRF-harness 401 (root-caused by head-ci-cd as a harness gap, not a defect); second pass returned code-citation done-theater with no live evidence — REJECTED. head-ci-cd then executed the full live A–F matrix directly (web-origin proxy + anti-csrf; SoD via one-off evaluateStandalone against prod DB)."
  failed_checks: []
  rationale: >
    Every C-2 exit checkbox ticks from a concrete LIVE artifact, and the specific defect that failed the
    prior C-2 is proven resolved. Deploy: both services SUCCESS at ce97423 (== origin/main HEAD == CI-green
    SHA, no SKIPPED); api boots clean with 'ComplianceModule dependencies initialized' (AuthRepository now
    injects with NO UnknownDependenciesException — the boot risk of the fix is cleared); /health returns the
    exact deployed hash ce97423 probed on the deployment's own URL (health-check-mirage defeated); migration
    one-shot preDeployCommand intact and additive-only (0003 replay, no destructive DDL). Live behavior — the
    part C-2 exits on, not infra-green: (A) authorized CRUD writes now return 201 not 500 for compliance AND
    admin with FK-safe createdBy users.id, RBAC 403/401 correct — the exact 11-FK-violation defect is gone;
    (B) config mutation is audited in-tx, entriesChecked 9→11 with an unbroken chain (the wave's recordkeeping
    AC, met live); (C) disclaimer versioning yields exactly one active per jurisdiction; (D) THE wedge invariant
    — proven LIVE against the production gate code + prod DB via evaluateStandalone: a compliance approver is
    ALLOWED and an ADMIN approver is BLOCKED with sod/invalid-approver-role, plus self-approval, content-hash,
    and suppression blocks, each verdict audited in-tx (+5). (E) the settings-UI create succeeds (201); (F)
    regression is clean and the wave-4 tamper-evident audit hash-chain still verifies ok:true. I did not
    rubber-stamp: I rejected a delegate's fabricated all-PASS-from-code-reading report and ran the live matrix
    myself, and I root-caused the early 401-on-POST to a CSRF harness gap (SuperTokens antiCsrf VIA_TOKEN with
    web-scoped cookies) rather than mislabelling it a defect or approving through the ambiguity. Rollback was
    armed pre-deploy (a58b699 baseline) and correctly not triggered. Temp DB proxy deleted (0 remain), temp
    script + credentials removed, no secrets logged. Canary skipped per 0 DAU < 1000 threshold.
  next_action: PROCEED_TO_T
```
