# Wave 30 — B-1 Contracts

**Stage:** B-1 (Contracts)
**Task:** 345dfbc6 — M9 Affinity DataSourceAdapter
**Date:** 2026-07-08

## Summary

B-1 for this wave is a reuse-only stage: the existing DataSourceAdapter interface in `packages/shared/src/sourcing.ts` is the contract. No new interface was authored.

## Reused interface (no changes)

- `DataSourceAdapter` interface: `fetchCompanies(connection: DataSourceConnection): Promise<NormalizedSourceRecord[]>` + `readonly providerKey: string`
- `NormalizedSourceRecord`: `{ sourceRecordId, name, domain?, contacts[], raw? }`
- `DataSourceConnection`: `{ id, providerKey, displayName, enabled, config, createdBy, createdAt }`

Source: `packages/shared/src/sourcing.ts` — unchanged.

## Internal Affinity response Zod types (adapter-internal — NOTE-3)

Three Zod schemas defined inside `affinity.adapter.ts` (not exported), implementing NOTE-3 boundary validation:

```typescript
affinityOrganizationSchema      // GET /organizations item
affinityOrganizationsResponseSchema  // paginated response wrapper
affinityPersonSchema             // GET /persons/{id} response
```

All use `.passthrough()` to tolerate future Affinity API field additions without breaking.

## SDK doc authored (B-1 prerequisite — SDK-research-FIRST)

`command-center/dev/SDK-Docs/Affinity/affinity.md` — authored before the adapter.
Registry row added to `command-center/dev/SDK-Docs/registry.md`.

## No migration, no schema change

Per P-3 plan: `schema_change: false`. The adapter feeds the existing ETL path (IngestionService → raw_companies → dedupe).
