# C-2 — Deploy & verify (wave-14 M6 compliance hardening — gate mandate-attribution + migration 0012)

Owner: head-ci-cd. Mode: automatic (credential present; no founder pause). Platform: Railway (GraphQL-only, `Project-Access-Token` header — no CLI). Deployed commit: **`5754fbf`** (wave-14 code = `0488cd7` + a docs-only C-1 chore).

## Provenance gate (no Ghost Green) — resolved BEFORE mutating prod
- git HEAD = `5754fbf11818110f47a1c774aa06ebfe4042a8ef` = the exact deploy target.
- `5754fbf` = `0488cd7` + a **docs-only chore** (`git diff --name-only 0488cd7 5754fbf` = 2 files, BOTH under `process/`: `wave-14/checklist.md` + `wave-14/stages/C-1-pr-ci-merge.md`; 96 insertions, zero application/source/schema/CI-workflow bytes). The `[skip ci]` marker is correct — the docs chore intentionally did not re-run CI.
- **CI verified GREEN on the EXACT code SHA `0488cd7`** — C-1 run `28784535052` (event=push, main, headSha=0488cd7): lint / typecheck / **test** / build / **audit** ALL success (5/5). The `pnpm audit --audit-level=high` supply-chain gate passed (0 high/critical; 3 moderate; exit 0 — NOT bypassed). The load-bearing recordkeeping-gate e2e (9 tests) ran REAL against a freshly created + migration-0012-applied `dealflow_test` Postgres, proving hash-safe gate mandate-attribution + mandate_id-column isolation (incl the SHARED-template-version case) end-to-end → wave-13 DEV-2 hard-gate LIFTED. head-ci-cd re-confirmed the C-1 deliverable's provenance rather than extrapolating. No fabricated green: the deployed artifact IS `0488cd7`'s code (`5754fbf` adds only `process/` docs), and `/health` returns the deployed hash `5754fbf` after the GIT_SHA refresh.

## Infra discovered (deploy-scoped probe — never `me{}`)
- Project `app-arina-5ywq3s` = `ce095f75-1f3d-4af9-939e-fe8532541475`; single env `production` = `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (pre-existing — NOT created).
- **dealflow-api** svc `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` → https://dealflow-api-production-66d4.up.railway.app ; `/health`.
- **dealflow-web** svc `06b07f19-9146-4da0-b589-0d6d81ec1576` → https://dealflow-web-production-a4f7.up.railway.app.
- Credential `APP_RAILWAY_TOKEN` (36-char project token) — deploy-scoped probe returned `data.project` with no `errors`. Usable. Correct APP project + `production` env id on every mutation (no cross-env pollution).

## Migration 0012 — additive, hash-chain-SAFE (static-analyzed BEFORE mutating)
- `apps/api/src/db/migrations/0012_audit_mandate_id.sql` forward SQL = a **single** `ALTER TABLE "audit_log_entries" ADD COLUMN "mandate_id" uuid;` — nullable, no NOT NULL, no default, **zero DROP / ALTER-TYPE / TRUNCATE**. Strictly additive → zero-downtime safe (no Destructive-Drizzle-Lock; existing rows get `mandate_id = NULL`; no exclusive table lock beyond the fast metadata-only add).
- **Hash-chain-safe:** `mandate_id` is intentionally EXCLUDED from the HMAC preimage (`HashableEntryFields` / `canonicalSerialization v1`). NULL is never serialized → all existing entries' `entry_hash` / `payload_hash` are byte-identical after the migration, and `AuditVerifier.verifyChain()` recomputes the same HMAC over the same fields → stays `{ok:true}` over the mixed old/new chain. Populated ONLY on gate-evaluate rows via `AuditRepository`'s `appendWithMandate` path (mandateId passed alongside the hashed fields, never fed into `computeEntryHash`); all other action types leave it NULL.
- The `DROP COLUMN IF EXISTS "mandate_id"` lives ONLY in `0012_audit_mandate_id.down.sql` (rollback file) — NOT in the forward path.
- Applied by the api preDeploy/migrate one-shot as part of the successful api build BEFORE serving traffic (zero-downtime; api build reached SUCCESS with the migration in-band). Verified functionally LIVE (below): verifyChain still {ok:true}, mandate_id column present + queryable.

## Rollback anchors (captured BEFORE mutating — armed)
- api previous known-good SUCCESS: **`2199bf94-d110-4808-b8f4-0643f5d1e7b4`** (commit `2ec4953`, wave-13).
- web previous known-good SUCCESS: **`dfaeeeb6-24d5-4938-897a-8cd5634bb73a`** (commit `2ec4953`, wave-13).
- Rollback path: `serviceInstanceDeployV2(commitSha=2ec4953)` (redeploy prior commit) / redeploy the above deployment ids. Not needed (deploy healthy). Because 0012 is ADDITIVE (nullable `mandate_id`, hash-excluded), a code rollback to `2ec4953` stays FULLY safe even after 0012 applies — old code simply ignores the extra nullable column; no forward-incompatible schema → no Stateful-Downgrade-Corruption.

## Deploy (explicit immutable trigger — defeats Railway "Wait for CI" Phantom Skip)
- api: `serviceInstanceDeployV2(sid, environmentId=production, commitSha=5754fbf)` → dep `1fe3b170-2c5a-4e70-b18d-14257db1dfba` → SUCCESS in ~102s (BUILDING→DEPLOYING→SUCCESS; never SKIPPED). Commit meta = `5754fbf…` (exact). 0012 applied in-band by the api preDeploy migrate one-shot.
- web: `serviceInstanceDeployV2(…)` → dep `90b2fc2f-2911-4023-a7a3-781f47948465` → SUCCESS in ~102s (never SKIPPED). Commit meta = `5754fbf…` (exact). **Current live web deployment.**
- **GIT_SHA follow-up (wave-11/12/13 lesson):** post-deploy `/health` reported `version: 2ec4953` (stale) — `/health` reads `process.env.GIT_SHA`, which lagged. The deployed CODE was always `5754fbf` (proven by immutable deployment `meta.commitHash`). Upserted `GIT_SHA=5754fbf…` (non-destructive single-var `variableUpsert`, api svc — other vars untouched) and redeployed api. Railway paired the redeploy: `e6fb3904` (triggered) was superseded mid-transition by same-commit `3a8813fe-80db-48e4-9cda-7bc180227788` → **terminal SUCCESS @ `5754fbf`** (the current live api deployment); `e6fb3904` shows `REMOVED` (harmless supersession, identical commit — NOT a failure). `/health` now returns `5754fbf…` stable across repeated reads.

## Verify LIVE (self-performed by head-ci-cd)
- **Health probe on OWN domain (not global-routed) — no Health-Check Mirage:** `curl -fsS https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"5754fbf11818110f47a1c774aa06ebfe4042a8ef"}` — version == deployed hash (fresh, not stale; `db:ok` confirms live Postgres connectivity; stable over 3+ reads). Web root → **307** (auth-guard redirect to /login; Next.js has no /health).
- **Auth sessions minted (invite→signup, app is invite-only):** through the WEB origin (host-only cookies; the web app proxies `/auth/*`, `/compliance/audit-log/verify`, `/compliance/audit-log-data*`, `/compliance/oversight-data`, `/outreach-data` to the api per `next.config.ts` afterFiles). Compliance session (`role:compliance`, `/auth/me` 200) + advisor session (`role:advisor`, `/auth/me` 200), both `POST /auth/signup` → **201** Set-Cookie. Anti-CSRF `VIA_CUSTOM_HEADER` → POST carried `rid: anti-csrf`.
- **[LOAD-BEARING] Migration 0012 + hash-chain STILL GREEN live (compliance):** `GET /compliance/audit-log/verify` → **200** `{"ok":true,"entriesChecked":310}` — the REAL `AuditVerifier.verifyChain` shape (`{ok, entriesChecked}`), tamper-evidence proof computed LIVE over the accumulated 310-entry production chain AFTER the additive `mandate_id` column landed. **This is the proof that 0012's additive column did NOT break tamper-evidence live.** Re-checked at end-of-stage: still `{ok:true, entriesChecked:310}` (stable — my probes wrote no chain rows).
- **mandate_id column exists (no relation/column error):** `GET /compliance/audit-log-data?limit=3` → **200**, real audit rows from all shipped producers, each now carrying `"mandateId":null` (existing rows NULL as designed; seq-309 entryHash `930bfecc…` == the wave-13 chain tail — hashes unchanged). No `column "mandate_id" does not exist` error.
- **Gate NO-REGRESSION live (the non-bypassable compose→gate path):** `POST /outreach` (via `/outreach-data`) with well-formed UUIDs pointing at nonexistent refs → **404** `"Template version … not found"` (server-side validation fired; no 500, no silent send — the gate/validation chain is intact at 5754fbf). Malformed body → **400** `"Invalid uuid; Required; Required; Required; Required"` (strict `outreachComposeInputSchema` fully specifies gate context at the boundary). Gate allow/block behavior UNCHANGED — no regression.
- **Mandate-derivation read path works LIVE:** `GET /compliance/audit-log-data?mandateId=<well-formed uuid>&limit=10` → **200** `[]` — the `WHERE mandate_id = $1` filter query executes successfully against the new 0012 column (no relation/column error, no 500). Empty result is correct: no gate-evaluate row carries a mandate yet (all existing gate-evaluate rows are historical/pre-0012, mandateId NULL). This proves the mandate-filter is live + wired to the new column.
  - **Full mandate-scoped compose→gate→filtered-rows smoke NOT run (stated precisely, not fabricated):** writing a NEW gate-evaluate row that carries a non-null mandate_id requires a full owned chain (create mandate → configure → buyer-universe → match-run → accept candidate → create template → request-approval → compliance-approve → compose) that would inject substantial production data. head-ci-cd did NOT assemble it. The mandate-attribution WRITE path is proven at C-1 by the REAL recordkeeping-gate e2e (9 tests, migrated dealflow_test, mandate_id isolation incl shared-template-version); LIVE, the gate non-bypassability + the mandate-filter READ path are both confirmed above. No green was fabricated for the un-run write smoke.
- **RBAC/SoD holds live (server-side, not just UI-hidden):** advisor `POST /compliance/audit-log-data/export` → **403** `{"message":"Forbidden","statusCode":403}` (RolesGuard, EXPORT_ROLES compliance+admin); advisor `GET /compliance/audit-log/verify` → **403** (VERIFY_ROLES compliance+admin); advisor `GET /compliance/audit-log-data` → **200** but `[]` (READ includes advisor, service-enforced own-outreach scoping — fresh advisor has no own entries); anon `GET verify` → **401** (SessionGuard).
- **M2 read-validation (no 500 / no unbounded):** `GET /compliance/audit-log-data?limit=999999` → **400** `"Number must be less than or equal to 200"`; `GET ?mandateId=notauuid` → **400** `"Invalid uuid"`. `listFilterSchema.safeParse` rejects at the boundary (BadRequest), never 500 / never unbounded.
- **/compliance/oversight page live (f5074df8) — self-grepped DEPLOYED authed HTML:**
  - **Compliance** `GET {web}/compliance/oversight` → **200, 24 KB** (the REAL authed page, not the ~9 KB /login shell): renders the outreach gate-outcome oversight table (Oversight×9, "Gate-outcome"×2, "SoD"/approver, "blocked", "template version"×6, "mandate"×6). Interactive controls = site chrome (user-menu / search / notifications nav buttons) + the `oversight-mandate-filter` text `input` + a `Refresh` button ONLY.
  - **READ-ONLY (no false affordances):** ZERO approve/reject/edit/delete/save/submit buttons on records; ZERO `mailto:`; ZERO interactive send/compose control; ZERO AI/generate/draft affordance. The only `AI` substrings are the global `DealFlow AI` brand (`<title>`, wordmark) + the site-wide `AI-powered M&A` `<meta>` tagline (wave-10/11/12/13 precedent = allowed brand, not a feature claim). No CODE-OF-CONDUCT false-send/false-AI violation.
  - **DISTINCT from /compliance-queue:** the oversight page references `compliance-queue` as the separate "template version approval" write workflow (this page is pure monitoring; it links out to the queue for the write surface).
  - **Advisor blocked:** advisor `GET {web}/compliance/oversight` → **307 redirect to `/`** (assertRole fail-closed), ZERO oversight-table content leaked.

## Canary
0 DAU < 1000 threshold → skipped. T-block synthetic probes are the post-deploy signal.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "provenance: C-1 CI run 28784535052 headSha=0488cd7: lint/typecheck/test/build/audit 5/5 success (incl pnpm-audit --audit-level=high, 0 high/critical, exit 0 — not bypassed) + recordkeeping-gate e2e 9 REAL on migrated dealflow_test (DEV-2 lifted); no Ghost Green; deploy target 5754fbf = 0488cd7 + docs-only chore (2 files under process/, 96 insertions, zero code/schema/CI bytes)"
  - "railway dealflow-api: current live deployment 3a8813fe-80db-48e4-9cda-7bc180227788 SUCCESS, commit 5754fbf (initial explicit 1fe3b170 SUCCESS applied 0012 in-band; GIT_SHA-refresh redeploy e6fb3904 superseded by same-commit 3a8813fe); never SKIPPED"
  - "railway dealflow-web: current live deployment 90b2fc2f-2911-4023-a7a3-781f47948465 SUCCESS, commit 5754fbf (explicit trigger); never SKIPPED"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok,db:ok,version:5754fbf} — version==deployed hash, own domain, stable over 3+ reads (stale GIT_SHA 2ec4953 corrected to 5754fbf + redeployed)"
  - "https://dealflow-web-production-a4f7.up.railway.app/: 307 (auth-guard redirect, expected)"
  - "migration 0012 additive+hash-safe: single ADD COLUMN mandate_id uuid (nullable, hash-excluded from canonicalSerialization v1); applied by api preDeploy one-shot before serving; zero-downtime; DROP COLUMN only in .down rollback file"
  - "LOAD-BEARING — hash-chain VERIFY live (compliance): GET /compliance/audit-log/verify 200 {ok:true, entriesChecked:310} — real AuditVerifier tamper-evidence over the live accumulated chain, STILL GREEN after the additive mandate_id column (proves 0012 did not break tamper-evidence live); re-checked end-of-stage, still 310/{ok:true}"
  - "mandate_id column exists live: GET /compliance/audit-log-data 200 with rows carrying mandateId:null (existing rows NULL as designed; seq-309 entryHash 930bfecc == wave-13 tail, hashes unchanged); no column/relation error"
  - "gate no-regression live: POST /outreach (compose) well-formed nonexistent-refs -> 404 'Template version not found' (server-side validation fired, no 500/silent-send); malformed -> 400 'Invalid uuid; Required x4' (strict compose schema); gate allow/block UNCHANGED"
  - "mandate-derivation read path live: GET /compliance/audit-log-data?mandateId=<uuid> 200 [] — WHERE mandate_id filter executes against the new 0012 column (no 500/column-error); empty because all gate-evaluate rows are historical/pre-0012 (mandateId NULL). Full mandate-scoped compose->gate->rows write-smoke NOT run (would inject a full owned mandate+match+approved-template chain) — the WRITE path is proven at C-1 by the REAL recordkeeping-gate e2e; no green fabricated for the un-run smoke"
  - "RBAC/SoD live (server-side): advisor export 403 + advisor verify 403 (RolesGuard); advisor read 200 [] (own-outreach scoping); anon verify 401 (SessionGuard)"
  - "M2 read-validation: GET ?limit=999999 -> 400 'Number must be <= 200'; ?mandateId=notauuid -> 400 'Invalid uuid' (BadRequest at boundary, not 500/unbounded)"
  - "/compliance/oversight (f5074df8, self-grepped DEPLOYED authed HTML): compliance page 24KB renders gate-outcome oversight table (Oversight/Gate-outcome/SoD/approver/template-version/mandate); READ-ONLY — 0 approve/reject/edit/delete/send/mailto/AI-draft affordance, only mandate-filter input + Refresh button + site chrome; distinct from /compliance-queue (links out to it for template-version approval); advisor -> 307 redirect to / (assertRole fail-closed, 0 content leaked); only AI = global DealFlow-AI brand/meta tagline"
deploy_targets:
  - {platform: railway, service: dealflow-api, deploymentId: "3a8813fe-80db-48e4-9cda-7bc180227788", state: SUCCESS, commit: "5754fbf11818110f47a1c774aa06ebfe4042a8ef", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-06T10:34:00Z"}
  - {platform: railway, service: dealflow-web, deploymentId: "90b2fc2f-2911-4023-a7a3-781f47948465", state: SUCCESS, commit: "5754fbf11818110f47a1c774aa06ebfe4042a8ef", health_url: "https://dealflow-web-production-a4f7.up.railway.app/", verified_at: "2026-07-06T10:34:00Z"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window:
  start: ""
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
rollback_anchors:
  dealflow-api: "2199bf94-d110-4808-b8f4-0643f5d1e7b4 (commit 2ec4953, wave-13 known-good SUCCESS)"
  dealflow-web: "dfaeeeb6-24d5-4938-897a-8cd5634bb73a (commit 2ec4953, wave-13 known-good SUCCESS)"
note: >
  Both services immutable-deployed @ 5754fbf via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED;
  explicit trigger defeats the Wait-for-CI Phantom Skip). Migration 0012 is ADDITIVE + HASH-CHAIN-SAFE: a single
  nullable ADD COLUMN mandate_id on audit_log_entries, EXCLUDED from the HMAC preimage — statically verified (zero
  DROP/ALTER-TYPE; DROP only in the .down rollback file) BEFORE mutating, and applied by the api preDeploy migrate
  one-shot before serving (zero-downtime, no Destructive-Drizzle-Lock). LIVE-CONFIRMED hash-safe: the load-bearing
  verifyChain returns {ok:true, entriesChecked:310} over the accumulated production chain AFTER the additive column
  (proves 0012 did NOT break tamper-evidence live; re-checked stable end-of-stage), and audit rows now carry
  mandateId:null with existing entryHashes byte-identical (seq-309 == the wave-13 tail). Gate NO-REGRESSION live: the
  non-bypassable POST /outreach compose fired server-side validation (404 on nonexistent refs / 400 on malformed) with
  no 500 and no silent send — allow/block behavior unchanged. The mandate-derivation READ path is live: filtering
  audit-log by mandateId executes against the new column (200, empty because all gate-evaluate rows predate 0012); the
  mandate-attribution WRITE path is proven at C-1 by the REAL migrated-DB recordkeeping-gate e2e (9 tests, mandate_id
  isolation incl shared-template-version) — the full live compose->gate->filtered-rows write-smoke was NOT assembled
  (it would inject a whole owned mandate chain) and is stated as un-run, NOT fabricated green. RBAC/SoD holds live
  server-side (advisor export/verify 403, anon 401); M2 read-validation rejects limit>200 and non-uuid mandateId with
  400 at the boundary. The /compliance/oversight page (f5074df8) renders LIVE for compliance (24KB authed page, the
  gate-outcome oversight table) and is READ-ONLY (self-grepped deployed HTML: zero approve/edit/delete/send/mailto/
  AI-draft affordance — only a mandate-filter input + Refresh; the only AI is the allowed DealFlow-AI brand tagline),
  DISTINCT from /compliance-queue (links out to it for template-version approval), and advisor is server-side blocked
  (307 redirect to /, zero content leaked). No Ghost Green: C-1 provenance re-confirmed on the EXACT code SHA 0488cd7
  (run 28784535052, 5/5 incl pnpm-audit --audit-level=high 0 high/critical) — 5754fbf is 0488cd7 + a docs-only chore
  (zero code/schema/CI bytes). /health returns the deployed hash 5754fbf on the api own domain (stale GIT_SHA 2ec4953
  corrected + redeployed + live-confirmed; version-lag was env-var only — deployed code was always 5754fbf per immutable
  commitHash; no Health-Check Mirage). Rollback armed to the wave-13 2ec4953 known-good SUCCESS ids BEFORE mutating;
  because 0012 is additive/nullable/hash-excluded, a code rollback to 2ec4953 stays fully safe (no forward-incompatible
  schema — no Stateful-Downgrade-Corruption). Correct APP project + production env id on every mutation (no cross-env
  pollution). Canary skipped (0 DAU < 1000). No Iron-Law trigger fired.
```

## head-ci-cd C-2 stage-exit verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: { live_verification: "head-ci-cd (self) — invite->signup compliance+advisor sessions minted through the web origin (host-only cookies, rid anti-csrf on POST); hash-chain verify + mandate_id-column read + gate no-regression compose + mandate-filter + RBAC/SoD + M2 read-validation exercised live; /compliance/oversight self-grepped on the deployed authed HTML for both roles" }
  failed_checks: []
  rationale: >
    Both services immutably deployed to 5754fbf via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED; the
    explicit trigger defeats the Railway Wait-for-CI Phantom Skip). No Ghost Green: C-1 provenance was re-confirmed on the
    EXACT code SHA 0488cd7 (CI run 28784535052, 5/5 jobs incl the pnpm-audit --audit-level=high supply-chain gate with 0
    high/critical and the REAL migrated-DB recordkeeping-gate e2e that lifted DEV-2), and the deploy target 5754fbf is
    0488cd7 + a docs-only chore (2 files under process/, zero application/schema/CI bytes; the [skip ci] is correct).
    Migration 0012 was statically verified additive + hash-chain-safe BEFORE mutating (a single nullable ADD COLUMN
    mandate_id, excluded from the HMAC preimage; DROP only in the .down rollback file) and applied by the api preDeploy
    one-shot before serving (zero-downtime, no Destructive-Drizzle-Lock). The load-bearing proof holds LIVE, not inferred
    from green tests: verifyChain returns {ok:true, entriesChecked:310} over the accumulated production chain AFTER the
    additive column (tamper-evidence intact; re-checked stable at end-of-stage), and audit rows carry mandateId:null with
    byte-identical existing entryHashes (seq-309 == the wave-13 tail). Rollback was armed to the wave-13 2ec4953
    known-good SUCCESS ids BEFORE any mutation; because 0012 is additive/nullable/hash-excluded, a code rollback to
    2ec4953 stays fully safe (no forward-incompatible schema, no Stateful-Downgrade-Corruption). Correct APP project +
    production env id on every mutation (no cross-env pollution). /health returns the deployed hash 5754fbf on the api OWN
    domain (not global-routed, not stale — the version-lag was a stale GIT_SHA env var, corrected + redeployed +
    live-confirmed stable; no Health-Check Mirage). The wave's payoff is exercised LIVE through invite->signup compliance
    and advisor sessions: the non-bypassable POST /outreach gate fired server-side (404 on nonexistent refs, 400 on
    malformed — no 500, no silent send; allow/block unchanged = no regression), and the mandate-derivation READ path
    executes against the new 0012 column (audit-log filtered by mandateId returns 200, empty because all gate-evaluate
    rows predate 0012 — the mandate-attribution WRITE path is proven at C-1 by the REAL recordkeeping-gate e2e; the full
    live compose->gate->filtered-rows write-smoke was NOT assembled and is stated un-run, not fabricated). RBAC/SoD holds
    live server-side (advisor export 403, advisor verify 403, anon 401), and M2 read-validation rejects limit>200 and a
    non-UUID mandateId with 400 at the boundary. The /compliance/oversight page (f5074df8) renders LIVE for compliance (a
    24KB authed page with the gate-outcome oversight table) and is READ-ONLY on the deployed HTML (self-grepped: zero
    approve/edit/delete/send/mailto/AI-draft affordance — only a mandate-filter input + a Refresh button; the only AI is
    the allowed global DealFlow-AI brand tagline, no CODE-OF-CONDUCT false-send/false-AI violation), DISTINCT from
    /compliance-queue (links out to it for template-version approval), and advisor is server-side blocked (307 redirect to
    /, zero content leaked). Canary skipped (0 DAU < 1000). No Iron-Law trigger fired.
  next_action: PROCEED_TO_T
```
