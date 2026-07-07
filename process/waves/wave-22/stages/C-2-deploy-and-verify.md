# C-2 — Deploy & verify (wave-22)

**Block:** C (CI/CD) · **Stage:** C-2 · **Mode:** automatic · **Gate agent:** head-ci-cd
**Wave:** 22 — M9 audit-assertion test-hygiene fix (TEST-ONLY, one file)
**Merged tip (CI-green):** `c168d3a` (run 28850000460 conclusion=success, 5/5 jobs green — see C-1)

**Prod api:** https://dealflow-api-production-66d4.up.railway.app · **web:** https://dealflow-web-production-a4f7.up.railway.app

---

## Why this is a test-only NO-OP (no redeploy required)

This wave changed ONLY `apps/api/test/outreach-activity-rls.e2e-spec.ts` (12 audit assertions scoped
by `workspace_id`) plus a 1-line non-code marker `.ci/wave-22-resume-probe.txt` (a CI-dispatch trigger,
outside `apps/`/`packages/`). **Test files are not deployed** — the deployable `apps/` runtime bundle is
byte-identical to the last CODE deploy `86ddc29`. No product code, no migration, no env-var change.
Therefore **no new deployment is triggered and none is required.** C-2 verifies prod is undisturbed and
still serving the last-good code, then records `deploy_action: none-required`.

## Action 0 — Credential

Railway credential present under `APP_RAILWAY_TOKEN` (+ `RAILWAY_PROJECT_ID`). Deploy-scoped GraphQL
probe against both service ids returned `errors: null` — credential usable. No provisioning needed
(services already exist). No founder pause.

## Action 1 — Configured targets

`project.yaml: deploy_targets[]` → single platform `railway`, health_endpoint `/health`. Two live
services (from prior C-2 deliverables):
- **dealflow-api** `dcdb4ab4-abc3-4983-ae73-43512ce2c7e6`
- **dealflow-web** `06b07f19-9146-4da0-b589-0d6d81ec1576`

## Action 2 — Per-target live deployment state (Railway GraphQL, `deployments(first:1)`)

Both services queried against the live Railway GraphQL API. **No new deploy triggered by this wave** —
both still serving the last CODE deploy `86ddc29`, `status: SUCCESS`, unchanged since 04:37Z:

| Service | status | commit | createdAt | redeployed |
|---|---|---|---|---|
| dealflow-api | SUCCESS | 86ddc29fa974e99128c436f5984910a152c77240 | 2026-07-07T04:37:24.179Z | false |
| dealflow-web | SUCCESS | 86ddc29fa974e99128c436f5984910a152c77240 | 2026-07-07T04:37:31.121Z | false |

`errors: null` on both queries. No `SKIPPED`, no crash-loop, no drift.

## Action 3 — Health probes (confirm prod undisturbed)

- **API** `GET https://dealflow-api-production-66d4.up.railway.app/health` → **HTTP 200**
  `{"status":"ok","db":"ok","version":"86ddc29fa974e99128c436f5984910a152c77240"}`
  — `db:ok` (schema consistent, migration 0018 still applied), `version==86ddc29` (exact live commit,
  matches the Railway GraphQL deployment commit — not a stale globally-routed response; the probed
  version hash equals the deployment's own recorded commit).
- **WEB** `GET https://dealflow-web-production-a4f7.up.railway.app/` → **HTTP 307** (auth redirect —
  healthy, matches prior C-2 baseline; not a 404/5xx).

Prod is healthy and serving 86ddc29. Nothing this wave disturbed the running instances.

## Action 5-7 — Canary

**Skipped.** Real-user traffic is below the `canary_threshold_dau` (0 DAU, MVP pre-launch). Additionally,
no new code was deployed — there is no new artifact to canary. No blast radius.

## Action 8 — Deploy failure

N/A — no deploy attempted (test-only no-op); prod verified healthy on the existing deployment.

## Head-ci-cd verdict

C-2 exit checklist for a test-only no-op: (a) no app-bundle change → no redeploy needed (test files
aren't deployed); (b) live deployment state captured for both services via Railway GraphQL — both
`SUCCESS @86ddc29`, unchanged; (c) prod health verified — api /health 200 with `version==86ddc29` &
`db:ok`, web 307; the health probe's version hash equals the deployment's own recorded commit (not a
stale-domain false-200); (d) no rollback anchor needed (nothing mutated); (e) canary skipped (0 DAU +
no new artifact). No fabricated green — every claim is a live curl or a live Railway GraphQL read.
Verdict: **APPROVED**.

```yaml
ci_stage_verdict: PASS
armed_verification_failed: false
deploy_action: none-required        # test-only wave; app bundle unchanged from last code deploy 86ddc29
verdict_source: railway curl
verdict_evidence:
  - "railway GraphQL dealflow-api: status=SUCCESS, commit=86ddc29fa974e99128c436f5984910a152c77240, createdAt=2026-07-07T04:37:24.179Z, errors=null"
  - "railway GraphQL dealflow-web: status=SUCCESS, commit=86ddc29fa974e99128c436f5984910a152c77240, createdAt=2026-07-07T04:37:31.121Z, errors=null"
  - "curl https://dealflow-api-production-66d4.up.railway.app/health → 200 {\"status\":\"ok\",\"db\":\"ok\",\"version\":\"86ddc29fa974e99128c436f5984910a152c77240\"}"
  - "curl https://dealflow-web-production-a4f7.up.railway.app/ → 307 (auth redirect, healthy)"
deploy_targets:
  - {platform: railway, service: dealflow-api, state: SUCCESS, commit: 86ddc29fa974e99128c436f5984910a152c77240, deployment_created_at: "2026-07-07T04:37:24.179Z", verified_at: "2026-07-07T07:45Z", redeployed: false, health_url: "https://dealflow-api-production-66d4.up.railway.app/health"}
  - {platform: railway, service: dealflow-web, state: SUCCESS, commit: 86ddc29fa974e99128c436f5984910a152c77240, deployment_created_at: "2026-07-07T04:37:31.121Z", verified_at: "2026-07-07T07:45Z", redeployed: false, health_url: "https://dealflow-web-production-a4f7.up.railway.app/"}
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "DAU below threshold (0 DAU, MVP pre-launch) AND no new artifact deployed (test-only no-op) — no blast radius to canary."
canary_window: {}
canary_monitor_id: ""
canary_alerts: []
rollback_anchor: none-required      # no deploy mutation performed; nothing to roll back
note: >
  Test-only wave (one test file + a non-code .ci probe marker). Test files are not deployed, so the
  app runtime bundle is unchanged from the last code deploy 86ddc29 — no redeploy triggered, none
  required. Both services confirmed SUCCESS @86ddc29 via live Railway GraphQL; prod health re-verified
  (api /health 200 version==86ddc29 db:ok, web 307). Nothing disturbed prod. Canary skip. No rollback
  anchor. head-ci-cd APPROVED → PROCEED_TO_T.

head_signoff:
  verdict: APPROVED
  stage: C-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Test-only no-op wave: only a test file (+ a non-code CI-trigger marker) changed, and test files are
    not deployed, so the production runtime bundle is unchanged from the last code deploy 86ddc29 — no
    redeploy is triggered or required. Live Railway GraphQL confirms both dealflow-api and dealflow-web
    are SUCCESS @86ddc29 (unchanged since 04:37Z). Prod health re-verified live: api /health 200 with
    version==86ddc29 (the health-probe version equals the deployment's own recorded commit, so this is
    the real deployed instance, not a stale-domain false-200) and db:ok; web 307 auth redirect. No
    mutation performed, so no rollback anchor is needed; canary skipped (0 DAU + no new artifact). Every
    verdict is a live curl or Railway GraphQL read — no fabricated green. C-2 exits PASS.
  next_action: PROCEED_TO_T
```

## Exit criteria status
- Usable deploy credential in hand (APP_RAILWAY_TOKEN, deploy-scoped probe errors=null). ✔
- Every configured target shows SUCCESS with the last-good commit (86ddc29; unchanged — test-only no-op). ✔
- Health endpoint 200 with matching version + db:ok (api); web 307 healthy. ✔
- Canary skip recorded with traffic-threshold + no-new-artifact reasoning. ✔
- Deliverable carries `ci_stage_verdict: PASS`. ✔
- Wave checklist C-2 row: **checked**.

## Next
→ DISPATCHER → next block is **T** (Test) — `read claudomat-brain/blocks/test/test.md`.
