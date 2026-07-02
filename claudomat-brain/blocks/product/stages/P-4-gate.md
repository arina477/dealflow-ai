# P-4 — Gate

> **Block:** P (Product), 1st of 8 in wave loop: **`P`** ` → [D] → B → C → T → V → L → N`.
> **Stages:** P-0 → P-1 → P-2 → P-3 → **P-4 (gate)**. Advance on stage exit: Block exit per dispatcher.
> **Pattern:** gate-only. head-product spawned HERE for verdict; reference card on demand at `~/.claude/agents/head-product.md`.
> **Dispatcher** (skip rules, gate semantics, exit handoff): `claudomat-brain/blocks/product/product.md`.

## Purpose
Block-exit gate for Product. Two phases:

1. **Phase 1.** Spawn fresh head-product sub-agent; issues independent verdict on P-block deliverables per schema below.
2. **Phase 2.** Only on Phase 1 = `APPROVED`: `karen` + `jenny` (must APPROVE) plus a Gemini cross-model review that is **advisory-and-degradable** — it passes the gate on APPROVE *or* UNAVAILABLE, and only blocks on a material CONCERN.

REWORK from either phase loops back to relevant P-stages.

## Prerequisites
- P-2 complete (spec contract in the primary task's `tasks.description`)
- P-3 complete (`process/waves/wave-<N>/stages/P-3-plan.md`)
- `process/waves/wave-<N>/blocks/P/review-artifacts.md` updated through P-3
- `command-center/AGENTS.md` lists `karen`, `jenny`; `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) exported; `python3` on PATH

---

## Actions

### Action 0 — Spawn fresh head-product for gate review (Phase 1)

Invoke `head-product` via the Agent tool. Pass:

- `process/waves/wave-<N>/blocks/P/review-artifacts.md` (the manifest)
- All deliverable files the manifest points at:
  - `process/waves/wave-<N>/stages/P-0-frame.md`
  - `process/waves/wave-<N>/stages/P-1-decompose.md`
  - `process/waves/wave-<N>/stages/P-2-spec.md` (or absent if P-0 short-circuit returned `valid`)
  - `process/waves/wave-<N>/stages/P-3-plan.md`
- This stage file (carries the verdict schema)

Direct the sub-agent to write the verdict to `process/waves/wave-<N>/blocks/P/gate-verdict.md` following the schema below — exact fields, exact sections.

### Gate-verdict schema (Phase 1)

```markdown
# Wave <N> — P-4 Verdict

**Reviewer:** head-product (fresh spawn, agentId <id>)
**Reviewed against:** process/waves/wave-<N>/blocks/P/review-artifacts.md
**Attempt:** <N>  (1 = first gate, 2+ = post-rework)
**Phase:** 1 (head-product) | 2 (Karen+jenny+Gemini merged)

## Verdict
APPROVED | REWORK | ESCALATE

## Rationale
<one paragraph in plain language>

## Rework instructions  (only if REWORK)

### Stages requiring rework
- <stage-id>: <one-line scope>

### Per stage

#### <stage-id>
- **What's wrong:** <specific failure>
- **Heuristic fired:** <named head-product heuristic, e.g. H-P-12: spec lacks measurable acceptance criteria>
- **What "good" looks like:** <concrete success criteria>
- **Re-do instructions:** <ordered, executable steps a non-product-expert can follow>

(repeat per affected stage)

### Cascade

P-block cascade rules (apply where the rework stage is the trigger):

| Trigger stage | Stages that must re-run downstream |
|---|---|
| P-0 frame | P-1, P-2, P-3 |
| P-1 decompose | P-2 (claimed_task_ids), P-3 (parallelization map) |
| P-2 spec | P-3 (approach + plan derive from spec) |
| P-3 plan | (terminal — only itself) |

- **Stages that must re-run after the above:** <list, or "none">
- **Stages that stay untouched:** <list>

## Escalation  (only if ESCALATE)
- **Reason:** <missing prerequisite, charter conflict, structural gap that orchestrator cannot resolve>
- **Routing target:** <founder | BOARD | ceo-agent — per mode flag in process/session/.autonomous-session>
- **What's needed to unblock:** <specific>

## Footer
- verdict_complete: true | false
- rework_attempt_cap_remaining: <3 - N>
```

---

### Action 1 — Branch on Phase 1 verdict

Read `process/waves/wave-<N>/blocks/P/gate-verdict.md`. Then:

| Verdict | Action |
|---|---|
| `APPROVED` | Proceed to Action 2 (Phase 2 reviewers). |
| `REWORK` | Execute the verdict's "Rework instructions". Verdict carries the expertise the rework needs. On completion, re-enter Action 0 (fresh spawn, attempt N+1). |
| `ESCALATE` | Route per mode flag in `process/session/.autonomous-session`: `founder-review` / `default` → founder; `automatic` → BOARD (`process/session/updates/board-digest-<DATE>.md`); `degenerate` → ceo-agent (`process/session/updates/ceo-digest-<DATE>.md`). Pause loop until resolved. |

If `rework_attempt_cap_remaining == 0` after a REWORK verdict, force-escalate per mode flag instead of looping again. Do not re-spawn.

**Security-scope tightened gate.** Wave's `wave_touches` ∩ `{auth, payments, sessions, csrf, rate-limit, user-creation}` ≠ ∅ AND first Phase 2 pass returns BLOCK with **>2 medium-or-higher findings** → gate forces a second Phase 2 iteration after rework. Cap remains 3 attempts total; security rule guarantees ≥2 Phase 2 iterations before exit.

---

### Action 2 — Phase 2 reviewers (Karen + jenny + Gemini, parallel)

Run all three in parallel — independent, no shared context. Spawn `karen` and `jenny` via the Agent tool in a single message, and run the Gemini helper (below) alongside:

**`karen`** — verifies load-bearing claims in spec + plan. Spot-checks 3-5 file paths, line numbers, function names, SDK method signatures via Read / Grep / Bash. Applies the antipatterns catalog from `command-center/principles/PRODUCT-PRINCIPLES.md`. Output: per-claim `VERIFIED` / `UNVERIFIED` / `WRONG`.

**`jenny`** — cross-references spec + plan against `command-center/artifacts/user-journey-map.md` and `command-center/product/product-decisions.md` for drift. Output: per-spec-item `MATCHES` / `DRIFTS` (with the conflicting prior decision named).

**Gemini cross-model review** — single-shot, non-agentic adversarial review via the
Gemini REST API (no tools = it cannot wander off exploring; bounded by a per-attempt
timeout with one retry). Helper: `claudomat-brain/blocks/product/scripts/gemini-cross-review.py`.

```bash
cat process/waves/wave-<N>/stages/P-2-spec.md \
    process/waves/wave-<N>/stages/P-3-plan.md \
    process/waves/wave-<N>/stages/P-0-frame.md \
    process/waves/wave-<N>/stages/P-1-decompose.md \
| python3 claudomat-brain/blocks/product/scripts/gemini-cross-review.py \
  > process/waves/wave-<N>/stages/P-4-gemini-review.md
echo "gemini-cross-review exit=$?"   # 0 = review produced; non-zero = UNAVAILABLE (degrade)
```

Requires `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) exported and `python3` on PATH. If the
command exits non-zero — or `P-4-gemini-review.md` begins with `UNAVAILABLE:` — the
cross-review is **unavailable**; record it and proceed (see Action 3). Do **not** retry
in the stage or block on it; the helper already retried once.

---

### Action 3 — Merge Phase 2 verdicts

`karen` and `jenny` must APPROVE. The Gemini cross-review passes the gate on **APPROVE or UNAVAILABLE**, and blocks only on a **material CONCERN**.

| Reviewer | Verdict | Effect |
|---|---|---|
| Karen | any UNVERIFIED or WRONG | back to P-2 / P-3 to fix the cited claims |
| jenny | DRIFTS | back to P-2 to align with the conflicting prior decision OR document why drift is intentional in `product-decisions.md` |
| Gemini | material CONCERN | re-spawn head-product to triage; if confirmed material, back to the relevant P-stage; if not material, log and proceed |
| Gemini | **UNAVAILABLE** (helper exit ≠ 0, or review file begins `UNAVAILABLE:`) | record `UNAVAILABLE` + the reason in `gate-verdict.md`; **do not block** — proceed on Karen + jenny |
| Karen + jenny APPROVE (Gemini APPROVE *or* UNAVAILABLE) | | exit P-block |

Append Phase 2 summary to `process/waves/wave-<N>/blocks/P/gate-verdict.md` recording per-reviewer status. Do not overwrite Phase 1 — append.

Orchestrator does NOT arbitrate reviewer verdicts. Reviewers are independent.

---

### Action 4 — Emit the spec contract

On gate pass, the wave's primary `tasks` row already carries the spec-contract YAML head written at P-2 Action 5 (per `claudomat-brain/db/SCHEMA.md` § structured-content carve-outs). The row's `status` stays `'todo'` until B-0 claims it.

Gate-passage evidence lives in the wave's FS deliverable (`process/waves/wave-<N>/blocks/P/gate-verdict.md`), not the DB — the gate verdict is a per-wave artifact, not task-row metadata. B-0 verifies gate passage by reading the gate-verdict file before claiming.

---

## Deliverable
- `process/waves/wave-<N>/blocks/P/gate-verdict.md` — Phase 1 (head-product) + Phase 2 (Karen+jenny+Gemini) merged verdicts; B-0 reads this before claim.
- `process/waves/wave-<N>/stages/P-4-gemini-review.md` — Gemini raw output (may legitimately be a single `UNAVAILABLE:` line when the cross-review degraded).

## Exit criteria
- Phase 1 head-product verdict = APPROVED
- Phase 2: Karen + jenny returned APPROVE; Gemini cross-review returned APPROVE or UNAVAILABLE (a material CONCERN must have been triaged and cleared)
- Spec contract present in the primary `tasks.description` as YAML head + `---` + prose (authored at P-2 Action 5)
- Gate-verdict file authored with gate-pass evidence (per-reviewer statuses recorded, including any Gemini `UNAVAILABLE`)
- `process/waves/wave-<N>/blocks/P/review-artifacts.md` "Status" updated to `gate-passed`
- `process/waves/wave-<N>/checklist.md` P-4 box ticked

## Next
- If `design_gap_flag == true` → `D-1 Brief` (`../../design/design.md`).
- If `design_gap_flag == false` → `B-0 Branch & schema` (`../../build/build.md`).
