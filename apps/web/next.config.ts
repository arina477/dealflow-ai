import type { NextConfig } from 'next';

/**
 * Same-origin API proxy (cross-origin session fix).
 *
 * The browser must reach the NestJS API through the WEB origin so that
 * SuperTokens sets a first-party session cookie on the web origin (which the
 * dashboard server component's cookies() can then read). We rewrite the
 * same-origin path `/auth/*` to the api's `/auth/*`.
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
 */
const apiProxyTarget =
  process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  // Transpile workspace packages
  transpilePackages: ['@dealflow/shared'],

  async rewrites() {
    return [
      {
        source: '/auth/:path*',
        destination: `${apiProxyTarget}/auth/:path*`,
      },
    ];
  },
};

export default nextConfig;
