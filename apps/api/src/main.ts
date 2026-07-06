import 'reflect-metadata';

import { parseEnv } from '@dealflow/shared';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { eq } from 'drizzle-orm';
import supertokens from 'supertokens-node';
import { errorHandler, middleware } from 'supertokens-node/framework/express';
import { z } from 'zod';

import { AppModule } from './app.module';
import { assertNonSuperuserConnection, db } from './db';
import { roles, users } from './db/schema';
import { initSupertokens } from './modules/auth/supertokens.config';
import { loadSupertokensEnv } from './modules/auth/supertokens.env';

const bootEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  PORT: z.coerce.number().int().positive().default(3001),
});

async function bootstrap(): Promise<void> {
  const env = parseEnv(bootEnvSchema);

  // ── RLS-enforcement guard (Finding #2, B-6 rework2) ─────────────────────────
  // MUST run before any tenant DB access. Fails loudly if the app is connected as
  // a superuser or BYPASSRLS role — isolation would be silently unenforced.
  // See apps/api/src/db/index.ts § assertNonSuperuserConnection and migration 0016.
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
  // The createNewSession role-claim override uses the module-singleton Drizzle
  // client (src/db/index.ts) directly rather than an injected AuthRepository.
  // This decouples SuperTokens init from the Nest DI container lifecycle —
  // no OnModuleInit hook needed in AuthModule.
  initSupertokens({
    env: stEnv,
    resolveRole: async (supertokensUserId: string): Promise<string | null> => {
      const rows = await db
        .select({ roleName: roles.name })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(eq(users.supertokensUserId, supertokensUserId))
        .limit(1);
      return rows[0]?.roleName ?? null;
    },
  });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // CORS for the Next.js origin: must allow credentials + the SuperTokens
  // headers, or cookie sessions silently fail from the browser (gotcha #3).
  // getAllCORSHeaders() is safe here because initSupertokens() has already run.
  app.enableCors({
    origin: stEnv.WEB_ORIGIN,
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

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
