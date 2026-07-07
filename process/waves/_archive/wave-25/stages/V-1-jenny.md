# Wave 25 — V-1 jenny (spec-compliance verification)

**Reviewer:** jenny (fresh spawn, V-1, wave-25 M10 auth-hardening, SECURITY-SCOPE-TIGHTENED)
**Spec (source of truth):** seed `6fe232e3` `tasks.description` — P-0 REFRAME SCOPE + P-4 Phase-2 security-auditor binding ACs SEC-1..11
**Verified against:** P-2-spec.md, P-3-plan.md, seed DB row, B-2-backend.md (incl. B-6 rework + P2 hardening), blocks/T/gate-verdict.md (T-9 APPROVED), status-check.yaml (C-block complete), product-decisions.md, live source (`apps/api/src/modules/auth/rate-limit.middleware.ts`, `main.ts`, `auth.controller.ts`, migration 0019 + journal)
**Attempt:** 1

## Verdict
APPROVE

## Independent code verification (not inferred from reports)
- **SEC-1 atomic** — `rate-limit.middleware.ts:280` `ON CONFLICT (key, window_start) DO UPDATE ... RETURNING`; single-statement post-increment decision, no SELECT-then-UPDATE. Journaled migration 0019 present (`0019_rate_limit_hits.sql` + `meta/0019_snapshot.json`). Real-PG concurrency proof SEC-1-DB ran+passed in CI (run 28876707093, 0 skipped). MATCH.
- **SEC-8 Express placement** — `main.ts:127` `app.use(createRateLimitMiddleware())` registered BEFORE `main.ts:135` `app.use(middleware())` (SuperTokens). Not a Nest guard. MATCH.
- **SEC-3 trust-proxy** — `main.ts:102` `app.set('trust proxy', 1)` (Railway 1 hop, doc'd). MATCH.
- **SEC-9 500→400** — `auth.controller.ts` per-handler `signupRequestSchema.safeParse` (+ invite/reset handlers); NO global APP_PIPE. MATCH.
- **SEC-2 dual-window / SEC-4 normalized key / SEC-5 differentiated fail / SEC-6 no-enum / SEC-7 4-endpoint coverage / SEC-10 generic 400 / SEC-11 verify-only** — all concretely asserted per B-6 + T-9 source audit. MATCH.

## Check-by-check (6 asks)
1. **3 items delivered as specified** — rate-limit (SEC-1..8), 500→400 per-handler-safeParse-no-global-pipe (SEC-9/10), logout-CSRF verify-only (SEC-11). All track the P-0 REFRAME + binding SEC ACs. MATCH. *(Note: P-2 pointer's earlier "global ZodValidationPipe" language is correctly SUPERSEDED by the binding SEC-9 per-handler-safeParse — the security-auditor tightening is load-bearing and the impl followed it; not a drift.)*
2. **4 HIGH are real, not theater** — SEC-1 (journaled 0019 + real-PG SEC-1-DB test), SEC-2 (dual fixed-window 60s+3600s), SEC-3 (`trust proxy`=1), SEC-5 (fail-OPEN signup/reset-request; fail-CLOSED-SOFT signin/reset-confirm, 4 paths tested). Consistent with security-auditor obligations. MATCH.
3. **B-6 defect-fixes consistent, no drift** — DEFECT-1 journaled migration (journal idx 19 + snapshot + drizzle-kit check clean), DEFECT-2 real-DB SEC-1-DB test, DEFECT-3 `ensureBodyParsed` email-keying + SEC-4-DB test; 4 P2s (body-cap 100KB + slow-loris timeout, unref'd sweeper w/ single-interval guard, `isConnectionError` fail-open narrowing, corrected signup-per-IP comment). All match spec, none introduce scope creep. MATCH.
4. **No live-auth regression** — SEC-11 VERIFY-only (no hand-rolled CSRF); DEFECT-3 preserves SuperTokens body-parse (stream consumed once, non-empty object reuse); invite-only + rid anti-csrf + session model untouched; 983 pass / 0 fail. Consistent w/ wave-2/5 auth decisions. MATCH.
5. **M10-hardening-not-recordkeeping** — wave scope is auth robustness only; NO M10 recordkeeping-artifact progress claimed. Consistent with wave-23/24 disposition (2nd M10 hardening wave). MATCH.
6. **_TBD metrics + wave-26 tripwire flagged** — P-2 FLAGS carry "wave-26 tripwire (M10 recordkeeping-decomposition); M9+M10 _TBD polls DUE"; T-9 routes recordkeeping-decomposition → N-block + wave-26 tripwire (INFO). Spec-gap correctly deferred to next wave, not silently dropped. MATCH.

## Non-blocking (already surfaced to V-2 by T-9 — coverage-thinness, NOT spec drift)
- **F1 SEC-3 forged-XFF:** the "forged XFF gets no fresh bucket" T-8 assertion is unit-only (keys on resolved `req.ip`); no live multi-hop-XFF integration probe. Config present, prod smoke keyed correctly. Recommend a forged-XFF integration probe in a future auth wave.
- **F2 SEC-11 live rid-401:** the "logout without rid → 401" runtime behavior is static-only (config `VIA_CUSTOM_HEADER` + `@UseGuards(SessionGuard)` asserted); live probe deferred to a SuperTokens-Core harness. Standard web control, not a crown-jewel invariant. Acceptable for this rate-limit+validation wave.

Both are thin-coverage on the *T-8 test line* of their SEC obligation (spec intent met via static assertion + prod smoke + vendored guarantee); neither is a live bypass, missing feature, or drift. No re-work required at V-1.

## Result line
**APPROVE — 6/6 checks MATCH; 11/11 SEC obligations delivered as specified; 0 DRIFTS. Two coverage-thinness spots (SEC-3 forged-XFF integration, SEC-11 live rid-401) already surfaced to V-2, non-blocking, non-crown-jewel. No conflicting prior decision.**

- verdict_complete: true
- next_action: PROCEED (V-2 triage of the 2 non-blocking findings)
