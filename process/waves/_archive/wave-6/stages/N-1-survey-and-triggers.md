# N-1 — Survey & triggers (wave 6 → wave 7)

Survey of milestone state after wave-6 close; M3 disposition judged; per-wave decomposition fired for M3's next bundle.

## Survey signals (Actions 1–4)

- **Active milestone (Action 1):** `b372bbf7-09f3-4eb0-87df-28b5ec52bfc2` — "M3 — Deal sourcing & company/contact data", `in_progress`. Exactly one `in_progress` row — no invariant violation.
- **`todo` queue head (Action 2):** highest-tier `todo` is `c67b1610-9cc3-4cad-bcfa-1bee0573da72` — "M4 — Mandates & buyer universe" (H1, T2, product-feature). M5..M12 also `todo`. M1/M2 `done`; the original H1 umbrella milestone `cancelled`.
- **Active child summary (Action 3):** `open=5 done=4 seed_candidates=1`. The 4 done = the wave-6 data spine. The 5 open = 3 re-parented M1-follow-up backlog rows (`bfadcec1` test-fixture typing, `6fe232e3` auth hardening, `d7f716b4` AppShell polish — all `wave_id` set, so NOT seed candidates) + the 2 new bundle rows authored this tick. seed_candidates went 0 → 1 after decomposition.
- **Unassigned queue depth (Action 4):** 1.

## Trigger evaluations (Actions 6–10)

### Action 6 — Closure check → NOT closed

`open_count = 5 ≠ 0`, so the strict closure invariant (all child tasks terminal) is not satisfied. Independently, the **LLM scope judgment is that M3's `## Scope` / `## Success metric` are NOT yet shipped**:

- M3 `## Scope` explicitly names **"Pages: sourcing-workspace, companies-contacts"** and **">=2 providers"**. Wave 6 shipped only companies-contacts + a FIXTURE adapter.
- M3 `## Success metric`: "An analyst can **run a sourcing search across >=2 connected sources**, import deduped records (with provenance), and view/clean them." The analyst cannot yet *run a sourcing search* — the **sourcing-workspace page (journey row 12, `/sourcing`)** is the search-and-trigger entry point and is DEFERRED (confirmed in the journey map's own wave-6 "Deferred" note). The journey entry flow is `Sourcing workspace (12) → Companies (13) → Mandate (6)` — row 12 is the missing entry point.
- The done tasks' own descriptions repeatedly state "sourcing-workspace page deferred to the next M3 bundle" and "real provider SDKs deferred to a later M3 bundle."

**Verdict: M3 stays `in_progress`.** The data spine is the *foundation* of M3, not the whole milestone. Two M3-core items remain: (1) the sourcing-workspace entry page, (2) at least one real deal-source adapter. → fall through to Action 7.

### Action 7 — Per-wave decomposition → FIRED

`active_milestone` exists AND `seed_candidates = 0` (pre-tick) AND scope NOT shipped → fired milestone-decomposition, reason `decomposition-needed`, caller mode `next-bundle`, against M3. Under `automatic` mode, spawned `milestone-decomposer` sub-agent (inline, per Action 10 table).

Bundle authored (one transaction, verified in DB):
- **Seed** `dfa5bd56-0c7e-46ed-830f-9c35e5bfd471` — "Build sourcing-workspace page to search sources and trigger ingestion" (`parent_task_id=NULL`, `wave_id=NULL`, `status=todo`, `milestone_id=M3`).
- **Sibling** `345dfbc6-1c96-4f6a-98aa-12ac7d61794b` — "Implement first real DataSourceAdapter against a selected deal-source provider" (`parent_task_id=dfa5bd56...`).

Vertical slice (UI search-entry page + real adapter behind the existing pluggable interface/ETL) completing the M3 success metric end-to-end. ~3,200 net LOC, 1 seed + 1 sibling — within the P-1 size rubric. `decomposition-complete`. product-decisions.md committed by the sub-agent at `8916e58` (not pushed; N-3 pushes).

Decomposer flagged for P-3: the real-adapter sibling deliberately names no vendor — deal-source vendor selection is a spend-commitment gate (BOARD/ceo-agent under automatic) requiring an SDK doc before adapter code; if that gate defers, the seed still stands alone on the fixture adapter.

### Action 8 — Promotion / stockout → NOT applicable

`active_milestone != null` (M3 remains active). No promotion, no stockout cascade. M4 stays `todo` (it depends on M3's company universe; it is the correct *next milestone* once M3 closes, but M3-core is not yet done).

### Action 9 — Daily-checkpoint → NOT fired

A seed candidate now exists (decomposition produced one), so the "no seed candidate" precondition fails. Not fired.

### Action 10 — Routing

`automatic` mode. Decomposition routed to `milestone-decomposer` sub-agent (inline, no BOARD — routine bundle authoring, not an escalation). No roadmap-planning, no daily-checkpoint fired. No founder defer.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "active milestone: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2 (M3, in_progress)"
  - "todo queue head: c67b1610-9cc3-4cad-bcfa-1bee0573da72 (M4)"
  - "active child tasks: open=5 done=4 seed_candidates=1"
  - "unassigned queue depth: 1"
  - "closure: none (M3 scope not shipped — sourcing-workspace page + real adapter remain)"
  - "promotion: none"
  - "decomposition fired: true (M3 next bundle authored)"
  - "rituals fired: [milestone-decomposition]"
prev_wave: 6
active_milestone_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
active_milestone_child_summary:
  open: 5
  done: 4
  seed_candidates: 1
next_todo_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72
unassigned_queue_depth: 1
state_transitions_applied: []
slot_promotion:
  promoted_id: null
  prior_active_id: null
decomposition_fired: true
proposals_fired:
  - {ritual: milestone-decomposition, target_milestone: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2, reason: decomposition-needed, decision: fired-inline, by: milestone-decomposer, fired_at: 2026-07-04T02:35:49Z}
ritual_outcomes:
  - {ritual: milestone-decomposition, outcome_summary: "M3 next bundle authored — seed dfa5bd56 (sourcing-workspace page) + sibling 345dfbc6 (first real DataSourceAdapter); ~3200 LOC; product-decisions.md committed 8916e58", decision: decomposition-complete, by: milestone-decomposer}
loop_state: ready
note: "M3 stays in_progress. Data spine (4 done) is M3's foundation, not the full milestone: sourcing-workspace entry page (journey row 12) + real provider adapter (>=2 sources) remain M3-core and are unshipped. M4 (mandates) is the next milestone but depends on M3's company universe — promoted only after M3 closes. 3 M1-follow-up backlog rows left under M3 unbundled (wave_id set → not seed candidates)."
```

## Exit
→ N-2.
