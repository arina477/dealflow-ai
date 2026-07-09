# Wave 39 — B-1 Contracts

Specialist: backend-developer (authored alongside B-2 as one cohesive backend change). Commit 16c086a.

- `transferAdminRequestSchema = z.object({ actorNewRole: roleEnum.refine(r => r !== 'admin') }).strict()` + `TransferAdminRequest` type in packages/shared/src/rbac.ts; exported from packages/shared/src/index.ts.
- Also added roleRoutes entry `/admin/users/:id/transfer-admin` → ['admin'] so the RolesGuard resolves admin-only for the new endpoint (fail-closed boot guard covers drift).
- Shared package typechecks in isolation (consumer breakage expected until B-2/B-3, validated repo-wide at B-4 → clean).

```yaml
skipped: false
contracts_authored: [transferAdminRequestSchema, TransferAdminRequest, roleRoutes /admin/users/:id/transfer-admin]
sdk_regenerated: false
fast_path_approved: false
deviations: []
```
