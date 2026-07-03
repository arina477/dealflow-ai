/**
 * /dashboard — placeholder authed landing page (wave-2).
 *
 * Calls GET /auth/me to retrieve the authenticated user's role.
 * Full AppShell (sidebar + top bar) is a later bundle (DESIGN-SYSTEM §10).
 * This wave: minimal server component that shows the role and a sign-out link.
 *
 * If /auth/me returns 401, the user is not authenticated → redirect to /login.
 *
 * Cookie-forwarding: server components run on the Node.js server and have no
 * browser cookie jar. `credentials: 'include'` is silently ignored by Node's
 * fetch implementation, so the SuperTokens session cookie would never reach
 * the API. We instead read the incoming request cookies via `next/headers` and
 * forward them explicitly as a `cookie` request header.
 *
 * Follow-up (next bundle): SuperTokens rotates the access token on use; if the
 * token has expired but is still refreshable the backend will return 401 even
 * for a valid session. A robust fix is either (a) move the auth guard into
 * Next.js middleware (which can proxy the SuperTokens refresh flow) or (b) use
 * the SuperTokens Node SDK directly in the server component. For this wave a
 * hard-401 → redirect is acceptable — the window is short (token TTL ~1h).
 */

import type { MeResponse } from '@dealflow/shared';
import { meResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

async function fetchMe(): Promise<MeResponse | null> {
  // Server-to-server call (runs on the Next.js Node server, not the browser):
  // use the internal/private API base directly. No same-origin proxy needed
  // here — the session cookie is forwarded explicitly as a request header
  // (below), and SuperTokens reads the token value from it regardless of
  // request host. The browser's login now leaves a first-party session cookie
  // on the web origin (via the same-origin /auth proxy), which cookies() below
  // reads and forwards.
  const apiBase =
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    // Forward the incoming request's cookies so the SuperTokens httpOnly
    // session cookie reaches the API. `credentials: 'include'` is a browser
    // fetch concept; it has no effect in the Node.js server environment.
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

export default async function DashboardPage() {
  const me = await fetchMe();
  if (!me) redirect('/login');

  return (
    <main
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-xs)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <h1
          style={{
            fontSize: '20px',
            lineHeight: '28px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Dashboard
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-body)', margin: 0 }}>
          Signed in as <strong>{me.email}</strong> ({me.role})
        </p>
        <p
          style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          Full AppShell (sidebar + top bar) ships in a later bundle. This placeholder confirms
          authentication is working.
        </p>
        <a
          href="/login"
          style={{
            fontSize: '14px',
            color: 'var(--primary)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Sign out
        </a>
      </div>
    </main>
  );
}
