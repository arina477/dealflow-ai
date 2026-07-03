# Wave 2 — T-3 Contract (Pattern A, CI-verified)
- Contract surface: @dealflow/shared auth Zod (roleEnum + signup/login/reset/invite/me schemas, .strict(), no-enumeration reset shape). Internal contracts → Pattern A. supertokens-node is an external SDK but consumed server-side; its live behavior verified at C-2 (real Core handshake, CDI 5.4).
- Coverage: shared schema unit tests; server emits → live /auth/me at C-2 returned {userId,email,role} conforming to meResponse; client consumes → TS strict enforces (typecheck green); live /auth/signup 201 body conforms to signupResponse.
- No drift: DB source-of-truth spec matches; SDK method surface verified real by karen at P-4 (unpacked tarball).
```yaml
test_pattern: ci-verified
skipped: false
contracts_audited: ["roleEnum","signup/login/reset/invite/me"]
ci_evidence: ["shared schema tests green","C-2 live /auth/me + /auth/signup bodies conform"]
active_probe_results: ["C-2 live SuperTokens Core handshake OK (CDI 5.4)"]
findings: []
```
