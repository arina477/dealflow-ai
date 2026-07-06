# Wave 15 — P-4 Phase-2 Karen claim-verification (M7 admin, security-scope-tightened)

Verdict: **APPROVE** — all 10 load-bearing claims VERIFIED against real code. No fake reuse, no phantom tables.

| # | Claim | Result | Evidence |
|---|---|---|---|
| 1 | users+roles+admin role exist; role model | VERIFIED | `apps/api/src/db/schema/users-roles.ts:41` roles(name), `:47` users.role_id FK→roles.id (onDelete restrict). Role NAMES are string values (NOT enum): migration `0001_serious_junta.sql:37,43` seeds advisor/analyst/compliance/admin. `'admin'` IS a role.name value → last-admin guard counts `WHERE role_id=(admin) AND deactivated_at IS NULL`. |
| 2 | invites table + invite-only flow | VERIFIED | `users-roles.ts:74` invites table (token/email/roleId/expiry/consumedAt). `auth.service.ts:77 createInvite` INSERTs invite (crypto-random token, hashed at rest); `:114` invite-bound signup w/ FOR UPDATE re-validate. Real reuse target for inviteAsActor. |
| 3 | M2 AuditService.append(input, tx) last-in-txn | VERIFIED | `audit.service.ts:75 async append(input: AuditEntryInput, tx: Tx)` — required tx handle, composes into caller txn. appendStandalone also present. |
| 4 | getUserWithRole → users.id + RolesGuard DB-authoritative | VERIFIED | `auth.repository.ts:154 getUserWithRole` returns `{id: users.id, roleName}` via innerJoin roles. `guards/roles.guard.ts:81 canActivate` → `:116 resolveRoleBySupertokensUserId` re-resolves role from DB per request (B-6 CRITICAL-1 fix, explicitly authorizes off DB not claim). Grounds the d7f716b4 black-box role-reverify test. |
| 5 | M3 data_source_connections in sourcing.ts; column-add is additive | VERIFIED | `sourcing.ts` table #1 data_source_connections (wave-6, shipped). Adding encrypted_credentials is additive (column not present today — grep empty). NOTE: existing secrets convention stores env-var NAME (provider_key), not secret; new encrypted_credentials adds actual ciphertext-at-rest — coherent, no conflict. |
| 6 | M4 mandate_compliance_profile exists (cascade target) | VERIFIED | `mandate.ts:217 mandateComplianceProfile` table 'mandate_compliance_profile', 1:1 UNIQUE on mandate_id (`:270`), jurisdiction+disclaimer_template_id FK+suppression. Real inherit target. |
| 7 | Migration head 0012 → new is 0013; journal-register grounded | VERIFIED | `meta/_journal.json` has 13 entries, latest idx=12 (`0012_audit_mandate_id`). New migration is 0013. Plan's Ghost-Green journal-register requirement (BUILD rule 4) correctly grounded. |
| 8 | 3 design/admin-*.html exist (design_gap_flag false) | VERIFIED | admin-users.html / admin-workspace-settings.html / admin-integrations.html all present (~41-46KB each). |
| 9 | Specialists in AGENTS.md | VERIFIED | backend-developer (AGENTS.md:70) + nextjs-developer (AGENTS.md:91) both present + in .capability-sheet.md (:26, :125). |
| 10 | Antipattern sweep | CLEAN | Race-safe last-admin guard EXPRESSIBLE: roles is a real table, admin is a queryable role.name value, users.role_id is FK, deactivated_at is new nullable col — `SELECT count(*) ... FOR UPDATE` / pg_advisory_xact_lock all valid vs this schema. AES-256-GCM w/ self-gen key COHERENT (node crypto built-in, deps_new:[], CREDENTIALS_ENC_KEY env per rule 6). No fake reuse — invites/mandate_compliance_profile/data_source_connections/AuditService.append all real. New cols (deactivated_at, workspace_settings, encrypted_credentials) confirmed absent = genuinely additive. |

Minor (non-blocking) notes for B:
- Guard re-verify path uses `resolveRoleBySupertokensUserId` (roles.guard.ts:116); getUserWithRole is the actor-id path. Both real; B-2 should use getUserWithRole for actor-id in audit rows (spec/plan already say this).
- Existing invite flow attributes `invitedBy: null` (auth.service.ts:91, "admin-only attribution a later slice"). inviteAsActor should now set invitedBy = actor users.id — this is net-new work the plan covers (inviteAsActor), not a reuse gap.
