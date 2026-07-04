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
      // Wave-6: sourcing API paths (afterFiles — page routes win).
      // /sourcing/companies is BOTH a Next.js page AND the GET data endpoint.
      // afterFiles ensures the React page is served for GET /sourcing/companies
      // (browser navigation) while the client's data fetches to the same path
      // (with credentials, no html accept header) are NOT rewritten — Next.js
      // serves the page, and the API-specific sub-paths (/:id for detail,
      // /dedupe-candidates/:id/resolve, /connections/:id/sync) fall through to
      // the API via these rewrite rules. The page /sourcing/companies is never
      // hijacked because afterFiles only catches paths with NO matching page file.
      //
      // IMPORTANT: /sourcing/companies (exact, GET, browser nav) → Next.js page.
      //            /sourcing/companies/:id (detail — page exists at [id]/page.tsx,
      //            handled by Next.js; API sub-path for client data fetch also hits
      //            this rewrite when there's no matching page sub-path).
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
        // Wave-6: sourcing API rewrites.
        // /sourcing/companies is a Next.js page — afterFiles means it is NEVER
        // hijacked. Only sub-paths with no matching page file reach these rules.
        // Client-side fetches from CompanyDetail to /sourcing/companies/:id are
        // caught by the [id] page (Next.js) — the rewrite below additionally
        // handles the case where the [id] page is not present in the build
        // (edge deploy) or the client issues a direct API call. For safety we
        // keep the rewrite so both paths work:
        //   - Browser GET /sourcing/companies → Next.js page (afterFiles, wins)
        //   - Browser GET /sourcing/companies/uuid → Next.js [id] page (afterFiles, wins)
        //   - Client JSON fetch /sourcing/companies/uuid → Next.js [id] page OR API
        //     (the [id] page returns HTML; client uses /sourcing API URL from env)
        //   - POST /sourcing/dedupe-candidates/:id/resolve → API (no page, falls through)
        //   - POST /sourcing/connections/:id/sync → API (no page, falls through)
        // Wave-7: /sourcing/connections (create + list).
        // afterFiles: the /sourcing PAGE is served by Next.js (page file exists
        // at app/(app)/sourcing/page.tsx), so the /sourcing route is NEVER
        // hijacked. Only /sourcing/connections (no matching page file) falls
        // through here and is proxied to the API.
        {
          source: '/sourcing/connections',
          destination: `${apiProxyTarget}/sourcing/connections`,
        },
        {
          source: '/sourcing/connections/:id',
          destination: `${apiProxyTarget}/sourcing/connections/:id`,
        },
        {
          source: '/sourcing/connections/:id/sync',
          destination: `${apiProxyTarget}/sourcing/connections/:id/sync`,
        },
        {
          source: '/sourcing/dedupe-candidates/:id/resolve',
          destination: `${apiProxyTarget}/sourcing/dedupe-candidates/:id/resolve`,
        },
      ],
      beforeFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
