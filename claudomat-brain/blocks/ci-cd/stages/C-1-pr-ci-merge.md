# C-1 — PR, CI & merge

> **Block:** C (CI/CD), 4th of 8 in wave loop: `P → [D] → B → ` **`C`** ` → T → V → L → N`.
> **Stages:** **C-1** → C-2. Advance on stage exit: C-2.
> **Pattern:** spawn-pattern (headless). head-ci-cd owns the block as a sub-agent; orchestrator coordinates.
> **Dispatcher** (skip rules, external-verdict gates, exit handoff): `claudomat-brain/blocks/ci-cd/ci-cd.md`.

## Purpose

Push the wave's branch, open a pull request with an automated description, watch every required CI check until all are green, then merge to main. C-1 owns the wave's complete pre-deploy lane — PR creation, CI verdict, merge — as one operational unit so the dispatcher doesn't fragment what is mechanically a single sequence with one external-verdict gate.

## Prerequisites

- B-6 exited with `/review` APPROVE.
- READ `project.yaml` (`commands[]` for the PR-relevant commands, `merge_strategy` for the merge style). The list of required CI checks is observed at runtime via `gh pr checks` against the actual PR — no `project.yaml` field enumerates CI providers (GitHub Actions is the only CI surface the brain is wired against; `deploy_targets[].platform` enumerates deploy platforms, not CI providers, and is read by C-2 instead).

## Skip condition

C-1 does NOT skip. Project with zero CI configured: no required checks → trivial green; record `note: "no CI checks configured for this repo"` in deliverable. Merge still happens.

## Actions

### Action 0 — Spawn head-ci-cd

C-block uses sub-agent spawn (not orchestrator-mask) — C-block outcomes are externally-determined (CI runners, deploy platforms, canary monitors), so head-ci-cd's role is observation + verdict-recording rather than persistent in-orchestrator gating.

Spawn head-ci-cd via the Agent tool with `subagent_type: head-ci-cd`. Brief on merge commit SHA, branch name, deploy target, and wave context (canary requirements, degenerate mode flags). No subsequent action runs until head-ci-cd returns ACK.

Founder visibility: the `Agent(subagent_type=head-ci-cd)` tool call appears on transcript.

### Action 1 — Push the branch

```
git push -u origin wave-<N>-<slug>
```

If branch was previously pushed (e.g., during a B-6 fix-up cycle), re-push with `git push` (no `-u`). B-6 fix-ups land as separate commits — no squash mechanic in the wave loop, so a force-push is never required between B-6 and C-1. Local state demanding force-push at this stage = wave-loop violation; investigate before proceeding.

### Action 2 — Author PR title

Format: `<type>: <short description>` where `<type>` is one of `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `ci`. Title under 70 characters.

Derive from spec contract's `scope-id` and acceptance criteria — short, declarative, tense-consistent with project's commit history (run `git log --oneline -10` to confirm).

### Action 3 — Author PR body

```markdown
## Summary

<1–3 bullets summarizing what changed and why — derive from spec contract + B-block deviation log>

## Test plan

<bulleted markdown checklist of TODOs the reviewer can run to verify the wave>

## Spec contract

- Primary task: <primary-task-id> (claimed: <comma-separated claimed_task_ids>)
- Acceptance criteria: <link or short list>

## Wave artifacts

- Plan: process/waves/wave-<N>/stages/P-3-plan.md
- Spec: process/waves/wave-<N>/stages/P-2-spec.md
<- Design: design/<feature>.html (if applicable)>
- Build deliverables: process/waves/wave-<N>/stages/

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

### Action 4 — Create the PR via `gh`

```
gh pr create \
  --title "<title>" \
  --body "$(cat <<'EOF'
<body>
EOF
)"
```

Use heredoc — never inline the body, formatting will break.

If the project requires reviewers, labels, or a project board attachment, add corresponding `gh pr create` flags per `command-center/principles/CI-PRINCIPLES.md § pr_conventions` (authored at v13 step 2b; defaults: AI-attribution footer ON, no auto-merge, no required reviewers).

### Action 5 — Capture PR metadata

Record returned PR number and URL.

### Action 6 — Identify required CI checks

```
gh pr checks <pr-number>
```

Parse for every required check (those marked `required` or part of branch protection). Optional checks may pass or fail without blocking; record but do not gate on them.

### Action 7 — Watch the runs

For each required check still pending:

```
gh run watch <run-id> --exit-status
```

`--exit-status` makes the command exit non-zero on failure, simplifying verdict logic.

If multiple runs are in-flight, watch them in parallel (separate Bash calls in the same orchestrator message) — never serialize watches.

### Action 8 — On any required check failure

**Step A — Flake check (re-run once before classifying).** Read `process/waves/wave-<N>/stages/B-5-verify.md` § `flakes_documented`. If failing check matches a documented flake, re-run that single CI job once:

```
gh run rerun <run-id> --failed
gh run watch <new-run-id> --exit-status
```

Treat the second run as authoritative: pass → record `flake_rerun_succeeded: true` and continue with Action 9. Second fail → flake escalated to real defect; proceed to Step B.

If failing check is NOT in `flakes_documented`, skip Step A and go to Step B — silently re-running unknown failures masks regressions.

**Step B — Classify and route per Iron Law.** Do NOT fix directly:

1. Pull failure context: `gh run view <run-id> --log-failed`
2. Classify per `command-center/dev/triage-routing-table.md`:
   - Lint failure → `/investigate` → likely B-5 defect.
   - Typecheck failure → B-4 or B-5 defect.
   - Unit test failure → B-2, B-3, or test author defect.
   - Integration test failure → B-2, B-4, or test author defect.
   - Build failure (env-related) → B-0 (env wiring) or B-1 (contract regen).
3. Route to originating B-stage via `/investigate`. B-stage adds a fix-up commit, pushes; C-1 re-runs Action 7 on the new run.

Iteration cap: **5 fix-up cycles**. If 5 cycles don't clear, escalate per active mode (founder / BOARD / ceo-agent) — likely a structural plan defect requiring P-block re-entry.

### Action 9 — Record the green run

Once all required checks are green, record final run IDs and SHAs.

### Action 10 — Verify mergeable state

```
gh pr view <pr-num> --json mergeable,mergeStateStatus
```

Expected: `mergeable: MERGEABLE` and `mergeStateStatus: CLEAN` (or `HAS_HOOKS` if hooks configured but passed).

If `mergeStateStatus: BEHIND`, rebase:

```
gh pr update-branch <pr-num>     # if available
# OR
git checkout wave-<N>-<slug>
git pull --rebase origin main
git push --force-with-lease       # never plain --force on a PR branch
```

After rebase, return to Action 7 to re-watch CI on the rebased commit.

### Action 11 — Merge

Use the merge strategy declared in `project.yaml: merge_strategy` (allowed: squash | merge | rebase). Default if unspecified: `--squash --delete-branch`.

```
gh pr merge <pr-num> --squash --delete-branch
```

If branch protection requires approvals AND active mode authorizes auto-merge:

```
gh pr merge <pr-num> --squash --delete-branch --auto
```

`--auto` queues the merge to fire when remaining conditions are met. **Mode authorization:**

| Mode | `--auto` allowed? | Why |
|---|---|---|
| `founder-review` | **No** | Human reviewer in the loop by definition. |
| `default` | **No** | Merge into main is a hard-stop; founder-gated. |
| `automatic` | **Yes** | BOARD owns approval. |
| `degenerate` | **Yes** | ceo-agent owns approval within `ceo-blocklist.md`. |

If active mode disallows `--auto` but branch protection blocks the direct merge for missing approvals, route per the failing-merge matrix (Action 13).

### Action 12 — Sync local main

```
git checkout main
git pull --rebase
```

Capture merge commit SHA: `git rev-parse HEAD`.

### Action 13 — On merge failure

| Failure | Likely cause | Route to |
|---|---|---|
| `mergeStateStatus: BLOCKED` | Branch protection failed (review missing, status check missing) | Address per protection rule; if missing review under autonomous mode, `--auto` flag may resolve. |
| `mergeStateStatus: BEHIND` after rebase loop | CI flakes between rebase and re-watch | Re-enter Action 7; cap at 3 rebase loops before escalating. |
| Merge conflict | Branch diverged from main during the wave | Manual rebase; if conflict spans non-trivial files, `/investigate` and re-enter originating B-stage. |
| `gh` returns 422 with secret-scanning block | Secret committed to history | Hard stop. Rotate secret at issuing platform, rewrite history, verify removal (`git log --all --full-history -- <path>` returns empty), force-push, re-attempt. Never bypass with `--no-verify` or platform-side scanner overrides. |

## Deliverable

`process/waves/wave-<N>/stages/C-1-pr-ci-merge.md` — records branch push, PR creation + URL, required-check list, watch outcomes, fix-up cycles, mergeable state, merge strategy, merge commit SHA, rebase cycles, plus verdict footer.

```yaml
ci_stage_verdict: PASS                # PR open + CI green + merged
verdict_source: gh
verdict_evidence:
  - "gh pr view <num> state MERGED"
  - "gh pr checks <pr-num> all required checks passed"
  - "merge commit: <sha>"
pr_number: <num>
pr_url: <url>
branch: wave-<N>-<slug>
required_checks: [list]
optional_checks: [list with PASS/FAIL]
fix_up_cycles: 0
final_commit_sha: <sha>            # green commit pre-merge
merge_strategy: squash
merge_commit_sha: <sha>
rebase_cycles: 0
note: ""
```

## Exit criteria

- Branch pushed to origin.
- PR created and OPEN on origin.
- All required checks green on PR's HEAD commit.
- Fix-up cycle count ≤ 5 (or escalation completed).
- PR state is MERGED.
- Local main synced to merged commit.
- Branch deleted on origin (per `--delete-branch`).
- Deliverable carries `ci_stage_verdict: PASS`.
- `process/waves/wave-<N>/checklist.md` C-1 row checked.

## Next

→ `claudomat-brain/blocks/ci-cd/ci-cd.md` → C-2.
