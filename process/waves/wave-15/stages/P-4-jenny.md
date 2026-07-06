# Wave 15 — P-4 Phase 2 jenny drift-check (M7 admin, security-scope-tightened)

Verdict: **APPROVE** (all items MATCH). No drifts.

Per-item:

1. **User-management (82ec8724): MATCH.** invite/assign-role/deactivate + race-safe last-admin guard (transactional FOR UPDATE / advisory-lock count) + SoD → M7 metric "invite users and assign roles" + #331(1) "user-management/RBAC" + F14 (Manage users & roles). Invite RECORD only (mint hashed single-consume token, NO email send) matches #340 ("does NOT email — surfaces not-yet-emailed state honestly") + #343 (invite EMAIL delivery #141-gated) + #331 credential-seam. RBAC admin-only / 403 / 401; audit last-in-txn WORM. Reuses wave-2 invites table (not re-created). Migration 0013 users.deactivated_at additive.

2. **Workspace settings (648a86a6): MATCH.** firm profile + default-compliance-profile selector cascading firm-level defaults into M4 mandate_compliance_profile → M7 metric "firm profile, default compliance profile" + #331(1) + F15. Cascade = firm DEFAULT new mandates inherit; "existing unaffected (no retroactive mutate)" is explicit in AC + edge-cases. Consistent with M4 design (#240: mandate_compliance_profile = jurisdiction + disclaimer template FK→M2 disclaimer_templates + suppression scope, captured-per-mandate; enforcement later). Selector validated against existing M2 rows (cannot pick non-existent template). Sending-identity shown as not-yet-available placeholder (no dead Verify/Send) per #331(3). Migration 0013 workspace_settings additive.

3. **Data-source conn (41c017f7): MATCH.** admin CRUD/enable-toggle over the SHIPPED M3 data_source_connections store (NOT a new store) + encrypted-at-rest credential FORM (AES-256-GCM, self-generated CREDENTIALS_ENC_KEY) + NO live test → #331(1) "credential-management FORM UI + encrypted-at-rest" + F13 (admin integrations). Credential-never-in-audit-row/logs load-bearing invariant matches #340 ("never in the audit row") + #343. Live-connection-TEST correctly deferred (external source credential, #343 M7 credential-seamed remainder). Masked "set" state, never echoed. Migration 0013 data_source_connections.encrypted_credentials additive.

4. **AppShell polish (d7f716b4): MATCH.** placeholders for unbuilt role-nav (Team/Settings) + TopBar title fix + RBAC DB-authoritative live re-verify → carry-forward #340 (re-parented sibling; admin-users/admin-workspace-settings pages replace the Team/Settings placeholders; seed's live role-mutation flow = the path for the RBAC black-box re-verify closing the wave-3 jenny gap). No AppShell design drift (reuses wave-3 AppShell + wave-5 apiFetch).

5. **Deferrals honored: MATCH.** No live-test / domain-verify / invite-email / DKIM/SPF/DMARC / LLM anywhere (hard boundaries in P-0 + all 3 specs + #331/#141/#343). CREDENTIALS_ENC_KEY self-generated (rule 6), not a founder credential (#342 confirms ZERO founder credential needed).

6. **No contradiction with prior decision / journey: MATCH.** All 3 admin pages (admin-users #58/#59, admin-integrations #57, admin-workspace-settings #59/#60) are designed+approved screens per #80; F13/F14/F15 journey rows 18-20 map exactly — no duplicated surface. Role model (Advisor/Analyst/Compliance/Admin) consistent with M1 wave-3 RBAC (roleRoutes single source of truth). Additive schema throughout (no destructive alter, migration 0013 journaled per Ghost-Green lesson).
