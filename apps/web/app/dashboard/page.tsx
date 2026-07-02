/**
 * /dashboard — placeholder authed landing page (wave-2).
 *
 * Calls GET /auth/me to retrieve the authenticated user's role.
 * Full AppShell (sidebar + top bar) is a later bundle (DESIGN-SYSTEM §10).
 * This wave: minimal server component that shows the role and a sign-out link.
 *
 * If /auth/me returns 401, the user is not authenticated → redirect to /login.
 */

import { redirect } from 'next/navigation';
import type { MeResponse } from '@dealflow/shared';
import { meResponseSchema } from '@dealflow/shared';

export const dynamic = 'force-dynamic';

async function fetchMe(): Promise<MeResponse | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiBase}/auth/me`, {
      credentials: 'include',
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
          Full AppShell (sidebar + top bar) ships in a later bundle. This placeholder
          confirms authentication is working.
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
