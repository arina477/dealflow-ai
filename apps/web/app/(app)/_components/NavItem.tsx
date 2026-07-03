/**
 * NavItem — presentational sidebar navigation item.
 *
 * DESIGN-SYSTEM §10 active state: bg-zinc-800 + emerald-600 left rail
 * (before: bar) + text-emerald-500 icon. Inactive: zinc-400 icon, zinc-200
 * text on hover.
 *
 * Accessibility: keyboard-focusable <a>, visible focus ring (emerald @ 40%),
 * aria-current="page" on the active item.
 *
 * Icons: lucide-react only. The icon name is stored as a string in the shared
 * rbac.ts NavItem (icon: string). We map the canonical icon names to their
 * lucide-react components here.
 */

'use client';

import { Briefcase, Database, LayoutDashboard, Settings, ShieldCheck, Users } from 'lucide-react';
import type { ComponentType, SVGProps } from 'react';

// ---------------------------------------------------------------------------
// Icon registry — maps the string icon-names from rbac.ts to lucide-react
// components. Only the 6 §10-specified icons are needed.
// ---------------------------------------------------------------------------

type LucideProps = SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number };
type LucideIcon = ComponentType<LucideProps>;

const ICON_MAP: Record<string, LucideIcon> = {
  'layout-dashboard': LayoutDashboard as unknown as LucideIcon,
  briefcase: Briefcase as unknown as LucideIcon,
  database: Database as unknown as LucideIcon,
  'shield-check': ShieldCheck as unknown as LucideIcon,
  users: Users as unknown as LucideIcon,
  settings: Settings as unknown as LucideIcon,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NavItemProps {
  label: string;
  href: string;
  iconName: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NavItem({ label, href, iconName, isActive }: NavItemProps) {
  const Icon = ICON_MAP[iconName];

  return (
    <a
      href={href}
      aria-current={isActive ? 'page' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '14px',
        lineHeight: '20px',
        fontWeight: 500,
        textDecoration: 'none',
        color: isActive ? '#f9fafb' : '#9ca3af',
        backgroundColor: isActive ? '#1f2937' : 'transparent',
        outline: 'none',
        // Transition for hover/focus
        transition: 'background-color 150ms ease, color 150ms ease',
      }}
      className={['nav-item', isActive ? 'nav-item--active' : ''].filter(Boolean).join(' ')}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#111827';
          (e.currentTarget as HTMLAnchorElement).style.color = '#f9fafb';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLAnchorElement).style.color = '#9ca3af';
        }
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
      }}
    >
      {/* Emerald left rail — active indicator */}
      {isActive && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: '4px',
            bottom: '4px',
            width: '3px',
            borderRadius: '0 2px 2px 0',
            backgroundColor: '#10b981',
          }}
        />
      )}

      {/* Icon */}
      {Icon ? (
        <Icon
          size={16}
          strokeWidth={1.5}
          aria-hidden
          style={{
            flexShrink: 0,
            color: isActive ? '#10b981' : 'currentColor',
          }}
        />
      ) : (
        // Fallback dot for unknown icon names (should not happen in production)
        <span
          aria-hidden
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            flexShrink: 0,
          }}
        />
      )}

      {/* Label */}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </a>
  );
}
