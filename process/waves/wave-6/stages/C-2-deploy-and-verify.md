# C-2 — Deploy & verify (wave 6 — deal-sourcing data spine) — RE-RUN #3

**Stage:** C-2 (CI/CD block, deploy-and-verify incl. canary)
**Head:** head-ci-cd (fresh spawn, gates C-block)
**Target commit:** `918dbf0be83216f8a7774e92cb8d7d31dfc47192` (`918dbf0`, main tip — the fixture-asset fix merge)
**Outcome:** **PASS (APPROVED)** — both prior C-2 blockers are fixed and merged; the LIVE dedupe payoff was exercised end-to-end against the deployed `918dbf0` artifact and PROVEN. Sync now returns 201 (was 500); cross-source dedup collapses to one canonical per domain with full multi-source provenance; no false-positive merge; idempotent re-sync does not pile up; RBAC + audit chain intact.

---

## What this re-run resolved vs. the two prior C-2 FAILs

- **C-2 re-run #1 (`5f33c7c`) — SourcingService DI boot crash** → FIXED at `96179b0`. Confirmed clean this run: api boots, `SourcingModule` initialized, no `UnknownDependenciesException`.
- **C-2 re-run #2 (`96179b0`) — fixture JSON absent from `dist/` → sync 500** → FIXED at `918dbf0` (`nest-cli.json` assets glob). Confirmed this run: `POST /sourcing/connections/:id/sync` → **201** with the fixture loading; fixture lands in `dist/` at 1290 bytes.

No fabricated green: every claim below is traced to a live command against the deployed `918dbf0` container hash or a direct query on the live Postgres 16 DB (via a temporary, now-deleted TCP proxy).

---

## Action 0 — Railway credential (PRESENT)

- `APP_RAILWAY_TOKEN` (36 chars) → `RAILWAY_TOKEN`; deploy-scoped `project(id:)` probe returned `data.project` (5 services) + `errors:null`. Token authenticates.
- Project `ce095f75-1f3d-4af9-939e-fe8532541475` (`app-arina-5ywq3s`), env `production` `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (single env; not created).

## Action 1/2 — Deploy trigger + verification (SUCCESS on 918dbf0)

**Rollback path armed BEFORE mutating (Rollback-Blind-Deploy guard):**
- api previous known-good SUCCESS deploy id cached: `3c3a9676-f04b-4122-b8cc-bacfa2d7a3a6` (the `96179b0`-era deploy).
- web previous known-good: `6a4a384b-ca01-4693-915e-eeb4281546f1`.

**GIT_SHA bound** on dealflow-api → `918dbf0` (variableUpsert=true; verified read-back) so `/health` version reflects the deployed hash.

**Deploy mutations (exact-SHA / commit-pinned):**
- dealflow-api: `serviceInstanceDeployV2` → deployment `2c32e0dd-44fb-4cef-8718-92c3d606ce33` → **SUCCESS**, `meta.commitHash = 918dbf0be83216…` (exact HEAD of main), commit message = the fixture-asset fix. Latest/serving deployment on the service.
- dealflow-web: first `serviceInstanceDeployV2` built `96179b0` (Railway redeployed the service's last-cached commit ref, not main HEAD — a **Ghost-Green / stale-commit provenance catch**). Re-fired with explicit `commitSha:918dbf0…` → deployment `7b7cc7bc-7ad9-4dfd-8529-32cb3c71f6e6` → **SUCCESS @ 918dbf0**. Both services now provably on one commit. (Wave-6 delta 96179b0→918dbf0 is api-only, so the web bundle is byte-identical either way; pinning it was provenance discipline, not a functional need.)

**Health-check against the deployed hash (not a stale globally-routed positive):**
- `GET /health` → `{"status":"ok","db":"ok","version":"918dbf0"}` — deployed-hash match, DB connected.
- `preDeployCommand` (`drizzle-kit migrate`) ran as the one-shot migration before the app took traffic.

## Migration 0004 + 7 tables (confirmed live)

- All 7 wave-6 sourcing tables present: `data_source_connections`, `raw_companies`, `companies`, `contacts`, `company_provenance`, `contact_provenance`, `dedupe_candidates`.
- Drizzle journal `drizzle.__drizzle_migrations` = 5 rows (0000–0004); 0004 registered + applied. Re-migrate is a no-op (additive-only; expand-only).
- Dedupe-guard unique indexes present: `companies_normalized_domain_partial_unique`, `dedupe_candidates_raw_matched_pending_unique` (B-6 candidate-idempotency), `company_provenance_company_raw_unique`.

---

## THE LIVE DEDUPE PAYOFF (proven against deployed 918dbf0)

DB inspected via a temporary Postgres TCP proxy (`hayabusa.proxy.rlwy.net:22806`, proxy id `902ef719-…`) — **deleted at cleanup**. Auth: fresh ANALYST minted via `/auth/invite {role:analyst}` → `/auth/signup` (cookie jar); mutations carry `Origin: <web-origin>` + `rid: anti-csrf`.

**Seed:** `data_source_connection` (provider_key=`fixture`, enabled) inserted directly against `DATABASE_URL` via the temp proxy (no connections-create endpoint exists; noted). Started from a clean sourcing-tables state (all 0) for unambiguous counts.

**Sync (was 500):** `POST /sourcing/connections/:id/sync` (analyst + rid) → **201 `{"ingested":5,"updated":0}`**. The fixture (5 records) now loads.

**Cross-source dedup — the payoff, proven:**
- Fixture has 2 records → `acme.com` (`grata-001` `https://www.acme.com`, `grata-005` `http://acme.com/about`).
- `GET /sourcing/companies` → **4 canonical companies**, `acme.com` deduped to **ONE** canonical (NOT two).
- DB: `acme.com` → **2 `company_provenance` rows** (grata-001 + grata-005, both sources, distinct raw_company_ids). Contact dedup: Alice Walker (`alice@acme.com` == `ALICE@ACME.COM` case-normalized) → **ONE contact** with **2 `contact_provenance` rows** (principle-3 lineage); Bob + Frank → 1 each; acme.com contactCount=3.
- **True cross-SOURCE proof:** a 2nd distinct connection re-synced the fixture → companies stayed **4** (every record domain-matched an existing canonical and merged); each canonical then showed provenance from **2 distinct connections** (`distinct_conns=2`). No new canonicals.

**Ambiguous → candidate:** this fixture produces **0 `dedupe_candidates`** — its dups are exact-domain matches (Priority-1 auto-merge) and all distinct records have distinct domains, so no record is ambiguous. Correct, non-fabricated outcome. (The resolve-audited path is therefore not exercised by this fixture; see below.)

**False-positive check (the /review CRITICAL-1 fix):** 4 companies = 4 distinct `normalized_domain` (1:1). The three distinct-domain companies (`brighthorizon.vc`, `deltasystems.io`, `epsilon.ai`) stayed separate. `normalizeName` does not strip `co` — "X Co"/"X Inc"-class records do not collapse. **No wrong merge.**

**Idempotent re-sync (B-6 candidate-idempotency fix):** `POST /sync` again → **201 `{"ingested":0,"updated":5}`**; company/contact/company_provenance/contact_provenance/dedupe_candidates counts **IDENTICAL** before/after. No pile-up (unique-index backstops hold).

**Dedupe-resolve (audited, CRITICAL-2):** endpoint verified live-wired — non-existent candidate → 404 (auth+RBAC passed, reached service), bad body → 400 (Zod). A merge-with-contact_provenance-promotion could NOT be exercised end-to-end because this deterministic fixture yields no pending candidate; head-ci-cd refused to fabricate a candidate via raw DB writes (would test a synthetic path, not the deployed sync flow). Coverage for the audited-merge + contact_provenance-promotion lives in B-2/B-6 `dedupe.engine.test.ts` (candidate-path test) + the /review CRITICAL-2 fix. Audit chain confirmed intact live (`GET /compliance/audit-log/verify` → `ok:true, entriesChecked=33`), and `sourcing-dedupe-resolve` correctly did NOT increment (no human resolve occurred; machine auto-merges are deliberately un-audited by design).

**RBAC (live matrix, all 4 sourcing endpoints):**

| Endpoint | analyst | advisor | compliance | unauth |
|---|---|---|---|---|
| GET /sourcing/companies | 200 | 403 | 403 | 401 |
| GET /sourcing/companies/:id | 200 | 403 | — | 401 |
| POST /sourcing/connections/:id/sync | 201 | 403 | 403 | 401 |
| POST /sourcing/dedupe-candidates/:id/resolve | 404 (reached) | 403 | 403 | 401 |

Fail-closed enforced from the shared `rolesForRoute` matrix. Web nav gating derives from the same matrix (`navItemsForRole` + `nav⊆RBAC` invariant): analyst sees the Sourcing nav item + `/sourcing/companies`; non-analyst does not get the item and `assertRole` redirects denied roles to `/`. Unauthenticated web route → 307 `/login` (verified live). Full authenticated browser walkthrough not run (Playwright Chrome binary absent in this env); server-side gating verified via deployed source + the live API RBAC matrix + live 307 redirect.

**Regression:** web `/` → 307 `/login` (auth gate), `/login` → 200. API `/health` 200 on 918dbf0. Compliance audit-log verify → 200 `ok:true`. Auth invite→signup→me flow works (used throughout). Compliance surface reachable + chain-intact.

## Canary (skipped)

- 0 DAU < `canary_threshold_dau` 1000 → canary skipped per traffic threshold. T-block synthetic probes are the post-deploy signal.

## Cleanup (done)

- Temp TCP proxy `902ef719-…` deleted (`tcpProxyDelete=true`).
- Both seeded connections deleted (CASCADE) + all sourcing tables purged → back to 0 rows (clean state).
- Local secret/creds staging removed. Audit log untouched (still `entriesChecked=33`, `ok:true`).

---

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway dealflow-api: deploy 2c32e0dd SUCCESS, commit 918dbf0be83216 (exact HEAD)"
  - "railway dealflow-web: deploy 7b7cc7bc SUCCESS, commit 918dbf0 (commitSha-pinned after stale-commit catch)"
  - "GET /health: 200 {status:ok, db:ok, version:918dbf0} — deployed-hash match"
  - "migration 0004 applied; drizzle journal 5 rows; 7 sourcing tables present"
  - "POST /sourcing/connections/:id/sync (analyst+rid): 201 {ingested:5,updated:0}"
  - "cross-source acme.com -> 1 canonical; 2 company_provenance; Alice 1 contact + 2 contact_provenance"
  - "2nd-connection re-sync: companies stayed 4; distinct_conns=2 per canonical"
  - "false-positive guard: 4 companies = 4 distinct normalized_domains (no wrong merge)"
  - "idempotent re-sync: 201 {ingested:0,updated:5}; all counts identical (no pile-up)"
  - "dedupe_candidates=0 (deterministic fixture; resolve endpoint live-wired 404/400/403/401)"
  - "GET /compliance/audit-log/verify: 200 {ok:true, entriesChecked:33} (chain intact)"
  - "RBAC live: analyst 200/201, advisor/compliance 403, unauth 401 across all 4 endpoints"
  - "regression: web / -> 307 login, /login 200; auth flow OK; compliance surface OK"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 918dbf0, deploy_id: 2c32e0dd-44fb-4cef-8718-92c3d606ce33, health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-04T02:00:00Z"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 918dbf0, deploy_id: 7b7cc7bc-7ad9-4dfd-8529-32cb3c71f6e6, health_url: "https://dealflow-web-production-a4f7.up.railway.app/", verified_at: "2026-07-04T02:00:00Z"}
rollback_path:
  api_prev_known_good: 3c3a9676-f04b-4122-b8cc-bacfa2d7a3a6
  web_prev_known_good: 6a4a384b-ca01-4693-915e-eeb4281546f1
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window: {}
canary_monitor_id: ""
canary_alerts: []
note: "Third C-2 re-run for wave 6. Both prior blockers (DI boot crash 96179b0, fixture-asset 918dbf0) fixed + merged. LIVE dedupe payoff exercised end-to-end and PROVEN against deployed 918dbf0: sync 201, cross-source -> 1 canonical + multi-source provenance + contact_provenance, no false-positive merge, idempotent re-sync no pile-up, RBAC fail-closed, audit chain intact. dedupe_candidates=0 (deterministic fixture) so audited-merge resolve not live-exercised; covered by B-2/B-6 engine tests. Web first redeploy caught building stale 96179b0 -> re-pinned to 918dbf0. Canary skip (0 DAU). Temp DB proxy + all seeded/test rows cleaned up."

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Every C-2 stage-exit checkbox ticks from a concrete artifact against the deployed 918dbf0
    container hash. Both prior blockers are fixed + merged; commit-SHA provenance verified on
    both services (and a stale-commit web redeploy was caught + corrected via commitSha pin);
    /health matches the deployed hash; migration 0004 additive-only + journal-registered with 7
    tables; the LIVE dedupe payoff is proven (sync 201, cross-source single-canonical with 2
    company_provenance + Alice deduped to 1 contact + 2 contact_provenance, no false-positive
    merge, idempotent re-sync with zero pile-up); RBAC is fail-closed across all four endpoints;
    audit hash-chain intact. The audited-merge resolve path was not live-exercised only because
    this deterministic fixture legitimately produces zero pending candidates — no candidate was
    fabricated (its coverage is the B-2/B-6 engine candidate-path test + the /review CRITICAL-2
    fix). Rollback path armed pre-mutation; canary skipped (0 DAU). No fabricated green.
  next_action: PROCEED_TO_T
```
