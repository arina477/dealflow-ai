# Wave 2 — B-6 Verdict

**Reviewer:** head-builder (fresh spawn, agentId head-builder@B-6-phase1)
**Reviewed against:** process/waves/wave-2/blocks/B/review-artifacts.md
**Attempt:** 1  (first gate)

## Verdict
APPROVED

## Rationale
All three spec blocks are implemented against the frozen contract and the six load-bearing security invariants are present in the code — verified by reading the source, not by trusting the stage self-reports. (1) SuperTokens + data model: `supertokens.config.ts` inits EmailPassword + Session with a `createNewSession` override that mirrors the app-DB role into the access-token payload on both mint and refresh; the additive migration `0001_serious_junta.sql` creates users/roles/invites with `NOT NULL`, `UNIQUE`, `ON DELETE RESTRICT` on role FKs, a partial-unique index on unconsumed tokens, seeds exactly the 4 roles idempotently, and its down-migration drops only the 3 new tables (grep confirmed zero DROP/ALTER-DROP in the forward file and app_meta untouched). (2) Auth API: all six endpoints exist with the correct status codes; invite-only is enforced by a pre-check that rejects before `EmailPassword.signUp` (test asserts signUp never called), no-user-enumeration is enforced at both contract (`.strict()` schemas, fixed 202) and service layer (generic errors, address never logged), the no-alias boot assertion fails fast in both `main.ts` and `AuthModule.onModuleInit` with dedicated unit tests for both alias directions, and concurrent invite consumption uses `SELECT ... FOR UPDATE` with an under-lock re-check plus Core-user compensation on the losing race. (3) Auth screens: three pages consume the shared `@dealflow/shared` Zod schemas via `z.infer`, use accessible form components, show generic errors, and — critically — a grep confirms zero SuperTokens SDK imports or secrets in the web bundle. The RBAC guard primitive is built and DI-registered but applied to NO route (grep-verified; only SessionGuard on /me and /logout, which is authentication and in-spec), correctly honoring the P-0 scope guardrail that per-route enforcement is a later slice. Test discipline is real, not hollow: the 20 API tests assert state and negative invariants (signUp NOT called, deleteUser called with the right id, both alias-throw paths, token-hash != plaintext), and the login RTL suite asserts generic-error copy, aria-invalid, redirect target, and network-failure handling rather than mere render. The skipped health e2e (needs TEST_DATABASE_URL, runs in CI) and the deferred auth-runtime dev-smoke (→C-2, needs live Core) and Playwright E2E (→T-5, needs host Chrome) are all legitimately deferred with declared infra dependencies — not false-green. One Medium gap is accepted as tracked debt (below), non-blocking.

## Accepted debt (Medium — non-blocking, tracked to T-5)

- **Edge-case AC not implemented:** block-3 (af6cbc59) lists "already-authenticated user visits /login: redirect to landing." `login/page.tsx` is a client component with no session-existence check on mount and no test for it. Severity Medium, not REWORK, because: (a) it is a listed edge-case, not a top-line acceptance criterion; (b) it is UX, not a security boundary — `/dashboard` correctly gates on `GET /auth/me` returning 401 and redirects to /login, so there is no auth-bypass consequence; (c) the real-browser flow this AC is best verified in is already deferred to T-5 pending host Chrome. Track: add the on-mount redirect (SuperTokens `doesSessionExist` or a `/auth/me` probe) and its E2E assertion in the T-5 auth-screens journey. Recorded here so it is not silently lost at T-9 journey regen.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---
## Phase 2 — /review + commit-discipline
/review found 1 CRITICAL (dashboard cookie forwarding — redirect loop) + 4 informational. CRITICAL + 2 security-relevant infos FIXED (B-2/B-3 re-entry, commit 5726917) with +13 regression tests; 1 comment fix; 1 accepted-debt (post-commit invite burn, recoverable). Re-verify: typecheck clean, 78 tests pass, build clean, 0 biome errors. Commit-discipline PASS (every task_id covered; multi-ref commits are legitimate shared-contract/cross-cutting). **B-6 final verdict: APPROVE.**
