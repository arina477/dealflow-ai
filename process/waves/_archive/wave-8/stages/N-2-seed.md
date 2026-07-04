# N-2 — Seed (wave 8 → seeds wave 9)

## Actions

- **Action 1 — seed pick:** `92a8ff3f-25c6-455b-bf1f-cdf0a9aaee31` — "Build buyer-universe data spine + assemble-and-filter service". Oldest (only) unparented `todo`/`wave_id NULL` task under active milestone M4. No re-order needed — single candidate, directly aligned to M4 Scope ordering (buyer-universe builder is the remaining Scope item).
- **Action 2 — siblings loaded:** 2 siblings under the seed —
  - `394a60ba-9468-4745-be0f-e4c83c5d411d` — "Build /buyer-universe page to assemble, filter, and review candidates"
  - `c907731f-7674-4c72-a1a8-03dded053037` — "Enrich buyer contacts, flag universe gaps, and mark ready-to-rank for matching handoff"
- **Action 3 — validation: PASS.** All 3 rows: `status=todo`, `wave_id IS NULL`, `milestone_id=c67b1610` (M4). Both siblings `parent_task_id=92a8ff3f` (= seed). No concurrent-write race.
- **Action 5 — claimed_task_ids:** `[92a8ff3f, 394a60ba, c907731f]` — propagates to N-3 `.last-wave-completed.yaml`, B-0 claim batch, L-2 close batch.

## head-next N-2 stage-exit checklist

- [x] [STABLE] Seed + siblings = complete end-to-end vertical slice (DB spine + assemble/filter service [seed] → API → /buyer-universe UI [sibling 394a60ba] → enrich/flag-gaps/submit-to-matching handoff [sibling c907731f]). Spans DB, API, UI — NOT a horizontal data-only layer.
- [x] No mutually-exclusive workflows in the bundle — all 3 tasks are one analyst workflow (assemble → filter → enrich → ready-to-rank) on the buyer-universe module.
- [x] RBAC / separation-of-duties detailed: analyst is the primary actor per M4 metric ("an analyst can assemble+enrich"); advisor/admin included; M1 RolesGuard reused; M2 AuditService.append last-in-txn for mutations.
- [x] Bundle size within executor context window — ~3,000–4,500 LOC, ≤~50 files, 1 seed + 2 siblings.
- [x] Tightly-coupled siblings target the same module (buyer-universe builder + its page) — no arbitrary API↔worker jumps. Submit-to-matching is a status/handoff marker, not a background-worker surface (that is M5).
- [x] [STABLE] Seed addresses the highest-ranked customer problem — completes M4's user-value metric (analyst assembles a rankable buyer universe), not the easiest backlog tweak. Chosen over 3 Overhead backlog tasks.
- [x] No ghost dependencies on unmerged PRs — reuses only SHIPPED + MERGED M3 companies/contacts, M4 mandate spine (wave-8, on main), M1 RBAC, M2 audit. wave-8 is fully merged to main (16 commits ahead of the stale feature branch).
- [x] Seed instructs deterministic test specs before code — carried into P-2 next wave; decomposition prose flags SSR-hydrate + read-schema-passthrough (wave-7) + actor-id getUserWithRole (wave-5) lessons.
- [x] Rollback/fallback for data-destructive ops — all new schema is ADDITIVE (new buyer_universe tables FK→mandates + M3 companies); no destructive ORM/migration; noted in seed prose.
- [x] [STABLE] Bundle completable/verifiable/mergeable in a single logical session (~single wave; matches the wave-8 spine bundle shape).

**head_signoff N-2: APPROVED.** Every checkbox ticked from DB validation + decomposition prose. Buildable, no founder-block, no ghost deps.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 92a8ff3f-25c6-455b-bf1f-cdf0a9aaee31"
  - "bundled siblings: 2"
  - "validation: pass"
seed_task_id: 92a8ff3f-25c6-455b-bf1f-cdf0a9aaee31
seed_task_title: "Build buyer-universe data spine + assemble-and-filter service"
bundled_sibling_ids: [394a60ba-9468-4745-be0f-e4c83c5d411d, c907731f-7674-4c72-a1a8-03dded053037]
claimed_task_ids: [92a8ff3f-25c6-455b-bf1f-cdf0a9aaee31, 394a60ba-9468-4745-be0f-e4c83c5d411d, c907731f-7674-4c72-a1a8-03dded053037]
active_milestone_id: c67b1610-9cc3-4cad-bcfa-1bee0573da72
queue_exhausted: false
validation_failed: false
note: "Vertical-slice buyer-universe bundle; final M4 bundle; M4/M5 boundary held (no scoring/LLM)."
```
