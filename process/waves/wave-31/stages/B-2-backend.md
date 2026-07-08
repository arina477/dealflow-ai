# Wave 31 — B-2 Backend (Twenty CRM DataSourceAdapter)

**Stage:** B-2 — Backend implementation
**Task:** 1eb63a40 (M9 Twenty CRM DataSourceAdapter)
**Agent:** backend-developer
**Branch:** wave-31-twenty-adapter

---

## Deliverables

### 1. SDK Doc (B-1 prerequisite — FIRST)

**Path:** `command-center/dev/SDK-Docs/Twenty/twenty.md`

Authored before the adapter. Covers:
- Base URL: per-instance, resolved from `TWENTY_BASE_URL` env (NOT hardcoded). Twenty Cloud = `https://api.twenty.com`; self-hosted = operator's domain.
- Auth: `Authorization: Bearer <TWENTY_API_KEY>` (not Basic auth — differs from Affinity).
- Canonical env var names: Twenty SDK uses `TWENTY_API_KEY` (API key) and `TWENTY_API_URL` (URL). This adapter uses `TWENTY_API_KEY` + `TWENTY_BASE_URL` per wave-31 spec.
- REST chosen over GraphQL: rationale documented.
- Pagination: cursor model (`starting_after` / `ending_before`, `limit`, `pageInfo.hasNextPage` + `pageInfo.endCursor`).
- Page limits: default=60, max=200 (server-enforced, verified from source constants).
- Response envelope: `data.companies[]` + `pageInfo`.
- Normalize map: Twenty company → NormalizedSourceRecord.
- `domainName` is a composite object (`{ primaryLinkUrl, primaryLinkLabel }`) — hostname extracted from URL.
- Registry row added: `command-center/dev/SDK-Docs/registry.md`.

### 2. Adapter

**Path:** `apps/api/src/modules/sourcing/adapters/twenty.adapter.ts`

Mirrors `affinity.adapter.ts` structure exactly:

| Feature | Implementation |
|---|---|
| `providerKey` | `'TWENTY'` |
| Env vars | `TWENTY_API_KEY` + `TWENTY_BASE_URL` — read lazily in `fetchCompanies()`, NOT in constructor (boot-safety) |
| Absent-key no-op | `TWENTY_API_KEY` absent → `return [] + warn`, no throw |
| Absent-URL no-op | `TWENTY_BASE_URL` absent → `return [] + warn`, no throw |
| SSRF/misconfig guard | `new URL(baseUrl)` parse + `protocol === 'https:'` check; non-https → `return [] + warn` |
| Auth | `Authorization: Bearer <apiKey>` (differs from Affinity's Basic auth) |
| Pagination | Internal cursor loop: `starting_after=<endCursor>` until `hasNextPage===false || endCursor===null` |
| Page size | `limit=60` (Twenty default; max 200) |
| Contact loading | `depth=2` on `/rest/companies` — persons loaded inline, no per-company person round-trips |
| Backoff | 429: exponential from `BASE_BACKOFF_MS` (no documented Twenty reset header) |
| Retry | 5xx + network errors: up to `MAX_RETRIES=3`, exponential backoff |
| Timeout | `AbortController` per-request (30s), cleared in `finally` |
| Boundary-Zod inbound | `twentyCompaniesResponseSchema.safeParse()` on every page; malformed → log + break |
| [P2-a FOLD] Output-Zod | `normalizedSourceRecordSchema.safeParse()` on every normalized record; invalid → warn + skip |
| Partial failure | Page fetch failure after retries → log + return records collected so far |
| `domain` extraction | `new URL(company.domainName.primaryLinkUrl).hostname` |
| Registration | `createDefaultRegistry()` in `adapter.registry.ts` registers `new TwentyDataSourceAdapter()` |

### 3. Registry Update

**Path:** `apps/api/src/modules/sourcing/adapters/adapter.registry.ts`

Added:
```typescript
import { TwentyDataSourceAdapter } from './twenty.adapter';
// ...
registry.register(new TwentyDataSourceAdapter());
```

### 4. Env Vars

**Path:** `.env.example`

Added name-only entries (no values committed):
```
TWENTY_API_KEY=    # Twenty CRM API key ...
TWENTY_BASE_URL=   # Twenty CRM per-instance base URL ...
```

### 5. Tests

**Path:** `apps/api/src/modules/sourcing/adapters/twenty.adapter.spec.ts`

Vitest, `vi.stubGlobal('fetch', ...)` — NO live HTTP. 18 tests, all passing.

| Test | Coverage |
|---|---|
| TEST 1 | Multi-page cursor pagination: 3 pages → all 6 records returned; cursor chain verified |
| TEST 2 | 429 → backoff → retry → success |
| TEST 3 | 5xx transient retry → success |
| TEST 4 | Timeout (AbortController abort) → returns [], no throw |
| TEST 5 | Normalize: company + person fixture → correct NormalizedSourceRecord shape |
| TEST 6 | Absent `TWENTY_API_KEY` → returns [], warns, no fetch call |
| TEST 7 | Absent `TWENTY_BASE_URL` → returns [], warns, no fetch call |
| TEST 8 | Non-https `TWENTY_BASE_URL` (`http://`) → no-op + warns |
| TEST 9 | Malformed `TWENTY_BASE_URL` (unparseable) → no-op + warns |
| TEST 10 | Malformed boundary response (missing `data.companies`) → logs error, returns [], no crash |
| TEST 11 | [P2-a] Invalid normalized record (empty name) → skipped + warns |
| TEST 12 | Auth header: `Bearer <apiKey>` format verified |
| TEST 13 | Partial failure: page 2 network error → returns page 1 records |
| Extra | Domain extraction from `primaryLinkUrl` |
| Extra | Company with no `domainName` → `domain` is `undefined` |
| Extra | Person with no email → `contact.email` is `undefined` |
| Extra | `depth=2` query param sent in requests |

---

## Deviations from Affinity Adapter (wave-30 MIRROR reference)

| # | Deviation | Reason |
|---|---|---|
| D-1 | Auth: `Bearer <key>` instead of `Basic base64(":" + key)` | Twenty uses Bearer auth; Affinity uses Basic auth. Mirrors the actual API contract. |
| D-2 | Base URL from `TWENTY_BASE_URL` env (+ https-validate) instead of hardcoded constant | Twenty is per-instance (cloud OR self-hosted). Hardcoding would break self-hosted deployments. This is the P-4 DRIFT-1 requirement. |
| D-3 | Cursor pagination (`starting_after` / `pageInfo.endCursor`) instead of `page_token` | Twenty uses cursor model; Affinity uses opaque token model. Both are internal, all-pages loops. |
| D-4 | Contacts loaded inline via `depth=2` instead of separate per-contact API calls | Twenty REST supports depth-based relation loading; Affinity requires separate `GET /persons/{id}` per person. No `MAX_PERSONS_PER_ORG` cap needed. |
| D-5 | `domain` extracted from `domainName.primaryLinkUrl` (composite object) instead of `org.domain` string | Twenty stores domain as a composite field `{ primaryLinkUrl, primaryLinkLabel }`, not a plain string. Hostname is extracted via `new URL().hostname`. |
| D-6 | [P2-a FOLD] Output `normalizedSourceRecordSchema.safeParse()` on every record | Not present in wave-30 Affinity adapter. Added here per P2-a spec requirement — closes the wave-30 gap. Matches `fixture.adapter.ts:85` pattern. |
| D-7 | `contacts[].title` populated from `person.jobTitle` | Affinity adapter deferred title (custom field required extra calls). Twenty returns `jobTitle` inline. |
| D-8 | Env var name for base URL: `TWENTY_BASE_URL` vs. Twenty SDK canonical `TWENTY_API_URL` | Wave-31 spec explicitly names the var `TWENTY_BASE_URL`. Twenty's own SDK uses `TWENTY_API_URL`. Both documented in SDK doc for future reference. |

---

## Build Checks

- `pnpm -w typecheck` — CLEAN (0 errors)
- `pnpm -w lint` — CLEAN (exit 0; pre-existing warnings in other modules, not introduced by this wave)
- `pnpm --filter @dealflow/api test -- --run` — 1048 tests pass, 18 are the Twenty adapter tests, 120 skipped (DB-gated integration tests, expected)

---

## Security

- `TWENTY_API_KEY` and `TWENTY_BASE_URL` are env-only. Never committed, never hardcoded.
- `.env.example` contains name-only placeholders (no values).
- SSRF guard: `TWENTY_BASE_URL` https-validated before any HTTP call.
- `data-source-admin.ts` config schema is UNTOUCHED (wave-16 secret-sink boundary).
- Grep of diff: no key or URL values present.

---

## Live-Verify Status

DEFERRED to C-2. Requires the founder's Twenty API key + instance URL. The adapter is key-gated: absent key/URL → graceful `[]` return, app boots normally.
