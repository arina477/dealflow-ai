import 'reflect-metadata';

import { parseEnv } from '@dealflow/shared';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import supertokens from 'supertokens-node';
import { errorHandler, middleware } from 'supertokens-node/framework/express';
import { z } from 'zod';

import { AppModule } from './app.module';
import { assertNonSuperuserConnection, assertUrlsDistinct, pool, runMigrationsOnBoot } from './db';
import { createRateLimitMiddleware } from './modules/auth/rate-limit.middleware';
import { initSupertokens } from './modules/auth/supertokens.config';
import { loadSupertokensEnv } from './modules/auth/supertokens.env';

const bootEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  PORT: z.coerce.number().int().positive().default(3001),
});

async function bootstrap(): Promise<void> {
  const env = parseEnv(bootEnvSchema);

  // ── 2-URLs-distinct preflight (wave-26 RLS connection-split ACs) ────────────
  // Runs BEFORE any DB connection is opened. Throws if DATABASE_URL and
  // MIGRATE_DATABASE_URL are both set and equal — that would mean the app runs as
  // the owner/migration role, bypassing FORCE ROW LEVEL SECURITY.
  // No-ops gracefully when MIGRATE_DATABASE_URL is absent (local dev / tests).
  // See apps/api/src/db/index.ts § assertUrlsDistinct.
  if (process.env.NODE_ENV !== 'test') {
    assertUrlsDistinct();
  }

  // ── Wave-38 fix: migrate-on-boot (run pending migrations with owner role) ──
  // Runs BEFORE any tenant DB access. Executes all pending migrations from
  // ./src/db/migrations using the MIGRATE_DATABASE_URL connection (owner role),
  // then closes that connection. Fails loudly (throws) if any migration errors,
  // preventing the app from starting with a partial schema.
  // No-ops gracefully when MIGRATE_DATABASE_URL is absent (local dev / tests).
  // See apps/api/src/db/index.ts § runMigrationsOnBoot and wave-38 P-0/P-3.
  if (process.env.NODE_ENV !== 'test') {
    await runMigrationsOnBoot();
  }

  // ── RLS-enforcement guard (Finding #2, B-6 rework2) ─────────────────────────
  // MUST run before any tenant DB access. Fails loudly if the app is connected as
  // a superuser or BYPASSRLS role — isolation would be silently unenforced.
  // See apps/api/src/db/index.ts § assertNonSuperuserConnection and migration 0016.
  // See also command-center/dev/architecture/devops.md § "RLS connection-split & role-privilege deploy contract".
  //
  // In CI/test, TEST_DATABASE_URL connects as the superuser for migrations;
  // the app's DATABASE_URL (set in Railway) MUST be the dealflow_app role URL.
  // This check is skipped in unit tests (no DB connection needed for unit tests).
  if (process.env.NODE_ENV !== 'test') {
    await assertNonSuperuserConnection();
  }

  // Fail-fast auth env validation + the no-alias assertion
  // (SUPERTOKENS_DATABASE_URL !== DATABASE_URL / TEST_DATABASE_URL). This runs
  // BEFORE the Nest app is created so a misconfigured Core Postgres refuses to
  // boot rather than starting silently-broken (security invariant #3).
  const stEnv = loadSupertokensEnv();

  // Initialise SuperTokens BEFORE NestFactory.create() so that:
  //
  //   1. getAllCORSHeaders() is available immediately for CORS wiring (it
  //      throws "Initialisation not done" if called before init).
  //
  //   2. middleware() can be registered via app.use() BEFORE app.listen()
  //      mounts the Nest router in the Express chain. This is the canonical
  //      SuperTokens + Express integration ordering: middleware() MUST sit
  //      ahead of your route handlers so the SDK can serve its own auto-routes
  //      (/auth/signin, /auth/signout, /auth/session/refresh, etc.) before
  //      Express ever reaches the app router.
  //
  //      In NestJS, app.use() calls made before app.listen() are prepended to
  //      the underlying Express stack; app.listen() triggers app.init()
  //      internally which mounts the Nest router at the END of that stack.
  //      This ordering guarantees SuperTokens middleware intercepts /auth/*
  //      auto-routes first — the prior bug had middleware() registered AFTER
  //      app.init() (via the CORS-before-init fix), so the Nest router sat
  //      ahead of it and returned 404 on every browser real-auth call.
  //
  // The createNewSession role-claim override uses the module-singleton pool
  // directly (src/db/index.ts) via resolve_user_workspace (SECURITY DEFINER,
  // RLS-exempt) rather than an injected AuthRepository.
  //
  // B-6 rework3 — RLS-exempt path (P0 fix):
  // This callback runs at signin/refresh — BEFORE any session or WorkspaceInterceptor
  // context exists. Under dealflow_app (NOSUPERUSER FORCE RLS), a direct Drizzle
  // users SELECT returns 0 rows (no GUC set → NULL = uuid → false) → null role →
  // claim silently dropped → subsequent guard checks resolve null again → 403.
  // Fix: call resolve_user_workspace(st_user_id) via pool.query — same SECURITY
  // DEFINER pattern as getInviteEmail; bypasses FORCE RLS; EXECUTE already granted
  // to dealflow_app (migration 0016 step 5). stUserId is the SERVER-VERIFIED
  // SuperTokens session subject (never client-supplied).
  initSupertokens({
    env: stEnv,
    resolveRole: async (supertokensUserId: string): Promise<string | null> => {
      const result = await pool.query<{ role_name: string }>(
        'SELECT role_name FROM resolve_user_workspace($1)',
        [supertokensUserId]
      );
      return result.rows[0]?.role_name ?? null;
    },
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // SEC-3 (wave-25 M10 auth-hardening): trust exactly 1 proxy hop.
  //
  // Railway terminates TLS at its edge proxy and forwards requests with a
  // single X-Forwarded-For hop. Setting trust proxy = 1 tells Express to
  // trust the first entry in XFF as the client IP — req.ip is then the
  // Railway-resolved client IP, NOT the raw socket address (which would be
  // the Railway proxy's internal IP). A forged XFF header added by a client
  // beyond that first hop is ignored.
  //
  // hop count = 1 is documented in command-center/dev/trust-proxy-hop-count.md.
  // Do NOT use `true` (trusts all hops) — that allows XFF spoofing.
  // Do NOT use `false` (default, no trust) — req.ip would be the Railway
  // proxy IP rather than the actual client IP, collapsing all requests into
  // the same rate-limit bucket.
  app.set('trust proxy', 1);

  // CORS for the Next.js origin: must allow credentials + the SuperTokens
  // headers, or cookie sessions silently fail from the browser (gotcha #3).
  // getAllCORSHeaders() is safe here because initSupertokens() has already run.
  app.enableCors({
    origin: stEnv.WEB_ORIGIN,
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  // SEC-8 (wave-25 M10 auth-hardening): rate-limit middleware registered
  // BEFORE middleware() (SuperTokens). This is load-bearing: the SuperTokens
  // middleware() fully handles /auth/signin internally — a Nest guard or
  // interceptor registered after middleware() would never see that route.
  // Express processes app.use() handlers in registration order; by placing
  // rateLimitMiddleware here, it intercepts ALL /auth/* POSTs before the SDK
  // or the Nest router ever see the request.
  //
  // The rate-limit store is Postgres (shared across Railway replicas — not
  // in-memory per-instance). Fail modes are differentiated by scope (SEC-5):
  //   signup + reset/request → fail-OPEN  (allow + log on DB error)
  //   signin + reset/confirm → fail-CLOSED-SOFT  (in-process fallback ~5/min)
  //
  // See apps/api/src/modules/auth/rate-limit.middleware.ts for full SEC-N detail.
  app.use(createRateLimitMiddleware());

  // SuperTokens Express middleware registered BEFORE app.listen() (which
  // triggers app.init() and mounts the Nest router). Because all app.use()
  // calls before listen() are prepended to the Express stack, middleware()
  // intercepts /auth/* auto-routes first — OPTIONS preflights get CORS
  // headers, POST /auth/signin is handled by SuperTokens, etc. — before Nest
  // ever sees the request (gotcha #2 / browser-login fix).
  app.use(middleware());

  // SuperTokens errorHandler() — after middleware() and before app.listen()
  // (Nest router mount). Catches errors from the SDK auto-routes served by
  // middleware() above and maps them (e.g. TRY_REFRESH_TOKEN / UNAUTHORISED)
  // to correct HTTP status codes. Does NOT intercept Nest controller handler
  // errors (those go to Nest's own exception layer).
  app.use(errorHandler());

  await app.listen(env.PORT);
  console.log(`API listening on port ${env.PORT}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal: failed to boot API', err);
  process.exit(1);
});
