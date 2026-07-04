# C-2 — Deploy & verify (wave-10 deterministic match spine, M5 first bundle)

**Head:** head-ci-cd · **Deployed commit:** `0075a20` (full `0075a2018533ded42a8531b952c0c9426fcd1182`) · **Verified:** 2026-07-04T18:35:18Z · **Mode:** founder-review

## C-1 provenance (gated before C-2 entry)

- main HEAD == `0075a20`; the CI run on main tested **exactly** `0075a2018533ded42a8531b952c0c9426fcd1182` (full-SHA match), `conclusion: success`. No Ghost-Green: tested SHA == deployed SHA. Wave-10 merged to main (squash) at 0075a20 (B-6 gate PASSED @ that commit).
- **C-1 verdict: PASS** (PR merged, CI green on the exact deployed commit).

## Action 0 — Railway credential

- Project-scoped `RAILWAY_TOKEN` (`APP_RAILWAY_TOKEN`, 36 chars) present + validated via `projectToken` self-discovery. Deploy-scoped probe returned `data.project` with no errors. Credential PRESENT (default path) — no founder pause.
- Project `ce095f75-1f3d-4af9-939e-fe8532541475` (`app-arina-5ywq3s`), env production `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8`.

## Rollback armed (BEFORE mutation — Rollback-Blind-Deploy prevention)

Known-good SUCCESS deployment IDs cached before deploying:
- **api rollback target:** `7cc3da4f-7a6a-4add-b44b-1bfdd273eaab` (SUCCESS, commit 937ae18 — wave-9)
- **web rollback target:** `22a933d3-e16e-4b93-8d80-5bbf0087ad4e` (SUCCESS, commit 937ae18 — wave-9)

Rollback path: `serviceInstanceDeployV2` / `deploymentRollback` to the cached ID via GraphQL.

## Deploy (immutable, fresh builds — no in-place mutation)

- Pre-deploy state confirmed OLD: `/health version:"937ae18"` (proves the deploy is a real change, guards Health-Check-Mirage).
- GIT_SHA updated `937ae18`→`0075a20` on api + web (only vars mutated; token never logged/committed).
- `serviceInstanceDeployV2` triggered at commit 0075a20:
  - **api deploymentId:** `81908843-3b24-49b6-ab0a-1e9a3225c77e` → **SUCCESS** (61s)
  - **web deploymentId:** `f8f4c7de-ba7e-4f22-9b80-acc93a7d61d5` → **SUCCESS** (81s)
- Neither SKIPPED (Phantom-Skip guard). Latest-deployment query confirms these exact IDs are the active deployments (no stale masking).

## Health (deployed-hash probe, own domain — not global-routed)

- api `/health` → `{"status":"ok","db":"ok","version":"0075a20"}` — version == deployed hash. `db:ok` proves the DB connection + preDeploy migration succeeded.
- web `/` (authed) → 200 Dashboard.

## Migration 0009 applied (additive-only, one-shot before traffic)

- **Static (repo):** `0009_omniscient_sabretooth.sql` = 2 CREATE TYPE (enums), 2 CREATE TABLE (`match_run`, `match_candidates`), 5 FK, 5 indexes. **Zero destructive DDL** (no DROP TABLE/COLUMN, no ALTER COLUMN on existing tables). `match_run.buyer_universe_id` UNIQUE present; `match_candidates.fit_score` CHECK(0..100) present. Down migration present. Journal idx 9 registered.
- **Execution mechanism:** api service `preDeployCommand: ["pnpm --filter @dealflow/api exec drizzle-kit migrate"]` — runs as a one-shot SYNCHRONOUS pre-deploy step BEFORE the new container is routed traffic (One-Shot-Migration-Amnesia + Destructive-Drizzle-Lock prevention). Deploy reached SUCCESS ⇒ migration applied.
- **Live functional confirmation (ground truth; app-DB has no public TCP proxy, direct `__drizzle_migrations` count not reachable — consistent with wave-9):** scored match runs read back live from `match_run` + `match_candidates` (`GET /matches/:id`); fit_score integers within CHECK bounds; re-run returns the SAME run id (UNIQUE `buyer_universe_id` enforced live). Tables exist + constrained + queryable = 0009 applied.

## LIVE matching payoff (verified against the deployed 0075a20 artifact)

Independently re-verified by head-ci-cd on real data (not extrapolated from the delegate):

- **create-run:** POST `/matches {mandateId}` (advisor) → **201**, MatchRankedList; run `1f47f6a0-0c93-41bd-99a9-8da45989b661` (mandate `ea7959f8`), 4 ranked candidates, `status:scored`. Latency 0.13s.
- **fit_score valid:** all scores integer in 0..100. Observed `[37,33,32,30]`. score_breakdown = `{sectorMatch, contactCompleteness, tieBreak, notApplied, total}` (structured rule-based; no rationale-text / LLM fields).
- **SCORER DISCRIMINATES (real data):** 4 candidates → 4 DISTINCT scores `[37,33,32,30]` — real spread, driven by `contactCompleteness` (candidates with M3 contacts rank higher). NOT uniform. **PASS** (problem-framer key concern satisfied).
- **submit-guard:** create-run on a NOT-submitted (draft) buyer_universe → **400** ("Cannot score: buyer universe … has status 'draft' — submit first").
- **idempotent + disposition-preserve (B-6 CRIT-1 fix):** PATCH candidate→accepted, then re-POST `/matches {mandateId}` → **SAME run id** AND accepted candidate STAYS accepted (dispositions NOT wiped).
- **handoff-guard:** 0-accepted → **400**; ≥1-accepted → **2xx** `readyForOutreach:true`; re-handoff → idempotent 2xx (no dup, no error).
- **NO AI-framing on the DEPLOYED page (karen MANDATORY — grepped rendered HTML myself):** `GET /matches-shortlist?mandateId=ea7959f8` (advisor, web-domain cookie) → **HTTP 200, 39KB SSR HTML**. ZERO hits for "AI Match" / "rationale is generated" / "explainability engine" / "improve model" / "similar mandates" / "generated rationale" / "AI-generated" / "explainab". Only "AI-powered" occurrence = the site-wide `<meta name="description">` marketing tagline (present on EVERY page incl. /login; describes the product, not the scorer) — NOT a false AI-capability claim about the rule-based score. Positive framing present: "rule-based" x5, "fit score" x7, "score breakdown" x9. **PASS — no CODE-OF-CONDUCT violation.**
- **no-LLM / no-spend:** create-run synchronous 0.13s, no external-API latency signature; deterministic rule-based. No Anthropic/LLM/BullMQ path (bundle boundary held).
- **RBAC (self-verified):** analyst POST `/matches` → **403**; analyst GET `/matches` → **200** (read-only); anon GET/POST → **401**. `/compliance/audit-log/verify` advisor → **403**, compliance → **200** (correctly scoped).
- **audited (self-verified):** `/compliance/audit-log/verify` (compliance) `ok:true`; a match disposition PATCH incremented `entriesChecked` 206→207 (HMAC hash-chain append, last-in-txn). Match mutations ARE audited.
- **SSR ranked list + D6 link:** matches-shortlist renders scores `37/33/32/30` in SSR HTML (rendered React, not raw JSON). Mandate-detail page (`/mandates/ea7959f8`, 200) contains "Ranked Candidates" → `matches-shortlist?mandateId=ea7959f8…`. **PASS.**

## Regression (no defects; 307s reconciled as correct RBAC)

- Web (advisor, permitted surfaces): `/` Dashboard 200, `/mandates` 200, `/buyer-universe` 200, `/matches-shortlist?mandateId=` 200.
- API-direct with correct role: `/mandates` (advisor) 200, `/buyer-universe` (advisor) 200, `/compliance/rules` (compliance) 200, `/compliance/audit-log/verify` (compliance) 200.
- `/sourcing/*` + `/compliance/settings` web pages 307→`/` for an advisor because those surfaces are RBAC-scoped (sourcing=analyst, compliance=compliance) — advisor `GET /sourcing/companies` API-direct = 403 confirms this is correct SoD/RBAC redirect, **NOT a regression** (matches wave-9 recorded behavior). Auth/session valid throughout.

## Canary

```yaml
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
```
Canary window: none (skipped). No canary monitor armed.

## Cleanup

Temp cookie jars + HTML dumps under `/tmp/c2_gate` scrubbed. Test users retained (no hard-delete endpoints; isolated fixtures). Only infra mutations: GIT_SHA var (api+web) + two deploy triggers. No secret leak (token masked in all logs; never committed).

## Iron Law — NONE fired

api crash: no (SUCCESS, /health ok). migration 0009: applied. create-run 500: no (201). fit_score out of 0-100: no (CHECK-bounded, `[37,33,32,30]`). scorer all-same: no (4 distinct). re-run wipes dispositions: no (preserved). handoff-empty ≠ 400: no (=400). AI-framing on deployed page: no (zero; only global meta tagline). LLM/Anthropic call: no (0.13s sync). RBAC broken: no (403/200/401 correct). RAILWAY_TOKEN-empty was NOT a block (36-char token present + validated).

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway github
verdict_evidence:
  - "github CI: run on main tested exactly 0075a2018533... conclusion=success (C-1 provenance, no Ghost-Green)"
  - "railway api: deploymentId 81908843-3b24-49b6-ab0a-1e9a3225c77e SUCCESS, GIT_SHA 0075a20"
  - "railway web: deploymentId f8f4c7de-ba7e-4f22-9b80-acc93a7d61d5 SUCCESS, GIT_SHA 0075a20"
  - "api /health: 200 {status:ok, db:ok, version:0075a20} on own domain (deployed hash, not global-routed)"
  - "migration 0009 additive-only (journal idx9); preDeployCommand drizzle-kit migrate one-shot before traffic; live: match_run+match_candidates queryable, UNIQUE+CHECK live-enforced"
  - "create-run 201 + ranked [37,33,32,30] 4-distinct (scorer discriminates on real data); submit-guard 400; idempotent same-run + disposition-preserve; handoff 400/2xx/idempotent"
  - "matches-shortlist SSR 200 39KB: ZERO AI-framing (only global meta tagline), rule-based/fit-score/breakdown framing present; D6 Ranked-Candidates link present"
  - "RBAC analyst-403/analyst-GET-200/anon-401; audit ok:true entriesChecked 206->207 on match mutation"
deploy_targets:
  - {platform: railway, service: dealflow-api, deploymentId: "81908843-3b24-49b6-ab0a-1e9a3225c77e", state: SUCCESS, commit: "0075a20", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-04T18:35:18Z"}
  - {platform: railway, service: dealflow-web, deploymentId: "f8f4c7de-ba7e-4f22-9b80-acc93a7d61d5", state: SUCCESS, commit: "0075a20", url: "https://dealflow-web-production-a4f7.up.railway.app", verified_at: "2026-07-04T18:35:18Z"}
rollback_armed:
  api_known_good: "7cc3da4f-7a6a-4add-b44b-1bfdd273eaab (937ae18)"
  web_known_good: "22a933d3-e16e-4b93-8d80-5bbf0087ad4e (937ae18)"
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window:
  start: ""
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
note: "Both services immutable-deployed @ 0075a20 (fresh serviceInstanceDeployV2, neither SKIPPED; rollback armed to 937ae18 known-good before mutation; correct APP project + production env id). /health returns deployed hash on own domain. Migration 0009 statically additive (UNIQUE + CHECK) + applied via preDeploy one-shot before traffic; tables live-confirmed functionally (direct __drizzle_migrations count not reachable — no public PG proxy, consistent with wave-9). Full matching payoff verified LIVE and independently by head-ci-cd: create-run 201 + real 4-distinct score spread (scorer discriminates), submit-guard 400, idempotent+disposition-preserve (B-6 CRIT-1), handoff-guard 400/2xx/idempotent, ZERO AI-framing on the rendered page (only global meta tagline; rule-based framing present) = no CODE-OF-CONDUCT violation, no-LLM (0.13s sync), RBAC 403/200/401, audited (chain ok + increments). Regression green; /sourcing + /compliance/settings 307-for-advisor traced to correct RBAC role-scoping, not a defect. Canary skipped (0 DAU)."

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers:
    live_verification: "deployment-engineer (spawned) — 11-assertion live exercise; all PASS. Its summary line mis-cited 'migration 0006' (typo); head-ci-cd independently re-verified migration 0009 + AI-framing grep + scorer-spread + RBAC + audit on the deployed artifact."
  failed_checks: []
  rationale: "Both services immutably deployed to 0075a20 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED), rollback armed to 937ae18 known-good before any mutation, correct APP project + production env id (no cross-env pollution). C-1 provenance verified: CI success on the EXACT full deployed SHA (no Ghost-Green). /health returns the deployed hash on the api's own domain (not stale, not global-routed). Migration 0009 is statically additive-only (2 new tables + enums + FK + indexes; UNIQUE buyer_universe_id + CHECK fit_score 0-100; down migration present), applied via a synchronous preDeploy drizzle-kit-migrate one-shot BEFORE traffic — and live-confirmed functionally (scored runs read back from both new tables; UNIQUE enforced via idempotent re-run). The deterministic matching payoff passed against the live artifact with head-ci-cd's own probes: create-run 201 with a REAL 4-distinct fit_score spread [37,33,32,30] (scorer discriminates, driven by contact completeness), submit-guard 400, idempotent same-run + dispositions preserved on re-run (B-6 CRIT-1 fix holds), handoff-guard 400/2xx/idempotent. The karen MANDATORY condition is satisfied: the rendered /matches-shortlist HTML (HTTP 200, self-grepped) carries ZERO AI-capability framing — the only 'AI-powered' string is the site-wide product meta tagline present on every page, not a claim about the rule-based scorer — while rule-based/fit-score/score-breakdown framing IS present. No LLM/Anthropic call (0.13s synchronous create-run). RBAC correct (analyst-403 write / analyst-200 read / anon-401), and match mutations are audited (HMAC chain ok:true, entriesChecked incremented on a disposition change). Regression green; the /sourcing + /compliance/settings 307 redirects for an advisor were traced to correct SoD role-scoping (advisor lacks sourcing/compliance read), not a deploy defect. Canary skipped (0 DAU). No Iron-Law trigger fired. The one anomaly (delegate's 'migration 0006' typo) was corrected by independent head-ci-cd re-verification of 0009."
  next_action: PROCEED_TO_T
```
