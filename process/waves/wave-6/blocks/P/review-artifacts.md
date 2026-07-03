# Wave 6 — P-block review artifacts

**Block:** P (Product)
**Wave topic:** Deal-sourcing data spine — data-source connectors + ingestion/ETL + dedupe → canonical companies/contacts + a management screen (M3, first visible deal-flow product feature)
**Block exit gate:** P-4
**Status:** gate-passed

## Stage deliverables
| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | process/waves/wave-6/stages/P-0-frame.md | done | PROCEED (all 3 reframers); no-prior-spec; fixture adapter (no new SDK); carry: cross-source-dup fixtures |
| P-1 | process/waves/wave-6/stages/P-1-decompose.md | done | PROCEED, multi-spec, design_gap_flag=false (companies-contacts.html) |
| P-2 | process/waves/wave-6/stages/P-2-spec.md | done | multi-spec data-spine contract in seed ff378a95 (4 blocks) |
| P-3 | process/waves/wave-6/stages/P-3-plan.md | done | approach (6 deltas) + file-level plan (24 steps, B-1..B-5); NO new external SDK (fixture adapter, JSON fixture zero-dep); schema additive+down; self-consistency CLEAN; gate flag: data-engineer catalog gap (substituted backend-developer+postgres-pro) |
| P-4 | process/waves/wave-6/blocks/P/gate-verdict.md | gate-passed | head-product APPROVED; karen+jenny APPROVE (jenny iter-2 after databases.md-reconcile + contact_provenance remediation); Gemini 429 |

## Block-specific context
- **Wave topic:** M3 first bundle — data_source_connections store + pluggable DataSourceAdapter interface (seed) + ingestion/ETL service + on-demand SourceSyncJob → raw_companies staging + dedupe engine (raw_companies → canonical companies+contacts with provenance) + companies-contacts screen (view/filter/clean deduped records). The first user-facing deal-flow feature, built on the M1/M2 foundation.
- **Roadmap milestone:** M3 (b372bbf7…, in_progress, **product-feature** → mvp-thinner runs at P-0). wave.milestone_id backfilled. wave_db_id ab074500-9825-46e8-a3f3-569e94eb5350 (wave_number 6).
- **claimed_task_ids (bundle):** [ff378a95 (connections+adapter), 0241222b (ingestion/ETL+job), db274731 (dedupe engine), f5771d13 (companies-contacts screen)] — set at P-1.
- **Schema change:** YES (data_source_connections, raw_companies staging, canonical companies + contacts + provenance; migration). New env: possibly data-source provider API keys (account-issued → request from founder if a real provider integration is needed this wave).
- **External-SDK check (P-3):** the "pluggable DataSourceAdapter" may be an abstraction (build the interface + a stub/CSV/mock adapter this wave; real provider SDKs later) OR need a real provider now — P-0/P-3 to scope. If a real third-party data-source SDK, follow external-sdk-integration-rules + possibly a MONITOR: task for provisioning.
- **design_gap:** likely — companies/contacts screen (check design/ for a companies/contacts mockup; if absent → D-block runs).
- **PII note:** companies/contacts = external-party data (not user auth), but provenance + data handling matter; T-8 only if it touches auth/PII-of-users.
- **Autonomous mode:** automatic

## Open escalations carried into gate
- M1 follow-ups (6fe232e3, bfadcec1, d7f716b4) re-parented to M3 — backlog, not this wave.

## Gate verdict log
<appended by fresh head-product spawn at P-4 Action 1>
