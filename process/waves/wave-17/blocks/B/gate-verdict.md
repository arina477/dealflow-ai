# Wave 17 — B-6 Review — head-builder gate verdict (Phase 1, Attempt 1)

**Block:** B (Build) | **Wave:** 17 — M8 pilot-partner data-isolation (workspaces + FORCE-RLS + request-scoped GUC propagation)
**Branch:** wave-17-workspace-isolation | **HEAD:** b58a630
**Gate:** B-6 | **Reviewer:** head-builder (fresh spawn) | **Delegated:** postgres-pro (SET-bind-param runtime behavior)

---

## VERDICT: REWORK

A load-bearing runtime defect in BOTH production GUC-set paths bricks the entire isolation feature for real traffic. The RLS foundation (migration 0014/0015) is correct and the negative-read tests are genuinely fault-killing for the *policy* — but they exercise a parallel test-only reimplementation of the connection setup, never the shipped interceptor/repository code, so every green signal collected so far is blind to the defect. A data-isolation feature that returns zero rows to every authenticated user (and throws on every invite signup) is worse than none.

---

## CRITICAL DEFECT (REWORK trigger)

### D1 — `SET app.workspace_id = $1` (parameterized utility statement) fails at runtime → GUC never set on live requests

**Stage:** B-2 Backend (task 96026365 interceptor + DEV-1 fix)
**Files/lines:**
- `apps/api/src/db/workspace.interceptor.ts:101` — `await client.query('SET app.workspace_id = $1', [workspaceId]);`
- `apps/api/src/modules/auth/auth.repository.ts:314` — same idiom inside `runInTransactionWithWorkspace`.

**Root cause (confirmed by postgres-pro):** `SET` is a PostgreSQL *utility statement*, not a planned statement. node-postgres uses the extended query protocol whenever a values array is passed, so `SET app.workspace_id = $1` sends Parse+Bind; the bind phase never resolves `$1` for a utility statement → runtime error **SQLSTATE 42P02** ("there is no parameter $1") on EVERY invocation. This is categorical, not intermittent.

**Impact — this is the whole wave:**
1. **Interceptor (interceptor.ts:91-107):** the failing `SET` is inside a `try { … } catch { /* proceed without GUC — RLS denies */ }`. The catch swallows the 42P02, so `workspaceId` is resolved but the GUC is NEVER SET. Because RLS is (correctly) fail-closed, **every authenticated tenant read returns 0 rows.** The pilot partner logs in and sees an empty application. All ~41 tenant read sites are affected. Silent — no error surfaces to the client.
2. **Invite signup (auth.repository.ts:314):** here the failing `SET` is NOT swallowed → it throws out of `runInTransactionWithWorkspace` → **every invite-based signup fails.** (This is the exact DEV-1 path the B-2 fix-forward claimed to close.)

**Why every green signal missed it:**
- The e2e `withWorkspace()` helper (workspace-isolation.e2e-spec.ts:101, invite-signup-rls.e2e-spec.ts:101) uses **literal interpolation** `SET app.workspace_id = '${workspaceId}'` (simple-query protocol) — which WORKS. So ISO-1..5 + INV-1/3/4/5 validate the RLS *policy* correctly but through a reimplementation of connection setup, never touching the shipped interceptor/repository code.
- INV-2 (line 309) DOES use the bind form `SET app.workspace_id = $1` — so INV-2 would FAIL in the C-1 real-DB run. It has not run yet at B-6 (local skips: no local PG). The B-5 unit run (769 api) mocks the DB and never exercises this line. Result: the single most load-bearing statement in the wave has **zero passing test coverage** and one test (INV-2) that will fail the moment CI touches a real DB.

**Fix (postgres-pro canonical idiom):** replace both production occurrences with the planned-statement form, which supports bind params and is injection-safe:
```js
await client.query("SELECT set_config('app.workspace_id', $1, false)", [workspaceId]);
```
Also migrate INV-2 (test line 309) to the same form; the literal-interpolation test helpers work but should adopt `set_config` for defense-in-depth. After the fix, add coverage that exercises the ACTUAL interceptor/`runInTransactionWithWorkspace` GUC-set path (not the helper) so a regression here fails a test.

**Route to:** `backend-developer` (2-line production fix in interceptor.ts + auth.repository.ts + INV-2) → re-verify B-5 with the C-1 real-DB e2e actually exercising the shipped path.

---

## Checks that genuinely PASS (verified against shipped code, not prose)

| # | Check | Result | Evidence |
|---|---|---|---|
| F1a | FORCE RLS on every tenant table (not just ENABLE) | PASS | 0014 emits ENABLE+FORCE on all 28 tables (lines 257-336) |
| F1b | Dedicated PoolClient per request + surgical RESET in finally | PASS (structure) | interceptor.ts:86 checkout, :71 `RESET app.workspace_id` in `finalize`, :73 release; NOT DISCARD ALL. **Structure correct; the GUC value never lands due to D1.** |
| F1c | getDb() returns ALS handle in-request, singleton for bootstrap | PASS | workspace-context.ts:55-57 |
| F1d | No-GUC-leak asserted in e2e | PASS | ISO-4 (line 316) RESET→0 rows fail-closed |
| — | Fail-closed policy shape, NO COALESCE / no `=''` | PASS | 0014:357-463 `workspace_id = current_setting('app.workspace_id', true)::uuid` |
| F2 | resolve_user_workspace SECURITY DEFINER, RLS-exempt, pre-GUC, minimal surface | PASS | 0014:486-497; `search_path=''`; returns own workspace_id+role only, LIMIT 1 |
| F2b | server-verified stUserId (never client-supplied) | PASS | interceptor.ts:49 `req.session?.getUserId()` from SessionGuard |
| DEV-1 | resolve_invite SECURITY DEFINER, minimal surface, token-hash-keyed, unconsumed+unexpired only | PASS | 0015:54-69; returns email/workspace_id/role_id only |
| DEV-1b | invite still FORCE-RLS for authed path; only pre-auth bootstrap exempt | PASS | invites in 0014 FORCE list; INV-5 proves direct SELECT no-GUC → 0 rows |
| DEV-1c | new user lands in INVITE's workspace, server-derived | PASS (design) | auth.repository.ts:267 `workspaceId: invite.workspaceId`; INV-2/INV-3 assert (blocked by D1 at runtime) |
| F3 | verifyChain walk via read_audit_chain_rls_exempt; global chain ok:true | PASS | audit.verifier.ts:50 → readChainAscending (B-2: SECURITY DEFINER fn); 0014:526-568 |
| F3b | LIST/EXPORT projection RLS-scoped; verify returns boolean only, no cross-ws content | PASS | verifier returns {ok, entriesChecked, firstBreakAt, reason} — no row content |
| F3c | No vacuous {ok:true, entriesChecked:0} | PASS | verifier.ts:61 only for genuinely empty log |
| F4a | workspace_id excluded from HashableEntryFields | PASS | verifier.ts:100-111 — no workspaceId; audit.ts input schema omits it (B-1) |
| F4b | WORM trigger REJECTS UPDATE audit_log_entries | PASS | ISO-5 asserts SQLSTATE P0001 on UPDATE |
| 6 | Negative-read fault-killing: cross=0 + same-tenant non-zero positive control | PASS (for policy) | ISO-1/3 cross=0, ISO-2 positive control >0; kill FORCE/policy → cross-read → FAIL. **Note: covers policy, NOT the shipped GUC-set path (see D1).** |
| 7a | Backfill before NOT NULL, 0 orphans | PASS | 0014 step 3 (185-211) before step 4 (218-244) |
| 7b | Migrations 0014+0015 journaled, when-ordered | PASS | _journal.json idx14 (1783987200000) + idx15 (1784073600000), monotonic |
| 7c | workspaceId on all tenant INSERTs, server-derived | PASS | B-2 wiring; `getWorkspaceId() ?? DEFAULT_WORKSPACE_ID` / invite.workspaceId |
| 7d | Commit-per-spec discipline | PASS | 1a7cece B-0 / 1982aad B-1 / 5f16059+f47e248+93116bc B-2 / 8b331dc DEV-1 / b58a630 lint |
| 7e | typecheck + unit green | PASS (but see D1) | B-5: api 769 pass, shared 489 pass, 3/3 build. RLS e2e skipped local. |

---

## Note on the C-1 authoritative run

The prompt correctly flags that ISO/INV e2e run in CI real-DB (C-1), local skips. That is NOT itself a REWORK trigger and the suites are real + self-migrating (`ensureMigrated`) + fault-killing for the policy. HOWEVER: because INV-2 uses the broken `SET app.workspace_id = $1` bind form (line 309), the C-1 real-DB run will FAIL on INV-2 today — and even if it were removed, the ISO/INV suites would still pass (via the working helper) while production stays broken. The gate does not wait for C-1 to catch this; the defect is provable now from the shipped code + PostgreSQL protocol semantics.

---

```yaml
head_signoff:
  verdict: REWORK
  stage: B-6
  attempt: 1
  reviewers:
    postgres-pro: "SET <guc> = $1 with values array fails SQLSTATE 42P02 (utility statement, bind never resolves); correct idiom SELECT set_config('app.workspace_id',$1,false)"
  failed_checks:
    - "F1b-runtime: production GUC-set (interceptor.ts:101, auth.repository.ts:314) uses parameterized SET on a utility statement → 42P02 at runtime → GUC never set on authenticated requests (swallowed → all tenant reads 0 rows) + every invite signup throws"
    - "B-5 coverage: shipped interceptor/runInTransactionWithWorkspace GUC-set path has zero passing test coverage; e2e helpers reimplement it with literal interpolation, hiding the defect; INV-2 (bind form) will fail C-1 real-DB"
  passing_checks_load_bearing:
    - FORCE-RLS on all 28 tables
    - fail-closed policy (no COALESCE)
    - resolve_user_workspace + resolve_invite SECURITY DEFINER search_path='' minimal-surface, server-derived subject
    - integrity-walk RLS-exempt vs projection RLS-scoped, boolean-only result
    - workspace_id hash-excluded + WORM blocks UPDATE (ISO-5)
    - backfill-before-NOT-NULL, migrations 0014+0015 journaled in order
  rationale: >
    The RLS foundation is correctly built — FORCE RLS everywhere, fail-closed policy shape,
    both SECURITY-DEFINER bootstrap resolvers with minimal surface and server-derived subjects,
    integrity-vs-visibility separation, WORM reattribution test, clean backfill and journaling.
    But both production paths that set the request GUC use `SET app.workspace_id = $1` with a
    parameter array, which PostgreSQL rejects at runtime (SQLSTATE 42P02) because SET is a
    utility statement whose bind phase never resolves placeholders. In the interceptor the error
    is swallowed, so the GUC is never set and every authenticated tenant read returns 0 rows
    (fail-closed → the pilot sees an empty app); in runInTransactionWithWorkspace it throws and
    breaks every invite signup. The e2e suites pass only because their withWorkspace() helper
    reimplements connection setup with working literal interpolation and never touches the shipped
    code — a test/production divergence that blinds every green signal. The one test that does use
    the production idiom (INV-2) will fail the C-1 real-DB run. This is the load-bearing isolation
    mechanism; the fix is a two-line swap to SELECT set_config(...,$1,false) plus coverage that
    exercises the actual shipped GUC-set path. Cannot APPROVE — a data-isolation feature that
    bricks all reads is worse than none.
  next_action: REWORK_B-2
  route_to: backend-developer
```

---
---

# Wave 17 — B-6 Review — head-builder gate verdict (Phase 1, ATTEMPT 2 — post-rework)

**Block:** B (Build) | **Wave:** 17 — M8 pilot-partner data-isolation (workspaces + FORCE-RLS + request-scoped GUC propagation)
**Branch:** wave-17-workspace-isolation | **HEAD:** 023ace7 (`fix(db): B-6 rework parameterized-SET GUC → set_config`)
**Gate:** B-6 | **Reviewer:** head-builder (fresh spawn) | **Scope:** verify Attempt-1 REWORK finding is closed; re-confirm all prior PASSes hold

---

## VERDICT: APPROVED

The single Attempt-1 REWORK trigger (D1 — parameterized `SET app.workspace_id = $1`, illegal utility-statement bind → SQLSTATE 42P02 at runtime, silently swallowed, bricking every authenticated read + invite signup) is **CLOSED on every axis**. Both production GUC-set paths now use the parameterized-safe `SELECT set_config(...)` form, the swallow-on-failure hole is sealed (fail-closed loudly), the tests now bind to the *shipped* mechanism and are provably fault-killing, and every Attempt-1 PASS still holds. Proceed to Phase 2 `/review`.

---

## D1 CLOSURE — verified against shipped code at HEAD 023ace7

**Path 1 — `apps/api/src/db/workspace.interceptor.ts:108-111` (per-request, session-scoped):**
```
await client.query('SELECT set_config($1, $2, false)', ['app.workspace_id', workspaceId]);
```
- Parameterized-safe: `set_config()` is a function call — `$1/$2` are real bind params (unlike the utility `SET`, which cannot bind). No 42P02.
- `is_local=false` → session-scoped on the dedicated PoolClient, correct for the request-lifetime propagation model.
- **Swallow hole sealed:** the `catch` at :113-120 now `client.release()` + `throw err` — resolver OR set_config failure fails-closed loudly (no more silent unset-GUC → 0-rows). RESET-in-finalize (:74) preserved; surgical RESET (not DISCARD ALL) intact.

**Path 2 — `apps/api/src/modules/auth/auth.repository.ts:322` (invite-signup, pre-ALS, tx-scoped):**
```
await client.query('SELECT set_config($1, $2, true)', ['app.workspace_id', workspaceId]);
```
- `is_local=true` → SET LOCAL (tx-scoped), auto-resets at tx end; explicit RESET+release in `finally` (:329-332) as defence-in-depth. Workspace sourced from `resolve_invite()` (server-derived, never client-supplied) — cross-workspace placement structurally impossible.

**Repo-wide grep (`SET app.workspace_id = $`):** zero LIVE occurrences. All remaining hits are (a) explanatory comments/docstrings, (b) unparameterized `RESET app.workspace_id` (legal — RESET takes no value), or (c) the fault-killing test assertions that *reject* the illegal form. No regression surface remains.

---

## FAULT-KILLING CONFIRMATION — the tests now bind to the REAL mechanism (VERIFY rule 3)

`apps/api/src/db/workspace-guc.spec.ts` (GUC-1/2/3) drives the **actual** `WorkspaceInterceptor` and `AuthRepository.runInTransactionWithWorkspace` (pg pool mocked at the module boundary — NOT a test-local reimplementation of connection setup, which was the Attempt-1 blind spot). It asserts the EXACT SQL string issued to the client: `SELECT set_config` present, `^SET\s+app\.workspace_id` absent, correct `is_local` literal, `['app.workspace_id', workspaceId]` binds, RESET fired, client released.

- **Green run:** 3/3 pass (`workspace-guc.spec.ts`).
- **Regression proof (I injected it):** reverting the interceptor's production line back to `SET app.workspace_id = $1` → GUC-1 FAILS (no set_config call) and GUC-2 FAILS (error no longer propagates — fail-closed assertion breaks). 2 failed | 1 passed. Source restored. This is a genuine mechanism-level guard: a future regression to the illegal form cannot land green.
- **E2E helpers now touch the shipped form:** `workspace-isolation.e2e-spec.ts:107` and `invite-signup-rls.e2e-spec.ts:106,320` both issue `SELECT set_config(...)`; invite-signup carries an inline comment that a regression to the SET form would throw 42P02 *here*.

---

## EVERYTHING-ELSE — Attempt-1 PASSes re-confirmed to still hold

- **Typecheck:** 4/4 clean (`@dealflow/shared|api|web` + shared build) — FULL TURBO.
- **Unit suites:** 772 passed | 52 skipped (API), 38 test files. Skips = the real-DB e2e (workspace-isolation ISO/INV, pipeline-gate, recordkeeping-gate) — local-skip on unset `TEST_DATABASE_URL`, **authoritative at C-1 CI real-DB, NOT a REWORK trigger** (per gate scope). Shared + web suites green.
- **RLS e2e is real + self-migrating:** ISO-1 (cross-tenant negative read = 0), ISO-2 (positive control), ISO-3 (bidirectional), ISO-4 (GUC-leak fail-closed on RESET), ISO-5 (WORM UPDATE rejection) present; `ensureMigrated()` under a pg advisory lock (race-safe for parallel CI workers). C-1 will exercise the live GUC path.
- **Isolation invariants from Attempt-1 unchanged in code:** FORCE RLS ×28 tenant tables, both SECURITY DEFINER resolvers (`resolve_user_workspace`, `resolve_invite`), integrity-vs-visibility separation, WORM-reattribution (ISO-5), backfill, journaled migrations 0014+0015, commit-per-spec.

---

## Stage-exit checklist (B-6 Review) — Attempt 2

- [x] No speculative generality / unnecessary abstraction — set_config swap is minimal, targeted, no new indirection.
- [x] All features map to frozen spec (M8 data-isolation) — no scope creep in the rework diff.
- [x] Architectural conventions documented — interceptor + repo docstrings updated to explain set_config-vs-SET + fail-closed semantics.
- [x] Author-not-sole-reviewer + cross-boundary specialist sign-off — head-builder gate (fresh) + Attempt-1 postgres-pro on SET-bind runtime behavior.
- [x] Frontend adheres to DAL — GUC propagation is the DAL boundary; request-scoped client + RESET-on-release intact.
- [x] Error handling structured, no swallow — the swallow hole that hid D1 is now the sealed fail-closed path (catch re-throws).
- [x] **Load-bearing compliance invariant** — WORM audit-log immutability (ISO-5) + FORCE-RLS tenant isolation intact; no mutation path bypasses the audit trail.

```yaml
head_signoff:
  verdict: APPROVED
  stage: B-6
  attempt: 2
  reviewers:
    head-builder: APPROVED
    postgres-pro: (Attempt-1) confirmed SET-bind 42P02 runtime behavior
  failed_checks: []
  d1_closure:
    interceptor_path: "set_config($1,$2,false) @ workspace.interceptor.ts:108 — session-scoped, fail-closed catch"
    repo_path: "set_config($1,$2,true) @ auth.repository.ts:322 — tx-scoped, RESET+release in finally"
    live_parameterized_SET_remaining: 0
    fault_killing_guc_tests: "GUC-1/2/3 pass green; regression to SET form proven to fail GUC-1 + GUC-2"
    e2e_helpers_use_set_config: true
  everything_else:
    typecheck: "4/4 clean"
    unit: "772 passed / 52 skipped (real-DB e2e — C-1 authoritative)"
    rls_e2e: "real + self-migrating (ensureMigrated + advisory lock); ISO-1..5 present; now touch shipped set_config path"
    attempt1_invariants: "FORCE-RLS x28, both SECURITY DEFINER resolvers, WORM-reattribution, backfill, 0014+0015 journaled — unchanged"
  rationale: >
    The lone Attempt-1 REWORK trigger (parameterized SET → 42P02 → silent-swallow → bricked
    isolation) is closed in both production paths via set_config(), the swallow hole is sealed
    to fail-closed, and the GUC-1/2/3 tests now bind to the shipped interceptor/repository code
    and are provably fault-killing (a regression to the SET form fails them — I verified by
    injecting the regression). Typecheck 4/4, 772 unit green, RLS e2e real + self-migrating and
    now exercising the shipped set_config path (C-1 real-DB authoritative). All Attempt-1
    invariants hold. No load-bearing compliance or audit-trail defect. APPROVED.
  next_action: PROCEED_TO_PHASE_2_REVIEW
```
