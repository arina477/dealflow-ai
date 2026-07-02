# T-9 — Journey

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** T-1 → T-2 → T-3 → T-4 → T-5 → T-6 → T-7 → T-8 → **T-9 (gate)**. Advance on stage exit: Block exit per dispatcher.
> **Pattern:** gate-only. head-tester spawned HERE for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Block-exit gate for Test + conditional journey-map regeneration. Two phases:

1. **Phase 1.** Spawn fresh head-tester sub-agent for an independent verdict on T-block deliverables per the gate-verdict schema.
2. **Phase 2.** Only on Phase 1 = `APPROVED`: regenerate `command-center/artifacts/user-journey-map.md` against deployed prod state when the wave touched UI surface (skip-rule below); always run scenario smoke from `user-scenarios/` (if present).

Catches cross-wave regressions per-wave tests can't see. REWORK from either phase loops back to relevant T-stages.

## Pattern

**B — Active-execution.** (Phase 2 only — Phase 1 is gate spawn, not a test layer.)

## Prerequisites

- T-8 exited (or earlier T-stage if T-8 skipped).
- `process/waves/wave-<N>/blocks/T/review-artifacts.md` updated through T-8.
- `process/waves/wave-<N>/blocks/T/findings-aggregate.md` populated by prior T-stages.
- READ `command-center/artifacts/user-journey-map.md` (current canonical).
- READ `user-scenarios/` directory (if it exists).

---

## Actions

### Action 0 — Spawn fresh head-tester for gate review (Phase 1)

Invoke `head-tester` via the Agent tool. Pass:

- `process/waves/wave-<N>/blocks/T/review-artifacts.md` (manifest)
- `process/waves/wave-<N>/blocks/T/findings-aggregate.md` (cumulative findings)
- All deliverable files the manifest points at (T-1 through T-8)
- This stage file (carries verdict schema)

Direct sub-agent to write verdict to `process/waves/wave-<N>/blocks/T/gate-verdict.md` per the schema below.

### Gate-verdict schema (Phase 1)

```markdown
# Wave <N> — T-9 Verdict

**Reviewer:** head-tester (fresh spawn, agentId <id>)
**Reviewed against:** process/waves/wave-<N>/blocks/T/review-artifacts.md + findings-aggregate.md
**Attempt:** <N>  (1 = first gate, 2+ = post-rework)

## Verdict
APPROVED | REWORK | ESCALATE

## Rationale
<one paragraph; cite where coverage is adequate vs thin, where evidence is solid vs fabricated>

## Rework instructions  (only if REWORK)

### Stages requiring rework
- <stage-id>: <one-line scope>

### Per stage

#### <stage-id>
- **What's wrong:** <e.g. T-3 reported APPROVED but its evidence section cites only one of three contract endpoints>
- **Heuristic fired:** <named head-tester heuristic, e.g. H-T-04: evidence cites fewer surfaces than the wave touched>
- **What "good" looks like:** <concrete; cite which endpoints / scenarios / pages MUST be probed>
- **Re-do instructions:** <ordered, executable; name probes by command or specialist>

(repeat per affected stage)

### Cascade

T-block cascade rules:

| Trigger stage | Stages that must re-run downstream |
|---|---|
| T-1 static | (terminal — only itself) |
| T-2 unit | (terminal) |
| T-3 contract | T-4 (integration tests may inherit a contract assumption) |
| T-4 integration | (terminal) |
| T-5 e2e | T-9 (journey crawl re-runs against fixed UI) |
| T-6 layout | T-9 (journey may render differently after layout fix) |
| T-7 perf | (terminal) |
| T-8 security | T-9 (auth flow may render differently) |

- **Stages that must re-run after the above:** <list, or "none">
- **Stages that stay untouched:** <list>

## Escalation  (only if ESCALATE)
- **Reason:** <e.g. structural coverage gap orchestrator cannot fill — a test layer is unimplementable as currently scoped, or finding severity exceeds wave's risk budget>
- **Routing target:** <founder | BOARD | ceo-agent — per mode flag in process/session/.autonomous-session>
- **What's needed to unblock:** <specific>

## Footer
- verdict_complete: true | false
- rework_attempt_cap_remaining: <3 - N>
```

---

### Action 1 — Branch on Phase 1 verdict

| Verdict | Action |
|---|---|
| `APPROVED` | Proceed to Action 2 (journey crawl). |
| `REWORK` | Execute verdict's "Rework instructions". Iron Law: route fixes through specialists, never debug-by-deploy. On completion, re-enter Action 0. |
| `ESCALATE` | Route per mode flag in `process/session/.autonomous-session`. Pause loop until resolved. |

If `rework_attempt_cap_remaining == 0`, force-escalate.

---

### Action 2 — Journey-regen skip evaluation

Skip Action 3 (regen) and Action 5 (cross-wave regression check) when the wave did NOT touch the UI surface. Skip when ALL hold:

- `wave_type` does NOT include `ui` or `heavy`.
- D-block did NOT fire (`design_gap_flag: false` AND no `design/<feature>.html` was canonicalized).
- B-3 Frontend was skipped (`stages_skipped` contains B-3) OR no files under any frontend directory were touched in the wave's diff.

Otherwise (any UI-related signal present), regen is REQUIRED — proceed to Action 3.

On skip: record `journey_regen_skipped: true` with the cited skip reason in deliverable; the previous wave's `command-center/artifacts/user-journey-map.md` remains canonical. Action 4 (scenario smoke) still runs unconditionally if `user-scenarios/` exists.

### Action 3 — Crawl deployed state (skip per Action 2)

Use `/browse` (or equivalent) to walk the deployed app's primary user journeys:
- Anonymous landing → signup → onboarding → first session
- Buyer journey: browse → product → checkout → confirmation
- Seller journey: dashboard → list → orders
- Admin journey: dashboard → settings → users
- (Project-specific journeys per prior `user-journey-map.md`)

Capture: every route visited, every API call observed, every state transition, every UI surface rendered.

---

### Action 4 — Regenerate journey map (skip per Action 2)

Author a fresh `command-center/artifacts/user-journey-map.md` from the crawl. Compare against prior version:
- New routes/screens added by this wave → confirmed in map.
- Removed routes/screens (intentional removal) → confirmed absent.
- Routes that exist in code but no journey reaches → coverage gap finding.
- Journeys that previously worked but now break → regression finding.

If D-3 declared `journey_map_updated: true`, verify the D-3 entry is reflected in the regenerated map.

---

### Action 5 — Scenario smoke (conditional)

If `user-scenarios/` exists, for each scenario file:
1. Run scenario via `/browse` against prod.
2. Verify scenario's stated outcome.
3. Record per-scenario PASS/FAIL.

Failed scenarios are findings — classify per Action 6.

---

### Action 6 — Cross-wave regression check (skip per Action 2)

Compare today's journey crawl against most recent prior journey map. For every regression — a journey that worked then but fails now — verify:
- Was it intentional (declared in this wave's spec)? If yes, journey map needs an update entry, not a finding.
- Was it accidental? Critical finding — route to V-2 / B-block.

---

### Action 7 — Triage findings

Per Iron Law:
- **Critical (existing journey now broken, e.g., login flow regressed)** → hard stop unless wave is auth/session-related and the change is intentional. Re-enter B-block via `/investigate`.
- **Significant (new coverage gap, journey works but feels off)** → V-2 Triage.
- **Cosmetic (journey works, map needs minor wording update)** → fix in regen, no finding.

Append all findings to `process/waves/wave-<N>/blocks/T/findings-aggregate.md`.

---

### Action 8 — Commit the regenerated journey map (skip per Action 2)

```
git checkout main
git add command-center/artifacts/user-journey-map.md
git commit -m "docs(journey): T-9 regen for wave-<N>"
git push
```

Journey map committed to `main` directly (no PR — artifact regenerated every wave, not a code change). If project requires PRs for any change, a brief PR is acceptable.

---

## Deliverable

`process/waves/wave-<N>/stages/T-9-journey.md` — records crawl summary, regen diff vs prior map, scenario results, regression findings, plus YAML footer:

```yaml
phase1_head_tester_verdict: APPROVED
test_pattern: active
skipped: false
journey_regen_skipped: false           # true on non-UI waves per Action 2
journey_regen_skip_reason: ""          # populated when skipped
crawl_routes_visited: <count>          # 0 when regen skipped
regen_diff:
  routes_added: [list]
  routes_removed: [list]
  coverage_gaps: [list]
scenarios_run: <count>                # 0 if no user-scenarios/; runs even on regen-skip
scenarios_failed: 0
regressions_critical: 0
regressions_significant: 0
journey_map_commit: <sha-or-empty>     # empty when regen skipped
findings:
  - {severity, journey, description}
```

Plus block-exit handoff state appended to `process/waves/wave-<N>/blocks/T/review-artifacts.md` "Status" field:

```yaml
test_block_status:    complete
stages_run:           [list]
stages_skipped:       [list with reason]
findings_total:       <count>
findings_critical:    <count>
findings_aggregate:   process/waves/wave-<N>/blocks/T/findings-aggregate.md
journey_map_commit:   <sha>
ready_for_verify:     true
```

## Exit criteria

- Phase 1 head-tester verdict = APPROVED.
- Action 2 skip evaluation recorded.
- When regen ran: crawl complete, regen diff captured, cross-wave regression check complete, critical regressions resolved, journey map committed.
- When regen skipped: skip reason recorded; canonical journey map remains the prior wave's.
- Scenario smoke ran (or absence noted) regardless of regen-skip.
- `process/waves/wave-<N>/blocks/T/review-artifacts.md` "Status" updated to `gate-passed`.
- `process/waves/wave-<N>/checklist.md` T-9 row checked.

## Next

→ `claudomat-brain/DISPATCHER.md` → next block is **V** (Verify) — `read claudomat-brain/blocks/verify/verify.md`.
