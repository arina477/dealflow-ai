# Wave 7 — P-block review artifacts

**Block:** P (Product)
**Wave topic:** Sourcing-workspace search page + first REAL data-source provider adapter (M3 second bundle — the "search across ≥2 sources" success metric)
**Block exit gate:** P-4
**Status:** gate-passed

## Stage deliverables
| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | process/waves/wave-7/stages/P-0-frame.md | done | RESCOPE-AUTO-SPLIT+THIN; page-on-fixture only; real-adapter DEFERRED (founder vendor+key) + dedupe-modal split |
| P-1 | process/waves/wave-7/stages/P-1-decompose.md | done | PROCEED, single-spec (page only after split), design_gap_flag=false |
| P-2 | process/waves/wave-7/stages/P-2-spec.md | done | single-spec workspace-page contract in seed dfa5bd56 |
| P-3 | process/waves/wave-7/stages/P-3-plan.md | done | 4 deltas (reuse-heavy page); no schema/SDK/secret (real-adapter deferred) |
| P-4 | process/waves/wave-7/blocks/P/gate-verdict.md | gate-passed | head-product APPROVED; karen+jenny APPROVE (jenny iter-2 after connection-seeding remediation); Gemini 429 |

## Block-specific context
- **Wave topic:** M3 second bundle — sourcing-workspace page (`/sourcing`, journey row 12: search connected sources + trigger ingestion) + the FIRST real DataSourceAdapter (a real deal-source provider, replacing the wave-6 fixture adapter). Completes M3's success metric ("analyst runs a sourcing search across ≥2 connected sources").
- **Roadmap milestone:** M3 (b372bbf7…, in_progress, **product-feature** → mvp-thinner runs at P-0). wave.milestone_id backfilled. wave_db_id 3694481c-9d9e-4f43-9b5e-38d01f10c966 (wave_number 7).
- **claimed_task_ids (bundle):** [dfa5bd56 (sourcing-workspace page), 345dfbc6 (real DataSourceAdapter)] — set at P-1.
- **VENDOR / SDK DEPENDENCY (the key P-3/P-4 concern):** the real-adapter sibling names NO vendor. Vendor selection (Grata / Cyndx / PitchBook / etc.) is a founder/BOARD decision (money commitment + account-issued API key — the founder MUST supply the key per rule 6 exception + rule 19). Wave 7 P-3 runs external-sdk-integration-rules (research + SDK doc) + likely a MONITOR: task for provisioning; P-4 gates the spend/vendor decision. **Possible P-1 RESCOPE-AUTO-SPLIT:** build the sourcing-workspace page NOW (on the wave-6 fixture adapter — provable end-to-end) + DEFER the real-adapter to its own wave once the vendor is chosen + the API key supplied. P-0 reframers to weigh this.
- **Schema change:** likely minimal (sourcing_searches / saved-search? or reuse). New env: a real provider API key (account-issued → founder) IF the real adapter proceeds this wave.
- **design_gap:** likely — sourcing-workspace page (check design/sourcing-workspace.html; if present → D skips).
- **Autonomous mode:** automatic. Push note (from N-3): origin push flaky over HTTP/2 — use `git -c http.version=HTTP/1.1 push` if a push fails with PROTOCOL_ERROR.

## Open escalations carried into gate
- M1 follow-ups (6fe232e3, bfadcec1, d7f716b4 + recurring TopBar-title) under M3 — backlog.

## Gate verdict log
<appended by fresh head-product spawn at P-4 Action 1>
