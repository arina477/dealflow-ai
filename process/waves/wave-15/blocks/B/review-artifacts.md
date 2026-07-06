# Wave 15 — B-block review artifacts
**Wave topic:** M7 admin (user-mgmt + workspace settings + data-source conn + shell polish)
**Block exit gate:** B-6
**Status:** in-progress
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | in-progress | branch wave-15-m7-admin; migration 0013 (users.deactivated_at + workspace_settings + data_source_connections.encrypted_credentials JOURNALED) + CREDENTIALS_ENC_KEY + M3-reconcile |
| B-1 | done | shared admin schemas (no-credential-read) + auditActionEnum +6 + rbac (9736d1d) |
| B-2 | done | advisory-lock last-admin (write-skew-safe) + AES-GCM credential (IV/tag/redact/no-hash/key-id) + SoD/WORM + CONC/SEC tests (3004a3f) |
| B-3 | done | 3 admin pages (credential write-only) + shell placeholders + TopBar + RBAC-reverify (670ecc0) |
| B-4 | done | repo typecheck+build PASS |
| B-5 | done | lint 0, full test green (~1858), build pass |
| B-6 | stages/B-6-review.md | pending | head-builder gate + /review |
## Context (P-4 security build-notes — LOAD-BEARING)
- RACE-SAFE last-admin: pg_advisory_xact_lock(<constant>) PRIMARY (NOT count-FOR-UPDATE=write-skew); deactivate+demote+self-deactivate; concurrency-tested.
- auditActionEnum: extend CLOSED shared enum (5 admin actions + toggle) or append fails at runtime; audit invite-CREATE + toggle.
- Credential: AES-256-GCM random-IV-per-encrypt + tag-verify + key-id-prefix; REDACT before any error/log; NO credential in contentHash/payloadHash; read never returns it; key CREDENTIALS_ENC_KEY (self-gen, not committed).
- migration 0013 JOURNALED (idx 13, when>0012, snapshot — wave-14 Ghost-Green lesson).
- B-0: reconcile M3 sourcing.ts "no secret column" assertion (encrypted_credentials coexists with env-var provider_key).
- Reuse: M1 RolesGuard/getUserWithRole/invites, M2 AuditService, M3 data_source_connections, M4 mandate_compliance_profile.
