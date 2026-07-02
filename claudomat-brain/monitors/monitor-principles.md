# Monitor Principles

Master doctrine for monitoring external events (deploys, CI runs, DNS propagation, tier activations, third-party provisioning). READ before creating any `MONITOR:` task.

## Contract for new rules

Template:

```
### N. Imperative rule ending in a period.
Why: one declarative sentence.
```

- Before adding: grep for the concept — if a similar rule exists, do not add a near-dup.
- One sentence per line, short, commanding, cut to the chase.
- No war stories, wave refs, `Context:`, `Cross-ref:`, or project/stack names.
- Compact inline.
- Number sequentially; renumber on insert.
- Group under an existing H2 unless ≥3 new rules share a theme.
- Wave-specific ("broke once") stays in the L-1 docs entry until a second wave confirms.

---

## When a monitor is needed

Any stage that must wait for an external event before proceeding. Examples:

- **C-2 Deploy & verify** (Railway / Vercel / Netlify deploy must land before canary phase)
- **T-5 E2E** (prod URL must serve the merged commit before browser tests run)
- **C-1 PR, CI & merge** (GitHub Actions / CircleCI / GitLab pipelines must complete before merge)
- Domain / DNS setup (propagation must complete before auth cookies work cross-subdomain)
- Stripe tier activation, S3 bucket availability, any provider with async provisioning

Never hold a session open polling in a tight loop. Never end the turn with "best run in a fresh session" / "needs live infra verification before next stage" — those are named protocol violations (see `claudomat-brain/management/automatic-mode.md` § Anti-pattern). INSERT a `MONITOR:` task instead (Spawn-and-Block pattern) — a `tasks` row with `status='recurring'` and `title LIKE 'MONITOR:%'`.

---

## The three-condition requirement

Every `MONITOR:` task MUST declare all three of the following keys in its `description` MONITOR YAML carve-out per [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md) § tasks `monitor spec:`:

1. **`success_condition`** — shell one-liner that returns exit code 0 when the external event definitively succeeded.
2. **`failure_condition`** — shell one-liner that returns exit code 0 when the external event definitively failed (errored, crashed, canceled, rolled back, timed out at the platform layer).
3. **`timeout_budget`** — max total wait in seconds. Past this, the monitor escalates regardless of state.

**If you cannot articulate the failure signal for the external, do NOT create the monitor.** Stop and read the platform's status API docs, or copy from a template in this directory. A monitor without a failure condition will sit forever on a failed deploy.

Also declare:

- **`poll_delay`** — seconds between polls (default 60s for fast externals, 300s for slow ones like DNS).

---

## Spawn invocation (canonical pattern)

To spawn a `MONITOR:` row from C-2 (or any stage that needs a wake-time poll), use the `MONITOR — upsert` recipe in [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md):

```sql
WITH existing AS (
  SELECT id FROM tasks
  WHERE status = 'recurring' AND title = 'MONITOR: <platform> <run-id> <stage-context>'
  LIMIT 1
)
INSERT INTO tasks (title, description, status)
SELECT
  'MONITOR: <platform> <run-id> <stage-context>',
  $$success_condition: |
  <bash one-liner returning exit 0 on success, non-zero otherwise>
failure_condition: |
  <bash one-liner returning exit 0 on failure, non-zero otherwise>
timeout_budget: 1800
poll_delay: 60
poll_log: process/session/monitors/monitor-<task-id>.log$$,
  'recurring'
WHERE NOT EXISTS (SELECT 1 FROM existing)
RETURNING id;
```

**Conventions:**
- Title MUST start with `MONITOR: ` (with the space) to be discoverable by the wake-time polling enumeration (`Task — pending MONITORs`).
- `<platform>` is a short identifier (e.g., `railway`, `vercel`, `netlify`, `gh-actions`).
- `<run-id>` is the platform-specific run identifier (e.g., Railway deployment ID, Vercel deployment URL, GitHub run number).
- `<stage-context>` is the spawning stage's short tag (e.g., `c2-deploy-and-verify`).
- The description holds a YAML payload (see § Wake-time MONITOR polling for the parser); this is the monitor carve-out per `claudomat-brain/db/SCHEMA.md` § structured-content carve-outs.
- `timeout_budget` is in seconds. Set to less than typical wave duration (~1800s = 30 min for most deploy scenarios) to avoid cross-wave archived-rollback (see C-2 § Action 4 § On-failure cleanup when MONITOR-task failure_condition later fires).
- `poll_log` is the path the orchestrator appends per-poll entries to during Pass 1 of wake-time polling.

---

## Monitor state machine

Parent wave STATUS contract: while the monitor is in flight (neither success nor failure), parent STATUS stays `IDLE` (or `RUNNING` if it was already running) — **never `BLOCKED`**. BLOCKED is reserved for "human action required, otherwise the loop is stuck" and is terminal until a human (or ceo-agent under degenerate, within charter) writes a new STATUS. A still-healthy in-flight deploy is not BLOCKED. Do NOT pair `ScheduleWakeup` with `STATUS=BLOCKED`.

On every poll tick, the monitor task runs (in order):

1. Run `success_condition`. If exit 0 → mark SUCCESS. If the parent wave's `process/session/status-check.yaml` STATUS is currently `IDLE` (parked waiting on this monitor), rewrite it to `STATUS=RUNNING`. If STATUS is `BLOCKED`, leave it untouched — only a human (or ceo-agent under charter) can un-block; log the success to the monitor poll log (`process/session/monitors/monitor-<task-id>.log`); recommend the founder grep these logs on un-block to find late resolutions (`tail -50 process/session/monitors/*.log | grep -E 'SUCCESS|FAILURE'`). Under automatic mode, the daily board-digest may also surface a "Monitor late resolutions" section if any monitors resolved while parent was BLOCKED in the prior digest window (best-effort — not all such resolutions are guaranteed to make the digest). Then let the human re-evaluate. DELETE the MONITOR row via `MONITOR — delete on resolution` recipe, end turn. Parent wave resumes on next tick if it was un-parked.
2. Run `failure_condition`. If exit 0 → mark FAILURE:
   - Capture platform diagnostic output (logs, error codes, dashboard URL) — see platform template for specifics.
   - INSERT a triage task via `Task — add`: title `TRIAGE: {platform} {failure-summary}`, description carries the diagnostic output.
   - Set parent wave STATUS=`BLOCKED` with `pause_evidence.trigger=d-hard-stop-verdict` and `pause_evidence.measurement` citing the triage task ID plus the monitor's `failure_condition` output. Human triage required.
   - Do NOT retry the monitor. DELETE the MONITOR row.
   - End turn. Do NOT `ScheduleWakeup` — BLOCKED is terminal-until-human. Next `/loop` tick sees BLOCKED → founder or `/investigate` picks up the triage.
3. Neither condition returned 0:
   - If elapsed < `timeout_budget` → append poll result to `process/session/monitors/monitor-<task-id>.log`, leave parent STATUS=`IDLE`/`RUNNING` (never BLOCKED — the deploy is still healthy), `ScheduleWakeup` per `poll_delay`, end turn.
   - If elapsed ≥ `timeout_budget` → mark TIMEOUT, set parent wave STATUS=`BLOCKED` with `pause_evidence.trigger=d-hard-stop-verdict` and `pause_evidence.measurement` citing the monitor path plus "monitor timeout on {platform}: neither success nor failure after {N}s", escalate to founder. Do NOT continue polling. Do NOT `ScheduleWakeup`. DELETE the MONITOR row.

**Anti-pattern:** `success_condition` matching can NEVER un-block `BLOCKED`. `BLOCKED` is terminal until a human (or ceo-agent under charter) rewrites STATUS. If the orchestrator finds parent STATUS=`BLOCKED` on monitor success, leave STATUS untouched — log the success to the monitor poll log (`process/session/monitors/monitor-<task-id>.log`); recommend the founder grep these logs on un-block to find late resolutions (`tail -50 process/session/monitors/*.log | grep -E 'SUCCESS|FAILURE'`). Under automatic mode, the daily board-digest may also surface a "Monitor late resolutions" section if any monitors resolved while parent was BLOCKED in the prior digest window (best-effort — not all such resolutions are guaranteed to make the digest). Then let the human re-evaluate. (Note: in multi-monitor scenarios a peer monitor's failure can leave the parent `BLOCKED` while other monitors remain pending. Their later success on subsequent polls must still leave `BLOCKED` untouched per the rule above — only a human (or ceo-agent under charter) writes STATUS out of `BLOCKED`.)

---

## Wake-time MONITOR polling (orchestrator contract)

On every tick under `mode: automatic` or `mode: degenerate`, **before** invoking the `Task — next claimable` recipe, the orchestrator MUST enumerate pending MONITOR rows and poll each. The orchestrator IS the runner — a `MONITOR:` task does not execute itself.

1. **Enumerate.** Run the `Task — pending MONITORs` recipe (`SELECT id, title, description FROM tasks WHERE status='recurring' AND title LIKE 'MONITOR:%' ORDER BY created_at;`). These are pending monitors.
2. **Pass 1 — poll all monitors first (do NOT end turn between polls).** For each pending MONITOR (in stable order, oldest first), parse its `description` YAML payload for `success_condition`, `failure_condition`, `timeout_budget`. Run `success_condition` then (if non-zero) `failure_condition`, then check elapsed-vs-`timeout_budget`. Capture one of {SUCCESS, FAILURE, TIMEOUT, still-pending} per monitor into an in-turn result list. Log each poll attempt to `process/session/monitors/monitor-<task-id>.log`. Do NOT mutate parent STATUS yet; do NOT DELETE MONITOR rows yet; do NOT end the turn.
3. **Pass 2 — resolve in aggregate after all polls captured:**

   **Pass 2 ordering — process FAILURE/TIMEOUT entries FIRST, then SUCCESS entries.** Rationale: a FAILURE in the same window forces parent STATUS=BLOCKED, after which the BLOCKED-untouched rule applies to SUCCESS entries (they DELETE their MONITOR row, log the success, but leave STATUS alone). Processing SUCCESS first would write a transient IDLE→RUNNING that FAILURE handling then overrides to BLOCKED — wasted write and confusing audit trail.

   Then, in order:
   - If ANY monitor captured FAILURE or TIMEOUT: write a combined `STATUS=BLOCKED` + `pause_evidence.trigger=d-hard-stop-verdict` to `process/session/status-check.yaml`; `pause_evidence.measurement` lists ALL failed monitors (paths + each one's `failure_condition` or timeout output) and ALL successes captured in the same window. DELETE the failed/timed-out MONITOR rows via `MONITOR — delete on resolution` (per the state machine's "do NOT retry"). End turn — do NOT `ScheduleWakeup`, do NOT invoke `Task — next claimable`.
     - **Before writing the combined `STATUS=BLOCKED`**, invoke each failing monitor's stage-specific cleanup procedure if one is defined. For C-2-spawned MONITORs, see `claudomat-brain/blocks/ci-cd/stages/C-2-deploy-and-verify.md` § Action 4 § On-failure cleanup when MONITOR-task failure_condition later fires. Stage cleanup typically rewrites the stage deliverable (e.g., `ci_stage_verdict: PASS` → `HOLD`), rolls back the wave checklist row, and updates block manifest status. Without this step the wave's deliverables retain stale `PASS` verdicts that contradict the BLOCKED state.
   - For each monitor captured SUCCESS: DELETE the MONITOR row. If parent STATUS is `IDLE` (parked waiting on this monitor), rewrite to `STATUS=RUNNING`. If parent STATUS is `BLOCKED`, leave it untouched — only a human (or ceo-agent under charter) can un-block (log the success to the monitor poll log (`process/session/monitors/monitor-<task-id>.log`); recommend the founder grep these logs on un-block to find late resolutions (`tail -50 process/session/monitors/*.log | grep -E 'SUCCESS|FAILURE'`). Under automatic mode, the daily board-digest may also surface a "Monitor late resolutions" section if any monitors resolved while parent was BLOCKED in the prior digest window (best-effort — not all such resolutions are guaranteed to make the digest)).
   - If no FAILURE/TIMEOUT captured but at least one monitor still pending: proceed to step 4.
4. **Invoke `Task — next claimable`** normally.
5. **End-of-tick:** if `Task — next claimable` returned empty AND at least one monitor is still pending → `STATUS: IDLE` + `ScheduleWakeup(1800s)`. The next wake will re-poll the monitors.
6. **End-of-tick:** if `Task — next claimable` returned empty AND NO monitors are pending AND backlog is truly empty → `STATUS: DONE`.

**Why two-pass:** if multiple monitors fail in the same wake window, the founder sees ALL failures in one `BLOCKED` state — not just the first one encountered. The naive first-failure-exits protocol would orphan peer monitors whose `timeout_budget` keeps counting wall-clock time while STATUS=`BLOCKED`, then surface them piecemeal across subsequent ticks after the human un-blocks. One snapshot, one digest, one triage pass.

**Anti-patterns:**

- Invoking `Task — next claimable` before polling monitors — the orchestrator may execute new work while a monitor's `failure_condition` is already true, masking a hard-stop.
- Writing `STATUS: BLOCKED` for a monitor that's merely pending (not yet failed) — this collapses the IDLE-vs-BLOCKED distinction that 0.32.0 specifically draws. Pending monitors keep the parent `IDLE` or `RUNNING`; only `failure_condition` matching writes `BLOCKED`.
- `success_condition` matching can NEVER un-block `BLOCKED`. `BLOCKED` is terminal until a human (or ceo-agent under charter) rewrites STATUS. If the orchestrator finds parent STATUS=`BLOCKED` on monitor success, leave STATUS untouched — log the success to the monitor poll log (`process/session/monitors/monitor-<task-id>.log`); recommend the founder grep these logs on un-block to find late resolutions (`tail -50 process/session/monitors/*.log | grep -E 'SUCCESS|FAILURE'`). Under automatic mode, the daily board-digest may also surface a "Monitor late resolutions" section if any monitors resolved while parent was BLOCKED in the prior digest window (best-effort — not all such resolutions are guaranteed to make the digest). Then let the human re-evaluate.
- Ending the turn on the first captured FAILURE without completing Pass 1 — orphans peer monitors whose `timeout_budget` continues counting wall-clock time while STATUS=`BLOCKED`.
- Skipping a monitor's stage-specific cleanup because a higher-priority pause trigger fired in the same turn. **Side-effects fire independently of precedence.** If trigger `e` (founder message) fires in the same turn as a monitor's `failure_condition` (trigger `d`), BOTH side-effect protocols execute — the orchestrator doesn't skip the C-2 cleanup (deliverable rewrite to HOLD, checklist rollback) just because `e` outranks `d` in `pause_evidence.trigger` labelling. Every trigger that fires MUST execute its full protocol; precedence only governs the cited label.

---

## Poll log

Every monitor poll MUST write one line to `process/session/monitors/monitor-<task-id>.log`:

```
{ISO-timestamp} | poll={N} | elapsed={seconds} | success_exit={code} | failure_exit={code} | head={first-line-of-stdout-from-failed-command}
```

When a monitor gets stuck, the log explains why. When the founder intervenes, they can see what was being checked at each tick. Feeds retro learning.

---

## Self-audit at 50% budget

At 50% of `timeout_budget` with no terminal condition reached, the monitor appends to the log:

```
{timestamp} | self-audit | neither success nor failure after {N} polls — check if either condition is wrong
```

Does NOT escalate yet — surfaces the anomaly early so the log shows a clear marker before the full timeout fires.

---

## Anti-patterns

| Never | Why |
|---|---|
| Omit `failure_condition`. | Monitor sits forever on a failed deploy. |
| Use `/healthz` as `success_condition` instead of the platform's deploy-state endpoint (Railway's GraphQL `deployments` query, `vercel inspect`, `gh run list`). | A health 200 can keep serving old code after the new deploy failed. |
| Omit a finite `timeout_budget`. | Infinite-wait monitors are how sessions die unnoticed and the loop ticks forever. |
| Retry on `failure_condition` exit 0. | Automatic retry of a failed deploy ships bad code or hides the same failure silently. |
| Check a commit-SHA match against HEAD instead of the platform's own state flag. | Platforms lag on reporting the shipped commit — the poll fires before propagation. (Exception: Netlify's `commit_ref` check; see `claudomat-brain/monitors/netlify-deploy.md`.) |

---

## Platform templates

Canonical templates per platform live in this directory. Copy and adjust project-specific values:

- `claudomat-brain/monitors/railway-deploy.md` — Railway deployments
- `claudomat-brain/monitors/gh-actions.md` — GitHub Actions workflow runs
- `claudomat-brain/monitors/netlify-deploy.md` — Netlify site deployments
- (add as encountered: `vercel-deploy.md`, `dns-propagation.md`, `stripe-activation.md`, `s3-bucket-provision.md`)

Adding a new platform: write a template with all three conditions verified against live output, list all terminal states the platform emits (classify each as success / failure / pending), then add to the list above. Do NOT invent conditions from memory — verify against a real `--json` output first.

---

## Referenced from

- `claudomat-brain/management/automatic-mode.md` § Anti-patterns (the mode-entry invocation rule)
- `claudomat-brain/blocks/ci-cd/stages/C-2-deploy-and-verify.md` (async-deploy path + post-deploy canary)
- `claudomat-brain/blocks/ci-cd/stages/C-1-pr-ci-merge.md` (CI run completion)
- `claudomat-brain/blocks/test/stages/T-5-e2e.md` (prod URL readiness)
- Any future stage that waits on an external event — add a cross-ref here when you add one
