---
stage: B-1
wave: 16
milestone: M7 admin-hardening
branch: wave-16-admin-hardening
agent: backend-developer
skipped: false
commit: cc02c77
---

# B-1 Contracts — Wave 16 admin-hardening

## contracts_authored

1. **packages/shared/src/audit.ts** — `auditActionEnum` appended with `'user-reactivate'` at the END of the closed enum. No existing values reordered. Serialization order preserved per wave-15 Inv-6 lesson.

2. **packages/shared/src/user-admin.ts** — Added `adminReactivateParamsSchema` (UUID :id path param) and `adminReactivateResponseSchema` (id + email + deactivatedAt=null). Mirrors the existing deactivate contract shape and naming. Task 042cf4e6.

3. **packages/shared/src/data-source-admin.ts** — Replaced `config: z.record(z.unknown()).optional()` with a typed `dataSourceConnectionConfigSchema` (P-4 Finding 2, CRITICAL). See config whitelist section below. Task 2560fecc.

4. **packages/shared/src/admin-activity.ts** (new) — `adminActivityQuerySchema` (action filter from the 7-item admin action set, since/until date range, cursor/limit pagination) + `adminActivityRowSchema` (actor.displayName/email, target/null, action, timestamp — NO credential, PII beyond actor/target identity, hash preimage, or sequenceNumber) + `adminActivityResponseSchema` (rows, nextCursor, total). Compile-time guard confirms `adminActivityActionEnum` is a strict subset of `auditActionEnum`. Task 8bb0a22f.

5. **packages/shared/src/rbac.ts** — Added:
   - `NAV_ADMIN_ACTIVITY` nav item (`/admin/activity`, admin-only, icon `activity`, group `config`)
   - `/admin/users/:id/reactivate` route entry (admin-only, mirrors deactivate). Task 042cf4e6.
   - `/admin/activity` route entry with `navItem: NAV_ADMIN_ACTIVITY` (admin-only). Task 8bb0a22f.
   - `/admin/activity-data` route entry (admin-only, no navItem — API-only proxy path). Task 8bb0a22f.
   - `NAV_ADMIN_ACTIVITY` added to `ALL_NAV_ITEMS`.

6. **packages/shared/src/index.ts** — Wired all new exports: `admin-activity.*` (new file), `adminReactivateParamsSchema` / `adminReactivateResponseSchema` (user-admin), `dataSourceConnectionConfigSchema` / `DataSourceConnectionConfig` (data-source-admin).

## config_whitelist

Grep target: `apps/api/src/modules/**/data-source*`, `apps/web/app/(app)/admin/integrations/_components/IntegrationsClient.tsx`, all adapter files.

**Finding:** No adapter reads any named config field today. The fixture adapter ignores config entirely. The only documentation of intended config use is the UI placeholder `{"fieldMapping": {"name": "company_name"}}` in `IntegrationsClient.tsx`. All existing stored rows are `{}` (the JSONB default, per schema definition).

**Whitelisted fields (all optional — backward-compatible with existing {} rows):**

| Field | Type | Constraint | Rationale |
|---|---|---|---|
| `fieldMapping` | `Record<string, string>` | Values max 128 chars | Maps internal field names to provider API field names. Non-secret (provider schema metadata). |
| `syncBatchSize` | `number` (int) | 1–10000 | ETL batch size tuning. Non-secret performance parameter. |
| `regionSlug` | `string` | Max 64 chars, `/^[a-z0-9-]+$/` | Provider region hint (e.g. "us-east-1"). Non-secret infrastructure hint. |

**No free-text slot:** `.strict()` rejects any unknown key. No `z.string()` without a max-length bound; no `z.unknown()` slot. Any future field requiring arbitrary string must be added here with an explicit bound; secrets must use the `credential` field (encrypted at rest), never `config`.

**No field flagged as deviation** — no currently-used config field requires a free-text/arbitrary-string type.

## invite_409_envelope

Task c54db02d: The invite 409 path reuses the existing NestJS `ConflictException` default envelope `{ statusCode: 409, message: '...', error: 'Conflict' }`. The web client already handles 409 by checking `res.status === 409` directly (see `AdminUsersClient.tsx` line 155) and renders a hardcoded user-facing message — it does not parse the response body. **No new shared Zod error envelope schema is needed or authored.** The existing convention is sufficient and consistent with the last-admin 409 pattern already shipped in wave-15.

## security_invariants_confirmed

- `auditActionEnum` append: additive only, existing values not reordered.
- `adminActivityRowSchema`: does NOT include `sequenceNumber` in the response (used only as pagination cursor), `payloadHash`, `contentHash`, `entryHash`, `prevHash`, or any credential field. Returns ONLY `actor` (displayName+email), `target` (displayName+email or null), `action`, `timestamp`, plus `sequenceNumber` as the internal cursor. P-4 Finding 3 fully addressed.
- `dataSourceConnectionConfigSchema`: no free-text slot, `.strict()`, all fields non-secret types. P-4 Finding 2 fully addressed at contract layer.

## typecheck

```
pnpm --filter @dealflow/shared typecheck
$ tsc --noEmit
(exit 0 — clean)
```

## tests

```
pnpm --filter @dealflow/shared test
Tests: 489 passed (489)
```

All 489 existing tests pass. No new contract tests authored at B-1 (contract schemas are structural; behavior tests live in B-2/T layers).

## deviations

None. All 6 tasks were implemented as specified. The config whitelist enumeration found no currently-used field requiring free-text — the `fieldMapping` record values are bounded to 128 chars, which is sufficient for provider API field name strings and does not open a secret-sink slot.
