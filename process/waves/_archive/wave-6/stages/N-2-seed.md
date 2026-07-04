# N-2 — Seed (wave 7 bundle)

Pick the next bundle under M3 (the bundle N-1 Action 7 just authored) for wave 7.

## Action 1 — Seed

Seed-candidate query (`milestone_id=M3, status=todo, wave_id IS NULL, parent_task_id IS NULL, ORDER BY created_at`) returned exactly ONE row:

- **`dfa5bd56-0c7e-46ed-830f-9c35e5bfd471`** — "Build sourcing-workspace page to search sources and trigger ingestion"

The 3 M1-follow-up backlog rows (`bfadcec1`, `6fe232e3`, `d7f716b4`) are correctly excluded — they carry `wave_id`, so they are not seed candidates. Seed selected: `dfa5bd56...`.

## Action 2 — Siblings

`WHERE parent_task_id = dfa5bd56... AND status=todo AND wave_id IS NULL`:

- **`345dfbc6-1c96-4f6a-98aa-12ac7d61794b`** — "Implement first real DataSourceAdapter against a selected deal-source provider"

`bundled_sibling_ids = [345dfbc6-1c96-4f6a-98aa-12ac7d61794b]`.

## Action 3 — Validation → PASS

DB re-confirm of `[seed, sibling]`:

| id | status | wave_id | milestone_id | parent_task_id |
|---|---|---|---|---|
| dfa5bd56… | todo | NULL | b372bbf7… (M3) | NULL |
| 345dfbc6… | todo | NULL | b372bbf7… (M3) | dfa5bd56… |

All checks pass: both `todo`, both `wave_id IS NULL`, both `milestone_id = M3`; sibling `parent_task_id = seed`. No concurrent-write race.

**Bundle quality (head-next gate):** proper vertical slice — UI search-and-trigger entry page (`/sourcing`, journey row 12) + one real data-source adapter behind the already-shipped pluggable `DataSourceAdapter` interface + ETL. Not a horizontal layer. No ghost dependency on any open/unmerged PR (wave 6 is merged + LIVE @ 918dbf0). No data-destructive migration in the seed. The real-adapter sibling carries a spend-gate flag for P-3 (vendor selection → BOARD; SDK doc + likely MONITOR: task before adapter code); the seed stands alone on the fixture adapter if the gate defers the sibling.

## Action 5 — claimed_task_ids

`claimed_task_ids = [dfa5bd56-0c7e-46ed-830f-9c35e5bfd471, 345dfbc6-1c96-4f6a-98aa-12ac7d61794b]`

B-0 (wave 7) claims this batch; L-2 closes it.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: dfa5bd56-0c7e-46ed-830f-9c35e5bfd471"
  - "bundled siblings: 1"
  - "validation: pass"
seed_task_id: dfa5bd56-0c7e-46ed-830f-9c35e5bfd471
seed_task_title: "Build sourcing-workspace page to search sources and trigger ingestion"
bundled_sibling_ids: [345dfbc6-1c96-4f6a-98aa-12ac7d61794b]
claimed_task_ids: [dfa5bd56-0c7e-46ed-830f-9c35e5bfd471, 345dfbc6-1c96-4f6a-98aa-12ac7d61794b]
active_milestone_id: b372bbf7-09f3-4eb0-87df-28b5ec52bfc2
queue_exhausted: false
validation_failed: false
note: "Vertical slice: sourcing-workspace entry page (seed) + first real DataSourceAdapter (sibling). Completes the M3 success metric end-to-end. UI wave → D-block runs in wave 7; M3 ## Class product-feature → wave-7 P-0 runs mvp-thinner; real-adapter sibling → P-3 external-SDK research + spend-gate + likely MONITOR: task."
```

## Exit
→ N-3.
