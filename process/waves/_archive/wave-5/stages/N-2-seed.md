# N-2 — Seed (wave 6 bundle)

Head: head-next. Mode: `automatic`. Active milestone: M3 `b372bbf7-09f3-4eb0-87df-28b5ec52bfc2`.

## Action 1 — seed pick
Single top-level candidate under M3 (`parent_task_id IS NULL`, `wave_id IS NULL`, `status='todo'`): **ff378a95-b86c-4d26-89e3-6e6072381d44** — "Stand up data-source-connections store + pluggable DataSourceAdapter interface". Authored by milestone-decomposer at N-1 Action 7; oldest (only) candidate.

## Action 2 — siblings
`parent_task_id = ff378a95`, todo, wave_id NULL:
- 0241222b-dda3-4606-bbc8-d15f5103a278 — Build ingestion/ETL service + on-demand SourceSyncJob into raw_companies staging
- db274731-bba9-4276-b092-a32538027bf6 — Build dedupe engine promoting raw_companies to canonical companies+contacts with provenance
- f5771d13-e3cf-4878-96fe-5d9056fa5944 — Build companies-contacts screen to view, filter, and clean deduped records

## Action 3 — validation (PASS)
All 4 rows: `status=todo`, `wave_id IS NULL`, `milestone_id=b372bbf7`; seed `parent_task_id IS NULL`; 3 siblings `parent_task_id=ff378a95`. No concurrent-write race.

**Bundle quality (head gate):** True DB→service→job→API→UI vertical slice (schema+adapter → on-demand ingestion → deterministic dedupe w/ provenance → view/clean screen), NOT a horizontal layer. Single M3 feature lifecycle (deal-sourcing data spine). No ghost dependencies on unmerged PRs — all net-new atop shipped M1+M2. Sibling graph has no schema-then-query temporal deadlock: seed lays the store/adapter, ingestion writes staging, dedupe promotes, UI reads — a natural forward chain buildable in one session. Sizing ~4–4.8k LOC / ≤~55 files — within the wave rubric. The 3 re-parented M1-follow-up rows (carry a wave_id) are correctly NOT in the bundle — they remain claimable M3 backlog for a later N-2.

## Action 5 — claimed_task_ids
`[ff378a95-b86c-4d26-89e3-6e6072381d44, 0241222b-dda3-4606-bbc8-d15f5103a278, db274731-bba9-4276-b092-a32538027bf6, f5771d13-e3cf-4878-96fe-5d9056fa5944]`

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: ff378a95-b86c-4d26-89e3-6e6072381d44"
  - "bundled siblings: 3"
  - "validation: pass"
seed_task_id: ff378a95-b86c-4d26-89e3-6e6072381d44
seed_task_title: "Stand up data-source-connections store + pluggable DataSourceAdapter interface"
bundled_sibling_ids:
  - 0241222b-dda3-4606-bbc8-d15f5103a278
  - db274731-bba9-4276-b092-a32538027bf6
  - f5771d13-e3cf-4878-96fe-5d9056fa5944
claimed_task_ids:
  - ff378a95-b86c-4d26-89e3-6e6072381d44
  - 0241222b-dda3-4606-bbc8-d15f5103a278
  - db274731-bba9-4276-b092-a32538027bf6
  - f5771d13-e3cf-4878-96fe-5d9056fa5944
active_milestone_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
queue_exhausted: false
validation_failed: false
note: "Vertical DB→service→job→UI slice; M3 first bundle. B-0 (wave 6) claims all 4; L-2 closes all 4."
```

## Exit
Seed + 3 siblings identified; validation PASS; `claimed_task_ids` populated. `n_stage_verdict: COMPLETE`.

---

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: >
    The bundle is a complete end-to-end vertical slice (data-store+adapter → ingestion job → dedupe-with-provenance → companies UI) that exercises M3's whole success metric in one path — not a horizontal DB-only or UI-only layer. All four rows validate cleanly (todo / wave_id null / correct milestone / correct parent linkage). No ghost dependency on unmerged PRs (net-new atop shipped M1+M2). No temporal deadlock in the sibling graph — the store must precede ingestion which precedes dedupe which precedes the view, a buildable forward chain. Sized ~4-4.8k LOC within the wave rubric. The re-parented M1 follow-ups are correctly excluded (they carry a wave_id and are backlog, not siblings).
  next_action: PROCEED_TO_N-3
```
