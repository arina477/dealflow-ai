# Stage file template

Every `claudomat-brain/blocks/<X>/stages/<X-N>-<name>.md` follows this skeleton. Authors keep sections in this order; sections marked optional are omitted when not applicable.

---

```markdown
# <X-N> — <Name>

## Purpose
<1–3 sentences. What this stage does. No history, no comparisons.>

## Prerequisites
- <Prior stage exited with required deliverable>
- READ <required brain or project file>

## <Stage-specific reference block>  (optional — when the stage's actions reference a non-trivial spec / rubric / pattern declaration)
<Examples: T-stages declare `## Pattern` (A — Verified-via-CI / B — Active-execution).
P-1 declares `## Size rubric (deterministic)` with the four thresholds.
Use a named H2 only when the content is genuinely a reference table or contract
the actions consume — not for narrative.>

## Skip condition  (optional — only when the stage has a real skip rule)
<one-line rule>

## Actions

### Action 0 — <Block-entry only: seed review-artifacts manifest.
### Action 0 — <Block-exit gate only: spawn fresh head-<X> sub-agent for verdict.
### Action 1 — <Name>
<concrete instructions>

### Action 2 — <Name>
<concrete instructions>

...

## Deliverable

`process/waves/wave-<N>/stages/<X-N>-<name>.md` — <one-line summary>:

```yaml
<stage-specific fields>
```

Also: <update review-artifacts.md row; append to findings-aggregate; commit X — only when applicable>

## Exit criteria
- <bullet>
- <bullet>
- `process/waves/wave-<N>/checklist.md` `<X-N>` row is checked

## Next
→ <next stage file path>
```

---

## Authoring rules

1. **No history.** Don't reference V1, "(was X)", "previously", or migration rationale. The CHANGELOG owns that.
2. **No meta-explanations.** Don't explain what fresh-spawn means or why the layout exists. The orchestrator already knows.
3. **No cross-reference noise.** "Per `claudomat-brain/process/process-paths.md`" / "see `claudomat-brain/blocks/<X>/<X>.md`" only when the reader needs to fetch real content from there. Don't sprinkle for orientation.
4. **Action 0 is reserved.** Only the block-entry stage (manifest seed) and the block-exit gate stage (head-X spawn) carry an Action 0. All other stages start at Action 1.
5. **Deliverable schema is concrete YAML.** No prose substitutes for the schema.
6. **Cascade and verdict templates** (only in block-exit gate stages) live inline in the stage file as fenced code blocks — no fragment files.
