# BOARD — Decision Body Under Automatic

7 fresh-context members that collectively substitute for the founder when `mode: automatic` is active. Preserves the wave loop's forward motion without blocking on founder review.

## When BOARD fires

Under `mode: automatic`, any would-be user-ask routes to BOARD EXCEPT the hard-stops below:

- P-0 Tier 3 product decisions
- P-0 EXPAND_SCOPE / REDUCE_SCOPE / RECONSIDER verdicts
- P-0 conflicting verdicts (problem-framer vs ceo-reviewer)
- P-1 unbreakable monolith (first slice of auto-split still trips size rubric)
- D-2 / D-3 design-gap 3-cap escalation
- V-3 fast-fix retry-cap exhaustion
- daily-checkpoint resolution (all three buckets)

Under `mode: default` or `founder-review`: BOARD does not fire. Escalations go to founder per `default-mode.md`.

Onboarding: BOARD is OFF during onboarding (`claudomat-brain/onboarding/onboarding-loop.md`) regardless of mode. Automatic activates only after onboarding handoff.

## Out of BOARD scope — resolve by rule, never convene

BOARD resolves product, scope, strategy, compliance, and external-commitment decisions. BOARD does NOT resolve:

- Session/context management (STATUS transitions, handoff timing — see `automatic-mode.md` § Tick behavior)
- Loop cadence and ScheduleWakeup delays
- Commit/push granularity within an approved plan
- Execution sequencing within an approved plan
- Stated-preference checkpoints ("My preference: X" auto-resolves to X)

## Hard-stops — NEVER go to BOARD

Route to founder (under `founder-review` / `default` / `automatic`) or to ceo-agent (under `degenerate`):

| Class | Examples |
|---|---|
| **Destructive actions** | force-push, DROP TABLE, `rm -rf`, `git reset --hard`, `kubectl delete`, branch deletion, uncommitted-work overwrites |
| **Money commitments** | new paid SaaS subscription, API tier upgrade with billing, domain purchase, anything with a credit-card hit |
| **Hard-stop member veto** | any BOARD member flags `HARD-STOP: must be human` with concrete reason |

### Routing summary by mode

| Class | founder-review | default | automatic | degenerate |
|---|---|---|---|---|
| Destructive actions | founder | founder | founder | **ceo-agent** (restricted by `ceo-blocklist.md` § 4 if set) |
| Money commitments | founder | founder | founder | **ceo-agent** (restricted by `ceo-blocklist.md` § 1 if set) |
| HARD-STOP member veto | founder | founder | founder | **ceo-agent** (weighs veto, records in digest) |
| Standard 4+/7 split | founder | founder | founder | **ceo-agent** |
| Tier 3 6+/7 strict fall-short | founder | founder | founder | **ceo-agent** |

Under any autonomous mode (automatic or degenerate), the canonical 5 halt signals (4 cross-mode + 1 degenerate-only) that end the loop and surface to the founder:
1. **Founder ESC + chat message** in the Claude Code session (interrupts the orchestrator's turn at the harness level; bypasses the Stop hook per Claude Code docs — primary halt mechanism).
2. **Mode flag changed** in `process/session/.autonomous-session` (orchestrator exits the autonomous contract on the next tick).
3. **`STATUS=BLOCKED`** in `process/session/status-check.yaml` (human action required — terminal until human intervention).
4. **`STATUS=DONE`** in `process/session/status-check.yaml` (loop finished naturally).
5. **`ceo-blocklist.md` empty/missing** (degenerate-only).

Additional founder-escalation route (NOT a halt signal — the loop continues, just routes around the restriction): ceo-agent hits a charter restriction it cannot resolve → surfaces via `process/session/updates/ceo-charter-proposals.md` + email, while the orchestrator keeps working on other tasks pending the founder's amendment reply.

Identity/legal and external communications (emails to real users, Slack posts, OSS PR descriptions, ToS/privacy-text copy) are BOARD-decidable under `automatic`. Under `degenerate`, ceo-agent resolves within `command-center/management/ceo-blocklist.md` § 3 restrictions.

## Composition

7 members. See `board-members.md` for per-member lens + agent mapping + reading list.

1. **ceo-reviewer** — strategic direction / bet alignment / ambition
2. **architect-reviewer** — technical wisdom / blast radius / reversibility
3. **ux-researcher** — UX coherence / user-value cost
4. **risk-manager** — risk / failure modes / escape routes
5. **founder-proxy** — founder voice via product-decisions.md + founder_bets
6. **competitive-analyst** — benchmark-grounded "what would competitors do" signal
7. **product-manager** — operational PM / MVP scope / feature priority / user outcomes

All seven spawn in parallel, fresh context, no shared state. None sees another's vote before casting.

## Voting

See `conflict-resolution.md`. Short version:

- **Default threshold: 4+/7 in same direction** → apply; L-1 docs log decision + any dissent
- **Tier 3 product decisions: 6+/7 in same direction** (stricter bar for strategic calls)
- **No direction reaches 4+** → escalate to founder
- **Any member hard-stop veto** → escalate to founder (circuit breaker)

## Output

Per BOARD convening:

- `process/waves/wave-<N>/escalations/board-<decision-slug>.md` — 7 votes + consolidated decision + dissent notes
- Entry in `process/waves/wave-<N>/stages/L-1-docs.md` § BOARD decisions table — `decision-slug | members-agreed (N/7) | outcome | dissent note`
- Morning digest: every BOARD decision surfaces to founder via `process/session/updates/board-digest-<YYYY-MM-DD>.md`. Close splits and vetoes flagged at the top.

## Anti-patterns

| # | Never |
|---|---|
| 1 | Convene BOARD for self-management decisions (session management, loop cadence, commit granularity, execution sequencing). Logged in L-1 under Plan-authoring defects. |
| 2 | Let BOARD decide hard-stops. Destructive actions, money commitments, member vetoes route to founder or ceo-agent, never to BOARD vote. |

## Rollback

Founder reviews morning digest, disagrees with a BOARD decision:
- Founder stops the session, points to the decision.
- Orchestrator rolls back artifacts (revert commit, restore task status, undo file writes).
- Retro captures the pattern via L-2 distillation → routed per `conflict-resolution.md` § Retro feedback loop.

No automated rollback flow — founder manual override is the safety valve.
