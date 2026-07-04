# C-2 — Deploy & Verify (wave 7 — sourcing-workspace page)

**Stage:** C-2 deploy-and-verify (incl. canary)
**Gating head:** head-ci-cd
**Deploy target:** DealFlow AI production (Railway project `ce095f75-1f3d-4af9-939e-fe8532541475`, env `0e84f0b6-…`)
**Commit under deploy:** `23e5372153b40d5a7d30dc3d82e767aa88beb369` (main HEAD)

---

## Verdict

**ci_stage_verdict: FAIL** — Iron-Law breach: **Drizzle migration `0005` did NOT apply** despite a green deploy. The UNIQUE(display_name) constraint is absent in production; duplicate `displayName` connection-create returns **201 instead of 409**. This is a Ghost-Green migration (preDeploy printed "migrations applied successfully!" while applying nothing). Root cause is a **migration-journal authoring defect** (wrong `when` timestamp on 0005), not an infra/deploy-tooling fault → returns to Build/fast-fix, then C-2 re-runs.

Everything else deployed and verified GREEN (workspace renders, connection-create 201, unknown-providerKey 400, ≥2-source real badges, search, RBAC, audit, regression). The single migration gate is fatal on its own.

---

## Deploy provenance (PASS)

| Service | Deployment ID | Status | Commit | Notes |
|---|---|---|---|---|
| dealflow-api | `bf1656e5-82d8-42fe-a226-7b049a225fac` | SUCCESS | `23e5372153b4` | auto-triggered by push; boots clean |
| dealflow-web | `6c27dbce…` | SUCCESS | `23e5372153b4` | triggered via `serviceInstanceDeploy(commitSha:23e5372…)` |

- Neither SKIPPED (phantom-skip ruled out). Both built the EXACT wave-7 commit.
- **GIT_SHA** upserted to `23e5372` on the api service before boot (non-destructive `variableUpsert`; no other var touched).
- **/health version == 23e5372** — `{"status":"ok","db":"ok","version":"23e5372"}` probed on the api's own domain (`dealflow-api-production-66d4.up.railway.app`), NOT the global domain. New-container-hash confirmed; health-check-mirage defeated.
- Immutability preserved — fresh container artifacts, no in-place mutation.
- No new env var required (reuse-heavy wave; all vars present incl. AUDIT_LOG_HMAC_KEY, DATABASE_URL, SUPERTOKENS_*, WEB_ORIGIN, INTERNAL_API_BASE_URL).

## Armed rollback path (PASS)

Captured BEFORE any mutation:
- **api known-good:** `2c32e0dd-44fb-4cef-8718-92c3d606ce33` (SUCCESS, wave-6 `918dbf0b`)
- **web known-good:** `7b7cc7bc-7ad9-4dfd-8529-32cb3c71f6e6` (SUCCESS, wave-6 `918dbf0b`)

Rollback NOT triggered: deployed code boots clean and is not crash-looping; the only defect is a missing DB constraint. An emergency rollback would revert the good code fixes and wave-6's endpoints also lack the constraint. The correct remediation is a code fix, not a rollback.

---

## Migration 0005 — FAILED TO APPLY (Iron-Law breach)

- **Constraint `data_source_connections_display_name_unique`: ABSENT** in production Postgres (`pg_constraint` count = 0).
- `drizzle.__drizzle_migrations` = **5 rows** (hashes map to files 0000–0004). 0005 hash `8221652734405956` NOT recorded.
- **Live proof:** POST /sourcing/connections with a DUPLICATE displayName → **201** (created a 3rd 'Fixture Source A' row) instead of 409.
- Pre-deploy `data_source_connections` had **0 rows** — so this was NOT a 23505 duplicate-block; it genuinely no-op'd.
- Deploy log printed `[✓] migrations applied successfully!` — a false-success.

### Root cause (confirmed with certainty — sre-engineer + independent verification)

Migration-journal timestamp defect. drizzle-orm `migrate()` gates each migration with `lastDbMigration.created_at < migration.folderMillis` (coarse timestamp guard, NOT a per-hash set-difference).

- Entries 0000–0004 `when` ∈ [1782992720338 … 1783123198319] (2026-07-02 → 2026-07-03).
- **Entry 0005 `when` = `1751673600000` = 2025-07-05T00:00:00Z** — a hardcoded round-midnight epoch, **364 days BEFORE** 0004's recorded `created_at` (`1783123198319`).
- Guard: `1783123198319 < 1751673600000` → **false** → 0005 permanently skipped, transaction commits empty, exit 0, wrapper prints success.

### Remediation (routed to Build / fast-fix — head-ci-cd does NOT fix source)

1. Fix `apps/api/src/db/migrations/meta/_journal.json` entry idx 5: set `when` to a value > `1783123198319` (e.g. `Date.now()` at fix time). Minimal, targeted.
2. (Recommended defense-in-depth) add a post-migrate row-count assertion to the Railway preDeploy so an empty migrate fails hard: `drizzle-kit migrate && psql "$DATABASE_URL" -c 'SELECT COUNT(*) FROM drizzle.__drizzle_migrations' | grep -qP '^\s+6\s*$'`. This makes "applied nothing" impossible to mistake for success.
3. Optionally make `out` config-relative (`path.join(__dirname, …)`) to remove the implicit-CWD fragility (not the current cause, but hardening).
4. Data state left clean (see cleanup) → 0005 will apply with no 23505 on retry.

---

## LIVE verification (all non-migration ACs GREEN)

Auth: fresh ANALYST minted via web-origin `/auth/invite {email,role:analyst}` → `/auth/signup` (cookie jar); mutations carry `Origin: <web-origin>` + `rid: anti-csrf`. Advisor + compliance users minted for RBAC/audit.

**Workspace page (AC):** analyst GET `/sourcing` → **200**, workspace HTML (WorkspaceClient, connectors row + search + source facet + results matrix) — NOT the old redirect-to-companies. Non-analyst (advisor) `/sourcing` → **307 → /** (correctly redirected).

**Connection-create:**
- `Fixture Source A` → **201**; `Fixture Source B` → **201** (distinct).
- DUPLICATE `Fixture Source A` → **201 ❌ (must be 409)** — the migration-0005 breach.
- UNKNOWN providerKey `nope` → **400** `{"message":"Unknown provider_key \"nope\". Registered providers: FIXTURE"}` ✅ (providerKey-validation fix; NOT 500).
- Create audited: compliance GET `/compliance/audit-log/verify` → **200 `{"ok":true,"entriesChecked":38}`** — hash-chain intact, sourcing-connection-create entries appended. ✅

**≥2-source view (AC-BADGE — real rows):** GET `/sourcing/connections` → **200**, lists real connections. Synced both A + B (POST …/sync each → **201 `{"ingested":5}`**). GET `/sourcing/companies` → **200**, **4 canonical companies each with `connectionIds` = 2 sources** (badges populated, NOT '—'). Cross-source companies show BOTH connections. ≥2-source metric LIVE on 2 fixture connections. ✅

**Search:** GET `/sourcing/companies?q=Acme` → **200**, filtered to 1 (Acme Technologies Inc.). ✅

**RBAC (fail-closed):**

| Endpoint | analyst | advisor | compliance | unauth |
|---|---|---|---|---|
| GET /sourcing/companies | 200 | 403 | 403 | 401 |
| GET /sourcing/connections | 200 | 403 | 403 | 401 |
| POST /sourcing/connections | 201 | 403 | 403 | 401 |

**Regression:** analyst `/` → 200; `/sourcing/companies` (deep screen) → 200; `/compliance/settings` → 307 (analyst correctly gated); compliance `/compliance/settings` → 200. api `/health` 200 @ 23e5372; audit-log verify ok:true. ✅

---

## Canary

**Skipped** — 0 DAU (threshold `canary_threshold_dau: 1000`). No real-user traffic to shift; canary not armed this wave.

## Cleanup (done)

- Seeded test connections (Fixture Source A/B, RBAC-probe*) DELETED.
- Ingested demo/canonical data reset: `TRUNCATE raw_companies, company_provenance, companies, contacts, contact_provenance, dedupe_candidates RESTART IDENTITY CASCADE`. Sourcing tables are external-party demo data — safe to reset.
- DB left clean: 0 connections, 0 companies, 0 raw, 0 duplicate display_names → 0005 will apply with no 23505 on retry.
- Temp Postgres TCP proxy (`hayabusa.proxy.rlwy.net:38131`, id `6aeed0df-…`) DELETED.

---

## Monitor task (deploy wait — bounded, three-condition)

```yaml
platform: railway
success_condition: deployments.edges[0].node.status == "SUCCESS"   # per-service, polled
failure_condition: status IN ("FAILED","CRASHED","REMOVED","SKIPPED")
timeout_budget: 840   # seconds; poll_delay 30
result: BOTH_SUCCESS (api bf1656e5, web 6c27dbce) — no SKIPPED
```

---

---

# 0005-fix re-verify (2384c54)

**Re-verify date:** 2026-07-04
**Commit under deploy:** `2384c542bef269e71959a290db5fce303afcada4` (main HEAD; the merged 0005-journal fix)
**Prior C-2 (23e5372):** REJECTED — migration 0005 Ghost Green (journal `when` older than 0004 → drizzle coarse guard skipped it; UNIQUE(display_name) absent; dup→201). That defect is now FIXED in-tree.

## Verdict

**ci_stage_verdict: FAIL** — Iron-Law breach on the **dup-displayName → 409** acceptance criterion. Migration 0005 now applies correctly (the Ghost Green is genuinely resolved — 6 rows + UNIQUE constraint present), BUT a **second, newly-surfaced defect** makes the duplicate path return **500 instead of 409**. The 23505 unique-violation is raised by Postgres and the row is correctly blocked (data integrity IS protected — no 2nd row), but the API's catch handler checks `err.code === '23505'` while drizzle-orm wraps the driver error in a `DrizzleQueryError` whose `.code` is `undefined` (the real `code:'23505'` lives on `err.cause.code`). So the 23505→ConflictException(409) mapping never fires and Nest surfaces a generic 500. **The dup→409 contract is not met live → FAIL + RETURN to Build/fast-fix.**

This is NOT the same defect as prior C-2 — the migration fix worked. This is a distinct application-layer error-mapping bug that was previously **masked**: at prior C-2 the constraint didn't exist, so the duplicate INSERT succeeded (201) and the 23505 catch path was never exercised. Now that 0005 applies, the constraint fires for the first time in production and exposes the broken unwrap.

## The 0005 fix — PROVEN APPLIED (the Ghost Green is resolved)

Probed via temp TCP proxy `de3a8265-…` @ `hayabusa.proxy.rlwy.net:28708` (created + deleted this run):

- **`drizzle.__drizzle_migrations` = 6 rows** (prior C-2 had 5 — the Ghost Green). Row id 6 = hash `8221652734405956fcf21262aad6b52a366b72860aab46cfd043ccf5739ff4a0`, `created_at 1783209598319` — the previously-skipped 0005, now recorded.
- **`data_source_connections_display_name_unique` UNIQUE (display_name) — PRESENT** (`pg_constraint` contype='u'; `pg_get_constraintdef` = `UNIQUE (display_name)`). Also PK `data_source_connections_pkey` intact.
- In-tree proof: `_journal.json` idx 5 `when` = `1783209598319` > 0004's `1783123198319` → drizzle guard `1783123198319 < 1783209598319` = true → 0005 applies. Confirmed at HEAD `2384c54`.
- preDeploy printed `[✓] migrations applied successfully!` — and this time it is TRUE (verified by DB probe, not by trusting the log line).

## Deploy provenance (PASS)

| Service | New deployment ID | Status | Commit | Notes |
|---|---|---|---|---|
| dealflow-api | `399792d5-ef44-45fc-9a8e-5345d404ae5d` | SUCCESS | `2384c54` | `serviceInstanceDeployV2(commitSha:2384c54)`; boots clean; all modules + routes mapped; "Nest application successfully started"; "API listening on port 3001" |
| dealflow-web | `f5bb7781-fab8-4cff-b931-ed1067985565` | SUCCESS | `2384c54` | `serviceInstanceDeployV2(commitSha:2384c54)` |

- Neither SKIPPED (phantom-skip ruled out). Explicit commit-pinned `serviceInstanceDeployV2` used — not the opaque Wait-for-CI webhook.
- **GIT_SHA** upserted `23e5372` → `2384c54` on api before boot (non-destructive single `variableUpsert`; no other var touched; all required vars present).
- **/health version == 2384c54** — `{"status":"ok","db":"ok","version":"2384c54"}` probed on the api's OWN container domain (`dealflow-api-production-66d4.up.railway.app`), NOT the global domain. Health-check-mirage defeated; new-container-hash confirmed.
- Immutable fresh-artifact deploy; no in-place mutation.

## Armed rollback path (PASS)

Captured BEFORE any mutation (current SUCCESS deployments, serving 23e5372 code):
- **api known-good:** `bf1656e5-82d8-42fe-a226-7b049a225fac` (SUCCESS)
- **web known-good:** `6c27dbce-b3c9-4bde-b4ce-c43eab8c5b40` (SUCCESS)

Rollback NOT triggered: 2384c54 boots clean and is not crash-looping; the defect is an application error-mapping bug, not a crash. Rollback would revert the (real) migration fix and re-introduce the constraint-absent state. Correct remediation is a targeted code fix, not a rollback.

## LIVE verification (2384c54)

Auth: fresh analyst minted — `/auth/invite {email,role:analyst}` → 201 → `/auth/signup {inviteToken,password}` → 201 (session cookies; `auth/me` → 200 role:analyst). Anti-CSRF is SuperTokens VIA_CUSTOM_HEADER (`antiCsrfToken:null`); state-changing POSTs carry `Origin: <web-origin>` + `rid: anti-csrf`.

| Check | Result | Verdict |
|---|---|---|
| POST /sourcing/connections {fixture, DupTest-<uniq>} | **201** (id b0570563-…, createdBy set) | PASS |
| POST SAME displayName again | **500** ❌ (must be 409) | **FAIL** |
| — DB after dup: rows with that display_name | **1** (constraint blocked the 2nd; `_bt_check_unique` fired 23505) | integrity OK |
| POST unknown providerKey `nope` | **400** `Unknown provider_key "nope". Registered providers: FIXTURE` | PASS (regression) |
| GET /sourcing/companies (analyst) | **200** `{"companies":[]}` (DB clean from prior cleanup) | PASS (RBAC) |
| api /health | **200** `version:2384c54` | PASS |

Runtime log at dup POST (proof of root cause):
```
ERROR [ExceptionsHandler] DrizzleQueryError: Failed query: insert into "data_source_connections" ...
  cause: error: duplicate key value violates unique constraint "data_source_connections_display_name_unique"
    code: '23505', constraint: 'data_source_connections_display_name_unique', routine: '_bt_check_unique'
```

### Root cause (confirmed with certainty)

`apps/api/src/modules/sourcing/sourcing.repository.ts:89-101` — the 23505 catch checks `('code' in err) && err.code === '23505'`. drizzle-orm wraps the pg driver error in a `DrizzleQueryError`; the wrapper's own `.code` is `undefined`, and the real Postgres `code:'23505'` is on `err.cause.code`. The guard is false → line 101 re-throws the raw wrapper → Nest default handler → 500. The `ConflictException(409)` branch is dead at runtime against a real driver error. (This path had zero prior production exposure because the constraint didn't exist until 0005 finally applied — B-block unit tests likely stubbed a bare `{code:'23505'}` object, not a DrizzleQueryError, so the mock passed while prod fails.)

### Remediation (routed to Build / fast-fix — head-ci-cd does NOT fix source)

- Classification: `debugging` (runtime exception mis-mapping) → Build/fast-fix, backend executor.
- Fix `sourcing.repository.ts` catch: unwrap the drizzle wrapper before the 23505 check — inspect `err.cause` (and/or the pg `DatabaseError` chain), e.g. read code from `err?.cause?.code ?? err?.code`. Apply the same unwrap to any sibling 23505/23xxx catches (the concurrent-resolve `ConflictException` paths at repository.ts ~427 and service.ts ~350 use the same `.code` pattern and are likely broken the same way — audit them in the fix).
- Harden the B-block unit test so the mock throws a `DrizzleQueryError`-shaped object (code nested under `cause`), not a bare `{code:'23505'}` — otherwise the green test keeps masking the prod 500.
- No DB change needed; 0005 + constraint are correct. DB left clean (0 connections) → retry is clean.

## Canary

**Skipped** — 0 DAU (`canary_threshold_dau: 1000`). No real-user traffic to shift.

## Cleanup (done)

- Test connection rows (`DupTest-%`) DELETED → 0 connections remain.
- Test analyst user rows deleted (best-effort; SuperTokens identity orphan-tolerant).
- Temp Postgres TCP proxy `de3a8265-…` (`hayabusa.proxy.rlwy.net:28708`) DELETED.
- GIT_SHA left at `2384c54` (correct for the deployed hash); deploy left in place (boots fine, not crash-looping).

## Chronology

- 2026-07-04 ~04:00 UTC: api+web deploy of 2384c54 triggered; both SUCCESS by ~04:01:40 UTC (~1.5 min build).
- /health 2384c54 confirmed; DB probe: 6 migration rows + UNIQUE constraint present.
- Live: dup POST → 500 (root-caused to DrizzleQueryError unwrap). Canary skipped.

---

```yaml
head_signoff:
  verdict: REJECTED
  stage: C-2
  reverify: "0005-fix re-verify (2384c54)"
  reviewers:
    sre-engineer: "prior C-2 — root-caused drizzle-orm timestamp-guard skip of 0005 (journal when=2025-07-05 < 0004 created_at); recommended journal when fix + post-migrate row-count assertion (both now applied/verified)"
  reverify_failed_checks:
    - "dup-displayName returns 409 — FAILED: returns 500 (DrizzleQueryError wraps the 23505; repository catch checks err.code not err.cause.code → ConflictException(409) branch never fires; data integrity still enforced — no 2nd row)"
  reverify_passed_checks:
    - "migration 0005 APPLIED — __drizzle_migrations = 6 rows (was 5); UNIQUE(display_name) constraint PRESENT (DB probe, not log-trust) — the Ghost Green is RESOLVED"
    - "commit SHA provenance: deployed == HEAD 2384c54 on both services; neither SKIPPED; explicit serviceInstanceDeployV2 (not Wait-for-CI webhook)"
    - "/health version == 2384c54 on the deployed container's own domain (not global) — mirage defeated; app boots clean"
    - "armed rollback captured pre-mutation (api bf1656e5 / web 6c27dbce)"
    - "unknown-providerKey → 400 (regression intact); GET /sourcing/companies 200 (RBAC); create → 201"
    - "immutable fresh-artifact deploy; GIT_SHA upserted non-destructively; all env vars pre-bound"
    - "canary correctly skipped (0 DAU < 1000); cleanup complete (0 connections, temp proxy deleted)"
  rationale: >
    The merged 0005-journal fix WORKS: production Postgres now shows 6 migration rows (was 5 — the
    Ghost Green) and the UNIQUE(display_name) constraint is present, verified by direct DB probe rather
    than by trusting the preDeploy "migrations applied successfully!" log line. Both services deployed
    cleanly on the exact HEAD 2384c54, /health confirms the new container hash, and unknown-providerKey
    still correctly returns 400. HOWEVER the dup-displayName acceptance criterion FAILS live: the duplicate
    returns 500, not 409. Root cause is a distinct, previously-masked application defect — the repository's
    23505 catch reads err.code, but drizzle-orm wraps the driver error in a DrizzleQueryError whose code is
    undefined (the real 23505 lives on err.cause.code), so the ConflictException(409) branch is dead against
    a real driver error. This defect had zero prior exposure because until 0005 finally applied, the constraint
    didn't exist and the duplicate INSERT simply succeeded (201) — fixing the migration is what first
    exercised the broken catch. Data integrity IS protected (the DB blocked the 2nd row) but the spec's
    dup→409 contract is not met, and shipping a data-integrity surface that answers 500 to a duplicate is a
    failed acceptance criterion, not a rubber-stampable green. Returned to Build/fast-fix for a targeted
    err.cause unwrap (plus auditing the sibling ConflictException catches and hardening the unit-test mock so
    it stops masking this). DB left clean; deploy left in place; no rollback needed.
  next_action: REWORK_B-block  # fix repository 23505 unwrap (err.cause.code), audit sibling conflict catches, harden mock; then re-run C-2
  superseded_footer_below: true
  failed_checks:
    - "Drizzle migration 0005 executed and verified before traffic — FAILED: 0005 silently no-op'd; UNIQUE(display_name) constraint absent in prod"
    - "Schema validation queries confirm live schema matches deployed artifact — FAILED: constraint expected by code is absent"
    - "dup-displayName returns 409 — FAILED: returns 201 (constraint not enforced)"
  passed_checks:
    - "commit SHA provenance (deployed == HEAD 23e5372); both services SUCCESS, none SKIPPED"
    - "/health version == 23e5372 on the deployed container hash (not global domain)"
    - "armed rollback path (api 2c32e0dd / web 7b7cc7bc captured pre-mutation)"
    - "immutable fresh-artifact deploy; all required env vars pre-bound"
    - "bounded MONITOR: success/failure/timeout defined"
    - "LIVE: workspace renders; connection-create 201; unknown-providerKey 400; ≥2-source real badges (connectionIds, not '—'); search filter; RBAC fail-closed; create audited (chain ok); regression"
    - "canary correctly skipped (0 DAU < 1000)"
  rationale: >
    The wave-7 commit deployed cleanly to both services on the exact HEAD SHA, /health confirms
    23e5372 on the new container hash, and every non-migration acceptance criterion verified GREEN
    live — including the three B-6 fixes for badges, providerKey-400, and the intended dup-409. BUT
    the dup-409 path FAILS live (returns 201) because Drizzle migration 0005 did not apply: the
    UNIQUE(display_name) constraint is absent from production despite the preDeploy reporting success.
    Root cause is a migration-journal timestamp defect (0005 when=1751673600000 / 2025-07-05, which is
    364 days older than 0004's recorded created_at) that trips drizzle-orm's coarse timestamp guard and
    silently skips the migration. Rubber-stamping a green verdict here would ship a data-integrity
    invariant that is provably not enforced — the exact fabricated-green failure the C-block gate exists
    to catch. Returned to Build for a one-line journal fix (plus a recommended post-migrate row-count
    assertion in preDeploy so this class can never masquerade as success again). DB left clean; deploy
    left in place (boots fine, not crash-looping); no rollback needed.
  next_action: REWORK_B-block  # fix 0005 journal `when` timestamp + add preDeploy migrate-count guard, then re-run C-2
```

---

## dup-409 fix re-verify (0fe63de)

**ci_stage_verdict: PASS** — the dup→409 flip is verified live. This focused re-verify targeted the ONLY open defect from the prior REJECTED verdict (dup-displayName → 500 instead of 409, root-caused to DrizzleQueryError.cause.code not unwrapped). All other C-2 criteria (0005 applied, workspace, connection-create-201, unknown-providerKey-400, ≥2-source badges) had already PASSED at prior re-verifies and were not re-litigated except the required quick regression.

### Provenance & deploy
- **Token:** project-scoped `RAILWAY_TOKEN` valid → `projectToken` returned project `ce095f75…` / env `0e84f0b6…` (production). Not a block.
- **Armed rollback captured pre-mutation** (prior known-good SUCCESS): api `399792d5-ef44-45fc-9a8e-5345d404ae5d`, web `f5bb7781-fab8-4cff-b931-ed1067985565`. Not needed.
- **GIT_SHA upserted 0fe63de** (non-destructive single-var upsert) on api `dcdb4ab4…` + web `06b07f19…`; all env (DATABASE_URL, AUDIT_LOG_HMAC_KEY) pre-bound.
- **Explicit fresh deploys** via `serviceInstanceDeployV2` (NOT Wait-for-CI webhook): api deploy `27761064-ea7e-4093-82f5-049cf6bb305a`, web deploy `98948a92-72f6-4f03-bf0f-3ed337edc7e0`.
- **MONITOR: bounded** — success=`status==SUCCESS`, failure=`IN(FAILED,CRASHED,REMOVED,SKIPPED)`, timeout_budget=900s, poll_delay=45s. Both reached **SUCCESS** in ~90s; neither SKIPPED. Latest-deployment query confirms `27761064…` is api's current head (no phantom skip).
- **/health version == 0fe63de** on the api's OWN deployed domain `dealflow-api-production-66d4.up.railway.app` (NOT the global domain) → `{"status":"ok","db":"ok","version":"0fe63de"}`. Mirage defeated; app boots clean.

### The fix proof (dup-displayName → 409 live)
Driven through the **web-origin proxy** `dealflow-web-production-a4f7.up.railway.app` (same-origin SuperTokens session), analyst minted via `/auth/invite`(role=analyst) → `/auth/signup` → session cookies. State-changing POSTs carry the `rid: anti-csrf` custom header (config uses `antiCsrf: VIA_CUSTOM_HEADER` — this is why GET /auth/me passed while unheadered POSTs 401'd; expected, not a defect).

| Step | Request | Result | Expected |
|---|---|---|---|
| 3a | POST /sourcing/connections {providerKey:fixture, displayName:DupFix-…} | **201** (id 9360cbbe…) | 201 ✓ |
| 3b | POST same displayName again | **409 Conflict** ("A connection with the display name … already exists") | 409 ✓ (was 500 pre-fix) |
| 3c | POST unknown providerKey | **400** ("Unknown provider_key … Registered providers: FIXTURE") | 400 ✓ (regression intact) |

The `err.cause.code` unwrap now maps the DrizzleQueryError-wrapped 23505 → `ConflictException(409)`. **Data integrity confirmed: the duplicate did NOT insert a 2nd row** (DB probe showed exactly 1 DupFix row before cleanup — the constraint blocked the 2nd, and the code now surfaces it as 409 not 500).

### Regression (quick, per re-verify scope)
- **Workspace renders:** GET /sourcing (analyst) → **200**, 20505 bytes, DealFlow AI shell + sourcing content.
- **/health:** ok / db ok / 0fe63de (above).
- **Connection-create audited:** chain-verify GET /compliance/audit-log/verify (compliance role) → **200 `{"ok":true,"entriesChecked":40}`** — HMAC-SHA256 hash chain intact and includes the new create rows.
- **Schema safety (DB probe, not log-trust):** `data_source_connections_display_name_unique` UNIQUE constraint PRESENT; `__drizzle_migrations` = 6 rows (0005 applied). Live schema matches deployed artifact.

### Canary — SKIPPED
0 DAU < `canary_threshold_dau: 1000`. No real-user traffic to shift.

### Cleanup (done)
- Test connection rows (`DupFix-%` / `BadKey-%`) DELETED → **0 connections** remain (authoritative DB count).
- Temporary Postgres TCP proxy `28f9c4a5-…` (`kodama.proxy.rlwy.net:30444`) DELETED; local credential temp files scrubbed (`shred`).
- 3 test users (dupfix-analyst / dupfix2 / dupfix-compliance) LEFT IN PLACE — deletion is correctly blocked by the append-only `audit_log_entries` immutability trigger (they are the `actor_user_id` on audited rows). Orphan-tolerant per prior C-2; audit-chain integrity outranks test-user cleanup. This is the compliance audit-log working as designed.
- GIT_SHA left at `0fe63de` (correct for deployed hash); deploy left in place.

### Chronology
- 2026-07-04 ~04:14 UTC: api+web deploy of 0fe63de triggered (serviceInstanceDeployV2); both SUCCESS by ~04:16:37 UTC (~90s build). Canary window: N/A (skipped, 0 DAU).
- /health 0fe63de confirmed on own domain; dup POST → 201 then **409** (fix proven); bad-key → 400; audit chain ok:true (40 entries); workspace 200.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reverify: "dup-409 fix re-verify (0fe63de)"
  reviewers:
    sre-engineer: "prior C-2 — root-caused (a) drizzle 0005 journal-timestamp skip [fixed 2384c54], then (b) DrizzleQueryError.cause.code non-unwrap → dup 500 [fixed 0fe63de]; both now verified resolved live"
  reverify_passed_checks:
    - "dup-displayName → 409 LIVE (the fix proof): 201 on first create, 409 Conflict on duplicate (was 500). err.cause.code unwrap maps DrizzleQueryError-wrapped 23505 → ConflictException. Data integrity intact (no 2nd row inserted)."
    - "commit SHA provenance: /health version == 0fe63de on api's OWN deployed domain (not global); both services SUCCESS via explicit serviceInstanceDeployV2, neither SKIPPED; latest-deployment query confirms 27761064… is api head"
    - "schema safety by DB probe (not log-trust): UNIQUE(display_name) constraint present + __drizzle_migrations=6 (0005 applied); live schema matches deployed artifact"
    - "armed rollback captured pre-mutation (api 399792d5 / web f5bb7781)"
    - "unknown-providerKey → 400 (regression intact); workspace GET /sourcing → 200 (analyst RBAC)"
    - "connection-create audited: audit-log chain-verify ok:true, entriesChecked=40; HMAC-SHA256 chain intact"
    - "bounded MONITOR: success=SUCCESS / failure=IN(FAILED,CRASHED,REMOVED,SKIPPED) / timeout_budget=900s; immutable fresh-artifact deploy; GIT_SHA upserted non-destructively; all env pre-bound"
    - "canary correctly skipped (0 DAU < 1000); cleanup complete (0 connections, temp proxy 28f9c4a5 deleted, creds scrubbed)"
  rationale: >
    The merged 0fe63de fix WORKS live. The dup→409 acceptance criterion — the single open
    defect that drove the prior REJECTED verdict — now flips correctly: a duplicate displayName
    POST returns 409 Conflict (was 500), driven end-to-end through the web-origin proxy with a
    real analyst session and the VIA_CUSTOM_HEADER anti-csrf rid header. The repository's
    err.cause.code unwrap surfaces the DrizzleQueryError-wrapped SQLSTATE 23505 as
    ConflictException, and data integrity is provably preserved (the 2nd insert was blocked by
    the UNIQUE constraint — exactly one DupFix row existed before cleanup). Provenance is clean:
    /health confirms 0fe63de on the deployed container's own domain (not a global-domain mirage),
    both services deployed via explicit serviceInstanceDeployV2 and reached SUCCESS (no phantom
    SKIPPED), the schema was verified by direct DB probe rather than trusting a preDeploy log line
    (UNIQUE constraint present, 6 migration rows), and the required quick regression is green —
    unknown-providerKey still 400, workspace renders 200, and the connection-create is audited into
    an intact HMAC-SHA256 chain (verify ok:true). Armed rollback was captured before mutation and
    was not needed. Canary correctly skipped (0 DAU). No fabricated green: every check is traced to
    a live artifact (HTTP status, GraphQL deployment status, /health body, or DB probe). C-2 passes;
    the wave proceeds to T-block. Test users left in place because the append-only audit trigger
    correctly refuses to delete an actor referenced by the immutable audit log — the compliance
    control working as designed, not a cleanup miss.
  next_action: PROCEED_TO_T
```

---

## V-3 render-fix re-verify (3e2042f)

**Re-verify date:** 2026-07-04
**Commit under deploy:** `3e2042f09b4b29457f7f820cf0f7226be0bf8621` (main HEAD — the merged V-1 render fix)
**Target defect:** V-1 CRITICAL — the sourcing **workspace `/sourcing`** rendered "No companies found" despite real data in the DB. Two root causes fixed in-tree: (1) SSR company-list schema loosened `z.string().datetime()` → `z.string()` in `apps/web/app/(app)/sourcing/_lib/workspace-types.ts` (PG-wire timestamp `2026-07-04 04:42:20.996353+00` no longer drops the list); (2) search/facet now filter the SSR-loaded companies IN-MEMORY (were fetching the HTML page route).

### Verdict

**ci_stage_verdict: FAIL (REJECTED)** — The V-1 CRITICAL itself (workspace `/sourcing` renders empty) is **genuinely FIXED and PROVEN** live: the workspace now displays companies (SSR HTML + real headless-chromium DOM) and in-memory search filters them with **zero network fetch**. The task's primary Iron Law ("workspace STILL renders empty → FAIL") is **NOT** tripped. **BUT** the task's explicit regression requirement #3 — "login + `/sourcing/companies` deep screen still render" — **FAILS live**: the deep-screen `/sourcing/companies` renders **"No companies yet"** with 4 real canonical companies in the DB. Root cause is the **identical bug class** the workspace fix addressed, left un-fixed on a sibling route: the fix loosened the timestamp only in the workspace's local `_lib/workspace-types.ts` override, NOT in the shared `companySchema` (`packages/shared/src/sourcing.ts:88` still `createdAt: z.string().datetime()`) that the deep-screen imports and `safeParse`s — on parse-fail `fetchCompanies()` returns `[]`, dropping the whole list. This is a partial fix that shipping green would rubber-stamp; returned to Build/fast-fix.

### The V-1 fix proof — WORKSPACE DISPLAYS COMPANIES (PASS)

- **Seeded real data:** analyst minted (invite→signup, web-origin, `rid: anti-csrf`). Two fixture connections `V3-Src-A-…` / `V3-Src-B-…` → **201** each; sync BOTH → **201 `{"ingested":5}`** each → cross-source dedup to **4 canonical companies**.
- **API/DB returns companies with PG-wire timestamps (spot-confirm, DB probe):** `companies` = 4 rows — Acme Technologies Inc., Bright Horizon Ventures LLC, Delta Systems Corp, Epsilon Analytics — each `created_at = 2026-07-04 04:42:20.996353+00` (space-separated, no `T`/`Z` — the exact PG-wire format `z.datetime()` rejects and the fix's `z.string()` accepts).
- **SSR HTML contains company data (NOT empty-state):** analyst GET `/sourcing` → **200**, 56–58 KB HTML. `grep`: "No companies found"/"No companies yet"/"No results" = **0 occurrences**; company names PRESENT — "Acme" ×8, `Acme Technologies Inc.`, `Delta Systems Corp`, `Bright Horizon Ventures LLC`, `Epsilon Analytics`; both source badges (`V3-Src-A-…`, `V3-Src-B-…`) present; 10–11 `createdAt` entries embedded as client-hydration data (proving the SSR now parses what the API returns). Confirms the fix vs the prior deploy `0fe63de` which rendered empty despite the same DB data.
- **Real headless-browser proof (Playwright 1.61.1, bundled chromium-1208):** injected the analyst session cookies, loaded `/sourcing` → NAV **200**; `EMPTY_STATE_PRESENT: false`; `RENDERED_COMPANIES: ["Acme","Delta Systems","Horizon Ventures"]` render as live DOM rows. **In-memory search verified:** typed "Acme" into the "Search companies by name or domain…" input → `afterQuery_hasAcme: true`, `afterQuery_deltaFiltered: true` (Delta Systems removed), and **`nonStaticNetRequests: []`** — the search filters the SSR-loaded list in-memory with ZERO network fetch to any page route (the second half of the fix, confirmed).

### Deploy provenance (PASS)

| Service | New deployment ID | Status | Commit | Notes |
|---|---|---|---|---|
| dealflow-web | `e520f0a1-9795-4c97-b35a-2e6ab40bda95` | SUCCESS | `3e2042f` | `serviceInstanceDeployV2(commitSha:3e2042f…)`; the fix is web-side |
| dealflow-api | `599542b3-79ab-47c5-979a-fc770452ca70` | SUCCESS | `3e2042f` | `serviceInstanceDeployV2`; boots clean; db ok |

- **Token:** project-scoped `RAILWAY_TOKEN` (len 36) valid → `projectToken` returned project `ce095f75…` / env `0e84f0b6…` (production). Not a block.
- Both reached **SUCCESS** in ~90s (BUILDING→SUCCESS); neither SKIPPED (phantom-skip ruled out). Latest-deployment query confirms `599542b3…`/`e520f0a1…` are the current heads.
- Explicit commit-pinned `serviceInstanceDeployV2` — NOT the opaque Wait-for-CI webhook.
- **GIT_SHA** upserted `0fe63de` → `3e2042f` on api before boot (non-destructive single `variableUpsert`; no other var touched; all env pre-bound — DATABASE_URL, AUDIT_LOG_HMAC_KEY, SUPERTOKENS_*, WEB_ORIGIN present).
- **/health version == 3e2042f** — `{"status":"ok","db":"ok","version":"3e2042f"}` HTTP 200 on the api's OWN container domain (`dealflow-api-production-66d4.up.railway.app`), NOT the global domain. Health-check-mirage defeated; new-container-hash + clean boot confirmed.
- Immutable fresh-artifact deploy; no in-place mutation.

### Armed rollback path (PASS)

Captured BEFORE any mutation (prior known-good SUCCESS, serving `0fe63de`):
- **api known-good:** `27761064-ea7e-4093-82f5-049cf6bb305a`
- **web known-good:** `98948a92-72f6-4f03-bf0f-3ed337edc7e0`

Rollback NOT triggered: `3e2042f` boots clean and is not crash-looping; the workspace fix is real; the deep-screen defect is a latent code bug (not a crash/regression introduced by this deploy). Rollback would revert the (real) V-1 workspace fix. Correct remediation is a targeted shared-schema code fix, not a rollback.

### Regression

| Check | Result | Verdict |
|---|---|---|
| POST /sourcing/connections (new displayName) | **201** | PASS |
| POST same displayName again (dup) | **409** | PASS |
| POST unknown providerKey | **400** `Unknown provider_key … Registered providers: FIXTURE` | PASS |
| api /health | **200** `version:3e2042f`, db ok | PASS |
| login + workspace `/sourcing` renders companies | **200**, companies render (fix proof above) | PASS |
| **`/sourcing/companies` deep screen renders** | **200** but **"No companies yet"** with 4 companies in DB | **FAIL** |

### Root cause of the deep-screen FAIL (confirmed with certainty)

- `apps/web/app/(app)/sourcing/companies/page.tsx` imports `companySchema` from `@dealflow/shared` (line 31) and parses the SSR company-list with it (`companiesResponseSchema = z.object({ companies: z.array(companySchema) })`, lines 93–94, 103).
- `packages/shared/src/sourcing.ts:88` — shared `companySchema` still declares `createdAt: z.string().datetime()` (and `updatedAt` same). PG-wire `2026-07-04 04:42:20.996353+00` fails `.datetime()` (no `T`/`Z`) → `safeParse` fails → `fetchCompanies()` returns `[]` (page.tsx:113–135) → deep-screen renders the "No companies yet" empty-state.
- The V-1 fix (`3e2042f`) touched ONLY the workspace (`WorkspaceClient.tsx`, `_lib/workspace-types.ts` local override, `page.test.tsx`) — `git show --stat 3e2042f` confirms it did NOT touch `packages/shared/src/sourcing.ts`. So every consumer of the shared schema (the deep-screen, and any future consumer) still has the un-fixed timestamp bug.
- **Not a new regression from this deploy** — the deep-screen (wave-6, `952207d`) has carried this latent bug since authoring; it was masked because prior C-2 cleanups left 0 companies (so "No companies yet" was the *correct* empty-state). Seeding real fixture companies exposes it for the first time — the same "empty-despite-data" failure mode as the V-1 CRITICAL, on the sibling route.

### Remediation (routed to Build / fast-fix — head-ci-cd does NOT fix source)

- Classification: `frontend` / shared-contract schema defect (SSR parse rejects valid PG-wire timestamp) → Build/fast-fix.
- Fix at the SHARED layer, not per-route: `packages/shared/src/sourcing.ts` `companySchema.createdAt` (and `updatedAt`) `z.string().datetime()` → `z.string()` (or a PG-wire-tolerant refine). This fixes the deep-screen and removes the need for the workspace's local `_lib/workspace-types.ts` override (audit whether the override can then be dropped to avoid two drifting copies of the same contract).
- Harden the shared-schema unit test (`packages/shared/src/sourcing.test.ts:316` asserts `createdAt:'not-a-date'` throws but never tests a real PG-wire string) + add a deep-screen SSR test that feeds a PG-wire timestamp and asserts rows render — mirror of the workspace `page.test.tsx` guard — so this class stops slipping through per-route.
- No DB change; DB left clean (0 connections/companies) → retry is clean.

### Canary — SKIPPED

0 DAU < `canary_threshold_dau: 1000`. No real-user traffic to shift.

### Cleanup (done)

- Sourcing demo tables reset via temp TCP proxy `hayabusa.proxy.rlwy.net:17022` (id `30e292f6-…`, created + **DELETED** this run): `TRUNCATE raw_companies, company_provenance, companies, contacts, contact_provenance, dedupe_candidates, data_source_connections RESTART IDENTITY CASCADE` → verified 0 connections / 0 companies / 0 raw. External-party demo data — safe to reset per prior C-2 convention.
- Local credential temp files scrubbed (`shred`).
- Test analyst user left in place (append-only `audit_log_entries` immutability trigger blocks deleting an actor referenced by the audit chain — compliance control working as designed).
- GIT_SHA left at `3e2042f` (correct for deployed hash); deploy left in place (boots clean, not crash-looping).

### Chronology

- 2026-07-04 ~05:31 UTC: web+api deploy of `3e2042f` triggered (`serviceInstanceDeployV2`); both SUCCESS by ~05:33:52 UTC (~90s build). Canary window: N/A (skipped, 0 DAU).
- /health `3e2042f` confirmed on api's own domain; workspace `/sourcing` renders companies (SSR HTML + headless DOM + in-memory search, 0 network); DB probe: 4 canonical companies with PG-wire `created_at`.
- Deep-screen `/sourcing/companies` → "No companies yet" despite 4 companies → root-caused to un-fixed shared `companySchema` `.datetime()`.

### Monitor task (deploy wait — bounded, three-condition)

```yaml
platform: railway
success_condition: deployment(id).status == "SUCCESS"           # per-service, polled
failure_condition: status IN ("FAILED","CRASHED","REMOVED","SKIPPED")
timeout_budget: 900   # seconds
poll_delay: 30
result: BOTH_SUCCESS (web e520f0a1, api 599542b3) — no SKIPPED
```

```yaml
head_signoff:
  verdict: REJECTED
  stage: C-2
  reverify: "V-3 render-fix re-verify (3e2042f)"
  reviewers: {}
  reverify_failed_checks:
    - "deep-screen /sourcing/companies renders companies — FAILED: renders 'No companies yet' with 4 real companies in DB. Root cause: shared companySchema (packages/shared/src/sourcing.ts:88) still z.string().datetime(); deep-screen imports it and safeParse-drops the whole list on the PG-wire timestamp. The V-1 fix loosened only the workspace's LOCAL _lib/workspace-types.ts override, not the shared schema every consumer uses — a partial fix. Task regression requirement #3 not met live."
  reverify_passed_checks:
    - "V-1 CRITICAL (workspace /sourcing renders empty) — FIXED & PROVEN: SSR HTML contains company data (Acme/Delta/Horizon/Epsilon, source badges, embedded createdAt), NO empty-state; real headless-chromium DOM renders company rows"
    - "in-memory search — PROVEN: typing 'Acme' filters the SSR-loaded list (Delta removed) with nonStaticNetRequests=[] (zero page-route fetch — the second half of the fix)"
    - "API/DB returns companies with PG-wire timestamps: 4 canonical companies, each created_at = '2026-07-04 04:42:20.996353+00' (DB probe)"
    - "commit SHA provenance: /health version == 3e2042f on api's OWN container domain (not global); both services SUCCESS via explicit serviceInstanceDeployV2, neither SKIPPED; latest-deployment query confirms current heads"
    - "armed rollback captured pre-mutation (api 27761064 / web 98948a92); not needed (boots clean)"
    - "regression: connection-create 201 / dup 409 / bad-key 400 / /health ok all PASS"
    - "bounded MONITOR: success=SUCCESS / failure=IN(FAILED,CRASHED,REMOVED,SKIPPED) / timeout_budget=900s; immutable fresh-artifact deploy; GIT_SHA upserted non-destructively; all env pre-bound"
    - "canary correctly skipped (0 DAU < 1000); cleanup complete (0 connections/companies, temp proxy 30e292f deleted, creds scrubbed)"
  rationale: >
    The V-1 CRITICAL itself is genuinely fixed and I proved it three ways: the /sourcing workspace
    SSR HTML now contains company data (no empty-state), a real headless-chromium session renders the
    company rows in the live DOM, and the in-memory search filters the SSR-loaded list with zero
    network fetch to any page route — with real fixture companies whose PG-wire created_at
    (2026-07-04 04:42:20.996353+00, verified by direct DB probe) is exactly the timestamp the prior
    deploy dropped. Provenance is clean: /health confirms 3e2042f on the deployed container's own
    domain (not a global-domain mirage), both services deployed via explicit serviceInstanceDeployV2
    and reached SUCCESS with no phantom SKIPPED, and armed rollback was captured pre-mutation. The
    primary Iron Law (workspace still empty) is NOT tripped. HOWEVER I cannot rubber-stamp a green:
    the task's explicit regression requirement #3 — the /sourcing/companies deep screen still renders
    — FAILS live. That deep screen shows "No companies yet" with four real companies in the DB,
    because the fix was applied to the workspace's LOCAL _lib/workspace-types.ts override rather than
    to the shared companySchema (packages/shared/src/sourcing.ts:88 still z.string().datetime()) that
    the deep-screen imports and safeParse-drops on. This is the IDENTICAL empty-despite-data bug class
    the wave was fixing, surviving on a sibling route — a partial fix, and exactly the kind of drift
    the C-block gate exists to catch. Returned to Build/fast-fix to loosen the timestamp at the shared
    layer (fixing every consumer at once) and add a deep-screen SSR guard test mirroring the workspace
    one. No fabricated green: every check is traced to a live artifact (HTTP status, GraphQL deployment
    status, /health body, headless DOM assertion, or DB probe). DB left clean; deploy left in place
    (boots fine); no rollback needed.
  next_action: REWORK_B-block  # loosen shared companySchema createdAt/updatedAt .datetime()→.string(); add deep-screen SSR PG-wire test; then re-run C-2
```
