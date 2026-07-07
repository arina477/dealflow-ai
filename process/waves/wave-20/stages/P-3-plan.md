# Wave 20 — P-3 Plan (multi-spec: M9 outreach-activity tracker, 4 blocks)

## Approach
### Action 1 — Architecture deltas
- **outreach_activity table + additive migration [seed d45c73b5].** New MUTABLE tenant table in apps/api/src/db/schema/outreach.ts: workspace_id FK (RLS), outreach_activity_channel pgEnum [call|email|linkedin|other] + outreach_activity_status pgEnum [planned|completed|cancelled] (DISTINCT names — wave-11 cluster lesson), subject NOT NULL, notes nullable, dueAt/completedAt nullable, 0-or-1 deal-target link (outreachId/matchCandidateId/pipelineId + mandateId all nullable), createdBy FK ON DELETE RESTRICT, timestamps, workspace_id index + (workspace_id,status,due_at) index. **RLS: ENABLE + FORCE + workspace_isolation policy `FOR ALL` (or command-unspecified) with the SAME `USING (workspace_id = NULLIF(current_setting('app.workspace_id', true),'')::uuid)` as the other 28 tenant tables — NOT FOR SELECT (would lose the derived write-check); NO literal WITH CHECK (M8 has none — derived from USING under FOR ALL; a divergent clause forks the table).** GRANT to dealflow_app. Additive-only (rollback = DROP table + DROP 2 types). *Alt:* a literal WITH CHECK "to be safe" — REJECTED (forks from the 28-table shape; the derived check is correct + matched).
- **Service [5c12ac3a].** outreach-activity CRUD (create/list/update-status/cancel), workspace-scoped via getDb; **every mutation APPENDS a normal entry to the M2 HMAC-SHA256 audit chain** (audit-logged mutation invariant) — the table is NOT wired INTO the immutable audit_log (it's a mutable ledger, stays updatable). Read-path via getDb (RLS).
- **Contracts [c3776cac].** shared-Zod create/update/list shapes (channel/status enums, 0-or-1 link).
- **API + /outreach panel [b2acf4ce].** RBAC-scoped API (advisor+admin — decide who logs touches); /outreach panel = create form (MandateForm pattern) + a "my open touches" list (the (workspace_id,status,due_at) index) with status transitions.

### Action 2 — Data model
ONE additive migration (new table + 2 enums; no existing table altered). **DETERMINISTIC-TEST-SPEC-FIRST:** author + fail-first (a) the migration test (empty-DB apply + POPULATED-DB apply proving no WORM-trigger collision on populated rows — GAP-4) and (b) the RLS read negative-read (A's row invisible to B) AND (c) the RLS WRITE negative-test (firm-A GUC, INSERT/UPDATE carrying firm-B workspace_id → REJECTED). Journaled (BUILD rule 4).

### Action 3 — API contracts
- POST /outreach-activity (create), GET /outreach-activity (list own-firm, filterable by status), PATCH /outreach-activity/:id (update/status-transition): RBAC (advisor+admin 200 / 403 / 401), workspace-scoped, audit-logged. Web /outreach-activity proxy.

### Action 4 — Dependencies: NONE. NO external send/provider-key/ESP/#141/LLM/SDK. NO new dep.

## Plan (file-level, by B-stage)
**B-0 Schema** (backend-developer): the additive migration (table + 2 enums + FORCE RLS + FOR-ALL USING-only policy + GRANT dealflow_app) + the migration test (empty + POPULATED-DB, GAP-4) FIRST (fail). Journaled.
**B-1 Contracts** (backend-developer): shared outreach-activity Zod + rbac map (/outreach-activity advisor+admin).
**B-2 Backend** (backend-developer): service (getDb CRUD + audit-logged mutations) + controller (RBAC) + module reg + specs INCL the read negative-read AND the **write-path negative-test** (cross-firm INSERT/UPDATE reject, as dealflow_app via workspaceAls.run — REAL service, the wave-18/19 pattern) + audit-log-appended-on-mutation test + RBAC (403/401).
**B-3 Frontend** (nextjs-developer): /outreach panel (create form + my-open-touches list + status transitions) + proxy + RBAC-gate + empty/error states.
**B-4/B-5/B-6:** head-builder polices FOR-ALL-USING-only-policy (not FOR SELECT, no literal WITH CHECK), write-path negative-test REAL, audit-logged-mutation, populated-migration test, distinct enums, credential-free (no external send).

### Action 6 — Specialists: backend-developer (B-0/B-1/B-2), nextjs-developer (B-3). Both in AGENTS.md.
### Action 7 — Parallelization: B-0 → B-1 → B-2 → B-3 (serial; B-0 has a real migration this time).
### Action 8 — Self-consistency: CLEAN. LOAD-BEARING: write-path-RLS (FOR ALL/USING-only/derived-check), read+write negative tests, audit-logged-mutations, populated-migration (GAP-4), distinct-enums, credential-free. design_gap false.

```yaml
deps_new: []
schema_change: true   # ONE additive migration (new table + 2 enums); rollback = DROP table + DROP 2 types
new_secret: false
new_sdk: false
specialists: [backend-developer, nextjs-developer]
reuse: [wave-17 getDb/ALS + workspace GUC + FORCE RLS + the 28-table FOR-ALL USING-only policy shape, M2 HMAC audit chain (append on mutation), M1 RolesGuard/@Roles, MandateForm create pattern, the design system, outreach/pipeline/matching/mandate FK targets]
compliance_invariants: [write-path-RLS-isolation (FOR-ALL-USING-only, cross-firm-write-reject), read-path-RLS-negative-read, audit-logged-mutations (M2 HMAC append; table not WORM), additive-populated-migration (GAP-4), distinct-enum-names, credential-free-no-external-send]
hard_boundaries: "INTERNAL records only — ZERO external send/provider-key/ESP/#141/LLM/SDK; additive migration (new table only); FOR-ALL USING-only RLS policy matched to the 28 tenant tables (no literal WITH CHECK, no FOR SELECT); mutable ledger (NOT WORM) but mutations audit-logged"
design_gap_flag: false
self_consistency: clean
```


## P-4 head-product REWORK→corrections (write-path test precision, folded into the seed spec — MUST honor at B-0/B-2):
- R1 own-row re-home UPDATE (GUC=firm-A, own row, SET workspace_id=firm-B → reject 42501) — the ACTUAL write-check test (the naive "UPDATE with firm-B id" is vacuous — row already invisible). + INSERT with explicit firm-B id → reject.
- R2 FORCE-RLS positive control (assert relforcerowsecurity / prove FORCE applies to owner — not ENABLE-only owner-bypass false-green).
- R3 cross-firm deal-target FK tenancy: the service validates a provided pipelineId/matchCandidateId/mandateId belongs to the caller's workspace (resolve under getDb/GUC — firm-B target invisible → reject); a test proves cross-firm FK link rejected.
- R4 per-verb audit assertions (create/update/status-transition/cancel each append + verifyChain ok).
