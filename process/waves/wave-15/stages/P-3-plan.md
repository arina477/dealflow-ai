# Wave 15 — P-3 Plan (multi-spec: M7 admin vertical — user-mgmt + settings + data-source + shell polish)

## Approach
### Action 1 — Architecture deltas
- **New module apps/api/src/modules/admin/** (or per-concern: user-admin / workspace-settings / data-source-admin — decide at B-1; likely one admin module with 3 services). Reuses M1 RolesGuard/getUserWithRole/invites + M2 AuditService + M3 data_source_connections + M4 mandate_compliance_profile.
  - **UserManagementService** — inviteAsActor (reuse invites table + invite-only flow), assignRoleAsActor, deactivateAsActor. **RACE-SAFE last-admin guard (security-auditor Inv-1 fix):** every admin-set mutation tx (deactivate + demote + self-deactivate/self-demote) opens with **`pg_advisory_xact_lock(<constant admin-guard key>)` as PRIMARY** (serializes the WHOLE admin set) then counts active admins → reject if it would drop to 0. **NOT `count(*) FOR UPDATE`** — that locks the returned rows not a count, permitting WRITE-SKEW (two txns demoting DIFFERENT admins lock disjoint rows → zero admins). Block self-deactivate/self-demote of the last admin outright. 409 on the blocked one. Concurrency-tested (two concurrent deactivate-different-last-two → exactly one succeeds). Audit last-in-txn.
    - *Alt:* a DB CHECK/trigger enforcing ≥1 admin — REJECTED (hard to express "≥1 active admin" as a table CHECK; the advisory-lock-on-constant + count is the standard + testable + write-skew-safe form).
  - **Audit actions (security-auditor Inv-6 fix):** the 5 admin actions (user-invite, role-change, deactivate, workspace-settings-update, data-source-conn-upsert) + enable/disable-toggle MUST be added to the CLOSED shared auditActionEnum (additive) at B-1 — else AuditService.append fails auditEntryInputSchema at runtime. Audit invite-CREATE (privilege-granting) + enable/disable-toggle too.
  - **WorkspaceSettingsService** — firm-profile CRUD + default-compliance-profile cascade (writes the firm-level defaults the M4 mandate_compliance_profile inherits; no retroactive mutate of existing mandates). Audited.
  - **DataSourceAdminService** — CRUD/enable-toggle over the M3 data_source_connections store + credential encryption. **Encryption (security-auditor Inv-2/5 fixes):** AES-256-GCM (node crypto): **random IV per encryption [crypto.randomBytes(12), NEVER reused] + auth-tag stored AND verified on decrypt**; key = self-generated env var CREDENTIALS_ENC_KEY (crypto.randomBytes(32), NOT committed, rule 6); **store a key-id/version prefix on the ciphertext (reserves future rotation).** Encrypt BEFORE store; the read path NEVER returns the plaintext (masked/omitted). **CREDENTIAL-NEVER-LEAKS: do NOT hash the credential into contentHash/payloadHash (brute-forceable); REDACT it before ANY error is constructed or logged (DrizzleError echoing INSERT params / Zod error echoing input / stack trace could leak — strip in the service + the Nest exception filter must not serialize request bodies with the credential).** No live connection-test. **Documented MVP limitation: key-loss = permanent credential-loss; single-key = no rotation without re-encrypt.**
- **Controllers:** AdminUsersController + WorkspaceSettingsController + DataSourceAdminController (or one AdminController). @Roles(admin) (+ compliance for the compliance-profile part if decided); route-ordering; audited.
- **Web:** admin-users + admin-workspace-settings + admin-integrations pages (SSR per the design/admin-*.html mockups) + AppShell placeholder pages + TopBar title fix. /admin/*-data proxies; apiFetch rid; the credential form input is write-only (never pre-filled with the secret).
- **BOUNDARIES:** additive migration 0013; NO live-connection-test / email-domain-verify / invite-email-send / DKIM (deferred #331/#141); NO LLM. Reuse only.

### Action 2 — Data model (migration 0013, additive)
- users.deactivated_at (nullable timestamptz).
- workspace_settings table (single-row-per-firm: firm profile fields + default_jurisdiction + default_disclaimer_template_id FK->disclaimer_templates + default_suppression_scope).
- data_source_connections.encrypted_credentials (text/bytea — the AES-GCM ciphertext + iv + tag; NEVER the plaintext).
- Additive; NO destructive alter. drizzle-kit generate 0013 → **journal when > 0012 (BUILD rule 4 — REGISTER IT; the wave-14 Ghost-Green lesson)** + .down.sql + meta snapshot.

### Action 3 — API contracts
- GET /admin/users; POST /admin/users/invite; PATCH /admin/users/:id/role; POST /admin/users/:id/deactivate — admin; audited; 400/401/403/409.
- GET/PUT /admin/workspace-settings — admin; audited.
- GET /admin/integrations; POST/PATCH /admin/integrations/:id (upsert + enable/disable + credential) — admin; audited; the read NEVER returns the credential.
- Errors → Nest exceptions; DrizzleError.cause.code unwrap; read-passthrough.

### Action 4 — Dependencies
NONE new (node crypto is built-in). NEW ENV VAR: CREDENTIALS_ENC_KEY (self-generated at B-0 via openssl/crypto.randomBytes; set in .env + the deploy platform env; NEVER committed — rule 2/6). NO SDK/vendor-key (deferred).

## Plan (file-level)
**B-0 Schema** (backend-developer): migration 0013 (users.deactivated_at + workspace_settings + data_source_connections.encrypted_credentials) — additive, JOURNALED (register idx 13, when>0012, snapshot — the wave-14 Ghost-Green lesson) + .down. + generate CREDENTIALS_ENC_KEY env var (.env.example placeholder + real value in .env/deploy env, not committed). **RECONCILE the M3 sourcing.ts "no column named secret/api_key/credential" assertion (security-auditor B-0): encrypted_credentials contradicts it — update the comment to clarify the two coexisting paths (env-var provider_key for adapters vs encrypted_credentials for the admin-entered form) so the B-6 no-secret-column grep + a future auditor aren't tripped.**
**B-1 Contracts** (backend-developer): shared/user-admin.ts + workspace-settings.ts + data-source-admin.ts (reads [NO credential in read] + inputs .strict()) + rbac (/admin/* admin) + NAV + **extend the CLOSED shared auditActionEnum (packages/shared/src/audit.ts) with the admin actions: user-invite, role-change, deactivate, workspace-settings-update, data-source-conn-upsert, data-source-conn-toggle (additive, serialization-order-preserved — else append fails at runtime; security-auditor Inv-6).**
**B-2 Backend** (backend-developer): admin module — UserManagementService (RACE-SAFE last-admin guard, invite/role/deactivate, audited) + WorkspaceSettingsService (cascade) + DataSourceAdminService (AES-GCM encrypt, credential-never-logged, no live test) + controllers + spec. Register. Reuse Auth/Audit/M3/M4 modules.
**B-3 Frontend** (nextjs-developer): 3 admin pages (per design/admin-*.html) + AppShell placeholders + TopBar title fix + the black-box RBAC role-reverify test; write-only credential input; /admin/*-data proxies.
**B-4/B-5/B-6:** head-builder polices RACE-SAFE-last-admin (concurrency test), CREDENTIAL-NEVER-LOGGED (grep audit/logs), SoD/WORM-audit, migration-0013-journaled (Ghost-Green), encryption-at-rest, RBAC.

### Action 6 — Specialists: backend-developer (B-0/B-1/B-2), nextjs-developer (B-3). All in AGENTS.md.
### Action 7 — Parallelization: B-0 → B-1 → B-2 (3 services, independently testable) → B-3 (3 pages + shell). The 3 admin verticals are independent within B-2/B-3.
### Action 8 — Self-consistency: CLEAN. Every AC → step. LOAD-BEARING: race-safe-last-admin (concurrency-tested), credential-never-logged (grep-tested), migration-0013-journaled. design_gap_flag false. security-scope-tightened at P-4.

```yaml
deps_new: []
schema_change: true   # migration 0013 (3 additive: users.deactivated_at + workspace_settings + data_source_connections.encrypted_credentials) — MUST be journaled (wave-14 Ghost-Green lesson)
new_secret: true      # CREDENTIALS_ENC_KEY (self-generated, not committed)
new_sdk: false
specialists: [backend-developer, nextjs-developer]
reuse: [M1 RolesGuard/getUserWithRole/invites, M2 AuditService, M3 data_source_connections, M4 mandate_compliance_profile, wave-3 AppShell, wave-5 apiFetch]
compliance_invariants: [race-safe-last-admin-guard (concurrency), credential-never-in-audit-or-logs (encrypted-at-rest), SoD-WORM-audit-last-in-txn, RBAC-admin, migration-0013-journaled]
hard_boundaries: "additive; NO live-connection-test/domain-verify/invite-email/DKIM/LLM (#141/#331 deferred); reuse only; CREDENTIALS_ENC_KEY self-generated not committed"
design_gap_flag: false
security_scope_tightened: true
self_consistency: clean
