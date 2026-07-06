# N-2 — Seed (wave-14 bundle)

**Block:** N (Next) · **Stage:** N-2 · **Mode:** automatic · **head:** head-next

## Action 1 — Seed pick (oldest top-level todo under M6)
```
07bd1e1a-d71b-4e31-bc75-95de5a48aeef | Add mandate-derivation real-DB e2e for the recordkeeping scoped-export
```
Single top-level candidate (`parent_task_id IS NULL`, `wave_id IS NULL`, `status='todo'`, milestone=M6). Taken as seed.

## Action 2 — Siblings (parent_task_id = seed)
```
487b0f0c-bc4b-49f3-980f-07fd4f3503bc | Record mandate/outreach context on the compliance gate audit row
f5074df8-bd4e-4e39-864c-94574fecd9be | Build the compliance approval-queue page (/compliance/queue)
```
`bundled_sibling_ids = [487b0f0c, f5074df8]` (2 siblings).

## Action 3 — Bundle validation → PASS
All 3 rows re-confirmed live:

| id | status | wave_id | milestone_id | parent_task_id |
|---|---|---|---|---|
| 07bd1e1a (seed) | todo | NULL | a068dc3d (M6) | NULL |
| 487b0f0c | todo | NULL | a068dc3d (M6) | 07bd1e1a |
| f5074df8 | todo | NULL | a068dc3d (M6) | 07bd1e1a |

Every invariant holds: `status=todo`, `wave_id NULL`, `milestone_id=M6`, siblings parented to seed, seed unparented.

## Bundle-quality assessment (head-next N-2 stage-exit)

- **Vertical slice (UI + API + DB):** UI = /compliance/queue page (f5074df8); backend/API = producer-side gate audit-row attribution (487b0f0c) + recordkeeping-export logic exercised by the seed e2e; DB = additive audit metadata (rollback = drop added column/index). A genuine vertical slice — NOT a horizontal layer. No Horizontal Layer Bundling.
- **Single feature lifecycle:** all 3 are M6 compliance/recordkeeping hardening — one workflow, no mutually-exclusive lifecycles.
- **RBAC / SoD:** /compliance/queue is role-scoped with sender!=approver SoD preserved + audited; gate-attribution touches the compliance audit surface. Compliance separation-of-duties explicit.
- **Sizing:** ~2,800 net LOC, est ~20 files — within a single logical execution session; within executor context window; well under the 60-file / 5,000-LOC ceiling.
- **Same modular component:** all target the compliance/recordkeeping surface (M2 immutable audit log + M6 pre-send gate + recordkeeping export) — no arbitrary API↔background-worker jumps.
- **Customer Problem Stack Rank / LNO:** the seed (DEV-2 e2e) is a HARD-GATE on regulator-defensibility of the scoped export — Leverage compliance work, not an Overhead UI tweak. No Placebo Productivity Trap.
- **No ghost dependencies:** all three read only shipped-and-live surfaces (waves 11–13, merged + deployed). No dependency on any open/unmerged PR.
- **Deterministic test spec pre-code:** the seed IS a deterministic real-DB e2e (asserts full mandate-derivable producer capture AND gate-evaluate exclusion); P-2 formalizes the spec contract.
- **Rollback for data ops:** additive-only schema; no data-destructive migration.
- **No dependency-deadlock:** seed is a TEST over existing data; the two siblings are independent (producer-side additive audit metadata; a net-new page). No sibling queries a schema the seed alters. No Dependency Deadlock Bundling.

## Action 5 — claimed_task_ids
```
[07bd1e1a-d71b-4e31-bc75-95de5a48aeef, 487b0f0c-bc4b-49f3-980f-07fd4f3503bc, f5074df8-bd4e-4e39-864c-94574fecd9be]
```
Propagates to N-3 handoff (`next_wave_claimed_task_ids`), B-0 Action 1 (claim batch), L-2 Action 1 (close batch).

---

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 07bd1e1a-d71b-4e31-bc75-95de5a48aeef"
  - "bundled siblings: 2"
  - "validation: pass"
seed_task_id: 07bd1e1a-d71b-4e31-bc75-95de5a48aeef
seed_task_title: "Add mandate-derivation real-DB e2e for the recordkeeping scoped-export"
bundled_sibling_ids:
  - 487b0f0c-bc4b-49f3-980f-07fd4f3503bc
  - f5074df8-bd4e-4e39-864c-94574fecd9be
claimed_task_ids:
  - 07bd1e1a-d71b-4e31-bc75-95de5a48aeef
  - 487b0f0c-bc4b-49f3-980f-07fd4f3503bc
  - f5074df8-bd4e-4e39-864c-94574fecd9be
active_milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc
queue_exhausted: false
validation_failed: false
note: "Clean M6 buildable compliance-hardening vertical (mandate-derivation e2e seed + gate mandate-attribution + /compliance/queue page). No ghost deps, no horizontal bundling, no dependency-deadlock, no credential-gated content."

head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: >
    Seed + 2 siblings form a complete end-to-end vertical slice (UI /compliance/queue + producer-side gate/export
    backend + additive-audit DB), all under one feature lifecycle (M6 compliance/recordkeeping hardening) and one
    modular component (M2 audit log + M6 gate + export). The seed is Leverage compliance work (a hard-gate on
    regulator-defensibility, not a placebo UI tweak) — Customer-Problem-Stack-Rank respected. Sized to a single
    ~4h session (~2,800 LOC, ~20 files, well under ceiling). No ghost deps (reads only shipped-and-live waves
    11-13), no dependency-deadlock (seed is a read/test; siblings independent), additive-only schema with rollback,
    RBAC/SoD explicit, deterministic e2e spec is the seed itself. Bundle re-validated live: all todo / wave_id NULL /
    milestone=M6, siblings parented to seed. Credential guard holds — no email SDK / webhook / LLM-spend content.
  next_action: PROCEED_TO_N-3
```
