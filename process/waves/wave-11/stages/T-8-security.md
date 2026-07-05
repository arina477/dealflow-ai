# Wave 11 — T-8 security (active) — wave_type includes auth (RBAC/SoD/compliance/audit/sessions)
applicable_probes: [auth_smoke(RBAC), csrf/origin, session, rate_limit(n/a-new-endpoints), secret_grep]
## Results
- **secret_grep (ALWAYS): CLEAN** — git diff 124b699..af5b5d9 over *.ts/tsx/sql/env/yml → ZERO credential/token/secret matches.
- **RBAC/auth-smoke (LIVE):** anon → 401 on POST /outreach + .../approve + .../reject + .../request-approval + GET /outreach-templates + /outreach-templates/pending (all protected). Authed (C-2): POST /outreach analyst 403 + compliance 403 (advisor-only write), advisor passes (400 Zod). compose SoD + approve compliance-only proven structurally in CI (outreach.spec + e2e).
- **CSRF/origin (LIVE):** SuperTokens antiCsrf VIA_CUSTOM_HEADER — POST requires `rid: anti-csrf` header; without it → 401 (CSRF barrier enforced, confirmed C-2). CORS allowlist: foreign Origin (evil.example.com) on OPTIONS /outreach → server reflects ONLY the allowlisted web origin (NOT the foreign origin) + allow-credentials true → cross-origin credentialed read browser-blocked. Foreign-origin POST w/ fake cookie → 401.
- **session:** SuperTokens session cookies (HttpOnly/Secure/SameSite) — attribute inspection + rotation-on-login not freshly captured this wave (unchanged auth backbone from wave-2; no session-lifecycle code touched by wave-11). Auth boundary files NOT modified by wave-11 (outreach module only) → session hardening is inherited, not re-probed.
## Findings
```yaml
test_pattern: active
skipped: false
auto_promoted: false
applicable_probes: [auth_smoke, csrf, session, secret_grep]
secret_grep_findings: []
findings:
  - {severity: LOW, category: session, description: "cookie-attribute + rotation not freshly captured on deployed prod (auth backbone unchanged by wave-11; inherited from wave-2 verification)"}
```
