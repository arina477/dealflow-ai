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
        // Wave-7: page-route-collision fix — non-colliding proxy path for the
        // company detail API. /sourcing/company-detail/:id has NO Next.js page
        // route (no file at app/(app)/sourcing/company-detail/[id]/page.tsx),
        // so it always falls through afterFiles to this rewrite and is proxied
        // to GET /sourcing/companies/:id on the API. Client fetches from the
        // workspace DetailDrawer (and any other client component that needs the
        // full detail) use this path instead of /sourcing/companies/:id to avoid
        // the page-route collision.
        {
          source: '/sourcing/company-detail/:id',
          destination: `${apiProxyTarget}/sourcing/companies/:id`,
        },
        // Wave-8 C-2 fix — mandate mutation proxy (page-route-collision fix).
        //
        // CRITICAL: /mandates and /mandates/:id have Next.js page files:
        //   /mandates        → app/(app)/mandates/page.tsx
        //   /mandates/new    → app/(app)/mandates/new/page.tsx
        //   /mandates/:id    → app/(app)/mandates/[id]/page.tsx
        //
        // afterFiles rewrites defer ONLY to static/filesystem page routes, NOT
        // to dynamic routes (e.g. [id]). Keeping a rewrite for /mandates/:id
        // SHADOWS the dynamic [id] page — the browser receives raw API JSON
        // instead of the SSR detail page (wave-7 page-route-collision class).
        //
        // Fix: remove the colliding /mandates and /mandates/:id rewrites entirely.
        //   - List + detail pages SSR-fetch server-side via apiBase() (internal URL) —
        //     no same-origin proxy needed for reads.
        //   - Client MUTATIONS (POST create, PATCH configure) use DISTINCT non-colliding
        //     paths: /mandates-data (POST) and /mandates-data/:id (PATCH). These paths
        //     have NO Next.js page file, so afterFiles always proxies them to the API.
        //
        // Client callers:
        //   MandateForm.tsx      POST → /mandates-data        (proxied → POST /mandates)
        //   MandateDetailClient.tsx  PATCH → /mandates-data/:id (proxied → PATCH /mandates/:id)
        {
          source: '/mandates-data',
          destination: `${apiProxyTarget}/mandates`,
        },
        {
          source: '/mandates-data/:id',
          destination: `${apiProxyTarget}/mandates/:id`,
        },
        // Wave-9: buyer-universe mutation proxy (page-route-collision fix).
        //
        // CRITICAL: /buyer-universe has a Next.js page file:
        //   /buyer-universe  → app/(app)/buyer-universe/page.tsx
        //
        // We must NOT rewrite /buyer-universe (GET — served as the React page) or
        // /buyer-universe/:id (the detail read is SSR server-side via apiBase()).
        //
        // Fix: ALL client mutations use the non-colliding /buyer-universe-data prefix.
        // These paths have NO Next.js page file, so afterFiles always proxies them.
        //
        // Client callers (BuyerUniverseClient.tsx):
        //   POST   /buyer-universe-data              → POST   /buyer-universe       (assemble)
        //   GET    /buyer-universe-data/:id          → GET    /buyer-universe/:id   (detail reload)
        //   POST   /buyer-universe-data/:id/filter   → POST   /buyer-universe/:id/filter
        //   POST   /buyer-universe-data/:id/enrich   → POST   /buyer-universe/:id/enrich
        //   GET    /buyer-universe-data/:id/gaps     → GET    /buyer-universe/:id/gaps
        //   POST   /buyer-universe-data/:id/submit   → POST   /buyer-universe/:id/submit
        //   PATCH  /buyer-universe-data/:id/candidates/:cid → PATCH  /buyer-universe/:id/candidates/:cid
        {
          source: '/buyer-universe-data',
          destination: `${apiProxyTarget}/buyer-universe`,
        },
        {
          source: '/buyer-universe-data/:id/candidates/:candidateId',
          destination: `${apiProxyTarget}/buyer-universe/:id/candidates/:candidateId`,
        },
        {
          source: '/buyer-universe-data/:id/:sub',
          destination: `${apiProxyTarget}/buyer-universe/:id/:sub`,
        },
        {
          source: '/buyer-universe-data/:id',
          destination: `${apiProxyTarget}/buyer-universe/:id`,
        },
        // Wave-10: matches mutation proxy (page-route-collision fix).
        //
        // CRITICAL: /matches-shortlist is the Next.js page route. We must NOT
        // rewrite /matches-shortlist (the React page). Client mutations use the
        // non-colliding /matches-data prefix — no Next.js page file exists at
        // that path, so afterFiles always proxies these to the API.
        //
        // Route-ordering care: the /matches-data/:id/candidates/:cid path has
        // TWO sub-segments after /:id; it must be declared BEFORE the one-segment
        // /:id/:sub rule, and both must precede the bare /:id rule. This mirrors
        // the wave-9 route-order lesson.
        //
        // Client callers (MatchesShortlistClient.tsx):
        //   POST  /matches-data                          → POST  /matches (create run)
        //   PATCH /matches-data/:id/candidates/:cid      → PATCH /matches/:id/candidates/:cid
        //   POST  /matches-data/:id/handoff              → POST  /matches/:id/handoff
        //
        // NOTE: /matches-shortlist (the page route) is served by Next.js via
        //   app/(app)/matches-shortlist/page.tsx — afterFiles never shadows it.
        //   The GET /matches?mandateId= + GET /matches/:id SSR fetches run server-side
        //   against apiBase() (internal URL) — no same-origin proxy needed for reads.
        {
          source: '/matches-data',
          destination: `${apiProxyTarget}/matches`,
        },
        {
          source: '/matches-data/:id/candidates/:cid',
          destination: `${apiProxyTarget}/matches/:id/candidates/:cid`,
        },
        {
          source: '/matches-data/:id/:sub',
          destination: `${apiProxyTarget}/matches/:id/:sub`,
        },
        {
          source: '/matches-data/:id',
          destination: `${apiProxyTarget}/matches/:id`,
        },
        // Wave-11: outreach-templates mutation proxy (page-route-collision fix).
        //
        // CRITICAL: /outreach-templates has a Next.js page file:
        //   /outreach-templates → app/(app)/outreach-templates/page.tsx
        //
        // We must NOT rewrite /outreach-templates (GET — served as the React page).
        // All client mutations use the non-colliding /outreach-templates-data prefix.
        // These paths have NO Next.js page file, so afterFiles always proxies them.
        //
        // Route-ordering: multi-segment paths before /:id before bare root.
        //   /outreach-templates-data/:id/versions/:vid/approve  → most specific first
        //   /outreach-templates-data/:id/versions/:vid/reject
        //   /outreach-templates-data/:id/versions/:vid/request-approval
        //   /outreach-templates-data/:id/versions              (POST new version)
        //   /outreach-templates-data/:id                       (GET detail / PUT)
        //   /outreach-templates-data                           (POST create)
        //
        // Client callers (TemplatesLibraryClient / ComplianceQueueClient):
        //   POST  /outreach-templates-data                                  → POST   /outreach-templates
        //   GET   /outreach-templates-data/:id                              → GET    /outreach-templates/:id
        //   POST  /outreach-templates-data/:id/versions                     → POST   /outreach-templates/:id/versions
        //   POST  /outreach-templates-data/:id/versions/:vid/approve        → POST   /outreach-templates/:id/versions/:vid/approve
        //   POST  /outreach-templates-data/:id/versions/:vid/reject         → POST   /outreach-templates/:id/versions/:vid/reject
        //   POST  /outreach-templates-data/:id/versions/:vid/request-approval → POST /outreach-templates/:id/versions/:vid/request-approval
        {
          source: '/outreach-templates-data/:id/versions/:vid/approve',
          destination: `${apiProxyTarget}/outreach-templates/:id/versions/:vid/approve`,
        },
        {
          source: '/outreach-templates-data/:id/versions/:vid/reject',
          destination: `${apiProxyTarget}/outreach-templates/:id/versions/:vid/reject`,
        },
        {
          source: '/outreach-templates-data/:id/versions/:vid/request-approval',
          destination: `${apiProxyTarget}/outreach-templates/:id/versions/:vid/request-approval`,
        },
        {
          source: '/outreach-templates-data/:id/versions',
          destination: `${apiProxyTarget}/outreach-templates/:id/versions`,
        },
        {
          source: '/outreach-templates-data/:id',
          destination: `${apiProxyTarget}/outreach-templates/:id`,
        },
        {
          source: '/outreach-templates-data',
          destination: `${apiProxyTarget}/outreach-templates`,
        },
        // Wave-11: outreach compose proxy (page-route-collision fix).
        //
        // CRITICAL: /outreach-composer has a Next.js page file:
        //   /outreach-composer → app/(app)/outreach-composer/page.tsx
        //
        // We must NOT rewrite /outreach-composer (served as the React page).
        // Client compose mutations use /outreach-data (non-colliding).
        // GET /outreach/:id is SSR server-side via apiBase() — no proxy needed for reads.
        //
        // Client callers (OutreachComposerClient):
        //   POST /outreach-data → POST /outreach (compose → gate → send_eligible|blocked)
        {
          source: '/outreach-data/:id',
          destination: `${apiProxyTarget}/outreach/:id`,
        },
        {
          source: '/outreach-data',
          destination: `${apiProxyTarget}/outreach`,
        },
        // Wave-12: pipeline mutation + events proxy (page-route-collision fix).
        //
        // CRITICAL: /pipeline has a Next.js page file:
        //   /pipeline → app/(app)/pipeline/page.tsx
        //
        // We must NOT rewrite /pipeline (GET — served as the React page). All
        // client mutations AND the events/notes sub-path reads use the
        // non-colliding /pipeline-data prefix. These paths have NO Next.js page
        // file, so afterFiles always proxies them to the API.
        //
        // Route-ordering: most-specific paths first (wave-9 lesson).
        //   /pipeline-data/:id/notes   → POST /pipeline/:id/notes
        //   /pipeline-data/:id/events  → GET  /pipeline/:id/events
        //   /pipeline-data/:id/stage   → PATCH /pipeline/:id/stage
        //   /pipeline-data/:id         → GET /pipeline/:id (detail)
        //
        // Client callers (DealTimelinePanel + StageMoveSelect):
        //   PATCH /pipeline-data/:id/stage  → PATCH /pipeline/:id/stage (transition)
        //   POST  /pipeline-data/:id/notes  → POST  /pipeline/:id/notes (add note)
        //   GET   /pipeline-data/:id/events → GET   /pipeline/:id/events (timeline)
        {
          source: '/pipeline-data/:id/notes',
          destination: `${apiProxyTarget}/pipeline/:id/notes`,
        },
        {
          source: '/pipeline-data/:id/events',
          destination: `${apiProxyTarget}/pipeline/:id/events`,
        },
        {
          source: '/pipeline-data/:id/stage',
          destination: `${apiProxyTarget}/pipeline/:id/stage`,
        },
        {
          source: '/pipeline-data/:id',
          destination: `${apiProxyTarget}/pipeline/:id`,
        },
        // Wave-14: /compliance/oversight-data proxy (page-route-collision fix).
        //
        // CRITICAL: /compliance/oversight has a Next.js page file:
        //   /compliance/oversight → app/(app)/compliance/oversight/page.tsx
        //
        // We must NOT rewrite /compliance/oversight (GET — served as the React
        // page). The SSR fetch goes via apiBase() server-side; if the compliance
        // page component needs a client-side refresh, use /compliance/oversight-data
        // (no matching page file) which is proxied to GET /outreach on the API.
        //
        // Client caller (ComplianceOversightClient — if any client refresh needed):
        //   GET /compliance/oversight-data?... → GET /outreach?... (outreach list)
        {
          source: '/compliance/oversight-data',
          destination: `${apiProxyTarget}/outreach`,
        },
        // Wave-15: admin proxy paths (page-route-collision fix).
        //
        // CRITICAL: /admin/users, /admin/settings, /admin/integrations have
        // Next.js page files:
        //   /admin/users        → app/(app)/admin/users/page.tsx
        //   /admin/settings     → app/(app)/admin/settings/page.tsx
        //   /admin/integrations → app/(app)/admin/integrations/page.tsx
        //
        // We must NOT rewrite those page routes. All client mutations use
        // non-colliding -data prefix paths:
        //   /admin/users-data/...         → admin user management
        //   /admin/settings-data          → workspace settings PUT
        //   /admin/integrations-data/...  → integrations CRUD + toggle
        //
        // Route-ordering: most-specific paths before /:id before bare root.
        //
        // Admin workspace-settings: /admin/workspace-settings has no page file
        // (the page lives at /admin/settings) — proxy /admin/workspace-settings
        // directly to the API for the SSR fetch in the page.
        {
          source: '/admin/workspace-settings',
          destination: `${apiProxyTarget}/admin/workspace-settings`,
        },
        // Admin users mutations
        {
          source: '/admin/users-data/invite',
          destination: `${apiProxyTarget}/admin/users/invite`,
        },
        {
          source: '/admin/users-data/:id/role',
          destination: `${apiProxyTarget}/admin/users/:id/role`,
        },
        {
          source: '/admin/users-data/:id/deactivate',
          destination: `${apiProxyTarget}/admin/users/:id/deactivate`,
        },
        // Wave-16 (task 042cf4e6): POST /admin/users/:id/reactivate
        {
          source: '/admin/users-data/:id/reactivate',
          destination: `${apiProxyTarget}/admin/users/:id/reactivate`,
        },
        {
          source: '/admin/users-data',
          destination: `${apiProxyTarget}/admin/users`,
        },
        // Admin workspace settings mutation
        {
          source: '/admin/settings-data',
          destination: `${apiProxyTarget}/admin/workspace-settings`,
        },
        // Admin integrations mutations — most-specific first
        {
          source: '/admin/integrations-data/:id/toggle',
          destination: `${apiProxyTarget}/admin/integrations/:id/toggle`,
        },
        {
          source: '/admin/integrations-data/:id',
          destination: `${apiProxyTarget}/admin/integrations/:id`,
        },
        {
          source: '/admin/integrations-data',
          destination: `${apiProxyTarget}/admin/integrations`,
        },
        // Wave-16 (task 8bb0a22f): admin-activity read proxy.
        //
        // CRITICAL: /admin/activity has a Next.js page file:
        //   /admin/activity → app/(app)/admin/activity/page.tsx
        //
        // We must NOT rewrite /admin/activity (GET — served as the React page).
        // Client filter/pagination fetches use /admin/activity-data (non-colliding).
        // These paths have NO Next.js page file, so afterFiles always proxies them
        // to GET /admin/activity-data on the API.
        //
        // Admin-only (advisor 403 / anon 401) is enforced by the B-2 controller
        // guard AND the page's server-side assertRole. Read-only-immutable:
        // this proxy writes ZERO audit rows on any request.
        {
          source: '/admin/activity-data',
          destination: `${apiProxyTarget}/admin/activity-data`,
        },
        // Wave-13: audit-log data proxy (page-route-collision fix).
        //
        // CRITICAL: /compliance/audit-log has a Next.js page file:
        //   /compliance/audit-log → app/(app)/compliance/audit-log/page.tsx
        //
        // We must NOT rewrite /compliance/audit-log (GET — served as the React
        // page). All client data fetches use the non-colliding
        // /compliance/audit-log-data prefix. These paths have NO Next.js page
        // file, so afterFiles always proxies them to the API.
        //
        // Route-ordering: most-specific path (/export) BEFORE the bare root,
        // following the wave-9/10/12 lesson.
        //
        // Client callers:
        //   GET  /compliance/audit-log-data?...   → GET  /compliance/audit-log (read/filter)
        //   POST /compliance/audit-log-data/export → POST /compliance/audit-log/export
        //
        // NOTE: GET /compliance/audit-log/verify is already proxied above
        //   (wave-4 entry). The export sub-path uses /compliance/audit-log-data/export
        //   to avoid any collision with the existing /compliance/audit-log/* page
        //   namespace.
        {
          source: '/compliance/audit-log-data/export',
          destination: `${apiProxyTarget}/compliance/audit-log/export`,
        },
        {
          source: '/compliance/audit-log-data',
          destination: `${apiProxyTarget}/compliance/audit-log`,
        },
      ],
      beforeFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
