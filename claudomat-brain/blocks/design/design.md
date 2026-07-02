# D — Design Block Dispatcher

**Purpose.** Resolve every design gap blocking the wave before B-block implementers spawn. Brief → variants (with bounded iteration) → review & adopt. Only legitimate path from design gap to canonical mockups in `design/`.

**When it runs.** Conditional. Fires only on `P-4 Gate` `design_gap_flag: true`. Otherwise skip to B.

## Stage sequence

```
D-1 → D-2 → D-3 → exit
```

| Stage | File | Responsibility |
|---|---|---|
| **D-1** | `stages/D-1-brief.md` | Audit gaps from P-1 + grep against `design/`; author one brief per gap from `design/brief-template.md` |
| **D-2** | `stages/D-2-variants.md` | `/aidesigner` generate (variants land in `design/staging/<feature>.html`); mode-aware human checkpoint; refine loop on D-3 backedge (cap 3 iterations) |
| **D-3** | `stages/D-3-review-and-adopt.md` | Three-phase gate: dual-reviewer pass (`/plan-design-review` + `/ui-ux-pro-max` parallel) → fresh head-designer spawn → canonicalization |

## Block-level skip rules

Whole D-block **skips** when `P-4 Gate` emits `design_gap_flag: false`.

**Absent-flag policy (load-bearing).** Missing `design_gap_flag` field → treat as `true`. Missing flag is a P-1 authoring defect; silently skipping D could miss real UI surface. Log missing-flag event in `process/waves/wave-<N>/checklist.md` for `/retro`.

Per-stage skip conditions live in stage files.

## D-3 Phase 1 reviewer semantics

Two independent reviewers in parallel, both required:

- **`/plan-design-review`** — per-dimension 0–10 scoring (visual hierarchy, spacing rhythm, brand coherence, edge-case handling, accessibility, responsive behavior) + "what would make each a 10".
- **`/ui-ux-pro-max`** — checkbox audit of brief success criteria, UX flow audit, `DESIGN-SYSTEM.md` token audit, Phosphor icon audit.

Each returns: **APPROVE** / **REVISE** / **REJECT** + concrete concerns cited against brief or `design/DESIGN-SYSTEM.md`.

**Reconciliation matrix:**

| Reviewer A | Reviewer B | Action |
|---|---|---|
| APPROVE | APPROVE | → D-3 Phase 2 (head-designer spawn) |
| APPROVE | REVISE | Aggregate B's concerns → D-2 refine |
| REVISE | APPROVE | Aggregate A's concerns → D-2 refine |
| REVISE | REVISE | Aggregate both → D-2 refine |
| APPROVE | REJECT | Reject wins → D-2 refine or escalate |
| REJECT | APPROVE | Reject wins → D-2 refine or escalate |
| REJECT | REJECT | Aggregate both → D-2 major refine OR escalate |

Both reviewers MUST run in fresh context with no awareness of each other's verdict.

## Iteration cap

D-2 → D-3 cycle runs at most **3 times per gap**. On 3-cap, escalate per active mode:

| Mode | Escalation path |
|---|---|
| `founder-review` / `default` | Founder picks: accept one staged attempt, defer to `bug-design` tag, or pause wave. |
| `automatic` | BOARD with decision-slug `D-block-3cap-<feature>` per `claudomat-brain/management/conflict-resolution.md`. Append to `process/session/updates/board-digest-<DATE>.md`. |
| `degenerate` | BOARD first; on split or HARD-STOP, ceo-agent within `claudomat-brain/management/ceo-blocklist.md` charter. Append to `process/session/updates/ceo-digest-<DATE>.md`. |

On 3-cap, all 3 staging attempts move to `design/staging/_archive/wave-<N>-<feature>/`; consolidated concerns written to `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-escalation.md`.

## Mid-execution design-gap from B-block

B-stage implementer hits gap not caught at D-1 → audit failed. Recovery:

1. Pause the implementer.
2. Re-enter D-block at D-1 for just that gap. Run through D-3.
3. Log gap in `process/waves/wave-<N>/checklist.md` as **D-1 defect**.

>1 B-stage design-gap escalation per 10 waves → tighten D-1 grep pass.

## Non-blocking design findings

Issues from T-6 Layout / V-2 Triage that don't block current wave → **`bug-design` tag**, NOT `redesign`:

- `redesign` = follow-ups from prior frontend redesign batches.
- `bug-design` = newly surfaced design gaps.

Become input to future waves' P-1 (may set `design_gap_flag: true`).

## Block exit / handoff

```yaml
design_block_status:    complete
gaps_resolved:          [list]
gaps_deferred:          [list]            # bug-design tagged, non-blocking
design_system_updates:  [list of tokens]  # empty if none
canonicalized_at:       <iso8601>
```

→ next block: `claudomat-brain/blocks/build/build.md`

## File layout per wave

```
process/waves/wave-<N>/
  blocks/D/
    review-artifacts.md
    gate-verdict.md
  stages/
    D-1-brief/<feature>-brief.md
    D-1-brief/_audit.md                  # only if zero gaps
    D-2-variants/<feature>-variants.md
    D-2-variants/<feature>-iterate.md
    D-3-review-and-adopt/<feature>-plan-design-review.md
    D-3-review-and-adopt/<feature>-ui-ux-pro-max.md
    D-3-review-and-adopt/<feature>-reconciliation.md
    D-3-review-and-adopt/<feature>-adopt.md
    D-3-review-and-adopt/<feature>-escalation.md    # only if 3-cap hit

design/staging/<feature>.html                       # D-2 output, pre-approval
design/staging/_archive/wave-<N>-<feature>/         # only if 3-cap hit
design/<feature>.html                               # D-3 canonicalized
design/DESIGN-SYSTEM.md                             # D-3 conditional token additions
```

## References

- Brief template — `design/brief-template.md` (D-1)
- Review rubric — `design/review-gate.md` (D-3)
- Design system — `design/DESIGN-SYSTEM.md` (D-1, D-2, D-3)
- User journey — `command-center/artifacts/user-journey-map.md` (D-3 if new route)
- Block principles — `command-center/principles/DESIGN-PRINCIPLES.md`
- Mode routing — `claudomat-brain/management/<mode>-mode.md`
- Reviewer agents — `command-center/AGENTS.md` (`/plan-design-review`, `/ui-ux-pro-max`)
- Path conventions — `claudomat-brain/process/process-paths.md`
