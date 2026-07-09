# Twenty CRM REST API Reference

**Last verified:** 2026-07-08
**Official docs:** https://twenty.com/developers (REST API section) + https://docs.twenty.com/api-reference
**GitHub:** https://github.com/twentyhq/twenty (open-source; server source at `packages/twenty-server/src/engine/api/rest/`)
**Installed version:** REST API (Twenty is open-source, no versioned URL segment; version tracks the running Twenty instance)
**Install location:** N/A (no SDK npm package for this adapter; uses Node.js native `fetch`. Twenty does publish `twenty-client-sdk` but we use native fetch to mirror the Affinity adapter pattern.)

---

## Why REST over GraphQL

Twenty exposes both a REST API and a GraphQL API. This adapter uses REST because:

1. **Simpler read-adapter contract.** We need `GET /rest/companies` (list + paginate) and `GET /rest/people` only. REST is semantically direct — no query-shape management, no fragment composition.
2. **Consistent with the Affinity adapter.** The Affinity wave-30 adapter uses native fetch against a REST API; the Twenty adapter mirrors that pattern exactly.
3. **GraphQL advantage does not apply here.** GraphQL's field-selection power matters for mutations and nested writes; for a read-only sourcing adapter fetching two flat entity types, it adds overhead without benefit.

---

## Official API Surface

Researched from Twenty's open-source server source (`packages/twenty-server/`) on 2026-07-08 and cross-verified against the Twenty REST API docs.

### Authentication

Twenty REST uses **Bearer token authentication**:

```
Authorization: Bearer <TWENTY_API_KEY>
```

The token is a Twenty API key generated from the workspace settings ("Developers → API Keys"). The same token type works for both cloud (`api.twenty.com`) and self-hosted instances.

Twenty's own canonical env var names (from `packages/twenty-shared/src/application/constants/`):

- `TWENTY_API_KEY` — the API key token (source: `DefaultApiKeyName.ts`)
- `TWENTY_API_URL` — the base URL (source: `DefaultApiUrlName.ts`)

This adapter uses `TWENTY_API_KEY` (matches Twenty's own canonical name) and `TWENTY_BASE_URL` (project-chosen name per the wave-31 spec; the spec explicitly calls the var `TWENTY_BASE_URL`). If a future integration uses the official SDK, align on `TWENTY_API_URL`.

### Base URL

**Per-instance — NOT hardcoded.**

- **Twenty Cloud:** `https://api.twenty.com` (cloud-managed instance)
- **Self-hosted:** whatever the operator deployed, e.g. `https://crm.example.com`

The adapter resolves the base URL from `TWENTY_BASE_URL` at call time. The URL **must be HTTPS** (enforced by the adapter's SSRF/misconfig guard).

All REST endpoints are served under the `/rest/` path prefix:

```
<TWENTY_BASE_URL>/rest/companies
<TWENTY_BASE_URL>/rest/people
```

### Public Classes / Functions

No npm SDK package is used by this adapter. Twenty publishes `twenty-client-sdk` (the `RestApiClient` class) but the adapter uses native `fetch` to remain dependency-free and mirror the Affinity pattern.

### Endpoints Used by This Adapter

#### GET /rest/companies

Fetches a paginated list of company records from the workspace.

**Query parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `limit` | integer | No | 60 | Records per page. Maximum: 200 (server-enforced; `QUERY_MAX_RECORDS` constant in `packages/twenty-shared/src/constants/QueryMaxRecords.ts`). Adapter uses 60 (the default, safe large-page value). |
| `starting_after` | string | No | — | Cursor for forward pagination. Pass the previous response's `pageInfo.endCursor` to fetch the next page. |
| `ending_before` | string | No | — | Cursor for backward pagination. Cannot be used together with `starting_after` — server returns 400. |
| `filter` | string | No | — | Filter expression (not used by this adapter — fetches all companies). |
| `order_by` | string | No | — | Order specification (not used by this adapter). |
| `depth` | integer | No | 1 | Relation depth to eager-load. Depth=1 includes associated relation IDs. Depth=2 includes full related objects (used for contacts — see note below). |

**Response shape (from `rest-api-find-many.handler.ts`):**

```json
{
  "data": {
    "companies": [
      {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "name": "Acme Corp",
        "domainName": {
          "primaryLinkUrl": "https://acme.com",
          "primaryLinkLabel": "Acme"
        },
        "createdAt": "2024-01-15T10:30:00.000Z",
        "updatedAt": "2024-01-15T10:30:00.000Z"
      }
    ]
  },
  "totalCount": 1234,
  "pageInfo": {
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startCursor": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "endCursor": "a3c4d5e6-7890-abcd-ef01-234567890abc"
  }
}
```

**Key company fields:**

| Field | Type | Description |
|---|---|---|
| `id` | UUID string | Stable unique identifier (used as `sourceRecordId`) |
| `name` | string | Company name |
| `domainName` | object | Domain info: `{ primaryLinkUrl: string, primaryLinkLabel: string }`. The primary website URL. Extract domain by stripping `https://` / `http://` and trailing paths. |
| `domainName.primaryLinkUrl` | string | Full URL, e.g. `"https://acme.com"` |
| `createdAt` | ISO8601 string | Record creation timestamp |
| `updatedAt` | ISO8601 string | Last update timestamp |

**Note on associated people:** Twenty's REST API supports depth-based relation loading. At `depth=1`, `pointOfContactId` and `people` edge IDs are included. At `depth=1`, full related person objects are included in the response. The adapter fetches companies at `depth=1` to avoid a second round-trip for contacts when available. If the relation is empty or absent, `contacts: []` is returned.

#### GET /rest/people

Fetches a paginated list of person records. Used if company depth-loading does not return contact details.

**Key person fields:**

| Field | Type | Description |
|---|---|---|
| `id` | UUID string | Stable unique identifier |
| `name` | object | `{ firstName: string, lastName: string }` |
| `emails` | object | `{ primaryEmail: string, additionalEmails: string[] }` |
| `jobTitle` | string | Job title / role |
| `companyId` | UUID string | FK to associated company |

**Response shape:** same envelope as `/rest/companies` but `data.people[]`.

### Pagination Model

Twenty REST uses **cursor-based pagination** (keyset pagination over `id`). The implementation is in `packages/twenty-server/src/engine/api/rest/core/handlers/rest-api-find-many.handler.ts` and `packages/twenty-server/src/engine/api/rest/input-request-parsers/`.

**Parameters:**
- `starting_after` — forward-page cursor (opaque string = the `endCursor` from the previous response)
- `ending_before` — backward-page cursor. **Cannot be combined with `starting_after`** (server returns 400 Bad Request).
- `limit` — page size (default 60, max 200)

**Response `pageInfo`:**

```typescript
interface PageInfo {
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  startCursor: string | null;
  endCursor: string | null;
}
```

Source: `packages/twenty-server/src/engine/api/rest/core/handlers/rest-api-base.handler.ts`

**Pagination loop (forward, all pages):**

```
1. GET /rest/companies?limit=60
2. If pageInfo.hasNextPage === true AND pageInfo.endCursor is non-null:
     GET /rest/companies?limit=60&starting_after=<endCursor>
3. Repeat until hasNextPage is false or endCursor is null.
```

**Termination condition:** `pageInfo.hasNextPage === false` OR `pageInfo.endCursor === null` / absent. The adapter checks both conditions — whichever is true first terminates the loop.

**Default limit:** 60 records per page (constant `QUERY_DEFAULT_LIMIT_RECORDS = 60` in `packages/twenty-shared/src/constants/QueryDefaultLimitRecords.ts`).

**Max limit:** 200 per page (constant `QUERY_MAX_RECORDS = 200` in `packages/twenty-shared/src/constants/QueryMaxRecords.ts`). The server enforces this ceiling via `Math.min(limit, QUERY_MAX_RECORDS)`.

### Rate Limits

Twenty does not document explicit per-minute rate limits in the public docs for the REST API (as of 2026-07-08 — *to verify at live-hookup*). The adapter applies conservative defaults:

- **429 Too Many Requests:** adapter backs off and retries (bounded by `MAX_RETRIES`). No `Retry-After` header is documented; adapter uses exponential backoff from `BASE_BACKOFF_MS`.
- **5xx Server errors:** retried up to `MAX_RETRIES` with exponential backoff.

[assumption: no documented rate-limit headers — to verify at live-hookup with founder's Twenty key]

### Error Shapes

Twenty REST returns HTTP status codes with JSON bodies:

```json
{
  "messages": ["Human-readable error message"]
}
```

Or for some errors:

```json
{
  "message": "Human-readable error message",
  "statusCode": 400
}
```

| HTTP Code | Meaning |
|---|---|
| 400 | Bad Request — invalid parameters (e.g. `starting_after` + `ending_before` combined, invalid filter) |
| 401 | Unauthorized — API key missing or invalid |
| 403 | Forbidden — insufficient workspace permissions |
| 404 | Not Found — resource or endpoint does not exist |
| 429 | Too Many Requests — rate limit hit |
| 500 | Internal Server Error — transient; retry |

### Constructor Options / Methods

No SDK. Native fetch with:

- `Authorization: Bearer <TWENTY_API_KEY>` header
- `Content-Type: application/json`
- `AbortController` per-request for timeout

### Normalize Map: Twenty → NormalizedSourceRecord

| NormalizedSourceRecord field | Source | Twenty field / derivation |
|---|---|---|
| `sourceRecordId` | Company | `company.id` (UUID string — used directly, already a string) |
| `name` | Company | `company.name` |
| `domain` | Company | Extracted from `company.domainName.primaryLinkUrl` — strip `https://`/`http://` and trailing path/slash; `undefined` if absent or empty |
| `contacts[]` | Related people | One entry per person associated with the company (via `depth=1` relation loading, or people response filtered by `companyId`) |
| `contacts[].name` | Person | `[person.name.firstName, person.name.lastName].filter(Boolean).join(" ")` or `undefined` if both empty |
| `contacts[].email` | Person | `person.emails.primaryEmail` or first from `person.emails.additionalEmails`; `undefined` if absent |
| `contacts[].title` | Person | `person.jobTitle`; `undefined` if absent or empty |
| `raw` | Company | Full raw Twenty company JSON object |

### Runtime Literals

Values the Twenty API owns at runtime. Hardcoding any of these wrong = silent prod failure.

| Category | What | Value / Citation |
|---|---|---|
| Env var names (Twenty SDK canonical) | API key | `TWENTY_API_KEY` — `packages/twenty-shared/src/application/constants/DefaultApiKeyName.ts` |
| Env var names (Twenty SDK canonical) | Base URL | `TWENTY_API_URL` — `packages/twenty-shared/src/application/constants/DefaultApiUrlName.ts` |
| Env var names (this adapter) | API key | `TWENTY_API_KEY` (matches Twenty canonical) |
| Env var names (this adapter) | Base URL | `TWENTY_BASE_URL` (project-spec name; spec says TWENTY_BASE_URL; note: Twenty SDK uses TWENTY_API_URL) |
| Cookie names | N/A — REST API uses Authorization Bearer, no cookies | N/A — verified: Twenty REST API is stateless/keyless |
| Cookie prefixes | N/A | N/A |
| HTTP headers (auth) | Authorization header | `Authorization: Bearer <apiKey>` |
| HTTP headers (content) | Content-Type | `Content-Type: application/json` |
| JWT/JWE claims | N/A — API key is an opaque token, not a JWT for this adapter use case | N/A — verified |
| Default ports / paths | Base path prefix | `/rest/` — all REST endpoints under `<TWENTY_BASE_URL>/rest/` |
| Default page size | `QUERY_DEFAULT_LIMIT_RECORDS` | `60` — `packages/twenty-shared/src/constants/QueryDefaultLimitRecords.ts` |
| Max page size | `QUERY_MAX_RECORDS` | `200` — `packages/twenty-shared/src/constants/QueryMaxRecords.ts` |
| Error codes / classes | HTTP status codes | 400 / 401 / 403 / 404 / 429 / 500 |
| Log line formats | N/A — no SDK-emitted logs (no npm SDK used) | N/A |
| Version negotiation strings | N/A — no version negotiation; no required User-Agent | N/A |
| Pagination fields | Response cursor fields | `pageInfo.endCursor` (string or null), `pageInfo.hasNextPage` (boolean) — `rest-api-base.handler.ts` |
| Pagination fields | Request cursor param | `starting_after` (query param) — `parse-starting-after-rest-request.util.ts` |
| Companies list response key | Array key in data envelope | `data.companies[]` — `rest-api-find-many.handler.ts`: `data[objectNamePlural]` where plural = `companies` |
| People list response key | Array key in data envelope | `data.people[]` — same envelope |

## Platform Compatibility

**Deploy platform: Railway (NestJS API service)**

- The adapter uses Node.js native `fetch` (Node 18+). Railway runs Node 18+. No polyfill needed.
- `AbortController` is globally available in Node 18+. No import needed.
- `TWENTY_API_KEY` and `TWENTY_BASE_URL` are set on the Railway `dealflow-api` service env vars.
- If either var is absent, the adapter logs a warning and returns `[]` — app boots normally (fixture and Affinity adapters continue to work).

**Build-time:** No build-time concerns — adapter is pure runtime code.

**Edge runtime:** N/A — runs in the NestJS server process.

## Known Gotchas

1. **`starting_after` and `ending_before` cannot be combined** — server returns 400. The adapter only uses `starting_after` for forward pagination.
2. **`limit` is server-capped at 200** — passing a higher value is silently floored to 200 by the server (`Math.min(limit, QUERY_MAX_RECORDS)`).
3. **`domainName` is a composite field** — it is not a plain string but an object `{ primaryLinkUrl, primaryLinkLabel }`. The adapter must extract the domain from `primaryLinkUrl` (strip scheme and path).
4. **Base URL is per-instance** — there is no single canonical base URL. Twenty Cloud uses `https://api.twenty.com` but self-hosted instances use their own domain. The adapter reads `TWENTY_BASE_URL` and https-validates it.
5. **HTTPS enforcement** — Twenty Cloud runs on HTTPS. The adapter performs an SSRF/misconfig guard: if `TWENTY_BASE_URL` is not `https://`, the adapter logs a warning and returns `[]` without making any HTTP calls.
6. **Person data via depth=1** — fetching associated people inline (depth=1) avoids per-company person calls. If a company has no people, the companies endpoint returns an empty array for the relation. The adapter handles absent/empty gracefully.
7. **No official rate-limit headers documented** — the adapter uses exponential backoff on 429. [to verify at live-hookup]
8. **Cursor is opaque** — the `endCursor` from `pageInfo` is an opaque string (UUID in practice, but treat as opaque). Pass it verbatim as `starting_after`.

## Documentation Links

- REST API Overview: https://twenty.com/developers
- API Reference: https://docs.twenty.com/api-reference/overview
- Server source — find-many handler: `packages/twenty-server/src/engine/api/rest/core/handlers/rest-api-find-many.handler.ts`
- Server source — base handler (PageInfo type): `packages/twenty-server/src/engine/api/rest/core/handlers/rest-api-base.handler.ts`
- Server source — pagination utils: `packages/twenty-server/src/engine/api/rest/metadata/utils/paginate-by-id-cursor.util.ts`
- Twenty Client SDK: `packages/twenty-client-sdk/src/rest/index.ts`
- Shared constants (limits): `packages/twenty-shared/src/constants/QueryDefaultLimitRecords.ts`, `QueryMaxRecords.ts`
- GitHub: https://github.com/twentyhq/twenty
- GitHub Issues: https://github.com/twentyhq/twenty/issues

---

## Integration-Specific Findings

### Our adapter patterns

- `providerKey = 'TWENTY'` — registry lookup is case-insensitive (uppercased).
- Env vars: `TWENTY_API_KEY` (matches Twenty canonical name) + `TWENTY_BASE_URL` (project spec name — note Twenty SDK uses `TWENTY_API_URL` as canonical URL var name; document both for clarity).
- Auth header: `Authorization: Bearer <apiKey>` (not Basic auth — differs from Affinity).
- SSRF guard: adapter validates `TWENTY_BASE_URL` parses as a valid URL with `scheme === 'https'` before any HTTP call.
- Pagination: forward-only cursor loop: `starting_after=<endCursor>` until `pageInfo.hasNextPage === false` or `endCursor === null`.
- Contacts: fetched inline via `depth=1` relation loading on `/rest/companies` — avoids per-company person round-trips.
- `domainName` extraction: `primaryLinkUrl` stripped of `https://`/`http://` prefix and trailing slashes/paths → adapter stores the hostname as `domain`.
- P2-a output-validation: adapter safeParses each normalized record against `normalizedSourceRecordSchema` (skip + warn on failure) — closes the wave-30 Affinity gap.
- Partial failure: a page fetch failure logs an error and returns all records collected so far.
- 429 backoff: exponential from `BASE_BACKOFF_MS` (no documented Twenty rate-limit reset header; update after live-hookup).

### Env var configuration on our platforms

- Railway: set `TWENTY_API_KEY` and `TWENTY_BASE_URL` on the `dealflow-api` service.
- `.env.example`: both name-only, no values.
- If either is absent: adapter logs a warning at `fetchCompanies` call time, returns `[]`. Does NOT throw. App boots normally.

### Bugs we hit and how we solved them

(None yet — first integration; update after live-hookup at C-2)

### What differed from the official docs

(Update after live-hookup at C-2 with the founder's Twenty API key + instance URL)
