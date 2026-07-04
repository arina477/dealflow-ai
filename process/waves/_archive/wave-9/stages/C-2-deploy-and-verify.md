# C-2 — Deploy & verify (wave-9 buyer-universe builder — M4 final bundle)

**Deploy commit:** `937ae18` (main HEAD; merge commit "chore: wave-9 B-6 gate PASSED").
**Deploy target:** Railway project `ce095f75-1f3d-4af9-939e-fe8532541475`, env `production` (`0e84f0b6-…`).
**Head:** head-ci-cd. **Mode:** automatic (STATUS RUNNING).

---

## Gate summary

`head_signoff: APPROVED → PROCEED_TO_T`. No fabricated green: every verdict below is traced to a live deployed-artifact response (HTTP + DOM/JSON shape + DB-constraint behavior), not to green tests, a stale cache, or extrapolation. The rank/score "leak" flagged by a loose grep was disproven by a byte-level scan; the `/compliance/settings` 404 was traced to a wrong path guess, not a regression.

---

## C-1 (recorded here — no separate C-1 deliverable existed)

- Merge commit on main: **937ae18** (`git rev-parse HEAD` == main HEAD == 937ae18).
- CI on the exact merge SHA 937ae18 (`gh api …/commits/937ae18…/check-runs`): **all 5 completed/success** — `lint`, `typecheck`, `test`, `build`, **`audit`** (pnpm-audit security gate exit 0, no unauthorized bypass).
- Tested-SHA == PR-HEAD provenance: HOLDS (CI ran on 937ae18, which is the deployed commit).
- `ci_stage_verdict (C-1): PASS`.

## Action 0 — Railway credential

- Token present (APP_RAILWAY_TOKEN, 36 chars), deploy-scoped GraphQL probe usable.
- **Cross-environment-pollution guard applied:** env's `RAILWAY_PROJECT_ID` is the studio-worker placeholder `ce095f75-0000-…`; used the APP project id `ce095f75-1f3d-4af9-939e-fe8532541475` (from `APP_RAILWAY_PROJECT_ID` + `projectToken` self-discovery) for all mutations. No worker-env contamination.

## Rollback path armed (before mutation)

Known-good (wave-8 close, e57be83) captured pre-deploy:
- api: deployment `86381d8e-0fec-45fb-b971-759708f3f99b` (SUCCESS @ e57be83)
- web: deployment `a1a184c0-8a50-4e1e-870b-75a483935c83` (SUCCESS @ e57be83)

## Action 2 — Deploy (immutable, explicit)

- GIT_SHA upserted e57be83 → **937ae18** on both services (`variableUpsert`, non-destructive — other vars untouched; AUDIT_LOG_HMAC_KEY / DATABASE_URL / NEXT_PUBLIC_API_URL confirmed present).
- Explicit `serviceInstanceDeployV2` (fresh immutable build, NOT in-place mutation; not reliant on Railway "Wait for CI" webhook):
  - api deploymentId `7cc3da4f-7a6a-4add-b44b-1bfdd273eaab`
  - web deploymentId `22a933d3-e16e-4b93-8d80-5bbf0087ad4e`
- Inline-poll (bounded, 10-min cap) → **both SUCCESS** (web ~91s, api ~121s). Neither SKIPPED/CRASHED/REMOVED.

## Action 3 — Health (exact deployed hash, own domain)

- api `GET /health` (own domain, not global-routed): `{"status":"ok","db":"ok","version":"937ae18"}` — exact deployed hash (was e57be83 pre-deploy → not stale). api boots clean, `db:ok`.
- web root: 307 (RBAC redirect to login, expected), text/html.

## Migration 0008 applied

- **Static (repo):** `0008_noisy_hitman.sql` is strictly additive — 2 CREATE TYPE (enums), 2 CREATE TABLE (`buyer_universe`, `buyer_universe_candidates`), FKs (→mandates, →users, →companies), 4 indexes. Destructive-DDL grep (DROP TABLE/COLUMN, ALTER … TYPE, TRUNCATE, DELETE FROM) → **clean**. Journal has 9 entries; idx 8 = `0008_noisy_hitman` registered.
- **UNIQUE constraint present:** `buyer_universe_mandate_id_unique UNIQUE(mandate_id)` (idempotency backbone) + `buyer_universe_candidates_universe_company_unique`.
- **Live confirmation (functional, stronger than row-count):** `/health db:ok` = drizzle-kit migrate one-shot ran all 9 journal migrations on boot before serve. Assemble wrote rows to BOTH new tables (4 candidate rows returned) → tables exist & queryable live. **Re-assemble returned the SAME universe id** → the `mandate_id UNIQUE` constraint is enforced in the live DB (upsert `onConflictDoUpdate` on the unique target; without the constraint it would have created a 2nd universe or 500'd). Direct `__drizzle_migrations` row-count via internal PG host was not obtainable (app-DB password auth not exposed to the C-2 worker context per Iron Law); the write+constraint behavior is the ground-truth proxy and passed.

## LIVE buyer-universe payoff (analyst primary actor; API-direct + web-origin SSR)

Prep: minted analyst/advisor/compliance (invite+signup); seeded companies (fixture connection + sync → `ingested:5`); created mandate `6e5cf8aa-…` (advisor; US + 3 acks + buyerCriteria `{industry:"software", geo:"US-West"}`).

- **assemble:** POST /buyer-universe {mandateId} (analyst) → **201**, universe `f7155385-…`, 4 candidates sourced from M3 companies (`provenance: "assembled from sourcing"`).
- **idempotency:** re-POST same mandate → **201, SAME universe id `f7155385-…`** (NOT a 2nd universe, NOT a 500). mandate_id UNIQUE + upsert confirmed live.
- **filter:** POST /:id/filter → 2xx, response is full **BuyerUniverseDetail** (`{universe, candidates}` — no table-wipe wrong-shape). universeStatus → `filtered`.
- **partial-dims honesty:** mandate has `geo` (unsupported by M3 companies). Provenance records: *"geo criteria not applied (M3 companies lack these columns — pending enrichment)"* — NOT a silent match-all. (All 4 excluded on industry mismatch because fixture companies lack sector — honest exclusion, not a false match.)
- **enrich:** POST /:id/enrich → 2xx, BuyerUniverseDetail; the included candidate received **3 M3 contacts**.
- **submit guard (included-count):** filtered + 0-included → **400** ("no included candidates — include at least one buyer before submitting"). Not submitted-empty.
- **submit guard (draft/untriaged):** fresh draft universe with untriaged `candidate` rows → **400** ("universe is in draft status (run filter first)"). Guard chain enforced.
- **submit valid:** after triaging 1 candidate → included (PATCH 200) + 0 untriaged → **2xx, universeStatus `submitted`** (ready-to-rank), BuyerUniverseDetail returned. NOTE: NestJS returns **201** for these POSTs (default Created status), not literal 200 — a 2xx success convention across all buyer-universe POSTs, not a defect.
- **SSR hydration (CRIT-1 fix):** web-origin GET /buyer-universe?mandateId=<HAS-UNIVERSE> → 200 text/html, renders the CANDIDATE TABLE (`<table>/<thead>/<tbody>`, real universe id `f7155385` embedded, 4 provenance/membership rows, Included/Excluded/Submitted labels) — **zero "Assemble" empty-state markers**. Negative control (no-universe mandate) → no `<table>`, shows "Assemble Buyer Universe" CTA. Two states genuinely differ → hydration is real.
- **M4/M5 boundary:** byte-level scan of full Detail payload → **0 occurrences** of `"fitScore"/"score"/"rank"/"ranking"/"rationale"`. Candidate fields: `id, buyerUniverseId, companyId, membershipStatus, provenance, createdAt, contacts`. No ranking/scoring leak. (Order is name-ASC presentation-only, documented non-ranking.)
- **RBAC:** anon assemble → **401**; compliance-role (not in analyst/advisor/admin) assemble → **403**; analyst filter → 2xx (positive control). SoD holds.
- **Audited:** GET /compliance/audit-log/verify (compliance role) → `{ok:true, entriesChecked:153, firstBreakAt:null}`. HMAC hash chain intact after all mutations; entriesChecked rose from wave-8 baseline (57) → 153, reflecting audited assemble/filter/enrich/submit/patch/mandate/sync writes.
- **D6 link:** mandate-detail page Buyer-Engine section contains `href=/buyer-universe?mandateId=6e5cf8aa-…` ("Open Buyer Universe") — live link, not a dead placeholder.

## Regression (wave-8 surfaces)

- API: /mandates list 200 (analyst), /sourcing/connections 200, /compliance/{summary,rules,disclaimers,suppression,audit-log/verify} all 200, /auth/me 200 (role resolves).
- Web SSR: /mandates 200 html, /sourcing 200 html, /compliance/settings 200 html.
- (`/compliance/settings` API 404 in first pass = wrong-path guess; no such API route — real routes above are 200. Not a regression.)

## Canary

Skipped — 0 DAU < 1000 threshold. T-block synthetic probes are the post-deploy signal.

## Cleanup

Local session/cookie jars + HTML dumps (`/tmp/bu_verify/`, held live session tokens) scrubbed. No hard-delete endpoints for buyer-universe/mandates/sourcing → test rows are isolated fixtures, retained harmlessly. Test users retained per instruction. No secret leak (tokens masked in all logs; GIT_SHA the only var mutated).

---

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway github
verdict_evidence:
  - "github: CI on 937ae18 all 5 checks success (lint/typecheck/test/build/audit)"
  - "railway api: serviceInstanceDeployV2 7cc3da4f-… SUCCESS @ 937ae18 (not SKIPPED)"
  - "railway web: serviceInstanceDeployV2 22a933d3-… SUCCESS @ 937ae18 (not SKIPPED)"
  - "api /health: 200 {status:ok, db:ok, version:937ae18} (exact deployed hash, own domain)"
  - "migration 0008 additive (journal idx8, 9 entries); mandate_id UNIQUE live-enforced (idempotent re-assemble)"
  - "assemble 201 + idempotent(same universe) + 4 candidates-from-M3"
  - "filter→Detail + partial-dims honest (geo unsupported recorded, not match-all)"
  - "enrich→Detail (3 M3 contacts on included candidate)"
  - "submit guards: 0-included→400, draft/untriaged→400, valid→2xx status=submitted"
  - "SSR hydrates existing universe (candidate <table>, no empty-state); negative control shows Assemble CTA"
  - "M4/M5 boundary: byte-scan 0 rank/score/fit/rationale fields"
  - "RBAC: anon 401, compliance-role 403, analyst 2xx"
  - "audit verify {ok:true, entriesChecked:153}"
  - "D6 link /buyer-universe?mandateId=… live on mandate-detail"
  - "regression: mandates/sourcing/compliance API + web SSR pages all green"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 937ae18, deploymentId: 7cc3da4f-7a6a-4add-b44b-1bfdd273eaab, health_url: "https://dealflow-api-production-66d4.up.railway.app/health", rollback_to: 86381d8e-0fec-45fb-b971-759708f3f99b}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 937ae18, deploymentId: 22a933d3-e16e-4b93-8d80-5bbf0087ad4e, health_url: "https://dealflow-web-production-a4f7.up.railway.app/", rollback_to: a1a184c0-8a50-4e1e-870b-75a483935c83}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window: {}
canary_monitor_id: ""
canary_alerts: []
note: "Both services immutable-deployed @ 937ae18 (fresh serviceInstanceDeployV2, neither SKIPPED; rollback armed to e57be83 known-good). Migration 0008 additive+applied (mandate_id UNIQUE enforced live, proven by idempotent re-assemble). Full buyer-universe payoff verified live incl. SSR hydration (CRIT-1) and M4/M5 no-rank boundary. Submit returns 201 (NestJS Created) not literal 200 — 2xx success, not a defect. Direct __drizzle_migrations row-count not obtainable from C-2 worker (app-DB creds not exposed per Iron Law); functional write+UNIQUE-constraint behavior is the verified ground truth."

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: "Both services immutably deployed to 937ae18 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED), rollback armed to e57be83 known-good before mutation, correct APP project id used (no worker-env cross-pollution). Migration 0008 statically additive and live-applied — mandate_id UNIQUE enforced in the live DB, proven by idempotent re-assemble (same universe, no 2nd row, no 500). /health returns the exact deployed hash on the own domain (not stale, not global-routed). The full buyer-universe payoff passed against the live artifact with DOM/JSON-shape checks: assemble 201 + idempotent + M3-sourced candidates; filter→Detail with honest partial-dims provenance; enrich→Detail with M3 contacts; submit included-count AND draft/untriaged guards both 400, valid submit→submitted; SSR hydrates the existing universe into a candidate table (CRIT-1 fix, contrasted against a genuine empty-state negative control); byte-scan confirms zero rank/score/fit fields (M4/M5 boundary); RBAC anon-401/compliance-403/analyst-2xx; every mutation audited (hash chain ok, entriesChecked 153). Regression green across mandates/sourcing/compliance API and web SSR. Canary skipped (0 DAU). No Iron-Law trigger fired: no api crash, no migration failure, no assemble 500, idempotency intact, guards intact, no shape-wipe, no CRIT-1 regression, no boundary leak, RBAC intact. The two apparent red flags (loose-grep rank 'leak', /compliance/settings 404) were both traced to test-harness artifacts, not deployed defects."
  next_action: PROCEED_TO_T
```
