/**
 * SuperTokens boot-time environment schema + fail-fast assertions
 * (arch delta 2 / security invariant: Core Postgres never aliases the app DB).
 *
 * Two guarantees enforced at boot (before the Nest app is created):
 *
 *   1. Required auth env vars are present and well-formed (Zod).
 *
 *   2. SUPERTOKENS_DATABASE_URL — the Core's OWN Postgres — is NEVER equal to
 *      DATABASE_URL (app DB) or TEST_DATABASE_URL (product decision #11). If it
 *      aliases either, boot FAILS FAST (throws) — the API must not start in a
 *      state where auth data and application data share a database.
 *
 * SUPERTOKENS_DATABASE_URL is the Core's connection string; the NestJS SDK
 * never opens it directly (the Core owns it). It is validated here purely to
 * assert the no-alias invariant at the one process that reads all three URLs.
 */

import { parseEnv } from '@dealflow/shared';
import { z } from 'zod';

export const supertokensEnvSchema = z.object({
  SUPERTOKENS_CONNECTION_URI: z.string().url('SUPERTOKENS_CONNECTION_URI must be a valid URL'),
  SUPERTOKENS_API_KEY: z.string().min(1, 'SUPERTOKENS_API_KEY must not be empty'),
  SUPERTOKENS_DATABASE_URL: z.string().url('SUPERTOKENS_DATABASE_URL must be a valid URL'),
  INTERNAL_API_BASE_URL: z.string().url('INTERNAL_API_BASE_URL must be a valid URL'),
  WEB_ORIGIN: z.string().url('WEB_ORIGIN must be a valid URL'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  // TEST_DATABASE_URL is optional at runtime (only set in test/CI); when
  // present it is subject to the same no-alias assertion.
  TEST_DATABASE_URL: z.string().url().optional(),
});

export type SupertokensEnv = z.infer<typeof supertokensEnvSchema>;

/**
 * Parse + assert the auth env. Throws (fail-fast) on any missing/invalid var
 * or on the no-alias invariant being violated.
 */
export function loadSupertokensEnv(
  source: Record<string, string | undefined> = process.env
): SupertokensEnv {
  const env = parseEnv(supertokensEnvSchema, source);

  assertNoDatabaseAlias(env);

  return env;
}

/**
 * Security invariant: the SuperTokens Core Postgres MUST NOT alias the app DB.
 * Exported separately so it is directly unit-testable.
 */
export function assertNoDatabaseAlias(env: SupertokensEnv): void {
  if (env.SUPERTOKENS_DATABASE_URL === env.DATABASE_URL) {
    throw new Error(
      'FATAL: SUPERTOKENS_DATABASE_URL must NOT alias DATABASE_URL. ' +
        'The SuperTokens Core requires its own separate Postgres instance ' +
        '(product decision #11). Refusing to boot.'
    );
  }
  if (
    env.TEST_DATABASE_URL !== undefined &&
    env.SUPERTOKENS_DATABASE_URL === env.TEST_DATABASE_URL
  ) {
    throw new Error(
      'FATAL: SUPERTOKENS_DATABASE_URL must NOT alias TEST_DATABASE_URL. ' +
        'The SuperTokens Core requires its own separate Postgres instance ' +
        '(product decision #11). Refusing to boot.'
    );
  }
}
