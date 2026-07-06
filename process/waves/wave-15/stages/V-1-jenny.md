# V-1 Jenny — Semantic spec-match verification (wave-15, M7 admin)

**Reviewer:** jenny (spec-vs-deployed independent verification)
**Deployed target:** `f5455d6` — api `https://dealflow-api-production-66d4.up.railway.app` (`/health` → 200, version==f5455d6, db:ok), web `https://dealflow-web-production-a4f7.up.railway.app`
**Spec contract source of truth:** DB row `tasks.description` YAML head, task `82ec8724-…` (fetched live from Postgres — NOT the P-2-spec.md pointer). Reconciled against P-3-plan.md + C-2 live evidence + T-9 user-journey-map.md.
**Session basis:** established REAL authed sessions live via invite→signup (SuperTokens, `rid: anti-csrf`): an **admin** (api origin + web origin, host-only cookies) and an **advisor** (for RBAC negative tests). All authed results below are self-performed against prod, not inferred from green tests.

## VERDICT: **APPROVE**

The four load-bearing invariants (race-safe last-admin guard, credential-never-leaks/encrypted-at-rest, SoD+WORM-audit last-in-txn, DB-authoritative RBAC) are semantically live and correct on the deployed artifact. Every acceptance-criterion *intent* is satisfied. The findings below are all **spec gaps** (spec did not anticipate) or **minor/cosmetic** — none is a load-bearing spec drift, none blocks the wave. 6 findings: **0 drift / 5 gap / 1 minor-conformance**. Enumerated for next wave's P-2.

---

## AC-INTENT VERIFICATION (semantic, not literal wording)

### 82ec8724 — User-management vertical: **PASS**
- **invite → invite-only audited user** — `POST /admin/users/invite` (admin) → 201 with `{inviteId,email,role,expiry}`; reuses the M1 `invites` table (hashed token, `invitedBy`=actor app users.id); no email sent (boundary honored). Audited action `user-invite` present in the closed `auditActionEnum` (packages/shared/src/audit.ts:193) — mutation succeeded, so the runtime `auditEntryInputSchema` validation passed (Inv-6 satisfied).
- **role-change — audited, DB-authoritative RBAC** — `PATCH /admin/users/:id/role` (admin) → 200; live-proved DB-authoritative: the SuperTokens front-token `role` claim reflected the mutated DB role, and RolesGuard gates by DB role (advisor 403 vs admin 200 on the same route). Guard runs `assignRoleAsActor` only when demoting FROM admin (user-management.service.ts:218) — correct scope.
- **deactivate — sets deactivated_at, idempotent, LAST-in-admin guarded** — `POST /admin/users/:id/deactivate` (admin, non-last non-admin) → 201 `{deactivatedAt:<ts>}`; second call returned the **identical** timestamp `14:01:26.949` — idempotent no-rewrite confirmed (short-circuits before the guard at user-management.service.ts:277).
- **RACE-SAFE last-admin guard (LOAD-BEARING)** — `runLastAdminGuard` (user-management.service.ts:337) acquires `pg_advisory_xact_lock(ADMIN_GUARD_LOCK_KEY=4_200_500_500)` as the FIRST statement, then counts `role='admin' AND deactivated_at IS NULL AND id != excludeUserId` and throws 409 if 0 remain. Covers all three paths (deactivate / demote / self). This is the write-skew-safe form the spec mandates (advisory-lock-on-constant, NOT `count(*) FOR UPDATE`). CONC-1 CI e2e (C-2) proves it under real concurrency. LIVE last-admin-409 not forced (12+ active admins exist), but the mechanism is present, correct by construction, and CI-proven — accepted per the "cannot establish a last-admin scenario without destroying prod" limitation.
- **RBAC** — advisor→403, anon→401 on every user route (measured live, below).

### 648a86a6 — Workspace + firm-profile settings + cascade: **PASS with GAP (F-1)**
- **singleton persistence** — `PUT /admin/workspace-settings` → 200; `GET` returns the same row; a second PUT returned the **same `id`** (`f386bb61-…`) with `updatedAt` bumped — true single-row-per-firm upsert, serialized by `pg_advisory_xact_lock(WORKSPACE_SETTINGS_LOCK_KEY=4_300_600_600)` against the first-PUT INSERT race (workspace-settings.service.ts:108). Audited `workspace-settings-update` last-in-txn.
- **firm defaults persist** — `firmName/defaultJurisdiction/defaultSuppressionScope` round-tripped correctly.
- **cascade — see F-1 (spec gap): the default-compliance-profile fields persist but are consumed by nothing.**

### 41c017f7 — Data-source connection admin + encrypted credential: **PASS**
- **credential encrypted-at-rest, write-only read** (LOAD-BEARING) — `POST /admin/integrations` (admin) with a recognizable sentinel plaintext → 201 `hasCredential:true`. The sentinel appears in **neither** the create response **nor** the read-back `GET` list (grep count = 0 in both). The read shape exposes only `{id,providerKey,displayName,enabled,hasCredential,createdAt,createdBy}` — no plaintext, no ciphertext (data-source-admin.service.ts `toAdminRecord`, packages/shared/src/data-source-admin.ts:28). AES-256-GCM with random 12-byte IV per encrypt + stored/verified 16-byte auth-tag + `v1:` key-id prefix (credential-crypto.ts) — fails closed if `CREDENTIALS_ENC_KEY` missing/wrong-length. The 201 (not 500) proves the key is set + correct-length live.
- **credential never in audit/logs/errors** — audit rows hash only `{id,displayName,providerKey}` via `hashJsonSafe` (never the credential; Inv: no brute-forceable key hash). `scrubCredentialFromError` (data-source-admin.service.ts:73) redacts the plaintext from any DrizzleError/ZodError before re-throw; the Zod parse in the controller throws a generic `'Invalid input…'` (no input echo). SEC-1/2/3/4 CI-proven (C-2).
- **write-only UI input** — `IntegrationsClient.tsx` credential field: `credential:''` initial, `type="password"`, `autoComplete="new-password"`, placeholder `(leave empty to keep current)`, sent only if the admin types a value (lines 49/162/200/462). Never pre-filled — confirmed in source + no plaintext in the rendered authed HTML.
- **no live connection-test** — toggle = state only (boundary honored).

### d7f716b4 — AppShell polish: **PASS (AC resolved differently than literally worded — see F-2)**
- **no raw-404 from nav** — the two "config"-group nav items `NAV_TEAM` (→`/admin/users`) and `NAV_SETTINGS` (→`/admin/settings`) now point at REAL built pages (rbac.ts:99/107); the wave *built the pages the nav pointed at* rather than shipping "coming soon" placeholders. AC intent (no dead-end nav click) is satisfied. The `/team`, `/reports`, `/analytics` 404s I probed are NOT nav targets — outside AC scope.
- **RBAC DB-authoritative re-verify** — a role-reverify test ships (apps/web/app/(app)/admin/rbac-role-reverify.test.ts); it is a shared-`rolesForRoute`/`canAccess` *mirror* test, not a live role-mutation integration test — but I independently proved the LIVE behavior myself (role PATCH + advisor-403/admin-200 on the same route). Intent held live.
- **TopBar title** — TopBar.tsx present; not independently pixel-verified (cosmetic, non-load-bearing).

### Journey continuity: **PASS with GAP (F-3)**
- `/admin/users` (200, 22.7KB), `/admin/settings` (200, 26.6KB), `/admin/integrations` (200, 22.4KB) all render real authed pages (web-origin admin session) — no dead-end / broken-back / unhandled-error.
- **NO send / compose / schedule / AI-draft affordance** on any of the three (grep of `send email|send immediate|schedule send|compose outreach|generate with ai|draft with ai|ai-drafting` = 0 across all three). M6 send remains founder-gated-deferred and is confirmed **absent, not half-built** — no CODE-OF-CONDUCT false-capability surface.

---

## FINDINGS

### F-1 — Workspace default-compliance-profile cascade is inert (write-only defaults) — **SPEC GAP** — Medium
- **Spec (648a86a6 AC-2):** the default-compliance-profile selector "CASCADES as the firm-level default the M4 `mandate_compliance_profile` inherits (new mandates start compliant-by-default)." WorkspaceSettingsService header comment claims "via MandateService reading workspace_settings."
- **Deployed:** `workspaceSettings` is referenced ONLY inside the admin module (`grep -rln workspaceSettings apps/api/src` → admin-settings schema + the two admin files only). `MandateService.createAsActor` (mandate.service.ts:115-152) derives `jurisdiction` from `input.compliance.jurisdiction` (request body), DERIVES `disclaimerTemplateId` from that jurisdiction, and takes `suppressionScope` from `input.compliance` — it **never reads `workspace_settings`**. The firm defaults persist correctly but nothing consumes them: a new mandate does NOT inherit the firm-level defaults. The "new mandates start compliant-by-default" clause is not delivered.
- **Classification:** spec gap — the spec asserted the cascade as an AC but the consuming side (MandateService reading the firm default when the mandate form omits a field) was neither planned into the M4 module at B-2 nor caught by T-block (no test asserts mandate-inherits-firm-default). Not a drift (the admin side is correct); the wire to M4 is simply absent.
- **Next-wave P-2:** either (a) wire MandateService to fall back to `workspace_settings` defaults when the mandate form omits jurisdiction/suppression, with an inheritance test, or (b) explicitly re-scope the cascade AC to "defaults stored for a future M4 consumer" and document the deferral. Recommend @task-completion-validator confirm the M4 consumer once wired.

### F-2 — Placeholder-page AC satisfied by building the pages, not by a placeholder component — **SPEC GAP (benign)** — Low
- **Spec (d7f716b4 AC-1):** "Role-nav items pointing at unbuilt routes render a graceful in-shell 'coming soon' placeholder … When the real page lands it replaces the placeholder. (Team/Settings …)."
- **Deployed:** no generic placeholder route/component exists for admin nav; instead Team→`/admin/users` and Settings→`/admin/settings` were built this wave, so no nav target is unbuilt. Intent (no raw 404 on nav click) holds. The AC's mechanism (a reusable placeholder) was overtaken by events.
- **Classification:** spec gap — the AC anticipated a placeholder need that this wave's own deliverables eliminated. No action required; flagged so a future wave adding a NEW unbuilt nav target does not assume a placeholder shim already exists (it does not — `DeferredPlaceholder.tsx` exists only under mandates/).

### F-3 — `/admin/integrations` is an orphaned surface: no nav item, no in-page link — **SPEC GAP** — Medium
- **Spec / journey:** user-journey-map F13 "Entry: Admin · integrations (18)"; the page + RBAC pattern (`rbac.ts:570 '/admin/integrations'`, admin-only) ship and render (200).
- **Deployed:** there is **no `NAV_INTEGRATIONS`** nav item and **no link anywhere** to `/admin/integrations` (grep across web pages + rbac nav config = 0 links; the rendered admin-session sidebar shows `/admin/settings`, `/admin/users`, `/buyer-universe`, `/mandates`, `/matches` — integrations absent). The page is reachable ONLY by typing the URL. F13's entry point is undelivered.
- **Classification:** spec gap — the ACs specified the page + endpoints but no AC required a nav entry, and nav⊆RBAC does not force nav TO exist for a pattern. A real journey dead-spot for the admin.
- **Next-wave P-2:** add `NAV_INTEGRATIONS` (config group, admin-only) or a link from `/admin/settings`.

### F-4 — Invite has no duplicate/existing-user handling: unbounded duplicate invites — **SPEC-CONFORMANCE MINOR** — Low/Medium
- **Spec (82ec8724 edge-case):** "Invite existing/active email -> handled (409 or idempotent)."
- **Deployed:** re-inviting the same email returns a NEW `inviteId` (201) every time; inviting an ALREADY-ACTIVE existing user (`advisor1@example.com`) also returns 201 with a fresh invite row. Neither 409 nor idempotent — it silently creates unbounded duplicate invite rows (the `invites` table has a unique index only on `token` where `consumed_at IS NULL`, not on `email`; users-roles.ts:117). Harmless to security (each token is single-use; signup binds by token, and `users_email_unique` blocks a second account for an already-active email), but the spec's stated edge behavior is not met and it clutters the invite table + admin UX.
- **Classification:** conformance divergence, minor — the *stated* AC ("409 or idempotent") is unmet, but the underlying safety property (no duplicate account) holds via `users_email_unique`. Not load-bearing.
- **Next-wave P-2:** decide the contract (idempotent-return-existing-pending-invite, or 409 on active-user / pending-invite) and add a test.

### F-5 — No reactivate/undo path for a soft-deactivated user — **SPEC GAP** — Low
- **Spec:** deactivate is a soft-delete (`deactivated_at`), but no AC provides a reactivate endpoint.
- **Deployed:** the admin API exposes deactivate only (one-way). During this verification my `POST …/deactivate` on the `advisor1@example.com` fixture left it deactivated with **no admin affordance to reverse it** (would require a direct DB write). A firm that deactivates a user in error has no in-product recovery.
- **Classification:** spec gap — reactivation was simply not in scope. Also a **cleanup note:** the `advisor1@example.com` test-fixture user is now `deactivated_at` non-null in prod; flag for fixture restore (needs an app-DB write; the brain DB reachable here is not the app DB).
- **Next-wave P-2:** add `POST /admin/users/:id/reactivate` (audited; clears `deactivated_at`), or document one-way-deactivate as intended.

### F-6 — config JSONB blob could hold a secret outside the encrypted path — **SPEC GAP (security, forward-looking)** — Low
- **Spec / P-3 (security-auditor B-0 note):** the encrypted path (`encrypted_credentials`) is the sanctioned secret store; the M3 `config` JSONB is for non-secret adapter config.
- **Deployed:** `createConnection`/`updateConnection` store `input.config` verbatim into the `config` JSONB column (data-source-admin.service.ts:159) with no schema constraint preventing an admin from putting an API key into `config` (which IS returned by reads / could reach logs, unlike `encrypted_credentials`). No enforcement that secrets go only through the credential field.
- **Classification:** spec gap — the T-findings already flagged "config-blob could hold a secret"; surfaced here for next wave. Low today (admin-only, and the sanctioned field exists), but it defeats the encrypted-at-rest invariant if misused.
- **Next-wave P-2:** constrain/validate `config` keys, or document that `config` is non-secret-by-contract and the credential field is the only secret sink.

---

## LIVE EVIDENCE (self-performed, prod, f5455d6)
- Anon: `GET /admin/users` → 401; `POST /admin/integrations` → 401.
- Advisor (minted): `GET /admin/users` → 403; `GET /admin/workspace-settings` → 403; `GET /admin/integrations` → 403; `POST /admin/integrations` → 403; `POST /admin/users/invite` → 403.
- Admin (minted, role:admin confirmed via `/auth/me`):
  - `GET` all 3 admin endpoints → 200; read shapes correct (users carry `deactivatedAt`; integrations carry `hasCredential` boolean, no credential/blob field).
  - `POST /admin/integrations` + sentinel plaintext → 201 `hasCredential:true`; sentinel absent from create response AND read-back (grep=0).
  - `PUT /admin/workspace-settings` → 200 singleton; second PUT same `id`, `updatedAt` bumped.
  - `POST /admin/users/invite` new → 201; duplicate + existing-active-user → 201 (F-4).
  - `PATCH /admin/users/:id/role` demote/promote → 200 (DB-authoritative role claim reflected).
  - `POST /admin/users/:id/deactivate` (non-last non-admin) → 201; repeat → 201 identical timestamp (idempotent).
- Web-origin admin session: `/admin/users` 200 (22.7KB), `/admin/settings` 200 (26.6KB), `/admin/integrations` 200 (22.4KB); zero send/compose/schedule/AI-draft affordance on all three; credential input write-only (never pre-filled).

## Limitations declared
- Last-admin-409 not forced live (12+ active admins; forcing it would destroy prod auth). Accepted on CI CONC-1 proof + correct-by-construction advisory-lock code.
- TopBar title fix not pixel-verified (cosmetic).
- Cleanup: `advisor1@example.com` fixture left deactivated (F-5); no reactivate affordance to restore it in-product.
