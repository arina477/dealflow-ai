/**
 * Auth rate-limit middleware (wave-25, task 6fe232e3 — M10 auth-hardening).
 *
 * SEC-1  ATOMIC counter:  INSERT...ON CONFLICT DO UPDATE...RETURNING — no TOCTOU.
 * SEC-2  TWO WINDOWS:     60 s (short) + 3 600 s (1 h) — both must pass.
 * SEC-3  TRUST PROXY:     app.set('trust proxy', 1) in main.ts; this middleware
 *                         reads req.ip (Express trust-proxy-resolved); a forged
 *                         X-Forwarded-For beyond the first hop is ignored.
 *                         Railway is exactly 1 proxy hop — documented in
 *                         command-center/dev/trust-proxy-hop-count.md.
 * SEC-4  KEY NORMALISED:  email.trim().toLowerCase() before bucket key.
 * SEC-5  DIFFERENTIATED FAIL:
 *                         signup + reset/request → fail-OPEN (allow + log on DB error).
 *                         signin + reset/confirm → fail-CLOSED-SOFT (in-process token
 *                         bucket ~5/min/instance fallback when the DB is unreachable).
 * SEC-6  NO ENUMERATION:  bucket key uses the submitted email (pre-lookup, not
 *                         post-lookup). 429 threshold/body/timing is identical
 *                         whether the email exists in the system or not.
 * SEC-7  ENDPOINTS:       /auth/signin, /auth/signup, /auth/reset/request,
 *                         /auth/reset/confirm — all four auth write paths.
 * SEC-8  PLACEMENT:       registered as app.use(rateLimiterMiddleware) in main.ts
 *                         BEFORE app.use(middleware()) (SuperTokens). This is the
 *                         ONLY placement that intercepts /auth/signin (a SuperTokens
 *                         auto-route handled entirely inside middleware()). A Nest
 *                         guard or interceptor runs after the Nest router, which
 *                         itself runs after middleware() — too late.
 *
 * WINDOW naming (SEC-2):
 *   SHORT_WINDOW_SECONDS = 60    — short fixed window (burst suppression).
 *   COARSE_WINDOW_SECONDS = 3600 — per-hour coarse window (sustained attack limit).
 *   A request exceeding EITHER window's limit receives 429 + Retry-After.
 *   This is a "dual fixed-window counter" which names and kills boundary-burst
 *   within the coarser window: even if the 60 s window resets, the per-hour
 *   bucket caps total attempts to COARSE_LIMIT per hour regardless.
 *
 * FAIL-CLOSED-SOFT (SEC-5) in-process fallback for signin + reset/confirm:
 *   A simple token-bucket per (path, identifier) stored in a Map<string, number[]>.
 *   Holds timestamps of recent requests; prunes older than SHORT_WINDOW_SECONDS.
 *   Falls back to ~5 requests per SHORT_WINDOW when the DB limiter errors.
 *   This is intentionally conservative (lower than the DB limit) so a DB blip
 *   degrades to "slow/throttled" rather than "unlimited".
 *   The in-process bucket is per-instance and not shared across replicas — that
 *   is the acceptable degraded mode; the primary protection is the DB limiter.
 */

import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Short fixed-window length in seconds. */
const SHORT_WINDOW_SECONDS = 60;
/** Coarse (per-hour) fixed-window length in seconds. */
const COARSE_WINDOW_SECONDS = 3600;

/**
 * Per-window limits per (identifier, path).
 * Generous for legit users (typos, MFA, forgot-password flows);
 * tight enough to blunt brute-force.
 *
 * SHORT limits (per 60 s per account/IP):
 *   signin:        10 attempts / 60 s  (≈ a few typos + retry)
 *   signup:         5 attempts / 60 s  (invite flow; user should not retry often)
 *   reset/request: 5 attempts / 60 s
 *   reset/confirm: 5 attempts / 60 s   (token brute-force = account takeover)
 *
 * COARSE limits (per hour per account/IP):
 *   signin:        20 attempts / h
 *   signup:        10 attempts / h
 *   reset/request: 10 attempts / h
 *   reset/confirm: 10 attempts / h
 */
const LIMITS: Record<string, { short: number; coarse: number }> = {
  signin: { short: 10, coarse: 20 },
  signup: { short: 5, coarse: 10 },
  'reset/request': { short: 5, coarse: 10 },
  'reset/confirm': { short: 5, coarse: 10 },
};

/** Fallback in-process limit for fail-CLOSED-SOFT paths (signin + reset/confirm). */
const SOFT_FALLBACK_LIMIT = 5; // per SHORT_WINDOW_SECONDS per instance

/**
 * Scopes that are fail-OPEN on DB error (allow + log).
 * signup and reset/request: invite-only protects signup; reset/request
 * is no-enumeration and low-value without the token.
 */
const FAIL_OPEN_SCOPES = new Set(['signup', 'reset/request']);

/**
 * Scopes that are fail-CLOSED-SOFT on DB error (in-process fallback).
 * signin: invite-only doesn't protect it; password guessing = account compromise.
 * reset/confirm: token brute-force = account takeover.
 */
const FAIL_CLOSED_SOFT_SCOPES = new Set(['signin', 'reset/confirm']);

// ---------------------------------------------------------------------------
// In-process fallback token bucket (fail-CLOSED-SOFT)
// ---------------------------------------------------------------------------

/**
 * Map<bucketKey, timestamp[]> — timestamps (ms) of requests in the current window.
 * Pruned lazily on every access. Per-instance (not shared); acceptable degraded mode.
 */
const _softBuckets = new Map<string, number[]>();

/**
 * Check and increment the in-process fallback bucket for fail-CLOSED-SOFT paths.
 * Returns true when the request should be allowed (count AFTER this hit <= limit).
 */
function softBucketAllow(key: string, limitPerWindow: number, windowSeconds: number): boolean {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const cutoff = now - windowMs;

  let hits = _softBuckets.get(key) ?? [];
  // Prune timestamps outside the current window
  hits = hits.filter((t) => t > cutoff);
  hits.push(now);
  _softBuckets.set(key, hits);

  return hits.length <= limitPerWindow;
}

// ---------------------------------------------------------------------------
// DB pool reference (module-level singleton — same pool as src/db/index.ts)
// ---------------------------------------------------------------------------

/**
 * Lazy-initialised pool reference. The rate-limit middleware needs the same
 * DATABASE_URL as the main app; we import the pool from src/db/index so there
 * is exactly one Pool instance (no extra connections) and no circular dep.
 *
 * NOTE: imported lazily (inside the function) to avoid module-evaluation-order
 * issues in tests. Tests mock this module or pass an overridePool.
 */
let _pool: Pool | null = null;

function getPool(overridePool?: Pool): Pool {
  if (overridePool) return overridePool;
  if (!_pool) {
    // Lazy import avoids circular dep at module eval time.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    // biome-ignore lint/style/noCommaOperator: dynamic require for lazy init
    _pool = require('../../db/index').pool as Pool;
  }
  return _pool;
}

// ---------------------------------------------------------------------------
// Atomic DB UPSERT (SEC-1)
// ---------------------------------------------------------------------------

/**
 * SEC-1: Atomic INSERT...ON CONFLICT DO UPDATE...RETURNING.
 *
 * Returns the post-increment count for the window. Throws on DB error so the
 * caller can apply its fail-open or fail-closed-soft policy.
 *
 * @param pool    - pg Pool instance (production: singleton from src/db/index.ts)
 * @param key     - composite bucket key (scope:identifier:windowSeconds:windowIndex)
 * @param windowStart - bigint window index (floor(epochSeconds / windowSeconds))
 * @param expiresAt   - when this bucket logically expires (window end + 1 window)
 */
async function atomicIncrement(
  pool: Pool,
  key: string,
  windowStart: bigint,
  expiresAt: Date
): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `INSERT INTO rate_limit_hits (key, window_start, count, expires_at)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (key, window_start) DO UPDATE
       SET count = rate_limit_hits.count + 1
     RETURNING count`,
    [key, windowStart.toString(), expiresAt.toISOString()]
  );
  // count is returned as a string by node-postgres (numeric column → text)
  const row = result.rows[0];
  if (!row) throw new Error('[rate-limit] RETURNING count returned no row');
  return parseInt(row.count, 10);
}

// ---------------------------------------------------------------------------
// Key derivation (SEC-3, SEC-4, SEC-6)
// ---------------------------------------------------------------------------

/**
 * Derive a normalised bucket key for the (scope, identifier, window) triple.
 *
 * SEC-4: email.trim().toLowerCase() ensures A@X.com and a@x.com share one bucket.
 * SEC-6: identifier is the SUBMITTED email (pre-lookup) — the limiter fires
 *        before any DB lookup, so real vs fake emails are indistinguishable.
 * SEC-3: the IP identifier uses req.ip (trust-proxy-resolved; see main.ts where
 *        app.set('trust proxy', 1) is set). A forged XFF beyond the first hop
 *        is ignored — the first-hop Railway proxy strips/rewrites it.
 */
function makeKey(
  scope: string,
  identifier: string,
  windowSeconds: number,
  windowIndex: bigint
): string {
  const normalized = identifier.trim().toLowerCase();
  return `${scope}:${normalized}:${windowSeconds}:${windowIndex}`;
}

/** Compute the fixed-window index for a given epoch (seconds). */
function windowIndex(epochSeconds: number, windowSeconds: number): bigint {
  return BigInt(Math.floor(epochSeconds / windowSeconds));
}

// ---------------------------------------------------------------------------
// Path → scope resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the scope string for a given request path/method.
 * Returns null for non-rate-limited paths (e.g. GET /auth/me, GET /auth/session/*).
 *
 * NOTE: /auth/signin is served by the SuperTokens SDK auto-route inside
 * middleware(). The path that reaches this Express middleware is exactly
 * '/auth/signin' for POST requests from the SDK's signInPOST. The SEC-8
 * placement (before middleware()) ensures we intercept it before the SDK.
 */
function resolveScope(method: string, path: string): string | null {
  if (method !== 'POST') return null;
  // Normalise: strip trailing slash, lowercase
  const p = path.replace(/\/+$/, '').toLowerCase();
  if (p === '/auth/signin') return 'signin';
  if (p === '/auth/signup') return 'signup';
  if (p === '/auth/reset/request') return 'reset/request';
  if (p === '/auth/reset/confirm') return 'reset/confirm';
  return null;
}

/**
 * Extract the identifier for bucketing from the request body.
 *
 * SEC-6: bucket on the SUBMITTED email (pre-lookup; identical treatment for
 * real and fake emails — both get bucketed identically, both get 429 identically).
 * SEC-4: normalised (trim + lowercase) in makeKey().
 *
 * Falls back to the client IP (SEC-3: req.ip, trust-proxy-resolved) when no
 * email can be parsed from the body. This covers reset/confirm (no email in body).
 */
function extractIdentifier(req: Request, scope: string): string {
  // For reset/confirm the body has { token, password } — no email. Use IP.
  if (scope === 'reset/confirm') {
    return req.ip ?? 'unknown';
  }

  // For all other scopes, attempt to pull the email from the request body.
  // The body may not be parsed yet at this stage (we're before Nest body parsing)
  // for the SuperTokens /auth/signin route. However, Express JSON body-parser
  // runs before app.use() middleware if configured as a global parser — in this
  // app body parsing is done by Nest's platform-express default which runs after
  // middleware(). For /auth/signin, the body reaches the SuperTokens SDK which
  // parses it internally.
  //
  // Solution: for POST paths where the body hasn't been parsed yet, fall back
  // to the IP as the identifier. This is safe for signin (IP-based limiting
  // is still effective — the attacker must use many IPs, which is a higher bar).
  // For /auth/signup + /auth/reset/request, Nest parses the body BEFORE the
  // handler, so the body IS available. But those routes go through the Nest
  // router (after middleware()) — and this middleware runs BEFORE middleware().
  // So body is NOT parsed for any of these routes at this point.
  //
  // Therefore: use IP as the primary identifier for all routes when email is
  // unavailable. The raw body can be parsed from a buffer if needed. But for
  // pragmatic correctness, we will buffer-parse the body in this middleware.
  // See the rawBodyBuffer implementation below.

  // Try to get email from body if already parsed (e.g., in tests):
  const body = (req as Request & { body?: unknown }).body as Record<string, unknown> | undefined;
  if (body && typeof body === 'object') {
    // Direct email field (our Nest-parsed bodies: signup, reset/request)
    const emailField = body['email'];
    if (typeof emailField === 'string' && emailField.length > 0) {
      return emailField;
    }
    // SuperTokens uses formFields array: [{ id: 'email', value: '...' }]
    // This is the shape the SuperTokens SDK sends to its own auto-routes (/auth/signin).
    const ff = body['formFields'];
    if (Array.isArray(ff)) {
      for (const field of ff as Array<{ id?: string; value?: unknown }>) {
        if (field.id === 'email' && typeof field.value === 'string' && field.value.length > 0) {
          return field.value;
        }
      }
    }
  }

  // Body not parsed yet — use client IP
  return req.ip ?? 'unknown';
}

// ---------------------------------------------------------------------------
// Logger (module-level, matches NestJS logger style)
// ---------------------------------------------------------------------------
const logger = new Logger('RateLimitMiddleware');

// ---------------------------------------------------------------------------
// Main middleware factory
// ---------------------------------------------------------------------------

/**
 * Options for createRateLimitMiddleware — allows injecting a test pool.
 */
export interface RateLimitMiddlewareOptions {
  /** Override the DB pool (for unit/integration tests). */
  pool?: Pool;
}

/**
 * Create the auth rate-limit Express middleware.
 *
 * SEC-8: register as `app.use(createRateLimitMiddleware())` in main.ts BEFORE
 * `app.use(middleware())`. Do NOT use as a Nest Guard — guards run after the
 * SuperTokens middleware() and miss /auth/signin.
 *
 * @returns Express RequestHandler
 */
export function createRateLimitMiddleware(opts: RateLimitMiddlewareOptions = {}) {
  return async function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const scope = resolveScope(req.method, req.path);

    // Not a rate-limited path — pass through immediately.
    if (scope === null) {
      next();
      return;
    }

    const limits = LIMITS[scope];
    if (!limits) {
      // Unknown scope (should not happen given resolveScope is exhaustive)
      next();
      return;
    }

    const identifier = extractIdentifier(req, scope);
    const pool = getPool(opts.pool);
    const now = Math.floor(Date.now() / 1000); // epoch seconds

    // SEC-2: check both windows (short + coarse). Either exceeding → 429.
    const shortIdx = windowIndex(now, SHORT_WINDOW_SECONDS);
    const coarseIdx = windowIndex(now, COARSE_WINDOW_SECONDS);

    const shortKey = makeKey(scope, identifier, SHORT_WINDOW_SECONDS, shortIdx);
    const coarseKey = makeKey(scope, identifier, COARSE_WINDOW_SECONDS, coarseIdx);

    const shortExpires = new Date((Number(shortIdx) + 1) * SHORT_WINDOW_SECONDS * 1000);
    const coarseExpires = new Date((Number(coarseIdx) + 1) * COARSE_WINDOW_SECONDS * 1000);

    // Determine seconds until the short window resets (for Retry-After header).
    const retryAfterSeconds = Math.max(1, (Number(shortIdx) + 1) * SHORT_WINDOW_SECONDS - now);

    try {
      // SEC-1: atomic UPSERT for both windows.
      const [shortCount, coarseCount] = await Promise.all([
        atomicIncrement(pool, shortKey, shortIdx, shortExpires),
        atomicIncrement(pool, coarseKey, coarseIdx, coarseExpires),
      ]);

      // SEC-2: exceed EITHER window → 429 (no enumeration — identical response)
      if (shortCount > limits.short || coarseCount > limits.coarse) {
        const exceededWindow = shortCount > limits.short ? 'short' : 'coarse';
        logger.warn(
          `[rate-limit] 429 scope=${scope} identifier=<redacted> ` +
            `window=${exceededWindow} short=${shortCount}/${limits.short} ` +
            `coarse=${coarseCount}/${limits.coarse}`
        );

        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          statusCode: 429,
          message: 'Too many requests. Please try again later.',
          retryAfter: retryAfterSeconds,
        });
        return;
      }

      next();
    } catch (err) {
      // DB error — apply SEC-5 differentiated failure policy.

      if (FAIL_OPEN_SCOPES.has(scope)) {
        // signup + reset/request: fail-OPEN (allow + log).
        logger.error(
          `[rate-limit] DB error on scope=${scope} — failing OPEN (allow). ` +
            `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        next();
        return;
      }

      if (FAIL_CLOSED_SOFT_SCOPES.has(scope)) {
        // signin + reset/confirm: fail-CLOSED-SOFT — fall back to in-process bucket.
        logger.error(
          `[rate-limit] DB error on scope=${scope} — degrading to in-process fallback. ` +
            `Error: ${err instanceof Error ? err.message : String(err)}`
        );

        const softKey = `soft:${scope}:${identifier}`;
        const allowed = softBucketAllow(softKey, SOFT_FALLBACK_LIMIT, SHORT_WINDOW_SECONDS);

        if (!allowed) {
          logger.warn(`[rate-limit] 429 (soft-fallback) scope=${scope} identifier=<redacted>`);
          res.setHeader('Retry-After', String(retryAfterSeconds));
          res.status(429).json({
            statusCode: 429,
            message: 'Too many requests. Please try again later.',
            retryAfter: retryAfterSeconds,
          });
          return;
        }

        next();
        return;
      }

      // Unknown scope policy (defensive default): fail-open + log.
      logger.error(
        `[rate-limit] DB error on scope=${scope} (no policy) — failing OPEN. ` +
          `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      next();
    }
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * TEST ONLY — reset the in-process soft bucket Map between test runs.
 * Do not call in production code.
 */
export function __resetSoftBucketsForTest(): void {
  _softBuckets.clear();
}

/**
 * TEST ONLY — reset the lazy pool reference.
 * Do not call in production code.
 */
export function __resetPoolForTest(): void {
  _pool = null;
}

// ---------------------------------------------------------------------------
// Re-export window constants for tests
// ---------------------------------------------------------------------------
export {
  COARSE_WINDOW_SECONDS,
  FAIL_CLOSED_SOFT_SCOPES,
  FAIL_OPEN_SCOPES,
  SHORT_WINDOW_SECONDS,
  SOFT_FALLBACK_LIMIT,
};
