# Wave 1 — T-block findings aggregate

Canonical input for V-2 Triage. Severity: low = cosmetic/discipline; medium = should-fix / infra gap; critical = blocks.

| # | stage | severity | location / scope | description | suggested route |
|---|---|---|---|---|---|
| 1 | T-1 | low | apps/api/test/health.e2e-spec.ts:59 | `any`-typed Nest test app handle (test fixture only) | non-blocking; tighten with `INestApplication` |
| 2 | T-1 | low | apps/web/app/page.test.tsx:39 | `as unknown as Response` mock cast (test fixture only) | non-blocking; typed fetch mock helper |
| 3 | T-5 | medium | host / CI environment | Playwright Chrome binary absent → no real-browser E2E swarm; HTTP smoke used this wave (trivial placeholder UI). Must install before first real product-UI wave (M1+). | V-2: non-blocking infra gap; L-2: T-5 principle candidate; host action `npx playwright install chrome` |

**Totals:** 3 findings — 0 critical, 1 medium (infra), 2 low. No acceptance criterion failed; all live probes green.
