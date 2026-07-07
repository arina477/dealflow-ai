# Wave 25 — P-0 Frame
## Discover
- wave_number 25, milestone M10 (in_progress). Seed 6fe232e3 (auth-hardening, oldest M10 debt/hardening candidate). SECURITY-SCOPE-TIGHTENED (touches auth/CSRF/rate-limits).
## Reframe
### problem-framer — REFRAME (3 corrections)
- **Item 1 (rate-limit) — causal fix SOUND, carry conditions to P-2/P-3:** add per-IP + per-account rate-limit on /auth/signin+signup+reset/request. CRITICAL: must use a SHARED store (Postgres — NO Redis in-stack) so it holds ACROSS REPLICAS (an in-memory per-instance limiter is bypassable by round-robining Railway instances + resets on deploy). Middleware ORDER: before the SuperTokens middleware(). Per-account (per-email) is the robust key (IP rotation defeats per-IP-alone). fail-open-vs-closed decided: on LIMIT-EXCEEDED → 429 (deny); on LIMITER-INTERNAL-ERROR → document (likely fail-open to not lock out the pilot, logged). Sane thresholds (don't lock out legit users).
- **Item 2 (missing inviteToken → 500) — WRONG-CAUSE in the seed:** the shared Zod ALREADY has `inviteToken: z.string().min(1)`. The real cause is NO global ZodValidationPipe wired in apps/api → a missing field reaches hashToken(undefined) → 500. FIX = WIRE the validation (a global ZodValidationPipe / the handler validates the DTO) so missing → clean 400. NOT a schema change.
- **Item 3 (logout anti-CSRF) — VERIFY not hand-roll:** SuperTokens already has anti-csrf VIA_CUSTOM_HEADER under the cookie model. FIX = VERIFY/confirm the existing check works on POST /auth/logout (+ a test), NOT a new hand-rolled CSRF that conflicts with the SuperTokens session model.
- SECURITY-SCOPE-TIGHTENED confirmed warranted (security-auditor Phase-2 + T-8 Security).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Correctly sized for a 0-external-user compliance-first pilot (rate-limit genuinely valuable pre-onboarding, not theater-if-built-right; no WAF/lockout over-build). Load-bearing conditions: rate-limit non-spoofable + SHARED-state across instances (not per-process reset-on-deploy); CONFIRM the wave-26 TRIPWIRE (this is the 2nd consecutive M10 hardening wave with zero recordkeeping-vertical progress → N-1 must BOARD-escalate before a 3rd); M9+M10 _TBD metrics DUE.
### mvp-thinner — OK
The 3 items are one coherent /auth/* bundle; the MEDIUM rate-limit is load-bearing, the 2 LOWs (500→400, logout-CSRF) not worth peeling. _TBD → no thinness trace. Flagged: auth-hardening sits oddly under SOX/FINRA M10 (→ the recordkeeping-decomposition tripwire).
### Disposition: PROCEED (with the REFRAME corrections)
Final framing → P-1/P-2/P-3:
1. **Rate-limit** /auth/signin+signup+reset/request: per-account (per-email) + per-IP, **Postgres shared store** (across-replica-safe, no Redis), middleware BEFORE SuperTokens middleware(), 429 on exceed, documented fail-open-on-limiter-error, sane thresholds, audit-logged where appropriate.
2. **Missing-inviteToken 500→400:** WIRE the validation (global ZodValidationPipe or DTO validation) — the schema already has inviteToken min(1); the fix is the missing pipe. No account created either way (already safe).
3. **Logout anti-CSRF:** VERIFY the existing SuperTokens VIA_CUSTOM_HEADER anti-csrf on POST /auth/logout (+ a test) — do NOT hand-roll.
## LOAD-BEARING (SECURITY-SCOPE-TIGHTENED — security-auditor Phase-2 + T-8 Security):
- rate-limiter ACTUALLY enforces (429 on exceed, verified) + SHARED across replicas (Postgres, not in-memory-per-instance) + non-spoofable per-account key + fail-open/closed decided + sane thresholds (no pilot lockout)
- 500→400 via wired validation (no regression to invite-only signup; no account created)
- logout anti-CSRF is the EXISTING SuperTokens check verified (not a conflicting hand-roll)
- NO regression to the invite-only signup / rid:anti-csrf session model; audit-logged where appropriate
## design_gap_flag: false (backend auth-hardening, no UI). D-skip.
## FLAGS (→ N-block/founder): wave-26 TRIPWIRE (M10 recordkeeping-decomposition — BOARD-escalate if a 3rd hardening seed w/o it); M9+M10 _TBD metric polls DUE.
claimed_task_ids: [6fe232e3-c639-4f6c-ad66-2889df8d9717]
