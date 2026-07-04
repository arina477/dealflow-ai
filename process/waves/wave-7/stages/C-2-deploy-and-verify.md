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

```yaml
head_signoff:
  verdict: REJECTED
  stage: C-2
  reviewers:
    sre-engineer: "root-caused drizzle-orm timestamp-guard skip of 0005 (journal when=2025-07-05 < 0004 created_at); recommended journal when fix + post-migrate row-count assertion"
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
