# Wave 25 — P-2 Spec (pointer)
**Source of truth:** seed 6fe232e3 tasks.description + this contract (with the P-0 REFRAME corrections). single-spec. design_gap false, D-skip. SECURITY-SCOPE-TIGHTENED.
**claimed_task_ids:** [6fe232e3]
## AC (M10 auth-hardening):
1. **Rate-limiting** on /auth/signin+signup+reset/request: per-account (per-email) + per-IP, **Postgres SHARED store** (across-replica-safe — NOT in-memory-per-instance), middleware BEFORE SuperTokens middleware(), **429 (+Retry-After) on exceed** (proven by a test: N+1 attempts → 429), fail-OPEN on limiter-internal-error (documented; logged), sane thresholds (legit pilot NOT locked out — proven). 
2. **Missing-inviteToken 500→400:** WIRE the validation (global ZodValidationPipe / DTO validation — the shared Zod already has inviteToken min(1)); missing/empty → clean 400, no account created, no 500. No regression to other endpoints.
3. **Logout anti-CSRF:** the EXISTING SuperTokens VIA_CUSTOM_HEADER anti-csrf on POST /auth/logout is VERIFIED (a test: logout without the anti-csrf header/rid → rejected). No hand-rolled conflicting CSRF.
## Load-bearing (SECURITY-SCOPE-TIGHTENED): rate-limit-shared-store-across-replicas + enforces-429 + non-spoofable-per-account + fail-open-documented + no-pilot-lockout | 500→400-wired | logout-csrf-existing-verified | no-invite-only/session-regression. → P-4 security-auditor Phase-2 + T-8 Security stage. FLAGS: wave-26 tripwire (M10 recordkeeping-decomposition); M9+M10 _TBD polls DUE.
