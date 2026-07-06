# Wave 15 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, B-6 Phase 1)
**Reviewed against:** process/waves/wave-15/blocks/B/review-artifacts.md
**Attempt:** 1  (first gate)

## Verdict
REWORK

## Rationale
The production code for BOTH load-bearing P-4 security requirements is CORRECT — #1 the race-safe last-admin guard (`runLastAdminGuard` acquires `pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY)` as the first statement, then counts remaining active admins excluding the mutated user, and throws `ConflictException` on zero; it is NOT `count(*) FOR UPDATE`, covers deactivate + demote + self-paths), and #2 the AES-256-GCM credential envelope (random 12-byte IV per encrypt, auth-tag stored and verified on decrypt, `v1` key-id prefix, fail-closed on missing/short key, `scrubCredentialFromError` redaction, read path returns `hasCredential` boolean only, no credential hashed into contentHash/payloadHash). Items #3 (auditActionEnum extended additively with all 6 admin actions at the end — serialization order preserved), #4 (migration 0013 journaled at idx 13, additive-only, snapshot + .down present), #5 (M3 `sourcing.ts` no-secret-column comment properly reconciled), and #6 (every /admin/* route guarded by SessionGuard + RolesGuard + @Roles, fail-closed boot on empty role matrix, actor via getUserWithRole) all PASS. **However, the wave FAILS the one proof the spec makes load-bearing and non-negotiable.** The spec for 82ec8724 states verbatim: "Tested with a CONCURRENCY assertion (two concurrent deactivate-different-last-two → exactly one succeeds ... this test FAILS if the guard used count-FOR-UPDATE)." That test does not exist as written. `test/admin-concurrency.e2e-spec.ts` CONC-1 re-implements the advisory-lock + count logic INLINE inside the test body (lines 171-208) instead of invoking `UserManagementService.deactivateAsActor` / `runLastAdminGuard`. It exercises test-authored SQL, never the production code path — it would pass IDENTICALLY against a `count(*) FOR UPDATE` implementation, so it proves nothing about the shipped guard. Compounding this, the unit suite `admin.spec.ts` imports `ConflictException` but never asserts it: the last-admin-reject (409) behavior — the entire security property — has ZERO coverage touching production code (the mock hardcodes `remaining: '1'`, so the guard can never fire), and the file header cites two non-existent files as the home of the "load-bearing tests." This is the Hollow AI Test Suite anti-pattern applied to a compliance-critical invariant: the code is right, but the mandated proof is fabricated. The credential-leak proofs (SEC-1..4) are genuine — they call the real service including a real forced-error path (SEC-2) — so #2's proof stands; the gap is isolated to #1.

## Rework instructions

### Stages requiring rework
- B-5: the last-admin-guard concurrency + reject proof does not exercise production code (hollow test); no unit coverage of the 409 path.

### Per stage

#### B-5
- **What's wrong:** The load-bearing race-safe-last-admin proof is hollow. (1) `apps/api/test/admin-concurrency.e2e-spec.ts` CONC-1 re-implements the advisory-lock + count SQL inline in the test body rather than calling `UserManagementService.deactivateAsActor`/`assignRoleAsActor`. It passes regardless of the production implementation — it does NOT fail against `count(*) FOR UPDATE`, which the spec requires it to. (2) `apps/api/src/modules/admin/admin.spec.ts` imports `ConflictException` but never asserts the last-admin 409 reject; the mock db hardcodes `execute → { rows: [{ remaining: '1' }] }`, so `runLastAdminGuard` can never reach `remaining === 0` in any unit test. (3) The `admin.spec.ts` header (lines 26-27) references `admin.concurrency.spec.ts` and `admin.credential-security.spec.ts` as where load-bearing tests live — neither file exists (a docstring-honesty defect masking the coverage gap).
- **Heuristic fired:** Hollow AI Test Suite — high nominal coverage with assertions that validate test-authored logic rather than production business intent; the compliance-critical guard's reject path is untested against real code. Also: docstring-honesty (header cites non-existent test files).
- **What "good" looks like:**
  1. CONC-1 in `apps/api/test/admin-concurrency.e2e-spec.ts` must invoke the REAL service against a real DB: two concurrent `Promise.all([svc.deactivateAsActor(admin1, ...), svc.deactivateAsActor(admin2, ...)])` (and/or one deactivate + one `assignRoleAsActor` demote of the OTHER admin) with exactly two active admins → assert exactly one resolves and exactly one rejects with `ConflictException` (409), and a post-state DB query proves ≥1 admin remains active. Isolate the admin set so pre-existing seed admins do not mask the guard (create the two test admins AND ensure no other active admins exist for the count, or scope the count assertion to the test cohort while still driving it through the service).
  2. Add a REGRESSION assertion (comment + test) that this test is designed to FAIL if `runLastAdminGuard` is swapped to `count(*) FOR UPDATE` — i.e., the proof is meaningful. If a true concurrency race is infeasible in CI, at minimum drive both mutations through the real service sequentially within the real advisory-lock path AND add a deterministic unit test (below) — but the concurrency assertion through the real service is the spec's explicit requirement and is strongly preferred.
  3. Add unit tests in `apps/api/src/modules/admin/admin.spec.ts` that make the mock `tx.execute` return `{ rows: [{ remaining: '0' }] }` and assert `deactivateAsActor` AND `assignRoleAsActor` (admin→non-admin demote) each `rejects.toBeInstanceOf(ConflictException)`. Also assert the guard is NOT invoked when the target is a non-admin (no false 409).
  4. Fix the `admin.spec.ts` header to reference the actual test file (`apps/api/test/admin-concurrency.e2e-spec.ts`) — remove the two non-existent filenames.
- **Re-do instructions:**
  1. Route the fix through `test-automator` (author the real service-driven concurrency + reject tests) with `postgres-pro` consulted on the isolation approach for the admin-cohort count under a shared test DB (advisory-lock behavior across pooled connections; ensure the two txns actually contend, not serialize onto one pooled connection).
  2. `test-automator`: rewrite CONC-1 to call `UserManagementService` methods (construct the service with the real `db` + a real `AuditService`, as SEC-1/2/4 already do), remove the inline SQL re-implementation, and add the count-FOR-UPDATE regression note.
  3. `test-automator`: add the two `ConflictException` unit tests (deactivate + demote) driven by the mock returning `remaining: '0'`, plus the non-admin-no-guard test.
  4. Correct the `admin.spec.ts` docstring header.
  5. Re-run B-5 full suite (lint, typecheck, unit, e2e-with-DB, build) green; confirm the new tests genuinely fail if the guard is temporarily reverted to `count(*) FOR UPDATE` (author must state this was verified).

### Cascade

| Trigger stage | Stages that must re-run downstream |
|---|---|
| B-5 verify | (terminal — only itself) |

- **Stages that must re-run after the above:** B-5 (full suite re-run after test fixes). No production code change is required for the guard itself, so B-0..B-4 stay untouched unless the test work surfaces a real guard defect (it should not — the production guard is correct).
- **Stages that stay untouched:** B-0, B-1, B-2, B-3, B-4.

## Escalation  (only if ESCALATE)
n/a

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---
# Wave 15 — B-6 Verdict (Phase 1 — head-builder) → REWORK (B-5 test-only)
## Production code CORRECT (no change): advisory-lock last-admin guard (runLastAdminGuard, NOT count-FOR-UPDATE — write-skew-safe); AES-256-GCM credential crypto (random-IV/tag-verify/key-id/redaction — sound). #3 auditActionEnum extended, #4 migration 0013 journaled, #5 M3 reconciled, #6 RBAC/SoD + credential-write-only + RBAC-reverify — all PASS.
## REWORK (B-5 test discipline — the load-bearing concurrency PROOF is hollow):
- **CONC-1 HOLLOW:** apps/api/test/admin-concurrency.e2e-spec.ts CONC-1 (lines 171-208) RE-IMPLEMENTS the guard INLINE instead of calling UserManagementService.deactivateAsActor → it would pass identically against a broken count(*)-FOR-UPDATE guard → proves NOTHING about the real guard. FIX: rewrite CONC-1 to run two CONCURRENT real UserManagementService.deactivateAsActor calls on the last two admins → assert exactly one succeeds (the other 409s) + ≥1 admin remains, exercising the REAL advisory-lock path (this test must FAIL if the guard regressed to count-FOR-UPDATE).
- **Missing 409 unit:** admin.spec.ts imports ConflictException but never asserts the last-admin reject → add a unit test: deactivating/demoting the last admin → ConflictException (via the real service).
Rework is B-5-only (no production change).
## Footer
```yaml
verdict: REWORK
production_code: CORRECT (both security invariants sound)
rework: B-5-test-discipline (hollow-CONC-1 + missing-409-unit)
rework_attempt_cap_remaining: 2
```
