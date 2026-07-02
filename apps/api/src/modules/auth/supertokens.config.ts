/**
 * SuperTokens SDK bootstrap (wave-2 auth, task e15f71dd / e1c0e81e).
 *
 * Single init() call wiring the EmailPassword + Session recipes against a
 * self-hosted Core (own Postgres — never the app DB; boot assertion in
 * env.ts). Two project-specific overrides live here:
 *
 *   1. Session.createNewSession — writes the app-DB `users.role` into the
 *      access-token payload as the custom `role` claim (arch delta 3). The
 *      app-DB row stays authoritative; the claim is a re-verified mirror.
 *      Runs on session mint AND refresh, so the claim survives token rotation.
 *
 *   2. EmailPassword signUpPOST — DISABLED. Public self-signup is rejected so
 *      the SDK's default open sign-up route can never create an account. The
 *      ONLY account-creation path is our invite-bound POST /auth/signup, which
 *      calls EmailPassword.signUp() directly from the service layer (arch
 *      delta 4 / security invariant: invite-only).
 *
 * The SDK is server-only (apps/api). It is NEVER imported by apps/web.
 */

import supertokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import Session from 'supertokens-node/recipe/session';

import type { SupertokensEnv } from './supertokens.env';

/**
 * Resolver injected at init time so this config file does not import the
 * repository directly (keeps the module boundary clean and makes the
 * role-claim override unit-testable in isolation).
 *
 * Returns the role name for a SuperTokens user id, or null when no app-DB
 * users row exists yet for that id.
 */
export type RoleResolver = (supertokensUserId: string) => Promise<string | null>;

let initialized = false;

export interface SupertokensInitDeps {
  env: SupertokensEnv;
  /** Resolves the `role` claim value from the app-DB users row. */
  resolveRole: RoleResolver;
}

/**
 * Initialise the SuperTokens SDK exactly once. Idempotent: repeated calls
 * (e.g. Nest test harness re-instantiating the module) are no-ops after the
 * first successful init.
 */
export function initSupertokens({ env, resolveRole }: SupertokensInitDeps): void {
  if (initialized) {
    return;
  }

  supertokens.init({
    framework: 'express',
    supertokens: {
      connectionURI: env.SUPERTOKENS_CONNECTION_URI,
      apiKey: env.SUPERTOKENS_API_KEY,
    },
    appInfo: {
      appName: 'DealFlow AI',
      apiDomain: env.INTERNAL_API_BASE_URL,
      websiteDomain: env.WEB_ORIGIN,
      apiBasePath: '/auth',
      websiteBasePath: '/auth',
    },
    recipeList: [
      EmailPassword.init({
        override: {
          apis: (originalImplementation) => ({
            ...originalImplementation,
            // Invite-only: hard-disable the public sign-up route. The default
            // open sign-up POST is removed so no account can be created except
            // through our invite-bound service path (EmailPassword.signUp()).
            signUpPOST: undefined,
          }),
        },
      }),
      Session.init({
        // Anti-CSRF for cookie sessions; refresh-token rotation with reuse
        // detection is on by default in the Session recipe.
        antiCsrf: 'VIA_TOKEN',
        override: {
          functions: (originalImplementation) => ({
            ...originalImplementation,
            createNewSession: async (input) => {
              // Role claim (arch delta 3): resolve from the authoritative
              // app-DB users row and mirror it into the access-token payload.
              // Runs on both new-session mint and refresh, so `role` survives
              // rotation (edge-case AC: refresh preserves the claim).
              const role = await resolveRole(input.userId);
              input.accessTokenPayload = {
                ...input.accessTokenPayload,
                ...(role !== null ? { role } : {}),
              };
              return originalImplementation.createNewSession(input);
            },
          }),
        },
      }),
    ],
  });

  initialized = true;
}

/** Test-only hook to reset the init guard between suites. */
export function __resetSupertokensInitForTest(): void {
  initialized = false;
}
