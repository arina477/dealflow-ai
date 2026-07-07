# N-2 — Seed (wave-26)

Head: head-next. Mode: automatic. Per BOARD disposition (c) — `N-1-M10-recordkeeping-integrity-wave-25`.

## Seed pick

- **seed_task_id:** `1a1c5855-b8f8-4d86-93ea-7948e6881c10`
- **title:** "Document + AC the RLS connection-split (runtime dealflow_app / migrate owner) + coupled rollback"
- **milestone:** M10 (033f97e0), in_progress
- **siblings:** none → single-task bundle
- **source:** V-1-jenny GAP-5 (Info) + the wave-25 C-2 deploy experience (DATABASE_URL=dealflow_app runtime vs MIGRATE_DATABASE_URL=owner preDeploy; preDeploy bare-env-prefix form; coupled rollback of deployment + runtime DATABASE_URL).

## Validation (Action 3 — against DB)

| Check | Result |
|---|---|
| status = 'todo' | PASS |
| wave_id IS NULL | PASS |
| milestone_id = 033f97e0 (M10) | PASS |
| parent_task_id IS NULL (top-level seed) | PASS |
| siblings (parent_task_id=seed, todo, wave_id NULL) | none — valid single-task bundle |

Validation PASS.

## Why this seed (BOARD-sanctioned, explicitly-FINAL hardening)

This is the **explicitly-labeled FINAL** M10 hardening/debt-closure wave (per BOARD binding caveat — no 4th "one more debt item" under the same rationale). It is NOT vanity hardening: RLS runtime/owner role separation + coupled rollback is the load-bearing substrate under the WORM/audit recordkeeping backbone (architect-reviewer + risk-manager). It closes the last authored M10 debt item, keeps the loop producing on credential-free work, and buys exactly one wave of runway for the founder to answer the recordkeeping-scope decision. Not a recordkeeping vertical — those are founder-scope-blocked (`_TBD` metric) and surfaced to the digest.

## head_signoff (N-2)

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Single-task bundle validated clean (todo / wave_id NULL / M10 / top-level, no siblings).
    Vertical-slice check N/A for a single deterministic-doc + deploy-AC hardening task; no ghost
    deps (reads no unmerged PR; documents already-shipped RLS + the wave-25 deploy contract). No
    horizontal-layer bundling risk. Explicitly-final per BOARD; deterministic ACs implied by the
    doc+AC nature. Seed = the last authored M10 debt item; recordkeeping verticals correctly NOT
    seeded (founder-scope-blocked).
  next_action: PROCEED_TO_N-3
```

---

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 1a1c5855-b8f8-4d86-93ea-7948e6881c10"
  - "bundled siblings: 0"
  - "validation: pass"
seed_task_id: 1a1c5855-b8f8-4d86-93ea-7948e6881c10
seed_task_title: "Document + AC the RLS connection-split (runtime dealflow_app / migrate owner) + coupled rollback"
bundled_sibling_ids: []
claimed_task_ids: [1a1c5855-b8f8-4d86-93ea-7948e6881c10]
active_milestone_id: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a
queue_exhausted: false
validation_failed: false
note: "Explicitly-FINAL M10 hardening/debt-closure wave per BOARD disposition (c)."
```
