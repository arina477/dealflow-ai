# Mode — Automatic

Unconditional wave-loop execution. BOARD decides every former user-ask except hard-stops. Founder reviews via morning digest but does not gate runtime.

## Flag

`process/session/.autonomous-session` with `mode: automatic`.

## Entry conditions

User phrases: "automatic" / "go completely autonomous" / "board mode" / "unconditional loop" / "don't stop for anything".

On activation, in a single turn and in order:

0. **Verify prerequisites:**
   - BOARD bench generated: all 7 board-member agents resolvable at `~/.claude/agents/`
   - `command-center/product/product-decisions.md` present + `founder_bets` table reachable (founder-proxy grounds in both)
   - `process/session/status-check.yaml` exists OR will be initialized in step 2
   - `process/session/.loop-paused.yaml` does NOT exist — if it does, mode entry fails fast and surfaces "Paused state from prior mode must be resolved (typically by removing the file after addressing `paused_reason`) before entering autonomous modes." Remediation: read the file's `paused_reason`, address it, then `rm process/session/.loop-paused.yaml` and retry mode entry.
   - **Stale MONITOR auto-cleanup.** On mode entry, sweep pending MONITOR rows via the `MONITOR — bulk cancel (mode-exit)` recipe in [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md):
     ```sql
     DELETE FROM tasks WHERE status='recurring' AND title LIKE 'MONITOR:%' RETURNING id, title;
     ```
     The RETURNING set is the deleted rows. If the DELETE errors (permission denied, DB unreachable), log a WARNING line per failure to `process/session/.exit-warnings.log` listing the failure. Surface the cleanup count in the mode-entry confirmation line (e.g., "Automatic ON. STATUS=<value>. ... Pending MONITORs cleaned at entry: <N>."). **Proceed with mode entry regardless** — cleanup is best-effort; the founder reviews `.exit-warnings.log` if surfaced. Founder direct-edit of `.autonomous-session` (per the secondary halt path in `ceo-blocklist.md` § Halting the loop) skips § Exit conditions' MONITOR cleanup; this entry auto-sweep is the recovery path. Also check `process/session/.exit-warnings.log` (from prior mode-exit deactivation failures) — if present, surface its contents in the confirmation line as well. Do NOT abort.

   Print results in one line. Fail fast on any miss → surface to founder.
1. Write the flag file:
   ```bash
   cat > process/session/.autonomous-session <<EOF
   started_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
   mode: automatic
   reason: <quote user's phrasing>
   expires_on: user-says-stop | orchestrator-finishes-all-work
   EOF
   ```
2. Initialize STATUS. If `process/session/status-check.yaml` is missing, write `STATUS: IDLE`. If present, preserve.
3. Launch the loop. Invoke `/loop` skill with the autonomous-dynamic sentinel. Founder does not run /loop manually.
4. Confirm in one line: `Automatic ON. STATUS=<value>. /loop started. BOARD handles non-hard-stop escalations. Morning digest at process/session/updates/board-digest-<YYYY-MM-DD>.md.`
5. End the turn.

## Behavior

### Wave execution

Run continuously within a turn. End the turn only when a real condition fires:

| Condition | Detection | Action |
|---|---|---|
| IDLE (no work right now) | `Task — next claimable` returns no row + checkpoint buckets empty | Set STATUS=IDLE (mirror), ScheduleWakeup ~1800s, end turn |
| BLOCKED (human action required) | Hard-stop class detected during execution; human must unblock before the loop can resume | Write `STATUS: BLOCKED` to `process/session/status-check.yaml` with `pause_evidence.trigger=<d-hard-stop-verdict \| e-founder-message \| f-loop-paused-yaml>` and `pause_evidence.measurement` populated with the reason. Pick the trigger letter that captures the proximate cause; see § Preemptive-pause prohibition for trigger semantics (and § Preemptive-pause prohibition § Multi-trigger precedence if multiple fire in the same turn). (Trigger `b` is for on-wake observation when another agent wrote STATUS — see § STATUS values — wake routing; the orchestrator does NOT self-cite `b` when authoring its own pause.) End turn without `ScheduleWakeup` — terminal until founder resumes via ESC + chat or by editing `process/session/status-check.yaml` directly. |
| DONE (backlog truly empty) | `Task — next claimable` returns no row + checkpoints empty + no MONITOR pending | Set STATUS=DONE (mirror), end without ScheduleWakeup |

No "ticks" under automatic — no ceremonial steps fire on a cadence. The orchestrator chains blocks P → D → B → C → T → V → L → N inside one turn until a condition above fires. STATUS is a write-only mirror for founder visibility, not a gating input.

### Chunking rule — when to ScheduleWakeup vs poll inside the turn

| Wait class | Action |
|---|---|
| Programmatic check resolvable in <10 min (CI run, fast-deploy probe, monitor poll, health endpoint) | Poll inside the turn via `Bash(run_in_background=true)` + Monitor + `until`-loop. Do NOT ScheduleWakeup. |
| Human-action wait >10 min (founder reply, code review, hard-stop verdict requiring founder) | Write `STATUS: BLOCKED` to `process/session/status-check.yaml` with `pause_evidence.trigger=<d-hard-stop-verdict \| e-founder-message \| f-loop-paused-yaml>` populated. Pick the trigger letter that captures the proximate cause; see § Preemptive-pause prohibition for trigger semantics (and § Preemptive-pause prohibition § Multi-trigger precedence if multiple fire in the same turn). (Trigger `b` is for on-wake observation when another agent wrote STATUS — see § STATUS values — wake routing; the orchestrator does NOT self-cite `b` when authoring its own pause.) Do NOT call `ScheduleWakeup` — BLOCKED is terminal until the founder unblocks via ESC + chat or by editing `status-check.yaml`. End turn. |
| External time-based wait >10 min (queued deploy, slow DNS, third-party provisioning) | INSERT a `MONITOR:` task row per `claudomat-brain/monitors/monitor-principles.md` (status='recurring', title 'MONITOR:%') with the YAML payload (`success_condition`, `failure_condition`, `timeout_budget`, `poll_delay`) in its `description`. Continue to next claimable task. If queue is empty → `STATUS: IDLE` + `ScheduleWakeup(1800s)`. Monitor `failure_condition` firing later → `STATUS: BLOCKED` (no `ScheduleWakeup`). |

Chunking active orchestrator work into multiple wakes is forbidden — discipline failure, not natural pause.

### Self-management decisions — never asked

- Commit granularity within an approved plan
- Execution sequencing within an approved plan
- Split-vs-push-through a B-2 / B-3 implementation

If you write "My preference: X" in any checkpoint, X is the decision — execute it. Do NOT emit the "but if you want Y" alternative tail.

### Preemptive-pause prohibition (always-on rule #13)

**The orchestrator MUST NOT pause unless ONE of these 4 measured triggers fires (b STATUS changed / d hard-stop verdict / e founder message / f .loop-paused.yaml):**

| Trigger | Evidence required |
|---|---|
| (b) status-check.yaml STATUS field changed | git-diff or read showing prior vs current STATUS value |
| (d) Stage-required hard-stop | gate-verdict path + verdict_source OR monitor-task path + declared `success_condition` / `failure_condition` / `timeout_budget` |
| (e) Founder message arrived | timestamp + content of the founder message in current conversation |
| (f) `.loop-paused.yaml` exists | path + contents |

**Multi-line `measurement` content** (founder message bodies, multi-monitor failure aggregation, BOARD vote summaries): use YAML literal block scalar (`measurement: |`) — inline-quoted strings break on embedded colons/newlines. Pattern:

```yaml
pause_evidence:
  trigger: e-founder-message
  measurement: |
    ts: 2026-05-14T13:42:00Z
    body: |
      Founder message text, exactly enough to justify the pause.
  cited_at: 2026-05-14T13:42:05Z
```

**Multi-trigger precedence.** If multiple triggers fire in the same turn, cite the highest-priority trigger in `pause_evidence.trigger` and list the additional triggers in `pause_evidence.measurement`. Priority order:

  **e** (founder message)  >  **d** (hard-stop verdict)  >  **f** (`.loop-paused.yaml`)  >  **b** (STATUS changed)

Rationale: founder signal is highest authority; hard-stop is stage-internal verdict; `.loop-paused.yaml` is an explicit file marker; STATUS change observation is the weakest signal (records what another agent already wrote).

**Side-effects fire independently of precedence.** Citing the highest-priority trigger is a labelling rule only — every trigger that fires in the turn MUST still execute its full side-effect protocol. If both `e` (founder message) and `d` (monitor failure / hard-stop verdict) fire, the orchestrator BOTH responds to the founder in chat AND executes the failing monitor's stage-specific cleanup (e.g., C-2 deliverable rewrite to HOLD, checklist rollback). Precedence determines what's named in the `pause_evidence.trigger` field; it doesn't shortcut the work.

**FORBIDDEN preemptive-pause patterns** (cite as violations during /retro at L-2):

- *"Pause point. Significant turn — P-block landed."* → forbidden; just continue to D-block or B-block.
- *"Big milestone reached — should I continue?"* → forbidden; the brain decides breaks (N-3), not the orchestrator.
- *"This seems like a natural break"* → forbidden.
- *"Significant work landed — pausing for review"* → forbidden; reviews happen at gate stages (B-6 / T-9 / V-3 / etc.), not mid-block.

**Rule of thumb:** can't fill in `pause_evidence` with a concrete trigger letter (b / d / e / f) + measurement → not allowed to pause. Continue the loop. Context overflow is handled transparently by Claude Code's harness auto-compact — not a reason to pause.

When STATUS=BLOCKED is written without `pause_evidence`, ceo-agent's stall-monitor detects the violation on next tick + escalates as a discipline finding to the next L-2 distill.

### Stop-guard enforcement (external)

Rule #13 is also enforced **externally** by the `autonomous-guard` Stop hook (`claudomat-brain/hooks/autonomous-guard.sh`, auto-wired into `~/.claude/settings.json` by `claudomat sync`). While `process/session/.autonomous-session` has `mode: automatic`, every Stop attempt that doesn't coincide with a halt signal is rejected with `{"decision":"block","reason":"..."}` — the orchestrator gets re-prompted with the rules-of-the-game text and must either continue the loop or first change the flag.

A block injection mid-turn is **expected behavior, not a bug**. It means the orchestrator tried to end without a measured pause trigger and the guard caught it. The **canonical 5 halt paths** in founder-primacy order:

1. **Founder ESC + chat message** in the Claude Code session — interrupts the turn at the harness level; the Stop hook does not fire on user interrupt (per Claude Code interactive-mode docs). This is the primary halt mechanism (hook-bypass path).
2. **Mode flag changed** in `process/session/.autonomous-session` — caught by the hook's mode-check at the top (exit 0 before reaching halt-signal evaluation). Change `mode:` to `founder-review`, switch to another mode, or delete the file (hook-bypass path).
3. **`STATUS=BLOCKED`** in `process/session/status-check.yaml` (human action required) — recognized by the hook's case-statement as a short-circuit signal.
4. **`STATUS=DONE`** in `process/session/status-check.yaml` (loop finished naturally) — recognized by the hook's case-statement as a short-circuit signal.
5. **`ceo-blocklist.md` empty/missing** (degenerate-only — under `mode: degenerate`, an empty charter terminates the loop) — recognized by the hook's case-statement as a short-circuit signal.

Paths 1-2 bypass the hook entirely (the hook never sees them) and end the turn before the guard fires. Paths 3-5 are the **3 short-circuit signals** the guard reads to allow the stop on the next Stop event.

### Founder message handling (turn-level interrupt)

The founder can interrupt the loop at any moment by pressing ESC in the Claude Code session and sending a chat message. ESC bypasses the Stop hook entirely (per Claude Code's interactive-mode docs); the orchestrator's current turn ends without the hook firing.

On the **next** turn under `mode: automatic`, if the conversation context carries a fresh founder message AND `process/session/status-check.yaml` STATUS is `RUNNING` or `IDLE` (i.e., not already terminal — not `BLOCKED` or `DONE`), the orchestrator MUST:

1. **Write `STATUS: BLOCKED`** with `pause_evidence.trigger=e-founder-message` to `status-check.yaml` (capture the message timestamp + first line of the founder message in `pause_evidence.measurement`). Under automatic, no per-decision email is sent — the BLOCKED state is the audit signal; the founder sees it in their next interactive session or the next morning's board-digest. (Under degenerate, ceo-agent handles the halt recording + email separately; see `claudomat-brain/management/degenerate-mode.md` § Founder message handling.)
2. **Respond to the founder's message in chat** (acknowledge the halt + the action they triggered).
3. **End the turn** — no `ScheduleWakeup` (BLOCKED is terminal until the founder unblocks).

Founder unblocks by editing `status-check.yaml` (typically writing `STATUS: RUNNING` to resume the wave, or `STATUS: DONE` if the work is complete) OR by switching modes via `.autonomous-session`. If the founder's message itself is a mode-change instruction ("pause" / "back to manual"), follow § Exit conditions instead.

### Interaction with `ScheduleWakeup`

When you reach a natural pause (IDLE — see § Wave execution), you write the relevant artifact (just update STATUS) and call `ScheduleWakeup` before ending the turn. (BLOCKED is terminal — no ScheduleWakeup. The founder resumes via ESC + chat or by editing `status-check.yaml` directly.) The autonomous-guard Stop hook fires and **re-prompts you with the rules-of-the-game text**. This is by design:

- Your `ScheduleWakeup` call is independent of the Stop hook — per Claude Code's hook contract (`Stop` events return a `decision` that re-prompts the current turn but does not affect future scheduled wake-ups), the wake-up will fire as scheduled regardless of the block injection. The block injection isn't cancelling the future wake-up; it's nudging you to keep working synchronously in the current turn.
- If you have more useful work you can do right now (sub-agents to spawn, files to review, prep work for the next wave), do it. The wake-up is a backstop, not a deadline.
- End the turn ONLY if `Task — next claimable` returns no row (write `STATUS: IDLE` + `ScheduleWakeup(1800s)`) OR a hard-stop fired (write `STATUS: BLOCKED` — no `ScheduleWakeup`; terminal until human intervention via ESC + chat or direct edit of `status-check.yaml`). Per-turn completion ("I've done what I planned this turn") is NOT by itself a reason to end the turn — continue to the next claimable task. Context overflow is handled by Claude Code's harness auto-compact. The two agent-side halt signals are `STATUS: BLOCKED` (when human action is required) and `STATUS: DONE` (when the backlog is truly empty).
- Do NOT mistakenly delete `process/session/.autonomous-session` just to escape the block — that exits autonomous mode entirely. Use it only when the founder is genuinely returning.

## Routing thresholds

| Escalation source | Previous behavior | Automatic behavior |
|---|---|---|
| P-0 Tier 3 product decision | Queue for daily-checkpoint | BOARD (6+/7 consensus required) |
| P-1 RESCOPE / unbreakable monolith | Escalate to user | BOARD (4+/7) |
| P-0 ceo-reviewer EXPAND_SCOPE_PROPOSAL | AskUserQuestion | BOARD (4+/7) |
| P-0 ceo-reviewer REDUCE_SCOPE_PROPOSAL (strategic) | AskUserQuestion | BOARD (4+/7) |
| P-0 ceo-reviewer RECONSIDER | AskUserQuestion | BOARD (4+/7) |
| P-0 conflicting problem-framer vs ceo-reviewer | Escalate to user | BOARD (4+/7) |
| D-2 / D-3 cap escalation (3rd iteration without convergence) | Escalate to user | BOARD (4+/7) |
| V-3 fast-fix retry-cap exhaustion | Escalate to user | BOARD (4+/7) |
| daily-checkpoint resolution (all three buckets) | Founder via AskUserQuestion | BOARD resolves; morning digest for founder |

Everything NOT in this table stays as-is (Tier 1 auto-decide, Tier 2 proceeds+logs, triage routing to specialists per `command-center/dev/triage-routing-table.md`).

### STATUS values — wake routing

STATUS is a one-way mirror; the orchestrator does not gate behavior on reading it. On wake, read `status-check.yaml` STATUS + `pause_evidence` and detect what to do from artifacts (`Task — next claimable`, `process/session/.last-wave-completed.yaml`, wave checklist); STATUS values describe what the file would say at each transition.

| STATUS value | When it's written | What the orchestrator does on wake |
|---|---|---|
| `RUNNING` | Active wave work in progress | (Should not see this on wake — RUNNING ends in IDLE, BLOCKED, or DONE.) Triage from git + `process/waves/wave-<N>/checklist.md`. |
| `IDLE` | task queue + checkpoints empty, may fill later | Run `Task — next claimable`. Row returned → start a wave. Else re-sleep. |
| `BLOCKED` | Human action required, otherwise the loop is stuck | **Should not be the wake state under normal operation** — BLOCKED is terminal until human intervention; no `ScheduleWakeup` is scheduled. **If observed on wake** (fresh session start, founder modified state asynchronously, scheduled wake from a prior tick before BLOCKED was written): check if the blocker is resolved. If yes, resume the wave per § Resume protocol below. If not, end the turn without `ScheduleWakeup` — `BLOCKED` is terminal. The autonomous-guard hook allows stop on this value. |
| `DONE` | Truly nothing to do, no MONITOR pending | Loop already ended. No wake. |

### Resume protocol

When the orchestrator wakes with `STATUS=BLOCKED` and finds the blocker resolved (founder edited `status-check.yaml`, the external dependency cleared, etc.), use this protocol to resume the wave.

**Resolve from `process/session/.loop-resume.yaml` (founder-reserved milestone-fork pause).** When the blocker was a `process/session/.loop-paused.yaml` pause and `process/session/.loop-resume.yaml` is now present, the founder has answered the paused decision in Studio and the worker (sole writer; brain is sole reader + deleter — the brain never writes this file) has recorded the structured choice. Do NOT re-derive the choice from chat — read the file and act on `choice.kind`:

```yaml
schema_version: 1
resolved_at: "<ISO8601>"
resolved_by: "founder"
decision_id: "<claudeSessionId>:paused"
choice:
  kind: "milestone" | "directive" | "drain-queue"
  milestone_id: "<uuid>" | null   # set when kind=milestone
  label: "<picked option label>" | null
  text: "<founder free-text directive>" | null   # set when kind=directive
```

| `choice.kind` | Action |
|---|---|
| `milestone` | Promote `choice.milestone_id` with N-1 Action 8a semantics: `UPDATE milestones SET status='in_progress' WHERE id = <milestone_id>`; append the decision-log entry per `roadmap-lifecycle.md` § State recording. |
| `drain-queue` | Run the P-0 walk over the unassigned queue (`roadmap-lifecycle.md` § The unassigned queue — "P-0 Frame of every subsequent wave walks the unassigned queue and assigns what it can"); open the next wave against that queue. |
| `directive` | Treat `choice.text` as a founder-direct instruction (the existing founder-direct / roadmap-planning path). |

Then: write `STATUS: RUNNING` to `process/session/status-check.yaml`, open the next wave via the standard N-3 Action 2 pre-create + P-0 Action 0a wave-row open, and in the SAME commit delete BOTH `process/session/.loop-paused.yaml` AND `process/session/.loop-resume.yaml` (the pause is resolved; leaving either behind would re-trigger the pause / re-consume the mailbox). This branch supersedes the generic "restart the BLOCKED stage from Action 1" rule below — the pause was at a wave boundary (N-3), not mid-stage, so there is no stage to restart.

**This step is idempotent — the worker may have pre-cleared the pause.** Per the worker-clears-pause contract (Studio's brain-worker, on a founder answer, writes `.loop-resume.yaml` AND removes `.loop-paused.yaml` AND flips `STATUS: RUNNING` *before* dispatching this resume turn; see `claudomat-brain/process/process-paths.md` § Named files), by the time you run, `process/session/.loop-paused.yaml` may already be gone and `STATUS` may already be `RUNNING`. Treat both as no-ops: deleting `.loop-paused.yaml` is best-effort (skip silently if absent — do NOT error or re-pause), and writing `STATUS: RUNNING` over an already-`RUNNING` value is a no-op. `.loop-resume.yaml` is the authoritative present signal that drives this branch — never gate the consume on `.loop-paused.yaml` still existing. Always delete `.loop-resume.yaml` at the end (and `.loop-paused.yaml` if still present).

**Resume protocol varies by stage.** C-2 is the only stage today with explicit on-unblock resume protocols (read its two § On-unblock resume sections — inline-poll failure resumes from the action after `last-completed-action` in the HOLD record; MONITOR-task failure restarts C-2 from Action 1 because the whole deploy is re-fired). For other stages, the orchestrator restarts the BLOCKED stage from its first Action — the stage's deliverable was not written (no HOLD recorded), so there is no resume-point to read.

**Side-effect risk on Action 1 restart** (V-3 fast-fix retries that may re-fire; B-6 review that re-runs review agents; D-2 decomposition that may re-scope work): when the orchestrator writes `STATUS: BLOCKED` for these stages, it MUST populate `pause_evidence.measurement` with an explicit `restart_will_re_run:` field naming the side-effects (e.g., "Restart-from-Action-1 will re-run V-3 fast-fix [cost: ~30K tokens + possible commit revert]"). The founder reads `pause_evidence.measurement` when un-blocking via `status-check.yaml` edit, sees the cost, and decides informedly. No BOARD/ceo-agent confirmation step is needed — the founder is the confirmation.

### Legacy STATUS values

If on wake the STATUS value is not listed above (e.g., `HANDOFF` inherited from claudomat <0.31), treat it as `RUNNING`: re-triage from `process/session/.last-wave-completed.yaml` + the active wave's `checklist.md` + `git log`, then write the appropriate current STATUS as your first action. The autonomous-guard hook never matched these legacy values as halt signals, so behavior is continuous across the upgrade.

Legacy `STATUS: BLOCKED-FOUNDER-STOP` and `STATUS: STOP` values are no longer enforced (removed in 0.32.0). If a brain mid-flight has either value, the orchestrator should rewrite it to `STATUS: BLOCKED` (if human action is still required) or `STATUS: DONE` (if work has completed). The autonomous-guard hook treats both legacy values like any other non-enumerated STATUS — it injects a block, the orchestrator self-corrects in its next response (within the same Stop-block re-prompt cycle, or at session start before the first Stop event fires — there's no scheduled wake for legacy STATUS values since they're not paired with `ScheduleWakeup`).

`WAVE_DONE` is NOT a valid STATUS value. Cross-wave transitions stay `RUNNING` — the orchestrator chains directly into wave N+1's `process/waves/wave-<N+1>/checklist.md`. The cross-wave handoff anchor is `process/session/.last-wave-completed.yaml` (written by `claudomat-brain/blocks/next/stages/N-3-handoff.md` § Action 5 — Final state emission); STATUS itself does not transition at wave boundaries.

STATUS=DONE only when `Task — next claimable` returns no row AND daily-checkpoint buckets are empty. Any pending executable task uses STATUS=IDLE instead.

## Hard-stops — always to founder

Even under automatic, these always prompt:

| Class | Examples |
|---|---|
| **Destructive actions** | force-push, DROP TABLE, `rm -rf`, `git reset --hard`, `kubectl delete`, branch deletion, uncommitted-work overwrites |
| **Money commitments** | new paid SaaS subscription, API tier upgrade with billing, domain purchase, anything with a credit-card hit |
| **Hard-stop member veto** | any BOARD member flags `HARD-STOP: must be human` with concrete reason |

When a hard-stop fires mid-turn:
1. Set STATUS=BLOCKED.
2. Surface escalation to founder with all context needed to decide.
3. End the turn without ScheduleWakeup — BLOCKED is terminal until the founder unblocks via ESC + chat or by editing `process/session/status-check.yaml` directly.

## BOARD-decidable under automatic

- Identity commitments (account creation on third-party providers)
- Legal text approvals (ToS copy, privacy text edits)
- External communications (emails drafted to real users, Slack posts, OSS PR descriptions)
- Vendor selection calls where `command-center/product/product-decisions.md` precedent exists

## Anti-patterns

| # | Never |
|---|---|
| 1 | End a turn because an external event is pending. ("Best run in a fresh session" is a banned phrase.) |
| 2 | Create a MONITOR task with only a success condition. Both `success_condition`, `failure_condition`, `timeout_budget` required (see `claudomat-brain/monitors/monitor-principles.md`). |
| 3 | Check `/healthz` as the deploy success signal. A 200 can be served by old code; check the platform's deploy-state endpoint. |
| 4 | Ask the founder "continue or fresh session?" — not a valid question; Claude Code's harness auto-compacts context transparently. |
| 5 | Convene BOARD for self-management decisions (session management, loop cadence, commit granularity, execution sequencing). Resolve by rule. |

## Exit conditions

User triggers: "I'm back" / "pause" / "stop the autonomous run" / "exit automatic" / "switch to default" / "switch to degenerate".

Step ordering matters: MONITOR cleanup runs **before** the flag-file rewrite so that an interruption between steps does not leave the mode flag in the target state while MONITORs remain unleaned.

1. **Pending MONITOR cleanup.** Before flipping the flag, sweep pending MONITOR rows via the `MONITOR — bulk cancel (mode-exit)` recipe in [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md):

   ```sql
   DELETE FROM tasks
   WHERE status='recurring' AND title LIKE 'MONITOR:%'
   RETURNING id, title;
   ```

   Single statement; no enumerate-then-delete loop. The RETURNING set is the deleted rows — the cleanest semantic. The mode-exit timestamp and target mode are already captured in `process/session/.autonomous-session` (rewritten in step 2) and in the eventual deactivation digest; per-monitor cancel-reason metadata is not preserved and is not needed for audit. Do NOT attempt to resolve monitors via `success_condition` at exit time — the founder will re-evaluate on next mode entry. This prevents stale monitors from firing against aged-out external state.

   If the DB is unreachable (psql connection error, permission denied), log a WARNING line to `process/session/.exit-warnings.log` listing the failure and the SQL that was attempted, and surface a chat message to the founder. The founder cleans up the stale entries manually on next mode entry. Do NOT block mode exit on cleanup failure.

   The mode-exit context written to the flag file uses the templated `<target-mode>` (`founder-review`, `default`, `degenerate` per step 2), not a hardcoded value.
2. Update the flag file. Three valid paths:
   - **Back to founder-review** ("I'm back" / "pause" / "exit automatic"): either delete the file (`rm process/session/.autonomous-session`) OR rewrite it with `mode: founder-review` per the schema in `mode-switching.md` § Flag. Both are equivalent — see `mode-switching.md:19`.
   - **Switch to default** ("switch to default"): rewrite the entire flag file with `mode: default` using the bash block in `default-mode.md` § Entry conditions (don't just patch the `mode:` line — reset `started_at` and update `reason`).
   - **Switch to degenerate** ("switch to degenerate"): verify prerequisites per `degenerate-mode.md` § 1, then rewrite the entire flag file using the bash block in `degenerate-mode.md` § Entry conditions and run the remaining activation steps (ceo-agent spawn probe + activation email + confirm).
3. Do NOT modify `process/session/status-check.yaml` — reflects wave state, persists across modes.
4. Exit the /loop: do NOT call ScheduleWakeup.
5. Confirm in one line: `Automatic ended. STATUS=<value>. Next escalation goes to you.`

The autonomous-guard Stop hook (`claudomat-brain/hooks/autonomous-guard.sh`) will not allow the next Stop until step 2 lands — the file is the contract. Confirmation text alone does not exit autonomous mode.

**Halt signals:**
1. Founder ESC + chat message in the Claude Code session — primary halt mechanism; bypasses the Stop hook at the harness level.
2. Mode flag changed in `process/session/.autonomous-session` — change `mode:` to `founder-review`, switch to another mode, or delete the file.
3. `STATUS=BLOCKED` in `process/session/status-check.yaml` — human action required (terminal-until-human; no `ScheduleWakeup`).
4. `STATUS=DONE` in `process/session/status-check.yaml` — loop finished naturally.
5. (Degenerate-only: empty `ceo-blocklist.md` — does not apply under `mode: automatic`.)

## Onboarding carve-out

BOARD is OFF during onboarding (`claudomat-brain/onboarding/onboarding-loop.md`) regardless of mode. Automatic activates only after onboarding handoff.

## Audit — morning digest

`process/session/updates/board-digest-<YYYY-MM-DD>.md`:

```markdown
# BOARD digest — <date>

## Clean decisions (N) — 5+/7 or cleaner
| decision-slug | outcome | wave |

## Close splits (N) — 4+/7 with dissent
| decision-slug | outcome | dissent note | wave |

## Vetoes & escalations routed back to founder (N)
| decision-slug | reason | where paused |

## Summary
- Total decisions: N | Clean: N | Close: N | Escalated: N
- Waves completed: N
- Approvals pending founder review: N
```

Founder can stop the session and manually override any decision → see `board-process.md` § Rollback.

## Latency + cost

BOARD convening: ~1-2 min + ~40-50K tokens per decision (7 parallel agents, ~5-8K tokens each). A wave with 2 BOARD convenings adds ~3-4 min + ~80-100K tokens over baseline.

## Precedence

1. Flag file wins over wave-plan front-matter. `autonomous_mode` field is deprecated.
2. Hard-stops always prompt regardless of flag.
3. Founder message at any time → orchestrator responds immediately, regardless of mode or STATUS.
4. STATUS is deterministic, never a question. Context overflow is handled by the harness — never a decision the orchestrator asks about.
5. Critical errors still escalate per `command-center/dev/triage-routing-table.md` — if `ultrathink-debugger` also fails after BOARD-approved fix attempts, the issue surfaces in the digest for founder attention.
