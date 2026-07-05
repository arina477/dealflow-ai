# Wave 12 — T-8 security (active) — wave_type includes auth (RBAC + audit)
applicable_probes: [auth_smoke(RBAC), csrf/origin, session(inherited), secret_grep]
## Results
- **secret_grep (ALWAYS): CLEAN** — git diff 124b699..989fae9 over *.ts/tsx/sql → ZERO credential/token/secret matches.
- **RBAC/auth-smoke (LIVE, C-2):** anon → 401 on GET/POST /pipeline; analyst → 403 on enroll (advisor-only write); advisor → 200 read. Compliance role: read + notes (per rbac split). The write-vs-read RBAC split (/pipeline/:id/stage advisor-only vs /:id/notes advisor+compliance) is now regression-PINNED in the shared rbac.test matrix (M-1 rework — toEqual fails CI on role-widening).
- **CSRF/origin:** SuperTokens antiCsrf VIA_CUSTOM_HEADER (rid required on POST — the established wave-11 barrier; unchanged auth backbone). CORS allowlist enforced (wave-11 verified; unchanged).
- **Compliance-critical invariant (H-1 cross-mandate):** /review + the mandate-consistency fix ensure enroll rejects a source not belonging to the supplied mandate (400) — no false mandate association in the audit trail. Every mutation audited last-in-txn (proven CI e2e).
- **session:** SuperTokens cookies (HttpOnly/Secure/SameSite) — auth backbone UNCHANGED by wave-12 (pipeline module only; no session-lifecycle code touched) → inherited from wave-2.
## Findings
```yaml
test_pattern: active
skipped: false
applicable_probes: [auth_smoke, csrf, session, secret_grep]
secret_grep_findings: []
findings:
  - {severity: LOW, category: session, description: "cookie-attr/rotation not freshly probed (auth backbone unchanged by wave-12)"}
```
