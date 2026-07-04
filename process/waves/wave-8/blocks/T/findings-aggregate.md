# Wave 8 — T-block findings aggregate

| # | stage | sev | scope | description | route |
|---|---|---|---|---|---|
| W8-2 | T-5 | med(compliance) | 3-acks | screenshot showed an ack unchecked on a created mandate; C-2 verified server acks→400 LIVE, so likely a screenshot-timing artifact — but CONFIRM server independently enforces (rigorous test) + fix client validate() timing | backend (server-acks-confirm) + nextjs (client-validate) |
| W8-3 | T-5 | low | RBAC-UX | analyst sees "New mandate" button (server-gated via assertRole, NOT a hole) — hide for read-only roles | nextjs (pass userRole, conditional) |
| W8-4 | T-6 | low | TopBar title | Dashboard on mandate pages (recurring x-invoke-path, 6+ screens) → polish task | non-blocking carry-forward |
**Totals:** 0 critical. Create-via-UI + derive-disclaimer + 3-acks(server) + active-lock + RBAC LIVE-proven (C-2). W8-2 server-enforcement confirmed at C-2 (acks→400); T-block hardens + fixes client. B-6+C-2 all fixed.
