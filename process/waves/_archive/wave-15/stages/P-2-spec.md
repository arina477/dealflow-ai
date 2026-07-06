# Wave 15 — P-2 Spec (pointer)
Authoritative = YAML head of 82ec8724's tasks.description. multi-spec, 4 blocks.
## claimed_task_ids: [82ec8724 (user-mgmt), 648a86a6 (workspace settings), 41c017f7 (data-source conn), d7f716b4 (AppShell polish)]
- **82ec8724:** migration 0013 users.deactivated_at; admin-users page + invite/assign-role/deactivate; **RACE-SAFE last-admin guard** (transactional/advisory-lock count — concurrent double can't leave zero admins); SoD; audited last-in-txn; RBAC admin.
- **648a86a6:** workspace_settings table + firm-profile CRUD + default-compliance-profile cascade (jurisdiction/disclaimer/suppression → M4 mandate inherits); audited.
- **41c017f7:** data_source_connections.encrypted_credentials; admin-integrations CRUD/enable-toggle over M3 store; credential form ENCRYPTED-AT-REST (self-gen key); **CREDENTIAL NEVER IN AUDIT/LOGS**; no live test.
- **d7f716b4:** placeholder pages for unbuilt nav + TopBar title fix + black-box RBAC DB-authoritative role-reverify (now testable via 82ec8724 role-change).
design_gap_flag false. Constraints: race-safe-last-admin, credential-never-logged, SoD/WORM-audit, security-scope-tightened, encryption-self-gen-key. Boundaries: additive (migration 0013); no live-test/domain-verify/invite-email/DKIM/LLM.
