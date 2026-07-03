import type { NextConfig } from 'next';

/**
 * Same-origin API proxy (cross-origin session fix).
 *
 * The browser must reach the NestJS API through the WEB origin so that
 * SuperTokens sets a first-party session cookie on the web origin (which the
 * dashboard server component's cookies() can then read). We rewrite
 * same-origin paths to the API so the browser sends first-party cookies
 * automatically.
 *
 *   browser → GET/POST https://<web-origin>/auth/signin
 *           → (Next.js rewrite, server-side reverse proxy)
 *           → http(s)://<api>/auth/signin
 *           → SuperTokens Set-Cookie flows back through the proxy to the
 *             browser as a first-party cookie on <web-origin>.
 *
 * Target is env-driven (INTERNAL_API_BASE_URL — Railway private network in
 * prod; NEXT_PUBLIC_API_URL or localhost:3001 as fallbacks for dev). The
 * `apiBasePath` on the SuperTokens side stays `/auth`, so this path maps
 * 1:1 with no rewriting of the sub-path.
 *
 * NOTE: this env var is read by the Next.js Node server at request time, so
 * INTERNAL_API_BASE_URL MUST be set on the WEB service (not just the api).
 *
 * Rewrite phases:
 *   `afterFiles` — rewrites run AFTER Next.js resolves page routes. This
 *   means a page at /compliance/audit-log is served as the React page, while
 *   /compliance/audit-log/verify (which has no matching page) falls through
 *   to this rewrite and is proxied to the API. Using afterFiles prevents any
 *   proxy rule from hijacking an existing web page route.
 */
const apiProxyTarget =
  process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  // Transpile workspace packages
  transpilePackages: ['@dealflow/shared'],

  async rewrites() {
    return {
      // afterFiles: page routes win; only unmatched paths fall through here.
      // /auth/:path*                       → API (wave-2/3 SuperTokens cookie fix)
      // /compliance/audit-log/verify       → API (wave-4 audit integrity endpoint)
      // /compliance/rules[/:id]            → API (wave-5 rules CRUD)
      // /compliance/suppression[/:id]      → API (wave-5 suppression CRUD)
      // /compliance/disclaimers[/:id]      → API (wave-5 disclaimer CRUD)
      //
      // The page /compliance/settings (and /compliance/audit-log) are matched by
      // Next.js BEFORE these rewrites run, so the React pages are never shadowed.
      afterFiles: [
        {
          source: '/auth/:path*',
          destination: `${apiProxyTarget}/auth/:path*`,
        },
        {
          source: '/compliance/audit-log/verify',
          destination: `${apiProxyTarget}/compliance/audit-log/verify`,
        },
        // Wave-5: CRUD API paths for the compliance rules-engine.
        // These must NOT hijack the /compliance/settings PAGE route.
        // afterFiles means Next.js resolves pages first; only API sub-paths
        // (/compliance/rules, /compliance/suppression, /compliance/disclaimers)
        // fall through here because no page exists at those paths.
        {
          source: '/compliance/rules',
          destination: `${apiProxyTarget}/compliance/rules`,
        },
        {
          source: '/compliance/rules/:id',
          destination: `${apiProxyTarget}/compliance/rules/:id`,
        },
        {
          source: '/compliance/suppression',
          destination: `${apiProxyTarget}/compliance/suppression`,
        },
        {
          source: '/compliance/suppression/:id',
          destination: `${apiProxyTarget}/compliance/suppression/:id`,
        },
        {
          source: '/compliance/disclaimers',
          destination: `${apiProxyTarget}/compliance/disclaimers`,
        },
        {
          source: '/compliance/disclaimers/:id',
          destination: `${apiProxyTarget}/compliance/disclaimers/:id`,
        },
      ],
      beforeFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
