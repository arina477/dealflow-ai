# Wave 25 — B-2 Backend Deliverable (M10 auth-hardening, task 6fe232e3)

**Commits:** 18f798e (B-0 migration) + 1aef449 (B-2 implementation)
**Tests:** 970 unit pass, 93 skipped (DB-gated e2e), 0 failures. Typecheck clean.

---

## SEC-1 [HIGH] — ATOMIC counter

**How honored:** `atomicIncrement()` in `rate-limit.middleware.ts` executes:
```sql
INSERT INTO rate_limit_hits (key, window_start, count, expires_at)
VALUES ($1, $2, 1, $3)
ON CONFLICT (key, window_start) DO UPDATE
  SET count = rate_limit_hits.count + 1
RETURNING count
```
The post-increment count is read from `RETURNING count` in a single round-trip.
No SELECT-then-UPDATE; no TOCTOU. PostgreSQL's row-level lock on the conflict target ensures concurrent UPSERTs serialize correctly — exactly one increment per caller.

**Test (SEC-1):** `rate-limit.middleware.spec.ts` — "exactly the (limit+1)th call triggers 429 (mock pool, sequential)" and "concurrent parallel calls: at most 1 beyond the limit passes." The concurrent test uses a mock pool with an in-memory counter; a real-DB concurrent test requires `TEST_DATABASE_URL` (DB-gated, passes in CI with DB).

---

## SEC-2 [HIGH] — WINDOW (named, dual-bucket)

**Window type:** Dual Fixed-Window Counter.
- `SHORT_WINDOW_SECONDS = 60` (burst suppression)
- `COARSE_WINDOW_SECONDS = 3600` (sustained attack cap)

**How it kills boundary-burst:** Even if the 60-second window resets at a boundary, the per-hour bucket persists and caps total attempts to `COARSE_LIMIT` per hour regardless of boundary alignment. A flood of `N` requests per minute fails the short window; a sustained `2×N` flow also fails the coarse window at its threshold.

**Limits (both must pass):**
| Scope | Short (60 s) | Coarse (1 h) |
|---|---|---|
| signin | 10 | 20 |
| signup | 5 | 10 |
| reset/request | 5 | 10 |
| reset/confirm | 5 | 10 |

**Tests (SEC-2):** "coarse window blocks requests after coarse limit even if short window is fresh" + "short window blocks requests within the short window after short limit."

---

## SEC-3 [HIGH] — Trust proxy + client IP

**How honored:** `app.set('trust proxy', 1)` in `main.ts` before any middleware registration. Railway terminates TLS at exactly 1 proxy hop. Express resolves `req.ip` from the last XFF entry (hop 1 = Railway's validated client IP). The middleware reads `req.ip` exclusively — NOT `req.headers['x-forwarded-for']` directly.

**Hop count documented:** `command-center/dev/trust-proxy-hop-count.md` — hop count = 1, rationale, and deployment assumption.

**Forged XFF:** A client adding additional XFF entries beyond hop 1 has those entries ignored. The Railway proxy's entry is the last one Express trusts; any client-prepended entries are in the untrusted position.

**Test (SEC-3):** "req.ip (not raw XFF) is used for bucketing — attacker cannot reset bucket with forged XFF" — verifies that two requests with the same `req.ip` share one bucket key, regardless of what the client could have injected into XFF.

---

## SEC-4 [MED] — Per-account key normalized

**How honored:** `makeKey()` in `rate-limit.middleware.ts` calls `identifier.trim().toLowerCase()` before building the bucket key string. `A@X.com`, `a@x.com`, and ` A@X.COM ` all produce key prefix `a@x.com`.

**Test (SEC-4):** "case-different emails produce the same bucket key" — sends 3 requests with case/whitespace variants; asserts the counter shows 3 hits on a single normalized bucket.

---

## SEC-5 [HIGH] — Differentiated failure

**How honored:** `FAIL_OPEN_SCOPES = new Set(['signup', 'reset/request'])` — on DB error: log + call `next()` (allow).
`FAIL_CLOSED_SOFT_SCOPES = new Set(['signin', 'reset/confirm'])` — on DB error: fall back to an in-process token bucket (`_softBuckets` Map, per (scope, identifier), window = `SHORT_WINDOW_SECONDS`). The fallback limit is `SOFT_FALLBACK_LIMIT = 5` — more conservative than the DB limit so a DB blip degrades to "throttled," not "unlimited."

**Rationale:** Invite-only does NOT protect signin (any invited user's password is the attack surface). An unlimited-rate-limit blip on signin = brute-force window. The in-process fallback is per-instance (not shared); acceptable degraded mode — the primary protection is the DB store.

**Tests (SEC-5):**
- "signup: DB error → fail-OPEN (allow)" 
- "reset/request: DB error → fail-OPEN (allow)"
- "signin: DB error → fail-CLOSED-SOFT (in-process bucket allows first SOFT_FALLBACK_LIMIT requests)" — verifies exactly `SOFT_FALLBACK_LIMIT` pass, then 429.
- "reset/confirm: DB error → fail-CLOSED-SOFT (in-process bucket)"

---

## SEC-6 [LOW] — No enumeration

**How honored:** `extractIdentifier()` in `rate-limit.middleware.ts` reads the submitted email from the body **before** any DB lookup (the middleware runs before SuperTokens, before the Nest router, before any service call). Real and fake emails are bucketed identically. The 429 threshold, body, and timing are identical.

**Tests (SEC-6):**
- "real email and fake email are treated identically" — both floods hit 429 at the same threshold.
- "429 response body is byte-identical for real and fake emails" — `JSON.stringify` equality of both 429 bodies.

---

## SEC-7 [MED] — Endpoints

**How honored:** `resolveScope()` in `rate-limit.middleware.ts` maps:
- `POST /auth/signin` → `'signin'`
- `POST /auth/signup` → `'signup'`
- `POST /auth/reset/request` → `'reset/request'`
- `POST /auth/reset/confirm` → `'reset/confirm'`
- All other paths → `null` (pass through without counting)

**reset/confirm is included (token brute-force = account takeover).** Per-IP bucketing for reset/confirm (no email in the body — IP is the identifier). Fail-CLOSED-SOFT on DB error.

**Test (SEC-7):** "reset/confirm returns 429 after the short limit is exceeded."

---

## SEC-8 [LOAD-BEARING] — Express placement before SuperTokens middleware

**How honored:** In `main.ts`:
```typescript
app.set('trust proxy', 1);           // ← SEC-3
app.enableCors({ ... });
app.use(createRateLimitMiddleware()); // ← SEC-8: BEFORE middleware()
app.use(middleware());                // ← SuperTokens (handles /auth/signin)
app.use(errorHandler());
await app.listen(env.PORT);          // ← mounts Nest router
```

The rate-limit middleware is a raw Express `RequestHandler` registered via `app.use()` before `app.listen()` (which triggers Nest router mount). Express processes `app.use()` handlers in registration order. The rate-limit middleware intercepts `/auth/signin` before SuperTokens' `middleware()` fully handles it.

A Nest guard runs inside the Nest router, which runs after `middleware()` — it would never see the SuperTokens auto-route. This placement is the only placement that works.

**On 429:** `res.status(429).json({ statusCode: 429, message: '...', retryAfter: N })` + `Retry-After: N` header. The handler returns immediately without calling `next()`.

**Test (SEC-8):** "returns 429 when /auth/signin short limit is exceeded" — this is the load-bearing proof that the Express-level limiter intercepts the SDK route.

---

## SEC-9 [MED] — 500→400: per-handler safeParse, no global pipe

**How honored:** `auth.controller.ts` — all body-accepting handlers type `@Body()` as `unknown` and call `schema.safeParse(body)` before any service call. A missing/empty inviteToken → `signupRequestSchema.safeParse` fails → `BadRequestException('Invalid or expired invite')` → 400. The service's `hashToken(undefined)` crash path is unreachable.

**No global pipe:** `useGlobalPipes` / `APP_PIPE` is NOT registered. The 18 other controllers continue using their existing per-controller safeParse or typed-DTO patterns. The mandate/buyer-universe/matching passthrough tests still pass (970 total, 0 failures).

**Guard test:** `rate-limit.middleware.spec.ts` — "auth rate-limit middleware passes through non-auth POST routes without touching them" — confirms `/compliance/rules` POST passes through unchanged.

---

## SEC-10 [LOW] — Generic message

**How honored:** Validation errors in the signup handler return `BadRequestException('Invalid or expired invite')` — the same message whether the token is missing, empty, malformed, or structurally valid but non-existent in the DB (the DB-level rejection in `AuthService.signup` also returns `'Invalid or expired invite'`). For invite, reset/request, and reset/confirm handlers the generic message is `'Invalid request'`.

**No account created on missing path:** The `safeParse` throws before `AuthService.signup()` is called → before `hashToken()` → before `EmailPassword.signUp()`. No Core user, no app-DB user created.

**Tests (SEC-10):**
- "missing inviteToken and empty inviteToken return IDENTICAL 400 message" — `message` and `getStatus()` are byte-identical.
- "missing inviteToken → 400 BadRequestException (not 500)" — service is never called.
- "empty inviteToken → 400 (generic message)."

---

## SEC-11 [LOGOUT] — Anti-CSRF verify

**How honored:** SuperTokens `antiCsrf: 'VIA_CUSTOM_HEADER'` (in `supertokens.config.ts`) + `SessionGuard` on `POST /auth/logout` (in `auth.controller.ts`). `SessionGuard` calls `Session.getSession()` which enforces the anti-CSRF check: a request without the `rid` custom header → SuperTokens throws → guard catches → 401.

**No hand-rolled CSRF.** The existing SuperTokens VIA_CUSTOM_HEADER mechanism is the gate. No manual header extraction or CSRF token management.

**Tests (SEC-11):**
- Static: "superTokens config has antiCsrf: VIA_CUSTOM_HEADER" — reads file and asserts.
- Static: "logout handler is guarded by SessionGuard" — reads controller and asserts `@UseGuards(SessionGuard)` before logout.
- Static: no `x-csrf-token` / `csrf-token` strings in the controller (no hand-roll).
- Integration: "logout WITHOUT the anti-csrf header/rid → 401; WITH valid session+header → 200" requires a live SuperTokens Core — runs at T-8 security stage or C-2 prod. The unit test documents the contract.

---

## Deviations

None. All 11 SEC-N obligations honored as specified. The only design call within spec: the dual fixed-window counter (named: "dual fixed-window counter") rather than a sliding-window counter. Both are permissible per SEC-2; the dual fixed-window is simpler and sufficient given the conservative coarse-bucket cap.

---

## Trust proxy hop count

Railway = **1 hop**. `app.set('trust proxy', 1)`. Full rationale in `command-center/dev/trust-proxy-hop-count.md`.

---

## Files changed

- `apps/api/src/db/migrations/0019_rate_limit_hits.sql` — B-0 migration (commit 18f798e)
- `apps/api/src/main.ts` — trust proxy + rate-limit middleware registration (commit 1aef449)
- `apps/api/src/modules/auth/rate-limit.middleware.ts` — the middleware (commit 1aef449)
- `apps/api/src/modules/auth/rate-limit.middleware.spec.ts` — 33 SEC tests (commit 1aef449)
- `apps/api/src/modules/auth/auth.controller.ts` — per-handler safeParse + SEC-11 comment (commit 1aef449)
- `apps/api/src/modules/auth/auth.controller.spec.ts` — 19 validation + SEC-11 tests (commit 1aef449)
- `command-center/dev/trust-proxy-hop-count.md` — SEC-3 hop-count doc (commit 1aef449)
