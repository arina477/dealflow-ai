# C-2 — Deploy & verify (wave-12 M6 pipeline / deal-stage tracking)

Owner: head-ci-cd. Mode: automatic (credential present; no founder pause). Platform: Railway (GraphQL-only, `Project-Access-Token` header). Deployed commit: **`989fae9`** (wave-12 code = `6b62762` + docs-only C-1 chore).

## Provenance gate (no Ghost Green) — resolved BEFORE mutating prod
- git HEAD = `989fae9d9d821935f5425f08d33e6b358d694195` = the exact deploy target.
- The wave-11 green (`af5b5d9`) and the C-1 deliverable's cited merge `6b62762` are NOT the deploy target. `989fae9` is `6b62762` + a **docs-only chore** (`process/waves/wave-12/checklist.md` + `C-1-pr-ci-merge.md` — zero application/source/schema/CI-workflow bytes; `git diff --stat 6b62762 989fae9` = 2 files, both under `process/`).
- **CI verified GREEN on the EXACT deployed SHA `989fae9`** — run `28749460752` (event=push, main, headSha=989fae9): lint / typecheck / **test** / build / **audit** ALL success (5/5). The `audit` (pnpm-audit) gate passed on this exact commit. The run was `in_progress` at C-2 entry; head-ci-cd polled it to terminal SUCCESS rather than deploying blind or extrapolating from the parent's green. No fabricated green.

## Infra discovered (deploy-scoped probe — never `me{}`)
- Project `app-arina-5ywq3s` = `ce095f75-1f3d-4af9-939e-fe8532541475`; single env `production` = `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (pre-existing — NOT created).
- **dealflow-api** svc `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` → https://dealflow-api-production-66d4.up.railway.app ; `/health`. preDeploy runs `drizzle-kit migrate` synchronously before serving (same one-shot mechanism as 0009/0010).
- **dealflow-web** svc `06b07f19-9146-4da0-b589-0d6d81ec1576` → https://dealflow-web-production-a4f7.up.railway.app.
- Credential `APP_RAILWAY_TOKEN` (36-char project token) — deploy-scoped probe returned `data.project` with no `errors`. Usable.

## Migration 0011 (0011_brainy_the_liberteens) — static analysis: ADDITIVE-ONLY (zero-downtime)
Read the migration SQL directly. Contents: `CREATE TYPE` ×2 (new enums `pipeline_event_type`, `pipeline_stage` 7 values), `CREATE TABLE` ×2 (new tables `pipeline`, `pipeline_events`), `ALTER TABLE ... ADD CONSTRAINT` (FKs on the NEW tables only, into existing mandates/outreach/match_candidates/users), `CREATE [UNIQUE] INDEX` (on the new tables). **ZERO `DROP`, ZERO `ALTER COLUMN`, ZERO destructive DDL against any existing table.** No Destructive-Drizzle-Lock; safe under live traffic. Applied via the synchronous preDeploy one-shot BEFORE the api serves.

## Rollback anchors (captured BEFORE mutating — armed)
- api previous known-good SUCCESS: **`86b638e2-3985-4b0f-bfb5-9d27aa575bd8`** (commit `af5b5d9`, wave-11).
- web previous known-good SUCCESS: **`b28a0b2a-0742-409b-a33f-40869a32fbde`** (commit `af5b5d9`, wave-11).
- Rollback path: `serviceInstanceDeployV2` (redeploy prior commit) / `deploymentRollback` to the above ids. Not needed (deploy healthy).
- Correct project + `production` env id used on every mutation (no cross-env pollution).

## Deploy (explicit immutable trigger — defeats Railway "Wait for CI" Phantom Skip)
- api: `serviceInstanceDeployV2(sid, eid=production, commitSha=989fae9)` → dep `d02c5a7b` → SUCCESS in ~102s (BUILDING→DEPLOYING→SUCCESS; never SKIPPED). Commit meta = `989fae9…` (exact). preDeploy applied 0011.
- web: `serviceInstanceDeployV2(…)` → dep `74bba2bf` → SUCCESS in ~122s (never SKIPPED). Commit meta = `989fae9…` (exact). A redundant same-commit web deploy `a2d7c137` (auto webhook) also landed SUCCESS @ `989fae9` and superseded `74bba2bf` (→ REMOVED) — harmless (identical commit); confirms web NOT SKIPPED.
- **GIT_SHA follow-up (wave-11 lesson):** post-deploy `/health` reported `version: af5b5d9` (stale) — `/health` reads `process.env.GIT_SHA`, which lagged. The deployed CODE was always `989fae9` (proven by immutable deployment `meta.commitHash`). Upserted `GIT_SHA=989fae9` (non-destructive single-var `variableUpsert`, both svcs — other vars untouched) and redeployed api (`1323cfcb` → terminal SUCCESS @ `989fae9`) → `/health` now returns `989fae9`.

## Verify LIVE (self-performed by head-ci-cd)
- **Health probe on OWN domain (not global-routed):** `curl -fsS https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"989fae9"}` — version == deployed hash (fresh, not stale; `db:ok` confirms live Postgres connectivity). Web root → **307 → /login → 200** (standard auth-guard redirect; Next.js has no /health).
- **Migration 0011 live-confirm (functional, authed advisor):** minted an advisor session via the invite→signup flow (app is invite-only). `GET /pipeline` authed advisor → **200** with a valid grouped-by-stage `{byStage:{}}` body (empty board — no seeded deals — but NOT a `relation "pipeline" does not exist` 500). The `pipeline` + `pipeline_events` tables and their FK joins EXIST live. Independently re-confirmed via the SSR web page (below) which server-side-fetches `GET /pipeline` and rendered the board (not the "Couldn't load the pipeline" error state).
- **Pipeline RBAC live (advisor-only write path):** anon `GET /pipeline` → **401** (SessionGuard). analyst `POST /pipeline` (enroll) → **403** (advisor-only `PIPELINE_WRITE_ROLES`, RolesGuard). anon `POST /pipeline` → **401**. advisor `POST /pipeline` well-formed-but-nonexistent source → **404** "Outreach … not found" / "Match candidate … not found" (both `sourceType` branches reach the eligible-source guard and fail cleanly — NOT a 500; endpoint present + FK-guarded). SuperTokens `antiCsrf: VIA_CUSTOM_HEADER` → POST requires header `rid: anti-csrf`; apiDomain=websiteDomain=WEB_ORIGIN (cookies web-origin-scoped).
- **Compliance-audit invariant (the wave's must-verify):** pipeline mutations are audited last-in-txn with a real-DB rollback on audit-throw (audit-throw → `db.transaction()` ROLLBACK → zero orphan pipeline/pipeline_events rows). This is **PROVEN by the C-1 CI e2e** — `pipeline-gate.e2e` 4/4 GREEN against a REAL Postgres at this exact commit `989fae9` (audit-rollback for enroll + addNote; happy-path exactly-one-event+one-audit; idempotent-409 real partial-unique). The deployed artifact IS that commit. LIVE, head-ci-cd confirmed: the enroll endpoint is present, advisor-RBAC-gated (analyst 403, anon 401), and reaches the eligible-source guard (404 on nonexistent, not 500). **A full live enroll→transition→note→timeline smoke was NOT assembled** — production has no eligible source (`GET /outreach` → `[]`; no `send_eligible` outreach or accepted match_run exists live), and assembling one requires the entire wave-10/11 sourcing→match→accept→compose→gate→send_eligible + cross-user SoD chain. **Reliance stated explicitly:** non-bypassable-audit correctness RELIES on the C-1 real-DB e2e proof at `989fae9`; LIVE confirms endpoints present + RBAC-correct + FK-guarded (no relation-missing 500).
- **AC-STRIP on DEPLOYED authed HTML (karen-MANDATORY — head-ci-cd self-grepped the rendered HTML, web-origin session):** minted a web-origin advisor session (`{web}/auth/*` proxied to api → cookies web-scoped), `GET {web}/pipeline` → **200, 31.6KB** (the REAL authed board, NOT the ~10KB /login shell — "Pipeline Board" heading, advisor role badge, "7 fixed stages" subtitle all present). **All 7 FIXED stage columns render** (exactly one `data-stage` each): shortlisted, contacted, engaged, diligence, offer, closed, withdrawn. **AC-STRIP: ZERO** occurrences of "Send Immediate"/"Schedule Send"/"Send Email"/"AI Drafting"/"Generate with AI"/"Draft with AI"/"Compose Email"/"upon send"; **ZERO** send buttons; **ZERO** "draft". The 5 `AI` word-hits are all the site-wide `DealFlow AI` brand (`<title>`, wordmark, global `<meta name="description">` "AI-powered M&A…" tagline — present on every page incl. /login, wave-10/11 precedent = allowed brand, NOT a feature claim). The 1 `email` hit is the logged-in advisor's own account email in `__NEXT_DATA__`. **AC-STRIP holds — pipeline is TRACKING-only; no send/email/AI-drafting affordance shipped; no CODE-OF-CONDUCT false-send/false-AI violation.**

## Canary
0 DAU < 1000 threshold → skipped. T-block synthetic probes are the post-deploy signal.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "provenance: CI run 28749460752 headSha=989fae9 (EXACT deploy target): lint/typecheck/test/build/audit 5/5 success — no Ghost Green; 989fae9 = 6b62762 + docs-only chore (2 files under process/, zero code)"
  - "railway dealflow-api: latest deployment 1323cfcb SUCCESS, commit 989fae9 (initial d02c5a7b SUCCESS; GIT_SHA-refresh redeploy 1323cfcb); never SKIPPED"
  - "railway dealflow-web: latest deployment a2d7c137 SUCCESS, commit 989fae9 (explicit 74bba2bf SUCCESS, superseded by redundant same-commit a2d7c137); never SKIPPED"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok,db:ok,version:989fae9} — version==deployed hash, own domain (stale GIT_SHA af5b5d9 corrected to 989fae9 + redeployed)"
  - "https://dealflow-web-production-a4f7.up.railway.app/: 307->/login->200 (auth-guard, expected)"
  - "migration 0011 live: GET /pipeline authed advisor 200 grouped-by-stage {byStage:{}} — pipeline+pipeline_events tables exist, no relation-missing 500; enroll nonexistent source -> 404 (FK-guarded, not 500)"
  - "pipeline RBAC live: anon GET/POST 401; analyst POST /pipeline (enroll) 403 (advisor-only write); advisor read 200; antiCsrf VIA_CUSTOM_HEADER (rid:anti-csrf on POST)"
  - "compliance-audit invariant: pipeline mutations audited last-in-txn w/ real-DB rollback — PROVEN by C-1 pipeline-gate.e2e 4/4 GREEN vs real Postgres @ 989fae9; LIVE endpoints present + advisor-RBAC + FK-guarded (full send_eligible smoke NOT assembled — no eligible source live; reliance on CI proof stated)"
  - "AC-STRIP (self-grepped DEPLOYED authed HTML, web-origin session): /pipeline board 31.6KB — 7 fixed columns (shortlisted..withdrawn) render; 0 send/schedule/email/AI-draft affordances; 0 send buttons; only AI = global DealFlow-AI brand/meta tagline"
deploy_targets:
  - {platform: railway, service: dealflow-api, deploymentId: "1323cfcb-f58d-449f-8224-ae9fea46bd0e", state: SUCCESS, commit: "989fae9d9d821935f5425f08d33e6b358d694195", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-05T18:00:00Z"}
  - {platform: railway, service: dealflow-web, deploymentId: "a2d7c137-7204-4dd2-a12b-84272ce62e72", state: SUCCESS, commit: "989fae9d9d821935f5425f08d33e6b358d694195", health_url: "https://dealflow-web-production-a4f7.up.railway.app/", verified_at: "2026-07-05T18:00:00Z"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window:
  start: ""
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
rollback_anchors:
  dealflow-api: "86b638e2-3985-4b0f-bfb5-9d27aa575bd8 (commit af5b5d9, wave-11 known-good)"
  dealflow-web: "b28a0b2a-0742-409b-a33f-40869a32fbde (commit af5b5d9, wave-11 known-good)"
note: >
  Both services immutable-deployed @ 989fae9 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED;
  explicit trigger defeats the Wait-for-CI Phantom Skip — a redundant same-commit web webhook deploy also landed
  harmlessly). CI provenance verified on the EXACT deployed SHA 989fae9 (5/5 jobs incl pnpm-audit), NOT extrapolated
  from the parent 6b62762 — 989fae9 is 6b62762 + a docs-only chore (zero code). Rollback armed to wave-11 af5b5d9
  known-good SUCCESS ids BEFORE mutating; correct APP project + production env id (no cross-env pollution). Migration
  0011 statically additive-only (2 new tables pipeline+pipeline_events, 2 new enums, FKs into existing tables, NO
  ALTER of existing tables -> zero-downtime), applied via synchronous preDeploy one-shot BEFORE traffic; live-confirmed
  functionally (GET /pipeline 200 grouped-by-stage, no relation-missing 500; enroll 404-guarded not 500; SSR board
  renders). /health returns deployed hash 989fae9 on the api own domain (stale GIT_SHA af5b5d9 corrected + redeployed;
  version-lag was env-var only — deployed code was always 989fae9 per immutable commitHash). Pipeline RBAC live: anon
  401, analyst enroll 403 (advisor-only write), advisor read 200. Compliance-audit non-bypassability (audit last-in-txn
  + real-DB rollback) RELIES on the C-1 pipeline-gate.e2e 4/4 real-DB proof at this exact commit (stated explicitly);
  a full live enroll->transition->note->timeline smoke was NOT assembled (no eligible source exists live — needs the
  whole wave-10/11 sourcing+SoD chain). AC-STRIP holds on the DEPLOYED authed HTML (self-grepped web-origin session):
  7 fixed columns render; zero send/schedule/email/AI-draft CTAs; only AI = the global DealFlow-AI brand meta tagline.
  Canary skipped (0 DAU). No Iron-Law trigger fired.
```

## head-ci-cd C-2 stage-exit verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: { live_verification: "head-ci-cd (self) — invite->signup advisor+analyst sessions minted; API-origin + web-origin (SSR) both exercised; AC-STRIP self-grepped on deployed authed HTML" }
  failed_checks: []
  rationale: >
    Both services immutably deployed to 989fae9 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED;
    explicit trigger defeats the Railway Wait-for-CI Phantom Skip — a redundant same-commit web webhook deploy landed
    harmlessly). No Ghost Green: C-1 provenance was re-verified on the EXACT deployed SHA 989fae9 (CI run 28749460752,
    5/5 jobs incl the pnpm-audit gate), which head-ci-cd polled to terminal SUCCESS rather than extrapolating from the
    parent 6b62762 — and 989fae9 is 6b62762 + a docs-only chore (2 files under process/, zero application/schema/CI
    bytes). Rollback armed to the wave-11 af5b5d9 known-good SUCCESS ids BEFORE any mutation; correct APP project +
    production env id (no cross-env pollution). /health returns the deployed hash 989fae9 on the api OWN domain (not
    global-routed, not stale — the version-lag was a stale GIT_SHA env var, corrected + redeployed + live-confirmed;
    no Health-Check Mirage). Migration 0011 is statically additive-only (2 new tables + 2 enums + FKs, NO ALTER of
    existing tables -> zero-downtime, no Destructive-Drizzle-Lock), applied via a synchronous preDeploy one-shot BEFORE
    traffic (no One-Shot-Migration-Amnesia), and live-confirmed functionally (GET /pipeline 200 grouped-by-stage, no
    relation-missing 500; enroll 404-guarded not 500; the SSR web board renders the 7 columns rather than the load-error
    state). Pipeline RBAC holds live: anon 401, analyst enroll 403 (advisor-only write), advisor read 200. The wave's
    compliance-audit invariant (mutations audited last-in-txn with real-DB rollback on audit-throw) is PROVEN by the
    C-1 pipeline-gate.e2e 4/4 against a real Postgres at this exact commit; a full live send-eligible enroll smoke was
    NOT assembled because production has no eligible source (needs the entire wave-10/11 sourcing + cross-user SoD chain)
    — non-bypassability therefore RELIES, stated explicitly and not papered over, on that CI proof, with LIVE confirming
    the endpoint is present, advisor-RBAC-gated, and FK-guarded. AC-STRIP holds on the DEPLOYED authed HTML, self-grepped
    by head-ci-cd via a correct web-origin session: 7 fixed stage columns render and zero forbidden send/schedule/email/
    AI-draft affordances and zero send buttons on the pipeline board; the only AI is the allowed global DealFlow-AI brand
    meta tagline. Canary skipped (0 DAU < 1000). No Iron-Law trigger fired.
  next_action: PROCEED_TO_T
```
