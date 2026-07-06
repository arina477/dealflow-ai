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
