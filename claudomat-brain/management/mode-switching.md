# Mode Switching

Four modes, one flag file, simple transitions.

## Flag

File: `process/session/.autonomous-session` — gitignored, session-scoped.

```yaml
started_at: <ISO-timestamp>
mode: founder-review | default | automatic | degenerate
reason: <one-line quote of user's phrasing>
expires_on: user-says-stop | orchestrator-finishes-all-work
# degenerate only:
charter: command-center/management/ceo-blocklist.md
notify_to: <value of CEO_NOTIFY_EMAIL_TO env var>
```

File absent → **founder-review** by default. The file may also be present with `mode: founder-review` (e.g., after explicit return from autonomous mode); both forms behave identically.

## Entry conditions

| Mode | Trigger phrases |
|---|---|
| **founder-review** (default / return) | "I'm back" / "I'm awake" / "pause" / "let's discuss" / "stop running" / "exit autonomous mode" / "stop the autonomous run" / "stop degenerate" / "exit ceo mode" |
| **default** | "run overnight" / "work autonomously" / "run autonomous" / "I'm going to sleep" / "see you in the morning" / "keep going until done" / "finish all remaining" / "don't stop to ask" / "don't wake me up" |
| **automatic** | "automatic" / "go completely autonomous" / "board mode" / "unconditional loop" / "don't stop for anything" |
| **degenerate** | "degenerate" / "degenerate mode" / "ship it mode" / "ceo mode" / "ceo-agent mode" / "run indefinitely" / "365 mode" / "full delegation" / "total autonomy" |
| **mid-run switch** | "switch to default" / "turn off BOARD" / "switch to automatic" / "turn on BOARD" / "switch to degenerate" / "bring in ceo-agent" |

## Behavior

| Mode | Flag value | Behavior |
|---|---|---|
| **founder-review** | Absent OR `mode: founder-review` | Every user-ask goes to founder. Baseline — no separate mode file. |
| **default** | `mode: default` | Skips nice-to-have checkpoints. Strategic / hard-stops to founder. See `default-mode.md`. |
| **automatic** | `mode: automatic` | BOARD (7 members) handles all non-hard-stop escalations. Morning digest for founder audit. See `automatic-mode.md`. |
| **degenerate** | `mode: degenerate` | ceo-agent resolves BOARD splits, HARD-STOP vetoes, and all former-founder-asks within `ceo-blocklist.md` restrictions. Per-decision email; loop runs indefinitely. See `degenerate-mode.md`. |

## First-entry quick-start (post-onboarding)

After v13 handoff, founder enters any non-default mode by typing the **mode-file name verbatim**:

| Founder types | Effect |
|---|---|
| `default` | Orchestrator writes `mode: default` to `process/session/.autonomous-session`; default-mode behavior takes effect on the next agent action. No `/loop` bootstrap. |
| `automatic` | Verifies prerequisites (BOARD bench generated; product-decisions.md present + founder_bets reachable). Writes `mode: automatic`. Bootstraps `/loop` skill (`/loop autonomous-loop` — gates on `process/session/status-check.yaml` per `automatic-mode.md`). First tick fires immediately. |
| `degenerate` | Verifies prerequisites per `degenerate-mode.md` § 1 (charter exists, AgentMail env vars, ceo-agent spawnable). Writes `mode: degenerate`. Bootstraps `/loop`. First per-decision email fires on the first BOARD escalation. |
| `founder-review` (or just delete the flag file) | Reverts to default behavior. Under `degenerate`, also delivers final digest email. |

Bare-word triggers always work — longer trigger phrases above are convenience aliases, not the canonical entry path.

## Transitions

| From | To | Action |
|---|---|---|
| founder-review | default | Create flag file with `mode: default` |
| founder-review | automatic | Create flag file with `mode: automatic` |
| founder-review | degenerate | Verify prerequisites (see `degenerate-mode.md` § 1); create flag file with `mode: degenerate` |
| default ↔ automatic | | Rewrite flag file using target mode's § Entry conditions bash |
| automatic → degenerate | | Verify prerequisites; rewrite flag file using `degenerate-mode.md` § Entry conditions bash |
| degenerate → anything | | Rewrite flag file using target mode's § Entry conditions bash; deliver final digest email |
| any | founder-review | Delete flag file (or rewrite with `mode: founder-review`; for degenerate, also deliver final digest email) |

Orchestrator confirms every transition in one line.

### Mid-run switching — concrete procedure

A "mid-run switch" is the same as a first-entry: do NOT just patch the `mode:` line in place. Always **rewrite the entire flag file** using the bash block in the target mode's § Entry conditions. Reasons:

- `started_at` should reset to the new mode's activation timestamp (it's an audit field).
- `reason` should be updated with the user's quote for *this* switch, not the previous mode's.
- `degenerate` requires extra fields (`charter`, `notify_to`) that don't exist under other modes; leaving them stale or absent breaks the schema.
- If you patch by appending a new `mode:` line, the autonomous-guard Stop hook's strict parser blocks the result. Other patching styles (in-place `sed`) may parse cleanly but still leave the file in the inconsistent states listed in the first three bullets — audit hygiene, schema completeness on `degenerate`'s extra fields, and the stale `started_at` / `reason` problem.

Procedure for every mid-run switch:

1. Read the target mode file (`<target>-mode.md`) and run its § Entry conditions step-by-step:
   - For `automatic` / `degenerate`: verify prerequisites first.
   - For `degenerate`: also run the ceo-agent spawn probe and send the activation email.
2. Rewrite the flag file using the target mode's `cat > process/session/.autonomous-session <<EOF ... EOF` block verbatim.
3. Run remaining side-effects from § Entry conditions:
   - `automatic` / `degenerate` entry from a non-autonomous mode: bootstrap `/loop`.
   - `automatic` ↔ `degenerate` switch while `/loop` is already running: do NOT re-bootstrap; the existing loop reads the new mode on its next tick.
   - `degenerate → automatic` or `degenerate → default`: send the final degenerate digest email before the new mode's confirmation.
4. Confirm the switch in one line using the target mode's confirmation format.

Example — `automatic → degenerate` mid-run:

```bash
# Step 1: verify degenerate prerequisites per degenerate-mode.md § 1
# (charter present, AgentMail env vars, ceo-agent spawnable, …)

# Step 2: rewrite the flag — use degenerate-mode.md § Entry conditions step 2 verbatim
cat > process/session/.autonomous-session <<EOF
started_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
mode: degenerate
reason: <quote user's phrasing>
charter: command-center/management/ceo-blocklist.md
notify_to: $CEO_NOTIFY_EMAIL_TO
expires_on: founder-message | explicit-exit
EOF

# Step 3: activation email per degenerate-mode.md § 4 (the ceo-agent spawn probe ran in Step 1 prerequisites; /loop already running so § 5 skipped)

# Step 4: confirm per degenerate-mode.md § 6.
```

If any step fails (e.g. prerequisites missing), do NOT touch the flag file — leave the current mode intact, surface the failure to the founder. A half-applied switch (flag updated but side-effects not run) leaves the loop in an inconsistent state that's harder to recover than rejecting the switch outright.

## Checking the mode (every stage)

```bash
if [ -f process/session/.autonomous-session ]; then
  MODE=$(grep '^mode:' process/session/.autonomous-session | awk '{print $2}')
else
  MODE=founder-review
fi
```

Read the corresponding mode file (`claudomat-brain/management/<mode>-mode.md`) before any mode-aware routing decision. `founder-review` has no mode file — implicit default; every would-be user-ask goes straight to founder via AskUserQuestion or session prompt.

## Anti-patterns

| # | Never | Why |
|---|---|---|
| 1 | Use wave-plan front-matter to set mode. | Flag file wins; `autonomous_mode` in wave plans / `process/waves/wave-<N>/stages/P-3-plan.md` is deprecated. |
| 2 | Bypass hard-stops regardless of mode. | Destructive actions and money commitments always prompt — mode flags do not override safety gates. |
| 3 | Suppress user messages mid-run. | Founder message at any time causes immediate response regardless of mode or STATUS. |

## Exit conditions

Exit procedure is documented per-mode in `<mode>-mode.md § Exit conditions`. The high-level shape:

| From | Procedure |
|---|---|
| default | See `default-mode.md § Exit conditions` (back to founder-review, or switch to automatic/degenerate). |
| automatic | See `automatic-mode.md § Exit conditions` (back to founder-review, or switch to default/degenerate). |
| degenerate | See `degenerate-mode.md § Exit conditions` (back to founder-review, or switch to automatic/default; deliver final digest email). |

Two universal rules across all exit paths:

1. **Rewrite the entire flag file** using the bash block in the target mode's § Entry conditions — do NOT patch the `mode:` line in place. Reasons in § Mid-run switching above. Appending a new `mode:` line creates a duplicate that the autonomous-guard Stop hook's strict parser refuses.
2. **`process/session/.autonomous-session` is gitignored** — session state never belongs in git history.
