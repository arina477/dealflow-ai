/**
 * app/(app)/layout.tsx — shared authed route-group layout.
 *
 * DESIGN-SYSTEM §10: "implemented ONCE as shared components, never re-built
 * per page." This layout IS the ONCE seam. Every route inside the (app) group
 * (i.e. every authed page) inherits this layout automatically.
 *
 * Responsibilities:
 *   1. Server-side session resolution: GET /auth/me (cookie forwarded).
 *      - 401/403 (unauthenticated / forbidden) → redirect('/login').
 *      - 5xx / network error → render a lightweight retry/error state.
 *        (B-6 availability fix: a TRANSIENT API failure must NOT log a valid
 *        user out. Collapsing every non-ok into redirect('/login') meant a
 *        single upstream 500 or blip evicted authenticated sessions.)
 *      - Valid session → me.role available for AppShell + nav rendering.
 *   2. Renders <AppShell role={me.role}> wrapping {children} once.
 *
 * Coarse authz: the layout checks "is the user authenticated" (any valid role
 * is permitted past this gate). Fine-grained per-route role checks are done by
 * individual page segments via assertRole() from _lib/assertRole.ts.
 *
 * pathname: Next.js App Router server layouts cannot access the URL directly
 * via hooks (those are client-only). We derive the pathname from the
 * next/headers `x-invoke-path` (Next's internal header in dev) with a fallback
 * to '/' for SSR / edge. This is sufficient for active-nav highlighting on
 * first paint; the NavItem client component can enhance with usePathname in
 * a future iteration.
 *
 * Cookie forwarding: same pattern as the wave-2 dashboard — cookies() from
 * next/headers, forwarded as `cookie` header to the API Node server. The
 * browser's httpOnly session cookie is NOT available to Node fetch via
 * `credentials: 'include'` (browser concept); explicit forwarding is required.
 */

import type { MeResponse } from '@dealflow/shared';
import { meResponseSchema } from '@dealflow/shared';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppShell } from './_components/AppShell';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Session fetch (server-side, cookie-forwarded)
//
// Returns a DISCRIMINATED result so the layout can react differently to the
// three failure classes (B-6 availability fix):
//   - 'ok'         → authenticated; render the shell.
//   - 'unauth'     → 401/403 or an invalid/malformed body → redirect('/login').
//   - 'unavailable'→ 5xx / network / non-JSON → render an error state (do NOT
//                    log the user out; the session may still be valid).
// ---------------------------------------------------------------------------

type FetchMeResult =
  | { status: 'ok'; me: MeResponse }
  | { status: 'unauth' }
  | { status: 'unavailable' };

async function fetchMe(): Promise<FetchMeResult> {
  const apiBase =
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const cookieHeader = (await cookies()).toString();
    const res = await fetch(`${apiBase}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });

    if (res.ok) {
      const raw: unknown = await res.json();
      const parsed = meResponseSchema.safeParse(raw);
      // A 200 with a body that does not match MeResponse is an auth/identity
      // problem, not an availability problem → treat as unauthenticated.
      return parsed.success ? { status: 'ok', me: parsed.data } : { status: 'unauth' };
    }

    // 401 (no session) / 403 (forbidden) → the user is not authenticated for
    // this surface → send them to login.
    if (res.status === 401 || res.status === 403) {
      return { status: 'unauth' };
    }

    // Any other non-ok (5xx, 429, etc.) is a TRANSIENT upstream failure — the
    // user's session may still be valid. Do NOT log them out.
    return { status: 'unavailable' };
  } catch {
    // fetch rejected (network error, DNS, TLS) → transient; do NOT log out.
    return { status: 'unavailable' };
  }
}

// ---------------------------------------------------------------------------
// Pathname resolution
// ---------------------------------------------------------------------------

/**
 * Derives the current pathname for active-nav highlighting and TopBar title.
 *
 * Resolution order (most reliable first):
 *   1. `x-pathname` — set by middleware.ts on every request with the actual
 *      browser URL pathname. This is the correct source post-wave-15.
 *   2. `x-invoke-path` — Next.js internal (present in some dev builds; may
 *      return the file-system route path like `/(app)/admin/users` rather than
 *      the URL path `/admin/users` — unreliable as the sole source).
 *   3. '/' — safe fallback; dashboard is permitted for all roles.
 *
 * The actual URL is always authoritative via usePathname() in client
 * components — this is the server-side resolution for initial render.
 */
async function resolvePathname(): Promise<string> {
  try {
    const headersList = await headers();
    // x-pathname is set by middleware.ts — the most reliable source.
    const xPathname = headersList.get('x-pathname');
    if (xPathname) return xPathname;
    // x-invoke-path is a Next.js internal — secondary fallback.
    const xInvokePath = headersList.get('x-invoke-path');
    if (xInvokePath) return xInvokePath;
    return '/';
  } catch {
    return '/';
  }
}

// ---------------------------------------------------------------------------
// Layout component
// ---------------------------------------------------------------------------

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // 1. Resolve session.
  const result = await fetchMe();

  // 1a. Unauthenticated (401/403 or invalid identity) → redirect to login.
  if (result.status === 'unauth') {
    redirect('/login');
  }

  // 1b. Transient upstream failure (5xx / network) → render a lightweight
  // error state. Do NOT redirect('/login'): the session may still be valid and
  // logging the user out on a blip is a worse outcome than a retry prompt.
  if (result.status === 'unavailable') {
    return <ServiceUnavailable />;
  }

  const me = result.me;

  // 2. Resolve current pathname for active-nav highlighting.
  const pathname = await resolvePathname();

  // 3. Render AppShell ONCE — wraps all (app) pages.
  return (
    <AppShell me={me} pathname={pathname}>
      {children}
    </AppShell>
  );
}

// ---------------------------------------------------------------------------
// Lightweight error state — shown when /auth/me is transiently unreachable.
// Deliberately minimal (no shell, no nav, no session assumptions). A plain
// full-page reload is the retry mechanism; the user is NOT logged out.
// ---------------------------------------------------------------------------

function ServiceUnavailable() {
  return (
    <main
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '0.75rem',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ fontSize: '1.25rem', fontWeight: 600 }}>We can’t reach the service right now</h1>
      <p style={{ maxWidth: '28rem', opacity: 0.8 }}>
        This looks like a temporary problem — your session is still active. Please try again in a
        moment.
      </p>
      {/* Retry via a plain GET re-request to the same route: no client JS, no
          logout. Submitting re-runs this layout (which re-attempts /auth/me). */}
      <form>
        <button type="submit" style={{ textDecoration: 'underline', fontWeight: 500 }}>
          Retry
        </button>
      </form>
    </main>
  );
}
