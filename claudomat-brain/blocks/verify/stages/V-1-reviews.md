# V-1 — Independent reviews

> **Block:** V (Verify), 6th of 8 in wave loop: `P → [D] → B → C → T → ` **`V`** ` → L → N`.
> **Stages:** **V-1** → V-2 → V-3 (gate / fast-fix loop). Advance on stage exit: V-2.
> **Pattern:** gate-only. head-verifier spawned at V-3 for verdict; reference card on demand at `~/.claude/agents/head-verifier.md`.
> **Dispatcher** (skip rules, fast-fix loop, gate semantics, exit handoff): `claudomat-brain/blocks/verify/verify.md`.

## Purpose

Spawn Karen and jenny in parallel. Karen verifies the wave's load-bearing claims are true in the deployed state (files exist, functions are exported, routes are registered, env vars set, deploy serves the merge commit, the migration ran). jenny verifies deployed behavior matches spec contract intent — beyond the acceptance criteria T-block tested. Independence is the signal: jenny does NOT see Karen's output and vice versa.

Karen does NOT evaluate spec conformance (that's jenny). jenny does NOT evaluate source-claim truth (that's Karen). Together they cover both axes; alone neither does.

## Prerequisites

- T-9 exited with aggregated findings.
- READ `process/waves/wave-<N>/stages/P-3-plan.md` for claimed file targets, function names, route registrations.
- READ `process/waves/wave-<N>/stages/P-2-spec.md` for claimed contracts.
- READ `process/waves/wave-<N>/stages/B-2-backend.md` + `B-3-frontend.md` for implementer-reported claims.
- The **`tasks.description` field** of the wave's primary task IS the spec contract source of truth (per P-2 § "Write the spec to the task's `description`"). `process/waves/wave-<N>/stages/P-2-spec.md` is a convenience pointer file. On any divergence, jenny treats the DB row as truth and flags the divergence as a P-2 defect for V-2 triage.
- READ `command-center/artifacts/user-journey-map.md` (T-9 regenerated).
- VERIFY both `karen` and `jenny` are listed in `command-center/AGENTS.md`. Karen's verification protocol + antipattern catalog live in her agent definition (`~/.claude/agents/karen.md`); jenny's protocol lives in `~/.claude/agents/jenny.md`.

## Skip condition

V-1 NEVER skips.

## Actions

### Action 0 — Block entry: seed review-artifacts manifest

<!-- head-verifier card may be consulted on demand at ~/.claude/agents/head-verifier.md -->

Write `process/waves/wave-<N>/blocks/V/review-artifacts.md` using this schema:

```markdown
# Wave <N> — V-block review artifacts

**Block:** V (Verify)
**Wave topic:** <one line>
**Block exit gate:** V-3
**Status:** in-progress

## Stage deliverables

| Stage | Deliverable file(s) | Status | Notes |
|---|---|---|---|
| V-1 | process/waves/wave-<N>/stages/V-1-karen.md (Karen output) + V-1-jenny.md (jenny output) + V-1-summary.md (orchestrator summary) | in-progress | seeded at V-1 Action 0 |
| V-2 | process/waves/wave-<N>/stages/V-2-triage.md | pending | |
| V-3 | process/waves/wave-<N>/stages/V-3-fast-fix.md | pending | |

## Block-specific context

- **Wave topic:** <one line>
- **T-block findings handed off:** <count, from process/waves/wave-<N>/blocks/T/findings-aggregate.md>
- **Karen verdict:** <pending — set at V-1>
- **jenny verdict:** <pending — set at V-1>
- **In-scope fast-fix candidates:** <pending — set at V-2>
- **Out-of-scope findings re-routed to B:** <pending>
- **Fast-fix cycles run:** 0

## Open escalations carried into gate

<list, or "none">

## Gate verdict log

<appended by fresh head-verifier spawn at V-3 Action 1; one entry per attempt>
```

### Action 1 — Spawn Karen + jenny in parallel

In a single message, spawn both sub-agents via the standard Agent tool. They run concurrently with no shared context — independence is the signal.

**Karen** (definition at `~/.claude/agents/karen.md`). Pass:
- Spec contract path (`process/waves/wave-<N>/stages/P-2-spec.md`).
- Plan path (`process/waves/wave-<N>/stages/P-3-plan.md`).
- Build deliverables (B-0..B-6 in `process/waves/wave-<N>/stages/`).
- Deployed prod URL (from `process/waves/wave-<N>/stages/C-2-deploy-and-verify.md`).
- Merge commit SHA.
- Explicit output path: `process/waves/wave-<N>/stages/V-1-karen.md`.

**jenny** (definition at `~/.claude/agents/jenny.md`; no separate instruction file). Pass:
- The `tasks.description` field content as the **authoritative spec contract** (read via the `Task — show one` recipe in `claudomat-brain/db/SCHEMA.md`).
- The Planning convenience copy path (`process/waves/wave-<N>/stages/P-2-spec.md`) labeled as "convenience reference; cite the DB row on any divergence."
- The deployed prod URL.
- The regenerated user-journey-map.md path.
- Optional: prior wave's jenny report (for cross-wave drift patterns).
- Explicit output path: `process/waves/wave-<N>/stages/V-1-jenny.md`.

jenny does NOT see Karen's V-1 output and vice versa.

### Action 2 — Karen's verification protocol

Per Karen's agent definition, Karen verifies:

1. **File existence.** Every file claimed in the plan or build deliverables exists at the claimed path on the merge commit's tree.
2. **Function / export existence.** Every function or export the spec contract or plan named is actually exported from the file the plan said.
3. **Route registration.** Every route claimed by B-3 / B-4 is registered (via router config OR by hitting the route on the deployed URL).
4. **Migration applied.** Every migration claimed at B-1 is reflected in the deployed DB schema (probe query or platform inspection).
5. **Env var presence.** Every env var claimed at B-0 is set on the deploy platform (without leaking the value).
6. **Deploy hash match.** Deployed app serves the merge commit SHA (matches C-3 verdict).
7. **Antipattern catalog.** Apply Karen's antipattern catalog — claimed-but-fake patterns, decorative tests, deferred-but-undocumented work.

Karen returns one verdict: **APPROVE** / **REJECT** + enumerated findings, each citing the specific claim and contradicting evidence.

### Action 3 — jenny's verification protocol

Per jenny's agent definition, jenny verifies:

1. **Acceptance criteria semantics.** For each criterion, does deployed behavior match its INTENT, not just literal wording?
2. **Edge case coverage.** Exercise each spec-enumerated edge case against deployed state.
3. **Contract conformance.** Probe each observable contract (API shape, type, error envelope); confirm response matches.
4. **User journey continuity.** Walk touched journeys; verify no UX dead-end, broken back-button, or unhandled error state.
5. **Spec gap detection.** Did deployed behavior reveal something the spec didn't anticipate? Surface for spec authoring improvement.

jenny returns: **APPROVE** / **REJECT** + enumerated findings, each citing spec section AND deployed behavior that diverges.

### Action 4 — Receive both outputs

Karen writes to `process/waves/wave-<N>/stages/V-1-karen.md`. jenny writes to `process/waves/wave-<N>/stages/V-1-jenny.md`. Verify each file:

- Exists with verdict.
- Karen findings cite a specific claim (file:line in plan or build deliverable) AND specific evidence (path on disk, command output, deploy URL response). Vague findings ("looks suspicious") are rejected — re-spawn Karen with stricter prompt.
- jenny findings cite spec section (e.g., "Acceptance criterion 3: 'Empty state renders gracefully'") AND deployed evidence (screenshot, network capture, log line). Findings distinguish "spec drift" (code wrong) from "spec gap" (spec wrong).

### Action 5 — On REJECT (either reviewer)

Reviewer REJECT does NOT auto-block at V-1 exit — V-2 classifies, V-3 attempts fast-fix. Block-exit verdict is what matters. Classify each rejection:

**Karen REJECT** (claims fabricated or contradicted):
- **Fabricated** (file doesn't exist as claimed) → re-enter authoring B-stage; V-3 fast-fix if <20 LOC, else escalate.
- **Partial** (file exists, function missing) → V-3 fast-fix if trivial, else B re-entry.
- **False positive** (orchestrator judgment + evidence) → record pattern in deliverable for principles distillation; do not block.

**jenny REJECT** (semantic correctness failure):
- **Spec drift** (code does X, spec said Y) → V-3 fast-fix if <20 LOC; else B-3/B-4 re-entry.
- **Spec gap** (spec didn't anticipate the case) → V-2 tags as `bug-spec` for next wave's P-2; not blocking.
- **jenny false positive** (orchestrator judgment + evidence) → document, don't block.

## Deliverable

Two raw outputs (independent; no orchestrator-summary footer):

- `process/waves/wave-<N>/stages/V-1-karen.md` — Karen's full report (Karen authors).
- `process/waves/wave-<N>/stages/V-1-jenny.md` — jenny's full report (jenny authors).

Plus `process/waves/wave-<N>/stages/V-1-summary.md` — orchestrator summary recording both verdicts, finding counts, drift/gap distinction, false-positive notes, and YAML footer:

```yaml
karen_verdict: APPROVE | REJECT
karen_findings_count: <n>
karen_false_positives_documented: 0
jenny_verdict: APPROVE | REJECT
jenny_findings_count: <n>
spec_drift_count: <n>
spec_gap_count: <n>
jenny_false_positives_documented: 0
findings: [...]                       # raw, V-2 classifies
```

Also: update `process/waves/wave-<N>/blocks/V/review-artifacts.md` — mark V-1 row `done`, set "Karen verdict" + "jenny verdict".

## Exit criteria

- Karen output file exists with verdict.
- jenny output file exists with verdict.
- Karen findings have file:line + evidence citations.
- jenny findings have spec section + deployed-evidence citations; drift vs gap distinction made.
- Summary file written.
- `process/waves/wave-<N>/checklist.md` V-1 row is checked.

## Next

→ `claudomat-brain/blocks/verify/verify.md` → V-2.
