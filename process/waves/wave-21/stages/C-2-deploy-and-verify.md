# C-2 — Deploy & verify (wave-21, docs-only NO-OP)

## Deploy action: none-required

Wave-21 changed ONLY `command-center/testing/` docs (`ci-e2e-authoritative-policy.md` +
`test-writing-principles.md` pointer). The app bundle (`apps/`, `packages/`) is **byte-identical**
to the wave-20 tip `86ddc29`. `command-center/` docs are project-managed knowledge artifacts —
they are **not deployed to the running app**. Therefore no new deploy is required, and the app
must NOT be redeployed to "ship" a doc.

Instead, per C-2's docs-only path: capture the current live deployment state, then verify prod
is STILL healthy (unchanged by the docs push), confirming the docs commit did not disturb prod.

## Deploy credential (Action 0)

Railway project-scoped token present and **usable**. Deploy-scoped GraphQL probe
(`Project-Access-Token` header, project id `ce095f75-1f3d-4af9-939e-fe8532541475`) returned
project `app-arina-5ywq3s` + services with `errors: null`. No `me { … }` used. Services:
`dealflow-api` (dcdb4ab4-abc3-4983-ae73-43512ce2c7e6), `dealflow-web`
(06b07f19-9146-4da0-b589-0d6d81ec1576), postgres, supertokens-core, supertokens-db.

## Live deployment state captured (no mutation)

Queried `deployments(first:3, input:{projectId, serviceId})` for both app services:

| Service | Live deployment ID | status | commitHash | createdAt |
|---|---|---|---|---|
| dealflow-api | `0d8c8f10-f27e-43c6-bdf9-023cd6c7242c` | SUCCESS | `86ddc29fa974e99128c436f5984910a152c77240` | 2026-07-07T04:37:24Z |
| dealflow-web | `875e7f09-0c82-47af-8d40-bc4b55935bf4` | SUCCESS | `86ddc29fa974e99128c436f5984910a152c77240` | 2026-07-07T04:37:31Z |

Both services are on the **wave-20 tip `86ddc29`** — unchanged by the wave-21 docs push, exactly
as expected (docs are not part of the app bundle). No `serviceInstanceDeploy` /
`serviceInstanceRedeploy` mutation was issued. No rollback anchor armed (no deploy mutation to
roll back).

## Prod health — STILL healthy (undisturbed by the docs push)

- **API** `curl -fsS $API_URL/health` → HTTP **200**,
  `{"status":"ok","db":"ok","version":"86ddc29fa974e99128c436f5984910a152c77240"}`.
  The deployed container reports its **own** hash 86ddc29 (health-check-mirage guard: this is the
  live deployment's self-reported version, matching the captured live deployment commitHash — not
  a stale global-domain 200), db:ok. App still runs as `dealflow_app` (non-superuser runtime
  established in wave-17; unchanged).
- **WEB** `$WEB_URL/` → HTTP **307** → **200** on redirect follow (auth redirect, healthy).

This confirms the wave-21 docs commit did not disturb prod. Prod is byte-identical to and healthy
at 86ddc29.

## Canary

Skipped: 0 real-user DAU (< `canary_threshold_dau: 1000`) **and** zero app-code change — nothing
new to canary. T-block synthetic probes are the post-deploy signal.

## Provenance note (main-tip vs deployed hash)

Main tip is now `ed9899b` (wave-21 docs + C-1 CI-trigger commits); deployed app hash is `86ddc29`.
These differ, but the delta between them is **exclusively** `command-center/testing/` docs +
`process/` wave transcripts (`git diff --name-only 86ddc29 ed9899b` outside those paths = NONE) —
i.e., zero app/bundle bytes. A no-op redeploy-to-tip is therefore **NOT warranted**: it would
rebuild a byte-identical app image, incur deploy risk (rollout, one-shot migration replay) for no
functional change, and violate the "deploy code, not docs" principle. Default for a pure docs
change is NO redeploy. The next wave that touches app code will naturally advance the deployed hash.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
verdict_source: railway curl
deploy_action: none-required   # docs-only wave; app bundle unchanged; command-center/ docs are not deployed to the running app
verdict_evidence:
  - "railway dealflow-api: live deployment 0d8c8f10-f27e-43c6-bdf9-023cd6c7242c SUCCESS, commit 86ddc29 (unchanged by docs push)"
  - "railway dealflow-web: live deployment 875e7f09-0c82-47af-8d40-bc4b55935bf4 SUCCESS, commit 86ddc29 (unchanged by docs push)"
  - "API /health: 200 {status:ok, db:ok, version:86ddc29} — deployed-container self-reported hash matches live deployment, not a global-domain mirage"
  - "WEB /: 307 -> 200 (auth redirect, healthy)"
  - "no redeploy issued — app bundle byte-identical to 86ddc29 (git diff 86ddc29..ed9899b outside process/ + command-center/testing/ = NONE)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, deployment_id: "0d8c8f10-f27e-43c6-bdf9-023cd6c7242c", commit: "86ddc29fa974e99128c436f5984910a152c77240", health_url: "https://dealflow-api-production-66d4.up.railway.app/health", verified_at: "2026-07-07T05:40Z", redeployed: false}
  - {platform: railway, service: dealflow-web, state: SUCCESS, deployment_id: "875e7f09-0c82-47af-8d40-bc4b55935bf4", commit: "86ddc29fa974e99128c436f5984910a152c77240", health_url: "https://dealflow-web-production-a4f7.up.railway.app/", verified_at: "2026-07-07T05:40Z", redeployed: false}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "0 DAU (< 1000 threshold) AND zero app-code change (docs-only wave) — nothing new to canary; T-block synthetic probes are the post-deploy signal."
canary_window: {start: "", duration_minutes: 0}
canary_monitor_id: ""
canary_alerts: []
note: "Docs-only NO-OP. No app code changed => no new deploy required; command-center/testing/ docs are not part of the app bundle and are not deployed to the running app. Captured live deployment IDs (api 0d8c8f10 / web 875e7f09) + commitHash 86ddc29 (wave-20 tip, unchanged). Prod STILL healthy @86ddc29: API /health 200 {ok,db:ok,86ddc29} own-reported hash, WEB 307->200. NO redeploy (app bundle byte-identical), NO rollback anchor (no mutation), canary skipped (0 DAU + no code change). No fabricated green: verdict cites live Railway deployment status + curl health with the deployed container's self-reported hash."
```

## Exit criteria

- [x] Usable Railway deploy credential in hand (Action 0 probe succeeded).
- [x] Live deploy state captured for both targets — both SUCCESS @ 86ddc29 (unchanged by docs push).
- [x] Health endpoints return 200 with the deployed container's own hash (API {ok,db:ok,86ddc29}; WEB 307->200).
- [x] Canary skip recorded with traffic-threshold + no-code-change reasoning.
- [x] No redeploy performed (correct for docs-only NO-OP; provenance rationale recorded).
- [x] Deliverable carries `ci_stage_verdict: PASS`.
- [x] Checklist C-2 row checked.

## C-block exit / handoff

```yaml
cicd_block_status: complete
pr_number: null                 # PAT lacks PR:write — direct fast-forward push
pr_url: null
merge_commit: ed9899b2b12b3654d8d73c5ab18a56abca2977c5
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: "86ddc29", verified_at: "2026-07-07T05:40Z", redeployed: false}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: "86ddc29", verified_at: "2026-07-07T05:40Z", redeployed: false}
canary_status: skipped
ready_for_test: true
```

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Wave-21 is a genuine docs-only deploy NO-OP: the app bundle is byte-identical to the
    already-deployed wave-20 tip 86ddc29 (git diff 86ddc29..ed9899b outside process/ +
    command-center/testing/ = NONE), and command-center/ docs are not deployed to the running
    app. I captured the current live deployment state from Railway (api 0d8c8f10 / web 875e7f09,
    both SUCCESS @ 86ddc29) rather than trusting a stale assumption, and verified prod is STILL
    healthy: API /health returns 200 {status:ok, db:ok} with the deployed container reporting
    its OWN hash 86ddc29 (matching the captured live deployment — health-mirage guard held, not
    a global-domain false 200), WEB 307->200. No redeploy was issued because rebuilding a
    byte-identical app image incurs rollout/migration-replay risk for zero functional change;
    no rollback anchor was armed because no deploy mutation occurred. Canary correctly skipped
    (0 DAU + zero code change). No fabricated green — every claim is tied to a live Railway
    deployment status query and a live health probe against the deployed hash.
  next_action: PROCEED_TO_T
