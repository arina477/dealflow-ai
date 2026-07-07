# C-2 — Deploy & verify (wave-23 seller-intent)

## NOT ENTERED

C-2 was not entered. C-1 did not exit PASS — GitHub Actions dispatched zero runs on the
pushed main tip `a1bc858` (0 check-suites / 0 check-runs; recurrence of the wave-22
Actions-minutes / spending-limit hard-stop). Per the C-block Iron Law and the wave-loop
sequencing, C-2 (deploy + live-verify) cannot run until C-1's CI is green on the exact
deployed SHA — deploying UNVERIFIED code (green never observed) would be a debug-by-deploy /
fabricated-provenance violation.

No deploy mutation was issued. No Railway `serviceInstanceDeployV2` fired. Production remains
on the last verified deploy (wave-22 healthy @86ddc29 per prior C-block close) — untouched.

```yaml
ci_stage_verdict: HOLD                # C-1 upstream FAIL/ESCALATE; C-2 not entered
armed_verification_failed: false      # no MONITOR-task armed; upstream block, not a deploy failure
verdict_source: none
verdict_evidence:
  - "C-1 ci_stage_verdict: FAIL (0 CI runs dispatched on a1bc858) — deploy gate not met"
deploy_targets: []                    # no deploy attempted (dealflow-api …-66d4 + dealflow-web …-a4f7 untouched)
async_monitor_id: ""
canary_status: skipped
canary_skip_reason: "C-2 not entered (upstream C-1 FAIL). Canary would also skip on 0 DAU below threshold 1000."
canary_window:
  start: null
  duration_minutes: 0
canary_monitor_id: ""
canary_alerts: []
note: "C-2 blocked upstream by C-1 CI-dispatch hard-stop (GitHub Actions minutes/spending-limit; 0 suites on a1bc858). No deploy issued; prod on last-verified wave-22 deploy. On founder clearing the Actions block and C-1 going green on the exact headSha, C-2 enters normally: rollback anchors (both services' live deployment IDs) BEFORE deploy -> serviceInstanceDeployV2 both services to the pushed tip with GIT_SHA==tip + meta.commitHash verify -> poll SUCCESS -> live verify (/health 200 {ok,db:ok,version==tip} + [RLS-GUARD] dealflow_app; /seller-intent anon 401 fail-closed mounted; /insights 307/200; audit /compliance/audit-log/verify 401 not 500) -> canary skip (0 DAU) -> arm plain deployment rollback (code-only, no migration)."
```

## head_signoff

```yaml
head_signoff:
  verdict: ESCALATE
  stage: C-2
  reviewers: {}
  failed_checks:
    - "C-2 not entered — upstream C-1 CI never dispatched; deploy gate (CI-green on deployed SHA) not met."
  rationale: >
    Deploying wave-23 now would ship code whose CI green was never observed (0 runs on
    a1bc858), violating provenance and the Iron Law. C-2 stays on HOLD until the founder
    clears the GitHub Actions block and C-1 re-runs green on the exact pushed headSha.
  next_action: ESCALATE_TO_founder
```
