# Wave 15 — T-9 Journey (gate + journey regen)
**Gate:** APPROVED (head-tester, security-scope-tightened). verdict → blocks/T/gate-verdict.md. next_action: PROCEED_TO_V.
## Journey delta (M7 admin, now LIVE @f5455d6)
New admin-only surfaces (advisor 403 / anon 401):
- **/admin/users** — user list + invite (privilege-granting, audited) + role-change (audited) + deactivate (race-safe last-admin guard, 409). GET /admin/users, POST /admin/users/invite, PATCH /admin/users/:id/role, POST /admin/users/:id/deactivate.
- **/admin/settings** — firm workspace settings (default jurisdiction/disclaimer/suppression; singleton advisory-lock). GET/PUT /admin/workspace-settings.
- **/admin/integrations** — data-source connections + credential (AES-256-GCM at rest; write-only input; read never returns plaintext; hasCredential boolean). GET /admin/integrations, POST/PATCH /admin/integrations/:id.
- AppShell placeholders: /matches, /outreach. TopBar title fix (x-pathname).
## Security-invariant coverage (PROVEN — CI real-DB + C-2 live)
race-safe-last-admin (advisory-lock, CONC-1 real+fault-killing) | credential-never-leaks (SEC-1/2/3/4 + C-2 live sentinel) | CREDENTIALS_ENC_KEY set+working prod | RBAC admin-only DB-authoritative | audit last-in-txn WORM | migration-0013 additive live.
