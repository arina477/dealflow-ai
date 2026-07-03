/**
 * Sidebar — w-64 bg-zinc-900 persistent left sidebar.
 *
 * DESIGN-SYSTEM §10 spec:
 *   - Logomark: emerald-600 rounded square + lucide `network` icon + "DealFlow AI" wordmark
 *   - Workspace group: Dashboard, Mandates, Sourcing, Compliance (role-filtered)
 *   - Config group: Team, Settings (role-filtered)
 *   - Footer: user button (initials + name + role)
 *   - Active item: bg-zinc-800 + emerald left rail + text-emerald-500 icon
 *
 * Role-aware: renders ONLY navItemsForRole(role). No hardcoded nav list.
 * The shared rbac.ts single source of truth guarantees nav ⊆ RBAC-allowed.
 *
 * Client component: footer user button has hover/focus event handlers.
 * NavItem is also 'use client' (hover/focus/active handlers).
 */

'use client';

import type { MeResponse } from '@dealflow/shared';
import { navItemsForRole } from '@dealflow/shared';
import { Network } from 'lucide-react';
import { NavItem } from './NavItem';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SidebarProps {
  me: MeResponse;
  /** Current pathname for active-item detection (e.g. "/" or "/mandates") */
  pathname: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive 1–2 character initials from email (pre-@ part). */
function initials(email: string): string {
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

/** Resolve whether a nav item's route matches the current pathname. */
function isActive(route: string, pathname: string): boolean {
  if (route === '/') return pathname === '/';
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Group label style */
const GROUP_LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  lineHeight: '16px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#6b7280',
  padding: '0 12px',
  marginBottom: '4px',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Sidebar({ me, pathname }: SidebarProps) {
  const navItems = navItemsForRole(me.role);
  const workspaceItems = navItems.filter((item) => item.group === 'workspace');
  const configItems = navItems.filter((item) => item.group === 'config');

  return (
    <nav
      aria-label="Main navigation"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '256px',
        flexShrink: 0,
        height: '100dvh',
        backgroundColor: '#111827',
        color: '#f9fafb',
        position: 'sticky',
        top: 0,
        overflow: 'hidden',
      }}
    >
      {/* ── Logomark + wordmark ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '20px 16px',
          borderBottom: '1px solid #1f2937',
          flexShrink: 0,
        }}
      >
        {/* Emerald-600 rounded square with lucide network icon */}
        <div
          aria-hidden
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            backgroundColor: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Network size={18} strokeWidth={1.5} color="#ffffff" aria-hidden />
        </div>
        <span
          style={{
            fontSize: '16px',
            fontWeight: 600,
            lineHeight: '24px',
            color: '#f9fafb',
            letterSpacing: '-0.01em',
          }}
        >
          DealFlow AI
        </span>
      </div>

      {/* ── Nav groups ── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Workspace group */}
        {workspaceItems.length > 0 && (
          <div>
            <p style={GROUP_LABEL_STYLE}>Workspace</p>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {workspaceItems.map((item) => (
                <li key={item.route}>
                  <NavItem
                    label={item.label}
                    href={item.route}
                    iconName={item.icon}
                    isActive={isActive(item.route, pathname)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Config group */}
        {configItems.length > 0 && (
          <div>
            <p style={GROUP_LABEL_STYLE}>Config</p>
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {configItems.map((item) => (
                <li key={item.route}>
                  <NavItem
                    label={item.label}
                    href={item.route}
                    iconName={item.icon}
                    isActive={isActive(item.route, pathname)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Footer user button ── */}
      <div
        style={{
          padding: '12px 8px',
          borderTop: '1px solid #1f2937',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label={`User menu: ${me.email} (${me.role})`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            textAlign: 'left',
            color: '#f9fafb',
            transition: 'background-color 150ms ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1f2937';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 0 0 2px rgb(16 185 129 / 0.4)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          {/* Avatar with initials */}
          <div
            aria-hidden
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '12px',
              fontWeight: 600,
              color: '#10b981',
            }}
          >
            {initials(me.email)}
          </div>

          {/* Name + role */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                fontWeight: 500,
                lineHeight: '18px',
                color: '#f9fafb',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {me.email}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '12px',
                lineHeight: '16px',
                color: '#6b7280',
                textTransform: 'capitalize',
              }}
            >
              {me.role}
            </p>
          </div>
        </button>
      </div>
    </nav>
  );
}
