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
      // /auth/:path*  → API (wave-2/3 SuperTokens same-origin cookie fix)
      // /compliance/audit-log/verify → API (wave-4 audit-log verify endpoint)
      //   The page /compliance/audit-log is matched by Next.js BEFORE this
      //   rewrite runs, so the React page is never shadowed.
      afterFiles: [
        {
          source: '/auth/:path*',
          destination: `${apiProxyTarget}/auth/:path*`,
        },
        {
          source: '/compliance/audit-log/verify',
          destination: `${apiProxyTarget}/compliance/audit-log/verify`,
        },
      ],
      beforeFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
