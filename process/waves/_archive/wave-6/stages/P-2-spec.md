# Wave 6 — P-2 Spec (pointer)
**Source of truth:** spec contract in `tasks.description` of seed **ff378a95-b86c-4d26-89e3-6e6072381d44** (YAML head + prose). DB wins.
**wave_type:** multi-spec (4 blocks). **design_gap_flag:** false. **claimed_task_ids:** [ff378a95 (connections+adapter+schema), 0241222b (ETL+sync), db274731 (dedupe engine), f5771d13 (companies-contacts screen)].

## Acceptance criteria (copy)
### Block 1 — connections + adapter + schema (ff378a95)
Additive migration: data_source_connections (provider_key→Railway-env cred, NO secret in-DB) + raw_companies staging (UNIQUE(connection_id,source_record_id)) + companies + contacts + company_provenance + dedupe_candidates. Typed DataSourceAdapter interface (fetchCompanies→NormalizedSourceRecord[]) + FIXTURE adapter. Secrets env-only (no secret column).
### Block 2 — ETL + on-demand sync (0241222b)
ETL: adapter.fetchCompanies → normalize → raw_companies staging (IDEMPOTENT upsert by connection_id+source_record_id). POST /sourcing/connections/:id/sync (on-demand, RBAC analyst/admin) → {ingested,updated}. Writes ONLY staging (not canonical).
### Block 3 — dedupe engine (db274731)
raw→canonical promote; deterministic match (normalize name/domain/email, no ML); merge (no dup canonical); PROVENANCE preserved (company_provenance lineage); **CROSS-SOURCE dedup (same domain, 2 connections → 1 canonical + provenance from both) — fixtures MUST have cross-source dups**; ambiguous→dedupe_candidates review queue (not auto-merge); IDEMPOTENT re-run.
### Block 4 — companies-contacts screen (f5771d13)
/sourcing/companies view+filter per companies-contacts.html (RBAC analyst); **clean actions** (resolve dedupe_candidate merge/reject, edit canonical → updates provenance). GET /sourcing/companies(+/:id); POST /sourcing/dedupe-candidates/:id/resolve. nav⊆RBAC.

## Notes
Carry from P-0: cross-source-dup fixtures (dedupe merge-path exercised); provider secrets Railway-env only. No new external SDK (fixture adapter). T-8-lite (secret-handling; NOT full security-scope gate — external-party data). D skips (companies-contacts.html exists).
