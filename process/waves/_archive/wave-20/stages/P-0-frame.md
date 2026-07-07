# Wave 20 — P-0 Frame

## Discover
- wave_db_id: 1a22b3aa-17cd-423e-a238-1eaec33fa3d9 (wave_number 20, milestone M9)
- Prior-work: M9 shipped analytics (wave-18) + calibration (wave-19), both READ-ONLY. This is M9's "multi-channel outreach" thread's credential-free slice + the FIRST MUTABLE M9 write surface. The founder-gated CRM (345dfbc6) + external-send stay deferred.
- Roadmap milestone: M9 — Integrations & insight (in_progress, Class product-feature). Success metric _TBD (poll flagged to digest — before M9 close).
- Spec-contract: decomposer-authored rich seed (d45c73b5.description) → full P-1..P-3.
- Product decisions: INTERNAL records only — ZERO external send/provider-key/ESP/#141/LLM/SDK (founder-guard held).

## Reframe
### Original framing
Internal outreach-activity tracker vertical: (seed) new MUTABLE table outreach_activity + additive migration; service (RLS + audit-logged mutations); shared contracts; RBAC API + /outreach panel. Advisors log the manual calls/emails/LinkedIn touches they already run.

### problem-framer — PROCEED (+ CRITICAL write-path-RLS FLAG → P-2 corrections)
Internal manual-touch ledger is the correct causal slice of "multi-channel outreach" (credential-free, no external send smuggled); mutable-ledger-with-HMAC-audit + additive-migration framing sound. **FLAG (write-path isolation crux):** the spec's premise "M8 copies USING→WITH CHECK" is FACTUALLY WRONG — grep shows NO literal WITH CHECK in migrations 0014-0017; the workspace_isolation policies are USING(...)-only with NO `FOR` clause → PG defaults to `FOR ALL` → for FOR ALL with WITH CHECK omitted, PG16 DERIVES the write-time check from the USING expression. So writes ARE fail-closed TODAY via derivation (not a copied clause). NOT a blocker. **3 precision requirements folded into P-2 (below).**

### ceo-reviewer — PROCEED (HOLD-SCOPE)
Genuine felt M&A-advisor workflow gap (record + schedule manual touches), credential-free/spend-free, correct 7-9/10 floor: the "my open touches" index + 0-or-1 deal-target link IN; mini-CRM assignments/reminders/notifications + ALL external send correctly OUT. Traces to the "integrated platform beats stitched tools" bet.

### mvp-thinner — OK (no split)
The fields/links/index are mvp-critical or near-free/high-re-thread-cost columns, not gold-plating. The "3-way link when 1 would do" candidate DECLINED (3 nullable FKs cost ~0 now vs an expensive re-migration+contract+service+UI re-thread later; forcing 1 target risks OVER-CUT of the wave's own "link to a deal target" claim). Same direction as wave-19 OK. The 4-task vertical is the minimum coherent slice.

### Disposition: PROCEED
All-PROCEED/OK, no split. Final framing → P-1: 4-task internal outreach-activity tracker vertical, additive migration, WRITE surface (workspace-scoped, audit-logged), credential-free.

## LOAD-BEARING (WRITE surface — new vs read-only waves 18/19) + the 3 write-path-RLS precision requirements (from problem-framer, MUST fold into P-2):
1. **Author the new outreach_activity workspace_isolation policy `FOR ALL` (or command-unspecified) with the SAME `USING (workspace_id = NULLIF(current_setting('app.workspace_id', true),'')::uuid)` predicate as the other 28 tenant tables.** Do NOT author it `FOR SELECT` — a FOR SELECT policy has no derived WITH CHECK → a cross-firm WRITE (INSERT/UPDATE carrying another firm's workspace_id) would NOT be rejected → write-side leak.
2. **Add a WRITE-PATH RLS negative test** (firm-A GUC set, INSERT/UPDATE carrying firm-B workspace_id → REJECTED), NOT only the read A-invisible-to-B negative-read. Both directions proven, as dealflow_app.
3. **Do NOT instruct Build to grep for / add a literal `WITH CHECK` to "match M8" — M8 has NONE**; the isolation is derived from USING under FOR ALL. A divergent explicit WITH CHECK clause would FORK outreach_activity from the other 28 tenant tables. Match the existing USING-only FOR-ALL shape exactly.
- **Audit-logged mutations:** every CREATE/UPDATE/status-transition APPENDS to the M2 HMAC-SHA256 audit chain; the mutable table is NOT wired INTO the immutable audit_log hash-chain (it's a ledger, must stay updatable — NOT WORM).
- **Migration safety (GAP-4):** additive-only; empty-DB + POPULATED-DB migration test (no WORM-trigger collision on populated rows). Distinct enum names (outreach_activity_channel/_status — wave-11 cluster lesson).
- **Credential-free:** ZERO external send/provider-key/ESP/#141/LLM/SDK.

claimed_task_ids: [d45c73b5 (seed table+migration), 5c12ac3a (service), c3776cac (contracts), b2acf4ce (API+/outreach panel)] — NOT 345dfbc6 (founder-gated CRM, stays queued).
