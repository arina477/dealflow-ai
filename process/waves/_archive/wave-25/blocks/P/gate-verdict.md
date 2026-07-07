# Wave 25 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, agentId head-product-w25-p4-a1)
**Reviewed against:** process/waves/wave-25/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
This wave hardens the live sign-in flow with three tightly-scoped fixes and every load-bearing claim survives a code-level check. The rate limit is specified as a shared Postgres-backed store that holds across multiple server instances — not the throw-away in-memory kind that resets on every deploy and can be dodged by an attacker hopping between servers — and it is proven by falsifiable tests (attempt N+1 returns "too many requests," the limit still holds when a second server instance is simulated, and a normal pilot user is never locked out). The "returns a server error when an invite code is missing" fix targets the real cause (the request-validation step was never switched on) rather than a redundant rule change, which I confirmed against the code. The logout protection is a verification of the existing built-in safeguard rather than a risky hand-rolled one that could clash with the session system. Nothing here regresses the invite-only sign-up or the session model, the compliance audit trail stays append-only, and the security-sensitive scope correctly triggers the tightened security review before this ships. Approved to proceed to the second-phase reviewers.

## Security-scope tightened gate — CONFIRMED
- **wave_touches ∩ {auth, sessions, csrf, rate-limit, user-creation} ≠ ∅** — this wave touches auth, sessions, CSRF, and rate-limiting. `security_scope_tightened: true` in P-1 and P-3.
- **Phase 2 routing (this is a Phase-1 directive to the orchestrator):** the standard Phase-2 trio (karen + jenny + Gemini) is INSUFFICIENT for this wave. Phase 2 MUST additionally route a **security-auditor** pass (per the SECURITY-SCOPE-TIGHTENED note in review-artifacts + trigger table). The **T-8 Security** stage also applies downstream. Do NOT exit the P-block on karen+jenny+Gemini alone.
- Per P-4 Action 1 § "Security-scope tightened gate": if the first Phase-2 pass returns BLOCK with >2 medium-or-higher findings, a second Phase-2 iteration is forced after rework (cap 3 attempts total).

## Verification performed (code-level, not inferred)
| Claim | Evidence | Result |
|---|---|---|
| Shared Zod already has `inviteToken min(1)` (so 500 fix is NOT a schema change) | `packages/shared/src/auth.ts:50` | CONFIRMED |
| No ZodValidationPipe / APP_PIPE / useGlobalPipes wired in apps/api (the real 500 cause) | grep of `apps/api/src/` returned empty | CONFIRMED (pipe absent) |
| Zero existing rate-limiting (gap is real) | grep Throttle/ThrottlerModule/rateLimit/429 in `apps/api/src/` empty | CONFIRMED |
| SuperTokens `antiCsrf: VIA_CUSTOM_HEADER` under cookie mode already exists (item-3 VERIFY premise) | `apps/api/src/modules/auth/supertokens.config.ts:112,118-131` (`getTokenTransferMethod: () => 'cookie'`, VIA_CUSTOM_HEADER `rid`, documented compliance tool) | CONFIRMED |
| The 500 site is `hashToken(input.inviteToken)` | `apps/api/src/modules/auth/auth.service.ts:114` | CONFIRMED |
| SuperTokens `middleware()` app.use ordering trap is real (rate-limit must precede it) | `apps/api/src/main.ts:97-102` (pre-listen prepend semantics documented) | CONFIRMED |

## Stage-exit checklist (P-4)
- [x] All ACs touching audit-log / compliance-gate / RBAC-suppression are binary, observable, machine-readable — rate-limit ACs are falsifiable (N+1→429; shared-store holds across simulated 2nd instance; no-pilot-lockout proven); 500→400 binary; logout-no-header→rejected binary.
- [x] Cross-review responses (problem-framer REFRAME[3], ceo-reviewer PROCEED-HOLD-SCOPE, mvp-thinner OK) logged, resolved, integrated into the spec contract (DB seed 6fe232e3 head + P-2/P-3).
- [x] Default No-Go NOT triggered — every artifact is machine-readable and every AC traces to the P-0 frame (rate-limit → item 1; 500→400 → item 2; logout-CSRF → item 3).

## Six-axis findings (per the gate directive)
1. **Rate-limit shared-store-across-replicas — non-spoofable + enforced, NOT theater.** Postgres shared store required; `@nestjs/throttler` in-memory default explicitly REJECTED in P-3 Action-1 (per-instance, resets on deploy, round-robin-bypassable). Per-account (per-email, robust to IP rotation) + per-IP (trust-derived client IP, not spoofable raw header). Middleware BEFORE SuperTokens `middleware()`. 429+Retry-After on exceed. Falsifiable: N+1→429 test + **429-holds-across-simulated-2nd-instance test (the shared-store proof)** + no-pilot-lockout test. Fail-OPEN on limiter-internal-error documented + logged (acceptable pre-external-user + invite-only mitigation) — an explicit, defensible pilot-stage decision, not an unstated aspiration. **PASS.**
2. **500→400 correct cause — WIRE validation, not schema change.** Verified: schema already has the rule; the fix is the missing pipe. Global-pipe regression guard present (no other endpoint regresses). **PASS.**
3. **Logout anti-CSRF — VERIFY existing SuperTokens, not hand-roll.** Verified: VIA_CUSTOM_HEADER `rid` exists; spec verifies it with a binary negative test; hand-roll forbidden. **PASS.**
4. **No regression.** `no-invite-only-session-regression` named invariant + hard_boundaries + B-2 test; thresholds bound to no-pilot-lockout. **PASS.**
5. **security_scope_tightened.** Confirmed true; Phase 2 MUST add security-auditor + T-8 applies (see § above). **PASS.**
6. **Scope + M10 flags.** wave-26 tripwire (BOARD-escalate on a 3rd hardening seed without recordkeeping-decomposition) + M9/M10 _TBD metric polls recorded in P-0 FLAGS + ceo-reviewer conditions 4-5 + review-artifacts. mvp-thinner cross-milestone re-home flag (auth-hardening under SOX/FINRA M10) surfaced for N-1/founder. **RECORDED.**

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---
## Phase 2 (karen + jenny + security-auditor + Gemini) — merged
- **karen:** APPROVE (5/5 VERIFIED — the 500->400 root cause [inviteToken min(1) exists @packages/shared/src/auth.ts:51 + NO ZodValidationPipe wired + the 500 site auth.service.ts:114 hashToken(undefined)]; the logout anti-csrf VIA_CUSTOM_HEADER @supertokens.config.ts:145; no existing rate-limiter; the target endpoints real; Postgres-only-no-Redis). The REFRAMEs are grounded, not fabricated.
- **jenny:** APPROVE (6/6 MATCHES, 0 DRIFTS — the 3 items match the live SuperTokens/invite-only/rid model; rate-limit proportionate; 500->400 shared-Zod-discipline; logout verify-existing; 2nd M10 hardening wave [not recordkeeping-claim]; _TBD flagged).
- **security-auditor (TIGHTENED GATE):** spec correctly DIAGNOSED but UNDER-SPECIFIED → 4 HIGH + F7/F8/F9 → folded as BINDING NAMED ACs SEC-1..11 (SEC-1 atomic-counter, SEC-2 window-named, SEC-3 trust-proxy/IP, SEC-5 differentiated-fail-closed-soft-for-signin, SEC-7 add-reset/confirm, SEC-8 Express-app.use-before-middleware [Nest guard MISSES signin], SEC-9 no-global-pipe-regression, SEC-6/10 no-enumeration, SEC-11 logout-verify-SPEC-SOUND). Without SEC-1/2/3/5 the rate-limit ships bypassable.
- **Gemini:** UNAVAILABLE (429).
## MERGED P-4 VERDICT: APPROVED (Phase 1 APPROVED + karen+jenny APPROVE + security-auditor findings folded as binding SEC-1..11 ACs + Gemini UNAVAILABLE). SECURITY-SCOPE-TIGHTENED gate satisfied (security-auditor Phase-2 done). → exit to B-block + T-8 Security stage.
## B-BLOCK OBLIGATIONS: SEC-1..11 (the 4 HIGH — atomic counter, named window, trust-proxy/IP, differentiated-fail-closed-soft-signin — are HARD; plus Express-placement, no-global-pipe, add-reset/confirm, no-enumeration, logout-verify). T-8 Security stage tests each.
- verdict_complete: true
