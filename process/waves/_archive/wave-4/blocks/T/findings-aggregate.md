# Wave 4 — T-block findings aggregate

| # | stage | sev | scope | description | route |
|---|---|---|---|---|---|
| 1 | T-5 | fixed | e2e/auth.spec.ts | ambiguous getByText(email/role) (3 matches post-wave-3) → .first() | fixed |
| 2 | T-6 | low | TopBar title | shows "Dashboard" not "Audit Log & Recordkeeping" (server best-effort x-invoke-path); h2 correct | non-blocking |
**Totals:** 0 critical. Audit-log immutability+tamper-detect+chain-verify LIVE (C-2); integrity view real-browser 7/7 (verify-now works); 1 low (TopBar title polish); 1 test-maintenance fixed.
