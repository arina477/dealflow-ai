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
