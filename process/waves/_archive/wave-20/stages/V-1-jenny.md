# Wave 20 — V-1 jenny (spec-contract vs DEPLOYED verification)

**Wave:** 20 (M9 internal outreach-activity tracker — first mutable M9 write surface)
**Deployed:** LIVE @86ddc29 (api dealflow-api-production-66d4, web dealflow-web-production-a4f7)
**Authoritative spec:** seed task `d45c73b5-39bc-4a8a-a5c3-65d12b0cb5eb` `tasks.description` (YAML head incl. R1-R4 + SF1-SF7), 4 claimed tasks (d45c73b5 table+migration / 5c12ac3a service / c3776cac contracts / b2acf4ce API+panel).
**Method:** read the DB seed spec verbatim; traced deployed code (migration 0018, schema TS, service, repository, controller, shared Zod, RBAC map, unit + e2e specs, C-1 readTail fix); ran live unauthed prod probes; cross-checked journey map (T-9) + product-decisions. Authed create/list DEFERRED (no prod advisor fixtures) — authoritative isolation+audit+RBAC proof is the C-1 CI e2e as `dealflow_app` on postgres:18 (run 28841757352, green) + live fail-closed gating. Deferral noted honestly, not fabricated.

## VERDICT: **APPROVE** — 8 MATCHES / 0 DRIFTS / 2 spec-gaps-surfaced (both non-blocking, for next-wave P-2/L-2)

---

## Crux findings (the three most important)

### 1. Write-path isolation vs M8 — MATCH (no fork)
- **Spec:** `workspace_isolation` policy MUST be `FOR ALL` / command-unspecified, USING-only `NULLIF(current_setting('app.workspace_id', true),'')::uuid`, matched to the 28 M8 tenant tables — NO `FOR SELECT`, NO literal `WITH CHECK`; write-check derived by PG.
- **Deployed:** `apps/api/src/db/migrations/0018_outreach_activity.sql` STEP 4 creates the policy exactly as specced — `CREATE POLICY "workspace_isolation" ... USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid)`, no command clause (⇒ FOR ALL), no literal WITH CHECK. Predicate is byte-identical to the **0017 (empty-string-fixed) 28-table shape**, not the pre-fix bare `::uuid` 0014 shape. STEP 3 `ENABLE + FORCE ROW LEVEL SECURITY`; STEP 6 GRANT SELECT/INSERT/UPDATE/DELETE to `dealflow_app` (matches 0016). No divergent shape.
- **R1 own-row re-home (the real write-check falsifier):** proven deployed by CI e2e `outreach-activity-rls.e2e-spec.ts` OAE-1 (GUC=WS_A, own visible row, `UPDATE SET workspace_id=WS_B` → SQLSTATE **42501**) + OAE-2 (explicit WS_B INSERT → 42501), re-proven in `outreach-activity-migration.e2e-spec.ts` OAM-4/OAM-5 — all as `dealflow_app`, non-vacuous (targets a *visible* own row). Green in run 28841757352.
- **SF1 no silent DEFAULT_WORKSPACE_ID:** service `create()` throws `ForbiddenException` when `getWorkspaceId()` is null (no `?? DEFAULT_WORKSPACE_ID`); repository INSERT OMITS workspace_id, letting the column DEFAULT `NULLIF(current_setting(...),'')::uuid` capture the GUC (or NULL→NOT NULL reject). Belt+suspenders exactly as specced. Proven by OAE-3 (empty-ALS → rejected, row NOT in default workspace).
- **R2/SF3 FORCE positive control:** OAE-14 + OAM-7 assert `relrowsecurity AND relforcerowsecurity = true` via pg_class — defeats the ENABLE-only owner-bypass false-green class.
- **Live:** anon POST/GET/PATCH `/outreach-activity` all → **401** (mounted, fail-closed, not 404/500). Consistent with M8 write-side isolation. **No fork.**

### 2. Internal tracker vs external-send/CRM deferral — MATCH
- **Spec:** INTERNAL records only — ZERO external send/provider key/ESP/#141/LLM/SDK; channel values pure labels.
- **Deployed:** schema TS, service, controller all carry the ZERO-external-send hard boundary in code + comments; `deps_new: []`; `new_sdk: false`; SF7 confirms channel enum (`call|email|linkedin|other`) has no dispatch/webhook/queue consumer. No email/LLM import in any wave-20 file.
- **Consistency:** the founder-gated send (#141 email-provider credential, product-decisions L306/314/322/329) + CRM adapter (`345dfbc6` re-homed M3→M9, founder-blocked on vendor+API key+spend, product-decisions L231/399/414) deferrals are HONORED — this wave explicitly builds only the credential-free INTERNAL carve-out (product-decisions L414). No smuggled send.

### 3. Mutable ledger + audit-logged vs M2 WORM — MATCH
- **Spec:** table is MUTABLE (updatable, NOT WORM, NOT wired into immutable audit_log) but every CREATE/UPDATE/status-transition/cancel APPENDS to the M2 HMAC-SHA256 chain (R4/SF5 last-in-txn, one-per-verb, audit-failure-rolls-back).
- **Deployed:** table has `updatedAt` + status transitions to completed/cancelled (mutable). Service appends via `auditService.append(evt, tx)` LAST in the SAME `runInTransaction` for all 4 verbs (distinct actions: `outreach-activity-create/update/status-transition/cancel`). Proven by unit OA-R4-1..6 + e2e OAE-9..13 (per-verb exactly-one entry + verifyChain ok + rollback-on-audit-throw) + OAM-3 (verifyChain ok after migration). The immutable chain stays WORM; the mutable ledger FEEDS it. Correct M2 model.
- **C-1 readTail fix (chain integrity):** the cycle-1 fix (`audit.repository.ts::readTail`) routes the tail read through the pre-existing `read_audit_chain_rls_exempt` SECURITY DEFINER function (migration 0016) so the append sees the true GLOBAL chain tail rather than an RLS-filtered empty subset (which was causing genesis seq=1 collisions / 23505 on the shared DB). This is a **genuine correctness improvement, not a drift**: the chain is a single global monotonic sequence; only the integrity WALK is RLS-exempt, the LIST/EXPORT projection stays RLS-scoped. It PRESERVES cross-workspace chain integrity (verifyChain green in CI). The new mutable write surface merely *surfaced* the latent RLS-filtered-readTail bug.

---

## Remaining checks

### 4. /outreach/activity panel vs journey map — MATCH (additive, no collision)
- Deployed route `/outreach/activity` (page + OutreachActivityPanel/Form/List) is DISTINCT from `/outreach-composer` and `/outreach-templates`. Live: both `/outreach/activity` and `/outreach-composer` → 307 (distinct, mounted, auth-redirect). Journey map (`user-journey-map.md` L207-210) + T-9 note UPDATED with the new route/API/nav (wave-18 GAP-A lesson honored). No route collision.
- Minor: spec PROSE says "/outreach panel" but the acceptance criteria + P-3 plan + journey map all land it at `/outreach/activity`. This is spec-prose imprecision resolved consistently in code + journey map — not a drift.

### 5. design_gap_flag false (MandateForm + list/table reuse) — MATCH
- `OutreachActivityForm.tsx` documents "MandateForm pattern" + design-system §1 zinc/emerald reuse; panel composes Form+List over the shipped AppShell/design system. Consistent with the wave-15..19 no-new-design precedent. `design_gap_flag: false` correct — no D-block needed.

### 6. RBAC advisor+admin + SoD — MATCH
- `packages/shared/src/rbac.ts` L575-583: `/outreach-activity` and `/outreach-activity/:id` → `allowedRoles: ['advisor','admin']`. Controller sources roles via `rolesForRoute()` with fail-closed boot assertions. rbac.test.ts proves analyst + compliance DENIED on both. Logging a manual touch is not a send/approval → **no compliance-approver / SoD collision** (compliance role is correctly excluded from the activity ledger, preserving DB-authoritative RBAC + M2 SoD). Live anon → 401 confirms the guard chain is mounted.

### 7. _TBD metric — MATCH
- M9's quantitative success metric carries the `_TBD by founder_` token, surfaced non-blocking to the founder digest — identical handling to M8 (product-decisions L359/372) and consistent with the wave-18/19 M9 verticals. The scope-too-vague CLUSTER guard (TBD metric AND one-line scope AND no references) did not fire; the qualitative target is present + testable. Not a blocker.

### 8. Spec-gap detection (for next-wave P-2 / L-2 — NON-BLOCKING)
- **Gap A (infra bug the wave exposed, NOT a spec drift):** the C-1 cycle-1 `readTail` RLS-filtered-to-empty bug was a **latent M2/M8 infra defect** that only manifested once a NEW audit-writing surface appended under a workspace GUC on the shared DB (genesis seq collision). The wave-20 spec did not anticipate it (it assumed the M2 append path was correct). It was correctly root-caused + fixed forward as a real prod audit-chain correctness bug (not weakened). **Surface for L-2:** any new audit-writing module must read the GLOBAL chain tail via the RLS-exempt function — candidate BUILD-PRINCIPLE. Not a wave-20 defect.
- **Gap B (spec-vs-DB shape latent inconsistency):** 0018 matches the **0017-fixed** empty-string-safe predicate, but the original 0014 M8 tables used the bare `::uuid` form before 0017 patched them. The spec says "matched to the 28 tenant tables" without pinning to the post-0017 shape — the builder correctly chose the fixed shape, but a future P-2 authoring "match M8" against an un-migrated reference could regress. **Surface for next P-2:** pin the reference to the current (post-0017) policy shape explicitly.

---

## Conflicting prior decision if any DRIFTS
**None.** Zero drifts. All deferrals (345dfbc6 CRM vendor-gate, #141 email-send, LLM-spend, _TBD metric) and prior models (M8 write-side isolation, M2 WORM append-only) are consistent with the deployed implementation.

## Limits (honest)
- Authed create/list/PATCH NOT exercised against prod (no advisor fixtures; invite→signup not performed). Behavioral proof of R1-R4/SF1-SF7 rests on the CI e2e as `dealflow_app` on postgres:18 (run 28841757352, green — RLS 9 + migration 12 tests demonstrably RAN, not skipped) + live unauthed fail-closed gating (401 on all 3 verbs, audit-verify 401 not 500). This is the strongest available signal absent prod fixtures and is not fabricated.

---
**ONE-LINE:** APPROVE — 8 MATCHES / 0 DRIFTS (M8-write-path-consistency MATCH · no-external-send MATCH · mutable-ledger-vs-WORM MATCH); no conflicting prior decision; 2 non-blocking spec-gaps surfaced for L-2 (readTail RLS-exempt = infra bug the write surface exposed, not a spec drift) and next P-2 (pin "match M8" to the post-0017 policy shape).
