# Wave 7 — P-1 Decompose

## Post-split state (P-0 RESCOPE-AUTO-SPLIT + THIN executed)
- DEFERRED (unbundled, M3 backlog): 345dfbc6 (real DataSourceAdapter — founder vendor+key); b9141490 (in-page dedupe-modal sibling — mvp-thinner).
- **Wave 7 = single task: dfa5bd56 (sourcing-workspace page) on the wave-6 fixture adapter.**

## Maximum size rubric
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | > 60 | ~18 (sourcing-workspace page + search/results/detail components; a search API over the canonical universe + connection-level sync trigger [reuse wave-6 POST /sync]; shared search types; tests) | No |
| New primitives | > 60 | ~10 | No |
| Estimated net LOC | > 5,000 | ~1,800 (page + search endpoint + components + tests; reuses wave-6 ETL/dedupe/companies backend) | No |
| Stage-4 working set | > 350K | design + wave-6 backend + plan — under | No |
No maximum trips → no split.

## Wave type
`claimed_task_ids.length == 1` → **single-spec** (dfa5bd56).

## Minimum floor
Single-spec: ~1,800 net LOC (mvp-thinner confirmed kept-ACs clear >1,500). Floor met. No merge (the natural additions — real adapter, dedupe-modal — are deliberately deferred).

## Verdict: **PROCEED** (single-spec, no split, no merge)
- `claimed_task_ids: [dfa5bd56-0c7e-46ed-830f-9c35e5bfd471]`

## design_gap_flag: **false**
| Surface | Prior art |
|---|---|
| Sourcing-workspace page (search + results + trigger ingest) | design/sourcing-workspace.html + DESIGN-SYSTEM §10 |
| AppShell chrome + companies screen (hand-off target) | §10 (wave 3) + /sourcing/companies (wave 6) |
No missing surfaces → **D-block SKIPS; next block B.**

## wave_type (T-block)
backend + ui. Real UI (sourcing-workspace) → T-5 E2E + T-6 layout. NOT auth/PII → NOT full security-scope (T-8-lite at most; reuses wave-6 RBAC analyst + fixture — no new secret this wave since real adapter deferred).

```yaml
wave_type: single-spec
verdict: PROCEED
claimed_task_ids: [dfa5bd56-0c7e-46ed-830f-9c35e5bfd471]
deferred_this_wave: [345dfbc6 (real adapter, founder vendor+key), b9141490 (dedupe-modal sibling)]
design_gap_flag: false
t_block_wave_type: [backend, ui]
carry_from_p0: ["≥2-source UI buildable NOW on ≥2 fixture connections (not blocked on real adapter)", "search over the canonical deduped universe (+ trigger connection-level sync reusing wave-6 ETL)"]
```
