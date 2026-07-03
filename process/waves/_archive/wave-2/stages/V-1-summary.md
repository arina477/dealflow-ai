# Wave 2 — V-1 Summary (orchestrator)

Independent reviews against the LIVE auth deployment (bc558f7). No shared context.

## Karen (source-claim) — APPROVE
7 findings; F2-F7 all TRUE (every load-bearing claim reproduced live @ bc558f7): auth module files exist; routes live (health 200 version bc558f7, /auth/invite 201, web-origin /auth/signin proxies to SuperTokens not Next-404, OPTIONS preflight 204+CORS); both browser-bug FIXES present + live (middleware-before-init; getTokenTransferMethod cookie + apiDomain=WEB_ORIGIN; next.config rewrite; **live signup → Set-Cookie sAccessToken HttpOnly Secure SameSite=Lax first-party on web origin**); migration ran (4 roles); env wired + SuperTokens Postgres isolated (boot assertion passed); 4 deploy fix-cycles honestly recorded. F1 LOW: 2 cosmetic path/naming nits (dto.ts not dto/, supertokens.env.ts) — non-blocking.

## jenny (spec-semantic) — APPROVE
drift 1 (low), gap 0. **FINDING-2 confirmed FIXED** — first-party same-origin cookie; authed /dashboard → 200 role-aware, no bounce to /login. no-user-enumeration holds on BOTH reset + login (generic). Role claim present + correct across all 4 roles. RBAC guard is primitive-only — NO per-route enforcement leaked (problem-framer guardrail honored). SSO/MFA/AppShell correctly deferred (not flagged). **1 LOW drift:** POST /auth/signup with MISSING inviteToken → 500 instead of a clean 4xx (input-validation edge; invalid input still rejected + no account created; no security impact).

## Combined
Both APPROVE. Auth is live + spec-conformant. No REJECT, no critical, no drift beyond 1 low input-validation edge. The real-browser E2E + these reviews confirm login genuinely works end-to-end.

```yaml
karen_verdict: APPROVE
karen_findings_count: 7
karen_false_positives_documented: 0
jenny_verdict: APPROVE
jenny_findings_count: 1
spec_drift_count: 1
spec_gap_count: 0
jenny_false_positives_documented: 0
findings:
  - {source: jenny, severity: low, type: spec-drift, item: "POST /auth/signup missing inviteToken → 500 not 4xx (input-validation edge)"}
  - {source: karen, severity: low, item: "cosmetic path/naming nits (dto.ts, supertokens.env.ts)"}
  - {source: T-8, severity: medium, item: "no rate-limiting on /auth/* (hardening)"}
  - {source: security-engineer, severity: low, item: "/auth/logout anti-CSRF under cookie transfer (follow-up; outside E2E path)"}
  - {source: T-1, severity: low, item: "as-unknown-as AuthRepository test-fixture cast"}
```
