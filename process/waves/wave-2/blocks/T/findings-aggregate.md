# Wave 2 — T-block findings aggregate

| # | stage | severity | scope | description | route |
|---|---|---|---|---|---|
| 1 | T-1 | low | auth.di-boot.spec.ts | `as unknown as AuthRepository` test-fixture mock | non-blocking |
| 2 | T-5 | medium/infra | host/CI | real-browser Playwright E2E deferred (Chrome absent); flows verified live (C-2)+RTL | V-2; task fa23349a |
| 3 | T-6 | medium/infra | host/CI | visual-regression pixel-diff deferred (Chrome absent); built to DESIGN-SYSTEM | V-2; task fa23349a |
| 4 | T-8 | medium | apps/api /auth/* | no rate-limiting (brute-force hardening gap; mitigated invite-only + 0 users) | V-2 / hardening slice |

**Totals:** 4 findings — 0 critical, 3 medium, 1 low. No auth bypass / enumeration / secret leak. Full auth flow verified live at C-2.
