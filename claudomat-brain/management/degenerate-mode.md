# Mode — Degenerate

Unconditional wave-loop execution. ceo-agent resolves BOARD splits, deadlocks, HARD-STOP vetoes, and would-be founder-asks. Founder is reached only via session message (ESC + chat) or per-decision email. Intended for indefinite (365-day) operation.

Extends `automatic`: everything `automatic` does, `degenerate` does. Addition: founder-asks route to ceo-agent, not founder.

**Hard prerequisite:** `command-center/management/ceo-blocklist.md` exists (charter — seeded from `claudomat-brain/management/ceo-blocklist.md` template at `claudomat init`). Silent charter = unlimited ceo-agent authority. Review before activating.

## Flag

`process/session/.autonomous-session` with `mode: degenerate`.

## Entry conditions

User phrases: "degenerate" / "degenerate mode" / "ship it mode" / "ceo mode" / "ceo-agent mode" / "run indefinitely" / "365 mode" / "full delegation" / "total autonomy".

Activation sequence (single turn, in order — do NOT begin wave execution this turn):

### 1. Verify prerequisites

All must hold. Any fail → abort + surface to founder:

- [ ] `command-center/management/ceo-blocklist.md` exists and is non-empty
- [ ] `command-center/management/ceo-blocklist.md` § "Mode activation prerequisites" all boxes checkable
- [ ] AgentMail CLI installed: `agentmail --version` returns 0.7.x or higher
- [ ] `AGENTMAIL_API_KEY` env var set and valid: `agentmail --format json inboxes list` returns a JSON array
- [ ] Custom domain verified at AgentMail (see `claudomat-brain/setup-tools/install.md` § AgentMail setup)
- [ ] `CEO_INBOX_ID` env var set: `agentmail --format json inboxes get --inbox-id "$CEO_INBOX_ID"` returns the inbox object
- [ ] `CEO_NOTIFY_EMAIL_TO` env var set
- [ ] `process/session/` directory exists and is writable
- [ ] `process/session/.loop-paused.yaml` does NOT exist — if it does, mode entry fails fast and surfaces "Paused state from prior mode must be resolved (typically by removing the file after addressing `paused_reason`) before entering autonomous modes." Remediation: read the file's `paused_reason`, address it, then `rm process/session/.loop-paused.yaml` and retry mode entry.
- [ ] **Stale MONITOR auto-cleanup.** On mode entry, sweep pending MONITOR rows via the `MONITOR — bulk cancel (mode-exit)` recipe in [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md):
      ```sql
      DELETE FROM tasks WHERE status='recurring' AND title LIKE 'MONITOR:%' RETURNING id, title;
      ```
      The RETURNING set is the deleted rows. If the DELETE errors (permission denied, DB unreachable), log a WARNING line per failure to `process/session/.exit-warnings.log` listing the failure. Surface the cleanup count in the mode-entry confirmation line (e.g., "Degenerate ON. STATUS=<value>. ... Pending MONITORs cleaned at entry: <N>."). **Proceed with mode entry regardless** — cleanup is best-effort; the founder reviews `.exit-warnings.log` if surfaced. Founder direct-edit of `.autonomous-session` (per the secondary halt path in `ceo-blocklist.md` § Halting the loop) skips § Exit conditions' MONITOR cleanup; this entry auto-sweep is the recovery path. Also check `process/session/.exit-warnings.log` (from prior mode-exit deactivation failures) — if present, surface its contents in the confirmation line as well. Do NOT abort.
- [ ] `~/.claude/agents/ceo-agent.md` exists
- [ ] BOARD composition intact (all 7 member agents resolvable per `board-members.md`)
- [ ] ceo-agent spawn probe: `Agent(subagent_type=ceo-agent)` with `--probe` returns within 60s + writes a probe entry to `process/session/updates/ceo-digest-<YYYY-MM-DD>.md`

Print results in one table. Fail fast on any miss.

### 2. Write the flag file

```bash
cat > process/session/.autonomous-session <<EOF
started_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
mode: degenerate
reason: <quote user's phrasing>
charter: command-center/management/ceo-blocklist.md
notify_to: $CEO_NOTIFY_EMAIL_TO
expires_on: founder-message | explicit-exit
EOF
```

### 3. Initialize STATUS

If `process/session/status-check.yaml` is missing, write `STATUS: IDLE`. If present, preserve.

### 4. Send activation notice via AgentMail

From `$CEO_INBOX_ID` to `$CEO_NOTIFY_EMAIL_TO` using the activation template in `communication/ceo-communication-rules.md`.

### 5. Launch the loop

Invoke `/loop` skill with the autonomous-dynamic sentinel.

### 6. Confirm in one line

`Degenerate ON. STATUS=<value>. ceo-agent resolving BOARD escalations + founder-asks within ceo-blocklist.md. Per-decision email → <CEO_NOTIFY_EMAIL_TO>. Halt: press ESC + send a chat message, or edit process/session/.autonomous-session.`

### 7. End the turn

## Behavior

### Tick behavior — every /loop tick

Step ordering is authoritative. Steps 0-8:

0. **ceo-agent stall check.** Spawn `Agent(subagent_type=ceo-agent)` with `stall-monitor` directive. Orchestrator role-play forbidden. Audit MUST record agent run ID. Lazy-load contract: ceo-agent reads ONLY `process/session/status-check.yaml` first. Gates on STATUS unchanged since `last_ceo_check_saw_status` AND `(now - last_modified_at) >= 600s`. Either false → update fields, return `pass`, exit (~10K tokens). Both true → escalate, read full doctrine, execute stall-nudge (~75K tokens).
1. **Founder-message check.** Any founder message since last tick → invoke § Founder message handling protocol (below).
2. **Inbox check.** `agentmail inboxes:threads list --inbox-id "$CEO_INBOX_ID" --label unread --format json`. For each unread thread: fetch, classify (APPROVE / REJECT / MODIFY / CLARIFY / AMBIGUOUS), execute, mark read. AMBIGUOUS → send CLARIFY reply, leave unread. Skip threads with subject prefix `⚠ BET PROPOSAL` (handled at `roadmap-planning-ritual.md` Step 1d).
3. **Read charter.** Re-read `command-center/management/ceo-blocklist.md`. Modified since last tick → respect new restrictions immediately.
4. **Route by STATUS value** (table below).
5. **Execute routed action** until natural pause. **Natural pause** = STATUS becomes IDLE / BLOCKED / DONE, OR human-action wait >10 min (founder reply, code review, hard-stop verdict). External time-based waits >10 min are NOT pauses — they spawn a MONITOR-task + IDLE (see § Routing thresholds + `claudomat-brain/monitors/monitor-principles.md`). Programmatic checks <10 min (CI, fast-deploy, monitor poll) are NOT pauses — poll inside the turn via `Bash(run_in_background=true)` + Monitor + `until` loop. Chunking active orchestrator work into multiple ticks is forbidden. Context overflow is handled transparently by Claude Code's harness auto-compact — not a tick-end condition.
6. **Update STATUS before ending turn.** STATUS changed → also update `process/session/status-check.yaml`.
7. **Call ScheduleWakeup** with delay per STATUS table when STATUS=IDLE (no other reason to schedule a wake). No ScheduleWakeup when any halt signal applies:
   - **Founder ESC + chat message** in the Claude Code session (bypasses Stop hook; interrupts the turn).
   - **Mode flag changed** in `process/session/.autonomous-session`.
   - **`STATUS=BLOCKED`** (human action required — terminal until human intervention; no ScheduleWakeup).
   - **`STATUS=DONE`** (loop finished naturally).
   - **`ceo-blocklist.md` empty/missing** (degenerate-only).
8. **Per-decision notification.** After every ceo-agent decision, send a fresh email (new thread). One email per decision. Capture `thread_id` to audit. Templates: `communication/ceo-communication-rules.md`.

Reply-handling (step 2) runs before routing (step 4) so founder replies precede new escalations.

### Tick prompt — exact text

When orchestrator calls `ScheduleWakeup` under `degenerate`, pass verbatim. Substitute `<value>` and `<N>`.

```
Tick under degenerate. STATUS=<value>, wave=<N>.

1. First tool call MUST be Agent(subagent_type=ceo-agent) with directive "stall-monitor". Orchestrator role-play forbidden.
2. After ceo-agent returns, route per claudomat-brain/management/degenerate-mode.md § Tick behavior steps 1-8.
3. Continue working in this turn until: IDLE, BLOCKED, or DONE. (BLOCKED means human action required; former-founder-asks route to ceo-agent first, so this is rare.)
   Programmatic waits <10 min → poll inside the turn via Bash(run_in_background=true) + Monitor + until-loop. Do NOT ScheduleWakeup.
   Human / external waits >10 min → INSERT a MONITOR: task row (status='recurring', title 'MONITOR:%') with the YAML payload (success_condition / failure_condition / timeout_budget / poll_delay) in its `description` per claudomat-brain/monitors/monitor-principles.md; continue to next task. If queue is empty → STATUS=IDLE + ScheduleWakeup(1800s). Monitor failure_condition firing later → STATUS=BLOCKED (no ScheduleWakeup — terminal until human triage).
```

## Routing thresholds

### STATUS routing table

| STATUS value | What you MUST do | Next tick delay |
|---|---|---|
| `RUNNING` | Recover from last commit SHA + `process/session/.last-wave-completed.yaml` + wave checklist. | 60s |
| `IDLE` | Step 0 (stall monitor) + step 2 (inbox check) first. Then `Task — next claimable`. Begin if a row is returned; else re-sleep. | 60s |
| `BLOCKED` | **Should not be the wake state under normal operation** — BLOCKED is terminal until human intervention; no `ScheduleWakeup` is scheduled. **If observed on wake** (fresh session start, founder modified state asynchronously, scheduled wake from a prior tick before BLOCKED was written): check if the blocker is resolved. If yes, resume the wave per § Resume protocol below. If not, end the turn without `ScheduleWakeup` — `BLOCKED` is terminal until the founder unblocks via ESC + chat or by editing `process/session/status-check.yaml` directly. The autonomous-guard hook allows stop on this value. | — |
| `DONE` | End loop. No wakeup. | — |

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

**Under degenerate, charter restriction interaction:** if the side-effect touches a charter restriction (typically § 4 Strategic actions for D-3 design-gap 3-cap or fast-fix retry-cap exhaustion), the standard charter-amendment-proposal protocol applies: ceo-agent writes the proposal to `process/session/updates/ceo-charter-proposals.md`, emails `⚠ CHARTER PROPOSAL` per `communication/ceo-communication-rules.md` § Charter amendment proposal, leaves STATUS=BLOCKED. Founder amends the charter (or declines) before un-blocking.

### Legacy STATUS values

If on wake the STATUS value is not listed above (e.g., `HANDOFF` inherited from claudomat <0.31), treat it as `RUNNING`: re-triage from `process/session/.last-wave-completed.yaml` + the active wave's `checklist.md` + `git log`, then write the appropriate current STATUS as your first action. The autonomous-guard hook never matched these legacy values as halt signals, so behavior is continuous across the upgrade.

Legacy `STATUS: BLOCKED-FOUNDER-STOP` and `STATUS: STOP` values are no longer enforced (removed in 0.32.0). If a brain mid-flight has either value, the orchestrator should rewrite it to `STATUS: BLOCKED` (if human action is still required) or `STATUS: DONE` (if work has completed). The autonomous-guard hook treats both legacy values like any other non-enumerated STATUS — it injects a block, the orchestrator self-corrects in its next response (within the same Stop-block re-prompt cycle, or at session start before the first Stop event fires — there's no scheduled wake for legacy STATUS values since they're not paired with `ScheduleWakeup`).

All states tick at 60s. CEO stall-detection threshold remains 600s.

### Escalation routing table

| Escalation source | Automatic behavior | Degenerate behavior |
|---|---|---|
| BOARD split (<4+/7) | Founder | **ceo-agent** |
| BOARD Tier 3 strict <6+/7 | Founder | **ceo-agent** |
| BOARD member HARD-STOP veto | Founder | **ceo-agent (weighs veto, records)** |
| P-0 Tier 3 product decision | BOARD (6+/7) → founder if split | BOARD (6+/7) → **ceo-agent if split** |
| P-0 conflicting framer vs ceo-reviewer | BOARD (4+/7) → founder if split | BOARD → **ceo-agent if split** |
| P-1 unbreakable monolith | BOARD (4+/7) → founder if split | BOARD → **ceo-agent if split** |
| D-2 / D-3 design-gap 3-cap | BOARD (4+/7) → founder if split | BOARD → **ceo-agent if split** |
| V-3 fast-fix retry-cap exhaustion | BOARD (4+/7) → founder if split | BOARD → **ceo-agent if split** |
| daily-checkpoint buckets | BOARD; splits to founder | BOARD → **ceo-agent if split or HARD-STOP** |
| roadmap-planning-ritual founder-approval steps | Founder | **ceo-agent** |
| milestone-decomposition-ritual escalations (validation-failed, incomplete-scope) | Founder | **ceo-agent** |
| N-1 hard-stop branch (destructive / money / veto) | Founder | **ceo-agent (unless ceo-blocklist.md restricts)** |
| Build-stage execution errors beyond triage | Founder | BOARD → **ceo-agent if split** |

Not Obs-editable. The table is the contract.

## Charter semantics

`command-center/management/ceo-blocklist.md` is restriction-only:
- **Silent clause** = ceo-agent has authority.
- **Restrictive clause** = ceo-agent cannot act against it; writes amendment proposal + waits for founder.

**Charter-restriction-bump protocol** (the ONE exception to act-first):

1. ceo-agent identifies a restriction block.
2. Writes entry to `process/session/updates/ceo-charter-proposals.md`:
   ```
   ### <timestamp> | <decision slug>
   Requested decision: <summary>
   Blocked by: ceo-blocklist.md § X — "<exact restriction text>"
   Proposed amendment: <specific text change>
   Rationale: <why the amendment is worth making>
   If amended, CEO would: <what the decision would be>
   ```
3. Emails founder with subject prefix `⚠ CHARTER PROPOSAL`. Decision does not execute.
4. Founder edits `ceo-blocklist.md` (effective next mode entry; CEO retries next tick) OR sends a session message overriding one-off.

## Anti-patterns

| # | Never |
|---|---|
| 1 | End a turn because an external event is pending. (Spawn-and-Block or short-wait in-loop are the only valid paths.) |
| 2 | Let ceo-agent amend `ceo-blocklist.md` directly. Charter is founder-owned. |
| 3 | Let ceo-agent halt the loop. Halting is founder-only via ESC + chat or direct edit of `.autonomous-session` / `status-check.yaml`. |
| 4 | Activate degenerate during onboarding. Onboarding always runs founder-review. |
| 5 | Act on AMBIGUOUS founder replies. Leave `unread` and send CLARIFY. |

## Hard invariants (not charter-editable)

These apply regardless of `ceo-blocklist.md` contents:

- ceo-agent cannot amend `ceo-blocklist.md`.
- ceo-agent cannot INSERT into `founder_bets` without `APPROVE` reply (see `communication/ceo-communication-rules.md` § Bet proposal reply classification). INSERTed rows MUST cite the approving thread_id inline in the bet's `description` prose (audit footer). Apply step happens only at `claudomat-brain/ROADMAP/roadmap-planning-ritual.md` Step 1d.
- ceo-agent cannot halt the loop.
- **ceo-agent cannot initiate halt-loop decisions on its own.** Recordings of existing discipline violations ARE permitted: the stall-monitor's write of `STATUS=BLOCKED` on a Rule #13 violation surfaces a halt the orchestrator already committed by leaving STATUS in non-RUNNING/IDLE/DONE without `pause_evidence` — this is a recording of an existing failure, not a new halt decision. The founder (via ESC + chat or direct file edit) and the orchestrator (writing BLOCKED with valid `pause_evidence` per Rule #13) are the only initiators of new halts.
- ceo-agent cannot run during onboarding.
- ceo-agent cannot write to project state for tools not in § Tool allowlist.
- ceo-agent cannot run the wave loop. Orchestrator owns blocks P → N.
- ceo-agent writes to STATUS only via (a) stall-nudge (when stall-monitor escalates) or (b) the `halt` directive (recording a founder-initiated halt post-ESC + chat). Both are reactive — ceo-agent never initiates a halt or status change on its own.

## Preemptive-pause prohibition (always-on rule #13)

Per `automatic-mode.md` § Preemptive-pause prohibition. Applies verbatim. Pause only on the 4 measured triggers (b STATUS changed / d hard-stop verdict / e founder message / f .loop-paused.yaml). Context overflow is handled transparently by Claude Code's harness auto-compact and is NOT a pause trigger.

**Multi-trigger precedence.** If multiple triggers fire in the same turn, cite the highest-priority trigger in `pause_evidence.trigger` and list the additional triggers in `pause_evidence.measurement`. Priority order:

  **e** (founder message)  >  **d** (hard-stop verdict)  >  **f** (`.loop-paused.yaml`)  >  **b** (STATUS changed)

Rationale: founder signal is highest authority; hard-stop is stage-internal verdict; `.loop-paused.yaml` is an explicit file marker; STATUS change observation is the weakest signal (records what another agent already wrote).

**Side-effects fire independently of precedence.** Citing the highest-priority trigger is a labelling rule only — every trigger that fires in the turn MUST still execute its full side-effect protocol. If both `e` (founder message) and `d` (monitor failure / hard-stop verdict) fire, the orchestrator BOTH responds to the founder in chat AND executes the failing monitor's stage-specific cleanup (e.g., C-2 deliverable rewrite to HOLD, checklist rollback). Precedence determines what's named in the `pause_evidence.trigger` field; it doesn't shortcut the work.

Under `degenerate`, ceo-agent's stall-monitor (Tick step 0) catches violations. STATUS non-RUNNING/IDLE/DONE without `pause_evidence` populated → discipline finding via per-decision email + `process/session/updates/ceo-digest-<DATE>.md`. Surfaces at next L-2 distill touching review.

Any pause artifact (`status-check.yaml` STATUS update) MUST include `pause_evidence` field with the measured trigger. Empty → violation.

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

**Founder direct-edit exemption.** When the founder uses the tertiary halt path (direct edit of `status-check.yaml` to write `STATUS: BLOCKED` or `STATUS: DONE` without going through the orchestrator), the stall-monitor's "empty `pause_evidence`" violation check is **skipped**. Detection: if no agent run ID is associated with the prior tick that wrote STATUS, treat as a founder-direct-write (the orchestrator and ceo-agent both record their writes via the audit log; an unsourced STATUS change is a founder-write). Founder-writes don't generate discipline findings — they're authoritative, not preemptive pauses.

### Stop-guard enforcement (external)

In addition to the ceo-agent stall-monitor (reactive — catches violations on the *next* tick), the `autonomous-guard` Stop hook (`claudomat-brain/hooks/autonomous-guard.sh`, auto-wired into `~/.claude/settings.json` by `claudomat sync`) enforces rule #13 **preemptively** at the Stop event itself. While `mode: degenerate` is set, every Stop attempt that doesn't coincide with a halt signal is rejected with `{"decision":"block","reason":"..."}` and the orchestrator gets re-prompted with the rules of the game.

A block injection mid-turn is **expected behavior, not a bug**. The **canonical 5 halt paths** in founder-primacy order:

1. **Founder ESC + chat message** in the Claude Code session — interrupts the turn at the harness level. The Stop hook does not fire on user interrupt per Claude Code's interactive-mode docs. Primary halt mechanism (hook-bypass path).
2. **Mode flag changed** in `process/session/.autonomous-session` — caught by the hook's mode-check at the top (exit 0 before halt-signal evaluation). Change `mode:` to `founder-review`, switch to another mode, or delete the file (hook-bypass path).
3. **`STATUS=BLOCKED`** in `process/session/status-check.yaml` (human action required) — recognized by the hook's case-statement as a short-circuit signal.
4. **`STATUS=DONE`** in `process/session/status-check.yaml` (loop finished naturally) — recognized by the hook's case-statement as a short-circuit signal.
5. **Empty `ceo-blocklist.md`** (degenerate-only; the orchestrator refuses to run without a charter) — recognized by the hook's case-statement as a short-circuit signal.

Paths 1-2 bypass the hook entirely (the hook never sees them). Paths 3-5 are the **3 short-circuit signals** the guard reads to allow the stop directly. (See also § Exit conditions for the full Halt signals enumeration.)

### Founder message handling (turn-level interrupt)

The founder can interrupt the loop at any moment by pressing ESC in the Claude Code session and sending a chat message. ESC bypasses the Stop hook entirely (per Claude Code's interactive-mode docs); the orchestrator's current turn ends without the hook firing. This complements the per-tick founder-message check (§ Tick behavior step 1) by covering the turn-level interrupt path. Both paths invoke the SAME protocol below.

On the **next** turn under `mode: degenerate`, if the conversation context carries a fresh founder message AND `process/session/status-check.yaml` STATUS is `RUNNING` or `IDLE` (i.e., not already terminal — not `BLOCKED` or `DONE`), the orchestrator MUST:

1. **Delegate the halt recording to ceo-agent.** Spawn `Agent(subagent_type=ceo-agent, directive=halt)`. ceo-agent writes `STATUS: BLOCKED` with `pause_evidence.trigger=e-founder-message` + `pause_evidence.measurement` (founder message body + receipt timestamp) to `status-check.yaml`, then sends the halt email per `communication/ceo-communication-rules.md` § Halt email (cause=founder-message). This is the ONLY path under degenerate where ceo-agent recording is meaningful.
2. **Respond to the founder's message in chat** (acknowledge the halt + the action they triggered).
3. **End the turn** — no `ScheduleWakeup` (BLOCKED is terminal until the founder unblocks via further chat or by editing `status-check.yaml`).

Founder unblocks by editing `status-check.yaml` (typically writing `STATUS: RUNNING` to resume the wave, or `STATUS: DONE` if the work is complete) OR by switching modes via `.autonomous-session`. If the founder's message itself is a mode-change instruction ("pause" / "exit ceo mode" / "back to manual"), follow § Exit conditions instead.

### Interaction with `ScheduleWakeup`

When you reach a natural pause (IDLE — see § Tick behavior), you write the relevant artifact (just update STATUS) and call `ScheduleWakeup` before ending the turn. (BLOCKED is terminal — no ScheduleWakeup. The founder resumes via ESC + chat or by editing `status-check.yaml` directly.) The autonomous-guard Stop hook fires and **re-prompts you with the rules-of-the-game text**. This is by design:

- Your `ScheduleWakeup` call is independent of the Stop hook — per Claude Code's hook contract (`Stop` events return a `decision` that re-prompts the current turn but does not affect future scheduled wake-ups), the wake-up will fire as scheduled regardless of the block injection. The block injection isn't cancelling the future wake-up; it's nudging you to keep working synchronously in the current turn.
- If you have more useful work you can do right now (sub-agents to spawn, ceo-agent escalations to draft, files to review, prep work for the next wave), do it. The wake-up is a backstop, not a deadline. Under degenerate, "awaiting founder" is NOT a halt — former-founder-asks route to ceo-agent.
- End the turn ONLY if `Task — next claimable` returns no row (write `STATUS: IDLE` + `ScheduleWakeup(1800s)`) OR a hard-stop fired (write `STATUS: BLOCKED` — no `ScheduleWakeup`; terminal until human intervention via ESC + chat or direct edit of `status-check.yaml`). Per-turn completion ("I've done what I planned this turn") is NOT by itself a reason to end the turn — continue to the next claimable task. Context overflow is handled by Claude Code's harness auto-compact. The two agent-side halt signals are `STATUS: BLOCKED` (human action required) and `STATUS: DONE` (backlog truly empty).
- Do NOT mistakenly delete `process/session/.autonomous-session` just to escape the block — that exits degenerate entirely and skips the deactivation digest email. Use it only when the founder is genuinely returning.

## Exit conditions

User triggers: "stop degenerate" / "exit ceo mode" / "back to manual" / "pause" / "I'm back" / ESC + any session message.

Step ordering matters: MONITOR cleanup runs **before** the flag-file rewrite so that an interruption between steps does not leave the mode flag in the target state while MONITORs remain unleaned.

1. **Pending MONITOR cleanup.** Before flipping the flag, sweep pending MONITOR rows via the `MONITOR — bulk cancel (mode-exit)` recipe in [`claudomat-brain/db/SCHEMA.md`](../db/SCHEMA.md):

   ```sql
   DELETE FROM tasks
   WHERE status='recurring' AND title LIKE 'MONITOR:%'
   RETURNING id, title;
   ```

   Single statement; no enumerate-then-delete loop. The RETURNING set is the deleted rows — the cleanest semantic. The mode-exit timestamp and target mode are already captured in `process/session/.autonomous-session` (rewritten in step 2); per-monitor cancel-reason metadata is not preserved and is not needed for audit. Do NOT attempt to resolve monitors via `success_condition` at exit time — the founder will re-evaluate on next mode entry. This prevents stale monitors from firing against aged-out external state on next mode entry.

   If the DB is unreachable (psql connection error, permission denied), log a WARNING line to `process/session/.exit-warnings.log` listing the failure and the SQL that was attempted, and surface in the deactivation digest. The founder cleans up the stale entries manually on next mode entry. Do NOT block mode exit on cleanup failure.

   The mode-exit target uses the templated `<target-mode>` (`founder-review`, `automatic`, `default` per step 2), not a hardcoded value.
2. Update the flag file. Pick one based on the user's phrasing:
   - **Back to founder-review** ("I'm back" / "pause" / "back to manual"): either delete the file (`rm process/session/.autonomous-session`) OR rewrite it with `mode: founder-review` per the schema in `mode-switching.md` § Flag. Both are equivalent.
   - **Switch to automatic** ("stop degenerate" if BOARD should keep running): rewrite the entire flag file with `mode: automatic` using the bash block in `automatic-mode.md` § Entry conditions (don't just patch the `mode:` line — reset `started_at`, update `reason`, drop the `charter` / `notify_to` fields).
   - **Switch to default** ("exit ceo mode" / "switch to default"): rewrite using `default-mode.md` § Entry conditions.
3. Do NOT modify `process/session/status-check.yaml`.
4. Exit `/loop` — do NOT call ScheduleWakeup.
5. Send the deactivation email — contents and wording per the template in `communication/ceo-communication-rules.md` (that template is the single source of truth; don't re-list its fields here).
6. Confirm: `Degenerate ended. STATUS=<value>. Deactivation email sent to <CEO_NOTIFY_EMAIL_TO>. Next escalation: <new routing>.`

The autonomous-guard Stop hook (`claudomat-brain/hooks/autonomous-guard.sh`) will not allow the next Stop until step 2 lands — the file is the contract. Confirmation + email alone do not exit degenerate.

**Halt signals:**
1. **Founder ESC + chat message** in the Claude Code session (interrupts the orchestrator's turn at the harness level; bypasses the Stop hook per Claude Code docs — primary halt mechanism).
2. **Mode flag changed** in `process/session/.autonomous-session` (orchestrator exits the autonomous contract on the next tick).
3. **`STATUS=BLOCKED`** in `process/session/status-check.yaml` (human action required — terminal until human intervention).
4. **`STATUS=DONE`** in `process/session/status-check.yaml` (loop finished naturally — `Task — next claimable` returns no row + checkpoints empty + no MONITOR pending).
5. **`ceo-blocklist.md` empty/missing** (degenerate-only).

Destructive actions do NOT halt the loop — they flow through `command-center/dev/triage-routing-table.md` → specialist agents. ceo-agent authorizes; specialists execute.

## Notifications

One email per CEO decision. Founder replies in-thread. Agent reads inbox every tick (step 2). No daily batching.

Triggers: CEO decision recorded, charter-restriction bump, mode activation, mode deactivation, halt event, CLARIFY follow-up. Templates + reply classification + failure handling: `communication/ceo-communication-rules.md`.

- Body capped ~12 lines. Full rationale in `process/session/updates/ceo-digest-<YYYY-MM-DD>.md`.
- Ambiguous replies never act.
- Send failure: 3 retries with backoff; 10-in-1-hour cascade halts loop.

## Audit + rollback

- Every ceo-agent decision emits a notification email + appends to `process/session/updates/ceo-digest-<YYYY-MM-DD>.md`.
- Founder stops session anytime via ESC + chat message in the Claude Code session, or by editing `process/session/.autonomous-session` / `status-check.yaml` directly.
- Founder disagrees → session stopped → orchestrator rolls back artifacts (revert commit, restore task status, undo file writes).
- `/retro` captures patterns → routes per `conflict-resolution.md` § Retro feedback loop.
- Retro lessons land in ceo-agent card (`~/.claude/agents/ceo-agent.md`) via founder edits. CEO cannot self-amend.

## Latency + cost

Per ceo-agent invocation: ~30-60 sec + ~20-30K tokens. Steady-state: ~$1-3/day above normal wave-loop cost.

## Precedence

1. Flag file wins over wave-plan front-matter.
2. Hard limits always apply regardless of charter.
3. Founder message at any time → orchestrator halts loop and responds. No exceptions.
4. STATUS is deterministic, never a question.
5. Charter restrictions beat ceo-agent judgment.
6. BOARD runs first. ceo-agent activates only on BOARD failure or HARD-STOP.

## Onboarding carve-out

ceo-agent and BOARD are OFF during onboarding. Founder-review applies. Automatic and degenerate activate only after onboarding handoff.
