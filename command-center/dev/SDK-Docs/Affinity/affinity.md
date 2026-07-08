# Affinity REST API Reference

**Last verified:** 2026-07-08
**Official docs:** https://api-docs.affinity.co (v1 — the widely-documented production version)
**GitHub:** N/A — Affinity has no official open-source Node SDK; this documents the REST API directly.
**Installed version:** REST API v1 (no versioning segment in base URL; Affinity uses date-based changelog, not URL versioning)
**Install location:** N/A (no SDK package; the adapter uses Node.js native `fetch` / `undici`)

---

## Official API Surface

(Researched from https://api-docs.affinity.co on 2026-07-08 — live HTML doc, fully reachable)

### Authentication

Affinity v1 supports two equivalent auth schemes:

**HTTP Basic Auth (preferred for server-to-server):**
- Provide the API key as the **password** field of HTTP Basic Auth. The username field is empty.
- curl canonical form: `curl "https://api.affinity.co/..." -u ":$APIKEY"`
- Header equivalent: `Authorization: Basic base64(":" + apiKey)` — note the leading colon; empty string username, apiKey as password.

**HTTP Bearer Auth (alternative):**
- `Authorization: Bearer $APIKEY`

API keys are generated in Affinity Settings → Manage Apps. Keys can optionally have an IP Allowlist. An invalid key returns HTTP 401.

**Note on Basic Auth encoding:** The docs show `-u :$APIKEY` (colon then key = empty-username:key). The `btoa(":" + apiKey)` encoding is correct. The adapter uses `Authorization: Basic ${Buffer.from(":" + apiKey).toString("base64")}`.

### Base URL

```
https://api.affinity.co
```

All v1 endpoints are at this base with no version path segment.

### Public classes / functions

No official Node SDK — use native HTTP.

### Endpoints Used by This Adapter

#### GET /organizations

Fetches all organizations matching an optional search term. Used by the adapter to export the full organization list.

**Query parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `term` | string | false | Search term matching org name or domain. **Omit or leave empty to return all orgs.** |
| `page_size` | integer | false | Records per page. Default: all records (no pagination). Recommended: 500 for paginated fetches. |
| `page_token` | string | false | Token from previous response's `next_page_token`; required to fetch subsequent pages. Must be paired with the same `page_size` and `term` on every page. |
| `with_opportunities` | boolean | false | When true, includes `opportunity_ids` on each org. Not needed for this adapter. |
| `with_interaction_dates` | boolean | false | Include interaction dates. Orgs with no interactions are excluded when this is true — do NOT use for full export. |

**Response (paginated — when `page_size` is supplied):**

```json
{
  "organizations": [
    {
      "id": 64779194,
      "name": "Affinity",
      "domain": "affinity.co",
      "domains": ["affinity.co"],
      "global": false,
      "person_ids": [89734, 117270, 138123],
      "opportunity_ids": [12345]
    }
  ],
  "next_page_token": "eyJwYXJhbXMiOnsidGVybSI6IiJ9LCJwYWdlX3NpemUiOjUsIm9mZnNldCI6MTB9"
}
```

**Pagination contract:**
- `next_page_token` is present when there MAY be more results. Its absence means all records have been fetched.
- `next_page_token: null` explicitly signals the last page (no more records).
- An empty `organizations` array with a present token means the next page is empty — the adapter must check for `null` or absence of `next_page_token`, NOT for empty array.
- All query parameters except `page_token` must remain identical across pages; changing them returns `422 Invalid page_token variable`.

**Response (un-paginated — when `page_size` is omitted):**

Returns a plain array of organization objects (not wrapped in `{ organizations, next_page_token }`). Suitable for small datasets only; for large orgs the paginated form is required to avoid timeouts.

#### GET /organizations/{organization_id}

Fetches a single organization by integer ID. Returns the same organization resource shape as the list. Includes `person_ids` array (integers). Optional `with_opportunities=true` adds `opportunity_ids`.

**Not used by the primary adapter loop** — the list endpoint provides `person_ids` already.

#### GET /persons/{person_id}

Fetches a single person by integer ID.

**Response:**

```json
{
  "id": 38706,
  "type": 0,
  "first_name": "John",
  "last_name": "Doe",
  "primary_email": "john@affinity.co",
  "emails": ["john@affinity.co", "jdoe@alumni.stanford.edu"],
  "organization_ids": [1687449]
}
```

**Contact hydration strategy:** Each org in the list response includes `person_ids` (integer array). To get contact details (name + email), the adapter must call `GET /persons/{person_id}` per person. This is expensive for large person lists. **The adapter fetches persons for each org using the person_ids array but caps per-org person fetches** to avoid exhausting rate limits (documented in adapter: `MAX_PERSONS_PER_ORG = 10`). [assumption: cap value — to verify at live-hookup; documented as adapter decision]

#### GET /rate-limit

Returns current rate limit state and usage. Not used by the adapter (rate limit info is present in response headers on every call).

### Organization Resource Fields

| Field | Type | Description |
|---|---|---|
| `id` | integer | Stable unique identifier (used as `sourceRecordId`) |
| `name` | string | Organization name |
| `domain` | string | Primary website domain (e.g. `"affinity.co"`) |
| `domains` | string[] | All associated domains |
| `global` | boolean | Whether the org is from Affinity's global database vs. local instance |
| `person_ids` | integer[] | IDs of persons associated with the org |
| `opportunity_ids` | integer[] | IDs of associated opportunities |

### Person Resource Fields

| Field | Type | Description |
|---|---|---|
| `id` | integer | Stable unique identifier |
| `type` | integer | 0 = internal person, 1 = external person |
| `first_name` | string | First name |
| `last_name` | string | Last name |
| `primary_email` | string | Primary email address |
| `emails` | string[] | All known email addresses |
| `organization_ids` | integer[] | IDs of associated organizations |

### Pagination

Affinity v1 uses **cursor-based pagination via opaque tokens** (not offset-based):

- Request parameter: `page_token` (string, opaque base64 token)
- Response field: `next_page_token` (string or `null`)
- Page size parameter: `page_size` (integer; default = return all, no pagination)
- The token encodes `{ params, page_size, offset }` internally (e.g. `eyJwYXJhbXMiOnsidGVybSI6IiJ9LCJwYWdlX3NpemUiOjUsIm9mZnNldCI6MTB9` decodes to `{"params":{"term":""},"page_size":5,"offset":10}`)
- **Termination condition:** `next_page_token` is `null` or absent.
- **Loop invariant:** same `term` + same `page_size` must accompany every `page_token` request.

### Rate Limits

**Per-minute (user-level):** 900 requests per user per minute. Applies to all API calls.

**Monthly (account-level):**

| Plan Tier | Calls per month |
|---|---|
| Essentials | None (unlimited) |
| Scale | 100,000 |
| Advanced | 100,000 |
| Enterprise | Unlimited* |
| Professional (Legacy) | None (unlimited) |
| Premium (Legacy) | 100,000 |
| Enterprise (Legacy) | Unlimited* |

*Per-minute and concurrent limits still apply even for unlimited-monthly tiers.

**Rate limit response headers (on every API call):**

| Header | Description |
|---|---|
| `X-Ratelimit-Limit-User` | Requests allowed per minute for this user |
| `X-Ratelimit-Limit-User-Remaining` | Requests remaining in current minute window |
| `X-Ratelimit-Limit-User-Reset` | Seconds until the per-minute window resets |
| `X-Ratelimit-Limit-Org` | Monthly requests allowed for the account |
| `X-Ratelimit-Limit-Org-Remaining` | Monthly requests remaining |
| `X-Ratelimit-Limit-Org-Reset` | Seconds until the monthly window resets |

**Rate limit exceeded:** HTTP 429. The docs do not document a `Retry-After` header explicitly, but the adapter treats the `X-Ratelimit-Limit-User-Reset` header value (seconds) as the backoff duration when present; falls back to exponential backoff starting at 1s if the header is absent. [assumption: `Retry-After` not in documented headers — to verify at live-hookup; X-Ratelimit-Limit-User-Reset is documented and used as the reset signal]

### Error Shapes

Affinity returns JSON for all errors. The response body is:

```json
{
  "message": "Human-readable error description"
}
```

Or for validation errors (422):

```json
{
  "message": "Invalid page_token variable"
}
```

| HTTP Code | Meaning |
|---|---|
| 401 | Unauthorized — API key invalid or missing |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found — resource does not exist |
| 422 | Unprocessable Entity — malformed parameters (e.g. mismatched page_token) |
| 429 | Too Many Requests — rate limit exceeded |
| 500 | Internal Server Error — transient; retry |
| 503 | Service Unavailable — transient; retry |

### Constructor Options / Methods

No SDK — native fetch. No constructor options. The adapter configures:
- `Authorization` header (Basic auth, key from env)
- `Content-Type: application/json` (on requests with bodies; none needed for GET)
- `AbortController` per-request for timeout

### Runtime Literals

Values the Affinity API owns at runtime. Hardcoding any of these wrong = silent prod failure.

| Category | What | Value / Citation |
|---|---|---|
| Env var names | API key var name used by this adapter | `AFFINITY_API_KEY` (project-defined; matches `providerKey` resolution pattern) |
| Cookie names | N/A — REST API uses Authorization header, no cookies | N/A — verified: Affinity API is stateless/keyless, no cookies |
| Cookie prefixes | N/A | N/A |
| HTTP headers (auth) | Authorization header scheme | `Authorization: Basic base64(":" + apiKey)` OR `Authorization: Bearer apiKey` — docs: https://api-docs.affinity.co #authentication |
| HTTP headers (rate limit) | Rate limit signal headers | `X-Ratelimit-Limit-User`, `X-Ratelimit-Limit-User-Remaining`, `X-Ratelimit-Limit-User-Reset`, `X-Ratelimit-Limit-Org`, `X-Ratelimit-Limit-Org-Remaining`, `X-Ratelimit-Limit-Org-Reset` — docs: https://api-docs.affinity.co #rate-limit-headers |
| JWT/JWE claims | N/A — no JWT in Affinity v1 REST | N/A — verified |
| Default ports / paths | Base URL | `https://api.affinity.co` (no port, no version segment) — docs: https://api-docs.affinity.co #requests-amp-responses |
| Error codes / classes | HTTP status codes | 401 / 403 / 404 / 422 / 429 / 500 / 503 — docs: https://api-docs.affinity.co #requests-amp-responses |
| Log line formats | N/A — no SDK-emitted logs | N/A |
| Version negotiation strings | N/A — no version negotiation, no User-Agent requirement | N/A |
| Pagination fields | Response key for page token | `next_page_token` (string or null) — docs: https://api-docs.affinity.co #search-for-organizations |
| Pagination fields | Request param for page token | `page_token` (query param) — docs: https://api-docs.affinity.co #search-for-organizations |
| Org list response key | Array key in paginated response | `organizations` — docs: https://api-docs.affinity.co #search-for-organizations |

## Normalize Map: Affinity → NormalizedSourceRecord

This is the field mapping from an Affinity organization (+ optionally fetched persons) to the `NormalizedSourceRecord` shape from `@dealflow/shared`.

| NormalizedSourceRecord field | Source | Affinity field / derivation |
|---|---|---|
| `sourceRecordId` | Affinity org | `String(org.id)` — Affinity integer org ID stringified |
| `name` | Affinity org | `org.name` |
| `domain` | Affinity org | `org.domain ?? org.domains?.[0]` — primary domain, falling back to first in domains array; `undefined` if both absent |
| `contacts[]` | Fetched persons | One entry per person fetched (bounded by `MAX_PERSONS_PER_ORG`) |
| `contacts[].name` | Person | `[first_name, last_name].filter(Boolean).join(" ")` or `undefined` if both absent |
| `contacts[].email` | Person | `person.primary_email ?? person.emails?.[0]` or `undefined` if absent |
| `contacts[].title` | N/A | `undefined` — Affinity v1 does not return title/role on the person resource directly (custom field values would require additional API calls — deferred to LATER per hard_boundaries) |
| `raw` | Affinity org | Full raw Affinity organization JSON object |

## Zod Response Types (Internal to Adapter)

These Zod schemas validate Affinity API responses at the network boundary. They are internal to `affinity.adapter.ts` and not exported.

```typescript
// AffinityOrganization — shape of each org in GET /organizations response
const affinityOrganizationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  domain: z.string().nullable().optional(),
  domains: z.array(z.string()).optional(),
  person_ids: z.array(z.number().int()).optional(),
  global: z.boolean().optional(),
}).passthrough(); // allow additional fields from future API additions

// GET /organizations paginated response
const affinityOrganizationsResponseSchema = z.object({
  organizations: z.array(affinityOrganizationSchema),
  next_page_token: z.string().nullable().optional(),
}).passthrough();

// AffinityPerson — shape of GET /persons/{id} response
const affinityPersonSchema = z.object({
  id: z.number().int(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  primary_email: z.string().nullable().optional(),
  emails: z.array(z.string()).optional(),
}).passthrough();
```

All schemas use `.passthrough()` to tolerate additional fields added by Affinity without breaking existing parses. A Zod parse failure on any individual organization page or person → logged warning + that org/person is skipped; the adapter never crashes on a malformed response.

## Platform Compatibility

**Deploy platform: Railway (NestJS API service)**

- The adapter uses Node.js native `fetch` (available in Node 18+; Railway runs Node 18+). No polyfill required.
- `AbortController` is available globally in Node 18+. No import needed.
- The `AFFINITY_API_KEY` env var is set on the Railway `dealflow-api` service. The adapter reads it via `process.env.AFFINITY_API_KEY`.
- No Railway-specific gotchas beyond standard env var injection. The adapter registers at module init; if the key is absent it logs a warning and the adapter is registered but returns empty arrays — the app boots normally.

**Build-time:** No build-time concerns; the adapter is pure runtime code with no build-time SDK calls.

**Edge runtime:** N/A — the adapter runs in the NestJS server process, not at the edge.

## Known Gotchas

1. **`with_interaction_dates=true` excludes orgs with no interactions** — do NOT use this parameter when exporting all orgs. Omit it.
2. **`page_size` omission returns all results un-paginated** — this is a single large response rather than a paginated stream. Use `page_size` (recommended: 500) for large datasets.
3. **Changing query params mid-pagination returns 422** — the `term`, `page_size`, and all other params must be identical on every page request; only `page_token` changes.
4. **`next_page_token` present does NOT guarantee more records** — the next page may be empty. The adapter must treat `null` or absent `next_page_token` as the termination signal, not an empty array.
5. **Person contact hydration is expensive** — each person requires a separate `GET /persons/{id}` call. The adapter caps person fetches per org (`MAX_PERSONS_PER_ORG`) to stay within rate limits. Full contact resolution (all persons) is deferred to LATER.
6. **Authentication: empty username, not empty password** — the curl form `-u :$APIKEY` means the key goes in the password slot. `Buffer.from(":" + apiKey).toString("base64")` is the correct encoding, not `Buffer.from(apiKey + ":").toString("base64")`.
7. **No official Node SDK** — all HTTP must be implemented manually. Affinity has no npm package.
8. **Concurrent request limits** — Affinity does not publish the exact concurrent limit; do not fire all pagination requests in parallel; use sequential page fetching.

## Documentation Links

- Getting Started / Auth / Rate Limits: https://api-docs.affinity.co (primary reference, fully researched 2026-07-08)
- Organizations endpoint: https://api-docs.affinity.co/#organizations
- Persons endpoint: https://api-docs.affinity.co/#persons
- Rate Limit Headers: https://api-docs.affinity.co/#rate-limit-headers
- GitHub Issues: N/A (no open-source SDK repository)
- Changelog: https://api-docs.affinity.co/#changelog

---

## Integration-Specific Findings

### Our adapter patterns

- `providerKey = 'AFFINITY'` — registry lookup is case-insensitive (uppercased); env key is `AFFINITY_API_KEY` (matches `process.env[providerKey]` where providerKey = 'AFFINITY').
- Pagination loop: sequential `page_token` requests until `next_page_token` is `null` or absent. Page size set to 500.
- Person hydration: adapter fetches `person_ids` from the org list response and calls `GET /persons/{id}` per person, capped at `MAX_PERSONS_PER_ORG = 10` per org to stay within 900 req/min rate limit.
- Partial failure: a single page fetch failure logs an error and returns all records collected so far (not a full abort).
- 429 backoff: reads `X-Ratelimit-Limit-User-Reset` header (seconds) from the response; falls back to exponential backoff (1s, 2s, 4s…) if header absent.
- Boundary Zod validation: each page response and each person response is validated via internal Zod schemas; malformed responses are logged and skipped.

### Env var configuration on our platforms

- Railway: set `AFFINITY_API_KEY` on the `dealflow-api` service. The adapter reads `process.env.AFFINITY_API_KEY`.
- `.env.example`: `AFFINITY_API_KEY=` (name only, no value).
- If unset: adapter logs a warning at `fetchCompanies` call time, returns `[]`, does NOT throw. App boots normally.

### Bugs we hit and how we solved them

(None yet — first integration; update after live-hookup at C-2)

### What differed from the official docs

(Update after live-hookup at C-2 with the founder's key)
