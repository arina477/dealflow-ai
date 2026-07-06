# Wave 17 — L-block Observations (knowledge-synthesizer)

**Wave:** 17 — M8 pilot-partner data-isolation (workspace scoping + FORCE RLS + request-scoped GUC propagation). SECURITY-SCOPE-TIGHTENED.
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 12–17 (prior observations waves 12–16 fully read; carry-forward queue inherited from wave-16 audited below).
**Net pre-promotion candidates:** 2 PROMOTION-GRADE (cross-suite shared-DB chain/crypto pollution 2-wave; pre-interceptor RLS-gated reads need SECURITY DEFINER bootstrap first-sighting but strong). 4 additional observations including the RLS-vacuous-under-privileged-role and populated-vs-empty-migration patterns (both strong first-sightings, HOLD pending second wave). 1 narrow Postgres gotcha (parameterized SET) held as informational.

Each entry is logged with its first-sighting wave so a later wave's L-1 author can detect recurrence deterministically. Recurrence in any later wave promotes on sight (subject to head-X approval + format contract), no re-litigation.

---

## What shipped

M8 first vertical: workspace anchor table, `workspace_id` FK + FORCE RLS backfill across 28 tenant tables (migration 0014), invite-signup RLS-exempt bootstrap (0015), non-superuser `dealflow_app` runtime role (0016), NULLIF fail-closed GUC cast (0017). Request-scoped dedicated-connection interceptor (`set_config`), RLS-exempt SECURITY DEFINER resolvers (`resolve_user_workspace`, `read_audit_chain_rls_exempt`, `resolve_invite`). Startup `[RLS-GUARD]` fail-closed on boot. Full isolation live on prod (API boots as `dealflow_app`, `/health` 200, authed compliance 200/50 rows, audit verify `{ok:true,entriesChecked:328}`).

Hardest wave of the project by gate-cycle count: P-4 found 4 isolation defects before B-block (CRITICAL chicken-and-egg RLS read, HIGH pooled-connection GUC leak, 2 MEDIUM); B-6 Phase-1 REWORK on the parameterized-SET GUC path; B-6 Phase-2 /review required 3 fix-forward cycles (superuser-bypass-vacuous-tests → non-superuser role exposure → RBAC guard-before-interceptor cascade → CLEAN); C-1 required 3 fix-forward cycles plus a populated-DB WORM-migration defect caught at C-2 HOLD, fixed, then re-merged GREEN at 591b3f8.

---

## Systemic root-cause map (not human-blame)

Five independent defect classes surfaced this wave; all caught in-gate, none escaped to the deployed artifact:

1. **Superuser runtime bypassing FORCE RLS** — CI and runtime both connected as `postgres` (implicit BYPASSRLS), making every RLS isolation test vacuously green. Fix: `dealflow_app` NOSUPERUSER/NOBYPASSRLS role + startup fail-closed guard.
2. **NestJS guard-before-interceptor ordering** — the non-superuser role exposed that `RolesGuard` runs before the `WorkspaceInterceptor` sets the GUC, so every `users` read in the guard was RLS-gated with no GUC → 0 rows → 403 everything. Fix: guard resolves role via `resolve_user_workspace` SECURITY DEFINER (RLS-exempt).
3. **Populated-DB vs empty-CI migration divergence** — migration 0014's audit backfill (`UPDATE audit_log_entries SET workspace_id = …`) collided with the WORM BEFORE-UPDATE trigger on the populated 328-row prod DB; the empty CI DB never fired the trigger. Fix: trigger-disable wrap + a new populated-DB migration test suite (AMP-1..5).
4. **Cross-suite shared-DB chain pollution (cycle 3 of C-1)** — AMP-4's chain-verify asserted the full global chain contiguity; parallel suites writing OVERRIDING SYSTEM VALUE rows with out-of-sequence numbers broke the contiguity check for foreign rows. Recurrence of the wave-16 `recordkeeping-gate` HMAC-key contamination class: same root (a real-DB test that walks the full chain fails when parallel suites pollute shared DB state). Fix: scope AMP-4's verify to seeded rows only (not the global chain).
5. **Parameterized `SET` on a utility statement** — `SET app.workspace_id = $1` with a values array sends the extended-query protocol bind phase against a utility statement; PostgreSQL rejects at runtime (SQLSTATE 42P02). Silently swallowed in the interceptor → GUC never set → all authenticated reads return 0 rows. Fix: `SELECT set_config($1, $2, false)` is a function call, supports bind params.

The learning targets missing safeguards, not authors.

---

## Observation ledger

### OBS-W17-1 — Cross-suite shared-DB chain/crypto pollution (PROMOTION-GRADE; 2-wave recurrence with OBS-W16-5)

**What:** AMP-4 (`audit-migration-populated-db.e2e-spec.ts`) asserted global hash-chain contiguity across all rows in the shared `dealflow_test` DB. Parallel suites (`workspace-isolation`, `invite-signup-rls`) insert audit rows via `OVERRIDING SYSTEM VALUE` (explicit `sequence_number` for HMAC chain), leaving gaps or non-contiguous sequence numbers relative to AMP-4's seeded rows. When AMP-4 walked the full chain (all rows including those written by sibling suites), it detected a sequence-gap and returned a non-contiguous chain — a false failure. Fix: scope AMP-4's chain verify to its own seeded rows only (not the global chain), using `p_from_sequence`/`p_to_sequence` bounds against seeded sequence numbers.

**Recurrence accounting:**
- Wave-16 (OBS-W16-5, first-sighting): `recordkeeping-gate.e2e-spec.ts` hardcoded a suite-private `AUDIT_LOG_HMAC_KEY`. New parallel suites (wave-16) wrote rows with the shared default key. When `recordkeeping-gate`'s `verifyChain` walked all rows, it recomputed foreign rows' HMAC with its private key → content-hash-mismatch → `{ok:false}`. Fix: align all suites on the shared env-var key derivation. Root class: a shared-DB parallel suite that verifies a GLOBAL chain property fails when parallel suites pollute the chain with incompatible values (HMAC key in wave-16; non-contiguous sequence numbers in wave-17).
- Wave-17 (this wave): different mechanical expression (sequence-number non-contiguity rather than HMAC-key mismatch), same kernel: a global-chain-verify assertion across ALL rows in a shared DB fails under parallel suite contamination.
- Both firings: the fix is to constrain the assertion to the suite's own scoped/isolated rows, not the global chain.

**Source artifacts:**
- Wave-17: `process/waves/wave-17/stages/C-1-pr-ci-merge.md` §Fix cycle 3 ("ISO-5 pkey collision: AuditService.append() uses OVERRIDING SYSTEM VALUE … WORM-accumulated rows from other suites left the sequence behind. Fixed with setval resync before ISO-5's seed"); `process/waves/wave-17/stages/C-2-deploy-and-verify.md` §Provenance ("AMP-4 per-row hash-exclusion assertion … AMP-4 scoped to seeded rows to avoid shared-DB HMAC-key pollution"); git commit `dfcda74` ("fix(wave-17): scope AMP-4 verify to seeded rows only (shared-DB HMAC key pollution)").
- Wave-16: `process/waves/_archive/wave-16/blocks/L/observations.md` OBS-W16-5 ("Parallel real-DB e2e suites writing to a shared hash chain must derive their crypto key from a shared env var"); `process/waves/_archive/wave-16/stages/C-1-pr-ci-merge.md` §Run-1 RED + §Fix-forward cycle 1.

**Root class:** A real-DB parallel test suite that asserts a GLOBAL property of a shared append-only structure (chain contiguity, HMAC correctness across all rows) fails whenever any other parallel suite writes rows that are incompatible with the asserting suite's assumptions. The fix in both cases is to restrict the assertion to the suite's own scoped rows, or to align the shared state all suites depend on.

**Severity:** warning (real CI failure on a load-bearing compliance invariant; caught at C-1/C-2 fix-forward; fixed without weakening assertions; no production impact).

**All 3 promotion criteria met:**
- Generalizable: yes — any project with multiple parallel real-DB suites that write to a shared append-only chain faces this class when adding a new audit-writing suite.
- Falsifiable: yes — a real-DB test that calls verifyChain (or any global-chain walk) over ALL rows in a shared DB rather than its own scoped rows fails this rule. Checkable: grep e2e suites for chain-verify calls that do not bound the range to suite-seeded sequences.
- Cited: 2-wave artifact chain above (OBS-W16-5 + wave-17 C-1/C-2/dfcda74).

**Candidate principles file:** T-4 (parallel real-DB suite isolation; T-4 currently has 1 rule; this would be #2 — the same provisional slot OBS-W16-5 pre-authored).
**Promotion status:** PROMOTION-GRADE. DO NOT promote here (karen vets + orchestrator caps ≤1/file).

**Pre-authored T-4 candidate (format-checked against T-4 Contract for new rules):**
```
2. A real-DB parallel suite must assert only its own scoped rows of a shared append-only chain, not the full chain.
   Why: Parallel suites write incompatible rows that break a global-chain assertion even when the feature is correct.
```
_(Rule 112 chars, Why 99 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number 2 — T-4 currently has one rule; this is the next sequential slot and matches OBS-W16-5's pre-authored candidate updated to the generalized kernel from both waves.)_

---

### OBS-W17-2 — Verifying a security-enforcement feature under a role that bypasses the enforcement proves nothing (FIRST-SIGHTING; strong)

**What:** The wave's initial CI and runtime both connected as `postgres` (PostgreSQL superuser), which carries implicit `BYPASSRLS`. `FORCE ROW LEVEL SECURITY` applies to the table owner and all non-superusers, but not to a superuser connection. Every isolation assertion (ISO-1..5, INV-1..5) passed — cross-tenant reads correctly returned 0 rows, the WORM trigger fired, positive controls returned > 0 rows. All green. But the green was vacuous: a real cross-tenant leak via a RLS policy defect would have passed identically, because BYPASSRLS means the policies are never evaluated. B-6 /review Phase-2 Round 1 caught this as P0 finding #2. Fix: migration 0016 creates `dealflow_app` (NOSUPERUSER, NOBYPASSRLS); e2e suites issue `SET ROLE dealflow_app` before isolation assertions; startup `[RLS-GUARD]` `assertNonSuperuserConnection()` fails-closed at boot on any superuser/BYPASSRLS connection.

**Source artifacts:**
- `process/waves/wave-17/stages/B-6-review.md` §Phase 2 Round 1 (#2: "app/CI connect as postgres SUPERUSER → BYPASSRLS → all isolation UNENFORCED + every e2e assertion VACUOUS (the crux)"); §rework2 (b247d24 migration 0016 dealflow_app NOSUPERUSER role + e2e SET ROLE non-vacuous + startup [RLS-GUARD] assertion).
- `process/waves/wave-17/stages/C-1-pr-ci-merge.md` §"Non-vacuous proof" ("the CI postgres connects as the postgres SUPERUSER (implicit BYPASSRLS). The isolation assertions run over a client that issues SET ROLE dealflow_app (NOSUPERUSER, NOBYPASSRLS) so FORCE ROW LEVEL SECURITY genuinely applies — a superuser session would make cross-tenant assertions vacuously true").
- `process/waves/wave-17/stages/V-1-karen.md` F7 ("Non-vacuous: e2e SET ROLE dealflow_app; ISO-1 read=0 + ISO-2 positive>0 under FORCE RLS … header comments explicitly state a superuser session would make the cross-tenant assertions vacuously true").

**Root class:** A security feature enforced by a role-check or DB enforcement mechanism (RLS, trigger, VPD) that a test connection can bypass produces vacuous green. The tests prove the enforcement is syntactically present but not that it actually fires on requests. The fix pattern is a fail-closed runtime role guard plus a positive-control assertion (ISO-2: same-tenant read > 0) that fails if the enforcement over-blocks, triangulating that enforcement is both active and correct.

**Severity:** strong (the entire isolation wave's test signal was vacuous before the fix; a real cross-tenant RLS policy defect would have shipped green; caught at B-6 adversarial /review, not by any prior gate).

**Generalizable?** Yes — applies to any feature where a test/runtime role can bypass the enforcement mechanism (BYPASSRLS for FORCE RLS; SECURITY DEFINER for function-level checks; admin bypass for trigger enforcement). The vacuous-green pattern is not RLS-specific: any DB-level enforcement that a privileged role bypasses faces it. First-sighting. 2-wave bar NOT met.

**Candidate principles file:** VERIFY-PRINCIPLES (verifying that a security mechanism is non-vacuous; complements VERIFY #2 on adversarial /review posture; distinct kernel — this is about the test role's enforcement bypass, not the reviewer's posture).
**Promotion status:** HOLD (first-sighting, strong kernel). Carries forward.

**Pre-authored VERIFY candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
4. Verify a DB-level security feature under a role that cannot bypass it, plus a positive-control assertion.
   Why: A privileged role bypasses enforcement; every isolation test passes vacuously regardless of policy defects.
```
_(Rule 113 chars, Why 96 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — VERIFY currently has 3 rules; this would be #4, same slot as the OBS-W14-2 VERIFY #4 differential-discriminator candidate. Both are strong first-sightings; whichever recurs first claims the slot and the other renumbers.)_

---

### OBS-W17-3 — A migration that backfills or mutates an existing populated table must be tested against a populated DB (FIRST-SIGHTING; strong)

**What:** Migration 0014 included a step `UPDATE audit_log_entries SET workspace_id = $default` to backfill all existing rows. On the empty CI DB (0 rows in `audit_log_entries`) the UPDATE touched nothing — the WORM BEFORE-UPDATE trigger (`audit_log_block_mutation()`, which unconditionally raises P0001 on any UPDATE/DELETE) never fired. The migration applied cleanly. On the populated prod DB (328 chained rows), the WORM trigger fired on every row → the backfill failed → C-2 HOLD. The empty-DB CI test was a Ghost Green for the migration's populated-DB behavior. Fix: (a) wrap the backfill in DISABLE/UPDATE/ENABLE trigger around the target table; (b) add `audit-migration-populated-db.e2e-spec.ts` (AMP-1..5) which seeds HMAC-chained audit rows before applying 0014, then verifies 0014 applies without WORM collision (AMP-5 is fault-killing: removing the trigger-disable wrap fails on the seeded rows).

**Source artifacts:**
- `process/waves/wave-17/stages/C-2-deploy-and-verify.md` §Provenance ("Populated-DB migration proof (AMP-1..5): proves 0014 applies against seeded HMAC-chained audit rows without the WORM collision; AMP-5 is fault-killing (removing the trigger-disable wrap would fail on populated prod)"). "This is the suite that closed the empty-CI-vs-populated-prod gap."
- `process/waves/wave-17/stages/V-1-jenny.md` GAP-4 ("the C-2 HOLD caught that 0014's audit backfill collided with the WORM BEFORE-UPDATE trigger on the populated prod DB (328 chained rows) — the empty CI DB never exercised it").
- git commits `58c1498` ("fix(schema): B-0 wrap audit_log backfill in trigger-disable (WORM collision on populated DB) + populated-migration test for wave-17").

**Root class:** Migration correctness gap when a write-operation (UPDATE/DELETE/INSERT-with-trigger) touches an existing table protected by a trigger, constraint, or check that fires only when rows are present. An empty-DB CI run cannot exercise the trigger. The test suite for such a migration must seed representative rows in the state they exist in prod (chained, constraint-bearing) before applying the migration.

**Severity:** warning (caught at C-2 HOLD before any data was mutated in prod; required an unplanned fix-forward cycle and a delayed merge; no production data loss or leak; the HOLD mechanism worked as designed).

**Generalizable?** Yes — any migration that UPDATEs or DELETEs rows from a table with a trigger (WORM, FK cascade, audit trigger, check constraint that references existing state) is at risk if CI only runs against a fresh empty DB. The AMP-pattern (seed representative rows → apply migration → assert result + fault-kill) is directly reusable. First-sighting in this explicit form. 2-wave bar NOT met.

**Relationship to prior observations:** OBS-W14-1 (BUILD #4 re-validation) concerned a migration not registered in the journal — the migration never applied at all. This is a distinct class: the migration IS registered and DOES apply on an empty DB, but fails on a populated one due to a trigger interaction invisible to the empty-DB test.

**Candidate principles file:** BUILD-PRINCIPLES (migration discipline; adjacent to existing BUILD #4 journal-registration rule; distinct kernel — about test population, not journal registration).
**Promotion status:** HOLD (first-sighting, strong kernel). Carries forward.

**Pre-authored BUILD candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
9. A migration that UPDATEs or DELETEs rows on a trigger-protected table must be tested against a pre-seeded populated DB.
   Why: An empty-DB migration test cannot exercise triggers that fire only when rows already exist.
```
_(Rule 118 chars, Why 87 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — BUILD currently has 8 rules; this would be #9. OBS-W16-2's no-echo BUILD #9 candidate is also in the queue; whichever recurs first claims the next number.)_

---

### OBS-W17-4 — Any auth/guard/bootstrap read that runs before the request GUC is set must use an RLS-exempt SECURITY DEFINER path (FIRST-SIGHTING; strong)

**What:** Three separate pre-GUC read patterns bricked in this wave until fixed:
1. P-4 F2: `getUserWithRole` reads the `users` table (FORCE RLS) to resolve workspace before the GUC is set — chicken-and-egg. Fix: `resolve_user_workspace` SECURITY DEFINER function, called before the interceptor sets the GUC.
2. P-4 F1 (B-6 Round 2): once the non-superuser `dealflow_app` role was added, `RolesGuard` and `resolveRole` read `users` pre-GUC (NestJS runs guards before interceptors). Fix: `RolesGuard` and `resolveRole` call `resolveRoleRlsExempt` → `resolve_user_workspace` SECURITY DEFINER.
3. B-6 Round 2 sweep: all pre-interceptor/background paths that executed RLS-gated tenant reads had to be converted to `SECURITY DEFINER` RLS-exempt calls.

The generalizable rule: in any framework where guards, middleware, or auth hooks run before the mechanism that sets the request-scoped DB context (GUC, session variable, RLS-enabling token), ANY tenant-table read in those early-execution stages is RLS-gated with no context → 0 rows → the guard denies everything. The fix is a SECURITY DEFINER function that bypasses RLS, returns only the minimum necessary fields for the calling context, and uses a server-derived identifier (never client-supplied).

NestJS-specific corollary: guards run before interceptors in NestJS's execution pipeline. Any guard that reads a tenant-scoped table must use an RLS-exempt path regardless of whether the interceptor is globally registered.

**Source artifacts:**
- `process/waves/wave-17/stages/P-4-security-auditor.md` (F2 HIGH: "getUserWithRole reads users (RLS) to resolve workspace before GUC set → chicken-and-egg → every request fails closed. FIX: resolve_user_workspace SECURITY DEFINER RLS-exempt bootstrap").
- `process/waves/wave-17/stages/B-6-review.md` §Phase 2 Round 2 ("mandatory non-superuser role EXPOSED that NestJS runs GUARDS BEFORE INTERCEPTORS → RolesGuard + resolveRole read users pre-GUC → RLS-gated → 403-everything under dealflow_app. → rework3: RolesGuard + resolveRole resolve role via RLS-exempt resolve_user_workspace").
- `process/waves/wave-17/stages/V-1-jenny.md` §per-objective §RBAC ("roles.guard.ts resolves role via RLS-EXEMPT resolveRoleRlsExempt — this is precisely the fix that stops the guard (running before the GUC is set) from resolving 0 roles under FORCE RLS and 403-ing every authed user").

**Root class:** Pre-execution-context DB read on an RLS-gated table. Any component that reads tenant data BEFORE the request's DB context is established sees no rows (fail-closed) regardless of the user's actual entitlement. In NestJS: guards fire before interceptors. In any framework, any auth or bootstrap hook that runs before session/context establishment faces this class.

**Severity:** strong (without the fix, every authenticated request 403'd after the non-superuser role was added — the wave's isolation feature was live but the application was entirely unusable; required a 3rd /review rework cycle).

**Generalizable?** Yes — applies to any application with a layered request pipeline (middleware, auth guard, interceptor order) where RLS or a similar row-level permission system is in effect. The SECURITY DEFINER minimal-surface pattern is the reusable solution. First-sighting. 2-wave bar NOT met.

**Candidate principles file:** BUILD-PRINCIPLES (implementation pattern for RLS + framework request-pipeline interaction; distinct from existing BUILD #1–8; complements the isolation design introduced this wave).
**Promotion status:** HOLD (first-sighting, strong kernel, reusable for any future feature adding per-request DB context). Carries forward.

**Pre-authored BUILD candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
9. Any auth guard or middleware that reads a tenant-scoped table must use an RLS-exempt SECURITY DEFINER path.
   Why: Guards run before the request context that sets the GUC, so an RLS-gated read returns 0 rows for all users.
```
_(Rule 113 chars, Why 105 chars — OVER 100. Trimmed:)_
```
9. Any auth guard or middleware that reads a tenant-scoped table must use an RLS-exempt SECURITY DEFINER path.
   Why: Guards run before the request-scoped GUC is set, so an RLS-gated read returns 0 rows and blocks all users.
```
_(Rule 113 chars, Why 110 chars — still over. Further trimmed:)_
```
9. Any auth guard or middleware that reads a tenant-scoped table must use an RLS-exempt SECURITY DEFINER path.
   Why: Guards run before the GUC is set; an RLS-gated pre-context read returns 0 rows and denies all users.
```
_(Rule 113 chars, Why 95 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — contended with BUILD #9 from OBS-W16-2 and OBS-W17-3; whichever recurs first claims next sequential number.)_

---

### OBS-W17-5 — `SET <guc> = $1` fails at runtime on a utility statement; use `SELECT set_config($1, $2, is_local)` (FIRST-SIGHTING; informational)

**What:** Both production GUC-set paths used `client.query('SET app.workspace_id = $1', [workspaceId])`. PostgreSQL's `SET` is a utility statement, not a planneable statement. node-postgres sends the extended-query protocol (Parse+Bind) when a values array is provided; the Bind phase never resolves `$1` for a utility statement, producing SQLSTATE 42P02 at runtime on every call. In the interceptor the error was swallowed (catch → continue without GUC → fail-closed: all reads return 0 rows, silently). In `runInTransactionWithWorkspace` it threw, breaking every invite signup. The test helpers used literal interpolation (`SET app.workspace_id = '${workspaceId}'`) which uses the simple-query protocol and works — so every ISO/INV test passed while the production path was broken. Fix: `SELECT set_config('app.workspace_id', $1, false)` is a regular function call, supports bind params, is injection-safe.

**Source artifacts:**
- `process/waves/wave-17/blocks/B/gate-verdict.md` (B-6 Attempt-1 REWORK: "D1 — SET app.workspace_id = $1 (parameterized utility statement) fails at runtime → GUC never set on live requests"; postgres-pro confirmation: "SET <guc> = $1 with values array fails SQLSTATE 42P02 (utility statement, bind never resolves); correct idiom SELECT set_config(...)").
- `process/waves/wave-17/stages/B-6-review.md` §Phase 1 Attempt 2 (D1 CLOSURE: "set_config($1,$2,false) @ workspace.interceptor.ts:108 — session-scoped, fail-closed catch").

**Root class:** PostgreSQL utility-statement bind-param limitation. `SET`, `RESET`, `SHOW`, and similar utility statements cannot use the extended-query protocol bind phase. Passing a values array to node-postgres for any utility statement causes SQLSTATE 42P02.

**Severity:** informational (narrow Postgres/node-postgres gotcha; too implementation-specific to generalize beyond the stack; the failure mode is deterministic and the fix is a one-line swap; caught by B-6 before C-1).

**Generalizable?** Partially — applies specifically to node-postgres callers using utility statements with a values array. Not a general cross-wave cross-stack pattern. 2-wave bar NOT met; low probability of recurrence given the fix is in the codebase and the pattern is well-documented in the B-6 verdict.

**Candidate principles file:** BUILD-PRINCIPLES (Postgres/node-postgres code convention), but specificity is too narrow relative to existing BUILD rules. Informational only — if a future wave re-encounters a parameterized utility statement bug in a different utility (`RESET`, `LOCK TABLE`) it would strengthen the case.
**Promotion status:** HOLD (first-sighting, informational, narrow gotcha). Carries forward as a low-priority candidate.

---

### OBS-W17-6 — [skip ci] on branch HEAD before push to main (OBS-W16-4 RECURRENCE audit — NON-RECURRENCE of the defect itself)

Wave-17 C-1 explicitly applied the Ghost-Green guard (neutralizing a `[skip ci]` docs HEAD on the branch before pushing to main, mirroring the wave-16 OBS-W16-4 mitigation). The guard was applied proactively as a learned lesson, not discovered as a defect: `process/waves/wave-17/stages/C-1-pr-ci-merge.md` §Ghost-Green guard ("Ghost-Green guard: original branch HEAD 0513248 was [skip ci] docs-only on top of code commit b70215c; neutralized by pushing an empty CI-triggering commit 54174a6"). Because the mitigation was APPLIED CORRECTLY (not missed), this counts as the wave-16 pattern holding, not as a new defect firing. OBS-W16-4's "pre-push verify HEAD has no [skip ci]" check was executed — the guard was known and followed. This is a positive recurrence of the mitigation pattern, not a recurrence of the defect. 2-wave bar for promotion is met on the MITIGATION being reused, but the original OBS-W16-4 pre-authored candidate already covers the rule; no new candidate needed.

**Disposition:** OBS-W16-4 HOLD carries forward; the two-wave mitigation-reuse supports promotion if the orchestrator and head-ci-cd judge that a proactively-avoided defect (vs an escaped one) meets the recurrence bar. The pre-authored CI-PRINCIPLES #2 candidate from OBS-W16-4 remains the candidate. No new text added here — this is a recurrence-audit note, not a new observation.

---

## Carried-forward holds recurrence audit (waves 12–16)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W16-1 Advisory lock / non-immutable predicate (BUILD #8) | NON-RECURRENCE. No concurrent uniqueness or cardinality invariant with a non-immutable predicate. Holds. BUILD #8 already promoted (advisory-lock); this candidate is ALREADY promoted. | ALREADY PROMOTED |
| OBS-W16-2 No-echo on validation rejection (BUILD #9 provisional) | NON-RECURRENCE. No new endpoint receiving a sensitive input used `parse()` throw or interpolated the offending value. | HOLD unchanged |
| OBS-W16-3 Stale GIT_SHA / deploy commitHash (CI #1) | NON-RECURRENCE (the fix held). `/health` GIT_SHA was bumped during C-2 per the lesson; `meta.commitHash` verified per-service. CI-PRINCIPLES #1 is already PROMOTED. | ALREADY PROMOTED |
| OBS-W16-4 [skip ci]-on-HEAD (CI #2 provisional) | See OBS-W17-6 note above. Mitigation was applied correctly. | RECURRENCE OF MITIGATION — hold for promotion decision |
| OBS-W16-5 Cross-suite HMAC key contamination (T-4 #2 provisional) | RECURRENCE as OBS-W17-1 (2-wave bar MET; different mechanical expression — seq-number non-contiguity vs HMAC-key mismatch; same kernel). | PROMOTION-GRADE via OBS-W17-1 |
| OBS-W16-6 Drizzle sql-cast JSONB bypass (BUILD #10 provisional) | NON-RECURRENCE. No Drizzle JSONB or custom-serialized column wrapped in a raw sql cast this wave. | HOLD unchanged |
| OBS-W15-3 count-FOR-UPDATE write-skew / advisory lock | NON-RECURRENCE (advisory lock pattern was reused this wave for pre-B-0 context manager, not as a new cardinality defect). BUILD #8 promoted covers this. | ALREADY PROMOTED via OBS-W16-1 |
| OBS-W15-4 Credential defense-in-depth | NON-RECURRENCE. No new admin-entered external secret primitive. | HOLD unchanged |
| OBS-W15-5 AC-consumer-half unplanned | NON-RECURRENCE. The cross-module write+read paths (GUC set in interceptor, consumed by every tenant read) were fully planned and both sides shipped. | HOLD unchanged |
| OBS-W14-2 Differential-test discriminator (VERIFY #4 provisional) | NON-RECURRENCE. ISO/INV isolation tests use `workspaceId` GUC (the field under test) as the sole discriminator; positive controls (ISO-2 > 0) confirm the discriminator is the actual enforcement axis. | HOLD unchanged |
| OBS-W14-3 Hash-excluded additive metadata on HMAC chain (BUILD provisional) | RECURRENCE CONFIRMED — workspace_id was added to audit_log_entries outside the hash preimage (B-0: "mirrors the mandate_id exclusion pattern from migration 0012 exactly"). However, this was applied CORRECTLY per the pre-existing architectural decision (audit-mandate-attribution.md) — the design is stable and the BUILD rule already exists implicitly. No defect fired. Does this count as a recurrence of the PATTERN (prompting promotion) or a recurrence of the correct use (not firing)? The PATTERN recurred correctly. The 2-wave bar for promoting OBS-W14-3 is met. Pre-authored BUILD candidate from W14-3 is now eligible for promotion-grade designation. | PROMOTION-ELIGIBLE (2-wave: W14 first hash-excluded metadata + W17 workspace_id exclusion) — but the pattern fired correctly both times (no defect); flag for orchestrator/karen to decide whether correct-use recurrence meets the promotion bar |
| OBS-W13-1 mock-only row-membership derivation (VERIFY #3 candidate — distinct from promoted VERIFY #3) | NON-RECURRENCE. No row-selecting derivation SQL tested only via param-forwarding mock. | HOLD unchanged |
| OBS-W13-2 read-path documented-completeness-gap | NON-RECURRENCE. | HOLD unchanged |
| OBS-W12-2 parallel self-migrate race (CI candidate) | NON-RECURRENCE. Parallel e2e suites used the existing advisory-lock `ensureMigrated` helper. | HOLD unchanged |
| OBS-W11-1 store-binding / OBS-W12-1 caller-FK (BUILD #8 slot candidates) | NON-RECURRENCE. BUILD #8 is now promoted (advisory-lock from OBS-W16-1); these two candidates need new slot numbers. Neither recurred this wave. | HOLD unchanged — need new slot designations on their own recurrence |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W17-1 Cross-suite shared-DB chain pollution | W16 (OBS-W16-5) + W17 | warning | YES (generalizable + falsifiable + 2-wave cited) | T-4 (#2) | PROMOTION-GRADE |
| OBS-W17-2 Vacuous RLS test under BYPASSRLS role | W17 only | strong | 2-wave bar NOT met | VERIFY (#4 provisional) | HOLD |
| OBS-W17-3 Populated-DB migration test | W17 only | warning | 2-wave bar NOT met | BUILD (#9 provisional) | HOLD |
| OBS-W17-4 Pre-GUC guard reads need SECURITY DEFINER | W17 only | strong | 2-wave bar NOT met | BUILD (#9 provisional) | HOLD |
| OBS-W17-5 SET-utility-statement bind-param limitation | W17 only | informational | 2-wave bar NOT met | BUILD (narrow, low-priority) | HOLD |
| OBS-W16-4 [skip ci] mitigation reuse | W16 first-sighting + W17 mitigation applied | warning | recurrence of mitigation (not defect) | CI (#2 provisional) | HOLD — orchestrator/karen promotion decision |
| OBS-W14-3 Hash-excluded additive metadata (recurred correctly) | W14 + W17 | informational | 2-wave correct-use recurrence | BUILD (provisional) | FLAG — promotion conditional on karen ruling correct-use counts |

**Carry-forward queue after wave-17:**
- OBS-W17-1 — Cross-suite shared-DB chain pollution (PROMOTION-GRADE, T-4 #2, 2-wave W16+W17).
- OBS-W17-2 — Vacuous RLS test under BYPASSRLS role (HOLD, VERIFY #4 provisional, own clock).
- OBS-W17-3 — Populated-DB migration test for trigger-protected tables (HOLD, BUILD #9 provisional, own clock).
- OBS-W17-4 — Pre-GUC guard reads need SECURITY DEFINER (HOLD, BUILD #9 provisional, own clock; NestJS guard-before-interceptor corollary).
- OBS-W17-5 — SET utility-statement bind-param limitation (HOLD, informational, low-priority, own clock).
- OBS-W16-4 — [skip ci] mitigation reuse (HOLD, CI #2 provisional; orchestrator/karen promotion call).
- OBS-W14-3 — Hash-excluded additive metadata (2-wave correct-use recurrence; karen ruling needed on whether correct-use recurrence meets the promotion bar).
- Inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle sql-cast JSONB, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W14-2 differential discriminator VERIFY #4, W13-1 mock-only derivation, W13-2 read-path gap, W12-2 self-migrate race, W11-1 store-binding (new slot pending), W12-1 caller-FK (new slot pending).

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 5
promotion_grade: [OBS-W17-1 (T-4 #2)]
hold: [OBS-W17-2, OBS-W17-3, OBS-W17-4, OBS-W17-5]
flag_for_karen: [OBS-W16-4 mitigation-reuse, OBS-W14-3 correct-use-recurrence]
cross_suite_shared_db_2wave_bar_met: true     # OBS-W16-5 + OBS-W17-1
rls_vacuous_superuser_1wave_hold: true
populated_migration_1wave_hold: true
pre_guc_guard_security_definer_1wave_hold: true
set_utility_param_informational_hold: true
skip_ci_mitigation_recurred: true             # W16 defect + W17 proactive mitigation applied
hash_excluded_metadata_correct_use_recurred: true  # W14 + W17 correct use
prior_held_candidates_recurred: [OBS-W16-5 → OBS-W17-1 (PROMOTION-GRADE)]
```
