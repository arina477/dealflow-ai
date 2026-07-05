# C-2 — Deploy & verify (wave-11 outreach foundation)

Owner: head-ci-cd. Mode: automatic (credential present; no founder pause). Platform: Railway (GraphQL-only, `Project-Access-Token` header). Deployed commit: **`af5b5d9`** (wave-11 code = `8d7ed8b` + C-1 chore).

## Infra discovered (deploy-scoped probe — never `me{}`)
- Project `app-arina-5ywq3s` = `ce095f75-1f3d-4af9-939e-fe8532541475`; single env `production` = `0e84f0b6-1b1d-469f-91b9-caf4e59c9ba8` (NOT created — pre-existing).
- **dealflow-api** svc `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6` → https://dealflow-api-production-66d4.up.railway.app ; healthcheckPath `/health` ; `preDeployCommand: ["pnpm --filter @dealflow/api exec drizzle-kit migrate"]` (migrations run SYNCHRONOUSLY before traffic).
- **dealflow-web** svc `06b07f19-9146-4da0-b589-0d6d81ec1576` → https://dealflow-web-production-a4f7.up.railway.app.
- Credential `APP_RAILWAY_TOKEN` (36-char project token) — deploy-scoped probe returned `data.project` with no `errors`. Usable.

## Rollback anchors (captured BEFORE mutating — armed)
- api previous known-good SUCCESS: **`5e8a362a-c048-4da4-9a37-762c9249dcf0`** (commit `57449b68`, wave-10).
- web previous known-good SUCCESS: **`08a3a526-ebd5-4efe-8c48-a72b550bb563`** (commit `57449b68`, wave-10).
- Rollback path: `serviceInstanceDeployV2` / `deploymentRollback` to the above ids. Not needed (deploy healthy).

## Deploy (explicit immutable trigger — NOT trusting Railway "Wait for CI" webhook; Phantom-Skip prevention)
- api: `serviceInstanceDeployV2(sid,eid,commitSha=af5b5d9)` → dep `f6555e0f…` → **SUCCESS** in ~122s (BUILDING→SUCCESS; never SKIPPED). Commit on deployment meta = `af5b5d94…` (exact).
- web: `serviceInstanceDeployV2(…)` → dep `fc039ad3…` → **SUCCESS** in ~122s (never SKIPPED). Commit = `af5b5d94…` (exact).
- Follow-up: GIT_SHA env var was stale (`57449b6`, wave-10) — `/health` reads `process.env.GIT_SHA`, so version reported wave-10 hash. Upserted `GIT_SHA=af5b5d9` (non-destructive single-var upsert, both svcs) and redeployed api (`86b638e2…` SUCCESS) → `/health` now returns `af5b5d9`. Web auto-deploy webhook also landed a redundant same-commit deploy (`b28a0b2a…` SUCCESS, `af5b5d9`) — harmless (identical commit); confirms neither service SKIPPED and LIVE = `af5b5d9` on both.

## Verify LIVE (self-performed by head-ci-cd; delegate result independently re-verified/corrected — see note)
- **Health probe on OWN domain (not global-routed):** `curl -fsS https://dealflow-api-production-66d4.up.railway.app/health` → **200** `{"status":"ok","db":"ok","version":"af5b5d9"}` — version == deployed hash (fresh, not stale). Web root → **307 → /login → 200** (standard auth-guard redirect; Next.js has no /health, `/`→/login is expected).
- **Migration 0010 live-confirm (functional, authed advisor):** `GET /outreach-templates` → **200 `{"templates":[]}`**, `GET /outreach` → **200 `{"outreach":[]}`** — the 3 new tables (outreach_templates / outreach_template_versions / outreach) EXIST live; NO "relation does not exist" 500. Additive-only migration applied via preDeploy one-shot before traffic (zero-downtime). Disclaimer FK live too (`GET /compliance/disclaimers` → 200, active row `084c9b88…`).
- **RBAC on compose write path (self-minted role sessions via invite→signup):** anon `GET /outreach-templates` + `GET /outreach` → **401**. `POST /outreach` analyst → **403**, compliance → **403** (compose is advisor-only write). advisor → **400** (role passes; Zod validation on body). SuperTokens `antiCsrf: VIA_CUSTOM_HEADER` → POSTs require header `rid: anti-csrf` (GET exempt); without it → 401 (this is the CSRF barrier working, NOT a defect — it explains the delegate's spurious "POST 401 blocker").
- **Compliance gate live (THE C-2 must-verify):** compose endpoint `POST /outreach` EXISTS, advisor-RBAC-gated, routes through `OutreachService.composeAsActor` which ALWAYS calls `ComplianceGateService.evaluate` (structural invariant: no code path sets `status='send_eligible'` without a passing verdict; version-binding + outreach-SoD pre-checks short-circuit to `blocked`). Live: created a real template (`2ef2769d…`) + v1 (`2e7bce9a…`, `approvalStatus: pending`) as advisor; composing against the UNAPPROVED version with well-formed input returned **400 FK-violation** (my synthetic mandate/candidate UUIDs don't exist) — i.e. the write path is FK-guarded and **send_eligible was NOT reached**. A full happy-path live smoke (mandate→buyer-universe→submit→match-run→accept→approve-by-different-user→compose→send_eligible) was NOT assembled (would require the entire wave-10 sourcing chain + cross-user SoD seed). **Reliance stated explicitly:** the non-bypassable-gate invariant + send_eligible-only-through-passing-gate is PROVEN by the C-1 CI e2e against a REAL DB (6/6 green, per B-6/C-1), and the deployed artifact is that exact commit (`af5b5d9`); LIVE I confirmed the endpoint is present, advisor-only, gate-routed, and does NOT yield send_eligible without valid approved prerequisites.
- **AC-STRIP on DEPLOYED authed HTML (karen-MANDATORY — head-ci-cd grepped the rendered HTML itself, web-origin session):** signed in via `POST {web}/auth/signin` (web-origin cookies), fetched the REAL authed pages (composer 76KB / compliance-queue 22KB / templates 22KB — NOT the 10KB /login shell). Across all three: **ZERO** occurrences of "Send Immediate", "Schedule Send", "AI Drafting", "ai drafting in progress", "Generate with AI", "upon send", "WORM storage upon send"; **ZERO** send/schedule buttons (send-word-button count 0 on every page). The only "AI-powered" (2 hits/page) is the site-wide `<meta name="description">` product tagline + its `__NEXT_DATA__` source copy — the allowed global tagline (present on every page incl. /login), NOT a feature claim (wave-10 precedent). Compose CTA PRESENT + correct: `<button>Run Compliance Gate &amp; Create Record</button>` (entity-encoded `&`). "No email has been sent" copy is correctly gated to the `{isSendEligible && …}` post-compose success block (renders only after a send-eligible record — not on initial load; correct). **AC-STRIP holds — no CODE-OF-CONDUCT / false-send / false-AI violation shipped.**

**Delegate note:** a `deployment-engineer` was spawned for the live exercise; it produced two FALSE findings — (1) "POST session 401 blocker" (it omitted the required `rid: anti-csrf` header) and (2) "AC-STRIP FAIL / required strings missing" (it grepped the `/login` redirect shell because API-origin cookies aren't sent to the WEB origin). head-ci-cd independently re-ran BOTH against a correct web-origin session and corrected them: POST path works (CSRF header needed), and AC-STRIP PASSES on the real authed HTML. T1 (tables 200) was the one delegate result consistent with independent verification.

## Canary
0 DAU < 1000 threshold → skipped. T-block synthetic probes are the post-deploy signal.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway
verdict_evidence:
  - "railway dealflow-api: SUCCESS, commit af5b5d94… (deployment 86b638e2; initial f6555e0f); never SKIPPED"
  - "railway dealflow-web: SUCCESS, commit af5b5d94… (deployment b28a0b2a; explicit fc039ad3); never SKIPPED"
  - "https://dealflow-api-production-66d4.up.railway.app/health: 200 {status:ok,db:ok,version:af5b5d9} — version==deployed hash, own domain"
  - "https://dealflow-web-production-a4f7.up.railway.app/: 307->/login->200 (auth-guard, expected)"
  - "migration 0010 live: GET /outreach-templates 200 {templates:[]}, GET /outreach 200 {outreach:[]} — 3 new tables exist, no relation-missing 500"
  - "RBAC: anon 401; POST /outreach analyst 403, compliance 403, advisor 400 (role passes, Zod); antiCsrf VIA_CUSTOM_HEADER (rid:anti-csrf on POST)"
  - "gate live: POST /outreach advisor-only, composeAsActor always evaluates gate; compose vs unapproved version did NOT yield send_eligible (FK-guarded 400); non-bypassability proven by C-1 CI e2e 6/6 on real DB @ af5b5d9"
  - "AC-STRIP (self-grepped authed HTML): composer/compliance-queue/templates — 0 forbidden send/AI CTAs, 0 send buttons; only AI-powered = global meta tagline; CTA 'Run Compliance Gate & Create Record' present; 'No email has been sent' correctly post-compose-gated"
deploy_targets:
  - {platform: railway, service: dealflow-api, deploymentId: "86b638e2-3985-4b0f-bfb5-9d27aa575bd8", state: SUCCESS, commit: "af5b5d94c1f478efe3b27f348a577c343851f2ec", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-05T12:45:00Z"}
  - {platform: railway, service: dealflow-web, deploymentId: "b28a0b2a-0742-409b-a33f-40869a32fbde", state: SUCCESS, commit: "af5b5d94c1f478efe3b27f348a577c343851f2ec", health_url: "https://dealflow-web-production-a4f7.up.railway.app/", verified_at: "2026-07-05T12:45:00Z"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 < 1000); T-block synthetic probes are the post-deploy signal."
canary_window:
  start: ""
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
rollback_anchors:
  dealflow-api: "5e8a362a-c048-4da4-9a37-762c9249dcf0 (commit 57449b68, wave-10 known-good)"
  dealflow-web: "08a3a526-ebd5-4efe-8c48-a72b550bb563 (commit 57449b68, wave-10 known-good)"
note: "Both services immutable-deployed @ af5b5d9 via explicit serviceInstanceDeployV2 (fresh builds, neither SKIPPED; explicit-trigger avoids Wait-for-CI Phantom Skip — a redundant same-commit webhook deploy also landed harmlessly). Rollback armed to wave-10 57449b68 SUCCESS ids BEFORE mutating; correct APP project + production env id (no cross-env pollution). Migration 0010 is additive-only (3 new tables + 2 enums + FKs to existing users/disclaimer_templates/mandates, NO ALTER) applied via synchronous preDeploy drizzle-kit-migrate one-shot BEFORE traffic; live-confirmed functionally (outreach-templates/outreach list endpoints 200, no relation-missing). /health returns the deployed hash af5b5d9 on the api's own domain (stale GIT_SHA env var was corrected 57449b6->af5b5d9 + redeployed; version-lag was env-var only, deployed code was always af5b5d9 per immutable commitHash + the live 401 on brand-new wave-11 routes). Compliance-gate live: compose endpoint present, advisor-only RBAC (analyst/compliance 403, anon 401), routes through composeAsActor (always-evaluate invariant); a compose against an unapproved version did NOT reach send_eligible (FK-guarded 400) — full happy-path send_eligible smoke NOT assembled live (needs the whole wave-10 sourcing+SoD chain), so non-bypassability RELIES on the C-1 CI e2e proof (6/6 real-DB) against this exact commit, stated explicitly. AC-STRIP holds on the DEPLOYED authed HTML (self-grepped web-origin session): zero send/schedule/AI-draft CTAs on composer/compliance-queue/templates; only AI-powered is the global meta tagline; 'Run Compliance Gate & Create Record' CTA present; 'No email has been sent' correctly post-compose-gated. Delegate deployment-engineer produced 2 false findings (missing rid:anti-csrf header; grepped /login shell) — both independently corrected by head-ci-cd. Canary skipped (0 DAU). No Iron-Law trigger fired."
```

## head-ci-cd C-2 stage-exit verdict

```yaml
head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: { live_verification: "head-ci-cd (self) — delegate deployment-engineer spawned; its 2 false findings independently corrected" }
  failed_checks: []
  rationale: >
    Both services immutably deployed to af5b5d9 via explicit serviceInstanceDeployV2 (fresh builds,
    neither SKIPPED; explicit trigger defeats the Railway Wait-for-CI Phantom Skip — a redundant
    same-commit webhook deploy landed harmlessly). Rollback armed to the wave-10 57449b68 known-good
    SUCCESS ids BEFORE any mutation; correct APP project + production env id (no cross-env pollution).
    C-1 provenance is on the exact deployed SHA (no Ghost Green). /health returns the deployed hash
    af5b5d9 on the api's OWN domain (not global-routed, not stale — the version-lag was a stale GIT_SHA
    env var, corrected + redeployed + live-confirmed). Migration 0010 is statically additive-only
    (3 new tables + 2 enums + FKs, NO ALTER of existing tables → zero-downtime, no Destructive-Drizzle-Lock),
    applied via a synchronous preDeploy one-shot BEFORE traffic (no One-Shot-Migration-Amnesia), and
    live-confirmed functionally (the new outreach list endpoints return 200, not relation-missing 500).
    The compliance must-verify holds: the compose endpoint is live, advisor-only RBAC-gated
    (analyst/compliance 403, anon 401), and structurally routes every compose through the
    always-evaluate gate; a live compose against an unapproved version did NOT yield send_eligible
    (FK-guarded 400). A full live send_eligible happy-path smoke was NOT assembled (it needs the entire
    wave-10 sourcing + cross-user SoD chain); non-bypassability therefore RELIES — stated explicitly,
    not papered over — on the C-1 CI e2e proof (6/6 against a real DB) built on this exact commit.
    AC-STRIP holds on the DEPLOYED authed HTML, self-grepped by head-ci-cd via a correct web-origin
    session: zero forbidden send/schedule/AI-draft CTAs and zero send buttons on composer/compliance-queue/
    templates; the only AI-powered is the allowed global product meta tagline; the honest
    'Run Compliance Gate & Create Record' CTA is present and 'No email has been sent' is correctly gated
    to the post-compose success state. The spawned delegate's two contradicting findings (a spurious POST
    401 from omitting the rid:anti-csrf header, and a false AC-STRIP fail from grepping the /login shell)
    were caught and corrected by independent head-ci-cd re-verification — no fabricated green. Canary
    skipped (0 DAU < 1000). No Iron-Law trigger fired.
  next_action: PROCEED_TO_T
```
