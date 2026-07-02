/**
 * AuthCard — split-screen auth shell.
 *
 * DESIGN-SYSTEM §10 Auth pages: "No sidebar. Centered/split-screen card treatment;
 * emerald-600 primary; Inter; no app chrome."
 *
 * Structure: left functional form pane + right ambient dark pane (hidden <lg).
 * Consumes design tokens from globals.css :root.
 */

export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        display: 'flex',
        minHeight: '100dvh',
        width: '100%',
        backgroundColor: 'var(--bg-app)',
      }}
    >
      {/* Left pane — functional form area */}
      <section
        style={{
          position: 'relative',
          zIndex: 20,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          padding: '48px 24px',
          backgroundColor: 'var(--bg-app)',
        }}
        // On lg+ screens this becomes 45%/40% via max-width constraint on inner content.
        // We keep a single pane for simplicity; the right ambient panel is decorative.
      >
        {/* Wordmark */}
        <header>
          <a
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              textDecoration: 'none',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--zinc-900)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {/* lucide layout-dashboard, 1.5px stroke */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ffffff"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect width="7" height="9" x="3" y="3" rx="1" />
                <rect width="7" height="5" x="14" y="3" rx="1" />
                <rect width="7" height="9" x="14" y="12" rx="1" />
                <rect width="7" height="5" x="3" y="16" rx="1" />
              </svg>
            </div>
            <span
              style={{
                fontSize: '17px',
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: 'var(--text-primary)',
              }}
            >
              DealFlow AI
            </span>
          </a>
        </header>

        {/* Form content slot */}
        <div
          style={{
            margin: 'auto 0',
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            maxWidth: '380px',
            marginLeft: 'auto',
            marginRight: 'auto',
            paddingTop: '48px',
            paddingBottom: '48px',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        <footer
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}
        >
          <span>© {new Date().getFullYear()} DealFlow AI</span>
          <div style={{ display: 'flex', gap: '16px' }}>
            <a
              href="#"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              Privacy
            </a>
            <a
              href="#"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
            >
              Terms
            </a>
          </div>
        </footer>
      </section>
    </main>
  );
}
