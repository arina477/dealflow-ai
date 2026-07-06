# N-2 — Seed (wave-15 → wave-16 bundle)

Picks the wave-16 bundle under M7 (Admin & settings).

## Seed-tension resolution (V-2 provenance vs. N-2 seed-pick)

The strict seed-pick (`todo AND wave_id IS NULL AND parent_task_id IS NULL`) returns only `bfadcec1` — the trivial wave-1 health-test typing carryover — because V-2 stamped `wave_id=15` on the 5 richer M7-hardening follow-ups for provenance, excluding them from the strict predicate.

Per N-2 Action 1 ("LLM may re-order… prefer whichever the milestone scope needs next") + roadmap-lifecycle § Bundles (V-2/D-3 follow-ups are top-level candidate seeds, `parent_task_id NULL`), the coherent wave-16 vertical slice is the **F-1..F-6 admin-hardening set**, not the health-test carryover. Resolution:

- **Nulled `wave_id`** on all 5 follow-ups (removing the V-2 provenance stamp so N-2 can pick them).
- **Re-parented** the 4 non-seed follow-ups under the F-1 seed (`parent_task_id = 904a3c25`) to form one bundle.
- The trivial `bfadcec1` carryover stays a standalone future seed (untouched).

Recorded deliberately: this is a re-home of already-authored V-2 rows (not a new decomposition INSERT), staying within roadmap-lifecycle edit permissions (V-2 follow-ups are top-level seeds; nulling wave_id + re-parenting is a bundle assembly, not a scope rewrite).

## Bundle (vertical slice — UI + API + DB, admin/settings coherent)

- **Seed** `904a3c25` — Wire firm default-compliance-profile cascade into mandate creation (the real feature gap: settings persisted but unconsumed; M7↔M4 boundary). Highest-value, chosen as seed.
- **Sibling** `6f1a96da` — Admin nav entry / in-app link to /admin/integrations (nav dead-spot).
- **Sibling** `c54db02d` — Invite duplicate/existing-user handling (409 or idempotent).
- **Sibling** `042cf4e6` — Reactivate/undo for soft-deactivated users (+ V-1 prod-fixture/sentinel cleanup).
- **Sibling** `2560fecc` — Guard config JSONB against raw secrets (forward-looking, additive).

**Vertical-slice / anti-pattern checks (head-next card):**
- Not horizontal — spans UI (nav, reactivate UI), API (cascade read, invite dedup 409, reactivate endpoint, config guard), DB (additive-only where touched). PASS.
- No ghost deps — all read shipped-and-live wave-15 M7 surfaces (workspace_settings, /admin/integrations, users, data_source_connections). No open-PR dependency. PASS.
- No dependency deadlock — F-1 seed is a read of settings at mandate-create; the 4 siblings are independent admin surfaces (no sibling queries a schema another sibling mutates). PASS.
- No mutually-exclusive workflows — all admin/settings lifecycle, same modular-monolith component. PASS.
- Additive-only — rollback = drop added column/index/endpoint. PASS.
- Sized sane (~1 vertical slice, 5 tasks); P-1 rubric re-checks. Not over-bundled. PASS.

## Validation (Action 3 — re-confirmed against DB post-update)

All 5 rows: `status='todo'`, `wave_id IS NULL`, `milestone_id=08d3053a...`; siblings `parent_task_id=904a3c25`; seed `parent_task_id NULL`. VERIFIED.

## Deliverable footer

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 904a3c25-ab46-4050-8122-d998e5a6f2a1"
  - "bundled siblings: 4"
  - "validation: pass (all todo / wave_id NULL / milestone=M7 / siblings parent=seed — re-confirmed in DB)"
seed_task_id: 904a3c25-ab46-4050-8122-d998e5a6f2a1
seed_task_title: "Wire firm default-compliance-profile cascade into mandate creation"
bundled_sibling_ids:
  - 6f1a96da-d96f-4bdc-b572-5255b493653c
  - c54db02d-c531-4292-a246-6ba984166ce9
  - 042cf4e6-5d3f-42ad-8c06-3c67404ab8e1
  - 2560fecc-bb12-483d-8f63-a801db6c71b1
claimed_task_ids:
  - 904a3c25-ab46-4050-8122-d998e5a6f2a1
  - 6f1a96da-d96f-4bdc-b572-5255b493653c
  - c54db02d-c531-4292-a246-6ba984166ce9
  - 042cf4e6-5d3f-42ad-8c06-3c67404ab8e1
  - 2560fecc-bb12-483d-8f63-a801db6c71b1
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
queue_exhausted: false
validation_failed: false
note: "Re-homed the 5 V-2 M7-hardening follow-ups (nulled wave_id; re-parented 4 under seed 904a3c25) to form a coherent wave-16 admin-hardening vertical slice. Trivial bfadcec1 health-test carryover left as a standalone future seed."
```
