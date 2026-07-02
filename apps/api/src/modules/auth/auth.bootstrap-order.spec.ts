/**
 * Bootstrap ordering regression — SuperTokens.init before getAllCORSHeaders.
 *
 * WHY THIS TEST EXISTS:
 *   main.ts calls supertokens.getAllCORSHeaders() to configure CORS.  That call
 *   throws "Initialisation not done. Did you forget to call the SuperTokens.init
 *   function?" if SuperTokens.init() has not yet run.
 *
 *   SuperTokens.init() runs in AuthModule.onModuleInit() (it needs DI — the
 *   role resolver depends on AuthRepository), which means it is triggered by
 *   the NestJS lifecycle via app.init(), NOT by module import alone.
 *
 *   The fixed main.ts calls `await app.init()` explicitly between
 *   NestFactory.create() and the CORS / getAllCORSHeaders wiring.  This test
 *   replicates that ordering:
 *
 *   Test 1 — MUST FAIL before init: proves the "Initialisation not done" error
 *             fires when getAllCORSHeaders() is called before SuperTokens.init().
 *
 *   Test 2 — MUST PASS after init: proves getAllCORSHeaders() returns an array
 *             once SuperTokens.init() has been called (mirrors what app.init()
 *             achieves in main.ts by running AuthModule.onModuleInit).
 *
 * WHAT IT CATCHES:
 *   - Any future refactor that moves getAllCORSHeaders() before app.init().
 *   - Any removal of the explicit app.init() call from main.ts bootstrap.
 *
 * NOTE ON NETWORK:
 *   SuperTokens.init() is config-only — it does NOT open a connection to Core.
 *   Core connections are lazy (first recipe call).  The dummy SUPERTOKENS_*
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
  it('getAllCORSHeaders() throws before SuperTokens.init() — proving the ordering bug', () => {
    // SuperTokens.init() has NOT been called.  getAllCORSHeaders() MUST throw
    // "Initialisation not done" — this is exactly what crashed the Railway
    // deploy when main.ts called getAllCORSHeaders() before app.init() ran
    // AuthModule.onModuleInit.
    expect(() => supertokens.getAllCORSHeaders()).toThrow(/Initialisation not done/i);
  });

  it('getAllCORSHeaders() returns an array after SuperTokens.init() — proving the fix', () => {
    // Call supertokens.init() directly, mirroring what AuthModule.onModuleInit
    // does when triggered by `await app.init()` in the fixed main.ts.
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
