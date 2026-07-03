/**
 * TopBar — h-16 white sticky top bar.
 *
 * DESIGN-SYSTEM §10 spec:
 *   Breadcrumb / page title (left) · search + notifications + user (right).
 *   h-16, white, sticky, border-b border-zinc-200.
 *
 * Client component: button event handlers (hover/focus) require 'use client'.
 * Icons: lucide-react only.
 */

'use client';

import type { MeResponse } from '@dealflow/shared';
import { Bell, Search } from 'lucide-react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TopBarProps {
  /** Page title shown as breadcrumb/title in left slot. */
  title: string;
  me: MeResponse;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopBar({ title, me }: TopBarProps) {
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '64px',
        padding: '0 24px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0,
      }}
    >
      {/* Left slot — breadcrumb / page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <h1
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            lineHeight: '24px',
            color: '#1f2937',
          }}
        >
          {title}
        </h1>
      </div>

      {/* Right slot — search + notifications + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Search button */}
        <button
          type="button"
          aria-label="Search"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#6b7280',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
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
          <Search size={16} strokeWidth={1.5} aria-hidden />
        </button>

        {/* Notifications button */}
        <button
          type="button"
          aria-label="Notifications"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#6b7280',
            cursor: 'pointer',
            transition: 'background-color 150ms ease',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
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
          <Bell size={16} strokeWidth={1.5} aria-hidden />
        </button>

        {/* User avatar chip */}
        <div
          role="status"
          aria-label={`Signed in as ${me.email}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '4px 10px 4px 6px',
            borderRadius: '6px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            fontSize: '13px',
            lineHeight: '20px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          <div
            aria-hidden
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: '#111827',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 600,
              color: '#10b981',
              flexShrink: 0,
            }}
          >
            {me.email.slice(0, 2).toUpperCase()}
          </div>
          <span
            style={{
              maxWidth: '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {me.email}
          </span>
        </div>
      </div>
    </header>
  );
}
