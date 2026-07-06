/**
 * /outreach — Outreach page placeholder (wave-15 AppShell polish, task d7f716b4).
 *
 * NAV_OUTREACH in rbac.ts links to /outreach (route: '/outreach'). The wave-11
 * outreach compose UI lives at /outreach-composer. This placeholder prevents
 * a raw 404 when advisor/compliance click "Outreach" in the sidebar.
 *
 * The (app) layout handles session auth; RBAC is NAV_OUTREACH.allowedRoles
 * (advisor, compliance).
 */

export const dynamic = 'force-dynamic';

export default function OutreachPlaceholderPage() {
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
          Outreach
        </h1>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
          Outreach composition and delivery.
        </p>
      </div>

      <section
        aria-label="Outreach — coming soon"
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
          Outreach is available in the composer.
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
          Use the Outreach Composer to draft and send outreach to potential buyers.
        </p>
        <a
          href="/outreach-composer"
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
          Go to Outreach Composer
        </a>
      </section>
    </div>
  );
}
