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

---

# V-3 F-1 re-verify (57449b6)

**Head:** head-ci-cd · **Focused redeploy + live re-verify of the V-1 Medium F-1 fix** · **Verified:** 2026-07-04T19:45Z · **Mode:** founder-review

**Trigger:** V-1 Medium F-1 — the `/matches-shortlist` "Score Breakdown" drawer rendered blank/NaN (write/read shape drift between the scorer's real `ScoreBreakdown` and the UI). Fix merged to main @ `57449b6` (CI green): scorer's real flat shape `{sectorMatch, contactCompleteness, tieBreak, total, notApplied}` now typed end-to-end (shared `scoreBreakdownSchema` + drizzle jsonb `.$type<ScoreBreakdown>` + UI drawer renders real per-dimension bars + not-applied rows). This section redeploys `57449b6` and re-verifies the drawer renders live + the matching flow + AI-strip still hold.

## VERDICT: PASS

## Deploy (immutable fresh builds @ 57449b6 — no in-place mutation)

- **Rollback armed BEFORE mutation** (Rollback-Blind-Deploy prevention): known-good SUCCESS ids @ 0075a20 cached — api `81908843-3b24-49b6-ab0a-1e9a3225c77e`, web `f8f4c7de-ba7e-4f22-9b80-acc93a7d61d5`. Rollback path: re-`serviceInstanceDeployV2` to prior SUCCESS commit / `deploymentRollback` to the cached id.
- **Pre-deploy state confirmed OLD** (Health-Check-Mirage guard): api `/health version:"0075a20"` before deploy — proves the deploy is a real change, not a stale re-probe.
- GIT_SHA `0075a20`→`57449b6` on api + web via `variableUpsert` (only vars mutated; token `Project-Access-Token` header, never logged/committed).
- `serviceInstanceDeployV2` at commit `57449b681b88054ec15b1c4b7bef65bbe27f0fc9` (correct APP project `ce095f75…` + production env `0e84f0b6…` — no cross-env pollution):
  - **api deploymentId:** `5e8a362a-c048-4da4-9a37-762c9249dcf0` → **SUCCESS** (~2.5 min build)
  - **web deploymentId:** `08a3a526-ebd5-4efe-8c48-a72b550bb563` → **SUCCESS** (~2.5 min build)
- **Neither SKIPPED** (Phantom-Skip guard). Latest-deployment query confirms these exact IDs are the active deployments (no stale masking).
- **No new migration:** migration 0009 already applied at the prior C-2; `db:ok` on /health proves the DB connection + prior schema intact. No additive/destructive DDL this redeploy.

## Health (deployed-hash probe, own domain — not global-routed)

- api `/health` → `{"status":"ok","db":"ok","version":"57449b6"}` — **version == deployed hash 57449b6** on the api's own domain. `db:ok` confirms DB reachable + schema intact.
- web renders the authed app on its own domain (SSR /matches-shortlist HTTP 200; Next.js has no `/health` route — `/` returns the 404 SSR shell, expected).

## F-1 FIX PROOF — score_breakdown drawer renders REAL per-dimension values (NOT NaN/blank)

Verified by a real headless-chromium session (chromium-1208) driving the FULL live chain against `57449b6`, then reading the ACTUAL rendered drawer DOM. head-ci-cd independently inspected the rendered screenshot (`drawer.png`) with its own eyes AND independently re-ran the disposition-preserve check. Delegate: deployment-engineer (live 12-step chain exercise).

- **Full chain (all via the WEB-origin same-origin proxy `-data` paths, `rid:anti-csrf` header):** mint analyst → `/sourcing/connections {providerKey:fixture}` (201) + sync (201, `ingested:5`) → mint advisor → mandate (US + 3 acks) → `/buyer-universe-data` assemble → `/buyer-universe-data/:id/filter` (draft→filtered) → `/buyer-universe-data/:id/submit` (filtered→submitted) → `/matches-data` create-run → **201, 4 scored candidates, fit_scores `[69,62,61,61]` (3 distinct — scorer discriminates)**.
- **Ranked list renders** (advisor): `/matches-shortlist?mandateId=` → HTTP 200, heading "Matches & Shortlist", run status badge "SCORED", `<table aria-label="Ranked match candidates">` with 4 rows, each a real "Rule-based fit score: N" gauge (69/62/61/61).
- **Drawer renders REAL per-dimension breakdown (THE F-1 PROOF):** clicking "View score breakdown for candidate …" opens the `role="dialog"` "Score breakdown" panel. Rendered DOM (independently confirmed via `drawer.png`):
  - **Sector / industry match: `30 / 60`** (amber bar ~50%)
  - **Contact completeness: `30 / 30`** (green bar, full)
  - **Tie-break (deterministic): `9 / 10`** (green bar ~90%)
  - Score gauge **69** (== total).
  - **ZERO "NaN", zero "undefined", zero blank/broken rows.** Every dimension renders a real numeric `score / maxWeight` with a scaled bar. This is the F-1 fix — the prior blank/NaN drawer is gone.
  - **not-applied row:** for this candidate `notApplied:[]` (all dimensions evaluatable on the fixture company), so the "Not applied (data unavailable)" section is correctly ABSENT (not a NaN row). The render logic (`{breakdown.notApplied.length > 0 && …}` → maps each string to a `<li>`) is verified in source; when non-empty it renders "not applied (data unavailable)" list items, never a NaN row.
- **Raw API scoreBreakdown JSON (write/read shape end-to-end):** `{"total":69,"tieBreak":9,"notApplied":[],"sectorMatch":30,"contactCompleteness":30}` — the flat shape the shared `scoreBreakdownSchema` types, matching the drizzle `.$type<ScoreBreakdown>` column and the UI's flat-number reads. No rationale-text / LLM fields. Shape drift resolved.

## AI-strip STILL holds (karen MANDATORY / CODE-OF-CONDUCT)

- Rendered `/matches-shortlist` page (body textContent + innerHTML, lowercased) scanned for the forbidden set — **ZERO hits:** `ai match`, `rationale is generated`, `ai rationale`, `explainability engine`, `improve model`, `similar mandates`, `data freshness`, `generated rationale`, `ai-generated` — none present. The drawer itself carries none.
- **Only "ai-powered" occurrence = 1** — the site-wide `<meta name="description">` product tagline present on EVERY page (incl. /login); describes the product, not the rule-based scorer. NOT a false AI-capability claim.
- Positive rule-based framing present: "Rule-based fit score" badge, "Score breakdown" heading, "Score contributions (rule-based)" section; `rule-based` ×3, `score breakdown` ×6 on the page. **PASS — no CODE-OF-CONDUCT violation.**

## Matching-flow regression (green)

- **create-run:** `POST /matches-data` → 201, latency 0.10–0.16s (synchronous, no LLM/no external-API signature; deterministic).
- **scorer discriminates:** 4 candidates → 3 distinct scores `[69,62,61,61]` — real spread (driven by sector-match + tie-break), NOT uniform.
- **submit-guard:** create-run on a draft (not-submitted) universe → **400** ("Cannot score … submit first").
- **idempotent same-run:** re-`POST /matches-data` (same mandate) → **SAME run id**.
- **disposition accept sticks (B-6 CRIT-1 — independently re-verified by head-ci-cd):** PATCH candidate→`accepted` (200), then re-run scorer; matching by `buyerUniverseCandidateId` (the match_candidates.id changes on delete+re-insert re-score — expected) → disposition **`accepted` preserved**; accepted-count after re-run = 1. Dispositions NOT wiped. (The delegate's initial "MIXED" was a false alarm from matching on the stale match_candidates.id; head-ci-cd's re-check on the correct key confirms clean PASS.)
- **handoff-guard:** 0-accepted → **400**; ≥1-accepted → **2xx** `readyForOutreach:true`; re-handoff → idempotent 2xx (no dup, no error).
- **RBAC (self + delegate):** analyst on `/matches-shortlist` → read-only (no Create/Accept buttons); analyst `POST /matches-data` → **403**. Advisor session valid throughout.

## Canary

```yaml
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000 per project.yaml canary_threshold_dau); T-block synthetic probes + this live re-verify are the post-deploy signal. Focused single-fix redeploy, blast radius = the F-1 drawer render + shared score-breakdown type."
```

## Cleanup

Temp cookie jars + proof scripts (`f1-proof.mjs`, `diag*.mjs`, `dispcheck*.mjs`) under `/home/claudomat/project/apps/web` + `/tmp/v3_f1_proof/` scrubbed. Incidental T-5 screenshot-baseline diffs reverted. Test users retained (no hard-delete; isolated fixtures). Only infra mutations: GIT_SHA var (api+web) + two `serviceInstanceDeployV2` triggers. No secret leak (token masked; never committed).

## Iron Law — NONE fired

- Score Breakdown drawer STILL blank/NaN (F-1 not fixed)? **NO** — drawer renders real `30/60`, `30/30`, `9/10` with zero NaN (screenshot-confirmed).
- AI-framing reappears? **NO** — zero forbidden hits; only the global product meta tagline.
- Matching flow broken? **NO** — create-run 201 + 4-distinct-ish spread, submit-guard 400, idempotent, disposition-sticks, handoff 400/2xx/idempotent.
- api crashes? **NO** — SUCCESS + /health `db:ok` version 57449b6.
- RAILWAY_TOKEN-empty was NOT a block (36-char project-scoped token present + validated).

```yaml
v3_reverify_verdict: PASS
deployed_commit: "57449b6"
deployed_commit_full: "57449b681b88054ec15b1c4b7bef65bbe27f0fc9"
health:
  api: "200 {status:ok, db:ok, version:57449b6} on own domain (deployed hash, not global-routed)"
deploy_targets:
  - {platform: railway, service: dealflow-api, deploymentId: "5e8a362a-c048-4da4-9a37-762c9249dcf0", state: SUCCESS, commit: "57449b6", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-04T19:45Z"}
  - {platform: railway, service: dealflow-web, deploymentId: "08a3a526-ebd5-4efe-8c48-a72b550bb563", state: SUCCESS, commit: "57449b6", url: "https://dealflow-web-production-a4f7.up.railway.app", verified_at: "2026-07-04T19:45Z"}
rollback_armed:
  api_known_good: "81908843-3b24-49b6-ab0a-1e9a3225c77e (0075a20)"
  web_known_good: "f8f4c7de-ba7e-4f22-9b80-acc93a7d61d5 (0075a20)"
f1_proof:
  drawer_renders_real_values: true
  rendered_dimensions: {sector_industry_match: "30/60", contact_completeness: "30/30", tie_break: "9/10", score_gauge: 69}
  has_nan: false
  has_blank_or_broken_rows: false
  not_applied_behavior: "notApplied:[] -> section correctly absent (not a NaN row); non-empty renders 'not applied (data unavailable)' <li> items"
  api_scoreBreakdown_shape: '{"total":69,"tieBreak":9,"notApplied":[],"sectorMatch":30,"contactCompleteness":30}'
  screenshot: "drawer.png (independently inspected by head-ci-cd)"
ai_strip_holds: true
ai_strip_forbidden_hits: []
ai_strip_ai_powered_count: 1   # global product meta tagline only
regression:
  create_run: "201, 0.10-0.16s synchronous"
  scores: [69, 62, 61, 61]
  scorer_discriminates: true
  submit_guard_400: true
  idempotent_same_run: true
  disposition_accept_sticks: true   # independently re-verified on buyerUniverseCandidateId key
  handoff_guard: "0->400, >=1->2xx readyForOutreach:true, re-handoff idempotent 2xx"
  rbac: "analyst read-only page; analyst POST /matches-data 403"
canary_status: skipped
canary_skip_reason: "DAU 0 < 1000 threshold; focused single-fix redeploy, blast radius = F-1 drawer + shared score-breakdown type."
canary_window: {start: "", duration_minutes: 0}

head_signoff:
  verdict: APPROVED
  stage: C-2 (V-3 F-1 re-verify)
  reviewers:
    live_verification: "deployment-engineer (spawned) — 12-step live chain + drawer-DOM read; PASS. Its one 'MIXED' note (disposition-preserve) was a false alarm from matching the wrong key (stale match_candidates.id post-re-score); head-ci-cd independently re-verified disposition-preserve on buyerUniverseCandidateId (accepted preserved) + independently inspected the rendered drawer screenshot."
  failed_checks: []
  rationale: "Both services immutably re-deployed to 57449b6 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED), rollback armed to the 0075a20 known-good SUCCESS ids BEFORE mutation, correct APP project + production env id (no cross-env pollution). /health returns the deployed hash 57449b6 on the api's own domain (not stale, not global-routed) with db:ok (schema intact; migration 0009 already applied at prior C-2, no new migration). The V-1 Medium F-1 fix is PROVEN against the live 57449b6 artifact by a real headless-chromium exercise reading the ACTUAL rendered drawer DOM: the Score Breakdown drawer renders REAL per-dimension values (sector 30/60, contact-completeness 30/30, tie-break 9/10, gauge 69) with ZERO NaN / blank / broken rows — the write/read shape drift is resolved end-to-end (shared scoreBreakdownSchema + drizzle .$type + UI flat-number reads; raw API shape {total,tieBreak,notApplied,sectorMatch,contactCompleteness} confirmed). head-ci-cd independently inspected the rendered screenshot. The not-applied path is correct (empty -> section absent, non-empty -> 'not applied (data unavailable)' list items, never a NaN row). The karen MANDATORY AI-strip STILL holds: zero forbidden AI-capability phrases on the rendered page/drawer; the sole 'ai-powered' is the site-wide product meta tagline, not a scorer claim; rule-based framing present. Matching-flow regression is green: create-run 201 synchronous (no LLM), scorer discriminates ([69,62,61,61]), submit-guard 400, idempotent same-run, disposition-accept STICKS across re-run (B-6 CRIT-1, independently re-verified on the buyerUniverseCandidateId key), handoff-guard 400/2xx/idempotent. RBAC correct (analyst read-only page + 403 on write). Canary skipped (0 DAU; focused single-fix blast radius). No Iron-Law trigger fired. F-1 is fixed and live."
  next_action: PROCEED_TO_V3_CLOSE
```
