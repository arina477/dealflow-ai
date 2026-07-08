# Wave 29 — B-1 Contracts: deal-activity browse

**Task:** d573e7bf (contract sub-task 6f86b594)
**Commit:** 30a05fa

## Shared Zod contracts (`packages/shared/src/recordkeeping.ts`)

### `dealActivityBrowseFilterSchema` (.strict)
- `mandateId?: uuid` — scope to a single mandate
- `from?: string` — ISO datetime lower bound on `pipeline.created_at`
- `to?: string` — ISO datetime upper bound
- `type?: string` — `pipeline.deal_source_type` exact match
- `limit?: coerce.number, max 50, default 25` — page size (NOT EXPORT_ROW_CAP)
- `offset?: coerce.number, nonneg, default 0` — page offset
- `.strict()`: rejects `workspace_id`, `firmId`, any unknown key → 400 (SEC-2)

### `dealActivityRowSchema` (.strict)
Mirrors `findDealRowsBounded`'s projection (`pipeline LEFT JOIN mandates`, both RLS-covered):
`pipelineId | mandateId | dealSourceType | outreachId | matchCandidateId | stage | createdBy | createdAt | updatedAt | mandateSellerName`
No `workspace_id`. No global `sequence_number`.

### `dealActivityBrowseResponseSchema` (.strict)
`{ rows: DealActivityRow[], total: number, limit: number, offset: number }`
`total` = full filtered count (not page count) — for pagination UI.

### Constants
- `DEAL_ACTIVITY_BROWSE_MAX_LIMIT = 50` (NOT EXPORT_ROW_CAP = 50k)
- `DEAL_ACTIVITY_BROWSE_DEFAULT_LIMIT = 25`

### rbac.ts addition
Pattern `/compliance/records/deal-activity` → `['compliance', 'admin']`.
No navItem (API-only). Mirrors `EXPORT_ALLOWED_ROLES`.

### index.ts exports
All new types + schemas + constants re-exported from `@dealflow/shared`.
