# D-3 — Review & Adopt Gate (dual-reviewer protocol)

Two reviewers run in parallel on every staging design. Fresh context per reviewer (no shared state). Both must APPROVE before D-3 adopts.

---

## Reviewer roster

### Reviewer A — `/plan-design-review`

**Role:** design critique with 0-10 per-dimension scoring + what would make each a 10.

**Input:** staging HTML + brief + `design/DESIGN-SYSTEM.md` as reference.

**Output:** `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-plan-design-review.md` containing:

- Per-dimension scores (visual hierarchy, spacing rhythm, brand coherence, edge-case handling, accessibility, responsive behavior)
- For each dimension < 8: what concrete change would move it to 10
- Overall verdict: APPROVE / REVISE / REJECT
- If REVISE/REJECT: enumerated change requests each citing the brief § X or DESIGN-SYSTEM.md § Y

### Reviewer B — `/ui-ux-pro-max`

**Role:** requirement + UX best-practice check against the brief's success criteria.

**Input:** staging HTML + brief + `design/DESIGN-SYSTEM.md` + relevant icon SDK doc (`command-center/dev/SDK-Docs/<icon-lib>/<icon-lib>-sdk.md`).

**Output:** `process/waves/wave-<N>/stages/D-3-review-and-adopt/<feature>-ui-ux-pro-max.md` containing:

- Checkbox audit of brief § 9 success criteria (each: PASS / FAIL / PARTIAL)
- UX flow audit: does the design enable the user to accomplish the stated goal? Enumerate friction points.
- DESIGN-SYSTEM.md token audit: list every color / font-size / shadow / border-radius actually used and confirm each matches a system token (flag invented values)
- Icon audit: every icon reference is a real component name in the project's icon library
- Overall verdict: APPROVE / REVISE / REJECT
- If REVISE/REJECT: prioritized change list

---

## Reviewer substitution

If a project replaces one of the reviewers (e.g., `/ui-ux-pro-max` not installed), document the substitution here with a dated edit. The D-loop is reviewer-agnostic — what matters is the dual-reviewer + APPROVE/APPROVE exit contract.

---

## Spawning both reviewers in parallel

Both agents launch in the same orchestrator message to run concurrently:

```
Spawn message batch:
  - Agent(description="D-3 reviewer A — design critique", subagent_type="<appropriate>", prompt=<A brief>)
  - Agent(description="D-3 reviewer B — ux/req match", subagent_type="<appropriate>", prompt=<B brief>)
```

Both reviewers receive:

1. Required reading: their agent card at `~/.claude/agents/<name>.md` (loaded by the harness) + the brief + staging HTML path
2. The DESIGN-SYSTEM.md path
3. Explicit output file path
4. Verdict format (APPROVE / REVISE / REJECT + concrete concerns)

Both MUST NOT see each other's output. Orchestrator reconciles at D-3 close.

---

## Reconciliation matrix

| Reviewer A | Reviewer B | Action |
|---|---|---|
| APPROVE | APPROVE | → D-3 adopt |
| APPROVE | REVISE | Treat as REVISE; aggregate B's concerns → D-2 → D-3 iterate |
| REVISE | APPROVE | Treat as REVISE; aggregate A's concerns → D-2 → D-3 iterate |
| REVISE | REVISE | Aggregate both concern sets → D-2 → D-3 iterate |
| APPROVE | REJECT | Reject wins; aggregate B's concerns → D-2 → D-3 iterate or escalate |
| REJECT | APPROVE | Reject wins; aggregate A's concerns → D-2 → D-3 iterate or escalate |
| REJECT | REJECT | Aggregate both rejections → D-2 → D-3 iterate with major pivot, OR escalate |

Iteration cap: **3**. If D-2 → D-3 runs 3 times without both APPROVE, escalate per the D-block dispatcher's 3-cap escalation branch.

---

## Feedback aggregation for refine_design

When looping back to D-2, build a single consolidated prompt for `/aidesigner refine_design`:

```
Previous iteration: <path to staging/<feature>.html>
Reviewer A concerns (plan-design-review):
  - [concrete change request, cited to brief § X]
  - [concrete change request, cited to DESIGN-SYSTEM.md § Y]
Reviewer B concerns (ui-ux-pro-max):
  - [concrete change request]
  - [concrete change request]

Preserve: [elements both reviewers approved]
Change: [concrete deltas]
```

Each refine instruction must be actionable and measurable — never "just make it better".

---

## Anti-patterns

| Don't | Why |
|---|---|
| Invoke reviewers on a pristine staging HTML lacking the brief's § 4 token references | Reviewers will reject. Brief quality is a D-1 problem; don't push it to D-3. |
| Let reviewers talk to each other | Independence = signal. Contingent verdicts contaminate output. |
| Count REVISE as "same as APPROVE but with notes" | REVISE means loop back. Only both APPROVE exits the loop. |
| Skip the DESIGN-SYSTEM.md token audit (Reviewer B's third bullet) | Invented hex values or one-off spacings are the #1 drift vector. |
