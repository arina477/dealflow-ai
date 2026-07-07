# B-1 Contracts — wave-23 seller-intent scoring

**Task:** 1188e7da
**Branch:** wave-23-seller-intent
**Commit:** d7ae070

## Deliverables

### packages/shared/src/seller-intent.ts (CREATED)

Shared Zod schemas for the seller-intent scoring surface.

```
sellerIntentBreakdownSchema   — z.object({ outreachEngagement, pipelineVelocity,
                                matchDisposition, total, notApplied }).passthrough()
sellerIntentDirectionEnum     — z.enum(['heating','cooling','flat'])
sellerIntentScoreSchema       — z.object({ mandateId (uuid), score (int 0-100),
                                breakdown, direction }).passthrough()
sellerIntentListResponseSchema — z.array(sellerIntentScoreSchema)
```

Exported types: `SellerIntentBreakdown`, `SellerIntentDirection`, `SellerIntentScore`,
`SellerIntentListResponse`.

### packages/shared/src/rbac.ts (EDITED)

Added `/seller-intent` route entry:
```typescript
{
  pattern: '/seller-intent',
  allowedRoles: ['advisor', 'admin'],
}
```

### packages/shared/src/index.ts (EDITED)

Wave-23 exports block added above wave-20 comment.

## SI1 Invariant: NO tieBreak

- `sellerIntentBreakdownSchema` has exactly 5 keys: `outreachEngagement`, `pipelineVelocity`,
  `matchDisposition`, `total`, `notApplied`. No `tieBreak` key.
- Zod schema uses `.passthrough()` (open for future extension) but no tieBreak is defined.
- Test H (RBAC + schema shape) asserts absence of tieBreak from schema.shape.

## Deviations

None. Contracts match the spec exactly.
