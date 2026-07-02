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

  // CORS for the Next.js origin: must allow credentials + the SuperTokens
  // headers, or cookie sessions silently fail from the browser (gotcha #3).
  app.enableCors({
    origin: stEnv.WEB_ORIGIN,
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  });

  // SuperTokens Express middleware BEFORE route handlers — serves the SDK
  // auto-routes and populates the session (gotcha #2).
  app.use(middleware());

  // errorHandler LAST — maps SuperTokens session errors to 401 rather than 500
  // (gotcha #2). Must be after all routes are registered.
  app.use(errorHandler());

  await app.listen(env.PORT);
  console.log(`API listening on port ${env.PORT}`);
}

bootstrap().catch((err: unknown) => {
  console.error('Fatal: failed to boot API', err);
  process.exit(1);
});
