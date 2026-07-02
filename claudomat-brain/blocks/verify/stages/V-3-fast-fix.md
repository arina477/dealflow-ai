# V-3 — Fast-fix

> **Block:** V (Verify), 6th of 8 in wave loop: `P → [D] → B → C → T → ` **`V`** ` → L → N`.
> **Stages:** V-1 → V-2 → **V-3 (gate / fast-fix loop)**. Advance on stage exit: Block exit per dispatcher (or close-without-fix per cap rules).
> **Pattern:** gate-only. head-verifier spawned HERE for verdict + drives fast-fix loop; reference card on demand at `~/.claude/agents/head-verifier.md`.
> **Dispatcher** (skip rules, fast-fix loop, gate semantics, exit handoff): `claudomat-brain/blocks/verify/verify.md`.

## Purpose

Block-exit gate for Verify + same-wave fast-fix loop for trivial blocking findings. Phase 1: spawn fresh head-verifier for independent verdict. Phase 2 (only on Phase 1 APPROVED + non-empty `fast_fix_queue`): process queue in <20 LOC rounds (cap 3); Karen always re-fires, jenny conditionally. REWORK from Phase 1 loops back to relevant V-stages.

## Prerequisites

- V-2 exited (queue may be empty — V-3 still runs Phase 1 either way).
- `process/waves/wave-<N>/blocks/V/review-artifacts.md` updated through V-2.
- READ `process/waves/wave-<N>/stages/V-2-triage.md` for the queue.

## Skip condition

V-3 NEVER skips entirely (Phase 1 always runs). Phase 2 (fast-fix queue) skips when V-2's `fast_fix_queue` is empty; Phase 1 still emits an APPROVED gate verdict.

---

## Actions

### Action 0 — Spawn fresh head-verifier for gate review (Phase 1)

Invoke `head-verifier` via the Agent tool. Pass:

- `process/waves/wave-<N>/blocks/V/review-artifacts.md` (the manifest)
- All deliverable files the manifest points at (V-1 Karen + jenny + summary, V-2 triage)
- This stage file (carries the verdict schema)

Direct the sub-agent to write the verdict to `process/waves/wave-<N>/blocks/V/gate-verdict.md` following the schema below.

### Gate-verdict schema (Phase 1)

```markdown
# Wave <N> — V-3 Verdict

**Reviewer:** head-verifier (fresh spawn, agentId <id>)
**Reviewed against:** process/waves/wave-<N>/blocks/V/review-artifacts.md
**Attempt:** <N>  (1 = first gate, 2+ = post-rework)

## Verdict
APPROVED | REWORK | ESCALATE

## Rationale
<one paragraph; cite Karen + jenny verdicts; cite triage classification quality>

## Rework instructions  (only if REWORK)

### Stages requiring rework
- <stage-id>: <one-line scope>

### Per stage

#### <stage-id>
- **What's wrong:** <e.g. V-2 classified a Karen REJECT as non-blocking but the cited claim is load-bearing for the spec contract>
- **Heuristic fired:** <named head-verifier heuristic, e.g. H-V-05: triage downgraded a load-bearing claim>
- **What "good" looks like:** <concrete success criteria>
- **Re-do instructions:** <ordered, executable steps; name re-spawn target if re-running Karen or jenny>

(repeat per affected stage)

### Cascade

V-block cascade rules:

| Trigger stage | Stages that must re-run downstream |
|---|---|
| V-1 Karen output | V-2 (triage classification depends on Karen findings) |
| V-1 jenny output | V-2 (triage classification depends on jenny findings) |
| V-2 triage | V-3 (fast-fix queue derives from triage) |

- **Stages that must re-run after the above:** <list, or "none">
- **Stages that stay untouched:** <list>

## Escalation  (only if ESCALATE)
- **Reason:** <e.g. Karen REJECT is structural — the wave's claims are fabricated at the spec level, fast-fix scope cannot resolve, B re-entry won't help>
- **Routing target:** <founder | BOARD | ceo-agent — per mode flag>
- **What's needed to unblock:** <specific>

## Footer
- verdict_complete: true | false
- rework_attempt_cap_remaining: <3 - N>
```

---

### Action 1 — Branch on Phase 1 verdict

| Verdict | Action |
|---|---|
| `APPROVED` | Proceed to Action 2 (fast-fix queue processing, or skip if queue is empty). |
| `REWORK` | Execute the verdict's "Rework instructions". Iron Law applies. On completion, re-enter Action 0. |
| `ESCALATE` | Route per mode flag in `process/session/.autonomous-session`. Pause loop until resolved. |

If `rework_attempt_cap_remaining == 0`, force-escalate.

---

### Action 2 — Process fast-fix queue (Phase 2; skip if empty)

If V-2's `fast_fix_queue` is empty, record the skip in the deliverable and proceed to block exit.

Otherwise, for each blocking finding in the queue, run the fast-fix sub-loop:

#### 2a — Identify target B-stage

Map the finding to its originating B-stage:

| Finding | Target B-stage |
|---|---|
| Karen: file/function missing | B-3 or B-4 (the stage that should have authored it) |
| Karen: route not registered | B-5 (wiring stage) |
| jenny: spec drift in API | B-3 |
| jenny: spec drift in UI | B-4 |
| T-6: off-token color | B-4 |
| T-7: bundle bloat from unused import | B-3 or B-4 |
| T-8: missing rate limit | B-3 |

The mapping isn't exhaustive; orchestrator applies judgment per `command-center/dev/triage-routing-table.md`.

#### 2b — Apply the fix

Fast-fix bypasses the full B-stage protocol — no deviation report, no `/simplify` requirement (though `/simplify` is recommended for any touched file).

**Iron Law applies even at fast-fix scope.** Orchestrator MUST spawn a specialist (per `command-center/dev/triage-routing-table.md`) OR invoke `/investigate` — never edit code directly. The 20 LOC threshold scopes SIZE; does NOT exempt from classify-and-route.

The specialist receives:
- Finding citation (source file:line, what's wrong).
- 20 LOC scope budget — explicit in the spawn prompt.
- Instruction to abort and report back if the fix exceeds budget rather than expanding silently.

If specialist reports >20 LOC, ABORT immediately:
1. Revert the in-progress fix.
2. Record the abort in the V-3 deliverable with the actual LOC needed.
3. Move the finding to B re-entry.

#### 2c — Commit + push

Commit message: `fix: V-3 fast-fix <short-finding-slug> for wave-<N>`. One commit per finding. PR already merged (C-2); fast-fix commits target `main`:

| Branch protection on `main` allows direct push? | Active mode | Fast-fix path |
|---|---|---|
| Yes | `automatic` or `degenerate` | Direct push to `main` |
| Yes | `founder-review` or `default` | Open small PR; founder/auto-merge approval per mode |
| No | Any mode | Open small fast-fix PR; under autonomous modes use `--auto` per C-2 mode-authorization table |

Default when uncertain: open a PR. Whichever path, the commit runs through CI before re-verification.

#### 2d — Wait for CI

Watch the CI run. If it fails, invoke `/investigate` per Iron Law.

#### 2e — Re-run Karen (and jenny conditionally) for affected scope

After fast-fix lands and CI green:

1. **Karen always re-fires.** Re-spawn scoped to the addressed finding.
2. **jenny re-fires conditionally** — yes when the fix touches spec-covered behavior; no when out-of-spec (T-block findings unrelated to spec contract).
3. Both required re-verifications must APPROVE.

If either rejects, classify per V-2: another round (within cap), or B re-entry.

---

### Action 3 — Iteration cap

**3 fast-fix rounds per wave** total. If 3 rounds don't clear the queue:
1. Move remaining items to B re-entry.
2. V-block exits via B re-entry path; expect re-run after B → C → T cycle.

---

### Action 4 — Cap escalation

If 3 rounds still leave blocking findings AND B re-entry isn't appropriate (structural issue), escalate per active mode:

| Mode | Escalation |
|---|---|
| `founder-review` / `default` | Founder picks: revert wave, accept findings as known-broken, or pause wave. |
| `automatic` | BOARD with decision-slug `V-3-cap-<wave-N>`. Append to `process/session/updates/board-digest-<DATE>.md`. |
| `degenerate` | ceo-agent within `ceo-blocklist.md` charter. Append to `process/session/updates/ceo-digest-<DATE>.md`. |

---

## Deliverable

`process/waves/wave-<N>/stages/V-3-fast-fix.md` — records each fast-fix attempt, LOC count, re-verification verdicts, cap escalation (if any), plus YAML footer:

```yaml
phase1_head_verifier_verdict: APPROVED
skipped: false                        # true if Phase 2 had empty queue
queue_items_processed: <n>
queue_items_fixed: <n>
queue_items_moved_to_b_re_entry: [list]
fast_fix_rounds: 0
loc_per_fix: [<finding>: <loc-count>]
re_verification:
  karen: APPROVE | REJECT
  jenny: APPROVE | REJECT
cap_escalation: false
escalation_destination: ""            # founder | board | ceo-agent | none
```

Plus block-exit handoff state appended to `process/waves/wave-<N>/blocks/V/review-artifacts.md` "Status" field:

```yaml
verify_block_status:    complete
karen_verdict:          APPROVE
jenny_verdict:          APPROVE
triaged_findings:
  blocking_resolved:    [list]
  non_blocking_tagged:  [list]
  noise_suppressed:     [count]
fast_fix_cycles:        <n>
ready_for_learn:        true
```

## Exit criteria

- Phase 1 head-verifier verdict = APPROVED
- Fast-fix queue is empty (every item fixed OR moved to B re-entry OR escalation resolved) — or queue was empty initially.
- Re-verification APPROVE from both Karen + jenny on the final fast-fix commit (when fast-fixes ran).
- Iteration cap respected.
- `process/waves/wave-<N>/blocks/V/review-artifacts.md` "Status" updated to `gate-passed`.
- `process/waves/wave-<N>/checklist.md` V-3 row is checked.

## Next

→ `claudomat-brain/DISPATCHER.md` → next block is **L** (Learn) — `read claudomat-brain/blocks/learn/learn.md`.

If exit is NOT clean (Karen or jenny REJECT remains, B re-entry items pending), V-block defers exit — the wave does NOT advance to L until verification fully clears.
