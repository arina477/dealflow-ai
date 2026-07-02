# Mode — Default

Default "working autonomously" mode. Skips nice-to-have checkpoints for overnight or extended runs; escalates strategic calls and hard-stops to founder. Strictly less permissive than `automatic` (which routes strategic calls to BOARD).

For mode switching and flag-file semantics, see `mode-switching.md`.

## Flag

`process/session/.autonomous-session` with `mode: default`.

## Entry conditions

User phrases: "run overnight" / "work autonomously" / "I'm going to sleep" / "don't stop to ask" — see `mode-switching.md` for full list.

On activation, in a single turn and in order:

1. Write the flag file:
   ```bash
   cat > process/session/.autonomous-session <<EOF
   started_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
   mode: default
   reason: <quote user's phrasing>
   expires_on: user-says-stop | orchestrator-finishes-all-work
   EOF
   ```
2. Confirm in one line: `Default ON. Strategic decisions + hard-stops still escalate to you; nice-to-have checkpoints skipped.`
3. Continue with the current task. Default mode does NOT bootstrap `/loop` — orchestrator runs wave-to-wave but still pauses at every Tier-3 decision and hard-stop for founder input.

Writing the flag file is the load-bearing step. The confirmation in step 2 without a successful flag write in step 1 is a discipline violation: subsequent agents check the flag file (not the confirmation text) to know which routing applies, and skipping the write leaves the project in `founder-review` baseline.

## Behavior

### Decision autonomy — 3-tier classification

Classify every decision by blast radius and reversibility. Tier determines routing. Applies in all modes; what changes across modes is what happens on Tier 3.

**Tier 1 — Auto-decide** (log in L-1 docs):
- Copy/label alignment with design mockups
- Missing standard marketplace features every competitor has
- Routing consolidation (duplicate routes → redirect)
- Bug fixes where correct behavior is unambiguous
- Canonical-frame layout corrections (structural, not subjective)
- Seed data additions for testing coverage
- Status label fixes where label contradicts the enum name

**Tier 2 — Proceed + notify in morning file:**
- Component extractions / refactors
- New shared UI components implied by the design but not explicitly discussed
- Routing pattern decisions (query param vs sub-path)
- Display format unification across components
- Adding a new settings tab when the feature is standard and the mockup exists

**Tier 3 — Must escalate** (queue for founder via `claudomat-brain/rules/daily-checkpoint.md` 3-bucket batch under default):
- Removing existing features/sections from production
- External service integrations (new SaaS provider, payment providers, analytics)
- Major UX direction changes (restructuring a flow, changing navigation hierarchy)
- Anything touching money / payments / security architecture
- Feature additions beyond the scoped design
- Renaming user-facing concepts where semantics matter

When in doubt, spawn `competitive-analyst` first — competitor evidence often resolves Tier 2 into Tier 1.

### Competitive intelligence pre-decision

Spawn `competitive-analyst` before Tier 2 decisions and as supporting evidence for Tier 3 questions.

- **Quick benchmark (~3 min):** WebSearch + WebFetch + Playwright screenshot of the competitor's equivalent page. Covers ~80% of questions.
- **Deep investigation (~15 min):** log into competitor site, walk the actual buyer/seller flow, screenshot each step. For complex flow comparisons.

Store artifacts in `command-center/artifacts/competitive-benchmarks/` as markdown files. Before spawning: see `claudomat-brain/rules/sub-agent-invocation.md`.

### Session-level skips (default specific)

When `mode: default` is active, skip these human-gated checkpoints:

- **P-0 Frame** — skip mid-stage human-checkpoint (red-team verdicts auto-resolve per `conflict-resolution.md`)
- **D-2 Variants iterate sub-actions** — skip pre-review human-checkpoint
- **D-3 Review & adopt** — skip pre-adopt human-checkpoint when designer's verdict is unanimous APPROVE
- **Any AskUserQuestion classified "optional / would be nice"** — skip silently

**Never skipped regardless of mode:** destructive-action confirmations, money commitments, merge-to-main prompts where user explicitly requested review, scope-change proposals (EXPAND / REDUCE from ceo-reviewer).

Log every skip in the wave's `process/waves/wave-<N>/stages/L-1-docs.md` deliverable.

## Routing thresholds

| Scenario | founder-review | default | automatic |
|---|---|---|---|
| Tier 1 product decision | Auto-decide | Auto-decide | Auto-decide |
| Tier 2 product decision | Proceed + log | Proceed + log | Proceed + log |
| Tier 3 product decision | Queue to daily-checkpoint (founder) | Queue to daily-checkpoint (founder) | BOARD (6+/7 strict) |
| D-2 / D-3 human-checkpoint | Prompt founder | Skip | Skip |
| P-0 mid-stage human-checkpoint | Prompt founder | Skip | Skip |
| Destructive action | Prompt founder | Prompt founder | Prompt founder |
| Money commitment | Prompt founder | Prompt founder | Prompt founder |
| ceo-reviewer EXPAND/REDUCE scope | Prompt founder | Prompt founder | BOARD (4+/7) |
| BOARD member HARD-STOP veto | n/a | n/a | Escalate to founder |

## Anti-patterns

| # | Never | Why |
|---|---|---|
| 1 | Escalate Tier 2 decisions as if they were Tier 1. | Mode flag never lowers the bar — it controls checkpoint-skipping and Tier 3 routing only. |
| 2 | Auto-resolve Tier 3 without BOARD routing in automatic. | Tier 3 requires BOARD (6+/7) in automatic. |

## Exit conditions

User triggers: "I'm back" / "pause" / "stop the autonomous run" / "switch to automatic" / "switch to degenerate".

Update the flag file. Three valid paths:

- **Back to founder-review** ("I'm back" / "pause"): either delete the file (`rm process/session/.autonomous-session`) OR rewrite it with `mode: founder-review` per the schema in `mode-switching.md` § Flag. Both are equivalent — see `mode-switching.md`.
- **Switch to automatic** ("switch to automatic"): rewrite the entire flag file using the bash block in `automatic-mode.md` § Entry conditions (don't just patch the `mode:` line — reset `started_at` and update `reason`). Then run the rest of the automatic-entry sequence (STATUS init + `/loop` bootstrap).
- **Switch to degenerate** ("switch to degenerate"): verify prerequisites per `degenerate-mode.md` § 1, then rewrite the entire flag file using the bash block in `degenerate-mode.md` § Entry conditions and run the remaining activation steps.

Orchestrator finishes all work → delete flag file.

Default mode does not trigger the autonomous-guard Stop hook (the guard only blocks under `mode: automatic` / `mode: degenerate`), so in-place patches don't get caught by an external check; the rewrite-not-patch rule is still in effect for audit-trail consistency (`started_at`, `reason`) and to keep mode-switching mechanics identical across all four modes.

Audit trail in the wave's L-1 deliverable (`process/waves/wave-<N>/stages/L-1-docs.md`):

```markdown
## Autonomous-session audit
- Mode: default (file mtime: <timestamp>)
- Skipped checkpoints: [list]
- Decisions made autonomously: [list]
```
