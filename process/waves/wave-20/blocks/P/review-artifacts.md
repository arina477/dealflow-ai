# Wave 20 — P-block review artifacts

**Block:** P (Product)
**Wave topic:** M9 internal outreach-activity tracker — new MUTABLE table (outreach_activity) + service (RLS + audit-logged mutations) + contracts + RBAC API + /outreach panel. FIRST mutable M9 write surface (exercises M2 HMAC audit chain + write-path RLS).
**Block exit gate:** P-4
**Status:** gate-passed

## Stage deliverables
| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | stages/P-0-frame.md | done | seeded P-0 Action 0; discovery + reframe |
| P-1 | stages/P-1-decompose.md | done | |
| P-2 | stages/P-2-spec.md | done | |
| P-3 | stages/P-3-plan.md | done | |
| P-4 | stages/P-4-gemini-review.md | done (APPROVED; SF1-SF7 obligations) | |

## Block-specific context
- **Wave topic:** M9 internal outreach-activity tracker (multi-channel outreach thread's credential-free slice — log call/email/LinkedIn touches as INTERNAL records; NO external send/API/ESP/LLM/SDK)
- **Spec-contract short-circuit verdict:** decomposer-authored seed (rich spec in d45c73b5.description) → full P-1..P-3
- **Roadmap milestone:** M9 — Integrations & insight (in_progress; wave_db_id 1a22b3aa, wave_number 20; Class product-feature; Success metric _TBD-by-founder — poll flagged to digest)
- **design_gap_flag:** unset — set at P-1 (the /outreach panel is a NEW create/edit surface — a CRUD form/list, possibly design_gap TRUE if it's a net-new form paradigm, or FALSE if composable from existing form/table patterns; P-1 judges)
- **claimed_task_ids:** [d45c73b5, 5c12ac3a, c3776cac, b2acf4ce] (4, multi-spec)
- **Autonomous mode:** automatic
- **LOAD-BEARING (this is a WRITE surface — new vs the read-only waves 18/19):**
  - **Write-path RLS isolation:** outreach_activity workspace_id + FORCE RLS; the M8 policy copies USING into WITH CHECK → a cross-firm WRITE (INSERT/UPDATE with another firm's workspace_id) must be REJECTED (the write-side leak — GAP-2-adjacent; P-4 scrutinizes). RLS negative-read + negative-WRITE proof.
  - **Audit-logged mutations:** every CREATE/UPDATE/status-transition APPENDS to the M2 HMAC-SHA256 audit chain (audit-logged mutation invariant); the table itself is NOT wired into the immutable audit_log hash-chain (it's a mutable ledger, NOT WORM).
  - **Migration safety (GAP-4):** additive-only; empty-DB + POPULATED-DB migration test (no WORM-trigger collision on populated rows — the wave-17 lesson).
  - **Distinct enum names** (outreach_activity_channel / _status — no cluster collision, wave-11 lesson).
  - **Credential-free:** ZERO external send/provider-key/ESP/#141/LLM/SDK — internal records only (founder-guard held).

## Open escalations carried into gate
none

## Gate verdict log
<appended by fresh head-product spawn at P-4 Action 1>
