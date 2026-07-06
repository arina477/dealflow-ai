# V-1 — jenny (semantic spec-vs-deployed verification, wave-17 M8 pilot-partner data-isolation)

**Stage:** V-1 (Verify · spec-intent match beyond literal ACs) · **Reviewer:** jenny (spec-compliance auditor)
**Deployed:** LIVE @ `591b3f8bb5877db0357b629f3e88c53bb2a36843` (api `f3b96634…`, web `cdc512b3…`, both Railway SUCCESS, commit-verified)
**Authoritative spec:** seed task `0db154ff` `tasks.description` (DB) incl. the `## P-4 SECURITY REWORK` addendum (4 findings, overrides where conflicting).
**Read:** P-2-spec.md (pointer), P-3-plan.md, C-2-deploy-and-verify.md (live evidence), user-journey-map.md.

---

## VERDICT: **APPROVE**

All four spec blocks (workspaces+scoping / deny-by-default FORCE-RLS / request-scope propagation / cross-tenant negative-read proof) plus the P-4 F1–F4 rework are implemented in the deployed `591b3f8` code and corroborated by the C-2 live probes + the CI ISO/INV/GUC/RBAC suites (run as `dealflow_app`). The mvp-critical claim — "no cross-firm data visibility" — is genuinely enforced by deny-by-default `FORCE ROW LEVEL SECURITY` keyed on a request-scoped `app.workspace_id` GUC, not app-layer filtering. Isolation does not over-block the existing single firm (backfilled to default workspace; live reads return real rows, `{ok:true, entriesChecked:328}`).

**Findings: 5 total — 0 spec-drift (code-wrong) · 5 spec-gap (spec didn't anticipate) · 0 blocking.** No finding blocks the wave; all 5 are forward-looking notes for next-wave P-2 (mostly H3 multi-firm-expansion latent risks that are inert for ONE pilot firm).

**Verification-surface limitation (disclosed, not a finding):** the `CLAUDOMAT_DB_URL` I can reach is the brain control-plane DB (founder_bets/milestones/tasks/waves) — NOT the DealFlow app DB, which is on Railway private networking (`postgres.railway.internal`, not publicly exposed; the C-2 migration proxy was deleted post-run). I therefore could NOT independently re-query the prod app DB. I verified: (a) the deployed source at `591b3f8` (migrations 0014–0017, interceptor, verifier, audit repo, auth service); (b) live API behavior (`/health` == deployed SHA, unauth `/compliance/audit-log` + `/verify` both **401**, web **307**); (c) the CI ISO-1..5 / INV-1..5 fault-killing suites. The DB-internal state (27 tables FORCE-RLS, 328 audit rows backfilled null_ws=0, verifyChain ok:true) rests on the C-2 captured evidence — I did not fabricate a re-query.

---

## Per-objective semantic match

### 1. Isolation INTENT — the mvp-critical claim ✅ MATCH
**Spec:** e45ba68c + df2f3b2f + P-4 F1 — deny-by-default FORCE-RLS keyed on `workspace_id = current_setting('app.workspace_id')`, proven by an owner/non-superuser-connection negative-read test.
**Deployed:** `0014_workspace_isolation.sql` STEP 5 `ENABLE`+`FORCE ROW LEVEL SECURITY` per tenant table; deny-by-default policy `USING (workspace_id = NULLIF(current_setting('app.workspace_id', true),'')::uuid)` (0017-corrected); NO COALESCE / no `=''` fail-open. C-2 live: api boots as `dealflow_app` (NOSUPERUSER NOBYPASSRLS) — a superuser boot fail-closes at `[RLS-GUARD]` so the healthy `/health db:ok` at the deployed SHA is positive proof the runtime is non-superuser and FORCE-RLS is live. CI `workspace-isolation.e2e-spec.ts` ISO-1/ISO-3 assert exact-0 cross-tenant rows, ISO-2 positive control asserts >0 same-tenant, ISO-4 asserts RESET→0 (fail-closed) — all run under `SET ROLE dealflow_app` (NOSUPERUSER NOBYPASSRLS) so FORCE-RLS actually applies (false-green guard honored). For ONE prod firm a live 2-workspace test is impossible; the CI ISO suite as `dealflow_app` is the authoritative cross-tenant proof and it is fault-killing. **Deployed behavior matches the isolation intent.**

### 2. Backfill / existing data — no over-block ✅ MATCH
**Spec:** 0db154ff — backfill ALL existing rows to default workspace BEFORE NOT NULL; 0 orphan/NULL workspace_id.
**Deployed:** `0014` STEP 3 backfill → STEP 4 NOT NULL cutover (documented execution order; deviating fails the NOT NULL ALTER). C-2 owner assertions: 27 tables carry workspace_id, `audit_log_entries` total 328 / `null_ws=0` / all = default workspace `a1b2c3d4-…-001`. Live authed read: `GET /compliance/audit-log` → 200 with **50 rows** (seqNo 279–328), NOT 0-row-bricked. **The existing firm's data is fully visible to its users — isolation does not over-block. Matches.**

### 3. Invite-signup under RLS ✅ MATCH
**Spec:** 96026365 + P-4 F2 — server-derived workspace; wave-15 invite-only; new user lands in the invite's workspace.
**Deployed:** `auth.service.ts:117` consumes the invite via SECURITY DEFINER `resolve_invite()` (RLS-exempt bootstrap); `runInTransactionWithWorkspace(inviteWorkspaceId)` (line 138) creates the users row in the invite's workspace; token looked up as `SHA256(token)` (line 292). `invite-signup-rls.e2e-spec.ts` INV-1..5: workspace is `invite.workspace_id` (server-derived, never client-supplied), new user reads WS-W mandates and CANNOT read WS-X (post-signup isolation holds), consumed invite → 0 rows (no replay), INV-5 fault-killing (drop `resolve_invite` → fails). C-2: authed compliance user established via invite→signup landed in pilot workspace. **Consistent with wave-15 invite-only + M8 "partner firm operates in its workspace."**

### 4. Audit isolation — read-scoped, chain global ✅ MATCH
**Spec:** e45ba68c + P-4 F3 — audit LIST/EXPORT read RLS-scoped (WORM ≠ read-isolation, ceo-reviewer boundary); integrity chain GLOBAL, verifyChain ok:true; workspace_id HMAC-excluded.
**Deployed:** `audit.repository.ts:161 readChainAscending()` reads via SECURITY DEFINER `read_audit_chain_rls_exempt(1, …)` — global integrity walk, RLS-exempt (comment at :146–153 states the F3 rationale explicitly). List/export projections use `getDb(this.db)` on the request-scoped RLS-applied connection = workspace-scoped visibility. `audit-log.ts:127/145` confirm workspace_id is NOT in HashableEntryFields (never hash-fed). C-2 live: `/compliance/audit-log/verify` → `{ok:true, entriesChecked:328}` (global) while `/compliance/audit-log` list → 50 rows (scoped). **Integrity global, visibility scoped — matches the F3 split and the wave-13 recordkeeping design.**
**Prior-decision conflict check:** wave-13/M2 recordkeeping treated audit as org-wide because there was ONE org. M8 refines "org-wide" → "one-firm-wide" (a workspace == the pilot firm). No conflict — a compliance user still sees their entire firm's audit; the boundary only bites cross-firm, which does not exist yet in prod. This is a correct refinement, not a regression.

### 5. No new UI (design_gap_flag false) ✅ MATCH
**Spec:** design_gap_flag false — isolation transparent, no new screen.
**Deployed:** B-3 skipped; `0014`/interceptor/verifier are backend/RLS/infra only; no new endpoint (Action 3: workspace resolved server-side, never client-supplied). Journey map inventory unchanged (H2/H3 pilot-partner/multi-tenant pages explicitly deferred, line 126). Live web `/` → 307 auth redirect (unchanged surface). **Consistent — the journey map needs no new screen.**

### 6. Deferral honesty ✅ MATCH
**Spec / wave-16 N-1 M8-promotion:** M8 quantitative success metric stays founder-TBD (poll, not blocking); scope is ONE firm (not H3 SaaS).
**Deployed:** spec body states "M8 quantitative success metric is founder-TBD (poll, not a build hard-stop — the negative-read proof is the testable bar)" and "Scope: ONE pilot firm (not H3 multi-tenant SaaS)". P-3 hard_boundaries: "ONE pilot firm (NOT H3 multi-tenant SaaS)". Nothing shipped attempts multi-firm provisioning, workspace-switcher UI, or a metric dashboard. The testable proxy ("no cross-firm data visibility" + negative-read proof) is the actual bar met. **Deferral is honest and consistent with the wave-16 promotion decision.**

---

## Spec-gap findings (all forward-looking — for next-wave P-2)

**GAP-1 (Low) — RESET produces `''`, not NULL; the spec assumed NULL.**
Spec AC (e45ba68c) says "unset app.workspace_id → NULL comparison → 0 rows." Deployed reality (documented in `0017_rls_policy_empty_string_fix.sql`): `current_setting('app.workspace_id', true)` after a `RESET` returns **empty string `''`**, not NULL, and `''::uuid` throws SQLSTATE 22P02 — which would surface as a 500, not a clean deny. The fix wraps the cast in `NULLIF(...,'')::uuid`, preserving the fail-closed invariant (`'' → NULL → NULL=uuid → false → 0 rows`). **Code is CORRECT (fail-closed preserved); the spec simply didn't anticipate the empty-string semantics of RESET.** Next P-2 should encode `NULLIF`-guarded GUC reads as the standard shape so a future policy edit doesn't reintroduce the raw `::uuid` cast.

**GAP-2 (Low→Med for H3) — write-path `getWorkspaceId() ?? DEFAULT_WORKSPACE_ID` fallback.**
`disclaimers.service.ts:125/213`, `rules.service.ts:81` assign `workspaceId: getWorkspaceId() ?? DEFAULT_WORKSPACE_ID` on INSERT. For ONE firm this is inert (only the default workspace exists) and the READ path is RLS-protected regardless. But the P-4 F1 rework explicitly warned against "default-to-first-workspace" on the resolution path. This `??`-to-default on the WRITE path is a latent cross-firm mis-placement risk the moment a second firm exists (a background/unauth write with no GUC would silently land in the pilot firm's workspace instead of failing closed). **Spec-gap: the spec's fail-closed intent covered reads and the interceptor's resolve path, but did not enumerate write-time workspace assignment in the two settings services.** Surface for H3 P-2: replace the write-path default with an explicit deny/throw when no GUC is resolved.

**GAP-3 (Info) — ISO tests use `SET ROLE dealflow_app`, not a fresh non-owner connection.**
df2f3b2f AC says the test "runs over the SAME owner/app connection the API uses — NOT a fresh non-owner role." The CI harness pool is superuser and `ci.yml` cannot be edited (no Workflows:write), so the test uses `SET ROLE dealflow_app` on a superuser-checked-out client to drop to NOSUPERUSER/NOBYPASSRLS before assertions. This correctly makes FORCE-RLS apply (the false-green guard is satisfied — a real leak WOULD fail), but it is a fidelity nuance vs the literal "same connection the API uses" and vs prod where the app connects natively as `dealflow_app`. **Spec-gap: the spec assumed the test connection could be the app role directly; the CI environment forced a SET ROLE workaround that is semantically equivalent but not literal.** Note for P-2: prefer a dedicated non-superuser CI DB role so the negative-read test connects natively.

**GAP-4 (Info) — populated-migration WORM collision surfaced only at deploy time.**
The C-2 HOLD caught that `0014`'s audit backfill collided with the WORM BEFORE-UPDATE trigger on the populated prod DB (328 chained rows) — the empty CI DB never exercised it. Fixed via DISABLE/UPDATE/ENABLE trigger-wrap + a new `audit-migration-populated-db.e2e-spec.ts` (AMP-1..5, AMP-5 fault-killing; AMP-4 later scoped to seeded rows to avoid shared-DB HMAC-key pollution). **Spec-gap: neither the spec nor the plan anticipated that a backfill UPDATE on a WORM-protected populated table needs a trigger-disable window.** Now covered by a populated-DB migration test — but P-2 for any future audit-table migration should require a populated-DB proof as a standing AC.

**GAP-5 (Info) — the connection-split (`DATABASE_URL` vs `MIGRATE_DATABASE_URL`) is an undocumented operational contract.**
P-4 F1 mandated a non-superuser runtime + owner for migrations, but the spec/plan did not name the two-URL split, the `preDeployCommand` bare-env-prefix form (the `bash -lc` PATH bug that failed api deploy #1), or the coupled rollback requirement (revert BOTH deployment AND runtime URL). These emerged at C-2. **Spec-gap: the RLS design implied a privilege split but the deploy-time operational contract was discovered, not specified.** P-2 for any future migration touching role privileges should carry the connection-split + coupled-rollback as explicit deploy ACs.

---

## Compliance-invariant re-confirmation (deployed @ 591b3f8)
- FORCE-RLS + owner/non-superuser-connection negative-read test: ✅ (0014 STEP 5 + ISO under SET ROLE dealflow_app)
- audit_log workspace_id hash-excluded + WORM-blocks-reattribution tested: ✅ (audit-log.ts:127/145 + ISO-5 asserts P0001 on UPDATE)
- backfill-before-NOT-NULL, 0 orphans: ✅ (0014 STEP 3→4; C-2 null_ws=0)
- deny-by-default fail-closed on unset/RESET GUC (no fail-open): ✅ (0017 NULLIF; ISO-4)
- request-scoped dedicated-connection + RESET-in-finally, no pool leak: ✅ (workspace.interceptor.ts:87–92 RESET in finally)
- resolver RLS-exempt bootstrap: ✅ (resolve_user_workspace + resolve_invite SECURITY DEFINER)
- chain-integrity global RLS-exempt vs list/export workspace-scoped: ✅ (audit.repository.ts:161 read_audit_chain_rls_exempt vs getDb list)
- migration 0014 journaled + additive: ✅ (journal 0013→0017; .down + snapshot present)

**Recommendation to head-verifier (V-3):** APPROVE the wave. All 5 findings are spec-gaps (spec-under-specification), none are spec-drift and none block. Carry GAP-1..5 into next-wave P-2 as pre-authored ACs (esp. GAP-2 write-path default before any H3 multi-firm work, and GAP-4 populated-DB migration proof as a standing AC for audit-table migrations).
