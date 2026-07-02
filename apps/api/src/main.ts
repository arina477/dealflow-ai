import 'reflect-metadata';

import { parseEnv } from '@dealflow/shared';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import supertokens from 'supertokens-node';
import { errorHandler, middleware } from 'supertokens-node/framework/express';
import { z } from 'zod';

import { AppModule } from './app.module';
import { loadSupertokensEnv } from './modules/auth/supertokens.env';

const bootEnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  PORT: z.coerce.number().int().positive().default(3001),
});

async function bootstrap(): Promise<void> {
  const env = parseEnv(bootEnvSchema);

  // Fail-fast auth env validation + the no-alias assertion
  // (SUPERTOKENS_DATABASE_URL !== DATABASE_URL / TEST_DATABASE_URL). This runs
  // BEFORE the Nest app is created so a misconfigured Core Postgres refuses to
  // boot rather than starting silently-broken (security invariant #3).
  const stEnv = loadSupertokensEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Explicitly initialise all modules (runs onModuleInit hooks, including
  // AuthModule.onModuleInit which calls SuperTokens.init). Must happen BEFORE
  // any call to supertokens.getAllCORSHeaders() — that call throws
  // "Initialisation not done" if the SDK has not been initialised yet.
  // app.listen() also triggers init internally, but NestJS guards against
  // double-init, so calling init() here first is safe.
  await app.init();

  // CORS for the Next.js origin: must allow credentials + the SuperTokens
  // headers, or cookie sessions silently fail from the browser (gotcha #3).
  // getAllCORSHeaders() is safe to call here because app.init() above has
  // already run AuthModule.onModuleInit → SuperTokens.init().
  app.enableCors({
    origin: stEnv.WEB_ORIGIN,
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  // SuperTokens Express middleware BEFORE route handlers — serves the SDK
  // auto-routes and populates the session (gotcha #2).
  app.use(middleware());

  // SuperTokens errorHandler(). SCOPE NOTE: because Nest mounts its own router
  // for the @Controller routes, this handler only sees errors thrown by the
  // SuperTokens SDK AUTO-routes (/auth/signin, /auth/signout,
  // /auth/session/refresh, /auth/user/password/*) served by middleware() above —
  // it does NOT intercept errors thrown inside Nest controller handlers, which
  // Nest's own exception layer renders. For those SDK auto-routes it maps
  // SuperTokens session errors (e.g. TRY_REFRESH_TOKEN / UNAUTHORISED) to the
  // correct 401 rather than a 500. It is registered here (right after
  // middleware()) deliberately: our custom /auth routes handle their own session
  // errors via SessionGuard, so this handler has nothing of ours to sit "after".
  app.use(errorHandler());

  await app.listen(env.PORT);
  console.log(`API listening on port ${env.PORT}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal: failed to boot API', err);
  process.exit(1);
});
