# Wave 15 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | LOW | B-6/L1 | last-admin guard over-strict on an already-deactivated admin (harmless fail-closed 409). Optional short-circuit. |
| 2 | LOW | B-6/L2 | data-source config blob (non-secret by contract) could hold a secret if an admin pastes one (config IS returned + persisted plaintext). Doc note. |
| 3 | INFO | ops | CREDENTIALS_ENC_KEY is a NEW prod env var (set at C-2); key-loss=credential-loss + no-rotation-in-MVP (documented in .env.example + audit-mandate-attribution-style doc). |
## Security substance — PROVEN:
- Race-safe write-skew last-admin guard (advisory-lock): CI CONC-1 REAL (2 concurrent last-admin deactivations → exactly one, ≥1 admin remains).
- Credential-never-leaks (encrypted, not in audit/hash/error/read): CI SEC-1/2/3/4 + C-2 live credential-never-returned (sentinel).
- CREDENTIALS_ENC_KEY set + working in prod (201 not 500): C-2 live.
- RBAC admin-only (advisor 403, anon 401) + DB-authoritative + role-reverify: C-2 live + rbac-role-reverify test.
- Migration 0013 additive live; auditActionEnum extended.
findings_total: 3 (0 critical, 0 high, 0 medium, 2 low, 1 info)
