# Wave 39 — B-3 Frontend

Specialist: nextjs-developer. Commits: 3880cb0 (9e37eeef confirm modal + activity) + eb279d4 (69cd8ce4 transfer/self-demote UI) + 811d680 (test-selector fix) + daa9f69 (a11y lint fix).

## Files implemented
- apps/web/app/(app)/admin/users/_components/ConfirmDialog.tsx — reusable destructive-action modal (DESIGN-SYSTEM Modal: role=dialog, aria-modal, focus-trap, Esc, return-focus; keyboard-accessible backdrop close button; blocked-reason state).
- apps/web/app/(app)/admin/users/_components/AdminUsersClient.tsx — Transfer-admin (per active non-self member) + Step-down (self-demote) controls via ConfirmDialog; POST transfer-admin proxy / PATCH role; 409 → blockedReason in dialog.
- apps/web/next.config.ts — /admin/users-data/:id/transfer-admin proxy.
- apps/web/app/(app)/admin/activity/_components/ActivityTable.tsx — self-demote vs role-change context labels (confirmed the /admin/activity component).
- Tests: ConfirmDialog.test.tsx, AdminUsersClient.transfer.test.tsx, ActivityTable.test.tsx.

## Deviation (accepted)
Activity view labels self-demote (actor==target) vs role-change but cannot distinguish transfer vs promote/demote — the read-surface projection deliberately omits from/to roles (P-4 security finding). Sound data-shape constraint; full detail remains in the immutable audit log. Follow-up-eligible, non-blocking.

```yaml
skipped: false
specialists_spawned: [nextjs-developer]
files_implemented: [ConfirmDialog.tsx, AdminUsersClient.tsx, next.config.ts, ActivityTable.tsx, +3 test files]
designs_consumed: [DESIGN-SYSTEM Modal/Drawer pattern; no new design/*.html (design_gap_flag=false)]
deviations: [{specialist: nextjs-developer, change: "activity labels can't distinguish transfer vs promote", plan_said: "surface transfer/self-demote context", why: "read projection omits from/to by security design", adjudication: accepted-non-blocking}]
simplify_applied: true
```
