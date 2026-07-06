/**
 * /matches — Matches page placeholder (wave-15 AppShell polish, task d7f716b4).
 *
 * NAV_MATCHES in rbac.ts links to /matches (route: '/matches'). The wave-10
 * matches UI currently lives at /matches-shortlist. This placeholder prevents
 * a raw 404 when admin/advisor/analyst click "Matches" in the sidebar.
 *
 * Admin-only is NOT enforced here — see NAV_MATCHES.allowedRoles (advisor, admin, analyst).
 * The (app) layout handles session auth; this page is accessible to all those roles.
 */

export const dynamic = 'force-dynamic';

export default function MatchesPlaceholderPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '800px',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 600,
            lineHeight: '32px',
            letterSpacing: '-0.01em',
            color: '#111827',
          }}
        >
          Matches
        </h1>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
          Buyer-mandate matching and shortlists.
        </p>
      </div>

      <section
        aria-label="Matches — coming soon"
        style={{
          backgroundColor: '#f9fafb',
          border: '1px dashed #d1d5db',
          borderRadius: '8px',
          padding: '48px 32px',
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
            fontSize: '15px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          Matches are available in the shortlist view.
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
          Use the Matches Shortlist module to view and manage buyer-mandate matches.
        </p>
        <a
          href="/matches-shortlist"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: '36px',
            padding: '0 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
            marginTop: '8px',
          }}
        >
          Go to Matches Shortlist
        </a>
      </section>
    </div>
  );
}
