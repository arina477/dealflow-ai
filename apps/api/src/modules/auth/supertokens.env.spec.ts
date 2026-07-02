/**
 * T-2 Unit — SuperTokens boot env no-alias assertion (security invariant #3).
 *
 * The Core Postgres (SUPERTOKENS_DATABASE_URL) must NEVER alias the app DB
 * (DATABASE_URL) or the test DB (TEST_DATABASE_URL). These tests assert the
 * fail-fast throws — the API must refuse to boot on an aliased config.
 */

import { describe, expect, it } from 'vitest';
import type { SupertokensEnv } from './supertokens.env';
import { assertNoDatabaseAlias, loadSupertokensEnv } from './supertokens.env';

const TEST_DB = 'postgres://u:p@test-db:5432/test';

const base: SupertokensEnv = {
  SUPERTOKENS_CONNECTION_URI: 'http://supertokens.railway.internal:3567',
  SUPERTOKENS_API_KEY: 'test-api-key',
  SUPERTOKENS_DATABASE_URL: 'postgres://u:p@st-db:5432/st',
  INTERNAL_API_BASE_URL: 'http://localhost:3001',
  WEB_ORIGIN: 'http://localhost:3000',
  DATABASE_URL: 'postgres://u:p@app-db:5432/app',
  TEST_DATABASE_URL: TEST_DB,
};

describe('assertNoDatabaseAlias', () => {
  it('passes when all three URLs are distinct', () => {
    expect(() => assertNoDatabaseAlias(base)).not.toThrow();
  });

  it('throws when SUPERTOKENS_DATABASE_URL aliases DATABASE_URL', () => {
    expect(() =>
      assertNoDatabaseAlias({
        ...base,
        SUPERTOKENS_DATABASE_URL: base.DATABASE_URL,
      })
    ).toThrow(/must NOT alias DATABASE_URL/);
  });

  it('throws when SUPERTOKENS_DATABASE_URL aliases TEST_DATABASE_URL', () => {
    expect(() =>
      assertNoDatabaseAlias({
        ...base,
        SUPERTOKENS_DATABASE_URL: TEST_DB,
      })
    ).toThrow(/must NOT alias TEST_DATABASE_URL/);
  });

  it('passes when TEST_DATABASE_URL is unset (runtime/prod)', () => {
    const { TEST_DATABASE_URL, ...withoutTest } = base;
    void TEST_DATABASE_URL;
    expect(() => assertNoDatabaseAlias(withoutTest)).not.toThrow();
  });
});

describe('loadSupertokensEnv', () => {
  it('parses a valid source and runs the no-alias assertion', () => {
    const env = loadSupertokensEnv({
      SUPERTOKENS_CONNECTION_URI: base.SUPERTOKENS_CONNECTION_URI,
      SUPERTOKENS_API_KEY: base.SUPERTOKENS_API_KEY,
      SUPERTOKENS_DATABASE_URL: base.SUPERTOKENS_DATABASE_URL,
      INTERNAL_API_BASE_URL: base.INTERNAL_API_BASE_URL,
      WEB_ORIGIN: base.WEB_ORIGIN,
      DATABASE_URL: base.DATABASE_URL,
      TEST_DATABASE_URL: base.TEST_DATABASE_URL,
    });
    expect(env.SUPERTOKENS_API_KEY).toBe('test-api-key');
  });

  it('throws on a missing required var', () => {
    expect(() =>
      loadSupertokensEnv({
        SUPERTOKENS_CONNECTION_URI: base.SUPERTOKENS_CONNECTION_URI,
        // SUPERTOKENS_API_KEY missing
        SUPERTOKENS_DATABASE_URL: base.SUPERTOKENS_DATABASE_URL,
        INTERNAL_API_BASE_URL: base.INTERNAL_API_BASE_URL,
        WEB_ORIGIN: base.WEB_ORIGIN,
        DATABASE_URL: base.DATABASE_URL,
      })
    ).toThrow(/Environment validation failed/);
  });

  it('fails fast when the parsed source aliases the app DB', () => {
    expect(() =>
      loadSupertokensEnv({
        SUPERTOKENS_CONNECTION_URI: base.SUPERTOKENS_CONNECTION_URI,
        SUPERTOKENS_API_KEY: base.SUPERTOKENS_API_KEY,
        SUPERTOKENS_DATABASE_URL: base.DATABASE_URL, // aliased!
        INTERNAL_API_BASE_URL: base.INTERNAL_API_BASE_URL,
        WEB_ORIGIN: base.WEB_ORIGIN,
        DATABASE_URL: base.DATABASE_URL,
      })
    ).toThrow(/must NOT alias DATABASE_URL/);
  });
});
