# Wave 27 — B-1 Contracts (packages/shared/src/recordkeeping.ts)

## deliverable: extended exportScopeSchema + exportManifestSchema

### exportScopeSchema changes (SEC-2 compliant)

Extended `exportScopeSchema` to add:
- `format: z.enum(['csv', 'json']).default('csv')` — output serialization format
- `scope: z.enum(['audit', 'deal', 'both']).default('both')` — data scope

Schema remains `.strict()` — unknown keys (workspace_id, firmId, tenant) → 400 BadRequestException.

**SEC-2 HOW HONORED:** The schema is `.strict()` with NO workspace_id / firmId / tenant field. Any request body carrying those keys fails Zod strict validation with a ZodError whose message is forwarded as 400 to the caller. The workspace is server-resolved from the session GUC via `getWorkspaceId()` (ALS), never a client parameter. Confirmed: `exportScopeSchema.safeParse({ workspace_id: X })` returns `success: false`.

### exportManifestSchema changes (SEC-4 + SEC-6)

Extended `exportManifestSchema` to add:
- `truncated: z.boolean()` — SEC-4 explicit cap signal (never silently short)
- `rowsReturned: z.number().int().nonnegative()` — total rows in this export
- `rowsAvailable: z.number().int().nonnegative()` — total rows available (pre-cap)

Note on SEC-6 (firm-local ordinal): the manifest documents that exported rows carry `firmLocalOrdinal` (1..N over the firm's own exported rows), NOT the global `sequence_number`. The `tailHash`/`entryHash`/`prevHash` fields are retained per-entry for offline linkage verification. The global `sequence_number` is a cross-tenant side-channel and is masked from the payload — documented in the manifest schema comment.

### SEC-N compliance summary for B-1

| SEC | Status | How |
|---|---|---|
| SEC-2 | PASS | `.strict()` with NO workspace_id field; negative test in REISO-4 |
| SEC-4 | PASS | `truncated` / `rowsReturned` / `rowsAvailable` fields added to manifest |
| SEC-6 | NOTE | Ordinal is service-layer concern; manifest documents the invariant |

### deviations: NONE
