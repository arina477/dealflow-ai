# Wave 6 — P-1 Decompose

## Maximum size rubric (split when over — OR logic)
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | > 60 | ~50 (migration + 5-6 Drizzle schemas [data_source_connections, raw_companies, companies, contacts, dedupe_candidates, provenance]; DataSourceAdapter interface + fixture adapter; ETL service + SourceSyncJob; dedupe engine + matchers; companies-contacts screen + components; shared types; tests incl. cross-source-dup fixtures) | No |
| New primitives | > 60 | ~35 (5-6 tables + migration; adapter interface + fixture adapter; ETL/sync job; dedupe engine + normalizers/matchers; screen + filters/clean actions; shared Zod) | No |
| Estimated net LOC | > 5,000 | ~4,500 (data-pipeline TEST burden heavy: dedupe correctness on cross-source dups, idempotent re-sync, provenance, review-queue, screen filter/clean) | No |
| Stage-4 working set | > 350K | databases.md + companies-contacts.html + plan — under | No |

No maximum threshold trips → **no split**.

## Wave type
`claimed_task_ids.length == 4` → **multi-spec**.
- Seed ff378a95 — data_source_connections + DataSourceAdapter interface + the canonical/staging schemas
- Sibling 0241222b — ingestion/ETL service + on-demand SourceSyncJob → raw_companies staging
- Sibling db274731 — dedupe engine → canonical companies+contacts + provenance + review queue
- Sibling f5771d13 — companies-contacts screen (view/filter/clean)

## Minimum floor
Multi-spec floor: net LOC > 2,500 OR length ≥ 6. ~4,500 > 2,500 → **floor met**. **No merge** — complete data-spine vertical slice; real multi-provider adapters + enrichment + scheduled sync deferred (mvp-thinner confirmed pre-thinned).

## Verdict: **PROCEED** (multi-spec, no split, no merge)
- `claimed_task_ids: [ff378a95…, 0241222b…, db274731…, f5771d13…]`
- `floor_merge_attempt: 0`

## design_gap_flag: **false**
| Surface | Prior art |
|---|---|
| Companies & contacts screen (view/filter/clean deduped records) | design/companies-contacts.html + DESIGN-SYSTEM |
| AppShell chrome (wraps it) | §10 (wave 3, shared) |
No missing surfaces → **D-block SKIPS; next block B.** (Sourcing-workspace page is a LATER M3 bundle — not this wave; not a gap.)

## wave_type (T-block)
backend + ui + data-pipeline (dedupe correctness = the hard test surface; cross-source-dup fixtures per P-0 watch-item). NOT auth/PII-of-users → T-8 Security NOT force-triggered (external-party data; provider secrets are Railway-env-only, never in-DB — a T-8-lite secret-handling check only). Real UI (companies-contacts) → T-5 E2E + T-6 layout run.

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [ff378a95-b86c-4d26-89e3-6e6072381d44, 0241222b-dda3-4606-bbc8-d15f5103a278, db274731-bba9-4276-b092-a32538027bf6, f5771d13-e3cf-4878-96fe-5d9056fa5944]
siblings_created: []
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
t_block_wave_type: [backend, ui, data-pipeline]
carry_from_p0: ["fixtures MUST contain cross-source DUPLICATES (dedupe merge-path exercised, not happy-path)", "provider secrets Railway-env only, never in-DB"]
```
