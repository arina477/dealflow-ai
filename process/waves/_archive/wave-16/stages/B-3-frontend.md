# Wave 16 — B-3 Frontend
```yaml
skipped: false
fast_path_active: false
specialists_spawned: [nextjs-developer]
files_implemented:
  - apps/web/app/(app)/_components/NavItem.tsx (activity icon)
  - apps/web/app/(app)/admin/activity/page.tsx + _components/ActivityTable.tsx (read-only 4-col table, filter, pagination, empty state)
  - apps/web/app/(app)/admin/users/_components/AdminUsersClient.tsx (reactivate action, mutually exclusive with deactivate)
  - apps/web/next.config.ts (rewrites: /admin/activity-data, reactivate proxy)
  - apps/web/app/(app)/admin/rbac-role-reverify.test.ts (extended: /admin/activity + reactivate + nav)
  - page.test.tsx x2 (activity + users reactivate + credential-write-only regression guard)
designs_consumed: []   # design_gap_flag=false; reused wave-13 /compliance/audit-log table + wave-15 admin-table patterns
deviations: []   # activity lucide icon NavItem entry = impl detail, not scope
simplify_applied: true
commits: [5ea08b7, 87ddeb4, a8a420f]
verification: {web_typecheck: clean, web_tests: 693 pass}
p4_finding3_ui: "admin-activity UI shows only actor/target/action/timestamp — no hash/credential column"
nav_server_gated: true   # advisor gets empty admin group from server, not CSS-hidden
credential_form_write_only: true   # regression-guarded
```
