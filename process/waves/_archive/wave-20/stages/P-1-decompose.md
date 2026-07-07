# Wave 20 — P-1 Decompose (multi-spec: M9 outreach-activity tracker, 4 blocks)

## Maximum-rubric (err-high) — NO SPLIT
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | >60 | ~20-30 (schema+migration+migration-test + service+RLS-tests + shared Zod + API controller + /outreach panel [form+list] + tests) | no |
| New primitives | >60 | ~10-14 (table, 2 enums, service CRUD, audit-log-on-mutation, API endpoints, /outreach form+list components) | no |
| Net LOC | >5,000 | ~3,000-4,000 | no |
| Stage-4 working set | >350K | under | no |
→ no split.

## wave_type + floor
- claimed_task_ids.length = 4 → **multi-spec**
- floor >2,500 LOC OR >=6 specs: ~3,000-4,000 LOC (new table + additive migration + empty+populated migration test + service with audit-logged CRUD + read AND write RLS negative tests + shared Zod + RBAC API + /outreach form+list panel) → **floor MET by LOC**. **Verdict: PROCEED.**

## Bundle (claimed_task_ids = 4)
- SEED d45c73b5 — outreach_activity table + additive migration (workspace-scoped RLS, distinct enums, GAP-4 populated-migration test)
- 5c12ac3a — service (RLS + audit-logged mutations)
- c3776cac — shared-Zod contracts
- b2acf4ce — RBAC API + /outreach panel

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []   # /outreach panel = a create/edit form + a list of touches with status — composable from the shipped form patterns (MandateForm) + table/list + panel patterns (pipeline board, admin tables) + the design system. No net-new visual paradigm; consistent with the wave-15/16/18/19 mockup-less-but-pattern-reused precedent. B-3 design-gap fallback re-enters D-1 if a genuine gap surfaces.
```

## Self-consistency
CLEAN. LOAD-BEARING (WRITE surface): write-path-RLS-isolation (policy FOR ALL not FOR SELECT — derives the write-check; write-path negative test INSERT/UPDATE cross-firm → reject; NO literal WITH CHECK added — M8 has none) | read-path RLS negative-read | audit-logged-mutations (append to M2 HMAC chain; table NOT WORM) | additive-migration + populated-DB test (GAP-4) | distinct enum names (wave-11) | credential-free (no external send). design_gap false.
```yaml
verdict: PROCEED
wave_type: multi-spec
claimed_task_ids: [d45c73b5-..., 5c12ac3a-..., c3776cac-..., b2acf4ce-...]
floor_merge_attempt: 0
design_gap_flag: false
security_scope_note: "WRITE surface post-M8 — write-path RLS isolation is load-bearing (a cross-firm write leak). Not auth/payment, but P-4 scrutinizes the FOR-ALL policy + write-path negative test + audit-logged-mutation."
