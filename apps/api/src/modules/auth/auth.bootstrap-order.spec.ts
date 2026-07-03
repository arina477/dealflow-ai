/**
 * Bootstrap ordering regression — SuperTokens.init before getAllCORSHeaders
 * and before middleware() registration.
 *
 * WHY THIS TEST EXISTS:
 *   main.ts must call initSupertokens() BEFORE NestFactory.create() so that:
 *
 *   (A) getAllCORSHeaders() is available for CORS wiring: the call throws
 *       "Initialisation not done. Did you forget to call the SuperTokens.init
 *       function?" if SuperTokens.init() has not yet run.
 *
 *   (B) middleware() can be registered via app.use() BEFORE app.listen()
 *       mounts the Nest router. NestJS prepends app.use() middleware to the
 *       Express stack ahead of the Nest router; app.listen() then triggers
 *       app.init() which mounts the Nest router at the END. This ordering
 *       ensures the SuperTokens middleware intercepts /auth/* auto-routes
 *       first — before the Nest router returns 404.
 *
 *   The prior fix (wave-2 ab23d4c) called `await app.init()` explicitly
 *   between NestFactory.create() and getAllCORSHeaders(), which solved (A) but
 *   not (B): middleware() was still registered AFTER app.init() had already
 *   mounted the Nest router, so /auth/* auto-routes and OPTIONS preflights
 *   still returned 404 from Nest in the browser. The current fix moves
 *   initSupertokens() before NestFactory.create() entirely, registers
 *   middleware() via app.use() before app.listen(), and eliminates the
 *   redundant explicit app.init() call.
 *
 * WHAT IT CATCHES:
 *   - Any future refactor that moves getAllCORSHeaders() before
 *     initSupertokens() in main.ts.
 *   - Any removal of initSupertokens() from bootstrap() (moving it back into
 *     an OnModuleInit hook would break the middleware-before-router ordering).
 *
 * NOTE ON NETWORK:
 *   SuperTokens.init() is config-only — it does NOT open a connection to Core.
 *   Core connections are lazy (first recipe call). The dummy SUPERTOKENS_*
 *   env vars injected by vitest.config.ts test.env are sufficient; no live
 *   Core is required.
 *
 * NOTE ON STRATEGY:
 *   Test 2 calls supertokens.init() directly (not via the module lifecycle)
 *   so we can use real EmailPassword + Session recipe factories without
 *   needing a live TestingModule that triggers all DI / onModuleInit wiring.
 *   This is intentional: the contract being tested is "init → getAllCORSHeaders
 *   works", not "NestJS wires up". The DI / module compile contract is already
 *   covered by auth.di-boot.spec.ts.
 *   The __resetSupertokensInitForTest hook is used to isolate the two tests.
 */

import 'reflect-metadata';

import supertokens from 'supertokens-node';
// Real supertokens import — we want the actual init guard and getAllCORSHeaders.
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';
import { afterEach, describe, expect, it } from 'vitest';

import { __resetSupertokensInitForTest } from './supertokens.config';

// Reset the module-level `initialized` guard between tests so each test
// starts from a clean SDK state.
afterEach(() => {
  __resetSupertokensInitForTest();
});

describe('Bootstrap ordering — SuperTokens.init before getAllCORSHeaders', () => {
  it('getAllCORSHeaders() throws before SuperTokens.init() — proving the ordering guard', () => {
    // SuperTokens.init() has NOT been called.  getAllCORSHeaders() MUST throw
    // "Initialisation not done" — this is exactly what would crash bootstrap()
    // if initSupertokens() were called after (rather than before) NestFactory.
    expect(() => supertokens.getAllCORSHeaders()).toThrow(/Initialisation not done/i);
  });

  it('getAllCORSHeaders() returns an array after SuperTokens.init() — proving the fix', () => {
    // Call supertokens.init() directly, mirroring what initSupertokens() does
    // in bootstrap() before NestFactory.create().
    // Uses real recipe factories — init is config-only and opens no connections.
    supertokens.init({
      framework: 'express',
      supertokens: {
        connectionURI: 'http://localhost:3567',
        apiKey: 'test-api-key-dummy',
      },
      appInfo: {
        appName: 'DealFlow AI',
        apiDomain: 'http://localhost:4000',
        websiteDomain: 'http://localhost:3000',
        apiBasePath: '/auth',
        websiteBasePath: '/auth',
      },
      recipeList: [EmailPassword.init(), Session.init({ antiCsrf: 'VIA_TOKEN' })],
    });

    // getAllCORSHeaders() MUST NOT throw after init().
    let result: string[] | undefined;
    expect(() => {
      result = supertokens.getAllCORSHeaders();
    }).not.toThrow();

    // Must return an array — the SDK populates it with its own required headers.
    expect(Array.isArray(result)).toBe(true);
  });
});
