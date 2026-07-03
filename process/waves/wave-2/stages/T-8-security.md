# Wave 2 — T-8 Security (Pattern B, active — MANDATORY auth wave)
Full probe set (wave_type includes auth). Probes against the LIVE deployed api.

## Action 1 — Auth smoke (positive + negative)
- Positive: invite→signup (valid) → 201 + session + role claim (C-2 + T-8 probe). Login path via SuperTokens EmailPassword sign-in.
- Negative: bogus invite → 400, no account; /auth/me no session → 401.

## Action 2 — CSRF / origin
- SuperTokens uses SameSite cookies + anti-CSRF. Fresh signup Set-Cookie attributes verified: **HttpOnly ✓, Secure ✓, SameSite=Lax ✓** (both stAccessToken + stRefreshToken). Foreign Origin POST → 400 (rejected). SameSite=Lax is the CSRF defense per SuperTokens design.

## Action 3 — Session
- Session cookies HttpOnly + Secure + SameSite=Lax. SuperTokens rotates access token on refresh (built-in refresh-token rotation with reuse detection per architecture/security.md). Logout revokes session.

## Action 4 — Rate limit — **FINDING (medium)**
- 8 rapid invalid signups → all 400, **no 429**. No application-level rate-limiting on /auth/* endpoints. Brute-force hardening gap on login/reset. Mitigations: invite-only signup (random 32-byte tokens make signup brute-force infeasible), 0 pilot users, SuperTokens has some built-in protections. NOT in this wave's acceptance criteria. → V-2 triage / future hardening slice.

## Action 5 — Secret grep — CLEAN
- Wave diff grep for credential literals: zero. Matches were env-var NAMES (.env.example placeholders: SUPERTOKENS_*, WEB_ORIGIN, INTERNAL_API_BASE_URL), schema column names, and imports — no secret VALUES committed. The SuperTokens API key + session secrets live only in Railway env (rotated to hex at C-2 after the base64-'+' Core-reject defect).

## Triage
No critical (no auth bypass / session hijack / secret leak). Rate-limit gap = medium → V-2.
```yaml
test_pattern: active
skipped: false
auto_promoted: false
applicable_probes: [auth_smoke, csrf, session, rate_limit, secret_grep]
auth_smoke: {positive: ["invite+signup 201 +session +role claim","/auth/me 200 authed"], negative: ["bogus invite 400","no-session /auth/me 401"]}
csrf_results: ["cookies HttpOnly+Secure+SameSite=Lax","foreign-origin POST 400"]
session_results: ["HttpOnly+Secure+SameSite=Lax","SuperTokens refresh rotation + reuse detection (architecture)","logout revokes"]
rate_limit_results: ["8 invalid signups all 400, NO 429 — no app-level rate limit (medium finding)"]
secret_grep_findings: []
fix_up_cycles: 0
findings:
  - {severity: medium, category: rate-limit, description: "no rate-limiting on /auth/* (brute-force hardening gap; mitigated by invite-only + 0 users)", remediation: "add rate-limit middleware on login/signup/reset in a hardening slice"}
```
