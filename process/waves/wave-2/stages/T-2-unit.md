# Wave 2 — T-2 Unit (Pattern A, CI-verified)
- CI `test` job green on the merged commits (postgres:18 service). 78→ tests across the wave: api auth.service.spec (invite-only reject-before-Core, reset existing/unknown parity even when token creation throws, signup DB-error→4xx, unexpected-error rethrow), auth.di-boot.spec (design:paramtypes + TestingModule compile), auth.bootstrap-order.spec (getAllCORSHeaders after init), supertokens.env.spec (no-alias assertion); web RTL 50 (login/accept-invite/reset/dashboard incl. cookie-forwarding + redirect-on-401 + no-enumeration error rendering).
- Coverage adequate: every auth service branch + the two boot regressions + the DI-metadata regression have real behavioral assertions (not decorative). Real Postgres at integration (T-4), no DB mocking there.
```yaml
test_pattern: ci-verified
skipped: false
evidence: ["CI test job green (final merges); api unit + web RTL"]
modules_audited: ["auth.service","auth DI boot","bootstrap ordering","supertokens.env","web auth pages"]
new_flakes: []
findings: []
```
