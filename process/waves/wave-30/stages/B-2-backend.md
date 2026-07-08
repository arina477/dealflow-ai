# Wave 30 — B-2 Backend

**Stage:** B-2 (Backend — external SDK integration)
**Task:** 345dfbc6 — M9 Affinity DataSourceAdapter
**Date:** 2026-07-08
**SDK Reference:** command-center/dev/SDK-Docs/Affinity/affinity.md

---

## SDK doc (B-1 — authored FIRST)

**File:** `command-center/dev/SDK-Docs/Affinity/affinity.md`

Affinity REST API v1 — live-fetched from https://api-docs.affinity.co on 2026-07-08.

Key facts documented:

**Auth:** HTTP Basic Auth — empty username, API key as password: `Authorization: Basic base64(":" + apiKey)`. OR `Authorization: Bearer apiKey`. The adapter uses Basic (canonical server-to-server form from docs).

**Endpoints used:**
- `GET /organizations` — paginated org list (page_size + page_token). Returns `{ organizations: [], next_page_token }`.
- `GET /persons/{id}` — single person fetch for contact hydration.

**Pagination:** cursor-based via `page_token` / `next_page_token`. Termination = `next_page_token` is `null` or absent. All query params (term, page_size) must be identical across pages.

**Rate limits:** 900 req/user/min. 429 on limit hit. Rate limit headers: `X-Ratelimit-Limit-User-Reset` (seconds until window resets) — used by adapter for backoff.

**Error shapes:** JSON `{ "message": "..." }`. HTTP codes: 401 / 403 / 404 / 422 / 429 / 500 / 503.

**No official Node SDK** — REST only. Native `fetch` used.

**Registry row added:** `command-center/dev/SDK-Docs/registry.md` updated.

---

## Adapter implementation

**File:** `apps/api/src/modules/sourcing/adapters/affinity.adapter.ts`

### providerKey

`readonly providerKey = 'AFFINITY'`

Registry lookup is case-insensitive (uppercased). The adapter registers under `'AFFINITY'`.

### Env key (NOTE-1 deviation — documented)

**ENV VAR:** `AFFINITY_API_KEY`

**NOTE-1 deviation:** The interface contract states "credentials resolved from `process.env[providerKey]`", which would be `process.env['AFFINITY']`. However, `process.env['AFFINITY']` is not a meaningful env var name. The adapter uses the concrete, descriptive name `AFFINITY_API_KEY` (documented in `.env.example`). This is consistent with the fixture adapter pattern (which ignores env entirely) and documented explicitly in the adapter's JSDoc. The providerKey `'AFFINITY'` is used for registry lookup, not as a raw env var suffix. All other adapters in the project will follow this same pattern (concrete name, not raw providerKey).

### Graceful no-key (absent-key no-op)

If `process.env.AFFINITY_API_KEY` is unset or empty:
- Logs a warning to `console.warn`
- Returns `[]` immediately
- Does NOT throw
- The app boots normally; the fixture adapter search still works

### Pagination (ALL pages)

```
page_token loop:
  1. GET /organizations?page_size=500&term=&[page_token=TOKEN]
  2. Boundary-Zod-validate response (affinityOrganizationsResponseSchema)
  3. Collect organizations[]
  4. If next_page_token is null or absent → done
  5. Else set pageToken = next_page_token → goto 1
```

Page size: 500. Empty term = all orgs (no search filter). Sequential (not parallel — concurrent request limits undocumented by Affinity).

### 429 backoff

On HTTP 429:
1. Read `X-Ratelimit-Limit-User-Reset` response header (seconds until window resets)
2. If present: `backoffMs = parseInt(resetHeader) * 1000` (minimum 1s)
3. If absent: exponential `backoffMs = BASE_BACKOFF_MS * 2^attempt` (1s, 2s, 4s…)
4. `sleep(backoffMs)` then retry
5. After `MAX_RETRIES` (3) retries: return `{ ok: false, status: 429 }` → partial failure

### 5xx / network retry

On HTTP 500 / 503 or network error (including AbortError from timeout):
- Retry with exponential backoff up to `MAX_RETRIES = 3`
- Exhausted → throw (caught by fetchCompanies → partial failure: return records so far)

### Per-request timeout

`AbortController` with `REQUEST_TIMEOUT_MS = 30_000ms`. Timer cleared in `finally`.

### NOTE-3: Boundary Zod validation

Every network response (org pages + person fetches) validated via internal Zod schemas:
- `affinityOrganizationSchema` — per-org shape
- `affinityOrganizationsResponseSchema` — paginated page shape
- `affinityPersonSchema` — person shape

Parse failure → `console.error` + skip (for pages: return records so far; for persons: skip that person and keep the org). Never crashes on a malformed Affinity response.

### Partial failure

A page fetch error (network exhausted OR HTTP error OR Zod failure):
- Logs the error
- `break`s the pagination loop
- Returns all records collected on prior pages
- Never throws from `fetchCompanies`

### NOTE-2: No healthCheck, no shared withRetry

All robustness is inlined in `fetchCompanies`. No `healthCheck` method (aspirational, not in the shipped interface). No `withRetry` helper exported or shared. Per binding constraints.

### Normalize map

| NormalizedSourceRecord | Source |
|---|---|
| `sourceRecordId` | `String(org.id)` |
| `name` | `org.name` |
| `domain` | `org.domain ?? org.domains?.[0]` |
| `contacts[].name` | `[first_name, last_name].filter(Boolean).join(" ")` |
| `contacts[].email` | `person.primary_email ?? person.emails?.[0]` |
| `contacts[].title` | `undefined` (Affinity v1 persons have no title field) |
| `raw` | Full Affinity org JSON |

Person hydration: fetches `person_ids` from the org list response, calls `GET /persons/{id}` per person, capped at `MAX_PERSONS_PER_ORG = 10` per org.

### Registry wiring

`adapter.registry.ts` — `createDefaultRegistry()` updated to register `AffinityDataSourceAdapter`:

```typescript
registry.register(new AffinityDataSourceAdapter());
```

Provider key `'AFFINITY'` resolves to this adapter. The module uses `createDefaultRegistry()` unchanged.

---

## Secret

**Name:** `AFFINITY_API_KEY`
**Location:** `.env.example` (name only, no value)
**Production:** Railway `dealflow-api` service env var
**NEVER committed.** Grep of diff confirms no key value in any committed file.

---

## Tests

**File:** `apps/api/src/modules/sourcing/adapters/affinity.adapter.spec.ts`

All HTTP mocked via `vi.stubGlobal('fetch', mockFn)` — NO live Affinity HTTP.
`setTimeout` stubbed to instant resolution in backoff tests.

| # | Test | Method |
|---|---|---|
| 1 | Multi-page pagination (3 pages) — fetches ALL, returns all 6 records | `mockFetch` call counter per page_token; verifies orgFetchCount === 3 |
| 2 | 429 → backoff → retry → success | First call 429 with `X-Ratelimit-Limit-User-Reset: 1`, second call 200 |
| 3 | 5xx transient retry | First call 503, second call 200 |
| 4 | Timeout (AbortError) | All calls reject with AbortError; returns [], logs error |
| 5 | Normalize (Affinity org + person → NormalizedSourceRecord) | Verifies sourceRecordId/name/domain/contacts[].name/email |
| 6 | Absent-key no-op | No `AFFINITY_API_KEY` → returns [], no throw, warns |
| 7 | Partial failure (page 2 errors) | Page 1 succeeds, page 2 network-fails after retries; returns page 1 records |
| 8 | Boundary Zod (malformed page response) | Returns [], logs error with "failed Zod validation" |
| + | domain from domains[] fallback | `org.domain = null`, `domains = ['fallback.io']` → uses domains[0] |
| + | No domain | org without domain → `domain: undefined` |
| + | Malformed person Zod | Person fails Zod → org returned with empty contacts, warning logged |
| + | Auth header format | Verifies `Authorization: Basic base64(":"+key)` encoding |
| + | providerKey value | `adapter.providerKey === 'AFFINITY'` |

**Result:** 13/13 tests pass. Full sourcing suite 144/144 pass.

---

## typecheck + lint

- `pnpm -w typecheck`: CLEAN (4/4 tasks successful)
- `pnpm exec biome check` on all new/modified files: CLEAN

---

## App boots without key

`sourcing.di-boot.spec.ts` (5/5 pass) — the NestJS module boots without `AFFINITY_API_KEY`. The adapter registers; `fetchCompanies` returns `[]` gracefully if called without the key.

---

## Deviations from spec

1. **NOTE-1 env var name:** Spec says `process.env[providerKey]`; adapter uses `process.env.AFFINITY_API_KEY`. Deviation documented in adapter JSDoc and this file. Rationale: `process.env['AFFINITY']` is not a usable convention; concrete descriptive names are standard across all real adapters.

2. **Contact title:** `contacts[].title` is always `undefined`. Affinity v1 persons resource has no `title` field on the base object (requires custom field values lookup — deferred per `hard_boundaries: LATER`).

3. **Person hydration cap:** `MAX_PERSONS_PER_ORG = 10` per org. This is an adapter-authored constant (not in spec) to prevent exhausting the 900 req/min rate limit. Documented in SDK doc and adapter JSDoc.

4. **`Retry-After` header:** Affinity docs do not document a `Retry-After` header. The adapter uses `X-Ratelimit-Limit-User-Reset` (documented) instead. Marked as "to verify at live-hookup (C-2)" in SDK doc.

---

## LIVE-verify

Deferred to C-2 (founder's AFFINITY_API_KEY required). The adapter is wired and ready; the key triggers the live org fetch.
