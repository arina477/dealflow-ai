import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // Enable emitDecoratorMetadata so NestJS DI metadata assertions work in tests.
    // Without this, vitest's default esbuild transform strips design:paramtypes,
    // making `import type` DI-injection bugs invisible until the compiled app boots.
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts', 'test/**/*.{spec,test,e2e-spec}.ts'],
    alias: {
      '@dealflow/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
    // Dummy env defaults applied BEFORE any module is imported (guaranteed
    // pre-import path for vitest's test.env).  These allow src/db/index.ts to
    // pass its eager parseEnv() call at module-eval time so unit tests that mock
    // the DB can run in any environment (local without a .env, CI without env
    // vars forwarded through turbo).  They are obviously-fake values that never
    // connect to a real database — the unit-test suites override the DB handle
    // via mocks/DI overrides.  Production parseEnv() is unchanged; it only runs
    // in the real process with real env vars.
    //
    // TEST_DATABASE_URL is intentionally NOT set here: health.e2e-spec.ts reads
    // it at module-load time to decide whether to skip the integration suite.
    // Setting a dummy value would bypass that guard and cause the e2e to attempt
    // a real Postgres connection against a non-existent host.  The e2e's
    // skip-when-unset contract is preserved exactly as authored.
    //
    // SUPERTOKENS_DATABASE_URL is set to a distinct dummy so the no-alias
    // boot assertion (SUPERTOKENS_DATABASE_URL !== DATABASE_URL) does not trip
    // if loadSupertokensEnv() is ever called in a test context where both vars
    // would otherwise be identical.
    env: {
      DATABASE_URL: 'postgres://test:test@localhost:5432/test_unit',
      SUPERTOKENS_CONNECTION_URI: 'http://localhost:3567',
      SUPERTOKENS_API_KEY: 'test-api-key-dummy',
      SUPERTOKENS_DATABASE_URL: 'postgres://test:test@localhost:5432/test_supertokens_unit',
      INTERNAL_API_BASE_URL: 'http://localhost:4000',
      WEB_ORIGIN: 'http://localhost:3000',
    },
  },
});
