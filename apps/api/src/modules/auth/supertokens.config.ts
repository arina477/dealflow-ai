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
      // Same-origin proxy model (cross-origin session fix): the browser NEVER
      // talks to the api origin directly. apps/web proxies a same-origin path
      // (`/auth/*` — see apps/web/next.config.ts rewrites) to this api's
      // `/auth/*`. From the SDK's perspective the API is therefore reached at
      // the WEBSITE origin, so apiDomain === websiteDomain === WEB_ORIGIN. This
      // is what makes SuperTokens set a FIRST-PARTY cookie on the web origin
      // (host-only, no Domain attr) that the Next.js server component's
      // cookies() can read. If apiDomain were the api's own *.up.railway.app
      // subdomain, the cookie would be scoped to the api origin (cross-site;
      // up.railway.app is on the Public Suffix List) and the web server could
      // never read it — that was the bug.
      //
      // apiBasePath stays `/auth` so it matches BOTH the rewrite destination
      // and the custom @Controller('auth') Nest routes. websiteBasePath is
      // cosmetic here (the web app uses custom pages, not the SuperTokens
      // frontend SDK), so a shared `/auth` value is harmless.
      apiDomain: env.WEB_ORIGIN,
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
        // Force COOKIE-based token transfer (cross-origin session fix).
        //
        // Root cause of the login-bounce bug: SuperTokens' default
        // getTokenTransferMethod returns "any", and on session CREATION with no
        // `st-auth-mode: cookie` request header it falls back to "header"
        // transfer (supertokens-node sessionRequestFunctions.createNewSession
        // → outputTransferMethod default). The tokens then came back as
        // st-access-token / st-refresh-token / front-token RESPONSE HEADERS —
        // never a Set-Cookie the browser stores. Forcing "cookie" here makes
        // the SDK emit Set-Cookie on every session mint/refresh, independent of
        // any client header, so a first-party session cookie always lands on
        // the web origin. Same-origin proxying alone is NOT sufficient without
        // this — it fixes WHERE the cookie is scoped, this fixes WHETHER a
        // cookie is issued at all.
        getTokenTransferMethod: () => 'cookie',
        // Same-origin (web ↔ web via the proxy) → SameSite=Lax is correct and
        // sufficient. cookieSecure is intentionally left to auto-derive from
        // apiDomain's protocol (WEB_ORIGIN): https in prod → Secure; http on
        // localhost in dev → not Secure, so the dev cookie is still sent.
        cookieSameSite: 'lax',
        // Anti-CSRF for cookie sessions; refresh-token rotation with reuse
        // detection is on by default in the Session recipe.
        //
        // VIA_CUSTOM_HEADER (T-5 fix): this deployment is SAME-ORIGIN — the
        // browser only ever talks to the web origin, which proxies /auth/* and
        // /compliance/* to the api (next.config.ts rewrites). Combined with
        // cookieSameSite:'lax', the session cookie is never attached to a
        // genuine cross-SITE request, and any state-changing api call must
        // additionally carry a custom header (`rid`) that a cross-site
        // <form>/simple-request CANNOT set without a CORS preflight the api
        // does not grant. That is exactly SuperTokens' recommended CSRF posture
        // for same-origin cookie sessions, and it is STRICTER-in-practice than
        // VIA_TOKEN here, not weaker (SameSite=Lax + custom-header double
        // barrier). We do NOT use antiCsrf:'NONE' — this is a compliance tool.
        //
        // Why VIA_TOKEN broke: it required an anti-csrf TOKEN (minted into the
        // session, echoed back per mutation) on every non-GET verified request.
        // The web client's plain fetch() never carried that token, so the FIRST
        // authenticated mutating app POST (compliance CRUD) 401'd at
        // Session.getSession. VIA_CUSTOM_HEADER checks for the presence of a
        // custom header instead, which the client CAN set on same-origin fetch.
        //
        // Anti-csrf is NOT enforced on GET under either mode, so the existing
        // GET flows (/auth/me, /compliance/audit-log/verify) are unaffected.
        // Session-CREATION routes (SuperTokens /auth/signin, our invite-bound
        // /auth/signup) verify no PRIOR session, so they are unaffected too;
        // the SuperTokens frontend flow sets its own custom header automatically.
        antiCsrf: 'VIA_CUSTOM_HEADER',
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
