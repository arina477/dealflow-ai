# Wave 7 — P-2 Spec (pointer)
**Source of truth:** spec contract in `tasks.description` of seed **dfa5bd56-0c7e-46ed-830f-9c35e5bfd471**. DB wins.
**wave_type:** single-spec. **design_gap_flag:** false. **claimed_task_ids:** [dfa5bd56 (sourcing-workspace page)].
## AC summary
Sourcing-workspace page at /sourcing (RBAC analyst, AppShell): search over the wave-6 canonical deduped universe (results matrix + detail drawer + source/provenance badges); ≥2-source view (buildable on ≥2 fixture connections); connection-level trigger-sync (reuse wave-6 POST /sourcing/connections/:id/sync → ETL→dedupe→canonical) with sync-outcome; hand-off to /sourcing/companies. apiFetch (rid) + same-origin proxy. Reuses wave-6 pipeline (no re-implement).
## Deferred (out of scope, split at P-0)
real DataSourceAdapter (345dfbc6 — founder vendor+key); in-page dedupe-modal (b9141490 sibling); advanced facets/saved-search.
