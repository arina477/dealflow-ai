# Wave 2 — T-block findings aggregate

| # | stage | severity | scope | description | route |
|---|---|---|---|---|---|
| 1 | T-1 | low | auth.di-boot.spec.ts | `as unknown as AuthRepository` test-fixture mock | non-blocking |
| 2 | T-5 | RESOLVED | host/CI | Chrome installed by founder; real-browser E2E ran 6/6 PASS; caught+fixed 2 CRITICAL browser bugs (CORS/middleware ordering + cross-origin session) — cc893d8/bc558f7 deployed+verified live | closed |
| 3 | T-6 | RESOLVED | host/CI | Chrome installed; visual baseline established (4/4 pages render per DESIGN-SYSTEM; SSO+SOC2 absent; 0 defects) | closed |
| 4 | T-8 | medium | apps/api /auth/* | no rate-limiting (brute-force hardening gap; mitigated invite-only + 0 users) | V-2 / hardening slice |

**Totals (updated):** T-5 + T-6 infra findings RESOLVED (Chrome installed; 6/6 browser E2E + visual baseline). Remaining: T-8 rate-limit (medium → V-2/hardening), T-1 test-fixture cast (low). The real-browser E2E caught + fixed 2 CRITICAL browser bugs that all other layers missed — high-value gate. Task fa23349a (Chrome install) → DONE.
