# L-block Gate Verdict — wave-8 (mandate spine)

**Gating head:** head-learn (spawn-pattern; owns L-block lifetime, dies at exit).
**Mode:** founder-review. **Wave shipped:** M4 mandate spine, live-verified at `e57be83`.
**Stages gated:** L-1 Docs ∥ L-2 Distill.

```json
{
  "agent": "head-learn",
  "stage": "L-gate",
  "status": "gating",
  "block_state": {
    "observations": 6,
    "promoted_rules": ["BUILD-PRINCIPLES.md rule 5"],
    "tasks_marked_done": ["ba0edebf", "c070ca23", "50227055"]
  }
}
```

## Verdict: **APPROVED**

Every L-1 and L-2 stage-exit checkbox ticks from concrete artifacts. One principle promoted, format-exact, 2-wave-confirmed, deterministically enforceable. No observation theater, no snacking, no human-blame, no over-promotion, no format rebellion, no compliance-gate degradation.

---

## L-1 Docs — stage-exit checklist

| Check | Result |
|---|---|
| Retrospective omits individual human error; names missing constraints/safeguards | PASS — every observation names a missing build convention / plan-authoring gap, never a developer |
| Uses "how"/local-rationality framing, not linear "why" | PASS |
| Acknowledges degraded prior state where relevant | PASS — OBS-W8-1 notes the config comment asserted the opposite (latent wrong mental model) |
| Every anomaly paired with a corrective control | PASS — each observation traces to the fix commit (37998bb, a061c57, 0007, /mandates-data proxy) |
| Plan-authoring defect: names the missing context at decision time | PASS — every observation carries a "Plan-authoring defect trace" |
| Precise domain vocabulary | PASS |
| Each defect traces to introducing error AND why the test harness missed it | PASS — every observation states the green-CI/mock-shape miss explicitly |
| Names the observability/test sensor that failed | PASS — unit-test mock shapes + absent live-render, per observation |
| Reality-check states contradiction vs MVP mental model | PASS — all 6 reality-checked against C-2/B-6 deliverable text |
| Decisions list alternatives + trade-offs | PASS — L-2 records the C1-vs-C2 stack-rank + C3 rejection rationale |
| Tactical containment separated from strategic management | PASS |
| CHANGELOG entry appended | PASS — `[0.8.0]` already authored (headline + Added + Compliance/safety + Deferred) |
| Milestone delta evaluated | PASS — M4 stays `in_progress` (3 open / 3 done, `open_count>0`); NOT closed; buyer-universe bundle remains |

**Milestone-delta judgment:** mechanical, no ambiguity — M4 has 3 open child tasks, so it cannot structurally complete. No mode-escalation needed. Closing M4 this wave would have been a Drift-Normalization / premature-completion error; correctly avoided.

## L-2 Distill — stage-exit checklist

| Check | Result |
|---|---|
| Promotion queue holds exactly 0 or 1 principle | PASS — 1 promoted (BUILD rule 5); the one-per-wave line held despite 3 gate-passing candidates |
| Matches target Contract format exactly (rule + Why + sequential number) | PASS — rule 5 follows rule 4; deterministic linter `linter:OK` |
| Free of war stories / wave refs / incident ids / cross-refs | PASS — no forbidden tokens; linter clean |
| Enforces broadly across the stack, not a hyper-specific edge | PASS — any client/endpoint parse site, stack-agnostic (outranked the Next.js-specific C1) |
| `Why` states the concrete failure mode | PASS — "wrong-shape mock passes CI while the live client mis-parses ids and raises false errors" |
| No contradiction / duplication vs existing invariants | PASS — karen confirmed no collision with VERIFY-1 (server recompute) or VERIFY-2 |
| Durable structural invariant, not a transient patch | PASS — an authoring-layer contract, not a one-off band-aid |
| Deterministic, testable assertion | PASS — gradeable against the shared-Zod contract at the parse site |
| Enforceable via computational sensors, not manual steps | PASS — parse site vs declared return type is mechanically checkable |
| Addresses a core capability / existential risk, not a stylistic snack | PASS — the create→detail vertical was dead for real users; false-error + retry-duplication |
| Rests on L-1 reality-checked data at MVP scale | PASS — reality-checked against live-deploy verification, not web-scale theory |
| Every claimed_task_id done + verified | PASS — UPDATE 3, Action 2 confirmed all `done` |
| ≤1 promotion per file | PASS — 1 BUILD, 0 VERIFY |

---

## Anti-pattern scan (halt-and-check)

- **Observation Theater** — CLEAR. Every observation maps a symptom to a validation-harness gap + a corrective control.
- **The Snacking Trap** — CLEAR. Promoted rule targets a reliability/compliance-critical vertical (dead create flow), not aesthetics. C3 (soft V-block render ritual) was rejected precisely to avoid a high-noise snack.
- **Root Cause Fallacy** — CLEAR. No human-blame; every root is a missing convention/guardrail (the "second story").
- **Temporary Fix Promotion** — CLEAR. Rule 5 is a durable authoring invariant, not a single-module band-aid.
- **Formatting Rebellion** — CLEAR. Linter `linter:OK`; two lines, no preamble/cross-ref/wave ref.
- **Over-Promotion Rule Fatigue** — CLEAR. Three candidates passed the 2-wave gate; consolidated to ONE via explicit stack-rank. This is the single hardest constraint and it held.
- **Extraction Collapse via Unverifiable Rules** — CLEAR (and actively enforced). C3 was rejected exactly because it was not mechanically gradeable.
- **Missing the Compliance Gate** — CLEAR. Compliance findings (active-lock state-machine, ambiguous-disclaimer-409 + DB uniqueness) were captured as first-observations and their fixes are live (C-2 confirms 409/lock behavior + 0007 index). No compliance degradation for speed.
- **Chesterton's Fence Deletion** — CLEAR. The colliding rewrite removed had a documented (wrong) intent; the fix preserved SSR + proxied client mutation rather than blindly deleting.
- **Phantom Principle Duplication** — CLEAR. karen ran the collision check vs VERIFY-1/2; no overlap.

---

## Promotion record

**File:** `command-center/principles/BUILD-PRINCIPLES.md`
**Rule 5 (new):**
```
5. Author every client parse of an API response against that endpoint's real return shape, not an assumed wrapper.
   Why: A wrong-shape mock passes CI while the live client mis-parses ids and raises false errors.
```
Linter: `linter:OK`. karen: APPROVE. Cross-wave: confirms OBS-W7-2 (2nd firing).

**Rejected-approach lineage (recorded for audit):**
- OBS-W8-1 (Family A route-collision) — RUNNER-UP; gate-passing + enforceable but narrower (Next.js-specific). Held as CONFIRMED-AND-READY; promote next wave the parse-shape family does not also occupy the BUILD slot.
- OBS-W8-6 / C3 (VERIFY live-render mandate) — REJECTED; not deterministically checkable, grab-bag Why, overlaps VERIFY-2. Carry-forward requires a single mechanically-checkable rewording.

---

## Block exit / handoff

```yaml
learn_block_status:    complete
changelog_entry:       "CHANGELOG.md [0.8.0] (pre-authored L-1 doc; verified present)"
roadmap_milestone_progress:
  - {milestone: "M4 — Mandates & buyer universe", before: in_progress, after: in_progress}   # NOT closed: 3 open child tasks (buyer-universe builder)
tasks_marked_done: [ba0edebf, c070ca23, 50227055]
observations_emitted:  6
principles_promoted:   ["BUILD-PRINCIPLES.md: Author every client parse of an API response against the endpoint's real return shape, not an assumed wrapper."]
ready_for_next:        true
```

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-gate
  reviewers:
    observation_synthesis: knowledge-synthesizer (6 observations, reality-checked by head-learn)
    promotion_vetting: karen (C2 APPROVE, C1 runner-up, C3 REJECT)
  failed_checks: []
  rationale: >
    Both L-stages exit clean. Six systemic, plan-authoring-defect-traced observations,
    each reality-checked against the actual C-2 and B-6 deliverable text (including a
    corrected migration-row count). Three candidates passed the 2-wave confirmation gate;
    head-learn held the one-principle-per-wave line and promoted the single most cross-cutting,
    highest-recurrence, deterministically-enforceable rule (client parse against the real API
    response shape — confirms wave-7 OBS-W7-2, fired 3x within wave-8). The Next.js route-collision
    runner-up is held CONFIRMED-AND-READY; the VERIFY live-render candidate was rejected as
    unverifiable observation-theater. Promoted rule passed karen and the deterministic linter
    first-pass; no format rebellion, no duplication with VERIFY-1/2, no compliance degradation.
    M4 correctly stays in_progress (buyer-universe builder bundle remains).
  next_action: PROCEED_TO_N
```

→ next block: `claudomat-brain/blocks/next/next.md`. Wave NOT yet archived — N-3 owns the single archive move.
