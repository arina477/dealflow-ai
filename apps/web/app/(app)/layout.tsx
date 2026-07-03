/**
 * app/(app)/layout.tsx — shared authed route-group layout.
 *
 * DESIGN-SYSTEM §10: "implemented ONCE as shared components, never re-built
 * per page." This layout IS the ONCE seam. Every route inside the (app) group
 * (i.e. every authed page) inherits this layout automatically.
 *
 * Responsibilities:
 *   1. Server-side session resolution: GET /auth/me (cookie forwarded).
 *      - No session → redirect('/login') (unauthenticated).
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
// ---------------------------------------------------------------------------

async function fetchMe(): Promise<MeResponse | null> {
  const apiBase =
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const cookieHeader = (await cookies()).toString();
    const res = await fetch(`${apiBase}/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = meResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pathname resolution
// ---------------------------------------------------------------------------

/**
 * Derives the current pathname for active-nav highlighting.
 *
 * Next.js sets `x-invoke-path` in development (and some production
 * deployments). If absent (e.g. static export), fall back to '/'.
 * The actual URL is always authoritative via usePathname() in client
 * components — this is server-side best-effort.
 */
async function resolvePathname(): Promise<string> {
  try {
    const headersList = await headers();
    return headersList.get('x-invoke-path') ?? headersList.get('x-pathname') ?? '/';
  } catch {
    return '/';
  }
}

// ---------------------------------------------------------------------------
// Layout component
// ---------------------------------------------------------------------------

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // 1. Resolve session — unauthenticated users are redirected before shell renders.
  const me = await fetchMe();
  if (!me) {
    redirect('/login');
  }

  // 2. Resolve current pathname for active-nav highlighting.
  const pathname = await resolvePathname();

  // 3. Render AppShell ONCE — wraps all (app) pages.
  return (
    <AppShell me={me} pathname={pathname}>
      {children}
    </AppShell>
  );
}
