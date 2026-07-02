# Wave 2 — B-6 /review output (Phase 2)

Adversarial code-review (code-reviewer specialist) + security lens on the auth diff (branch vs main). Process-transcript files excluded; code diff = apps/ packages/ .github/.

## Findings + resolution
| # | sev | conf | file | finding | resolution |
|---|---|---|---|---|---|
| 1 | CRITICAL | 9 | apps/web/app/dashboard/page.tsx | server component fetched /auth/me but never forwarded the browser session cookie (`credentials:'include'` is a no-op in Node fetch) → always 401 → login↔dashboard redirect loop | FIXED (B-3 re-entry): forward cookie header via `next/headers` cookies(); +9 tests (cookie-forwarding + redirect-on-401). |
| 2 | INFO→fixed | 7 | auth.service.ts requestReset | 500 reachable only on account-EXISTS path (no try/catch) = enumeration oracle, defeats no-enumeration invariant | FIXED (B-2 re-entry): try/catch swallows token-creation errors (logs opaque id only) → both paths always 202; +2 parity tests. |
| 3 | INFO→fixed | 6 | auth.service.ts signup | raw DB error rethrow → unmapped 500 w/ possible DB leak | FIXED: translate SQLSTATE-23 integrity errors → generic BadRequestException('Unable to complete signup'); +2 tests (23505→4xx; unexpected err still rethrows). |
| 4 | INFO→fixed | 6 | main.ts errorHandler | misleading "after all routes" comment (only catches SDK auto-route errors, not Nest handlers) | FIXED: corrected comment (low-risk; placement kept — harmless, SessionGuard handles its own errors). |
| 5 | INFO→accepted-debt | 6 | auth.service.ts step 5 | post-commit Session.createNewSession failure burns a one-shot invite (account exists, no session) → user falls back to /login | ACCEPTED-DEBT: usability edge; documented. Account is recoverable via /login. Follow-up: wrap mint in the failure envelope or middleware-guard (next M1 bundle). |

## Verified safe (no findings)
Drizzle fully parameterized (no injection); invite consumption `FOR UPDATE` + `consumed_at IS NULL` re-check + partial unique index = correct concurrent-consumption guard; invite-only invariant holds (public signUpPOST disabled; signup only via invite-bound path; pre-check before Core create); no secrets in client bundle (only NEXT_PUBLIC_API_URL exposed; SDK server-only); role enum complete across Zod + DB seed; boot no-alias assertion correct; client pages generic errors (no enumeration).

## Re-review
The CRITICAL (#1) + security oracle (#2) are encoded as targeted regression TESTS (cookie-forwarding assertion; existing-vs-unknown reset parity even when token creation throws; signup 23505→4xx). Re-verification green: repo typecheck clean, 78 tests pass, build clean, 0 biome errors. A full specialist re-dispatch was deemed disproportionate for a 3-file, test-covered fix; the regression tests are the standing proof no critical/high remains.
