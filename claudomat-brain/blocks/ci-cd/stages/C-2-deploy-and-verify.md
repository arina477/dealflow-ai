# C-2 — Deploy & verify

> **Block:** C (CI/CD), 4th of 8 in wave loop: `P → [D] → B → ` **`C`** ` → T → V → L → N`.
> **Stages:** C-1 → **C-2**. Advance on stage exit: block exit → T.
> **Pattern:** spawn-pattern (headless). head-ci-cd owns the block as a sub-agent; orchestrator coordinates.
> **Dispatcher** (skip rules, external-verdict gates, exit handoff): `claudomat-brain/blocks/ci-cd/ci-cd.md`.

## Purpose

Verify every configured deploy target received the merged commit and is serving it healthily, then arm a post-deploy canary watch when real-user traffic warrants it. C-2 is project-agnostic — reads project's declared deploy targets from `project.yaml` and exercises each. Canary phase fires asynchronously alongside the T-block.

## Prerequisites

- C-1 exited (PR merged to main; merge commit SHA captured).
- READ `project.yaml: deploy_targets[]` for configured deploy targets, health endpoints (`health_endpoint`), and per-target canary threshold (`canary_threshold_dau`). For the **default Railway path** the credential is already provided (see Action 0); `deploy_targets[]` may be empty on a first deploy until Action 0 confirms the credential and the brain provisions the target.
- READ `claudomat-brain/management/<mode>-mode.md` for async-deploy handling under autonomous modes.
- READ `claudomat-brain/monitors/railway-deploy.md` § "Project-scoped token — `Project-Access-Token` header, never `me { … }`" before probing for the Railway credential in Action 0 — Railway is GraphQL-only (no Railway CLI), the token authenticates via the `Project-Access-Token` header, and the deploy-scoped GraphQL probe (not `me { … }`) tells you whether the credential is usable.

## Skip condition

C-2 deploy verification does NOT skip — but per-target sub-actions skip when project doesn't declare that target. Project with only one deploy platform skips other-platform sub-actions; deliverable records configured-target list and actual checks run.

If the project declares ZERO `deploy_targets` in `project.yaml` **AND `stack.deploy_platform` is `none`** (e.g., a library with no production deploy), C-2 records `ci_stage_verdict: PASS` with `note: "no deploy targets configured; merge to main is the deploy"`. An empty `deploy_targets[]` with a deploy-bearing `stack.deploy_platform` (railway / vercel / netlify / …) is NOT this case — it is a first deploy awaiting provisioning, so do NOT PASS-and-stop here: fall through to **Action 0** (below), which collects a credential and provisions the target before populating `deploy_targets[]`.

Canary sub-actions (Action 5–7) skip when project's real-user traffic is below the per-target `canary_threshold_dau` declared in `project.yaml: deploy_targets[]` (default: < 1000 daily active users). Below threshold, noise/signal ratio is too high — synthetic probes are cheaper and more reliable than real-user telemetry.

## Actions

### Action 0 — Confirm the Railway deploy credential (provided by default)

For the **default Railway path the credential is already provided** in the environment: a project-scoped `RAILWAY_TOKEN` (plus its `RAILWAY_PROJECT_ID`). Nothing for the founder to set up. Detect it and use it directly over Railway's GraphQL API — there is no Railway CLI. If the token is present and usable, proceed to Action 1 and let the brain provision and deploy. Only the explicitly-non-default opt-out branches below (founder declines Railway, or no Railway token at all) pause and ask the founder.

**Probe for a usable credential — deploy-scoped GraphQL, never `me { … }`.** Railway is GraphQL-only at `https://backboard.railway.com/graphql/v2`, and the project token authenticates via the **`Project-Access-Token: $RAILWAY_TOKEN` header** (NOT `Authorization: Bearer`). Run the deploy-scoped probe per `claudomat-brain/monitors/railway-deploy.md` § "Project-scoped token — `Project-Access-Token` header, never `me { … }`":

```bash
# Self-discover the project/environment id if needed, then probe the deploy surface.
curl -sS https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"query(\$id:String!){ project(id:\$id){ id services { edges { node { id name } } } } }\",\"variables\":{\"id\":\"$RAILWAY_PROJECT_ID\"}}" \
  | jq -e '.data.project != null and (.errors | not)'   # exit 0 ⇒ token usable
```

Treat the credential as **present** when this probe succeeds (or, before any project exists, when `RAILWAY_TOKEN` is set in the environment); treat it as **absent** only when no `RAILWAY_TOKEN` is in the environment at all. Never use `me { … }` — a project-scoped token gets `Not Authorized` on it.

**Env-var presence is a provisional 'attempt' signal, not proof of validity.** Before any project exists there is no deploy-scoped call to make, so `RAILWAY_TOKEN` exported in the environment is taken as "present" and the brain proceeds to provision. But that token may be stale / expired / revoked. If the **first real deploy-scoped GraphQL call** during provisioning (create project / service via `serviceCreate`, create a domain via `serviceDomainCreate`, trigger a deploy) returns an **auth / unauthorized** `errors` payload — as opposed to a "no project / service yet" empty result — treat that as **credential-absent** and route to the non-default opt-out pause below (`AskUserQuestion` in `founder-review` / `default`, or `STATUS: BLOCKED` per the `automatic` / `degenerate` branch). Do NOT declare a hard deploy failure for an auth error; the credential needs replacing.

**If the credential is present (the default):** proceed to Action 1. The brain itself runs the whole flow over GraphQL — create the Railway service / database (`serviceCreate` against `RAILWAY_PROJECT_ID`, environment `production`), generate a public domain (`serviceDomainCreate`), trigger the deploy, and report the resulting live URL to the founder. Do not pause. (The project already has exactly one environment, `production` — do NOT create environments.)

**If the credential is absent OR the founder opts out of Railway (the non-default branch):** PAUSE via the **existing** founder-review path — do NOT invent a new mechanism.

- **`founder-review` / `default` mode** — fire an `AskUserQuestion` in chat (plain, product-first language per always-on rule 16). Ask the founder to set up their own hosting and paste an API token. Include these exact steps:

  > "To put **<project>** online I need a hosting account that belongs to you — it stays under your control and on your billing. Takes about 3 minutes:
  >
  > 1. Go to **railway.com** and create a free account (GitHub sign-in is quickest).
  > 2. Open **Account Settings → Tokens** and create a new **API token** (give it any name, e.g. `claudomat`).
  > 3. Copy the token and paste it back to me here.
  >
  > Once I have it, I'll set up the project, database, and a public web address, deploy your app, and send you the live link. I never store the token in your codebase — it lives only in the deploy environment."

  Options: **Paste token now** (founder pastes it → store it in the deploy environment / platform secrets as `RAILWAY_TOKEN`, never commit it, then re-enter Action 0) · **I'll use a different host** (founder names Netlify / Vercel / AWS / … → update `project.yaml` `stack.deploy_platform` + `deploy_targets[]` and ask for that provider's token instead) · **Custom** (free-text).

- **`automatic` / `degenerate` mode** — a missing deploy credential with no founder-supplied alternative is an **infra-readiness hard stop** (no safe technical default exists — only the founder can create an account and mint a token; always-on rule 17 keeps account-issued credentials founder-supplied). Write `STATUS: BLOCKED` to `process/session/status-check.yaml` with `pause_evidence.trigger=d-hard-stop-verdict` and `measurement.shape: infra-readiness` (siblings under `measurement`: `source: deploy-credential-missing`, `platform: <stack.deploy_platform>`, and a `founder_action:` field carrying the same 3-step account+token instructions as above). End the turn — do NOT call `ScheduleWakeup`, do NOT provision, do NOT proceed to Action 1. `BLOCKED` is terminal until the founder pastes a token (resume via ESC + chat or by editing `status-check.yaml`). On resume, re-enter Action 0 from the top.

Record the outcome (credential present → provisioned-by-brain, or paused-for-token) in the C-2 deliverable `note:` field.

### Action 1 — Enumerate configured targets

Read `project.yaml: deploy_targets[]` for declared deploy platforms. Each target gets its own verification sub-action below. If Action 0 had to provision the platform from scratch (no `deploy_targets[]` entry existed yet), populate the entry now with the project name, service template, and health endpoint the brain just created.

### Action 2 — Per-target deploy verification

For each declared target, run the platform's CLI (or, for Railway, its GraphQL API) to confirm the merge commit deployed and is healthy.

**GitHub Pages / GitHub Actions deploy job**
```
gh run list --workflow=<deploy-workflow> --branch=main --limit=1 --json status,conclusion,headSha
```
Expected: `status: completed`, `conclusion: success`, `headSha: <merge-commit-sha>`.

**Netlify**
```
netlify api listSiteDeploys --data '{"site_id":"<id>","per_page":"3"}'
```
Expected: latest deploy `state: ready` and `commit_ref: <merge-commit-sha>`.

**Railway** (GraphQL only — no Railway CLI)
```bash
# Query the latest deployment for the service over GraphQL. Project token authenticates via
# the Project-Access-Token header (NOT Bearer); never use me{}. See railway-deploy.md
# § "Project-scoped token — `Project-Access-Token` header, never `me { … }`".
curl -sS https://backboard.railway.com/graphql/v2 \
  -H "Project-Access-Token: $RAILWAY_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"query\":\"query(\$pid:String!,\$sid:String!){ deployments(first:3, input:{ projectId:\$pid, serviceId:\$sid }){ edges { node { status meta staticUrl } } } }\",\"variables\":{\"pid\":\"$RAILWAY_PROJECT_ID\",\"sid\":\"$RAILWAY_SERVICE_ID\"}}"
```
Expected: latest deployment (`.data.deployments.edges[0].node`) `status: SUCCESS` (NOT `SKIPPED`) with the merge commit in its `meta` (Railway records the deployed commit under the deployment `meta`).

**Vercel**
```
vercel ls --prod --json | head
```
Expected: latest production deployment `READY` with the merge commit.

For platforms not enumerated above, follow the platform's CLI documentation and record full command + output in deliverable.

### Action 3 — Health endpoint probes

For every target that **declares a health endpoint** in `project.yaml: deploy_targets[].health_endpoint`:

```
curl -fsS <health-url>
```

Expected: HTTP 200 with project's health-check body (typically `{"status":"ok"}` or similar). If health body includes `commit` or `version`, verify it matches merge commit SHA.

**No health endpoint declared.** Skip the curl probe for that target; rely on platform's `state: ready` verdict alone. Record: `health_probe: skipped (no endpoint declared for <platform>)`. Supported zero-config path for libraries, static sites, or projects where the platform's own health-check is authoritative.

**Uptime check (when applicable).** If platform's health endpoint reports uptime, verify uptime < 300 seconds — confirms a fresh deploy. Stale uptime > 300s with the OLD commit means platform did not redeploy; investigate before declaring deploy phase PASS. Skip for targets without health endpoints.

### Action 4 — Async deploy handoff (autonomous modes)

Under `mode: automatic` or `mode: degenerate`, if any target is still in-flight when Action 2/3 completes, do NOT end the turn with "deploy will land later" — banned anti-pattern. A slow but still-healthy deploy is **not** a `BLOCKED` condition: no human action is required to resolve it. Choose one of two patterns based on expected total wait:

1. **Inline poll (≤ 10 min expected total wait — applies the existing chunking rule).**
   `Bash(run_in_background=true)` to keep the deploy job running, then use `Monitor` with an `until`-loop until either `success_condition` or `failure_condition` matches. Do NOT end the turn. Harness auto-compact handles long polls.

   **10-min cap on the until-loop.** Cap the until-loop via `Monitor`'s `timeout_ms: 600000` (600 seconds = 10 min) OR by including an `elapsed > 600` short-circuit in the loop body. On timer expiry without success/failure resolution, exit the inline-poll cleanly and promote to the MONITOR-task path per the rule below. An unbounded until-loop risks burning context if the deploy stalls past 10 min — auto-compact may lose state.

   **Branch on which condition matched:**
   - `success_condition` matched (exit 0): proceed to Action 3 health probes and Action 5 canary phase for that target.
   - `failure_condition` matched (exit 0): write `STATUS: BLOCKED` to `process/session/status-check.yaml` with `pause_evidence.trigger=d-hard-stop-verdict` and `pause_evidence.measurement` citing the monitor's `failure_condition` output. End the turn — do NOT call `ScheduleWakeup`, do NOT proceed to remaining stage actions. Human triage is required (which is what the narrowed `BLOCKED` semantics enforce).

     **On-failure cleanup — before ending the turn:**
     1. Write the current C-2 stage deliverable at `process/waves/wave-<N>/stages/C-2-deploy-and-verify.md` with `ci_stage_verdict: HOLD` (NOT `PASS`, NOT `FAIL` — `HOLD` records "execution paused mid-stage; resume from here on un-block") AND `armed_verification_failed: false` (distinguishes this inline-poll HOLD from MONITOR-task HOLD which sets it true). Populate `note:` with the monitor's `failure_condition` output, the elapsed inline-poll time, and the last action completed before the failure (e.g., `"Action 2: Railway deploy probe returned FAIL after 412s; last-completed-action=Action 1 (target enumeration)"`).
     2. Update wave checklist `process/waves/wave-<N>/checklist.md`: leave C-2 row as `in-progress` (NOT `done`) — the stage hasn't passed.
     3. Update block manifest `process/waves/wave-<N>/blocks/ci-cd/manifest.yaml` if it exists: set block status to `pending-human-triage`.

     **On-unblock resume protocol — when the founder rewrites `STATUS: RUNNING`** (or any non-terminal STATUS), the orchestrator on next wake/tick:
     1. Read `process/waves/wave-<N>/stages/C-2-deploy-and-verify.md` for the `last-completed-action` field captured in step 1 above.
     2. Resume C-2 from the action that follows the last-completed action — do NOT restart from Action 1. (Example: if the HOLD record cites "last-completed-action=Action 1", resume at Action 2 for the still-pending target only; targets that passed Action 2 in the prior turn do not re-run.)
     3. If the founder's triage requires re-firing the deploy itself (rather than continuing past it — e.g., the founder pushed a new commit during triage), explicitly re-enter Action 2: `Bash(run_in_background=true)` for the deploy command, re-enter the inline-poll, then continue.

2. **MONITOR task (> 10 min expected total wait).**
   Spawn a `MONITOR:` task row per `claudomat-brain/monitors/monitor-principles.md` using the platform-specific template (e.g., `claudomat-brain/monitors/railway-deploy.md`), with `success_condition`, `failure_condition`, and `timeout_budget` populated.

   **Write the C-2 deliverable at arming.** Before continuing to the next task row, write `process/waves/wave-<N>/stages/C-2-deploy-and-verify.md` with `ci_stage_verdict: PASS`, `armed_verification_failed: false`, and `async_monitor_id: <task-id>` populated. Mark the wave checklist's C-2 row as `done`. This is the "PASS at arming" state referenced by the MONITOR-task on-success resume and on-failure rollback procedures below — without it, those procedures reference a deliverable that doesn't exist.

   Continue to the next task row. If the task queue is then empty after spawning the MONITOR, end the tick with `STATUS=IDLE` + `ScheduleWakeup(1800s)`. On the next wake, the orchestrator picks up the MONITOR plus any new work; when the monitor's `success_condition` fires, the parent wave resumes here.

**If you cannot estimate the expected wait** (no per-platform baseline known, no historical median from `process/session/monitors/*.log`, no readback from the platform's status API), **default to the MONITOR-task path.** The cost of one extra task row is small; the cost of inline-polling for 30+ minutes is a wasted context window plus the risk of inline-poll losing state to auto-compact.

**If you chose inline-poll but elapsed time exceeds 10 minutes without resolution**, promote the wait mid-poll: spawn a `MONITOR:` task row with the remaining wait's `success_condition` / `failure_condition` / `timeout_budget`, write `STATUS: IDLE` + `ScheduleWakeup(1800s)`, end the turn. Do NOT continue inline-polling past 10 minutes — auto-compact will likely lose the polling context.

If the monitor's `failure_condition` later fires → `STATUS=BLOCKED` + `pause_evidence.trigger=d-hard-stop-verdict` (human triage IS required at that point — matches the narrowed `BLOCKED` semantics: human action required, otherwise the loop is stuck).

**On-failure cleanup when MONITOR-task `failure_condition` later fires** (during wake-time polling):

Per `claudomat-brain/monitors/monitor-principles.md` § Wake-time MONITOR polling, when the orchestrator polls the MONITOR and `failure_condition` matches, BEFORE writing the combined `STATUS=BLOCKED`:

**Step 0: Detect archived-wave case.** Check if `process/waves/wave-<N>/` exists (where `<N>` is the wave that originally spawned the MONITOR, captured at MONITOR-task creation time). If `process/waves/_archive/wave-<N>/` exists instead (the wave completed and N-3 archived it before the MONITOR's `failure_condition` fired — possible whenever `timeout_budget > expected-wave-duration`), the wave-N artifact paths in steps 1-3 below resolve to the archived locations. Proceed with the cleanup against the archived paths AND additionally write a cross-wave escalation under the CURRENT wave (wave M, where M = wave-`<N>`+1 or later):

```bash
ESC_PATH="process/waves/wave-<current-wave>/escalations/c2-late-failure-prev-wave-<N>.md"
cat > "$ESC_PATH" <<EOF
# C-2 late-failure escalation — prev-wave-<N>
prev_wave: <N>
monitor_id: <task-id>
failure_condition_output: <captured output>
elapsed_at_failure: <seconds>
downstream_stages_run_on_false_pass:
  - <T-block stages that ran>
  - <V-block stages that ran>
founder_decision_needed: "whether to re-run downstream stages on top of the corrected (now-failing) deploy"
created_at: <ISO-8601 timestamp>
EOF
```

Then proceed with steps 1-3 against the archived paths. **Risk note for monitor-template authors:** any MONITOR whose `timeout_budget > expected-wave-duration` creates this archived-rollback risk. Size `timeout_budget` to be less than typical wave duration (or accept that late-failure escalation is the expected fallback).

1. **Rewrite the C-2 deliverable.** Update `process/waves/wave-<N>/stages/C-2-deploy-and-verify.md` (or `process/waves/_archive/wave-<N>/stages/C-2-deploy-and-verify.md` if Step 0 detected the archived case): change `ci_stage_verdict: PASS` → `ci_stage_verdict: HOLD`; populate `note:` with the monitor's `failure_condition` output, the elapsed monitor wall-clock time, and `last-completed-action=Action 4 (MONITOR-task spawn — verification deferred)`. Set `armed_verification_failed: true` (new field, distinguishes from inline-poll HOLD).
2. **Roll back wave checklist.** Update `process/waves/wave-<N>/checklist.md` (or the archived path per Step 0): change C-2 row from `done` back to `in-progress`. Any downstream stages (T-block, V-block) that have ALREADY run on top of the false-PASS C-2 verdict are flagged for re-evaluation — populate `pause_evidence.measurement` with the list of completed downstream stages so the founder can decide whether to re-run them.
3. **Roll back block manifest.** Update `process/waves/wave-<N>/blocks/ci-cd/manifest.yaml` if it exists (or the archived path per Step 0): set block status to `pending-human-triage`.
4. **Then write the combined `STATUS=BLOCKED`** per the standard two-pass protocol in `claudomat-brain/monitors/monitor-principles.md` § Wake-time MONITOR polling Pass 2.

**On-unblock resume for MONITOR-task failure:** when the founder un-blocks (rewrites `STATUS: RUNNING`), the orchestrator re-enters C-2 from Action 1 (NOT Action 4 — the MONITOR-task represents the entire deploy; if the deploy failed, the founder may have pushed a new commit and the deploy should be re-fired from scratch). Downstream stages flagged in step 2's `pause_evidence.measurement` may need re-running depending on what they validated against — that decision is the founder's; the orchestrator reads the founder's response and either re-runs them or continues.

**Limitation:** this rollback path is best-effort. Stages T-block / V-block that ran on top of the false-PASS C-2 verdict may have side effects (DB migrations applied against the broken deploy, e2e tests passing against stale staging environment) that this procedure does not reverse. The founder should review the `pause_evidence.measurement` list of completed-stages and decide whether full wave-rollback is needed.

**MONITOR-task success: post-monitor resume.**

When the monitor's `success_condition` fires on a later wake (per `claudomat-brain/monitors/monitor-principles.md` § Wake-time MONITOR polling Pass 2 SUCCESS branch), the orchestrator:

1. Deletes the MONITOR task row (per monitor-principles.md SUCCESS handling).
2. Confirms the C-2 deliverable already has `ci_stage_verdict: PASS at arming` from when the MONITOR was spawned — no rewrite needed.
3. Confirms the wave checklist's C-2 row is already marked `done` from when the MONITOR was spawned — no rewrite needed.
4. Advances to the next stage per the wave checklist (typically T-block).

**No re-run of Action 3 health probes or Action 5 canary phase is needed** — those were marked PASS-at-arming when the MONITOR was spawned. If the founder wants explicit post-deploy verification (e.g., the deploy succeeded but the canary cohort wants a fresh check), they may re-fire Action 3 / Action 5 manually after the fact, or open a verification ticket.

Do NOT use `STATUS=BLOCKED` for "deploy is still healthy and running" — that's not a human-action signal.

### Action 5 — Canary: establish pre-deploy baselines (skip below traffic threshold)

If real-user traffic is below the per-target `canary_threshold_dau` declared in `project.yaml: deploy_targets[]`, record canary skip in deliverable:

```yaml
canary_status: skipped
canary_skip_reason: "DAU below threshold (<DAU> < <threshold>); T-block synthetic probes are the post-deploy signal."
```

…and proceed to Action 8.

Otherwise, if `/canary` skill (gstack) is available and `project.yaml: deploy_targets[]` declares its config (canary_threshold + health_endpoint), invoke with the wave's primary user-facing routes:

```
/canary --routes=<comma-separated route list> --duration=<minutes>
```

`/canary` takes pre-deploy screenshots, captures console error rates, runs synthetic probes against each route at intervals, compares each probe against the baseline, alerts on anomalies.

If `/canary` is not configured, run a manual probe loop using `/browse` against each primary route every N minutes for the canary window — same logic, lower fidelity.

### Action 6 — Canary: alert conditions

Canary alert fires on any of:

- Console error rate > baseline + 2σ for any monitored route.
- HTTP 5xx rate > 0.1% of probes.
- Layout regression detected (visual diff vs baseline > project-defined threshold).
- Health endpoint flips to non-200 mid-window.
- Critical user flow assertion failure (e.g., login form no longer renders).

### Action 7 — Canary: async run

Canary is asynchronous. After Action 5 fires, orchestrator does NOT block waiting for the canary window to complete:

1. Record canary window (start time + duration) in deliverable.
2. Set up canary as background monitor per `claudomat-brain/monitors/monitor-principles.md`.
3. Hand off to T-block (DISPATCHER advances to T per block exit handoff).

Canary monitor reports findings into V-2 Triage if alerts fire during the window. If window completes cleanly, monitor self-records `canary_status: clean` and exits.

**On canary alert during the window:**
1. Capture alert evidence (screenshots, log excerpts, probe diffs).
2. Classify the regression per `command-center/dev/triage-routing-table.md`.
3. Route per Iron Law:
   - Critical regression (5xx spike, login broken) → Hard stop. Revert PR via dedicated revert wave; head-builder respawn.
   - Significant regression (perf degradation, layout shift) → V-2 Triage handles in this wave.
   - Cosmetic regression → V-2 Triage; defer to `bug-design` if non-blocking.

Decision authority for revert vs. continue:
- `founder-review` / `default` → escalate to founder.
- `automatic` → BOARD with decision-slug `C-2-canary-alert-<slug>`.
- `degenerate` → ceo-agent within `ceo-blocklist.md` charter.

### Action 8 — On deploy failure

Per Iron Law: do NOT fix directly.

| Failure | Likely cause | Route to |
|---|---|---|
| Netlify build error: secrets scanner block | Secret committed in source/config | Hard stop. Rotate secret at issuing platform, rewrite history, force-push, re-trigger. Never disable the scanner. |
| Netlify build error: missing env var | Platform env var not configured | Add via platform UI / CLI; rerun deploy. |
| Railway SKIPPED | Railway deprioritized OR no detected change in service | Force a redeploy via the GraphQL `serviceInstanceRedeploy` (or `deploymentRedeploy`) mutation against the service id; if persistent, investigate. |
| Health endpoint 5xx | Runtime crash on new commit | `/investigate` → likely B-2 / B-4 defect; revert PR if production-critical (head-builder respawn for revert wave). |
| Stale uptime > 300s, old commit | Platform did not redeploy | Force redeploy via platform CLI; if recurring, escalate. |

Cap: 3 forced-redeploy attempts per target before escalating per active mode.

## Deliverable

`process/waves/wave-<N>/stages/C-2-deploy-and-verify.md` — records targets verified, per-target state, health probes, async monitor (if any), canary state, plus verdict footer.

```yaml
ci_stage_verdict: PASS                # PASS at arming; canary monitor reports terminal status later
armed_verification_failed: false      # bool — set true when MONITOR-task `failure_condition` later fires and rolls C-2 back from PASS-at-arming → HOLD. Distinguishes inline-poll HOLD (false) from MONITOR-task HOLD (true).
verdict_source: <space-separated list of platforms verified>
verdict_evidence:
  - "<platform>: state ready, commit <sha>"
  - "<health-url>: 200 OK, uptime <s>"
  - "/canary armed for routes <list>, window <duration>"     # only when canary armed
deploy_targets:
  - {platform, state, commit, verified_at, uptime_seconds, health_url}
async_monitor_id: ""                  # populated only if Action 4 fired
canary_status: armed                  # armed | clean | alert | skipped
canary_skip_reason: ""                # populated when canary skipped per traffic threshold
canary_window:
  start: <iso8601>
  duration_minutes: <n>
canary_monitor_id: ""                 # populated when canary armed
canary_alerts: []                     # populated if any fire during window
note: ""
```

## Exit criteria

- When `stack.deploy_platform` is a deploy-bearing platform (railway / vercel / netlify / …), a usable deploy credential is in hand (Action 0): either present at stage entry, or the founder pasted one after the bring-your-own pause. C-2 never exits PASS with a missing credential silently swallowed. (The `deploy_platform: none` / zero-`deploy_targets[]` library case PASSes per the Skip condition with no credential and is exempt from this criterion.)
- Every configured target shows `ready` / `success` with the merge commit.
- Every health endpoint returns 200 with fresh uptime.
- Canary armed (or skip recorded with traffic threshold reasoning).
- Async monitor handles captured (deploy + canary, when applicable).
- Deliverable carries `ci_stage_verdict: PASS`.
- `process/waves/wave-<N>/checklist.md` C-2 row checked.

## Next

→ `claudomat-brain/DISPATCHER.md` → next block is **T** (Test) — `read claudomat-brain/blocks/test/test.md`.

Canary continues running asynchronously when armed. Terminal status (`clean` / `alert`) arrives during T or V-block; alerts feed V-2 Triage. T-block does NOT wait on canary completion — they run in parallel.
