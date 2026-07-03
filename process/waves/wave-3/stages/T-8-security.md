# Wave 3 — T-8 Security (Pattern B, active — MANDATORY, RBAC auth-adjacent)
## Action 1 — Auth smoke: login works (C-2: OK / WRONG_CREDENTIALS); session cookie first-party HttpOnly+Secure+SameSite=Lax (wave-2, unchanged); /auth/me authed 200/anon 401.
## Action 2 — CSRF/origin: SameSite=Lax cookies (wave-2); web same-origin proxy. Unchanged this wave.
## Action 3 — Session: unchanged from wave-2 (SuperTokens rotation). RBAC role now read DB-authoritative in the guard (not just claim) — closes the stale-privilege window (B-6 fix).
## Action 4 — RBAC ENFORCEMENT (the wave's security surface) — LIVE-VERIFIED at C-2:
- compliance-role → /compliance/summary 200; advisor-role → 403 (deny, no leak); unauth → 401. Enforcement correct BOTH directions.
- Fail-closed on empty @Roles (guard throws + boot assertion); allowlist opt-in (/auth/*,/health ungated — login not broken); role from server-verified session re-verified against app-DB. Rate-limit gap (wave-2 finding) still tracked in task 6fe232e3.
## Action 5 — Secret grep (wave-3 diff): CLEAN — zero hardcoded credentials.
## Triage: no critical (no bypass/enumeration/leak; RBAC enforces correctly). No new blocking findings.
```yaml
test_pattern: active
skipped: false
applicable_probes: [auth_smoke, csrf, session, rbac_enforcement, secret_grep]
rbac_matrix: {compliance: 200, advisor: 403, unauth: 401}  # live-verified C-2
secret_grep_findings: []
findings:
  - {severity: low, category: rbac, description: "RBAC guard does 1 DB read/guarded-request (accepted; correctness over micro-perf)"}
```
