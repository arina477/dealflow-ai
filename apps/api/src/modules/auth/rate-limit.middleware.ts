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
 * BODY PARSING (SEC-4/SEC-6 fix, B-6 rework):
 *   This middleware runs BEFORE SuperTokens middleware() and BEFORE Nest's body
 *   parser. At that point req.body is undefined. Without reading the body, the
 *   email cannot be extracted, causing fallback to req.ip (per-IP keying only —
 *   SEC-4/SEC-6 defeated).
 *
 *   Fix: for rate-limited auth POST routes, the middleware buffers and parses
 *   the raw body in-place, sets req.body to the parsed JSON object, and continues.
 *   Downstream consumers (SuperTokens, Nest) see req.body already populated as
 *   a plain object. SuperTokens' assertThatBodyParserHasBeenUsedForExpressLikeRequest
 *   checks: if req.body is a non-empty object (not undefined / Buffer / {readable}),
 *   it uses req.body directly WITHOUT reading the stream again. This is confirmed
 *   in supertokens-node/lib/build/framework/utils.js § assertThatBodyParser…
 *   (the else-if branch: request.body undefined OR Buffer OR empty+readable → stream
 *   read; else → use existing object). Stream consumed once by this middleware;
 *   zero double-consumption risk.
 *
 *   Body parsing is scoped to POST requests on the four rate-limited paths only.
 *   Non-auth routes skip all body buffering.
 *
 *   reset/confirm has no email in its body ({ token, password }) — it uses req.ip.
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

/**
 * Maximum body size accepted by ensureBodyParsed (bytes).
 * Matches body-parser's default 100KB limit. Bodies larger than this are
 * rejected immediately — the middleware resolves to {} (fallback to IP keying)
 * and the downstream handler receives an empty-ish body it will reject with 400.
 * This prevents OOM via large-body stream buffering (P2-A).
 */
const BODY_SIZE_LIMIT_BYTES = 100 * 1024; // 100 KB

/**
 * Maximum time (ms) to wait for the request stream to emit 'end'.
 * Guards against slow-loris / never-completing bodies that would hold the
 * connection open indefinitely by keeping this middleware's Promise pending.
 * On timeout the middleware resolves to {} (fallback to IP keying) — the
 * request proceeds to normal handling which will reject a malformed body.
 * (P2-A)
 */
const BODY_READ_TIMEOUT_MS = 5_000; // 5 seconds
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
 *   signup-firm:    3 attempts / 60 s  (workspace creation — stricter; unbounded-creation vector)
 *   reset/request: 5 attempts / 60 s
 *   reset/confirm: 5 attempts / 60 s   (token brute-force = account takeover)
 *
 * COARSE limits (per hour per account/IP):
 *   signin:        20 attempts / h
 *   signup:        10 attempts / h
 *   signup-firm:    5 attempts / h     (workspace creation — stricter; unbounded-creation vector)
 *   reset/request: 10 attempts / h
 *   reset/confirm: 10 attempts / h
 */
const LIMITS: Record<string, { short: number; coarse: number }> = {
  signin: { short: 10, coarse: 20 },
  signup: { short: 5, coarse: 10 },
  'signup-firm': { short: 3, coarse: 5 },
  'reset/request': { short: 5, coarse: 10 },
  'reset/confirm': { short: 5, coarse: 10 },
};

/** Fallback in-process limit for fail-CLOSED-SOFT paths (signin + reset/confirm). */
const SOFT_FALLBACK_LIMIT = 5; // per SHORT_WINDOW_SECONDS per instance

/**
 * How often (ms) the background sweeper DELETEs expired rate_limit_hits rows.
 * The DELETE is bounded by the expires_at index and is fully idempotent —
 * multiple instances running it concurrently is safe (last-writer-wins on the
 * same rows, but they all delete the same expired set). (P2-B)
 */
const SWEEPER_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

/**
 * Scopes that are fail-OPEN on DB error (allow + log).
 * signup and reset/request: invite-only protects signup; reset/request
 * is no-enumeration and low-value without the token.
 * signup-firm: falls back to IP-keyed in-process bucket — unbounded-workspace
 * creation is a DoS vector so we degrade gracefully (fail-CLOSED-SOFT).
 */
const FAIL_OPEN_SCOPES = new Set(['signup', 'reset/request']);

/**
 * Scopes that are fail-CLOSED-SOFT on DB error (in-process fallback).
 * signin: invite-only doesn't protect it; password guessing = account compromise.
 * reset/confirm: token brute-force = account takeover.
 * signup-firm: unbounded workspace creation is a DoS vector — soft-closed on DB error.
 */
const FAIL_CLOSED_SOFT_SCOPES = new Set(['signin', 'reset/confirm', 'signup-firm']);

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
// Expired-row sweeper (P2-B — prevents unbounded table growth)
// ---------------------------------------------------------------------------

/**
 * Sweeper state — tracks whether the background interval has been started and
 * holds a reference so it can be cleared in tests.
 */
let _sweeperInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Delete all rows from rate_limit_hits where expires_at < now().
 *
 * Called by the background sweeper interval. Safe to call from multiple
 * instances concurrently — the DELETE is idempotent and bounded by the
 * expires_at index. Errors are logged but never thrown; a transient DB
 * failure just defers cleanup to the next tick.
 *
 * @param pool - pg Pool instance
 */
async function sweepExpiredRows(pool: Pool): Promise<void> {
  try {
    const result = await pool.query('DELETE FROM rate_limit_hits WHERE expires_at < now()');
    const deleted: number = (result as { rowCount: number | null }).rowCount ?? 0;
    if (deleted > 0) {
      logger.log(`[rate-limit] sweeper: deleted ${deleted} expired rows`);
    }
  } catch (err) {
    logger.error(
      `[rate-limit] sweeper: DELETE failed (non-fatal) — ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/**
 * Start the background sweeper interval that deletes expired rate_limit_hits rows.
 *
 * Called once at module initialisation (inside createRateLimitMiddleware on first
 * call). The interval is unref'd so it does not prevent Node from exiting during
 * graceful shutdown. Multiple calls are idempotent — only one interval is ever
 * running at a time.
 *
 * @param pool - pg Pool instance used for the DELETE query
 */
function startSweeper(pool: Pool): void {
  if (_sweeperInterval !== null) return; // already running
  _sweeperInterval = setInterval(() => {
    void sweepExpiredRows(pool);
  }, SWEEPER_INTERVAL_MS);
  // unref so the interval does not prevent the process from exiting cleanly.
  if (typeof _sweeperInterval.unref === 'function') {
    _sweeperInterval.unref();
  }
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
    const dbModule = require('../../db/index') as { pool: Pool };
    _pool = dbModule.pool;
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
  if (p === '/auth/signup-firm') return 'signup-firm';
  if (p === '/auth/reset/request') return 'reset/request';
  if (p === '/auth/reset/confirm') return 'reset/confirm';
  return null;
}

// ---------------------------------------------------------------------------
// Body buffering (SEC-4/SEC-6 fix — parse body before keying)
// ---------------------------------------------------------------------------

/**
 * Buffer and JSON-parse the request body if it has not been parsed yet.
 *
 * Sets req.body to the parsed JSON object in-place so downstream middleware
 * (SuperTokens, Nest) can read it without consuming the stream a second time.
 * SuperTokens' assertThatBodyParserHasBeenUsedForExpressLikeRequest checks
 * whether req.body is a non-empty plain object: if it is, the SDK uses it
 * directly without calling its internal stream reader. This prevents double-
 * consumption.
 *
 * Returns the parsed body or an empty object on parse failure. Never throws.
 * Only called for POST requests on rate-limited scopes.
 *
 * DoS hardening (P2-A):
 *   • Content-Length short-circuit: if the declared Content-Length header
 *     exceeds BODY_SIZE_LIMIT_BYTES the stream is not read at all — returns {}
 *     immediately (fallback to IP keying; downstream rejects the oversized body).
 *   • Byte ceiling: accumulated chunk bytes are tracked; if the running total
 *     exceeds BODY_SIZE_LIMIT_BYTES the stream is destroyed and {} is returned
 *     so an attacker cannot OOM the process with a streaming body.
 *   • Read timeout: a BODY_READ_TIMEOUT_MS deadline races the stream 'end'
 *     event; if the stream never completes (slow-loris) the timeout wins, the
 *     stream is destroyed, and {} is returned (fallback to IP keying).
 */
async function ensureBodyParsed(req: Request): Promise<Record<string, unknown>> {
  // Already parsed by an upstream middleware (e.g. in tests that pre-populate req.body)
  const existing = (req as Request & { body?: unknown }).body;
  if (existing !== undefined && existing !== null && typeof existing === 'object') {
    return existing as Record<string, unknown>;
  }

  // Short-circuit on declared Content-Length — avoids allocating even a single
  // chunk for obviously oversized bodies.
  // Guard: unit-test mock objects may have no headers property — treat as 0.
  const rawHeaders = (req as Request & { headers?: Record<string, string | string[] | undefined> })
    .headers;
  const contentLength = Number(rawHeaders?.['content-length'] ?? 0);
  if (contentLength > BODY_SIZE_LIMIT_BYTES) {
    logger.warn(
      `[rate-limit] ensureBodyParsed: Content-Length ${contentLength} exceeds ${BODY_SIZE_LIMIT_BYTES}B cap — skipping body read (fallback to IP)`
    );
    return {};
  }

  // Check whether the request object is actually a readable stream.
  // Unit-test mock objects (plain POJOs) do not implement EventEmitter; if 'on'
  // is missing or not a function we treat the body as empty and fall back to IP.
  if (typeof (req as unknown as { on?: unknown }).on !== 'function') {
    return {};
  }

  // Buffer the raw body from the readable stream.
  // Races a read-timeout against stream completion to guard against slow-loris.
  return new Promise<Record<string, unknown>>((resolve) => {
    let settled = false;
    const chunks: Buffer[] = [];
    let bytesAccumulated = 0;

    // Read-timeout guard (P2-A — slow-loris defence).
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      logger.warn(
        `[rate-limit] ensureBodyParsed: read timed out after ${BODY_READ_TIMEOUT_MS}ms — falling back to IP keying`
      );
      // Destroy the stream so the connection is cleaned up promptly.
      if (typeof (req as unknown as { destroy?: () => void }).destroy === 'function') {
        (req as unknown as { destroy: () => void }).destroy();
      }
      resolve({});
    }, BODY_READ_TIMEOUT_MS);

    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      bytesAccumulated += chunk.length;
      if (bytesAccumulated > BODY_SIZE_LIMIT_BYTES) {
        // Body exceeds cap — abort stream immediately (P2-A — OOM prevention).
        settled = true;
        clearTimeout(timer);
        logger.warn(
          `[rate-limit] ensureBodyParsed: body exceeded ${BODY_SIZE_LIMIT_BYTES}B cap — falling back to IP keying`
        );
        if (typeof (req as unknown as { destroy?: () => void }).destroy === 'function') {
          (req as unknown as { destroy: () => void }).destroy();
        }
        resolve({});
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        const parsed = raw.length > 0 ? (JSON.parse(raw) as Record<string, unknown>) : {};
        // Attach to req.body so downstream (SuperTokens/Nest) sees it as pre-parsed.
        // SuperTokens checks: req.body is defined object → uses directly (no re-read).
        (req as Request & { body: unknown }).body = parsed;
        resolve(parsed);
      } catch {
        // Malformed JSON — return empty object. The rate limiter falls back to IP.
        resolve({});
      }
    });

    req.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({});
    });
  });
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
 *
 * @param body - already-parsed body (from ensureBodyParsed)
 * @param req  - for IP fallback
 * @param scope - used to determine whether to attempt email extraction
 */
function extractIdentifier(body: Record<string, unknown>, req: Request, scope: string): string {
  // For reset/confirm the body has { token, password } — no email. Use IP.
  if (scope === 'reset/confirm') {
    return req.ip ?? 'unknown';
  }

  // signup-firm body has { firmName, email, password } — email field is present.
  // Falls through to the direct email field extraction below.

  // Direct email field (our Nest-parsed bodies: reset/request).
  // NOTE: signup body is { inviteToken, password } — no email field — so it
  // falls through to IP keying below. Per-invite bucketing (inviteToken) is an
  // option but per-IP is acceptable: signup is invite-only so enumeration risk
  // is minimal. The comment "Direct email field (...signup...)" in earlier
  // versions was incorrect. (P2-D)
  const emailField = body.email;
  if (typeof emailField === 'string' && emailField.length > 0) {
    return emailField;
  }

  // SuperTokens uses formFields array: [{ id: 'email', value: '...' }]
  // This is the shape the SuperTokens SDK sends to its own auto-routes (/auth/signin).
  const ff = body.formFields;
  if (Array.isArray(ff)) {
    for (const field of ff as Array<{ id?: string; value?: unknown }>) {
      if (field.id === 'email' && typeof field.value === 'string' && field.value.length > 0) {
        return field.value;
      }
    }
  }

  // Body has no recognisable email field — use client IP as fallback.
  // This should not happen for signin/signup/reset/request with well-formed requests,
  // but defends against malformed bodies without blocking the request here
  // (the handler will reject them with 400 downstream).
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
/**
 * Classify a thrown error as a connection/infrastructure error (true) or an
 * unexpected/programming error (false).
 *
 * Only connection-class errors justify fail-OPEN on signup/reset-request (SEC-5).
 * An unexpected error (bad SQL, coercion bug, logic error) that always-throws
 * must NOT silently disable the limiter for those scopes — it should be treated
 * as fail-CLOSED-SOFT (in-process fallback) or escalated, not silently bypassed.
 *
 * pg driver signals connection problems via:
 *   • SQLSTATE class 08 (connection exceptions)
 *   • SQLSTATE class 57P (admin shutdown / operator intervention)
 *   • err.code === 'ECONNREFUSED' / 'ENOTFOUND' / 'ETIMEDOUT' (Node TCP errors)
 *   • err.code === 'CONNECTION_ENDED' / 'POOL_MAX_CALLS_EXCEEDED' (pg pool)
 *   • err.message containing typical transient patterns
 *
 * (P2-C)
 */
function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  // pg SQLSTATE codes surfaced as err.code on DatabaseError
  const code = (err as Error & { code?: string }).code ?? '';

  // SQLSTATE class 08 — connection exceptions
  if (code.startsWith('08')) return true;
  // SQLSTATE 57P01 / 57P02 / 57P03 — admin shutdown / crash recovery
  if (code.startsWith('57P')) return true;
  // Node TCP / DNS error codes
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNRESET', 'EPIPE'].includes(code)) {
    return true;
  }
  // pg pool-level codes
  if (['CONNECTION_ENDED', 'POOL_MAX_CALLS_EXCEEDED'].includes(code)) return true;
  // Fallback: message heuristics for drivers that don't surface structured codes
  if (
    msg.includes('connection refused') ||
    msg.includes('connect econnrefused') ||
    msg.includes('connection terminated') ||
    msg.includes('connection ended') ||
    msg.includes('timeout expired') ||
    msg.includes('connection timed out')
  ) {
    return true;
  }
  return false;
}

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

    // SEC-4/SEC-6: parse the body BEFORE keying so we can extract the email.
    // ensureBodyParsed buffers the stream and sets req.body in-place, making
    // it available to downstream SuperTokens/Nest without double-consuming.
    const body = await ensureBodyParsed(req);
    const identifier = extractIdentifier(body, req, scope);

    const pool = getPool(opts.pool);

    // P2-B: start the background expired-row sweeper on first use.
    startSweeper(pool);

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
      //
      // P2-C: fail-OPEN is only safe for connection-class errors (DB unreachable).
      // An unexpected/programming error (bad SQL, coercion bug) that always-throws
      // must NOT silently disable the limiter — it degrades to the in-process soft
      // fallback (same path as fail-CLOSED-SOFT scopes) rather than allowing
      // unlimited requests through. This ensures a code bug can't silently bypass
      // the limiter for signup/reset-request.
      const connError = isConnectionError(err);

      if (FAIL_OPEN_SCOPES.has(scope)) {
        if (connError) {
          // signup + reset/request + connection error: fail-OPEN (allow + log).
          logger.error(
            `[rate-limit] DB connection error on scope=${scope} — failing OPEN (allow). ` +
              `Error: ${err instanceof Error ? err.message : String(err)}`
          );
          next();
          return;
        }
        // Non-connection error (programming/unexpected): degrade to soft fallback
        // rather than failing open — a latent bug must not silently disable the limiter.
        logger.error(
          `[rate-limit] Unexpected (non-connection) DB error on scope=${scope} — ` +
            `degrading to in-process soft fallback (NOT failing open). ` +
            `Error: ${err instanceof Error ? err.message : String(err)}`
        );
        // fall through to the soft-fallback block below
      }

      if (FAIL_CLOSED_SOFT_SCOPES.has(scope) || (FAIL_OPEN_SCOPES.has(scope) && !connError)) {
        // signin + reset/confirm always use soft fallback.
        // signup + reset/request also use soft fallback for non-connection errors (P2-C).
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

      // Unknown scope policy (defensive default): fail-closed-soft + log.
      logger.error(
        `[rate-limit] DB error on scope=${scope} (no policy) — falling back to in-process soft fallback. ` +
          `Error: ${err instanceof Error ? err.message : String(err)}`
      );
      const softKey = `soft:${scope}:unknown`;
      const allowed = softBucketAllow(softKey, SOFT_FALLBACK_LIMIT, SHORT_WINDOW_SECONDS);
      if (!allowed) {
        res.setHeader('Retry-After', String(retryAfterSeconds));
        res.status(429).json({
          statusCode: 429,
          message: 'Too many requests. Please try again later.',
          retryAfter: retryAfterSeconds,
        });
        return;
      }
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

/**
 * TEST ONLY — stop and clear the background sweeper interval.
 * Call in afterEach/afterAll when testing sweeper behaviour.
 * Do not call in production code.
 */
export function __resetSweeperForTest(): void {
  if (_sweeperInterval !== null) {
    clearInterval(_sweeperInterval);
    _sweeperInterval = null;
  }
}

// ---------------------------------------------------------------------------
// Re-export window constants for tests
// ---------------------------------------------------------------------------
export {
  BODY_READ_TIMEOUT_MS,
  BODY_SIZE_LIMIT_BYTES,
  COARSE_WINDOW_SECONDS,
  FAIL_CLOSED_SOFT_SCOPES,
  FAIL_OPEN_SCOPES,
  SHORT_WINDOW_SECONDS,
  SOFT_FALLBACK_LIMIT,
  SWEEPER_INTERVAL_MS,
};
