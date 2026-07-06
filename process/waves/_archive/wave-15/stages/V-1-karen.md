# Wave 15 — V-1 Karen Reality Verification (M7 admin)

**Reviewer:** Karen (V-1, fresh spawn) — deployed-state truth audit, NOT diff review (that was B-6).
**Deployed SHA:** `f5455d6` (= CI-green code `596a78d` + docs-only chore). `git HEAD` = `f5455d68ca44c525f7e9d93c59ecb1925255164c`.
**Prod:** api `https://dealflow-api-production-66d4.up.railway.app` · web `https://dealflow-web-production-a4f7.up.railway.app`
**Method:** every claim verified against on-disk source @f5455d6, journal, migration SQL, or a live authenticated probe of the deployed API (admin + advisor sessions minted via invite→signup). No claim taken on the C-2/T-9 word.

## VERDICT: APPROVE — 0 blocking findings; 15 confirmations, 2 informational notes.

---

## Confirmations (each: claim → evidence)

### C1 — Deploy hash match (no Ghost Green) ✔
- Claim: `/health` version == f5455d6 (or 596a78d).
- Evidence: `curl .../health` → `{"status":"ok","db":"ok","version":"f5455d68ca44c525f7e9d93c59ecb1925255164c"}`, stable over 3 reads; == `git rev-parse HEAD`. `db:ok` confirms live Postgres after 0013 migrate one-shot. No stale build.

### C2 — Service file existence @f5455d6 ✔
- Claim: admin services + controllers + web pages + migration exist.
- Evidence (`git cat-file -e f5455d6:<path>` / `git ls-tree -r f5455d6`): PRESENT — `apps/api/src/modules/admin/`: `user-management.service.ts`, `credential-crypto.ts`, `data-source-admin.service.ts`, `workspace-settings.service.ts`, `admin-users.controller.ts`, `data-source-admin.controller.ts`, `workspace-settings.controller.ts`, `admin.module.ts`. Web: `apps/web/app/(app)/admin/{users,settings,integrations}/page.tsx` + `_components/*Client.tsx`. Migration `apps/api/src/db/migrations/0013_safe_union_jack.sql` present.

### C3 — Race-safe last-admin guard uses advisory lock, NOT count-FOR-UPDATE ✔
- Claim: `runLastAdminGuard` uses `pg_advisory_xact_lock` (write-skew-safe), invoked on demote + deactivate.
- Evidence (`user-management.service.ts` @f5455d6): `ADMIN_GUARD_LOCK_KEY = 4_200_500_500` (line 68); `runLastAdminGuard` (line 337) first stmt `SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK_KEY})` (line 345); invoked at `assignRoleAsActor` demote (line 219) + `deactivateAsActor` (line 292). `grep -i 'for update'` over the service = **zero** real occurrences (only the docstring naming the rejected pattern, line 13). Exports `deactivateAsActor` (259), `assignRoleAsActor` (185), `inviteAsActor` (123) all present.

### C4 — credential-crypto AES-256-GCM envelope ✔
- Claim: AES-256-GCM, random IV, getAuthTag/setAuthTag, v1: prefix, loadEncKey fail-closed.
- Evidence (`credential-crypto.ts` @f5455d6): `createCipheriv('aes-256-gcm', key, iv)` (68) + `createDecipheriv('aes-256-gcm',...)` (106); `iv = randomBytes(IV_BYTES)` per-encrypt (67); `cipher.getAuthTag()` (70) / `decipher.setAuthTag(tag)` (107); stored format `v1:<iv>:<tag>:<ciphertext>`, `KEY_ID='v1'` (30), unknown key-id rejected (91); `loadEncKey` throws when unset (38) and when ≠32 bytes (45) — **fail-closed**.

### C5 — Migration 0013 journaled at idx 13 (Ghost-Green lesson) ✔
- Claim: `_journal.json` carries an idx-13 entry (registered, not silent-skip).
- Evidence: `meta/_journal.json` @f5455d6 tail shows `{"idx":13,"version":"7","when":1783900800000,"tag":"0013_safe_union_jack","breakpoints":true}` following idx 11/12. Snapshot `meta/0013_snapshot.json` + `.down.sql` also present.

### C6 — Migration 0013 strictly additive ✔
- Claim: additive-only (no destructive alter); DROP only in .down.
- Evidence (`0013_safe_union_jack.sql` @f5455d6): `CREATE TABLE workspace_settings` (all-new) + `ADD COLUMN data_source_connections.encrypted_credentials text` (nullable) + `ADD COLUMN users.deactivated_at timestamptz` (nullable) + 2 FKs on the NEW table (ON DELETE set null). `grep -iE 'drop|truncate|alter type|set not null'` on forward SQL = **zero**. Zero-downtime safe.

### C7 — Migration 0013 APPLIED in deployed DB (live, no relation/column error) ✔
- Claim: `users.deactivated_at` + `workspace_settings` table + `data_source_connections.encrypted_credentials` live.
- Evidence (authed admin probe): `GET /admin/users` → 200, rows carry `"deactivatedAt":null` (the new column exists). `GET /admin/workspace-settings` → 200 (new table queryable, no `relation does not exist`). `GET /admin/integrations` → 200, connections expose `hasCredential` boolean (encrypted_credentials read-path works). All three 200, no error.

### C8 — Route registration + admin-only RBAC (LIVE, independently minted sessions) ✔
- Claim: `/admin/{users,workspace-settings,integrations}` admin-only (advisor 403 / anon 401).
- Evidence: **anon** GET all three → **401** `{"message":"Unauthorized"}`; anon POST /admin/integrations → 401. Control: `GET /admin/nonexistent-xyz` → **404** (proves the 401s are SessionGuard on registered routes, not a catch-all). **advisor** (minted via invite→signup, `/auth/me` role:advisor) GET all three → **403** `{"message":"Forbidden"}` (RolesGuard fires beyond SessionGuard). **admin** (minted) GET all three → **200**. Full anon-401 / advisor-403 / admin-200 ladder proven against the live API.

### C9 — CREDENTIALS_ENC_KEY set in prod + credential write-only (the wave's point) ✔
- Claim: key set (POST returns 201 not 500 fail-closed); credential never leaks.
- Evidence (authed admin POST): `POST /admin/integrations` with sentinel `KAREN-V1-SENTINEL-CRED-9x7q2z` → **201** `{...,"hasCredential":true,...}` (NOT 500 — key set + correct-length, AES-GCM encrypt executed end-to-end against the live key). Sentinel **absent** from the create response AND absent from the read-back `GET /admin/integrations` list; stored record exposes only `{id,providerKey,displayName,enabled,hasCredential,createdAt,createdBy}`. Credential write-only at the network surface.

### C10 — No committed CREDENTIALS_ENC_KEY secret in tracked tree ✔
- Claim: only env-var-name references + a test value; no committed 32-byte prod key.
- Evidence: `git grep 'CREDENTIALS_ENC_KEY' f5455d6` — every hit is `process.env.CREDENTIALS_ENC_KEY`, the `.env.example` placeholder (`CREDENTIALS_ENC_KEY=  #...`), or the labelled test value in `vitest.config.ts:61` (`dGVzdC1jcmVkZW50aWFscy1rZXktMzItYnl0ZXMhISE=` → decodes to `test-credentials-key-32-bytes!!!`, an obvious test literal). Regex for any OTHER 40+char base64 assigned to the var = **only** the vitest test value. No prod secret committed (rule 2/6 honored).

### C11 — Audit chain intact after 0013 (HMAC not broken) ✔
- Claim: `GET /compliance/audit-log/verify` → `{ok:true}`.
- Evidence (authed admin): `GET /compliance/audit-log/verify` → **200** `{"ok":true,"entriesChecked":314}`. 314 entries verified — the HMAC chain survived the 0013 migration. (anon → 401, advisor → 403: endpoint is admin-scoped, fail-closed.)

### C12 — Web admin pages exist + registered @f5455d6 ✔
- Evidence: `page.tsx` for `/admin/users`, `/admin/settings`, `/admin/integrations` all present at f5455d6 with client components + page tests. C-2 self-rendered them 200 (22-27KB real pages) after the corrective web repin; web root → 307 (auth redirect) confirmed live.

### C13 — Stale-web-build defect was REAL and corrected (not glossed) ✔
- C-2 caught the first arg-less web deploy shipping wave-14 `5754fbf` (admin pages 404'd), corrected via `serviceInstanceDeployV2(commitSha=f5455d6)` → dep `d5e1add6`. Web root live now 307 (auth guard), consistent with a served bundle. This is a genuine caught defect, not done-theater.

### C14 — B-6 + T-9 gates genuinely APPROVED (not rubber-stamped) ✔
- B-6 gate-verdict shows a real 2-phase cycle: Phase-1 REWORK caught the **hollow CONC-1** (inline-SQL re-implementation that would pass against a broken guard) + missing 409 unit + docstring-honesty defect; resolved at 795e896 (real-service concurrency). Phase-2 REWORK caught M1 (Zod-issue echo) + M2 (workspace_settings singleton race) + L3; resolved at e150925. T-9 head-tester re-read the SHIPPED test/source rather than trusting the "fixed" claim. The gates did their job (rejected fabricated proof before approving).

### C15 — auditActionEnum extended + admin module registered ✔
- B-6 #3 confirms the 6 admin actions appended additively (serialization order preserved); admin.module.ts present + all admin endpoints functional live (200), proving the module is registered in the deployed app.

---

## Informational notes (non-blocking — carried from T-9, no action for V)

- **N1 (INFO):** CREDENTIALS_ENC_KEY is a new prod env var; key-loss = permanent credential-loss + no in-MVP rotation. Documented in `.env.example` + design; accepted MVP posture. The `v1:` prefix reserves the rotation path.
- **N2 (LOW, fail-safe):** last-admin guard is over-strict on an already-deactivated admin → harmless fail-closed 409 (never leaves 0 admins). Fail-SAFE direction. Optional short-circuit, not a defect.

## Probe-artifact note
V-1 created 3 throwaway records in prod during live verification (advisor `karen-v1-probe@example.com`, admin `karen-v1-admin@example.com`, integration `karen-v1-probe-conn` holding an encrypted sentinel). These are test-namespace, non-destructive, and mirror the WORM-safe posture; flag to head-verifier if teardown is desired (audit rows referencing them are WORM by design and must be retained).

---

```yaml
karen_verdict: APPROVE
blocking_findings: 0
confirmations: 15
informational: 2
deployed_sha_verified: f5455d68ca44c525f7e9d93c59ecb1925255164c
health_version_match: true
migration_0013: {journaled_idx13: true, additive_only: true, applied_live: true}
rbac_live: {anon_401: true, advisor_403: true, admin_200: true}
credential_security_live: {key_set_201_not_500: true, sentinel_never_leaks: true, no_committed_secret: true}
audit_chain_intact: {ok: true, entries_checked: 314}
guard_form: pg_advisory_xact_lock (NOT count-FOR-UPDATE)
next: PROCEED (V-2 triage — nothing to triage; V-3 gate)
```
