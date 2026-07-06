# C-2 — Deploy & verify (wave-13 M6 audit-log/recordkeeping-EXPORT)

Owner: head-ci-cd. Mode: automatic (credential present; no founder pause). Platform: Railway (GraphQL-only, `Project-Access-Token` header — no CLI). Deployed commit: **`2ec4953`** (wave-13 code = `5293045` + a docs-only C-1 chore).

## Provenance gate (no Ghost Green) — resolved BEFORE mutating prod
- git HEAD = `2ec495377273b5944a3455ebdfab8c32bef437c1` = the exact deploy target.
- `2ec4953` = `5293045` + a **docs-only chore** (`git diff --name-only 5293045 2ec4953` = 2 files, BOTH under `process/`: `wave-13/checklist.md` + `wave-13/stages/C-1-pr-ci-merge.md`; zero application/source/schema/CI-workflow bytes). The `[skip ci]` marker is correct — the docs chore intentionally did not re-run CI.
- **CI verified GREEN on the EXACT code SHA `5293045`** — C-1 run `28777726235` (event=push, main, headSha=5293045): lint / typecheck / **test** / build / **audit** ALL success (5/5). The `pnpm audit --audit-level=high` supply-chain gate passed on this exact commit. head-ci-cd re-confirmed the C-1 deliverable's provenance rather than extrapolating. No fabricated green: the deployed artifact IS `5293045`'s code (`2ec4953` adds only `process/` docs), and `/health` returns the deployed hash `2ec4953` after the GIT_SHA refresh.

## Infra discovered (deploy-scoped probe — never `me{}`)
- Project `app-arina-5ywq3s` = `ce095f75-1f3d-4af9-939e-fe8532541475`; single env `production` = `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (pre-existing — NOT created).
- **dealflow-api** svc `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` → https://dealflow-api-production-66d4.up.railway.app ; `/health`.
- **dealflow-web** svc `06b07f19-9146-4da0-b589-0d6d81ec1576` → https://dealflow-web-production-a4f7.up.railway.app.
- Credential `APP_RAILWAY_TOKEN` (36-char project token) — deploy-scoped probe returned `data.project` with no `errors`. Usable. Correct APP project + `production` env id on every mutation (no cross-env pollution).

## NO migration this wave (B-0 skipped)
- Recordkeeping READS the existing (shipped/live) M2 immutable audit log via `AuditVerifier.verifyChain`; the export appends an `export_generated` audit row using an **additive shared-enum value** on the existing text `action` column. **ZERO schema change, ZERO Drizzle migration to apply.** No Destructive-Drizzle-Lock risk; no one-shot migration sequencing needed. Live-confirmed: the 309→310-entry hash chain already exists and verifies over real accumulated production data (all shipped producers: template-create, outreach-compose, send, gate-evaluate, pipeline events, and now export_generated).

## Rollback anchors (captured BEFORE mutating — armed)
- api previous known-good SUCCESS: **`1323cfcb-f58d-449f-8224-ae9fea46bd0e`** (commit `989fae9`, wave-12).
- web previous known-good SUCCESS: **`a2d7c137-7204-4dd2-a12b-84272ce62e72`** (commit `989fae9`, wave-12).
- Rollback path: `serviceInstanceDeployV2(commitSha=989fae9)` (redeploy prior commit) / redeploy the above deployment ids. Not needed (deploy healthy). Because there is NO migration this wave, a code rollback to 989fae9 is fully safe (no forward-incompatible schema — Stateful-Downgrade-Corruption not possible).

## Deploy (explicit immutable trigger — defeats Railway "Wait for CI" Phantom Skip)
- api: `serviceInstanceDeployV2(sid, environmentId=production, commitSha=2ec4953)` → dep `036ef04a-cb02-4e69-bf58-12d0f23b08f6` → SUCCESS in ~90s (BUILDING→SUCCESS; never SKIPPED). Commit meta = `2ec4953…` (exact).
- web: `serviceInstanceDeployV2(…)` → dep `a93b6ca5-2b2a-405a-a27a-e3cd2ceddc76` → SUCCESS in ~110s (never SKIPPED). Commit meta = `2ec4953…` (exact).
- **GIT_SHA follow-up (wave-11/12 lesson):** post-deploy `/health` reported `version: 989fae9` (stale) — `/health` reads `process.env.GIT_SHA`, which lagged. The deployed CODE was always `2ec4953` (proven by immutable deployment `meta.commitHash`). Upserted `GIT_SHA=2ec4953…` (non-destructive single-var `variableUpsert`, BOTH svcs — other vars untouched) and redeployed api (`2199bf94-d110-4808-b8f4-0643f5d1e7b4` → terminal SUCCESS @ `2ec4953`) → `/health` now returns `2ec4953…`. The web GIT_SHA upsert triggered a redundant same-commit web redeploy `dfaeeeb6-24d5-4938-897a-8cd5634bb73a` (SUCCESS @ `2ec4953`, superseded the explicit `a93b6ca5`) — harmless (identical commit); confirms web NOT SKIPPED.

## Verify LIVE (self-performed by head-ci-cd)
- **Health probe on OWN domain (not global-routed) — no Health-Check Mirage:** `curl -fsS https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"2ec495377273b5944a3455ebdfab8c32bef437c1"}` — version == deployed hash (fresh, not stale; `db:ok` confirms live Postgres connectivity). Web root → **307 → /login → 200** (standard auth-guard redirect; Next.js has no /health).
- **Auth sessions minted (invite→signup, app is invite-only):** through the WEB origin (cookies are host-only on the web origin — `apiDomain==websiteDomain==WEB_ORIGIN`; the web app proxies `/auth/*`, `/compliance/audit-log/verify`, `/compliance/audit-log-data*` to the api per `next.config.ts` afterFiles). Compliance session (`role:compliance`, `/auth/me` 200) + advisor session (`role:advisor`, `/auth/me` 200). Anti-CSRF `VIA_CUSTOM_HEADER` → POST carried `rid: anti-csrf`.
- **Recordkeeping READ (compliance):** `GET /compliance/audit-log-data?limit=5` → **200**, real audit rows from ALL shipped producers (template-create / outreach / pipeline / etc.), each carrying `sequenceNumber, contentHash, payloadHash, prevHash, entryHash, chainVersion` — the live HMAC hash chain.
- **Integrity VERIFY LIVE over the real accumulated chain (compliance):** `GET /compliance/audit-log/verify` → **200** `{"ok":true,"entriesChecked":309}` — the REAL `AuditVerifier.verifyChain` shape (`{ok, entriesChecked}`), tamper-evidence proof computed LIVE over the 309-entry production chain (not a stub, not a fixture).
- **EXPORT LIVE (compliance) — appends exactly one `export_generated` row:** `POST /compliance/audit-log-data/export` (body `{}`) → **200** with `Content-Disposition: attachment; filename="audit-log-export.json"` (downloadable package). Package = `{entries, manifest, verifyResult}`: `entries[]` carry per-entry `entryHash/prevHash/contentHash/payloadHash`; `verifyResult` = `{ok:true, entriesChecked:309}`; `manifest` = `{scope, generatedAt, generatingActor, chainRoot, tailHash: 930bfecc…, entryCount:309}`. **Append proof:** `verify` BEFORE export = `entriesChecked:309`; `verify` AFTER export = `entriesChecked:310` (**delta = +1**), and `export_generated` appears as the newest action in the log — i.e. the export action itself is audited last-in-txn (rollback-on-audit-fail: no package without its row). The exported package snapshots the pre-export chain (309); the +1 row is the export event itself.
- **ADVISOR-no-export (server-side 403):** `POST /compliance/audit-log-data/export` as advisor → **403** `{"message":"Forbidden","statusCode":403}` (RolesGuard; EXPORT_ROLES = compliance+admin only). Advisor `GET /compliance/audit-log/verify` → **403** (VERIFY_ROLES compliance+admin only). Advisor `GET /compliance/audit-log-data` → **200** but 0 rows (READ_ROLES includes advisor, service-enforced own-outreach scoping — this advisor has no own-outreach entries). Anon `GET verify` → **401** (SessionGuard).
- **M2 read-validation (no 500 / no unbounded):** `GET /compliance/audit-log-data?limit=999999` → **400** `"Number must be less than or equal to 200"`; `GET ?mandateId=notauuid` → **400** `"Invalid uuid"`. `listFilterSchema.safeParse` rejects at the boundary (BadRequest), never 500 and never an unbounded query.
- **AC-STRIP / provenance on DEPLOYED authed HTML (karen-MANDATORY — head-ci-cd self-grepped the rendered pages, web-origin sessions):**
  - **Compliance** `GET {web}/compliance/audit-log` → **200, 179 KB** (the REAL authed page, not the ~10 KB /login shell): renders the filter table (action-type/date/actor filters, 27 filter markers), the integrity badge (`data-testid="integrity-badge"` = 1, "integrity verified"), AND the export panel — `<section data-testid="export-panel" aria-label="Export recordkeeping package">` "Export Recordkeeping Package" with scope inputs (`export-mandate-id`/`export-from`/`export-to`) + `<button data-testid="export-cta">Export recordkeeping package</button>` (export-panel=1, export-cta=1). The just-created `audit-log-export` row renders in the live table.
  - **Advisor** `GET {web}/compliance/audit-log` → **200, 31.6 KB**: filter table + integrity badge (`data-testid="integrity-badge"` = 1) present, **export panel ABSENT** — `data-testid="export-panel"` = 0, `data-testid="export-cta"` = 0, "download" = 0, ZERO rendered export-panel text. (The advisor page's only "export" substrings are the `<option value="export_generated">Export Generated</option>` action-type filter option and a `"ExportPanel"` Next.js flight/chunk reference inside a `<script>` — neither is a rendered interactive control.)
  - **Immutability + no false affordances (both pages):** ZERO edit/delete/remove affordance on audit rows; ZERO interactive send/email/AI-drafting affordance; ZERO `mailto:`. The `Send` / `Outreach Compose` / `export_generated` hits are all `<option>` values in the read-only action-TYPE filter dropdown (filtering the record by past action types), NOT send/compose controls. The only `AI` hits (5) are the global `DealFlow AI` brand (`<title>`, wordmark) + the site-wide `AI-powered` `<meta>` tagline (wave-10/11/12 precedent = allowed brand, not a feature claim). No CODE-OF-CONDUCT false-send/false-AI violation.

## Canary
0 DAU < 1000 threshold → skipped. T-block synthetic probes are the post-deploy signal.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "provenance: C-1 CI run 28777726235 headSha=5293045: lint/typecheck/test/build/audit 5/5 success (incl pnpm-audit --audit-level=high) — no Ghost Green; deploy target 2ec4953 = 5293045 + docs-only chore (2 files under process/, zero code/schema/CI bytes)"
  - "railway dealflow-api: latest deployment 2199bf94 SUCCESS, commit 2ec4953 (initial explicit 036ef04a SUCCESS; GIT_SHA-refresh redeploy 2199bf94); never SKIPPED"
  - "railway dealflow-web: latest deployment dfaeeeb6 SUCCESS, commit 2ec4953 (explicit a93b6ca5 SUCCESS, superseded by redundant same-commit dfaeeeb6 from GIT_SHA upsert); never SKIPPED"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok,db:ok,version:2ec4953} — version==deployed hash, own domain (stale GIT_SHA 989fae9 corrected to 2ec4953 + redeployed)"
  - "https://dealflow-web-production-a4f7.up.railway.app/: 307->/login->200 (auth-guard, expected)"
  - "NO migration this wave: recordkeeping reads existing live M2 audit log; export_generated is an additive shared-enum value on existing text action column — zero schema change"
  - "recordkeeping READ live (compliance): GET /compliance/audit-log-data 200 with real hash-chain rows from all shipped producers"
  - "integrity VERIFY live (compliance): GET /compliance/audit-log/verify 200 {ok:true, entriesChecked:309} — real AuditVerifier shape over the live 309-entry chain"
  - "EXPORT live (compliance): POST /compliance/audit-log/export 200, Content-Disposition attachment, package={entries+per-entry hashes, verifyResult{ok,entriesChecked:309}, manifest{tailHash,entryCount:309}}; appends exactly one export_generated row (verify entriesChecked 309->310, delta +1; export_generated newest action)"
  - "advisor-no-export: POST export as advisor 403 (server-side RolesGuard); advisor verify 403; advisor read 200 (0 own-outreach rows); anon verify 401"
  - "M2 read-validation: GET ?limit=999999 -> 400 'Number must be <= 200'; ?mandateId=notauuid -> 400 'Invalid uuid' (BadRequest at boundary, not 500/unbounded)"
  - "AC-STRIP (self-grepped DEPLOYED authed HTML, web-origin sessions): compliance page 179KB has filter table + integrity-badge + export-panel(data-testid export-panel=1/export-cta=1); advisor page 31.6KB has filter table + integrity-badge but export-panel ABSENT (testid=0, download=0); both pages 0 edit/delete on rows, 0 interactive send/email/AI affordance; send/compose hits are action-type filter <option>s; only AI = global DealFlow-AI brand/meta tagline"
deploy_targets:
  - {platform: railway, service: dealflow-api, deploymentId: "2199bf94-d110-4808-b8f4-0643f5d1e7b4", state: SUCCESS, commit: "2ec495377273b5944a3455ebdfab8c32bef437c1", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-06T08:32:00Z"}
  - {platform: railway, service: dealflow-web, deploymentId: "dfaeeeb6-24d5-4938-897a-8cd5634bb73a", state: SUCCESS, commit: "2ec495377273b5944a3455ebdfab8c32bef437c1", health_url: "https://dealflow-web-production-a4f7.up.railway.app/", verified_at: "2026-07-06T08:32:00Z"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window:
  start: ""
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
rollback_anchors:
  dealflow-api: "1323cfcb-f58d-449f-8224-ae9fea46bd0e (commit 989fae9, wave-12 known-good SUCCESS)"
  dealflow-web: "a2d7c137-7204-4dd2-a12b-84272ce62e72 (commit 989fae9, wave-12 known-good SUCCESS)"
note: >
  NO migration this wave (B-0 skipped): recordkeeping READS the existing live M2 immutable audit log via
  AuditVerifier.verifyChain; the export appends an export_generated audit row using an additive shared-enum value on
  the existing text action column — zero schema change, no Drizzle migration, no Destructive-Drizzle-Lock risk, and a
  code rollback to 989fae9 stays fully safe (no forward-incompatible schema). Both services immutable-deployed @ 2ec4953
  via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED; explicit trigger defeats the Wait-for-CI Phantom
  Skip). CI provenance verified on the EXACT code SHA 5293045 (C-1 run 28777726235, 5/5 jobs incl pnpm-audit
  --audit-level=high), NOT extrapolated — 2ec4953 is 5293045 + a docs-only chore (2 files under process/, zero code).
  Rollback armed to wave-12 989fae9 known-good SUCCESS ids BEFORE mutating; correct APP project + production env id (no
  cross-env pollution). /health returns the deployed hash 2ec4953 on the api own domain (stale GIT_SHA 989fae9 corrected
  + redeployed; version-lag was env-var only — deployed code was always 2ec4953 per immutable commitHash; no Health-Check
  Mirage). Recordkeeping proven LIVE by head-ci-cd via invite->signup compliance+advisor sessions (web-origin cookies,
  rid anti-csrf on POST): READ 200 over the real hash chain; VERIFY 200 {ok:true,entriesChecked:309} = the real
  AuditVerifier tamper-evidence shape over the live accumulated chain; EXPORT 200 downloadable package
  (entries+hashes+verifyResult+manifest{tailHash,entryCount:309}) that appends EXACTLY ONE export_generated row
  last-in-txn (verify 309->310, +1); advisor export 403 + advisor verify 403 + anon 401 (server-side RBAC/SoD); M2
  read-validation limit>200 -> 400 and mandateId=notauuid -> 400 (BadRequest at boundary, never 500/unbounded). AC-STRIP
  holds on the DEPLOYED authed HTML (self-grepped, web-origin sessions): compliance page renders the filter table +
  integrity badge + export panel (data-testid export-panel/export-cta); the advisor page renders the filter table +
  integrity badge but the export panel is ABSENT (testid=0, download=0); both pages have zero edit/delete affordance on
  the immutable audit rows and zero interactive send/email/AI-drafting affordance (the send/compose/export_generated hits
  are read-only action-TYPE filter <option> values; the only AI is the global DealFlow-AI brand meta tagline). Canary
  skipped (0 DAU < 1000). No Iron-Law trigger fired.
```

## head-ci-cd C-2 stage-exit verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: { live_verification: "head-ci-cd (self) — invite->signup compliance+advisor sessions minted through the web origin (host-only cookies); recordkeeping read/verify/export exercised live; AC-STRIP self-grepped on the deployed authed audit-log HTML for both roles" }
  failed_checks: []
  rationale: >
    Both services immutably deployed to 2ec4953 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED;
    the explicit trigger defeats the Railway Wait-for-CI Phantom Skip — a redundant same-commit web redeploy from the
    GIT_SHA upsert landed harmlessly). No Ghost Green: C-1 provenance was re-confirmed on the EXACT code SHA 5293045 (CI
    run 28777726235, 5/5 jobs incl the pnpm-audit --audit-level=high supply-chain gate), and the deploy target 2ec4953 is
    5293045 + a docs-only chore (2 files under process/, zero application/schema/CI bytes; the [skip ci] is correct). This
    wave has NO migration (B-0 skipped): recordkeeping reads the existing live M2 immutable audit log and the export
    appends an export_generated row via an additive shared-enum value on the existing text action column — no schema
    change, no Destructive-Drizzle-Lock, and a code rollback to the armed wave-12 989fae9 known-good SUCCESS ids stays
    fully safe (no forward-incompatible schema, no Stateful-Downgrade-Corruption). Rollback was armed to those ids BEFORE
    any mutation; correct APP project + production env id on every mutation (no cross-env pollution). /health returns the
    deployed hash 2ec4953 on the api OWN domain (not global-routed, not stale — the version-lag was a stale GIT_SHA env
    var, corrected + redeployed + live-confirmed; no Health-Check Mirage). The wave's recordkeeping payoff is PROVEN LIVE
    by head-ci-cd, not inferred from green tests: through invite->signup compliance and advisor sessions the filtered READ
    returns 200 over the real production hash chain; VERIFY returns the real AuditVerifier shape {ok:true,
    entriesChecked:309} computed live over the accumulated chain (the tamper-evidence proof, not a stub); EXPORT returns a
    200 downloadable package (entries + per-entry hashes + verifyResult + manifest with tailHash/entryCount) and appends
    EXACTLY ONE export_generated audit row last-in-txn (verify entriesChecked 309->310, delta +1). RBAC/SoD holds live:
    advisor export 403 and advisor verify 403 (server-side RolesGuard, not just UI-hidden), anon 401; and the M2
    read-validation rejects limit>200 and a non-UUID mandateId with 400 at the boundary (never 500, never unbounded).
    AC-STRIP holds on the DEPLOYED authed HTML, self-grepped for both roles via correct web-origin sessions: the
    compliance page renders the filter table + integrity badge + the interactive export panel (data-testid
    export-panel/export-cta), while the advisor page renders the filter table + integrity badge but the export panel is
    ABSENT (testid=0, download=0, zero rendered panel text); both pages carry zero edit/delete affordance on the immutable
    audit rows and zero interactive send/email/AI-drafting affordance (the send/compose/export_generated substrings are
    read-only action-TYPE filter options, and the only AI is the allowed global DealFlow-AI brand meta tagline — no
    CODE-OF-CONDUCT false-send/false-AI violation). Canary skipped (0 DAU < 1000). No Iron-Law trigger fired.
  next_action: PROCEED_TO_T
```
