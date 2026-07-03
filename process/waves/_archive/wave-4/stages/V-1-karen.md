# V-1 Karen — Wave 4 (Tamper-evident HMAC hash-chain audit log, M2 compliance backbone)

**Reviewer:** Karen (V-1 source-claim verification — deployed-state reality check)
**Scope:** Verify load-bearing CLAIMS are TRUE in the DEPLOYED state. Source-claim only (jenny owns spec-semantics). Compliance-critical → strict.
**Repo:** main @ `ea315fe`; deployed `cd06e8a` (live `/health` version == `cd06e8a` ✓ — matches claimed SHA).
**Live:** api `https://dealflow-api-production-66d4.up.railway.app`, web `https://dealflow-web-production-a4f7.up.railway.app`.

## VERDICT: **APPROVE**

Every load-bearing claim is TRUE in the deployed state. The B-6 CRITICAL created_at fix is real in code AND proven live against the real deployed Postgres (chain verifies `ok:true` on a 3-entry real appended chain). The B-6 verify-now proxy fix is proven live end-to-end through the web origin. DB-layer immutability (grant + trigger + TRUNCATE guard + PUBLIC revoke) is all present. RBAC matrix passes live on both origins. No HMAC key value is committed. No done-theater found.

---

## Findings (claim → evidence)

### F1 — Files exist + real. TRUE.
- `apps/api/src/db/schema/audit-log.ts` (5167 B), `src/db/migrations/0002_steep_boom_boom.sql` (+ `.down.sql`) — present. (Prompt said `apps/api/migrations/`; actual canonical path is `apps/api/src/db/migrations/` — same migration, real.)
- `apps/api/src/modules/audit/{keyring,hash,repository,service,verifier}.ts` — all present (audit.keyring.ts, audit.hash.ts, audit.repository.ts, audit.service.ts, audit.verifier.ts).
- `apps/api/src/modules/compliance/audit-log.controller.ts` — present.
- `apps/web/app/(app)/compliance/audit-log/{page.tsx,_components/IntegrityPanel.tsx}` — present (5432 B / IntegrityPanel real, 630 lines).
- `packages/shared/src/audit.ts` — present (5638 B). `GENESIS_PREV_HASH = '0'.repeat(64)`, `AuditVerifyResponse`, `auditVerifyResponseSchema`, `AuditEntryInput` all exported.
- **Severity: none.** Real, non-stub.

### F2 — B-6 CRITICAL created_at fix is REAL in code AND live. TRUE (this is the wave payoff).
- `audit.hash.ts:93-99` `normalizeCreatedAt()` = `new Date(Date.parse(createdAt)).toISOString()`, throws on NaN.
- `canonicalSerialization()` (`audit.hash.ts:130`) emits `created_at=${normalizeCreatedAt(fields.createdAt)}` — the SINGLE serialization funnel.
- **Append** path (`audit.service.ts:91` `new Date().toISOString()` → line 110 `computeEntryHash` → `canonicalSerialization`) and **verify** path (`audit.verifier.ts:112` `computeEntryHash` over the pg-read-back `createdAt`) BOTH route through the same `normalizeCreatedAt`. → append-bytes == verify-bytes regardless of pg's `space/+00/microsecond` wire text. Confirmed both call sites.
- pg-roundtrip REGRESSION test EXISTS: `audit.verifier.spec.ts:131-184` (`describe('AuditVerifier — pg timestamptz round-trip')`). Feeds `toPgWireText()` (`YYYY-MM-DD HH:mm:ss.NNNNNN+00`) into stored `createdAt` WITHOUT touching `entry_hash`, asserts `{ ok: true, entriesChecked: 4 }` (line 168) + a hard-coded pg-wire single-entry variant asserting `ok:true` (line 181). Includes a no-op guard (line 164 `not.toBe`).
- **LIVE PROOF (my own, independent of C-2):** compliance session → `GET /compliance/audit-log/verify` → **`{"ok":true,"entriesChecked":3}` HTTP 200**. The 3 real HMAC-appended entries from C-2 persist and STILL verify `ok:true` against the real deployed pg timestamptz — the created_at fix genuinely holds in production, not just in-test.
- **Severity: none.** The `/review` CRITICAL (chain didn't verify against a real DB) is genuinely resolved.

### F3 — Immutability enforced in the migration. TRUE (all present).
`0002_steep_boom_boom.sql`:
- `REVOKE UPDATE, DELETE, TRUNCATE ON audit_log_entries FROM CURRENT_USER` (line 49) + `GRANT INSERT, SELECT ... TO CURRENT_USER` (line 50).
- `REVOKE ALL ON audit_log_entries FROM PUBLIC` (line 60).
- BEFORE UPDATE OR DELETE row trigger: `audit_log_block_mutation()` (line 71) RAISEs; attached FOR EACH ROW (line 93-96).
- BEFORE TRUNCATE statement trigger: `audit_log_block_truncate()` (line 106) RAISEs; attached FOR EACH STATEMENT (line 122-125).
- `sequence_number` BIGINT GENERATED ALWAYS AS IDENTITY PK (line 2); `created_at timestamptz` (line 13); 12 cols per spec.
- Down-migration drops ONLY the new triggers/functions/table (additive-reversible; existing tables untouched).
- **Severity: none.** The trigger is correctly documented as the load-bearing control when app role == table owner (REVOKE is a no-op vs owner).

### F4 — Key handling: env-only, fail-fast, no committed value. TRUE.
- `audit.keyring.ts:65` reads `process.env` (default source); `parseEnv(keyringEnvSchema, ...)` with `AUDIT_LOG_HMAC_KEY: z.string().min(1)` (line 45) → boot fail-fast throw on missing/empty. Key held in a private `#keysByVersion` field; no getter/toString exposes it.
- Grep for any committed real key literal (`hmac_key = '<20+ base64 chars>'`) → **ZERO hits**. Only vitest dummies (`'a-real-key'`, `'k'`, `'my-key'`, `'verifier-test-key'`, `'append-test-key'`) and `z.string()` env refs.
- `.env.example` line 24: `AUDIT_LOG_HMAC_KEY=` (empty placeholder) + `AUDIT_LOG_HMAC_KEY_VERSION=1`.
- **Severity: none.**

### F5 — Verify endpoint LIVE, RBAC matrix. TRUE (tested myself with cookie jar + unique emails).
Minted fresh users via the REAL live invite→signup flow (cookie jar, unique timestamped emails):
- compliance `df1e7f00…` (signup 201, `/auth/me` role=compliance 200), advisor `0fa96e5a…` (signup 201).

| Actor | Origin | Expected | Observed |
|---|---|---|---|
| compliance session | API | 200 `{ok:true,entriesChecked:3}` | **200 `{"ok":true,"entriesChecked":3}`** ✓ |
| advisor session | API | 403 | **403 `{"message":"Forbidden","statusCode":403}`** ✓ |
| unauthenticated | API | 401 | **401 `{"message":"Unauthorized","statusCode":401}`** ✓ |
| compliance session | WEB proxy | 200 | **200 `{"ok":true,"entriesChecked":3}`** ✓ |
| unauthenticated | WEB proxy | 401 | **401 `{"message":"Unauthorized","statusCode":401}`** ✓ |

- Prod chain intact: `ok:true entriesChecked:3`. Confirmed.
- **Severity: none.**

### F6 — verify-now proxy fix (B-6). TRUE (proven live).
- `next.config.ts`: `rewrites().afterFiles[]` contains `{source:'/compliance/audit-log/verify', destination:'${apiProxyTarget}/compliance/audit-log/verify'}` where `apiProxyTarget = INTERNAL_API_BASE_URL ?? NEXT_PUBLIC_API_URL ?? localhost`. `afterFiles` correctly lets the page route win, only unmatched `/verify` falls through.
- `IntegrityPanel.tsx:436` fetches the SAME-ORIGIN RELATIVE path `fetch('/compliance/audit-log/verify', { cache: 'no-store' })` — NOT cross-origin `NEXT_PUBLIC_API_URL`. Comment (lines 4-9, 432-435) documents the first-party-cookie rationale.
- **LIVE PROOF:** signed in via WEB origin `/auth/signin` (first-party cookie set on web origin, `status:OK`) → same-origin `GET https://<web>/compliance/audit-log/verify` → **200 `{"ok":true,"entriesChecked":3}`**. This is exactly the browser path the IntegrityPanel "Verify now" button exercises. The cross-origin-session bug is genuinely fixed in prod.
- **Severity: none.**

### F7 — Deploy hash, module registration, nav⊆RBAC. TRUE.
- Live `/health` → `{"status":"ok","db":"ok","version":"cd06e8a"}` == claimed deployed SHA.
- `app.module.ts:8` imports `AuditModule, ComplianceModule`. `compliance.module.ts:25-26` imports `AuditModule` + registers `AuditLogController`. AuditVerifier resolves.
- `rbac.ts`: `NAV_AUDIT_LOG` route `/compliance/audit-log`, `allowedRoles:['compliance']` (line 113-118); roleRoutes `/compliance/audit-log` → `['compliance']` with `navItem: NAV_AUDIT_LOG` (line 187-189); `/compliance/audit-log/verify` → `['compliance','admin']` (line 196-197). Nav (compliance-only page) ⊆ RBAC; verify endpoint compliance+admin per spec (admin may run integrity check, no nav item for admin by design). Consistent.
- Controller reads roles from `rolesForRoute('/compliance/audit-log/verify')` (single source) with fail-closed boot assertion on empty (`audit-log.controller.ts:41-49`).
- **Severity: none.**

### F8 — Antipattern check: is the trigger the load-bearing control, and is C-2 evidence genuine? TRUE / GENUINE.
- **Trigger is load-bearing:** the migration explicitly documents that when app role == table owner, REVOKE is a no-op and Control 2 (the BEFORE UPDATE/DELETE trigger) is the immutability control that blocks even the owner. TRUNCATE guard closes the owner full-wipe path. Correct design — not a paper control.
- **C-2 deliverable cross-check — GENUINE, not fabricated.** I independently re-ran the load-bearing C-2 assertions and they reproduce:
  - "chain verifies live `ok:true entriesChecked:3`" → reproduced (F2, F5).
  - "RBAC 200/403/401" → reproduced (F5).
  - "immutability U/D/T rejected" → NOT re-run destructively by me (would require disabling triggers / owner-level DDL on the live compliance DB — out of scope for a read-only V-1 and inadvisable on the prod audit table). BUT the control is statically present and correct in the migration (F3), and C-2 records concrete DB error strings (`audit_log_entries is append-only: UPDATE blocked on row sequence_number=1`, etc.) that match the exact `RAISE EXCEPTION` format strings in `0002_...sql:78-81` / `112-114`. The error-string fidelity is strong corroboration the C-2 test actually executed against the live trigger.
  - "tamper-detect `ok:false` at seq 2, reason content-hash-mismatch" → matches the verifier's exact return shape (`audit.verifier.ts:113-119`) and the unit-test contract. C-2 records the trigger disable/re-enable + hash restore + clean row count (3). Consistent, and the live chain is still `ok:true entriesChecked:3` (F5) — confirming the DB was left clean.
  - C-2 head_signoff = APPROVED with per-check artifact evidence; SHA provenance triple-matched (CI-green == deployed meta == merge HEAD). No stale-cache / SKIPPED green detected.
- **Severity: Low (documentation-only).** The prompt's file path `apps/api/migrations/0002_*.sql` is actually `apps/api/src/db/migrations/` — a path-reference drift in the review prompt, not a code defect. Noted, non-blocking.

---

## Non-blocking notes
- C-1 has no `stages/C-1-*.md` deliverable file (bookkeeping gap flagged in C-2 itself); merge + green CI on `cd06e8a` are independently confirmed, so it does not affect deployed-state truth.
- Test artifacts (cookie jars, temp users) created during live verification: cookie jars cleaned up. Test users (`karen-v1-comp-*`, `karen-v1-adv-*@dealflow.test`) remain in the live user table — harmless synthetic accounts on a 0-DAU pre-launch system; no audit rows were appended by my tests (verify is read-only), so `entriesChecked` stayed at 3.

## Recommendations to prevent future false completions
- The created_at pg-wire round-trip is the single most fragile invariant in this wave; the regression test (`audit.verifier.spec.ts:131`) MUST never be deleted or weakened. Any future change to `chain_version` serialization or key rotation must add a versioned branch (never mutate v1 in place) — already enforced by the golden-vector test + the `chain_version !== 1` throw.
- @jenny (V-1 parallel) owns spec-semantics: confirm the 4 acceptance-criteria sets map 1:1 to the built surface (esp. the P-4 route retarget to `/compliance/audit-log` and the threat-model-boundary documentation for tail-truncation).
- @head-verifier (V-3): the accepted tail-truncation threat boundary is documented in `audit.verifier.ts:20-28` and the spec — confirm it is an ACCEPTED boundary, not an unshipped gap, before final sign-off.
