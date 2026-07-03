/**
 * / — role-aware authed dashboard shell (wave-3).
 *
 * Canonical dashboard route per P-4 remediation: '/' (authed).
 * The wave-1 public health page at '/' is superseded; the wave-2 /dashboard
 * placeholder is retired. Unauth '/' → /login via the (app) layout guard.
 *
 * This page renders inside <AppShell> (provided by (app)/layout.tsx) — it
 * supplies ONLY the page content, never re-implements the chrome.
 *
 * Content: identity + role display + role-appropriate empty/landing state.
 * NOT feature content (per M1 slice). For compliance/admin roles it shows
 * the compliance summary (GET /compliance/summary); for all other roles it
 * shows a coming-soon landing card.
 *
 * The `me` object is resolved server-side in the (app) layout. This page
 * re-fetches it to get the role for conditional rendering. In a future
 * iteration the layout would pass `me` via React context — for this wave
 * a second server-side fetch is acceptable (same cached network call;
 * cookie-forwarded, no-store).
 */

import type { MeResponse } from '@dealflow/shared';
import { meResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Data fetching
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
// Role-appropriate content components
// ---------------------------------------------------------------------------

function RoleLabel({ role }: { role: string }) {
  const labels: Record<string, string> = {
    admin: 'Administrator',
    advisor: 'Advisor',
    analyst: 'Analyst',
    compliance: 'Compliance Officer',
  };
  return <>{labels[role] ?? role}</>;
}

function WelcomeCard({ me }: { me: MeResponse }) {
  return (
    <section
      aria-label="Welcome"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: '20px',
          fontWeight: 600,
          lineHeight: '28px',
          color: '#1f2937',
        }}
      >
        Welcome back
      </h2>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#374151' }}>
        Signed in as <strong>{me.email}</strong>
      </p>
      <p style={{ margin: 0, fontSize: '13px', lineHeight: '18px', color: '#6b7280' }}>
        Role: <RoleLabel role={me.role} />
      </p>
    </section>
  );
}

function ComingSoonCard({ label }: { label: string }) {
  return (
    <section
      aria-label={`${label} — coming soon`}
      style={{
        backgroundColor: '#f9fafb',
        border: '1px dashed #d1d5db',
        borderRadius: '8px',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '12px',
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '14px',
          lineHeight: '20px',
          fontWeight: 500,
          color: '#6b7280',
        }}
      >
        {label} features are coming in the next milestone.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const me = await fetchMe();
  // Layout guard already handles redirect, but guard defensively here too.
  if (!me) redirect('/login');

  const isComplianceOrAdmin = me.role === 'compliance' || me.role === 'admin';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '800px',
      }}
    >
      {/* Identity + role */}
      <WelcomeCard me={me} />

      {/* Role-appropriate landing state */}
      {isComplianceOrAdmin ? (
        <section
          aria-label="Compliance overview"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: '24px',
              color: '#1f2937',
            }}
          >
            Compliance Overview
          </h3>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
            Compliance features ship with the M6 milestone. Your role gives you access to the
            compliance queue and audit log when they launch.
          </p>
          {/* Placeholder metric */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div
              style={{
                flex: '1 1 120px',
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '16px',
              }}
            >
              <p
                style={{
                  margin: '0 0 4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: '#6b7280',
                }}
              >
                Pending items
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '30px',
                  fontWeight: 700,
                  lineHeight: '36px',
                  color: '#1f2937',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                0
              </p>
            </div>
          </div>
        </section>
      ) : (
        <ComingSoonCard label="Deal management" />
      )}

      {/* Advisor/analyst quick-start hint */}
      {(me.role === 'advisor' || me.role === 'analyst') && (
        <section
          aria-label="Quick actions"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: '24px',
              color: '#1f2937',
            }}
          >
            {me.role === 'advisor' ? 'Your mandates' : 'Sourcing pipeline'}
          </h3>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
            {me.role === 'advisor'
              ? 'Mandate management and buyer matching ship with M2. Use the navigation to explore available modules.'
              : 'Company sourcing and database features ship with M3. Your analyst access is ready for when they launch.'}
          </p>
        </section>
      )}
    </div>
  );
}
