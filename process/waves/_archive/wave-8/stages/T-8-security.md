# Wave 8 — T-8 Security (Pattern B, FULL — compliance-profile capture + audit + user-scoped writes)
## Scope: mandate create/configure = compliance-profile capture + M2 audit + RBAC + user-FK writes → FULL security stage (not lite). P-4 was security-scope-tightened.
## Action 1 — Auth/RBAC: /mandates read advisor/admin/analyst; create/configure + /mandates/jurisdictions advisor/admin (DB-authoritative RolesGuard, fail-closed, module-load @Roles assertion). LIVE (C-2): analyst POST 403, compliance POST 403, analyst GET 200, anon 401.
## Action 2 — Actor-id: created_by = app users.id via getUserWithRole (NOT raw SuperTokens id — wave-5 FK lesson). Regression-tested.
## Action 3 — Audit integrity: every mandate create/configure AUDITED (mandate-create/mandate-configure) LAST-IN-TXN via M2 AuditService (HMAC-SHA256 chain; rollback on audit-fail — one-txn atomicity). LIVE: chain verify ok (entriesChecked increased).
## Action 4 — CSRF: create/configure mutations via apiFetch rid (wave-5 VIA_CUSTOM_HEADER) + same-origin /mandates-data proxy (non-page-colliding — the C-2 route-collision fix). GET reads SSR/exempt.
## Action 5 — Compliance-capture integrity: disclaimer_template_id DERIVED server-side from jurisdiction (D2 — no client mass-assignment; create-input .strict() blocks smuggling); no-match→400 (no null-FK); AMBIGUOUS→409 + migration 0007 partial unique index disclaimer_templates(jurisdiction) WHERE active (defense-in-depth — one active per jurisdiction). 3 acknowledgments REQUIRED (D5, else 400) + persisted + audited. compliance CAPTURED-not-enforced (M6 enforces) — UI framed accordingly (no false-safety).
## Action 6 — State-machine: active mandate LOCKED (409 on edit + active→draft — B-6 fix). No illegal transition.
## Action 7 — Secret grep (wave-8 diff): CLEAN. No PII leak; mandate reads role-gated (single-firm model — no tenant isolation needed, karen-confirmed).
## Triage: no critical open. B-6 (3 CRIT: PATCH-crash/draft-lock/ambiguous-disclaimer) + C-2 (route-collision/jurisdiction/advisor-jurisdictions/create-response) all fixed + LIVE-confirmed. No new blocking.
```yaml
test_pattern: active
mode: full
skipped: false
applicable_probes: [auth_rbac, actor_id, audit_integrity, csrf, compliance_capture_integrity, disclaimer_derive_ambiguity, three_acks, state_machine_lock, secret_grep]
secret_grep_findings: []
findings: []
