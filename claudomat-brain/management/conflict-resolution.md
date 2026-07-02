# BOARD Conflict Resolution

Voting protocol, tie-breaks, retro feedback. Applies whenever BOARD is convened — under `automatic` for routine escalations, and under `degenerate` as input to ceo-agent's resolution.

## Voting rules

Each member casts one vote (APPROVE / REJECT / ABSTAIN). ABSTAIN is not vote-against — used when a member judges the decision outside their lens. See `board-members.md` § ABSTAIN discipline.

### Default threshold — 4+/7 in same direction

For: scope EXPAND/REDUCE, RECONSIDER, conflicting reviewer verdicts, unbreakable monolith, design-gap 3-cap, V-3 fast-fix retry-cap exhaustion, daily-checkpoint `assigned-this-cycle` + `stayed-unassigned` buckets.

- **4+ APPROVE → apply.** Log dissent note if opposed votes > 2.
- **4+ REJECT → request denied.** L-1 docs note why.
- **4+ in a direction with ABSTAINs** (e.g., 4 APPROVE + 3 ABSTAIN) → apply.

### Strict threshold — 6+/7 in same direction

For: Tier 3 product decisions.

- **6+ APPROVE → apply.** Strategic calls get a higher bar.
- **5 APPROVE + 2 other → escalate to founder (or ceo-agent under degenerate).** Strong majority insufficient for Tier 3.

### Split outcomes

| Pattern | Action |
|---|---|
| 4+/7 APPROVE, 3 REJECT/ABSTAIN | Default passes, log dissent; Tier 3 escalates |
| 5+2 APPROVE/REJECT | Default passes; Tier 3 escalates (strict bar not met) |
| 3+3+1 three-way | Escalate — no direction reaches 4+ |
| 3+2+2 | Escalate — no direction reaches 4+ |
| 2+2+3 (three ABSTAINs, 2-vs-2 on sides) | Escalate — insufficient engagement |
| 7+0+0 (unanimous) | Apply (clean decision) |
| Any pattern with `HARD-STOP: must be human` | Escalate regardless of vote math |

## Escalation path

### Under `founder-review` / `default` / `automatic` — BOARD → founder

1. Orchestrator writes `process/waves/wave-<N>/escalations/board-<decision-slug>.md` with all 7 votes.
2. Appends to `process/session/updates/board-digest-<YYYY-MM-DD>.md` § Vetoes & escalations routed back.
3. Stage waits per current mode's founder-escalation handling.
4. Wave resumes when founder answers.

### Under `degenerate` — BOARD → ceo-agent

1. Orchestrator writes `process/waves/wave-<N>/escalations/board-<decision-slug>.md` with all 7 votes.
2. Spawns ceo-agent via `Agent(subagent_type=ceo-agent)` with the BOARD file + decision context.
3. ceo-agent reads `command-center/management/ceo-blocklist.md` charter restrictions.
4. Charter restriction blocks → ceo-agent writes to `process/session/updates/ceo-charter-proposals.md` and escalates via per-decision email.
5. No restriction → ceo-agent decides, writes entry to `process/session/updates/ceo-digest-<YYYY-MM-DD>.md` and `process/waves/wave-<N>/escalations/ceo-review-<stage-id>.md`, emits decision back to the calling stage.
6. Wave resumes same turn.

ceo-agent does not vote — it decides. One outcome, with rationale, cognitive-pattern citations, and reversibility classification. The BOARD vote file is input: ceo-agent sees what the board thought, including dissent and any HARD-STOP vetoes.

## Hard-stop member veto

Any BOARD member may emit `HARD-STOP: must be human — <reason>`. Overrides voting math — even 7+/7 APPROVE with 1 hard-stop escalates.

Under `degenerate`, HARD-STOP routes to ceo-agent, not founder. ceo-agent weighs the veto as strong signal, records engagement in the digest, and may still authorize if justified. Veto is a signaling tool — dissent loud and visible — without blocking execution under pre-authorized CEO mode.

Legitimate hard-stop examples:
- **founder-proxy:** "no founder precedent in memory; this is a genuinely new call"
- **risk-manager:** "proposed action has no documented escape route; failure is irreversible"
- **architect-reviewer:** "commits to X architectural direction; too load-bearing for 4+ consensus"
- **competitive-analyst:** "all Tier 1 benchmarks contradict this decision; high reputational risk"

## Anti-patterns

| # | Never | Why |
|---|---|---|
| 1 | Use ABSTAIN to avoid taking a stance. | ABSTAIN on lens-relevant decisions weakens signal; retro tunes habitual abstainers. |
| 2 | Treat 5+/7 APPROVE as sufficient for Tier 3. | Strict bar requires 6+/7. |
| 3 | Allow a hard-stop veto to be overridden by vote math. | Hard-stop is a circuit breaker; forces escalation regardless of consensus. |

## Retro feedback loop

When founder overrides a BOARD decision:

1. Log the override in `process/waves/wave-<N>/stages/L-1-docs.md` § BOARD override.
2. At next L-2 distill: identify which member's lens missed the concern, whether reading-list gap, pattern-matching gap, or structural issue (wrong threshold / wrong composition).
3. L-2 distillation routes the lesson:
   - Reading-list gap → update `board-members.md` § per-member reading list
   - Pattern-matching gap → annotate the relevant agent card (`~/.claude/agents/<member>.md`) — founder-edit only
   - Structural issue → surface to founder via `process/session/updates/pending.md` as `proposal:board-tuning`
4. No automatic BOARD tuning — every adjustment passes through founder via retro or direct edit.

Tier 3 retros that passed BOARD (6+/7) but founder later reversed are mandatory, not discretionary — strong consensus diverged from founder taste and deserves explicit composition / threshold review.

## Audit surface

`process/session/updates/board-digest-<YYYY-MM-DD>.md` organizes decisions by confidence:

```markdown
## Clean decisions (5+/7 consensus or cleaner)
## Close splits (4+/7 with dissent)
## Vetoes & escalations
```

Clean decisions are FYI. Close splits and vetoes are the founder-attention items — dissent pattern hints at future friction and member tuning targets.
