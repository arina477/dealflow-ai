# Wave 7 — T-8 Security (Pattern B, active — T-8-LITE; page + connection-create, no user-auth/PII)
## Scope: reuse-heavy page + a connection-create endpoint (external-party config, not user auth/payments) → T-8-LITE.
## Action 1 — Auth: /sourcing + /sourcing/connections use the wave-3 RBAC guard (DB-authoritative). Connection-create actor = app users.id via getUserWithRole (NOT raw ST id — wave-5 lesson).
## Action 2 — CSRF: connection-create + sync mutations via apiFetch (rid — wave-5 VIA_CUSTOM_HEADER) + same-origin /sourcing proxy. GET reads exempt.
## Action 3 — Connection-create: providerKey VALIDATED against adapter registry (400 unknown — no un-syncable connections); dup display_name → 409 (UNIQUE 0005); config jsonb non-secret; AUDITED in-tx (sourcing-connection-create, rollback-on-fail — LIVE entriesChecked 38→40). No provider SECRET stored in-DB (adapter resolves process.env[providerKey]; fixture needs none; real provider deferred).
## Action 4 — RBAC (LIVE C-2): analyst 200/201 on /sourcing/*; advisor/compliance 403; anon 401. /sourcing page analyst-only; connection API analyst/admin (admin config authority).
## Action 5 — Secret grep (wave-7 diff): CLEAN. Search server-side parameterized (no injection). No PII leak.
## Triage: no critical. B-6 (badges + providerKey) + C-2 (0005-journal + DrizzleQueryError-409) all fixed + LIVE-confirmed. No new blocking.
```yaml
test_pattern: active
mode: t8-lite
skipped: false
applicable_probes: [auth, csrf, connection_create_rbac_audit_actor, providerKey_validation, secret_handling, secret_grep]
secret_grep_findings: []
findings: []
```
