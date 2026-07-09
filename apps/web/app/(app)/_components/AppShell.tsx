/**
 * AppShell — THE shared chrome, built ONCE (DESIGN-SYSTEM §10).
 *
 * Composes <Sidebar> + <TopBar> + {children} content area in a full-height
 * side-by-side grid. Rendered ONCE in app/(app)/layout.tsx for all authed
 * pages; individual pages only supply their content.
 *
 * Receives already-server-verified `me` (from GET /auth/me in the layout)
 * and `pathname` (from Next.js headers) so the Sidebar can highlight the
 * active nav item without client-side code in this component.
 *
 * The TopBar title defaults to the active nav item's label; callers may
 * override via the `pageTitle` prop.
 *
 * Server component — no 'use client' here. NavItem (child of Sidebar) is
 * the client boundary.
 */

import type { MeResponse } from '@dealflow/shared';
import { navItemsForRole } from '@dealflow/shared';
import { Sidebar } from './Sidebar';
import { SkipLink } from './SkipLink';
import { TopBar } from './TopBar';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AppShellProps {
  me: MeResponse;
  pathname: string;
  /** Override the TopBar title. Falls back to the active nav item's label. */
  pageTitle?: string;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolvePageTitle(me: MeResponse, pathname: string, override?: string): string {
  if (override) return override;
  const navItems = navItemsForRole(me.role);
  const active = navItems.find(
    (item) =>
      item.route === pathname || (item.route !== '/' && pathname.startsWith(`${item.route}/`))
  );
  return active?.label ?? 'Dashboard';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppShell({ me, pathname, pageTitle, children }: AppShellProps) {
  const title = resolvePageTitle(me, pathname, pageTitle);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100dvh',
        backgroundColor: '#fcfcfd',
      }}
    >
      {/* D-3 polish note 2: AppShell-level skip link (WCAG 2.4.1 bypass blocks).
          Extracted to SkipLink ('use client') because onFocus/onBlur event
          handlers cannot live in a Server Component. */}
      <SkipLink />
      {/* Left sidebar — role-aware nav */}
      <Sidebar me={me} pathname={pathname} />

      {/* Right content area — TopBar + page content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <TopBar title={title} me={me} />

        {/* Page content */}
        <main
          id="main-content"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
