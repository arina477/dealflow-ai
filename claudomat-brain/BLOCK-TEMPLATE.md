# Block dispatcher template

Every `claudomat-brain/blocks/<X>/<X>.md` follows this skeleton. Authors keep sections in this order; sections marked optional are omitted when not applicable.

The dispatcher describes the **workflow** between stages — what runs when, what hard dependencies hold, what skip rules apply, what state emits at exit. It does NOT describe persona mechanics (head-X gate spawn) — those are stage-file content.

---

```markdown
# <X> — <Name> Block Dispatcher

**Purpose.** <one paragraph>
**When it runs.** <one paragraph; cite the upstream block exit condition>

## Stage sequence

```
<X-1> → <X-2> → … → <X-N> → exit
```

| Stage | File | Responsibility |
|---|---|---|
| **<X-1>** | `stages/<X-1>-<name>.md` | <one line> |
| ... | ... | ... |

## Deliverable footer (every <X>-stage)

```yaml
stage_verdict: PASS                   # or HOLD
signoff_note: ""
<block-specific common fields>
```

## Block-level skip rules
<Per-stage skips defined in stage files; this section names block-level skip exceptions only.>

## <Block-specific topic 1>  (optional — only when applicable)
<Each genuinely block-spanning concern gets its own H2. Examples: hard-dependency
explanation, parallelization rules, iteration caps + escalation matrix, fast-path
exceptions, mode-aware behavior, sub-agent spawning protocol. One H2 per topic —
do NOT group under a single "Block-specific semantics" parent.>

## <Block-specific topic 2>  (optional)
...

## Block exit / handoff

```yaml
<x>_block_status: complete
<state fields emitted to next block via review-artifacts.md or checklist>
```

→ next block: `claudomat-brain/blocks/<next>/<next>.md`

## File layout per wave  (optional — only when stages produce multi-file outputs)
<tree showing per-wave file shape inside process/waves/wave-<N>/>

## References
- Spec contract — `process/waves/wave-<N>/stages/P-2-spec.md`
- Plan — `process/waves/wave-<N>/stages/P-3-plan.md`
- <other reads>
- Path conventions — `claudomat-brain/process/process-paths.md`
```

---

## Authoring rules

1. **No persona-model section.** head-X gate-spawn instructions live in the exit-gate stage file, not here. The dispatcher orders stages; the gate stage executes the spawn.
2. **No review-artifacts-manifest meta-section.** The entry stage seeds it; the exit-gate stage spawns the reader. Cross-referenced by name when needed, not introduced.
3. **No "headless block" explanation.** C / L / N blocks have no gate-spawn (external verdicts / mechanical work); the deliverable footer schema is sufficient signal.
4. **One H2 per block-spanning topic.** Hard dependencies (B-0 gates everything), parallelization within a stage (B-2 sub-agents), iteration caps (D-2 bounded refine cap), mode-aware escalation tables — each gets its own named H2 between "Block-level skip rules" and "Block exit / handoff". Don't group under a single "Block-specific semantics" parent. Stage-specific behavior stays in the stage file, not the dispatcher.
5. **Block exit / handoff** carries the state shape downstream blocks read. Don't restate it in stage files — point at the dispatcher.
6. **No history.** No V1 references, no "was conditional", no migration notes. CHANGELOG owns that.
