# Wave 20 — P-2 Spec (pointer)
**Source of truth:** seed task d45c73b5 tasks.description (formal spec YAML head prepended to the decomposer prose). wave_type multi-spec (4 blocks). design_gap_flag false.
**claimed_task_ids:** [d45c73b5 (table+migration seed), 5c12ac3a (service), c3776cac (contracts), b2acf4ce (API+/outreach panel)] — NOT 345dfbc6 (founder-gated CRM).
## AC summary (M9 internal outreach-activity tracker — first mutable M9 write surface)
1. **d45c73b5 table+migration:** new MUTABLE outreach_activity table (channel/status DISTINCT enums, workspace_id RLS FK, 0-or-1 deal-target link, createdBy, indexes) via ONE additive migration; **FORCE RLS + workspace_isolation policy FOR ALL with USING-only (matched to the 28 tenant tables — NOT FOR SELECT, NO literal WITH CHECK; PG derives the write-check)**; DETERMINISTIC-TEST-SPEC-FIRST (empty+POPULATED migration [GAP-4], read negative-read, **WRITE negative-test cross-firm INSERT/UPDATE→reject**).
2. **5c12ac3a service:** CRUD via getDb (RLS); **every mutation appends to the M2 HMAC audit chain** (table NOT WORM — stays updatable).
3. **c3776cac contracts:** shared-Zod create/update/list (enums, 0-or-1 link, null-explicit).
4. **b2acf4ce API+panel:** POST/GET/PATCH /outreach-activity RBAC (advisor+admin 200/403/401), audit-logged; /outreach create-form + my-open-touches list (design-system reuse).
## Load-bearing (WRITE surface): write-path-RLS (FOR-ALL USING-only, cross-firm-write-reject — the P-0 problem-framer correction) | read-negative-read | audit-logged-mutations (M2 HMAC; not WORM) | populated-migration (GAP-4) | distinct-enums | credential-free (no external send). _TBD metric = founder-poll (digest).


## P-4 head-product REWORK→corrections (write-path test precision, folded into the seed spec — MUST honor at B-0/B-2):
- R1 own-row re-home UPDATE (GUC=firm-A, own row, SET workspace_id=firm-B → reject 42501) — the ACTUAL write-check test (the naive "UPDATE with firm-B id" is vacuous — row already invisible). + INSERT with explicit firm-B id → reject.
- R2 FORCE-RLS positive control (assert relforcerowsecurity / prove FORCE applies to owner — not ENABLE-only owner-bypass false-green).
- R3 cross-firm deal-target FK tenancy: the service validates a provided pipelineId/matchCandidateId/mandateId belongs to the caller's workspace (resolve under getDb/GUC — firm-B target invisible → reject); a test proves cross-firm FK link rejected.
- R4 per-verb audit assertions (create/update/status-transition/cancel each append + verifyChain ok).
