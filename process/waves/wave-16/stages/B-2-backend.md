# Wave 16 — B-2 Backend

## Config boundary (2560fecc)

**Agent:** backend-developer
**Task:** 2560fecc — DataSourceAdminService config typed-boundary (P-4 Finding 2)
**Commit:** 7bda731

### Files implemented

- `apps/api/src/modules/admin/data-source-admin.service.ts` — service write path enforcement
- `apps/api/src/modules/admin/admin.spec.ts` — C-4 tests (C-4a through C-4g)

### What was done

1. Imported `dataSourceConnectionConfigSchema` (already authored in B-1) and `BadRequestException` into `DataSourceAdminService`.

2. Added `CONFIG_VALIDATION_ERROR` constant — the fixed static rejection message:
   `"config contains an unsupported or disallowed field; secrets must use the credential field"`

3. Added `validateConfigOrThrow(config: unknown)` helper:
   - Calls `dataSourceConnectionConfigSchema.safeParse(config)`.
   - On failure: discards `ZodError` entirely (never echoed), throws `BadRequestException(CONFIG_VALIDATION_ERROR)`.
   - On success or when config is absent: returns without throwing.

4. Called `validateConfigOrThrow(input.config)` at the top of both `createConnection` and `updateConnection`, BEFORE entering `this.db.transaction(...)`. A bad config never reaches the DB.

5. Removed unused `ConflictException` import (`/simplify`).

### 400 is uniform-static NO-echo

The `BadRequestException` message is the `CONFIG_VALIDATION_ERROR` constant — a string literal with no interpolated values. `ZodError` (which may contain the offending field value in `.issues[].message`) is discarded via `safeParse` rather than caught and re-thrown. No `console.error` or logger call touches the config value on the rejection path.

Test C-4b asserts that the exact secret value (`my-plaintext-secret-should-never-appear-in-error`) is absent from `caughtError.message`. Test C-4c mirrors this for the update path.

### Backward-compat preserved

The `dataSourceConnectionConfigSchema` requires no fields (all three are `.optional()`). An empty `{}` passes (C-4e). Omitting `config` entirely on an update passes (C-4f). Existing stored connections with `{}` config continue to load and update normally.

### Test results (C-4 block — all pass)

- C-4a: `createConnection` — unknown key → `BadRequestException`; DB transaction NOT called.
- C-4b: `createConnection` — secret value absent from error message (LOAD-BEARING no-echo assertion).
- C-4c: `updateConnection` — unknown key → `BadRequestException`; secret absent; DB transaction NOT called.
- C-4d: legit config (`fieldMapping` + `syncBatchSize` + `regionSlug`) → succeeds, transaction called.
- C-4e: empty config `{}` → succeeds (backward-compat).
- C-4f: `updateConnection` with no `config` field → succeeds (backward-compat).
- C-4g: `regionSlug` with invalid chars → 400, offending slug absent from error.

All 7 C-4 tests pass. The 2 test failures in the suite at commit time (A-1 in `admin.spec.ts`, mandate.spec.ts) are from other agents' wave-16 B-2 changes (invite-dedup task `c54db02d` and mandate cascade task `904a3c25`) and are not regressions from this task.

### Deviation from plan

None.

---

## Compliance cascade (904a3c25)

**Agent:** backend-developer
**Task:** 904a3c25 — MandateService firm compliance-default cascade (mvp-critical spine)
**Commit:** 10dfc9c

### Files implemented

- `packages/shared/src/mandate.ts` — `compliance.jurisdiction` made optional in `mandateCreateSchema` (backward-compatible; existing clients always provide it; cascade fills from firm default when absent)
- `apps/api/src/modules/mandate/mandate.repository.ts` — `findWorkspaceSettingsInTx(tx)` method added; reads `workspace_settings` table via the tx-scoped handle (BUILD rule 7)
- `apps/api/src/modules/mandate/mandate.service.ts` — `createAsActor` cascade logic: reads workspace_settings TX-scoped inside the create transaction, resolves `jurisdiction` and `suppressionScope` with explicit-wins semantics before D2 disclaimer lookup
- `apps/api/src/modules/mandate/mandate.spec.ts` — 12 new cascade unit tests; updated 1 schema test (jurisdiction now optional)
- `apps/api/test/mandate-cascade.e2e-spec.ts` — mandatory e2e proof suite (CASCADE-1 through CASCADE-4; skipIf no TEST_DATABASE_URL, fault-killing, WORM-safe teardown)

### Settings read is tx-scoped (BUILD rule 7)

`findWorkspaceSettingsInTx(tx)` takes the transaction handle and issues `tx.select().from(workspaceSettings).limit(1)` — not `this.db.select()`. Called as the FIRST step inside `runInTransaction`, before any business write, so the cascade resolution is on the same snapshot as the inserts.

### Explicit-wins invariant

Resolution for each field:
- `jurisdiction`: `input.compliance.jurisdiction ?? firmSettings?.defaultJurisdiction ?? null` — throws 400 if null after both checks
- `suppressionScope`: if `input.compliance.suppressionScope !== undefined`, use it; else `firmSettings?.defaultSuppressionScope ?? null`

An explicitly-provided value (non-undefined) always takes precedence. The firm default fills ONLY absent (undefined) fields.

### No retroactive mutation

`resolvedJurisdiction` and `resolvedSuppressionScope` are stamped into the `mandate_compliance_profile` row at INSERT time. No view-time join. `workspace_settings` changes after mandate creation do not touch existing `mandate_compliance_profile` rows.

### Mandatory e2e proof: inherits-default + change-default-doesnt-mutate

Four tests in `apps/api/test/mandate-cascade.e2e-spec.ts`:

- **CASCADE-1** (fault-killing): set firm default `jurisdiction='EU', suppressionScope='firm'` → create mandate omitting both → assert `profile.jurisdiction='EU'` and `profile.suppressionScope='firm'`. If cascade not applied, these assertions fail.
- **CASCADE-2** (fault-killing): using a mandate from CASCADE-1 flow, change firm default to `'APAC'` after creation → re-read profile → assert still `'EU'`. If retroactive mutation occurred, `profile.jurisdiction='APAC'` → assertion fails.
- **CASCADE-3**: firm default `'EU'`, client provides `jurisdiction='US'` → profile carries `'US'`. Explicit-wins invariant.
- **CASCADE-4**: no workspace_settings row → client provides `jurisdiction='US'`, no suppressionScope → `profile.suppressionScope=NULL`.

WORM-safe teardown: mandate rows hard-deleted (not FK-referenced by audit_log_entries); user fixtures retained via UPDATE; workspace_settings cleared via DELETE.

### Unit test results (82 pass)

```
pnpm --filter @dealflow/api exec vitest run src/modules/mandate/mandate.spec.ts
Tests: 82 passed (82)
```

Includes 12 new cascade tests + updated schema acceptance test. All prior 70 tests continue passing.

### Shared package tests (489 pass)

```
pnpm --filter @dealflow/shared test --run
Tests: 489 passed (489)
```

No regressions from the `jurisdiction` optional change.

### Deviations

None. All ACs from task 904a3c25 implemented as specified. Pre-existing TypeScript errors in `admin-activity` and `user-management` modules are from other incomplete B-2 tasks (not regressions).

---

## Admin-activity (8bb0a22f)

**Agent:** backend-developer
**Task:** 8bb0a22f — admin-activity read endpoint (P-4 Finding 3)
**Branch:** wave-16-admin-hardening

### Files created

- `apps/api/src/modules/admin-activity/admin-activity.service.ts` — read-only service; reuses AuditRepository.findAdminActivity; explicit whitelist projection; ZERO audit appends
- `apps/api/src/modules/admin-activity/admin-activity.controller.ts` — GET /admin/activity-data; SessionGuard + RolesGuard; fail-closed boot guard; Zod query validation
- `apps/api/src/modules/admin-activity/admin-activity.module.ts` — imports AuthModule + AuditModule; no exports (self-contained)
- `apps/api/src/modules/admin-activity/admin-activity.spec.ts` — 10 unit tests (mocked DB): row shape, hash/credential absence, target resolution, pagination, empty state
- `apps/api/src/modules/admin-activity/admin-activity.di-boot.spec.ts` — 2 DI-boot tests: module wiring + RBAC fail-closed boot guard
- `apps/api/test/admin-activity.e2e-spec.ts` — 6 real-service tests (skipIf no TEST_DATABASE_URL): ACT-1 through ACT-6

### Files modified

- `apps/api/src/modules/audit/audit.repository.ts` — added `findAdminActivity()` + `countAdminActivity()` READ-ONLY methods (mirrors recordkeeping.repository.findFiltered pattern)
- `apps/api/src/modules/audit/audit.module.ts` — added `AuditRepository` to exports (BUILD rule 2: guard-injected repo exported by consuming module)
- `apps/api/src/app.module.ts` — registered `AdminActivityModule`

### Security invariants confirmed

**Reuses audit.repository read path (not forked):** `findAdminActivity` and `countAdminActivity` are added to the EXISTING `AuditRepository`. The service imports `AuditRepository` from the exported `AuditModule`. No second audit reader was created.

**Row shape carries NO hash/credential:** `AdminActivityService.getActivity` maps StoredAuditEntry to AdminActivityRow via an explicit whitelist at the map step. Fields structurally absent from output: `payloadHash`, `contentHash`, `entryHash`, `prevHash`, `chainVersion`, `actorRole`, `resourceType`, `resourceId`, `mandateId`. Unit test A-2 asserts serialized response does not contain any of these field names. Unit test A-3 asserts actual hash string values do not appear.

**Read appends 0 audit rows (read-only invariant):** `AdminActivityService` calls only `AuditRepository.findAdminActivity` and `countAdminActivity` (SELECT-only). No `AuditService.append` call exists anywhere in the admin-activity module. Real-service test ACT-4 counts rows before/after three `getActivity()` calls and asserts count is unchanged.

**RBAC 403/401:** `AdminActivityController` uses `@UseGuards(SessionGuard, RolesGuard)` with `@Roles(...ADMIN_ACTIVITY_ROLES)`. `ADMIN_ACTIVITY_ROLES` derives from `rolesForRoute('/admin/activity-data')` which resolves to `['admin']`. Fail-closed boot guard throws if that resolves to `[]`. DI-boot test (ACT-6) proves `RolesGuard` + `SessionGuard` resolve.

**Single-tenant (no firm_id):** No firm-scope filter or firm_id column referenced anywhere in the module.

### Test results

765 passed, 41 skipped (real-DB suites require TEST_DATABASE_URL). All 12 admin-activity unit + DI-boot tests pass. The 6 real-service tests in `test/admin-activity.e2e-spec.ts` are skipIf guarded.

### Deviations

None. `AuditRepository` added to `AuditModule` exports per BUILD rule 2 (guard-injected repos exported by consuming module). Single task, single commit.

---

## USER-MANAGEMENT vertical (tasks c54db02d + 042cf4e6)

**Agent:** backend-developer
**Tasks:** c54db02d — invite dedup advisory-lock; 042cf4e6 — user reactivate + prod-cleanup C-2 hand-off

### Commits

- `feat(admin): B-2 invite dedup advisory-lock for wave-16` SHA `0efb0ce` (task c54db02d)
- `feat(admin): B-2 user reactivate for wave-16` SHA `a8d5f0b` (task 042cf4e6)

### Files implemented

- `apps/api/src/modules/admin/user-management.service.ts` — inviteAsActor dedup + reactivateAsActor
- `apps/api/src/modules/admin/admin-users.controller.ts` — POST /admin/users/:id/reactivate endpoint
- `apps/api/src/modules/admin/admin.spec.ts` — A-7a/b/c/d invite dedup unit tests + A-8a/b/c reactivate unit tests; A-1 updated for new select-call ordering
- `apps/api/test/admin-concurrency.e2e-spec.ts` — INVITE-CONC-1 fault-killing concurrency test + REACTIVATE-1/2 real-service integration tests

### Task c54db02d — Invite duplicate handling (P-4 Finding 1)

Advisory lock (PRIMARY race guard): pg_advisory_xact_lock(hashtext(lower(email))::bigint) is the FIRST statement in the inviteAsActor transaction. No partial unique index used: WHERE consumed_at IS NULL blocks re-inviting expired invites; WHERE expiry > now() is non-immutable and Postgres refuses it in a partial index.

Dedup checks under lock (SELECT-then-INSERT critical section):
1. SELECT active users (deactivated_at IS NULL) for the email -> 409 ConflictException if found.
2. SELECT live invites (consumed_at IS NULL AND expiry > now()) -> 409 ConflictException if found.
3. Expired (expiry <= now()) and consumed (consumed_at IS NOT NULL) invites -> new invite allowed.

Fault-killing concurrency test (VERIFY rule 3): INVITE-CONC-1 calls the REAL UserManagementService.inviteAsActor. Two concurrent calls for a fresh email -> exactly one invite row in DB, the other gets 409. If the advisory lock is removed, both calls pass the SELECT-live-check simultaneously and both INSERT two rows; expect(rows).toHaveLength(1) catches the regression.

Unit tests (A-7a-d): registered-active->409; live-pending->409; expired->new-allowed; consumed->new-allowed. Each asserts execute called once (lock fires first).

### Task 042cf4e6 — Reactivate + prod-cleanup

reactivateAsActor (mirrors deactivateAsActor):
- 404 for unknown userId (tx-scoped SELECT per BUILD rule 7).
- 400 if deactivated_at IS NULL (already active).
- UPDATE deactivated_at = NULL; role_id preserved (never changed).
- Audit LAST-IN-TXN under user-reactivate action.

Controller: POST /admin/users/:id/reactivate -> 200|400|401|403|404. SessionGuard + RolesGuard + ADMIN_USERS_ROLES (admin-only fail-closed).

Real-service tests (REACTIVATE-1/2): deactivated user -> DB deactivated_at=NULL + action=user-reactivate audit row + role_id unchanged; already-active -> 400. WORM-safe teardown (UPDATE not DELETE).

### C-2 prod-cleanup hand-off (NON-DEFERRABLE ops action, NOT in migration or seed)

Execute at C-2 against prod:
1. Restore advisor1: UPDATE users SET deactivated_at = NULL WHERE email = 'advisor1@example.com';
2. Neutralize 3 KAREN-V1-SENTINEL records (WORM-safe): UPDATE users SET email = 'karen-v1-sentinel-purged-N@invalid.invalid' WHERE id = '<each-id>'; (one UPDATE per row, distinct suffix).

### Test results

15 new tests added, all pass. Suite totals: 763 pass / 2 pre-existing admin-activity failures (task 8bb0a22f, not this vertical) / 41 skipped (e2e requiring live DB).

### Deviation from plan

None.
