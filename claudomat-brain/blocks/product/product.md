# P — Product Block Dispatcher

Turn a roadmap item or task signal into a build-ready spec contract. Frame, decompose, author spec + plan, and gate with three independent reviewers before emitting to the build queue.

**When it runs.** Every wave, at the head of the loop. Hands off to `D` if `design_gap_flag: true`, otherwise to `B`.

## Stage sequence

```
P-0 → P-1 → P-2 → P-3 → P-4 → exit
```

| Stage | File | Responsibility |
|---|---|---|
| **P-0** | `stages/P-0-frame.md` | Block-entry: prior-work query, roadmap alignment, product-decisions backlog scan, spec-contract short-circuit check, then symptom-vs-cause + antipatterns red-team (problem-framer + ceo-reviewer + conditional mvp-thinner in parallel) |
| **P-1** | `stages/P-1-decompose.md` | Size rubric (4 thresholds, OR logic), sibling extraction, RESCOPE-AUTO-SPLIT, `design_gap_flag` emission |
| **P-2** | `stages/P-2-spec.md` | Acceptance criteria, observable contracts, edge cases, error states; write spec contract into the primary task's `tasks.description` |
| **P-3** | `stages/P-3-plan.md` | Architecture deltas, data model, API contracts, dep list (approach), then file-level steps, specialist routing, parallelization map (plan) |
| **P-4** | `stages/P-4-gate.md` | Two-phase gate (head-product + Karen/jenny/Gemini-cross-review) |

## Block-level skip rules

P-block never skips. Every wave needs a verified spec contract before B can start. Per-stage skip conditions live in each stage file's `Prerequisites` section.

## Spec-contract short-circuit

P-0 reads the next-claimable task's `description` and looks for a fenced YAML block at the head (followed by `---` separator) — the spec-contract carve-out per `claudomat-brain/db/SCHEMA.md`. If present and well-formed, P-0 emits one verdict:

| Verdict | Effect |
|---|---|
| `valid` | YAML parses + `created-at` is recent + every `claimed_task_ids` entry resolves. Skip P-2; verify P-3 still holds; re-author only if drifted. Proceed to P-4. |
| `stale` | YAML parses but `created-at` is older than the freshness threshold OR `claimed_task_ids` references cancelled/done rows. Run full P-1..P-3 fresh. |
| `incomplete` | YAML parses but a required key is missing or malformed. Run P-2 to fill gaps; reuse P-3 if still valid. |
| `no-prior-spec` | No fenced YAML head. Full P-1..P-3 run. |

P-0's reframe sub-actions (problem-framer + ceo-reviewer + conditional mvp-thinner) and P-1 always run regardless.

## Gate semantics — P-4

Two phases, both must pass:

1. **Phase 1** — Fresh head-product sub-agent issues `APPROVED | REWORK | ESCALATE`.
2. **Phase 2** (only on Phase 1 = APPROVED) — `karen` + `jenny` + a Gemini cross-model review, in parallel. Karen + jenny must APPROVE; the Gemini cross-review is **degradable** — it passes on APPROVE *or* UNAVAILABLE (timeout / error / no API key) and blocks only on a material CONCERN.

A Karen or jenny BLOCK — or a material Gemini CONCERN — halts the block until addressed at the failing P-stage; a Gemini UNAVAILABLE never blocks (the gate proceeds on Karen + jenny). Rework runs in neutral mode. Retry cap, cascade rules, escalation routing: `stages/P-4-gate.md`.

## Block exit / handoff

P-4 exit emits the spec contract into the primary task's `tasks.description` as a fenced YAML block at the head, followed by `---`, followed by prose body:

```yaml
spec-id:             wave-<N>-spec
wave_type:           single-spec | multi-spec
claimed_task_ids:    [primary-task-id, sibling-task-id-1, ...]   # primary + P-1 siblings
acceptance-criteria: [list]
contracts:           (types / Zod / OpenAPI references)
edge-cases:          [list]
design_gap_flag:     true | false
created-at:          <iso8601>
```

`claimed_task_ids` = `tasks` row IDs this wave operates on; B-0 marks all `'in_progress'`, L-2 marks all `'done'`. Siblings reference the primary via `parent_task_id` FK.

Next block:

| Condition | Next |
|---|---|
| `design_gap_flag == true` | `D` — `claudomat-brain/blocks/design/design.md` |
| `design_gap_flag == false` | `B` — `claudomat-brain/blocks/build/build.md` |

## References

- Roadmap surface — `milestones` and `founder_bets` tables (per `claudomat-brain/db/SCHEMA.md`); `command-center/product/product-decisions.md` (P-0 reads on FS)
- User journey — `command-center/artifacts/user-journey-map.md` (P-0, P-2, P-4)
- Block principles — `command-center/principles/PRODUCT-PRINCIPLES.md`
- Roadmap rituals — `claudomat-brain/ROADMAP/roadmap-lifecycle.md`, `roadmap-planning-ritual.md`
- External SDK pre-build — `claudomat-brain/rules/external-sdk-integration-rules.md` (P-3 if new SDK)
- Mode routing — `claudomat-brain/management/<mode>-mode.md` (P-0 autonomous decisions)
- Path conventions — `claudomat-brain/process/process-paths.md`
