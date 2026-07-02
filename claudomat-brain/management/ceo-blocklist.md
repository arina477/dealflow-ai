# CEO Charter Contract

`ceo-blocklist.md` is the founder-authored charter that restricts ceo-agent under `mode: degenerate`. The active file lives at `command-center/management/ceo-blocklist.md` in each project (project-owned, never replaced by `claudomat sync`). This file documents the contract; the editable seed is rendered from `templates/command-center/management/ceo-blocklist.md` at `claudomat init`.

## Where it lives

| Path | Owner | Purpose |
|---|---|---|
| `claudomat-brain/management/ceo-blocklist.md` (this file) | Brain | Documents the contract — semantics, section schema, invariants. Replaced by `sync`. |
| `templates/command-center/management/ceo-blocklist.md` | Brain | Editable seed rendered at `claudomat init`. Replaced by `sync` *only* if the project file does not exist (init-time behavior). |
| `command-center/management/ceo-blocklist.md` | Project | Live charter ceo-agent reads on every decision. Founder-edited. Never touched by `sync`. |

## Semantics

- ceo-agent reads the project copy on every decision.
- Every line in §§ 1-5 is a disallow rule: the decision class + condition under which ceo-agent must NOT act and must instead propose a charter amendment (see § Charter revision below).
- ceo-agent cannot edit the charter. Founder edits directly; changes take effect on next mode entry.
- **Silent clause** = ceo-agent has authority. **Restrictive clause** = ceo-agent cannot act against it.

## Section schema (mandatory)

The charter must contain these sections in order, with the literal headers below. Empty sections use the placeholder `(no restriction)`.

1. **§ 1 — Disallowed financial commitments** — caps on transactions, monthly aggregate spend, banned categories.
2. **§ 2 — Disallowed external commitments** — contract-value/duration caps, vendor-class bans.
3. **§ 3 — Disallowed customer-facing actions** — refund caps, channel bans (e.g. social posts), public-text restrictions.
4. **§ 4 — Disallowed strategic actions** — feature retirements, founder-bet-protected areas, ritual-invocation restrictions.
5. **§ 5 — Disallowed novelty handling** — legal-demand letters, security incidents, anything CEO must defer rather than improvise.
6. **§ 6 — Disallowed wave-process actions** — fixed text per § Hard invariants below; not founder-editable in spirit (the charter file mirrors them but they hold even if removed).
7. **§ Tool allowlist** — ceo-owned tools with full read+write authority. Default: `agentmail`. Other tools follow the default read-only-for-analysis rule from the ceo-agent agent card.
8. **§ Mode activation prerequisites** — env vars + infrastructure checks read by `degenerate-mode.md` § 1.
9. **§ Charter revision** — fixed text describing the amendment protocol.
10. **§ Halting the loop** — fixed text describing the founder's halt mechanisms.
11. **§ System facts (not charter-editable)** — pointer to the architectural invariants in `degenerate-mode.md` § Hard invariants.

The template at `templates/command-center/management/ceo-blocklist.md` ships with this skeleton plus example entries the founder can edit or delete.

## Hard invariants (apply regardless of charter contents)

These hold even if the charter's § 6 is deleted or weakened. Mirror text from `claudomat-brain/management/degenerate-mode.md` § Hard invariants:

- ceo-agent cannot amend `command-center/management/ceo-blocklist.md`.
- ceo-agent cannot INSERT into `founder_bets` without explicit founder approval delivered via email reply classified `APPROVE`.
- ceo-agent cannot halt the loop.
- **ceo-agent cannot initiate halt-loop decisions on its own.** Recordings of existing discipline violations ARE permitted: the stall-monitor's write of `STATUS=BLOCKED` on a Rule #13 violation surfaces a halt the orchestrator already committed by leaving STATUS in non-RUNNING/IDLE/DONE without `pause_evidence` — this is a recording of an existing failure, not a new halt decision. The founder (via ESC + chat or direct file edit) and the orchestrator (writing BLOCKED with valid `pause_evidence` per Rule #13) are the only initiators of new halts.
- ceo-agent cannot run during onboarding.
- ceo-agent cannot write to project state for tools not in § Tool allowlist.
- ceo-agent cannot run the wave loop. Orchestrator owns blocks P → N.
- ceo-agent writes to STATUS only via (a) stall-nudge (when stall-monitor escalates) or (b) the `halt` directive (recording a founder-initiated halt post-ESC + chat). Both are reactive — ceo-agent never initiates a halt or status change on its own.

## Charter revision protocol

1. Founder edits `command-center/management/ceo-blocklist.md` directly.
2. Changes take effect on next `degenerate` mode entry. Mid-run edits are picked up on the next tick (ceo-agent re-reads charter at step 3 of the tick).
3. When ceo-agent hits a restriction in §§ 1-5, it writes an amendment proposal to `process/session/updates/ceo-charter-proposals.md` and emails founder with subject prefix `⚠ CHARTER PROPOSAL`. Decision does not execute until founder amends or explicitly overrides by session message.

## Mode activation prerequisites (read by degenerate-mode.md § 1)

- `AGENTMAIL_API_KEY` env var set
- `CEO_INBOX_ID` env var set
- `CEO_NOTIFY_EMAIL_TO` env var set
- Custom domain verified at AgentMail (see `claudomat-brain/setup-tools/install.md` § AgentMail setup)
- `process/session/status-check.yaml` readable (auto-bootstrapped on first tick)

## Halting the loop

- **Primary:** press ESC in the Claude Code session, then send a chat message. ESC interrupts the orchestrator's turn at the harness level; the Stop hook does not fire on user interrupt, so the loop cannot resist.
- **Secondary:** edit `process/session/.autonomous-session` — change `mode:` to something other than `automatic` / `degenerate`, or delete the file. The orchestrator exits the autonomous contract on the next tick.
- **Tertiary:** edit `process/session/status-check.yaml` — write `STATUS: BLOCKED` (human action required) or `STATUS: DONE` (work complete). The autonomous-guard hook allows the Stop event on either value. **Founder direct-writes are exempt from the stall-monitor's `pause_evidence` discipline check** — the orchestrator/ceo-agent's writes are sourced via audit log, founder-writes are unsourced and treated as authoritative (see `claudomat-brain/management/degenerate-mode.md` § Founder direct-edit exemption).

**Cross-ref:** On BLOCKED-resume decisions involving side-effecting stages (V-3, B-6, D-2), the orchestrator routes confirmation via the active mode's escalation channel: BOARD under automatic, ceo-agent within charter under degenerate, AskUserQuestion in chat under founder-review. See `claudomat-brain/management/automatic-mode.md` § Resume protocol (or its mirror in `degenerate-mode.md`).

These supersede every other rule. Charter cannot disable them.

**Mapping to hook-observable signals.** The 3 founder mechanisms above produce 4 hook-observable halt signals (per `claudomat-brain/management/automatic-mode.md` § Stop-guard enforcement):

- **ESC + chat** → bypasses the Stop hook entirely (1 hook-bypass path).
- **Edit `.autonomous-session`** → hook exits 0 early on mode-check (1 hook-bypass path).
- **Edit `status-check.yaml`** → orchestrator writes either `STATUS=BLOCKED` or `STATUS=DONE`. These map to **2 of the 3 hook case-statement signals**.

Total: **2 hook-bypass + 3 hook-recognized = 5 hook-observable halt signals** (the 3 founder mechanisms above produce 4 of these; the 5th hook-observable signal — empty `ceo-blocklist.md` under degenerate — is a design enforcement, not a founder-intended halt button: the orchestrator refuses to run without a charter, so emptying it terminates the loop as a side-effect, not as a primary halt mechanism).
