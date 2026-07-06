# V-1 — Karen (wave-17, M8 pilot-partner data-isolation)

**Reviewer:** Karen · **Stage:** V-1 (deployed-state source-claim verification, NOT diff — that was B-6)
**Deployed target:** `591b3f8bb5877db0357b629f3e88c53bb2a36843` · main @ 591b3f8 · local HEAD == 591b3f8 (verified `git rev-parse HEAD`)
**Prod api:** https://dealflow-api-production-66d4.up.railway.app · **web:** https://dealflow-web-production-a4f7.up.railway.app
**Method:** live prod probes + code grep AT the deployed SHA (working tree == 591b3f8) + queryable CI. Antipattern catalog applied: claimed-but-fake, vacuous-green, deferred-undocumented.

## VERDICT: **APPROVE** — 7/7 load-bearing claims CONFIRMED, 0 REJECT, 0 contradictions.

---

## Findings (each: claim → evidence)

### F1 — CRUX: app runs as non-superuser (dealflow_app) in prod — **CONFIRMED**
- **Claim (C-2:16-18, P-4 F1):** a healthy `/health` @591b3f8 proves the runtime is non-superuser, because the `[RLS-GUARD]` is fail-closed (throws on superuser/BYPASSRLS → boot fails).
- **Live evidence:** `GET /health` → HTTP 200 `{"status":"ok","db":"ok","version":"591b3f8bb5877db0357b629f3e88c53bb2a36843"}`. Version == deployed SHA.
- **Fail-closed proof (grep, deployed tree):**
  - `apps/api/src/db/index.ts:51-75` — `assertNonSuperuserConnection()` queries `current_setting('is_superuser')` + `rolbypassrls`; `throw new Error('[RLS-GUARD] …')` on `is_superuser==='on'` (line 63-64), on `has_bypassrls` (line 71-72), AND on indeterminate role (line 59-60). No swallow, no default-allow.
  - `apps/api/src/main.ts:11` imports the guard; `main.ts:31-33` calls `await assertNonSuperuserConnection()` inside `bootstrap()` gated on `NODE_ENV !== 'test'` (prod is `production`, so it FIRES).
  - `apps/api/src/main.ts:115-117` — `bootstrap().catch((err) => { … process.exit(1); })`. A guard throw → unhandled in bootstrap → `.catch` → `process.exit(1)` → no server → no 200. **Fail-closed chain intact.**
- **Independent DB confirmation (C-2:18):** `dealflow_app` is_superuser=off, bypassrls=false; no-GUC reads return 0 rows (deny-by-default working, not error).
- **Truth:** a 200 `/health` at 591b3f8 is a *positive proof* the runtime is dealflow_app. CONFIRMED.

### F2 — File/function existence @591b3f8 — **CONFIRMED (all present)**
- `apps/api/src/db/workspace.interceptor.ts` — EXISTS. `set_config` not param-SET confirmed: line 126 `client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', …])`; header (line 5) documents the B-6 swap from parameterized SET → `set_config()`; RESET-in-finally at line 88-92 (`RESET app.workspace_id`, surgical not DISCARD ALL). Matches P-4 F1 request-scoped-dedicated-connection design.
- `apps/api/src/db/workspace-context.ts` — EXISTS. `AsyncLocalStorage` (line 26/38 `workspaceAls`), `getDb` (line 41) resolves ALS handle at call-time. Matches claim (ALS getDb).
- **Migrations (note: located at `apps/api/src/db/migrations/`, NOT `apps/api/drizzle/` — path in the verify prompt was approximate; all files present):**
  - `0014_workspace_isolation.sql` — EXISTS. FORCE ROW LEVEL SECURITY on 28 tenant tables (lines 273-345, incl `users`, `audit_log_entries`, `mandates`, `pipeline`); `resolve_user_workspace` + `read_audit_chain_rls_exempt` SECURITY DEFINER fns (header steps 7-8, line 20-23). Matches claim.
  - `0015_invite_rls_bootstrap.sql` — EXISTS (resolve_invite). `0016_dealflow_app_role.sql` — EXISTS; line 50-52 `CREATE ROLE dealflow_app NOSUPERUSER NOBYPASSRLS`. `0017_rls_policy_empty_string_fix.sql` — EXISTS; line 21-23 `NULLIF(current_setting('app.workspace_id', true), '')::uuid` fail-closed.
  - `apps/api/src/modules/auth/guards/roles.guard.ts` — EXISTS. RLS-exempt role resolution confirmed: line 45/127 `resolveRoleRlsExempt` (→ SECURITY DEFINER `resolve_user_workspace` via `pool.query`), documented as the B-6 rework3 P0 fix for the guard-runs-before-interceptor / GUC-not-yet-set window (line 42-46, 117-123). (Note: exact symbol is `resolveRoleRlsExempt`, not `resolveRoleRlsExempt` under a different name — the prompt's `resolveRoleRlsExempt` matches.)

### F3 — Migrations journaled + applied to 0017 — **CONFIRMED**
- **Journal (`meta/_journal.json`, deployed tree):** idx 14=0014_workspace_isolation (when 1783987200000), 15=0015_invite_rls_bootstrap, 16=0016_dealflow_app_role, 17=0017_rls_policy_empty_string_fix. All when-ordered and strictly > idx 13 (0013, when 1783900800000). No gaps.
- **Prod applied (C-2:32-39):** owner-migrate via temporary Railway proxy (since deleted), journal advanced 0013→0017 (18 rows). Post-migration owner assertions: 27 tables carry workspace_id, FORCE RLS on 27+audit tables, 3 SECURITY DEFINER fns present, 328 audit rows backfilled null_ws=0. CONFIRMED (C-block deployed-state artifact).

### F4 — Deploy serves 591b3f8, no stale Ghost-Green — **CONFIRMED**
- `/health` version field == `591b3f8bb5877db0357b629f3e88c53bb2a36843` (live, this session). C-2:49 notes GIT_SHA was bumped so /health reports the deployed hash; pre-deploy it was d72d7cb7. Per-service Railway `meta.commitHash==591b3f8` (C-2:87-88). No stale build.

### F5 — RBAC live (not 403-for-all) — **CONFIRMED**
- **Route registered + guarded:** `GET /compliance/audit-log/verify` live probe UNAUTHED → HTTP 401 `{"message":"Unauthorized","statusCode":401}`. 401 (not 404, not 403) proves the route IS registered and behind SessionGuard — an unregistered route would 404; a 403-for-all bug would deny even correct roles.
- **Code (deployed tree):** `apps/api/src/modules/compliance/audit-log.controller.ts:51` `@Controller('compliance')`, line 55 `@Get('audit-log/verify')`, line 57 `@Roles(...AUDIT_LOG_VERIFY_ROLES)` resolving to `['compliance','admin']` (line 41); a present-but-empty `@Roles()` is guarded against (fail-loud at boot, line 44-47).
- **Not-403-for-all fix:** roles.guard.ts resolves role via RLS-EXEMPT `resolveRoleRlsExempt` (F2) — this is precisely the fix that stops the guard (running before the GUC is set) from resolving 0 roles under FORCE RLS and 403-ing every authed user. C-2:62 confirms authed compliance role got 200 on verify (positive control), unauth=401 (negative). CONFIRMED.

### F6 — Audit chain intact after workspace_id backfill — **CONFIRMED**
- **Live probe of `/compliance/audit-log/verify` is 401 unauthed** (correct — route is auth-gated; I cannot mint a prod session token in this read-only V-1). Relying on the C-block deployed-state artifact for the authed result: C-2:63 `{"ok":true,"entriesChecked":328}` via `read_audit_chain_rls_exempt` under dealflow_app; C-2:39 owner-side verifyChain ok:true, 328 rows, 0 chain breaks after backfill.
- **Code corroboration:** workspace_id is HMAC-excluded by design (P-3:5,13 — not in HashableEntryFields), so a raw-column backfill cannot alter `entry_hash`; the global integrity walk runs RLS-exempt via `read_audit_chain_rls_exempt` (present in 0014, F2). CI further proves per-row hash-exclusion (AMP-4, run 28824525244). CONFIRMED — the 328-row prod chain survived. *Caveat: the {ok:true} value itself is C-block-attested, not re-probed here, because the endpoint requires auth; the code + CI + owner-side verifyChain triangulate it.*

### F7 — CI isolation ran AS dealflow_app (non-vacuous) — **CONFIRMED**
- **CI queryable @ exact SHA:** `gh run view 28824525244` → `{"conclusion":"success","event":"push","headSha":"591b3f8…","workflowName":"CI"}`. Green on the exact deployed SHA (not extrapolated).
- **Non-vacuous proof (test source, deployed tree):**
  - `apps/api/test/workspace-isolation.e2e-spec.ts:150` — the `withWorkspace` helper opens a dedicated client and issues `SET ROLE dealflow_app` (NOSUPERUSER NOBYPASSRLS) BEFORE `SET app.workspace_id`, so FORCE RLS genuinely applies. The isolation assertions run INSIDE this helper: ISO-1 cross-tenant read `expect(rows).toHaveLength(0)` (line 352) under WS_B role; ISO-2 positive control `expect(rows.length).toBeGreaterThan(0)` (line 367) under WS_A — both via `withWorkspace` (SET ROLE). ISO-4 GUC-leak: SET ROLE + no GUC → `toHaveLength(0)` (line 399-410). ISO-5 WORM: `expect(errCode).toBe('P0001')` (line 505).
  - `apps/api/test/invite-signup-rls.e2e-spec.ts:116,339,493` — `SET ROLE dealflow_app` on the dedicated client; INV-5 fault-killer direct SELECT no-GUC → 0 rows (line 488-504) under dealflow_app.
  - Header comments (workspace-isolation:37-40, invite-signup:97-104) explicitly state a superuser session would make the cross-tenant assertions vacuously true; SET ROLE is what makes them real. **NOT vacuous.** CONFIRMED.

---

## Antipattern sweep
- **claimed-but-fake:** none. Every claimed file/function/migration/route exists at 591b3f8 and is grep-confirmed.
- **vacuous-green:** F7 explicitly killed — isolation assertions execute under `SET ROLE dealflow_app`, with positive controls (ISO-2 >0) proving the query isn't trivially empty; CI green on exact SHA.
- **deferred-undocumented:** none found. The one deploy failure (api #1 preDeploy PATH bug) is documented, root-caused to a C-block config error, fixed + redeployed (C-2:50-51) — not glossed.

## Notes / minor (non-blocking, do NOT fix — Iron Law)
- Migration path in the verify prompt (`apps/api/drizzle/`) is approximate; actual path is `apps/api/src/db/migrations/`. All four migrations + journal + snapshot present there. No defect — informational.
- F6 `{ok:true,entriesChecked:328}` is C-block/CI-attested rather than re-probed live (the verify endpoint is auth-gated; V-1 is read-only and cannot mint a prod session). Code (HMAC-exclusion + RLS-exempt walk), CI AMP-4, and owner-side post-backfill verifyChain triangulate it. Called out for transparency; not a REJECT — the chain-intact claim is well-supported.

---

```yaml
karen_verdict: APPROVE
findings_total: 7
findings_confirmed: 7
findings_rejected: 0
deployed_sha: 591b3f8bb5877db0357b629f3e88c53bb2a36843
health_probe: "200 {status:ok,db:ok,version:591b3f8} — [RLS-GUARD] fail-closed proves non-superuser runtime"
ci_run: "28824525244 conclusion=success headSha=591b3f8 (queryable)"
non_vacuous: true   # e2e SET ROLE dealflow_app; ISO-1 read=0 + ISO-2 positive>0 under FORCE RLS
crux_confirmed: true  # app runs as dealflow_app in prod (fail-closed guard + healthy /health)
antipatterns_found: []
```
