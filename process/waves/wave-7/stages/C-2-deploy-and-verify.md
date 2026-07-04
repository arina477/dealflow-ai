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

---

## V-3 shared-timestamp re-verify (e3dd9b7)

**Verdict: FAIL — deep-screen `/sourcing/companies` STILL renders empty with real data (Iron Law tripped).** The shared-timestamp fix is genuinely correct and TWO of three screens now render; but the deep screen fails on a **second, independent contract-drift defect** (a `connectionIds` strict-schema unknown-key rejection) that the timestamp fix never addressed. Returned to Build/fast-fix.

### Deploy provenance (PASS)

| Service | New deployment ID | Status | commitHash (Railway meta) | Notes |
|---|---|---|---|---|
| dealflow-web | `13a28a77-dd5b-4279-9950-16a09f615bfe` | SUCCESS | `e3dd9b7920a0bffeea497c0d5e72ecc4c0d41078` | build `pnpm --filter @dealflow/web... build` (rebuilds @dealflow/shared → shared fix ships in web bundle) |
| dealflow-api | `83012c67-62fa-4dbd-b10e-df988fef2c05` | SUCCESS | e3dd9b7 (GIT_SHA) | boots clean; db ok |

- **Token:** project-scoped `RAILWAY_TOKEN` (len 36) valid → `projectToken` returned project `ce095f75…` / env `0e84f0b6…` (production). Not a block.
- **GIT_SHA** upserted to `e3dd9b7` on BOTH api and web (single non-destructive `variableUpsert` each; no other var touched — DATABASE_URL, AUDIT_LOG_HMAC_KEY, SUPERTOKENS_*, WEB_ORIGIN, INTERNAL_API_BASE_URL all pre-bound). The variableUpsert auto-triggered a redeploy on each service (BUILDING→DEPLOYING→SUCCESS in ~91s); no duplicate/racing deploy issued (SKIPPED-phantom avoided).
- **/health version == e3dd9b7** — `{"status":"ok","db":"ok","version":"e3dd9b7"}` HTTP 200 on the api's OWN container domain (`dealflow-api-production-66d4.up.railway.app`), NOT the global domain. Health-check-mirage defeated; new-container-hash confirmed.
- **Web serving e3dd9b7 confirmed via Railway deployment `meta.commitHash`** (not inferred) — `e3dd9b7920a0bffeea497c0d5e72ecc4c0d41078`, imageDigest `sha256:604b9c95…`. This rules out a stale-web-deploy explanation for the deep-screen failure.
- Both reached SUCCESS; neither SKIPPED (phantom-skip ruled out via `deployments` GraphQL). Immutable fresh-artifact deploy; no in-place mutation.

### Armed rollback path (PASS — captured pre-mutation)

Prior known-good SUCCESS deployments, captured BEFORE the variableUpsert redeploy:
- **api known-good:** `599542b3-79ab-47c5-979a-fc770452ca70` (SUCCESS, `3e2042f`)
- **web known-good:** `e520f0a1-9795-4c97-b35a-2e6ab40bda95` (SUCCESS, `3e2042f`)

Rollback NOT triggered: `e3dd9b7` boots clean, is not crash-looping, and genuinely fixes the workspace + compliance-settings. Rolling back would revert real fixes. The deep-screen defect is a latent code bug, not a crash/regression introduced by this deploy → correct remediation is a targeted code fix, not a rollback.

### The fix proof — SEEDED real data

- Analyst minted via web-origin invite→signup (`/auth/invite {role:analyst}` → 201 token; `/auth/signup {inviteToken,password}` → 201; `/auth/me` → 200 role:analyst). Anti-CSRF = SuperTokens VIA_CUSTOM_HEADER; mutations carry `Origin: <web-origin>` + `rid: anti-csrf`.
- Connection `Vf-A-1783144542` (providerKey `fixture`) → **201** (createdAt `2026-07-04 05:56:00.389079+00` — PG-wire). Sync → **201 `{"ingested":5,"updated":0}`** → cross-source dedup to **4 canonical companies**.
- **API GET /sourcing/companies → 200**, 4 companies (Acme Technologies Inc. / Bright Horizon Ventures LLC / Delta Systems Corp / Epsilon Analytics), each `createdAt = "2026-07-04 05:56:00.561699+00"` (space-separated, `+00`, microseconds — the exact PG-wire format `.datetime()` rejects).

### Screen-by-screen render proof (real headless chromium, live DOM — Playwright chromium-1208, web-UI login sets cookies on web origin)

| Screen | Result | Evidence |
|---|---|---|
| **`/sourcing` (workspace)** | **PASS — renders companies** | live DOM: `emptyState:false`; Acme/Delta/Bright Horizon/Epsilon all present; 6 company-row matches. Regression from V-1 STILL fixed. |
| **`/sourcing/companies` (deep screen)** | **FAIL — renders empty** | live DOM: `emptyState:true`, `EMPTY_STATE_TEXT:"No companies yet"`, `CONTAINS_ACME:false`, 0 company rows — with 4 real companies in DB and returned 200 by the API. |
| **`/compliance/settings`** | **PASS — renders rules** | compliance user minted (role:compliance); rule seeded (`approval_required`, US, → 201, createdAt `2026-07-04 05:59:30.92002+00`); live DOM: `emptyState:false`, 4 rule-type matches (approval_required + blocklist_check + disclaimer_required + jurisdiction US). The compliance-rules.ts timestamp fix WORKS. |

### Root cause of the deep-screen FAIL (confirmed empirically — NOT the timestamp bug)

The e3dd9b7 timestamp fix IS correct: `packages/shared/src/sourcing.ts:92` `createdAt: z.string()` / `:93` `updatedAt: z.string().nullable()` (was `.datetime()`), workspace local override dropped, compliance-rules.ts loosened. Confirmed via `git show e3dd9b7` + source read. The workspace and compliance-settings now render — proving the timestamp fix's effectiveness. **But the deep screen fails on a DIFFERENT defect:**

- The live API `GET /sourcing/companies` returns each company with a **`connectionIds`** array field (`["fe2a2326-…"]`) — confirmed on the wire.
- `apps/web/app/(app)/sourcing/companies/page.tsx:113` `fetchCompanies` parses with `companiesWithMetaResponseSchema` = `z.array(companyWithMetaSchema)`, where `companyWithMetaSchema = companySchema.extend({contactCount,sourceCount,hasPendingCandidates})` (line 103). The base `companySchema` is **`.strict()`** (`sourcing.ts:95`) and declares NO `connectionIds`; the extension adds none either.
- **`.strict()` rejects the unknown `connectionIds` key** → `companiesWithMetaResponseSchema.safeParse` fails (`unrecognized_keys: ["connectionIds"] at companies[0]`); the plain fallback `companiesResponseSchema.safeParse` also fails (`unrecognized_keys: ["contactCount","sourceCount","connectionIds"]`) → `fetchCompanies` returns `[]` (page.tsx:133) → deep screen renders "No companies yet".
- **Empirically reproduced** against the REAL live API payload using the EXACT deployed schema (project zod@3.25.76): both safeParse → `success:false`; `=> fetchCompanies returns [] EMPTY STATE`. Zero ambiguity.
- `grep -rn connectionIds packages/shared/src apps/web/.../sourcing/companies` → **0 hits**: the field exists in NO shared schema and NO deep-screen parse code — pure server→client contract drift.

**Why the prior V-3 missed it:** the prior deploy (`3e2042f`) fixed only the workspace's LOCAL override, so the deep screen died on the timestamp `.datetime()` first — masking the `connectionIds` strict-key defect underneath. e3dd9b7 removes the timestamp cause; the `connectionIds` cause is now the surfacing failure. Two stacked contract defects on the same route; the fix cleared one.

### Remediation (routed to Build / fast-fix — head-ci-cd does NOT fix source)

- Classification: `frontend` / shared-contract drift (SSR strict-schema rejects a live API field) → Build/fast-fix.
- Two viable fixes (Build's call): (a) add `connectionIds: z.array(z.string().uuid()).optional()` to the shared `companySchema` (correct if the API contractually returns it — makes the wire shape first-class); OR (b) relax the deep-screen parse (`companyWithMetaSchema.passthrough()` / `.strip()`, or `companySchema.omit(...)`-free tolerant variant) so unknown API-added keys don't drop the whole list. Prefer (a) — the contract should match reality; then audit whether the API's `connectionIds` belongs in the shared read shape for all consumers.
- Harden: extend the deep-screen SSR test (`apps/web/app/(app)/sourcing/companies/page.test.tsx`) to feed a payload WITH `connectionIds` (mirroring the real API) and assert rows render — the current PG-wire test added in e3dd9b7 does NOT include `connectionIds`, which is exactly why the added test passed while the live screen fails. Add a contract test that fails when the API emits a field the SSR schema rejects.
- No DB change; DB left clean (0 connections/companies; seeded compliance rule deleted) → retry is clean.

### Regression (all PASS)

| Check | Result | Verdict |
|---|---|---|
| POST /sourcing/connections (new displayName) | **201** | PASS |
| POST same displayName again (dup) | **409** | PASS |
| POST unknown providerKey | **400** `Unknown provider_key "nonsense-xyz". Registered providers: FIXTURE` | PASS |
| login (auth/me) | **200** role:analyst | PASS |
| api /health | **200** `version:e3dd9b7`, db ok | PASS |
| api crash? | **NO** — clean boot, db ok | PASS |

### Canary — SKIPPED

0 DAU < `canary_threshold_dau: 1000`. No real-user traffic to shift.

### Cleanup (done)

- Sourcing demo tables reset via temp Postgres TCP proxy `hayabusa.proxy.rlwy.net:44818` (id `9ffbdca2-2142-4217-b119-28e0d974d40a`, created + **DELETED** this run): `TRUNCATE raw_companies, company_provenance, companies, contacts, contact_provenance, dedupe_candidates, data_source_connections RESTART IDENTITY CASCADE` → verified 0 companies / 0 connections. Seeded test compliance rule `8087f688-…` DELETEd.
- Local credential + cookie-jar temp files `shred`-scrubbed; proof scripts removed.
- Test analyst + compliance users left in place (append-only audit-log immutability trigger blocks deleting an actor referenced by the hash chain — compliance control working as designed).
- GIT_SHA left at `e3dd9b7` (correct for deployed hash); deploy left in place (boots clean, workspace + compliance-settings render).

### Chronology

- 2026-07-04 ~05:52:19 UTC: web+api variableUpsert(GIT_SHA=e3dd9b7) → auto-redeploy of e3dd9b7 both services; both SUCCESS by ~05:53:50 UTC (~91s build). Canary window: N/A (skipped, 0 DAU).
- /health e3dd9b7 confirmed on api's own domain; web deployment meta.commitHash == e3dd9b7 (web not stale).
- 05:56 UTC: seeded analyst + connection + sync → 4 companies. Workspace `/sourcing` renders (live DOM). Deep-screen `/sourcing/companies` → "No companies yet" despite 4 companies → root-caused to `connectionIds` strict-key rejection (empirical safeParse repro).
- 05:59 UTC: seeded compliance user + rule → `/compliance/settings` renders 4 rules (timestamp fix confirmed).
- ~06:0x UTC: DB cleanup (0/0), temp proxy deleted, creds scrubbed.

### Monitor task (deploy wait — bounded, three-condition)

```yaml
platform: railway
success_condition: deployments(first:1).edges[0].node.status == "SUCCESS"   # per-service, polled
failure_condition: status IN ("FAILED","CRASHED","REMOVED","SKIPPED")
timeout_budget: 900   # seconds
poll_delay: 45
result: BOTH_SUCCESS (web 13a28a77, api 83012c67) in ~91s — no SKIPPED
```

```yaml
head_signoff:
  verdict: REJECTED
  stage: C-2
  reverify: "V-3 shared-timestamp re-verify (e3dd9b7)"
  reviewers: {}
  reverify_failed_checks:
    - "deep-screen /sourcing/companies renders companies — FAILED: live headless-chromium DOM shows 'No companies yet' (emptyState:true, 0 company rows, CONTAINS_ACME:false) with 4 real companies in DB and returned 200 by the API. Root cause is NOT the timestamp bug (that IS fixed) — it is a SECOND, independent defect: the API emits a `connectionIds` field on each company; the deep-screen SSR parse uses companySchema.extend() where base companySchema is .strict() and declares no connectionIds, so BOTH safeParse attempts reject with unrecognized_keys:['connectionIds'] → fetchCompanies returns [] → empty state. Empirically reproduced against the live payload with the exact deployed zod schema. Iron Law tripped (a sourcing screen STILL renders empty with data)."
  reverify_passed_checks:
    - "workspace /sourcing renders companies — STILL FIXED & PROVEN: live headless-chromium DOM emptyState:false, Acme/Delta/Bright Horizon/Epsilon present, 6 company-row matches"
    - "compliance-settings sibling (audit fix) — FIXED & PROVEN: compliance user minted, approval_required rule seeded (201, PG-wire createdAt), /compliance/settings live DOM renders 4 rule types (approval_required/blocklist_check/disclaimer_required + US), emptyState:false — the compliance-rules.ts timestamp fix works"
    - "shared timestamp fix landed & correct: sourcing.ts:92-93 createdAt/updatedAt z.string() (was .datetime()), workspace local override dropped, compliance-rules.ts loosened (git show e3dd9b7 + source read)"
    - "commit-SHA provenance: /health version == e3dd9b7 on api's OWN container domain (not global); web Railway deployment meta.commitHash == e3dd9b7 (web NOT stale — rules out stale-deploy as the deep-screen cause); both services SUCCESS via variableUpsert-triggered redeploy, neither SKIPPED"
    - "armed rollback captured pre-mutation (api 599542b3 / web e520f0a1); not needed (boots clean, real fixes present)"
    - "regression: connection-create 201 / dup 409 / bad-key 400 / login 200 / /health 200 e3dd9b7 / no api crash — all PASS"
    - "bounded MONITOR: success=SUCCESS / failure=IN(FAILED,CRASHED,REMOVED,SKIPPED) / timeout_budget=900s / poll=45s; immutable fresh-artifact deploy; GIT_SHA upserted non-destructively; all env pre-bound"
    - "canary correctly skipped (0 DAU < 1000); cleanup complete (0 companies/connections, seeded rule deleted, temp proxy 9ffbdca2 deleted, creds scrubbed)"
  rationale: >
    I cannot rubber-stamp a green. The shared-timestamp fix (e3dd9b7) is genuinely correct and I
    proved it: the /sourcing workspace still renders companies in a real headless-chromium DOM, and
    the /compliance/settings sibling now renders four seeded rules (the compliance-rules.ts half of
    the fix, confirmed live with a PG-wire-timestamped rule). Provenance is clean — /health reports
    e3dd9b7 on the api's own container domain, and the WEB deployment's Railway meta.commitHash is
    e3dd9b7 (not a stale web build), which specifically rules out "web didn't ship the fix" as the
    explanation. HOWEVER the task's core proof #2 — the /sourcing/companies deep screen renders with
    data — FAILS live: it shows "No companies yet" with four real companies in the DB. The Iron Law
    is explicit that a sourcing screen still rendering empty with data is a FAIL + RETURN. Critically,
    the cause is NOT the timestamp bug the fix targeted — it is a SECOND, independent contract-drift
    defect I root-caused with certainty: the API now returns a `connectionIds` field on every company
    object, and the deep-screen SSR parse extends a .strict() companySchema that declares no such key,
    so both safeParse attempts reject with unrecognized_keys:['connectionIds'] and fetchCompanies
    returns [] — I reproduced this against the exact live payload with the exact deployed zod schema,
    and grep confirms connectionIds exists in zero shared/deep-screen code. The prior V-3 missed this
    because the timestamp bug failed first and masked it; e3dd9b7 cleared the timestamp cause and the
    strict-key cause surfaced. This is precisely the empty-despite-data class the wave exists to kill,
    still alive on the deep-screen route via a different mechanism. Returned to Build/fast-fix to
    reconcile the shared companySchema with the API's connectionIds field (or make the deep-screen
    parse tolerant of API-added keys) and to add a deep-screen contract test that feeds the REAL API
    shape (incl. connectionIds) so this stops slipping through. No fabricated green: every check is
    traced to a live artifact — HTTP status, Railway GraphQL deployment status + meta.commitHash,
    /health body, headless DOM assertion, live API JSON, or an empirical safeParse repro against the
    real payload. Deploy left in place (boots clean, two of three screens render); DB left clean; no
    rollback needed.
  next_action: REWORK_B-block  # reconcile shared companySchema with API `connectionIds` (add field OR tolerant deep-screen parse); add deep-screen contract test feeding the real API shape incl. connectionIds + PG-wire timestamps; then re-run C-2
```

---

## V-3 companySchema-connectionIds re-verify (2ae3e06)

**verdict: FAIL (REJECTED)** — head-ci-cd. The targeted `connectionIds` fix is **CORRECT and PROVEN**: all three fix-proof surfaces now render data in the live headless-chromium DOM, so the wave's primary Iron Law ("any of /sourcing, /sourcing/companies, /compliance/settings STILL renders empty with data → FAIL") is **NOT tripped** and the api does **NOT crash**. **BUT** the task's explicit regression #3 — "`/sourcing/companies` detail (`/sourcing/companies/:id`) renders a company" — **FAILS live with a deterministic HTTP 500**, a masked sibling defect of exactly the class this re-verify was told to hunt. Returned to Build/fast-fix.

### Deploy — 2ae3e06 live on both services (NOT stale, NOT SKIPPED)

- Token: `RAILWAY_TOKEN` sourced from `APP_RAILWAY_TOKEN` (present, 36 chars, project-scoped). `projectToken` query → project `ce095f75-1f3d-4af9-939e-fe8532541475`, env `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`. Deploy-scoped probe returned `data.project` with no `errors` → credential usable.
- `variableUpsert GIT_SHA=2ae3e06` on **dealflow-api** (`dcdb4ab4…`) + **dealflow-web** (`06b07f19…`) → `variableUpsert:true` each → auto-redeploy triggered (deterministic; not reliant on Railway "Wait for CI").
- New deployments captured from the mutation response:
  - api deployment `d0bec3d9-e3c8-4066-8c71-b12389fae16c` — meta.commitHash `2ae3e06…` — polled BUILDING → **SUCCESS**.
  - web deployment `2298ce0a-f993-429e-86ca-2a9b1d1ae1d1` — meta.commitHash `2ae3e06…` — polled BUILDING → DEPLOYING → **SUCCESS**.
  - Bounded MONITOR: success=both `SUCCESS`; failure=`FAILED|CRASHED|REMOVED|SKIPPED`; `timeout_budget=900s`; poll=45s. Reached BOTH_SUCCESS in ~2 min. Neither SKIPPED.
- **Armed rollback (captured before mutation, unused):** api `83012c67-…` (e3dd9b7) / web `13a28a77-…` (e3dd9b7) — the prior known-good SUCCESS deployments.

### /health — own-domain, exact deployed hash

- `GET https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"2ae3e06"}`. Version matches the deployed hash exactly (no stale-routing mirage); db connected; no crash-loop. Probed the api service's own domain, not a global alias.
- Fix present in shipped code: `packages/shared/src/sourcing.ts` companySchema (`.strict()`) now declares `connectionIds: z.array(z.string()).optional().default([])` + `sourceCount: z.number().int().optional()`; compiled into `packages/shared/dist/sourcing.js` (confirmed). `apps/web/.../sourcing/_lib/workspace-types.ts` mirrors it. HEAD == `2ae3e06`.

### The fix proof — all 3 render surfaces show data (real headless chromium, Playwright chromium-1208, live DOM)

Seed: analyst minted via web-origin invite→signup (`/auth/invite {role:analyst}` → 201 token; `/auth/signup {inviteToken,password}` → 201; `/auth/me` → 200 role:analyst). Anti-CSRF = SuperTokens VIA_CUSTOM_HEADER; mutations carry `Origin: <web-origin>` + `rid: anti-csrf`. Fixture connection `Vfin-1783145763` → **201**; sync → **201 `{"ingested":5}`** → 4 canonical companies. Session cookies (`sAccessToken`/`sRefreshToken`, HttpOnly) injected into a real chromium-1208 context; live-DOM `document.body.innerText` asserted.

| Surface | Live-DOM result | Verdict |
|---|---|---|
| `/sourcing` (workspace) | NAV **200**; `emptyStatePresent:false`; rendered rows: Acme, Delta Systems, Bright Horizon, Epsilon (rowCount 4) | **PASS** |
| `/sourcing/companies` (deep screen — THE fix proof) | NAV **200**; `emptyStatePresent:false`; all 4 full names present in live DOM — "Acme Technologies", "Delta Systems", "Bright Horizon", "Epsilon Analytics"; 7 list items; **zero** "No companies yet"/"No companies found" markers. Directly reverses the prior REJECTED round (`e3dd9b7` rendered "No companies yet"). `connectionIds` now accepted by the strict companySchema → list survives parse. | **PASS** |
| `/compliance/settings` | compliance user minted (invite→signup role:compliance → 201); page **200**, no `__next_error__`, full Rules/Disclaimer/Suppression UI; `GET /compliance/rules` → **200** with a seeded `blocklist_check` rule. Analyst correctly gated (307→`/`, RBAC working). | **PASS** |

**connectionIds fix conclusion:** the empty-despite-data defect the fix targeted is **dead** on all three surfaces. The commit does what it claims.

### Regression

| Check | Result | Verdict |
|---|---|---|
| connection create | **201** | PASS |
| connection create dup | **409** ("A connection with the display name … already exists") | PASS |
| connection bad providerKey | **400** ("Unknown provider_key … Registered providers: FIXTURE") | PASS |
| login (`auth/me`) | **200** role:analyst | PASS |
| `/health` | **200** version `2ae3e06`, db ok, no crash | PASS |
| **`/sourcing/companies/:id` detail renders a company** | **500** `__next_error__` — deterministic, reproduced 3× (chromium row-click captured a 500 to `/sourcing/companies/0095627e-…`; direct SSR GET → 500; JSON-accept GET → 500) | **FAIL** |

### Detail-page 500 — root-caused with certainty (new masked sibling defect, NOT the connectionIds fix, NOT the api)

- **Web runtime log (authoritative stack trace, web deployment `2298ce0a`):** `⨯ Error: Event handlers cannot be passed to Client Component props. at stringify (<anonymous>) { digest: '3186490548' }` — repeated on every `/sourcing/companies/:id` request.
- **Mechanism:** `apps/web/app/(app)/sourcing/companies/[id]/page.tsx` is a **Server Component** (async, `cookies()`, no `'use client'`). At line 94 it passes `onCandidateResolved={(_companyId, _hasPending) => undefined}` — a function/event-handler prop — to `<CompanyDetail>`, which is a **Client Component** (`'use client'` at line 21, prop typed `(companyId, hasPending) => void`). Next.js App Router forbids passing function props across the Server→Client boundary; the RSC serializer throws at render → HTTP 500. The list route works because it renders `CompanyDetail` from `CompaniesClient` (client→client, legal); only the standalone `[id]` route crosses the illegal boundary.
- **Isolation proving it is web-only, not api and not RBAC:** api `GET /sourcing/companies/:id` without a session → **401** (route healthy, not 500). `rolesForRoute('/sourcing/companies/:id')` → `["analyst"]`; `canAccess('analyst', <concrete id path>)` → `true` (no throw). `fetchMe`/`fetchCompanyBasic` both catch and redirect on failure — the only uncaught crash is the function-prop serialization in the JSX return.
- **Triage tag:** `nextjs` (App Router Server/Client Component boundary violation). Fix: in `[id]/page.tsx`, drop the inline function prop — either make `onCandidateResolved` optional in `CompanyDetail` and omit it here, or wrap the detail in a thin client component that supplies the no-op handler. Add a route-level test (SSR render of `/sourcing/companies/:id`) so a Server→Client function-prop regression can't ship green again.

### No fabricated green

Every verdict is traced to a live deployed-state artifact: HTTP status codes, Railway GraphQL deployment `status` + `meta.commitHash`, `/health` body, real headless-chromium `innerText` DOM assertions, live API JSON, and the web deployment's own runtime stack trace with digest. The connectionIds fix is genuinely proven; the detail 500 is genuinely reproduced. Deploy `2ae3e06` left in place (boots clean, `/health` green, all three fix-proof surfaces render); DB left clean; rollback armed but unused (no api crash, no data-loss regression — the defect is an isolated web SSR route crash, not an infra failure warranting rollback).

### Cleanup

- Temp fixture connection(s) created for the proof; test analyst + compliance users left in place (append-only `audit_log_entries` immutability trigger blocks deleting an actor referenced by the hash chain — compliance control working as designed, per prior C-2 rounds).
- Local credential + cookie-jar + proof-script temp files `shred`-scrubbed / removed.

```yaml
head_signoff:
  verdict: REJECTED
  stage: C-2
  reviewers: {}
  failed_checks:
    - "regression#3: /sourcing/companies/:id detail renders a company — FAILS with deterministic HTTP 500 (__next_error__, digest 3186490548): Server Component [id]/page.tsx passes a function prop (onCandidateResolved) to Client Component CompanyDetail — illegal Next.js App Router Server→Client boundary crossing"
  rationale: >
    The V-3 connectionIds fix is CORRECT and PROVEN: 2ae3e06 is live on both services
    (api + web, meta.commitHash 2ae3e06, neither SKIPPED), /health == 2ae3e06 own-domain,
    and all THREE fix-proof surfaces render data in the live headless-chromium DOM —
    workspace /sourcing (4 rows, emptyState false), deep-screen /sourcing/companies (all
    4 company names in live DOM, zero empty-state markers — directly reversing the prior
    "No companies yet" REJECT), and /compliance/settings (renders + rules API 200). The
    wave's primary Iron Law (empty-despite-data on the 3 surfaces) is NOT tripped and the
    api does NOT crash. HOWEVER the task's explicit regression #3 — the /sourcing/companies/:id
    detail page must render a company — FAILS live with a deterministic HTTP 500, reproduced
    three ways. Root-caused with certainty from the web deployment's own runtime stack trace:
    the Server Component [id]/page.tsx passes an inline event-handler function prop
    (onCandidateResolved) to the Client Component CompanyDetail, which Next.js App Router
    forbids across the Server→Client boundary. This is NOT the connectionIds fix and NOT the
    api (api /sourcing/companies/:id → 401 without a session, healthy; RBAC resolves analyst
    with no throw) — it is an isolated, pre-existing web SSR-route crash of exactly the
    "masked sibling defect" class this re-verify was warned to catch. Approving on a green
    fix-proof while an explicit required surface 500s would be a fabricated green; per the
    Iron Law this hard-stops the C-2 exit and returns to Build/fast-fix.
  next_action: REWORK_B-block  # fix [id]/page.tsx Server→Client function-prop violation (make onCandidateResolved optional + omit, or wrap in a client shell); add an SSR route-render test for /sourcing/companies/:id so a Server→Client function-prop regression can't ship green; then re-run C-2. connectionIds fix itself is proven — do not touch companySchema.
```

---

## V-3 detail-fnprop re-verify (798fae1) — FINAL

**verdict: FAIL (REJECTED)** — head-ci-cd. The Server→Client function-prop fix at `798fae1` **DID land** — the detail route no longer returns HTTP 500 (it now returns 200 at the transport layer), and the previously-proven surfaces (workspace `/sourcing`, deep-list `/sourcing/companies`, `/compliance/settings`) all still render real data in the live headless-chromium DOM. **BUT** the task's core proof #2 — `/sourcing/companies/:id` (DETAIL) must **render the company detail** (contacts/provenance tabs) — **FAILS live**: the page loads HTTP 200 but the client `CompanyDetail` component renders a hard **"Network error — please try again"** state and never fetches the company. This is a 5th masked sibling defect of exactly the empty-despite-data / broken-render class this chain exists to kill, uncovered *because* the 500 fix cleared the crash that was masking it. Returned to Build/fast-fix.

### Deploy — 798fae1 live on both services (NOT stale, NOT SKIPPED)

- Token: `RAILWAY_TOKEN` sourced from `APP_RAILWAY_TOKEN` (present, 36 chars, project-scoped). `projectToken` query → project `ce095f75-1f3d-4af9-939e-fe8532541475`, env `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`. Deploy-scoped probe returned `data.project` with no `errors` → credential usable.
- `variableUpsert GIT_SHA=798fae1` on **dealflow-api** (`dcdb4ab4…`) + **dealflow-web** (`06b07f19…`) → `variableUpsert:true` each (non-destructive upsert; existing vars untouched).
- **Explicit deterministic redeploy** via `serviceInstanceDeploy(environmentId, serviceId)` on both services → `true` each (did NOT rely on Railway "Wait for CI" — bypasses the phantom-skip failure mode).
- New deployments captured + polled to terminal:
  - api deployment `2d114947` — meta.commitHash `798fae1` — polled BUILDING → DEPLOYING → **SUCCESS**.
  - web deployment `c786da28` — meta.commitHash `798fae1` — polled BUILDING → **SUCCESS**.
  - Bounded MONITOR: `success_condition` = both `status==SUCCESS`; `failure_condition` = `status IN (FAILED,CRASHED,REMOVED,SKIPPED)`; `timeout_budget=900s`; `poll_delay=45s`. Reached BOTH_SUCCESS in ~2 min. Neither SKIPPED. Immutable fresh-artifact deploy (new container per service).
- **Armed rollback (captured before mutation, unused):** api `d0bec3d9` (2ae3e06) / web `2298ce0a` (2ae3e06) — the prior known-good SUCCESS deployments. Not triggered: deploy boots clean, `/health` green, api healthy, no data-loss regression, no crash — the defect is an isolated web-route render bug, not an infra failure warranting rollback.

### /health — own-domain, exact deployed hash

- `GET https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"798fae1"}`. Version matches the deployed hash exactly (no stale-routing mirage); db connected; no crash-loop. Probed the api service's own domain, not a global alias.
- Fix present in shipped source: `apps/web/app/(app)/sourcing/companies/[id]/page.tsx` (server component) now passes ONLY serializable props to `<CompanyDetail>` — `companyId`, `companyName`, and conditionally `companyDomain` (lines 90–94). The illegal `onCandidateResolved` function prop is **gone**; `onCandidateResolved` is now optional on `CompanyDetailProps`. HEAD == `798fae1`. The 500 root cause (RSC serializer rejecting an event-handler prop) is fixed and PROVEN by the 200 status.

### The 4-surface DOM proof (real headless chromium-1208, live `document.body.innerText`, HttpOnly cookies via `context.addCookies()`)

Seed: analyst minted web-origin (`/auth/invite {role:analyst}` → 201 token; `/auth/signup {inviteToken,password}` → 201; `/auth/me` → 200 role:analyst). Fixture connection `Vlast-<uniq>` (`68c453ae…`) → **201**; sync → **201 `{"ingested":5,"updated":0}`** → 4 canonical companies. Detail id used: `0095627e-92ec-4e7d-9a0a-659099c263ff` = "Acme Technologies Inc." (also cross-checked `712ef254…` = "Bright Horizon Ventures LLC").

| Surface | Method | HTTP (document) | emptyState | Company names in live DOM | Verdict |
|---|---|---|---|---|---|
| `/sourcing` (workspace) | real-DOM | 200 | false | Acme Technologies Inc., Bright Horizon Ventures LLC, Delta Systems Corp, Epsilon Analytics | **PASS** |
| `/sourcing/companies` (deep list) | real-DOM | 200 | false | all 4 ("4 records", contact/source counts); zero "No companies yet" markers | **PASS** |
| `/sourcing/companies/:id` (DETAIL — THE fix proof) | real-DOM | **200** (500 is fixed) | n/a (error state) | **NONE** — renders "Network error — please try again" + dead "Try again" button | **FAIL** |
| `/compliance/settings` | real-DOM | 200 | n/a | "Compliance Rules Engine", Rules/Disclaimer/Suppression UI, "3 rules", Add Rule | **PASS** |

- In-memory filter: typing "Acme" into the `/sourcing` filter fired **0** page-route data-fetches; DOM narrowed to just Acme. **PASS.**
- RBAC: analyst → `/compliance/settings` redirected off (307 at HTTP; landed on `/` in-browser). Compliance user (invite→signup role:compliance → 201) renders the settings page. **PASS.**

### Detail-page "Network error" — root-caused with certainty (5th masked sibling defect; NOT the 500, NOT the api, NOT a harness artifact)

- **Transport:** the 500 is genuinely gone — `/sourcing/companies/:id` document request returns **200**. The function-prop fix landed.
- **Render:** the client `CompanyDetail` component (`_components/CompanyDetail.tsx`, `'use client'`) fetches detail via `apiFetch('/sourcing/companies/:id')` in a `useEffect`; on fetch throw it sets `setError('Network error — please try again')` (line 636). The agent observed exactly this branch — the fetch **throws**, no successful request.
- **Mechanism (proven against deployed state):** `apiFetch` issues a **same-origin** GET to the WEB origin (`/sourcing/companies/<id>`), relying on Next.js `afterFiles` rewrites to proxy it to the API. But **there is NO `/sourcing/companies/:id` rewrite rule** in `apps/web/next.config.ts` `afterFiles` (only `/sourcing/connections[/:id[/sync]]` and `/sourcing/dedupe-candidates/:id/resolve` exist). Because `afterFiles` runs *after* page resolution and the `[id]/page.tsx` page EXISTS, the same-origin client GET is served the **Next.js HTML page**, never the API JSON. `res.json()`/`safeParse` on HTML throws → caught → "Network error". The config's own comment admits the ambiguity ("Client JSON fetch → Next.js [id] page OR API … the [id] page returns HTML").
- **Empirical confirmation:** `curl -H "Accept: application/json" https://dealflow-web-production-a4f7.up.railway.app/sourcing/companies/<id>` → `content-type: text/html`, body `<!DOCTYPE html>…#__next_error__…` (unauth 307→/login; authed serves the `[id]` page HTML). Never `application/json`. The client can never get JSON from this path.
- **Isolation proving web-only, not api:** API-direct `GET /sourcing/companies/:id` (analyst cookie jar) → **200** valid JSON (route healthy). RBAC resolves analyst with no throw. The only broken link is the missing rewrite / same-origin HTML collision on the client detail fetch.
- **Why prior rounds & HTML-substring checks missed it:** server-rendered HTML for this route contains "Acme Technologies" and no "Network error" — a substring check PASSES. The client then hydrates and overwrites the server output with the error state. Only a post-hydration live-DOM assertion catches it. And before `798fae1`, the route 500'd first, masking this entirely.
- **Triage tag:** `nextjs` (App Router rewrite / same-origin page-vs-API collision on `/sourcing/companies/:id`). **Fix options:** (a) point `CompanyDetail`'s detail fetch at the API origin directly (env `NEXT_PUBLIC_API_URL`) instead of the same-origin path, OR (b) give the client a distinct data path that has an `afterFiles` rewrite and does not collide with the `[id]` page (e.g. `/api/sourcing/companies/:id`), OR (c) hydrate the detail from the server component (pass the already-fetched detail JSON as a serializable prop — the server `[id]/page.tsx` already fetches `fetchCompanyBasic`; extend it to fetch full detail and pass it down, eliminating the client fetch entirely). **Add a post-hydration route-render test** for `/sourcing/companies/:id` that asserts the company heading + tabs render (not the error state), feeding the real deployed rewrite topology, so this class can't ship green again.

### Regression

| Check | Result | Verdict |
|---|---|---|
| connection create | **201** | PASS |
| connection create dup | **409** | PASS |
| connection create bad providerKey | **400** | PASS |
| login (`/auth/me`) | **200** role:analyst | PASS |
| `/health` | **200** version `798fae1`, db ok, no crash | PASS |
| API-direct `GET /sourcing/companies/:id` | **200** valid JSON | PASS |
| **WEB `/sourcing/companies/:id` detail renders a company** | **200 document, but DOM renders "Network error" — detail NOT rendered** | **FAIL** |

### No fabricated green

Every verdict is traced to a live deployed-state artifact: Railway GraphQL deployment `status` + `meta.commitHash`, `/health` body, real headless-chromium-1208 post-hydration `innerText` DOM assertions, live API JSON, captured document-response HTTP statuses/content-types, and the deployed `next.config.ts` rewrite topology. The 500 fix is genuinely proven (200 status). The detail render failure is genuinely reproduced (two ids) and mechanistically root-caused (missing rewrite → same-origin HTML collision), explicitly ruled NOT a harness artifact by the `curl content-type: text/html` proof against the deployed web origin. Approving on a green transport status while the required DETAIL surface renders an error state with data present would be a fabricated green; per the Iron Law this hard-stops the C-2 exit and returns to Build/fast-fix.

### Cleanup

- Temp fixture connections (`68c453ae…` `Vlast-<uniq>`, `62accaa3…` `Reg-<uniq>`) retained — no DELETE endpoint (404; ingestion sources are audit-referenced by design). Bad-providerKey attempt rejected 400, not persisted.
- Test analyst + compliance users retained — append-only `audit_log_entries` immutability trigger blocks deleting an actor referenced by the hash chain (compliance control working as designed, per prior C-2 rounds).
- Cookie jars, header dumps, cookie-JSON (session tokens), and all `/tmp/dealflow-*` temp files `shred`/removed.

```yaml
head_signoff:
  verdict: REJECTED
  stage: C-2
  reviewers: {}
  failed_checks:
    - "core-proof#2: /sourcing/companies/:id (DETAIL) must render the company detail (contacts/provenance tabs) — FAILS live. Document returns HTTP 200 (function-prop 500 IS fixed), but client CompanyDetail renders 'Network error — please try again' and never fetches. Root cause: NO /sourcing/companies/:id rewrite in apps/web/next.config.ts afterFiles → same-origin apiFetch('/sourcing/companies/:id') is served the Next.js [id] page HTML (proven: curl → content-type text/html, #__next_error__), res.json parse throws → error branch. Web-only; API-direct GET /sourcing/companies/:id → 200 valid JSON. 5th masked sibling of the empty/broken-render chain, uncovered by the 500 fix."
  rationale: >
    The Server→Client function-prop fix at 798fae1 is CORRECT and PROVEN to have landed: both
    services are live on 798fae1 (api + web, meta.commitHash 798fae1, neither SKIPPED),
    /health == 798fae1 on the api own-domain (db ok, no crash), and the DETAIL route no longer
    returns HTTP 500 — it now returns 200 at the transport layer, with the illegal
    onCandidateResolved function prop removed from [id]/page.tsx and made optional on
    CompanyDetailProps in shipped source. Three of the four surfaces render real data in the live
    headless-chromium-1208 DOM: workspace /sourcing (4 rows, emptyState false, in-memory filter
    confirmed), deep-list /sourcing/companies (all 4 names, zero empty-state markers), and
    /compliance/settings (rules UI + RBAC). HOWEVER the task's core proof #2 — the
    /sourcing/companies/:id DETAIL page must RENDER the company detail — FAILS live: HTTP 200 masks
    a client component that renders a hard 'Network error — please try again' state and never
    fetches. Root-caused with certainty against deployed state: there is NO /sourcing/companies/:id
    rewrite in next.config.ts afterFiles, so the client's same-origin apiFetch('/sourcing/companies/:id')
    is served the Next.js [id] page HTML instead of API JSON (proven empirically — curl returns
    content-type text/html, #__next_error__, never application/json), the JSON parse throws, and the
    catch sets the error state. This is web-only (API-direct GET /sourcing/companies/:id → 200 valid
    JSON, route healthy), NOT the 500 and NOT a harness artifact, and is exactly the masked-render
    sibling class this chain exists to kill — surfaced now precisely because 798fae1 cleared the 500
    that was hiding it. The Iron Law is explicit: any DETAIL surface that 500s OR renders
    empty-with-data → FAIL + RETURN with the specific DOM/error evidence. Approving on a green
    transport status while the required DETAIL surface renders an error with data present would be a
    fabricated green. No fabricated green: every check traces to a live artifact — Railway GraphQL
    status + commitHash, /health body, headless post-hydration DOM assertion, live API JSON, and the
    deployed rewrite topology + content-type proof. Deploy 798fae1 left in place (boots clean, /health
    green, 3 of 4 surfaces render, no api crash, no data-loss regression); DB left clean; rollback
    armed (api d0bec3d9 / web 2298ce0a, both 2ae3e06) but unused — the defect is an isolated web SSR/
    client-fetch route bug, not an infra failure warranting rollback.
  next_action: REWORK_B-block  # DETAIL client fetch must reach the API JSON, not the same-origin [id] page HTML. Fix one of: (a) CompanyDetail fetches the API origin directly (NEXT_PUBLIC_API_URL) for detail; (b) add a non-colliding data path (e.g. /api/sourcing/companies/:id) WITH an afterFiles rewrite; or (c) hydrate detail from the server component ([id]/page.tsx already fetches basic — extend to full detail + pass serializable JSON down, dropping the client fetch). Add a POST-HYDRATION route-render test for /sourcing/companies/:id asserting the company heading + contacts/provenance tabs render (not the error state), exercising the real deployed rewrite topology, so this same-origin-collision class can't ship green again. Do NOT touch the 798fae1 function-prop fix or companySchema — both are proven. Then re-run C-2.
```

---

## V-3 detail-SSR-hydrate re-verify (e4debc6) — FINAL

**verdict: PASS (APPROVED)** — head-ci-cd. The page-route-collision fix at `e4debc6` **is CORRECT and PROVEN live**. The detail route's client fetch no longer collides with the Next.js `[id]` page: the server component SSR-fetches the full detail and passes it as a serializable `initialDetail` prop, `CompanyDetail`'s `useEffect` early-returns (skips the client fetch entirely), and the workspace drawer now fetches the non-colliding proxied path `/sourcing/company-detail/:id`. **All 4 sourcing/compliance surfaces render real data in the live post-hydration headless-chromium-1208 DOM — including the DETAIL surface, which now renders the company heading + Contacts/Provenance/Dedupe-Review tabs + real contacts with NO "Network error" and NO empty/error state.** This closes the 5-sibling defect chain. The wave's Iron Law is NOT tripped on any surface and the api does NOT crash. C-2 passes; return to the V-3 gate.

### Deploy — e4debc6 live on both services (NOT stale, NOT SKIPPED, deterministic)

- **Token:** project-scoped `RAILWAY_TOKEN` (len 36) from `APP_RAILWAY_TOKEN` valid → `projectToken` returned project `ce095f75-1f3d-4af9-939e-fe8532541475`, env `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (production). Deploy-scoped `project(id)` probe returned `data.project` (5 services) with no `errors` → credential usable. Not a block.
- **GIT_SHA** upserted to `e4debc6` on **dealflow-api** (`dcdb4ab4…`) + **dealflow-web** (`06b07f19…`) via non-destructive single `variableUpsert` each (`variableUpsert:true`; no other var touched — all env pre-bound: AUDIT_LOG_HMAC_KEY, DATABASE_URL, SUPERTOKENS_*, WEB_ORIGIN, INTERNAL_API_BASE_URL confirmed present on api).
- **Explicit deterministic redeploy** via `serviceInstanceDeploy(environmentId, serviceId)` on both services → `true` each. Did NOT trust the ambient CI/webhook auto-deploy (an e4debc6 SUCCESS pair already existed — `d97c26e7`/`47f266f5` — but the C-block gate never accepts an ambient green; provenance is self-triggered).
- New deployments, polled to terminal via bounded MONITOR:
  - api deployment `67a39336-da0f-4baa-9904-fe5558bbda57` — meta.commitHash `e4debc6161550cd1730707a7b16c5711279a151e` — BUILDING → **SUCCESS**.
  - web deployment `bfcca5a0-2e3b-43a8-8a17-d1c158e0fa9b` — meta.commitHash `e4debc6161550cd…` — DEPLOYING → **SUCCESS**.
  - Reached BOTH_SUCCESS in ~30s. Neither SKIPPED. Post-deploy `deployments(first:1)` query confirms `67a39336…`/`bfcca5a0…` are the current heads on each service (no phantom-skip; the deploy I triggered is what is live). Immutable fresh-artifact deploy.
- **Armed rollback (captured before mutation, unused):** api `d97c26e7-eaf8-40b0-843f-25bcabac60fa` / web `47f266f5-589a-442c-a214-25ac39fa7624` — the prior known-good SUCCESS deployments (both e4debc6, boot-clean). Not triggered: e4debc6 boots clean, `/health` green, no crash, no data-loss regression, all surfaces render — nothing to roll back from.

### /health — own-domain, exact deployed hash

- `GET https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"e4debc6"}` on the api service's OWN container domain (not a global alias). Version matches the deployed hash exactly (no stale-routing mirage); db connected; no crash-loop. Re-confirmed a second time after verification.
- Fix present in shipped source (HEAD `e4debc6`, `git show --stat`): `apps/web/app/(app)/sourcing/companies/[id]/page.tsx` (+70) SSR-fetches full detail (`fetchCompanyDetail` → server-side `${apiBase()}/sourcing/companies/:id`) and passes it as `initialDetail` to `<CompanyDetail>`; `CompanyDetail.tsx` (+42) `useEffect` returns early when `initialDetail !== undefined` (skips the client fetch — the "Network error" branch is now unreachable on the detail page); `DetailDrawer.tsx` fetches `/sourcing/company-detail/:id`; `next.config.ts` (+12) adds the `afterFiles` rewrite `/sourcing/company-detail/:id → ${apiProxyTarget}/sourcing/companies/:id` (no Next.js page at that path → always proxied to API JSON). A 556-line `[id]/page.test.tsx` was added.

### The 4-surface POST-HYDRATION DOM proof (real headless chromium-1208, Playwright 1.61.1, live `document.body.innerText`, HttpOnly session cookies via `context.addCookies()`)

Seed: analyst minted web-origin (`/auth/invite {role:analyst}` → token; `/auth/signup {inviteToken,password}` → 201; `/auth/me` → 200 role:analyst). Anti-CSRF = SuperTokens VIA_CUSTOM_HEADER; mutations carry `Origin: <web-origin>` + `rid: anti-csrf`. Fixture connection `Vfinal-1783149838` (`4e4bf186…`) → **201**; sync → **201 `{"ingested":5,"updated":0}`** → 4 canonical companies. Detail id `0095627e-92ec-4e7d-9a0a-659099c263ff` = "Acme Technologies Inc." (API-direct GET `/sourcing/companies/:id` → **200 valid JSON**, route healthy). Session cookies (sAccessToken/sRefreshToken, HttpOnly) injected into a real chromium-1208 context; live post-hydration DOM asserted.

| Surface | Method | HTTP | emptyState | Live-DOM result | Verdict |
|---|---|---|---|---|---|
| `/sourcing` (workspace) | real-DOM | 200 | **false** | Acme, Delta Systems, Bright Horizon, Epsilon all render | **PASS** |
| `/sourcing/companies` (deep list) | real-DOM | 200 | **false** | all 4 company names render; zero "No companies yet"/"No companies found" markers | **PASS** |
| `/sourcing/companies/:id` (**DETAIL — THE fix proof**) | real-DOM | **200** | n/a | **`networkError:false`, `emptyOrError:false`, `redirectedToList:false`, 0 console errors.** Renders the company heading "Acme Technologies Inc." + `ID: 0095627e…` + `https://www.acme.com · Active`, the **Contacts / Provenance / Dedupe Review** tabs, and real contacts (Alice Walker CEO, Bob Chen CTO, Frank Li VP Engineering, masked emails). SSR-hydration fix PROVEN. | **PASS** |
| `/compliance/settings` | real-DOM | 200 | n/a | compliance user minted; renders "Compliance Rules Engine" + Rules/Disclaimer/Suppression UI, `errorState:false` | **PASS** |

- **In-memory filter (workspace):** typing "Acme" into the search input → `afterQuery_hasAcme:true`, `afterQuery_deltaFiltered:true` (Delta Systems removed from the DOM), and **`netRequestsDuringSearch: []`** — the filter runs entirely in-memory over the SSR-loaded list with ZERO network fetch to any `/sourcing/*` path. **PASS.**
- The DETAIL result directly reverses every prior round: `798fae1` rendered "Network error — please try again"; `e4debc6` renders the full detail with no error branch reachable (client fetch skipped via `initialDetail`).

### Regression (all PASS)

| Check | Result | Verdict |
|---|---|---|
| POST /sourcing/connections (new displayName) | **201** (id `4e4bf186…`, createdBy set) | PASS |
| POST same displayName again (dup) | **409** | PASS |
| POST unknown providerKey (`nope-xyz`) | **400** | PASS |
| POST /sourcing/connections/:id/sync | **201** `{"ingested":5,"updated":0}` | PASS |
| login (`/auth/me`) | **200** role:analyst | PASS |
| api `/health` | **200** version `e4debc6`, db ok, no crash | PASS |
| API-direct GET /sourcing/companies/:id | **200** valid JSON | PASS |
| connection-create audited (compliance GET /compliance/audit-log/verify) | **200 `{"ok":true,"entriesChecked":57}`** — HMAC-SHA256 hash chain intact | PASS |

### No fabricated green

Every verdict traces to a live deployed-state artifact: Railway GraphQL deployment `status` + `meta.commitHash`, `/health` body on the api's own domain, real headless-chromium-1208 **post-hydration** `innerText` DOM assertions (not HTML-substring — the exact failure mode that masked the prior "Network error" behind a 200), live API JSON, and the audit-chain verify. The detail render is proven in the live DOM (heading + tabs + contacts, no error branch), not inferred from a 200 status.

### Canary — SKIPPED

0 DAU < `canary_threshold_dau: 1000`. No real-user traffic to shift; canary not armed this wave.

### Cleanup

- **No temp TCP proxy created this round** — verification used API-direct calls + the headless-DOM harness (no DB probe needed). `DATABASE_PUBLIC_URL` is an unresolved Railway template (host `:`) and reaching the DB to truncate would require standing up a new proxy; standing one up solely to delete harmless demo fixtures is the worse security posture, so none was opened (nothing to tear down).
- Seeded fixture connection + 4 canonical demo companies **retained** — external-party fixture/demo data, no DELETE endpoint (connections are audit-referenced by design). Harmless; not real user data. (This is a PASS — no migration-retry depends on a clean DB, unlike prior REJECTED rounds.)
- Test analyst + compliance users **retained** — append-only `audit_log_entries` immutability trigger blocks deleting an actor referenced by the hash chain (compliance control working as designed, per prior C-2 rounds).
- Local credential + cookie-jar + token + proof-script temp files `shred`-scrubbed / removed (verified: no `/tmp/dealflow-*` or `/tmp/ph_*` remain).
- GIT_SHA left at `e4debc6` (correct for the deployed hash); deploy left in place (boots clean, `/health` green, all 4 surfaces render).

### Chronology

- 2026-07-04 ~07:21 UTC: GIT_SHA=e4debc6 upserted on api+web; explicit `serviceInstanceDeploy` both services.
- ~07:22 UTC: api dep `67a39336` + web dep `bfcca5a0` both **SUCCESS** (~30s rebuild); neither SKIPPED. /health == e4debc6 own-domain.
- ~07:23 UTC: analyst minted; connection `4e4bf186` created (201), dup 409, bad-key 400, sync `{ingested:5}` → 4 companies.
- ~07:25–07:26 UTC: headless-chromium-1208 4-surface post-hydration DOM proof — workspace / deep-list / **DETAIL (renders heading+tabs+contacts, no Network error)** / compliance-settings all render. In-memory filter fires 0 fetches. Audit chain ok:true (57 entries). Canary skipped (0 DAU).
- Cleanup: temp cred files scrubbed; no proxy created. Deploy e4debc6 left in place.

### Monitor task (deploy wait — bounded, three-condition)

```yaml
platform: railway
success_condition: deployments(first:1).edges[0].node.status == "SUCCESS"   # per-service, polled
failure_condition: status IN ("FAILED","CRASHED","REMOVED","SKIPPED")
timeout_budget: 900   # seconds
poll_delay: 30
result: BOTH_SUCCESS (api 67a39336, web bfcca5a0) in ~30s — no SKIPPED
```

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reverify: "V-3 detail-SSR-hydrate re-verify (e4debc6) — FINAL"
  reviewers: {}
  reverify_passed_checks:
    - "DETAIL /sourcing/companies/:id renders the company detail (THE fix proof): live headless-chromium-1208 post-hydration DOM shows the company heading 'Acme Technologies Inc.' + Contacts/Provenance/Dedupe-Review tabs + real contacts; networkError=false, emptyOrError=false, redirectedToList=false, 0 console errors. The SSR-hydrate fix (server passes initialDetail → CompanyDetail skips the client fetch; drawer uses the non-colliding /sourcing/company-detail/:id proxy) closes the 5th masked sibling. Directly reverses 798fae1's 'Network error'."
    - "workspace /sourcing renders companies (live DOM emptyState=false, 4 names); in-memory search filters (Delta removed) with netRequestsDuringSearch=[] (zero page-route fetch)"
    - "deep-list /sourcing/companies renders all 4 companies (live DOM emptyState=false, zero 'No companies yet' markers)"
    - "compliance /compliance/settings renders Rules Engine UI (compliance user, errorState=false)"
    - "commit-SHA provenance: /health version == e4debc6 on api's OWN container domain (not global); both services SUCCESS via explicit serviceInstanceDeploy (api 67a39336 / web bfcca5a0, meta.commitHash e4debc6), neither SKIPPED; post-deploy latest-deployment query confirms current heads (no phantom skip)"
    - "armed rollback captured pre-mutation (api d97c26e7 / web 47f266f5); unused (boots clean)"
    - "regression: connection create 201 / dup 409 / bad-key 400 / sync {ingested:5} / login 200 / /health ok / API-direct detail 200 JSON — all PASS"
    - "connection-create audited: audit-log chain-verify ok:true, entriesChecked=57; HMAC-SHA256 chain intact"
    - "bounded MONITOR: success=SUCCESS / failure=IN(FAILED,CRASHED,REMOVED,SKIPPED) / timeout_budget=900s; immutable fresh-artifact deploy; GIT_SHA upserted non-destructively; all env pre-bound"
    - "canary correctly skipped (0 DAU < 1000); temp credential/cookie/token files shredded; no lingering TCP proxy (none created)"
  rationale: >
    The merged e4debc6 fix WORKS live and closes the 5-sibling chain. The DETAIL surface —
    /sourcing/companies/:id, the single open defect that drove the prior REJECTED verdict
    (798fae1 rendered "Network error — please try again") — now renders the full company
    detail in a real headless-chromium-1208 post-hydration DOM: the company heading, the
    Contacts/Provenance/Dedupe-Review tabs, and real contact rows, with the error branch
    provably unreachable. Root cause is genuinely eliminated: the server component now
    SSR-fetches the full detail and passes it as a serializable initialDetail prop, so
    CompanyDetail's useEffect early-returns and never issues the same-origin client fetch that
    was being served the Next.js [id] page HTML; the workspace drawer fetches the new
    non-colliding /sourcing/company-detail/:id path that has an afterFiles rewrite to the API.
    All four surfaces render real data (workspace, deep list, detail, compliance-settings), the
    in-memory workspace filter fires zero network requests, and every non-detail acceptance
    criterion is green — connection create 201, dup 409, bad-key 400, sync ingested, login 200,
    and the create is audited into an intact HMAC-SHA256 chain (verify ok:true, 57 entries).
    Provenance is clean and self-triggered: I did not trust the ambient auto-deploy — I upserted
    GIT_SHA and issued an explicit serviceInstanceDeploy on both services, polled both to SUCCESS
    (neither SKIPPED), confirmed they are the current heads, and verified /health == e4debc6 on the
    api's own container domain (not a global-domain mirage). Armed rollback was captured before
    mutation and was not needed. Critically, this round asserts the POST-HYDRATION live DOM rather
    than an HTML substring — the exact discipline that catches the class of masked bug (a green 200
    hiding a client error state) that hid behind the prior four rounds. No fabricated green: every
    verdict traces to a live deployed-state artifact — Railway GraphQL deployment status +
    meta.commitHash, /health body, headless post-hydration DOM assertions, live API JSON, and the
    audit-chain verify. C-2 passes; the wave returns to the V-3 gate to close the V-block.
  next_action: PROCEED_TO_V3-GATE  # detail SSR-hydrate fix proven live; all 4 surfaces render post-hydration; chain closed. Return to head-verifier V-3 gate to close the V-block. Deploy e4debc6 left in place; DB left with harmless demo fixtures; no rollback.
```
