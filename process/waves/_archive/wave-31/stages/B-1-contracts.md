# Wave 31 — B-1 Contracts (Twenty CRM DataSourceAdapter)

**Stage:** B-1 — Interface contracts, Zod schemas, SDK research
**Task:** 1eb63a40 (M9 Twenty CRM DataSourceAdapter)
**SDK Reference:** command-center/dev/SDK-Docs/Twenty/twenty.md

---

## SDK Research Summary (B-1 deliverable)

### Twenty REST API — Verified from open-source source code + official docs (2026-07-08)

**Research method:** Twenty is fully open-source. Sources consulted:
- `packages/twenty-server/src/engine/api/rest/core/handlers/rest-api-find-many.handler.ts` — response envelope + PageInfo
- `packages/twenty-server/src/engine/api/rest/core/handlers/rest-api-base.handler.ts` — PageInfo interface definition
- `packages/twenty-server/src/engine/api/rest/input-request-parsers/` — limit, starting_after, ending_before parsers
- `packages/twenty-shared/src/constants/QueryDefaultLimitRecords.ts` — default=60
- `packages/twenty-shared/src/constants/QueryMaxRecords.ts` — max=200
- `packages/twenty-shared/src/application/constants/DefaultApiKeyName.ts` — canonical env var = `TWENTY_API_KEY`
- `packages/twenty-shared/src/application/constants/DefaultApiUrlName.ts` — canonical env var = `TWENTY_API_URL`
- `packages/twenty-server/src/engine/api/rest/metadata/utils/paginate-by-id-cursor.util.ts` — cursor implementation

### Why REST over GraphQL

REST chosen for this read adapter:
- Simpler semantics for two GET endpoints (companies, people).
- Mirrors the Affinity adapter pattern (native fetch, no SDK dependency).
- GraphQL's field-selection advantage does not apply to a flat read-only adapter.

### Auth

`Authorization: Bearer <TWENTY_API_KEY>` — not Basic auth (differs from Affinity).

### Env vars

| Adapter var | Twenty canonical | Notes |
|---|---|---|
| `TWENTY_API_KEY` | `TWENTY_API_KEY` | Matches exactly — Twenty SDK uses this name |
| `TWENTY_BASE_URL` | `TWENTY_API_URL` | Spec names it TWENTY_BASE_URL; Twenty SDK uses TWENTY_API_URL — deviation noted |

### Pagination model

Cursor-based (keyset over UUID `id`):
- Request: `starting_after=<endCursor>` + `limit=60`
- Response: `pageInfo.hasNextPage` (boolean) + `pageInfo.endCursor` (string|null)
- Termination: `hasNextPage === false` OR `endCursor === null`
- Max page size: 200 (server-enforced)

### Response envelope

```json
{
  "data": { "companies": [...] },
  "totalCount": 1234,
  "pageInfo": {
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startCursor": "uuid-a",
    "endCursor": "uuid-b"
  }
}
```

### Normalize map

| NormalizedSourceRecord | Twenty source |
|---|---|
| `sourceRecordId` | `company.id` (UUID string, used directly) |
| `name` | `company.name` |
| `domain` | Extracted from `company.domainName.primaryLinkUrl` — strip scheme + path |
| `contacts[].name` | `[person.name.firstName, person.name.lastName].filter(Boolean).join(" ")` |
| `contacts[].email` | `person.emails.primaryEmail \|\| person.emails.additionalEmails[0]` |
| `contacts[].title` | `person.jobTitle` (if present + non-empty) |
| `raw` | Full company JSON |

### Boundary Zod schemas (internal, adapter-side)

All use `.passthrough()` to tolerate future Twenty API additions:
- `twentyCompaniesResponseSchema` — validates `{ data: { companies[] }, pageInfo }`
- `twentyCompanySchema` — validates each company record
- `twentyPersonSchema` — validates each embedded person
- `twentyDomainNameSchema` — validates `{ primaryLinkUrl, primaryLinkLabel }`

---

## Interface Reuse

No new interfaces authored. The adapter implements the existing `DataSourceAdapter` interface from `@dealflow/shared`:

```typescript
interface DataSourceAdapter {
  readonly providerKey: string;
  fetchCompanies(connection: DataSourceConnection): Promise<NormalizedSourceRecord[]>;
}
```

`NormalizedSourceRecord` and `normalizedSourceRecordSchema` imported from `@dealflow/shared` (unchanged).

`dataSourceConnectionConfigSchema` in `packages/shared/src/data-source-admin.ts` is **UNTOUCHED** (wave-16 secret-sink boundary enforced).

---

## Key SDK Research Finding — `domainName` is a composite object

Twenty does NOT store domain as a plain string. The `domainName` field is:

```json
{
  "primaryLinkUrl": "https://acme.com",
  "primaryLinkLabel": "Acme"
}
```

The adapter extracts the hostname via `new URL(primaryLinkUrl).hostname`. This is a structural difference from Affinity (which has plain `domain` + `domains[]` string fields). Documented as deviation in B-2.
