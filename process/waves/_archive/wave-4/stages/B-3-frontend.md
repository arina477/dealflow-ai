# Wave 4 — B-3 Frontend (audit-log integrity view)
nextjs-developer. Commit `2d6bfda`. Branch wave-4-audit-log.
## Files
apps/web/app/(app)/compliance/audit-log/{page.tsx (server, assertRole compliance-only, fetches /compliance/audit-log/verify cookie-forwarded no-store), _components/IntegrityPanel.tsx (client)} + NavItem.tsx (Scroll icon for NAV_AUDIT_LOG).
## Confirmations
- Route `/compliance/audit-log` (NOT /compliance/settings). Per design/audit-log-export.html §Integrity Validation (emerald "All entries verified" pill; amber hash-mismatch banner; "Integrity hashes & verification — Required by FINRA profile").
- 3 states: Verified (emerald pill role=status), **Broken (role=alert aria-live=assertive PERSISTENT non-dismissible panel, firstBreakAt+reason — NOT a toast)**, Unavailable (degraded). Verify-now re-calls endpoint.
- RBAC: compliance sees page+nav; advisor/analyst/admin(no-compliance)→redirect /; unauth→/login. nav⊆RBAC (NAV_AUDIT_LOG ['compliance']).
- §10 AppShell chrome, zinc/emerald, lucide, a11y (keyboard/focus/aria).
## Verify
web typecheck clean; biome 0 err (touched files); web tests 95 (64 wave-3 + 31 new: per-role redirect, verified/broken/empty states, persistent-non-dismissible, verify-now transitions, fetch-fail→unavailable).
```yaml
skipped: false
specialists_spawned: [nextjs-developer]
designs_consumed: [design/audit-log-export.html §Integrity Validation, DESIGN-SYSTEM §10]
commit: 2d6bfda
simplify_applied: true
deviations: []
```
