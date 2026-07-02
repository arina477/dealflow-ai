# C — CI/CD Block Dispatcher

**Purpose.** Move the wave's branch from local-green to production-live. PR & CI & merge → deploy & verify (with conditional canary). Outcomes are determined by external systems, not judgment calls.

**When it runs.** Every wave, after B-6 exits with `/review` APPROVE.

## Stage sequence

```
C-1 → C-2 → exit
```

| Stage | File | Responsibility |
|---|---|---|
| **C-1** | `stages/C-1-pr-ci-merge.md` | Branch push, PR creation, automated description, watch CI checks (lint, types, unit, contract, integration) until green, then merge to main with mode-aware auto-merge handling |
| **C-2** | `stages/C-2-deploy-and-verify.md` | Wait for prod deploy across all configured targets, curl health, verify deploy hash + uptime; arm `/canary` post-deploy watch when real-user traffic > threshold |

## Deliverable footer (every C-stage)

```yaml
ci_stage_verdict: PASS                # PASS | FAIL | HOLD — derived from external system; HOLD is a C-2 mid-stage pause
verdict_source: <gh|netlify|railway|vercel|other>
verdict_evidence:
  - <command output reference, log link, or URL>
note: ""                              # optional context
```

A stage cannot exit until its deliverable carries `ci_stage_verdict: PASS`. On FAIL, route per the failing stage's protocol (typically: re-enter B-block via `/investigate` per Iron Law). HOLD is C-2 mid-stage pause; emitted by Action 4 in two cases: (a) inline-poll on-failure cleanup (`armed_verification_failed: false`); (b) MONITOR-task failure rollback (post-arming, `armed_verification_failed: true`). See `stages/C-2-deploy-and-verify.md` § Action 4. The stage resumes from the last-completed action after a human un-blocks. Verdicts MUST cite external system evidence — fabricated or stale verdicts are rejected.

## Block-level skip rules

The whole C-block **never skips** — every wave produces a PR and verifies deployment, even doc-only waves.

**Per-stage skip conditions:**

- **C-2 canary sub-actions** skip when project's real-user traffic is below threshold (default: < 1000 daily active users). On skip, deliverable records `canary_status: skipped` with traffic-threshold reasoning. Deploy verification phase still runs.

## Tool-chain preference (CLI over MCP)

CLI is primary. MCP is fallback.

| Surface | Primary tool | Fallback |
|---|---|---|
| GitHub CI / PR | `gh` CLI (`gh pr create`, `gh pr checks`, `gh pr merge`, `gh run watch`, `gh run view --log-failed`) | `mcp__github__*` |
| Deploy platform | Platform CLI (`netlify`, `railway`, `vercel`, etc.) per project's `project.yaml: deploy_targets[].platform` | Platform MCP |
| Health probes | `curl` against the project's health endpoint (`project.yaml: deploy_targets[].health_endpoint`) | — |

Deploy platform(s) declared in `project.yaml: deploy_targets[]`.

## Bring-your-own deploy credential (no hard failure)

Deploy is **bring-your-own**: nothing is pre-provisioned for the brain. If C-2 finds no usable credential for the project's `stack.deploy_platform` (Railway by default), that is **not** a hard failure and **not** a "no access" dead-end — it routes to **C-2 Action 0**, which pauses and asks the founder to create their own account, mint an API token, and paste it (`founder-review` / `default` → `AskUserQuestion`; `automatic` / `degenerate` → `STATUS: BLOCKED` with `pause_evidence.measurement.shape: infra-readiness`). Once a credential is in hand the brain itself provisions the project / service / database, generates a public domain, deploys, and reports the live URL. A token may be a project token or an account token — never conclude "no credential" from `whoami` / `list` / account-flavored `status` failing; verify deploy-scoped per `claudomat-brain/monitors/railway-deploy.md`. See `stages/C-2-deploy-and-verify.md` § Action 0.

## Iron Law in C-block

C-stage failures do NOT get fixed directly:

1. Classify the failure.
2. Route per `command-center/dev/triage-routing-table.md` — typically back to a B-stage via `/investigate`.
3. Re-run the failing C-stage only after the originating B-stage's fix is committed and pushed.

No debug-by-deploy. C-block verifies, does not debug.

## Async deploy handling (autonomous modes)

Under `mode: automatic` or `mode: degenerate`, if C-2's deploy verification is still in-progress when the orchestrator completes the post-merge loop, do NOT end the turn with "deploy will land later." Banned anti-pattern.

A slow deploy that is still healthy and running is **not** a `BLOCKED` condition — no human action is required to resolve it. `BLOCKED` is reserved for cases where the loop is stuck until a human intervenes. Choose one of two patterns based on expected total wait:

- **Inline poll (≤ 10 min expected total wait — applies the existing chunking rule).**
  `Bash(run_in_background=true)` to keep the deploy job running, then use `Monitor` with an `until`-loop until either `success_condition` or `failure_condition` matches. Do NOT end the turn. Harness auto-compact handles long polls.

  **10-min cap on the until-loop.** Cap the until-loop via `Monitor`'s `timeout_ms: 600000` (600 seconds = 10 min) OR by including an `elapsed > 600` short-circuit in the loop body. On timer expiry without success/failure resolution, exit the inline-poll cleanly and promote to the MONITOR-task path per the rule below. An unbounded until-loop risks burning context if the deploy stalls past 10 min — auto-compact may lose state.

  **Branch on which condition matched:**
  - `success_condition` matched (exit 0): proceed to next stage action per stage spec (verification, canary, etc.).
  - `failure_condition` matched (exit 0): write `STATUS: BLOCKED` to `process/session/status-check.yaml` with `pause_evidence.trigger=d-hard-stop-verdict` and `pause_evidence.measurement` citing the monitor's `failure_condition` output. End the turn — do NOT call `ScheduleWakeup`, do NOT proceed to remaining stage actions. Human triage is required (which is what the narrowed `BLOCKED` semantics enforce).

- **MONITOR task (> 10 min expected total wait).**
  Spawn a `MONITOR:` task row per `claudomat-brain/monitors/monitor-principles.md` with `success_condition`, `failure_condition`, and `timeout_budget` populated (use the platform-specific template). **At arming time, the orchestrator writes the C-2 deliverable with `ci_stage_verdict: PASS`, `armed_verification_failed: false`, and `async_monitor_id` populated, and marks the wave checklist's C-2 row `done` — this PASS-at-arming write is what later on-success / on-failure procedures reference (see `stages/C-2-deploy-and-verify.md` § Action 4 § MONITOR-task path).** Continue to the next task row. If the task queue is then empty after spawning the MONITOR, end the tick with `STATUS=IDLE` + `ScheduleWakeup(1800s)`. On the next wake, the orchestrator picks up the MONITOR plus any new work. When the monitor's `success_condition` fires on a later wake, the parent wave's C-2 stage is already marked PASS-at-arming; the orchestrator resumes wave execution at the next stage (T-block) per the wave checklist. When `success_condition` fires on a later wake → C-2 transitions cleanly per `stages/C-2-deploy-and-verify.md` § Action 4 § MONITOR-task success: post-monitor resume (no re-run of arming actions needed). See `stages/C-2-deploy-and-verify.md` § Action 4 + `claudomat-brain/monitors/monitor-principles.md` § Monitor state machine.

**If you cannot estimate the expected wait** (no per-platform baseline known, no historical median from `process/session/monitors/*.log`, no readback from the platform's status API), **default to the MONITOR-task path.** The cost of one extra task row is small; the cost of inline-polling for 30+ minutes is a wasted context window plus the risk of inline-poll losing state to auto-compact.

**If you chose inline-poll but elapsed time exceeds 10 minutes without resolution**, promote the wait mid-poll: spawn a `MONITOR:` task row with the remaining wait's `success_condition` / `failure_condition` / `timeout_budget`, write `STATUS: IDLE` + `ScheduleWakeup(1800s)`, end the turn. Do NOT continue inline-polling past 10 minutes — auto-compact will likely lose the polling context.

If the monitor's `failure_condition` later fires → `STATUS=BLOCKED` + `pause_evidence.trigger=d-hard-stop-verdict` (human triage IS required at that point — matches the narrowed `BLOCKED` semantics).

Do NOT use `STATUS=BLOCKED` for "deploy is still healthy and running" — that's not a human-action signal.

## Block exit / handoff

```yaml
cicd_block_status:    complete
pr_number:            <number>
pr_url:               <url>
merge_commit:         <sha>
deploy_targets:       [{platform, state, commit, verified_at}]
canary_status:        clean | alert | skipped | armed
ready_for_test:       true
```

→ next block: `claudomat-brain/blocks/test/test.md`. C-2's canary monitor (if armed) runs asynchronously and feeds findings into V-2 triage; T-block does NOT wait on canary.

## References

- Project facts (stack, deploy targets, commands) — `project.yaml` (`stack.*`, `deploy_targets[]`, `commands[]`)
- Triage routing — `command-center/dev/triage-routing-table.md`
- Monitor principles — `claudomat-brain/monitors/monitor-principles.md` + per-platform templates
- Mode routing — `claudomat-brain/management/<mode>-mode.md`
- Iron Law — `claudomat-brain/DISPATCHER.md` § Iron Law
- Path conventions — `claudomat-brain/process/process-paths.md`
