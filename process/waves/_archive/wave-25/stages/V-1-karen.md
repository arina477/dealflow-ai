# V-1 Karen — Wave 25 (M10 auth-hardening) Reality Verification

**Verdict: APPROVE**
**Blocking findings: 0**
**Independent prod 429 re-confirm: YES (self-executed against live prod)**

Deliverable under review: auth rate-limiter LIVE @987ebb4 (prod), migration 0019 applied to prod, 429 verified in prod.

---

## 1. Files exist on main @987ebb4 — PASS

`987ebb4` is confirmed an ancestor of current HEAD (`042ddcb`). All six required paths exist at that commit:

- `apps/api/src/modules/auth/rate-limit.middleware.ts` — EXISTS
- `apps/api/src/modules/auth/rate-limit.middleware.spec.ts` — EXISTS
- `apps/api/src/db/migrations/0019_rate_limit_hits.sql` — EXISTS
- `apps/api/src/db/migrations/meta/_journal.json` — EXISTS, idx 19 present (`{"idx": 19, "tag": "0019_rate_limit_hits", "when": 1783428538937}`)
- `apps/api/src/db/schema/rate-limit-hits.ts` — EXISTS
- `apps/api/src/main.ts` — EXISTS

## 2. Limiter is genuinely mechanical + load-bearing — PASS

- **Atomic UPSERT (SEC-1):** `INSERT INTO rate_limit_hits ... ON CONFLICT (key, window_start) DO UPDATE SET count = rate_limit_hits.count + 1 RETURNING count` — single round-trip, post-increment count read, no SELECT-then-UPDATE / no TOCTOU. Present in middleware (`rate-limit.middleware.ts:280-282`), migration SQL, and schema doc. PRIMARY KEY (key, window_start) enforces the atomicity.
- **trust proxy=1 (SEC-3):** `app.set('trust proxy', 1)` at `main.ts:102`. Railway = exactly 1 hop; forged X-Forwarded-For beyond first hop ignored.
- **Placement (SEC-8):** `app.use(createRateLimitMiddleware())` at `main.ts:127` registered BEFORE `app.use(middleware())` (SuperTokens) at `main.ts:135`. This is the only placement that intercepts SuperTokens auto-routes (/auth/signin). Correct and load-bearing.
- **Real 429:** `res.status(429).json({ statusCode: 429, ... Retry-After })` at `main.ts`-side middleware line 652. Not a stub.
- **Two windows (SEC-2):** 60s short + 3600s coarse, either-exceeds → 429.
- **Differentiated fail policy (SEC-5):** FAIL_OPEN_SCOPES = {signup, reset/request} (allow+log ONLY on connection-class DB error); FAIL_CLOSED_SOFT_SCOPES = {signin, reset/confirm} (in-process token bucket ~5/min fallback). Non-connection DB errors on fail-open scopes degrade to soft fallback rather than silently bypassing — a latent bug cannot disable the limiter.

## 3. Independent prod 429 re-confirm — PASS (self-executed)

Hit `POST https://dealflow-api-production-66d4.up.railway.app/auth/reset/request` with a FRESH unique fake email (`karen-v1-probe-<epoch>@nonexistent-invalid.test`, no real account):

```
req 1 -> HTTP 202 {"status":"accepted"}
req 2 -> HTTP 202
req 3 -> HTTP 202
req 4 -> HTTP 202
req 5 -> HTTP 202
req 6 -> HTTP 429 {"statusCode":429,"message":"Too many requests. Please try again later.","retryAfter":39}
req 7 -> HTTP 429
req 8 -> HTTP 429
```

Matches the C-2 report exactly (req 6 → 429). Because the email was brand-new and nonexistent, the 429 independently proves BOTH:
- The limiter fired against the LIVE `rate_limit_hits` table (a fail-open path would have returned 202 on all 8) — genuinely load-bearing.
- Pre-lookup bucketing / no-enumeration (SEC-6): a nonexistent account is rate-limited identically. No real account was locked out.

## 4. Health @987ebb4 — PASS

`GET /health` → HTTP 200, body `{"status":"ok","db":"ok","version":"987ebb42e48df759ca7b6b1872b48c54be5dd7fe"}`. `version` short-SHA == 987ebb4. DB reachable. Deployed tip == verified commit.

## 5. No secret in deliverable; migration additive — PASS

- Secret grep over all four new files: only hits are the literal word `password` as a field name and dummy test fixtures (`password: 'validpass123'`, `password: 'pw1'`). No real credentials, keys, tokens, or connection strings.
- Migration 0019 is purely additive: `CREATE TABLE rate_limit_hits` + GRANT + one index. No ALTER, no destructive statement. Rollback = DROP TABLE. Not tenant-scoped / not WORM by design (pre-auth counter store, not an audit table) — documented and intentional.

---

## Reality assessment

This is a REAL, LIVE, load-bearing deliverable — not done-theater. Deployed prod tip matches the verified commit (987ebb4), the migration is applied (DB-backed limiter would 500 or fail-open otherwise; instead it correctly buckets and 429s), and the 429 was independently reproduced against production with a fresh nonexistent email. The mechanical guarantees (atomic UPSERT, trust-proxy, pre-SuperTokens placement, differentiated fail policy) are all present in the shipped code, not just claimed in a report.

No blocking findings. APPROVE.
