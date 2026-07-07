# Wave 25 — V-3 Gate Verdict (Verify block-exit)

**Reviewer:** head-verifier (fresh spawn, V-3 gate, wave-25 M10 auth-hardening, SECURITY-SCOPE-TIGHTENED)
**Mode:** automatic · **Gate agent:** head-verifier
**Deployed commit (LIVE @prod):** `987ebb42e48df759ca7b6b1872b48c54be5dd7fe`
**CI evidence:** run `28876707093` (5/5 jobs green, 983 pass / 0 fail / **0 skipped / 0 pending**)
**Reviewed against:** V-1-karen.md · V-1-jenny.md · V-1-summary.md · V-2-triage.md · C-2-deploy-and-verify.md · B-2-backend.md (B-6 rework + P2 hardening) · blocks/T/gate-verdict.md (T-9 APPROVED)
**Attempt:** 1 · **Fast-fix loop:** not entered (0 blocking; queue empty)

## Verdict
**APPROVED**

## Block-scoped state
```yaml
reviewer_verdicts: {karen: APPROVE, jenny: APPROVE}   # parallel, zero shared context
triage_findings: {blocking: 0, non_blocking: 6, info: 3}
fast_fix_attempts: 0                                   # queue empty — no loop
escalation_log: []
```

## Rationale (proof-carrying — every PASS traced to observable deployed state)

**1. Done + LIVE, not Done-Theater — PASS.** The auth rate-limiter is genuinely live at `987ebb4` and the proof is anchored in deployed reality, not inferred from a green suite. Migration `0019_rate_limit_hits` is applied to prod: the deploy logs record "migrations applied successfully!" (one-shot preDeployCommand before traffic routing), `/health` returns `db:ok` on the **true** hash (`version==987ebb4` — the Health-Check-Mirage of a stale `GIT_SHA` service var was caught at C-2 Action 4b and reconciled with a pinned redeploy, so this is not a stale-domain false-200), and the boundary 429 was observed in prod **twice** (C-2 smoke run 1 @5d05a0b1 + run 2 @88eb7a2c fresh bucket), then a **third time INDEPENDENTLY** by karen against a brand-new nonexistent fake email (reqs 1-5 → 202, req 6 → 429 `retryAfter:39`). This is the single strongest anti-Done-Theater proof available: `/auth/reset/request` is **fail-OPEN**, so a 429 there is *only* producible by a genuinely-firing DB-backed limiter with `rate_limit_hits` present — a stub / unmigrated / fail-open path would have returned 202 on all eight requests. The 429 mechanically proves the migration applied AND the limiter fired against the live table.

**2. Load-bearing security invariants hold in prod — PASS.** SEC-1 atomic (`INSERT ... ON CONFLICT (key,window_start) DO UPDATE ... RETURNING` at `rate-limit.middleware.ts:280`; real-Postgres concurrency proof **SEC-1-DB ran+passed in CI** — 1809 ms of genuine PG work, unique-RETURNING assertion that a SELECT-then-UPDATE race would fail; not a mock tautology). SEC-2 dual fixed-window (60s + 3600s). SEC-3 trust-proxy=1 (`main.ts:102`, Railway 1-hop). SEC-5 differentiated fail (fail-OPEN signup/reset-request only on connection-class errors; fail-CLOSED-SOFT signin/reset-confirm; the P2-C narrowing degrades a latent non-connection bug to soft-fallback rather than silently disabling the limiter). SEC-8 Express placement (`main.ts:127` before SuperTokens `middleware()` at `:135` — the only placement that intercepts the SDK auto-route /auth/signin). SEC-9 no global pipe (per-handler `safeParse` throwing `BadRequestException`, non-auth POST passthrough guard proving no 18-controller regression). SEC-11 logout-CSRF verify-only. The B-6 rework caught + fixed **3 genuinely load-bearing prod defects** — DEFECT-1 unjournaled migration (would have made the limiter permanent fail-open: the definitive Done-Theater trap, now journaled idx 19 + snapshot + `drizzle-kit check` clean AND proven live by the fail-open 429), DEFECT-2 unverified atomicity (mock-only → real-PG SEC-1-DB test), DEFECT-3 email-keying-fell-to-IP (`ensureBodyParsed` + SEC-4-DB email-keying test) — plus 4 P2s (body-size cap + slow-loris timeout, unref'd single-guarded sweeper, fail-open narrowing, corrected signup-per-IP comment). All closed and re-verified in live source by both V-1 reviewers. None of the fixes stripped a validation layer to force green — they hardened.

**3. Reviewers credible + triage correct — PASS.** karen and jenny ran in parallel with zero shared context. karen did NOT trust the C-2 report — she independently re-executed the prod 429 against a fresh nonexistent email (self-executed live probe), and verified the mechanical guarantees in shipped source. jenny verified in source (atomic ON CONFLICT...RETURNING, Express-before-SuperTokens placement, trust-proxy=1, per-handler safeParse, journaled 0019) — 6/6 checks MATCH, 11/11 SEC delivered, 0 drift. V-2 correctly classified 0 blocking. The T-8 test-thinness findings are correctly non-blocking: **F1** (SEC-3 no forged-XFF *integration* probe) — trust-proxy=1 is SET in `main.ts` + verified in source + the prod smoke keyed on the Express-resolved `req.ip` correctly; a live XFF-spoof test would harden but the mechanism is provably correct. **F2** (SEC-11 logout rid-missing→401 config-asserted, not live-probed) — rests on static `antiCsrf: VIA_CUSTOM_HEADER` + `@UseGuards(SessionGuard)` assertions plus the vendored SuperTokens guarantee; logout-CSRF is a standard web control, **not** one of DealFlow's crown-jewel compliance invariants (audit-log HMAC chain / pre-send gate / SoD — none in this rate-limit+validation wave's scope). **F3/F4** cosmetic (inline-SQL coverage overlap, two `expect(true)` hygiene markers). All four are coverage-thinness on non-crown-jewel controls, correctly held as an `auth-security-integration-probe` follow-up for L-2 consideration — not a live bypass, missing feature, or drift. Indefinitely blocking a spec-compliant deployment over these would itself be a triage-discipline failure. The 3 INFO findings are correctly routed (migration-timestamp cosmetic → no-op; M10-recordkeeping-decomposition → N-block + wave-26 tripwire; Actions-billing 3×-same-day → founder digest).

**4. No gap — PASS.** 983 unit tests + CI 5/5 green (run 28876707093), **0 skipped / 0 pending** across the entire run — the DB-gated crown-jewel proofs (SEC-1-DB atomicity, SEC-4-DB email-keying) genuinely RAN in CI, not silently skipped. No live-auth regression (SuperTokens session model + invite-only + rid anti-CSRF untouched; DEFECT-3 fix preserves single-consumption body parse). Migration additive-only + proven applied. No secret leaked (audit exit 0). Every V-3 stage-exit check ticks from a concrete deployed-state artifact — none inferred from a green suite, a clean diff, a mock, or a task-completion marker.

## Anti-pattern sweep (head-verifier lens)
- **Done-Theater** — cleared: prod 429 reproduced 3× incl. independent fresh-email probe; fail-open path makes the 429 an unambiguous live-limiter proof.
- **Ghost Migration** — cleared: 0019 applied via one-shot preDeployCommand + `db:ok` on true hash + functional fail-open-429 proof (not a file-diff inference).
- **Local-Build Illusion** — cleared: all verification against live Railway prod (GraphQL reads + curls); Health-Mirage caught + reconciled at C-2.
- **Compliance-Gate-Bypass acceptance** — cleared: no test-mode bypass; B-6 fixes hardened (real-PG atomicity, fail-open narrowing) rather than stripping validation.
- **Infinite Fast-Fix Loop** — N/A: 0 blocking, queue empty, loop never entered; no retry-cap pressure.
- **Triage Noise Blindness** — cleared: F1-F4 correctly filtered as non-crown-jewel coverage-thinness, not conflated with load-bearing defects.

## Non-blocking (carried forward, not blocking)
- F1 SEC-3 forged-XFF integration probe · F2 SEC-11 live logout rid-401 probe → held `auth-security-integration-probe` for L-2 consideration (deferred to a future SuperTokens-Core harness).
- F3/F4 cosmetic (inline-SQL overlap; `expect(true)` markers) → recommend marker deletion at L-2.
- INFO: migration-timestamp (no-op); M10-recordkeeping-decomposition → N + wave-26 tripwire; Actions-billing 3×-same-day → founder digest.

## Cascade
| Trigger stage | Downstream re-run |
|---|---|
| (none — APPROVED) | none |

## Footer
```yaml
head_signoff:
  verdict: APPROVED
  stage: V-3
  reviewers:
    karen: {verdict: APPROVE, blocking: 0, prod_429_independently_reconfirmed: true}
    jenny: {verdict: APPROVE, checks: 6/6, sec_obligations: 11/11, drift: 0}
    triage: {blocking: 0, non_blocking: 6, info: 3, fast_fix_queue: empty}
  failed_checks: []
  rationale: >
    Auth rate-limiter is DONE + LIVE-prod-verified at 987ebb4 — migration 0019 applied (db:ok on true hash;
    "migrations applied successfully!"), prod 429 boundary observed THREE times incl. karen's independent
    fresh-nonexistent-email probe against the fail-OPEN /auth/reset/request path (a 429 there is only
    producible by a genuinely-firing DB-backed limiter — unambiguous anti-Done-Theater proof, not inferred
    from green tests). Load-bearing SEC invariants hold in prod: SEC-1 atomic (real-PG SEC-1-DB ran+passed
    CI, 0 skipped), SEC-2 dual-window, SEC-3 trust-proxy=1, SEC-5 differentiated-fail, SEC-8
    Express-before-SuperTokens, SEC-9 no-global-pipe/no-18-controller-regression, SEC-11 logout-CSRF. B-6
    caught+fixed 3 load-bearing prod defects (unjournaled migration [Done-Theater trap], unverified
    atomicity, email-keying-to-IP) + 4 P2s — all closed and re-verified in live source; the fixes hardened
    rather than bypassed. Reviewers credible (parallel, zero shared context; karen re-ran prod live, jenny
    verified source). Triage correct: 0 blocking; T-8 test-thinness F1 forged-XFF-integration / F2
    live-logout-401 correctly non-blocking (mechanisms correct + verified in source/prod; non-crown-jewel —
    DealFlow crown jewels are audit-log HMAC chain / pre-send gate / SoD, none in this wave's scope); 3 INFO
    routed. 983 unit + CI 5/5 green, 0 skipped. No claim rests on inference, mocks, or task-completion
    markers — every PASS traces to a live prod artifact.
  next_action: PROCEED_TO_L
```
