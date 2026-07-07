# Wave 20 — B-1 Contracts (task c3776cac)

**Status: DELIVERED**

---

## Files created/modified

### New
`packages/shared/src/outreach-activity.ts`

Exports:
- `outreachActivityChannelEnum` — z.enum(['call','email','linkedin','other'])
- `outreachActivityStatusEnum` — z.enum(['planned','completed','cancelled'])
- `outreachActivitySchema` — READ shape (.passthrough()), 14 fields; excludes no server-derived fields from read surface
- `createOutreachActivitySchema` — POST input (.strict()); EXCLUDES workspaceId (SF1) and createdBy (SF4)
- `updateOutreachActivitySchema` — PATCH input (.strict()); partial update; EXCLUDES workspaceId and createdBy
- `listOutreachActivityResponseSchema` — `{activities: outreachActivitySchema[]}` (.passthrough())
- Types: `OutreachActivity`, `OutreachActivityChannel`, `OutreachActivityStatus`, `CreateOutreachActivityInput`, `UpdateOutreachActivityInput`, `ListOutreachActivityResponse`

### Modified

**`packages/shared/src/audit.ts`** — added 4 new audit action values after 'user-reactivate':
- 'outreach-activity-create'
- 'outreach-activity-update'
- 'outreach-activity-status-transition'
- 'outreach-activity-cancel'

**`packages/shared/src/rbac.ts`** — added outreach-activity RBAC group entries:
```typescript
// --- Outreach Activity group (wave-20 M9 outreach-activity tracker) ---
{ pattern: '/outreach-activity',     allowedRoles: ['advisor', 'admin'] },
{ pattern: '/outreach-activity/:id', allowedRoles: ['advisor', 'admin'] },
```
Inserted before `// --- Admin / Config group ---` in roleRoutes array.

**`packages/shared/src/index.ts`** — wave-20 outreach-activity exports block added at top.

---

## Mass-assignment guards

- `createOutreachActivitySchema.safeParse({..., workspaceId: '...'})` → `success: false` (strict rejects unknown key)
- `updateOutreachActivitySchema.safeParse({..., workspaceId: '...'})` → `success: false` (strict rejects unknown key)
- Verified in unit tests OA-R1-1 and OA-R1-2.

## RBAC gate assertions

- `rolesForRoute('/outreach-activity')` → `['advisor', 'admin']`
- `rolesForRoute('/outreach-activity/:id')` → `['advisor', 'admin']`
- analyst NOT in /outreach-activity roles
- compliance NOT in /outreach-activity roles
- Verified in unit tests OA-RBAC-1 through OA-RBAC-4.

## Typecheck: CLEAN
