# Wave 3 — T-block findings aggregate

| # | stage | sev | scope | description | route |
|---|---|---|---|---|---|
| 1 | T-1 | low | AppShell icon-map + test fixtures | as-unknown-as casts (lucide typing + test mocks) | non-blocking |
| 2 | T-8 | low | RolesGuard | 1 DB read/guarded-request (accepted; correctness>perf) | non-blocking |
| 3 | T-5 | fixed | e2e/auth.spec.ts | wave-2 specs asserted /dashboard; updated to / (wave-3 route change) | fixed |
**Totals:** 0 critical. RBAC + AppShell + role-nav verified real-browser (7/7) + live (C-2 matrix). 2 low non-blocking; 1 test-maintenance fixed.
