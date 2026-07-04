/**
 * DetailDrawer — right-side slide-over for company detail + source lineage.
 *
 * Fetches company detail from GET /sourcing/companies/:id on mount.
 * Renders:
 *   - Company header (name, domain, sector, status)
 *   - Contacts tab (contacts list)
 *   - Source Lineage tab (provenance records — badges from real connection rows)
 *
 * Design: design/sourcing-workspace.html #detailDrawer right panel (§10 tokens).
 * AC-BADGE: lineage badges use real data_source_connections.displayName.
 *
 * Accessibility:
 *   - role=dialog with aria-label and aria-modal
 *   - Focus trap: Escape closes the drawer
 *   - Focus moves to close button on open
 *   - Tab sequence: close → content → footer
 */

'use client';

import type { CompanyProvenance, Contact } from '@dealflow/shared';
import { companyProvenanceSchema, companySchema, contactSchema } from '@dealflow/shared';
import { useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { apiFetch } from '../../_lib/apiFetch';
import type { ConnectionWithCount } from '../_lib/workspace-types';

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

const detailResponseSchema = z.object({
  company: companySchema,
  contacts: z.array(contactSchema),
  provenance: z.array(companyProvenanceSchema),
  pendingCandidates: z.array(z.unknown()).optional().default([]),
});

type DrawerTab = 'contacts' | 'lineage';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DetailDrawerProps {
  companyId: string;
  connections: ConnectionWithCount[];
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DetailDrawer({ companyId, connections, onClose }: DetailDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>('contacts');
  const [data, setData] = useState<z.infer<typeof detailResponseSchema> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Build connection map for lineage badge labels
  const connMap = new Map(connections.map((c) => [c.id, c.displayName]));

  // Focus close button on open
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Keyboard: Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Fetch company detail
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    apiFetch(`/sourcing/companies/${companyId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load company detail');
        const raw: unknown = await res.json();
        const parsed = detailResponseSchema.safeParse(raw);
        if (!parsed.success) throw new Error('Invalid response');
        if (!cancelled) {
          setData(parsed.data);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(3,7,18,0.45)',
          backdropFilter: 'blur(2px)',
          zIndex: 40,
        }}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={data ? `Company detail: ${data.company.name}` : 'Company detail'}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderLeft: '1px solid #e5e7eb',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.1)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.3s cubic-bezier(0.16,1,0.3,1) both',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Drawer header */}
        <div
          style={{
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#6b7280',
            }}
          >
            Company Detail
          </span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Close company detail drawer"
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              color: '#6b7280',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 150ms ease',
              outline: 'none',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 0 2px rgba(16,185,129,0.25)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            <XIcon />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {loading && <DrawerSkeleton />}
          {error && (
            <div role="alert" style={{ color: '#b91c1c', fontSize: '13px', padding: '12px 0' }}>
              {error}
            </div>
          )}
          {!loading && !error && data && (
            <>
              {/* Company header */}
              <CompanyHeader company={data.company} />

              {/* Tab bar */}
              <div
                role="tablist"
                aria-label="Company detail sections"
                style={{
                  display: 'flex',
                  gap: '0',
                  borderBottom: '1px solid #e5e7eb',
                  marginBottom: '20px',
                  marginTop: '20px',
                }}
              >
                <TabButton
                  id="tab-contacts"
                  controls="panel-contacts"
                  isActive={tab === 'contacts'}
                  onClick={() => setTab('contacts')}
                  label={`Contacts (${data.contacts.length})`}
                />
                <TabButton
                  id="tab-lineage"
                  controls="panel-lineage"
                  isActive={tab === 'lineage'}
                  onClick={() => setTab('lineage')}
                  label={`Source Lineage (${data.provenance.length})`}
                />
              </div>

              {/* Tab panels */}
              {tab === 'contacts' && (
                <div role="tabpanel" id="panel-contacts" aria-labelledby="tab-contacts">
                  <ContactsPanel contacts={data.contacts} />
                </div>
              )}
              {tab === 'lineage' && (
                <div role="tabpanel" id="panel-lineage" aria-labelledby="tab-lineage">
                  <LineagePanel provenance={data.provenance} connMap={connMap} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            flexShrink: 0,
          }}
        >
          <a
            href="/sourcing/companies"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%',
              padding: '9px 16px',
              borderRadius: '8px',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#047857';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#10b981';
            }}
          >
            Open in Companies &amp; Contacts
          </a>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CompanyHeader
// ---------------------------------------------------------------------------

function CompanyHeader({ company }: { company: z.infer<typeof companySchema> }) {
  const abbr = company.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
      <div
        aria-hidden="true"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '10px',
          border: '1px solid #e5e7eb',
          backgroundColor: '#ecfdf5',
          color: '#047857',
          fontSize: '20px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {abbr}
      </div>
      <div>
        <h2
          style={{
            margin: '0 0 4px',
            fontSize: '20px',
            fontWeight: 700,
            color: '#111827',
            lineHeight: '1.2',
          }}
        >
          {company.name}
        </h2>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            fontSize: '12px',
            color: '#6b7280',
          }}
        >
          {company.domain && <span>{company.domain}</span>}
          {company.sector && <span>{company.sector}</span>}
          <span
            style={{
              backgroundColor: company.status === 'active' ? '#ecfdf5' : '#f3f4f6',
              color: company.status === 'active' ? '#047857' : '#6b7280',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 600,
              border: `1px solid ${company.status === 'active' ? '#d1fae5' : '#e5e7eb'}`,
            }}
          >
            {company.status}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContactsPanel
// ---------------------------------------------------------------------------

function ContactsPanel({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
        No contacts on record.
      </p>
    );
  }

  return (
    <ul
      aria-label="Contacts list"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {contacts.map((contact) => (
        <li
          key={contact.id}
          style={{
            padding: '12px',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
          }}
        >
          <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            {contact.name ?? 'Unknown'}
          </p>
          {contact.title && (
            <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6b7280' }}>{contact.title}</p>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              style={{ fontSize: '12px', color: '#10b981', textDecoration: 'none' }}
            >
              {contact.email}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// LineagePanel — AC-BADGE: uses real connection displayName
// ---------------------------------------------------------------------------

interface LineagePanelProps {
  provenance: CompanyProvenance[];
  connMap: Map<string, string>;
}

function LineagePanel({ provenance, connMap }: LineagePanelProps) {
  if (provenance.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: '#9ca3af', fontStyle: 'italic' }}>
        No source lineage recorded yet.
      </p>
    );
  }

  return (
    <ul
      aria-label="Source lineage"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {provenance.map((prov) => {
        const displayName = connMap.get(prov.connectionId) ?? prov.connectionId.slice(0, 8);
        const abbr = displayName
          .split(/\s+/)
          .slice(0, 2)
          .map((w: string) => w[0] ?? '')
          .join('')
          .toUpperCase()
          .slice(0, 3);
        const ingestedLabel = new Date(prov.ingestedAt).toLocaleDateString();

        return (
          <li
            key={prov.id}
            aria-label={`Source: ${displayName}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                fontSize: '11px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {abbr}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                {displayName}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: '11px',
                  color: '#9ca3af',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                Ingested {ingestedLabel}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// TabButton
// ---------------------------------------------------------------------------

interface TabButtonProps {
  id: string;
  controls: string;
  isActive: boolean;
  onClick: () => void;
  label: string;
}

function TabButton({ id, controls, isActive, onClick, label }: TabButtonProps) {
  return (
    <button
      id={id}
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={controls}
      onClick={onClick}
      style={{
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: isActive ? 600 : 400,
        color: isActive ? '#10b981' : '#6b7280',
        backgroundColor: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${isActive ? '#10b981' : 'transparent'}`,
        cursor: 'pointer',
        outline: 'none',
        transition: 'all 150ms ease',
        whiteSpace: 'nowrap',
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 2px rgba(16,185,129,0.25)';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
      }}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// DrawerSkeleton
// ---------------------------------------------------------------------------

const SKELETON_WIDTHS = [80, 120, 60] as const;

function DrawerSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading company detail">
      {SKELETON_WIDTHS.map((w) => (
        <div
          key={w}
          style={{
            height: '16px',
            borderRadius: '4px',
            backgroundColor: '#f3f4f6',
            marginBottom: '12px',
            width: `${w}%`,
            animation: 'pulse 1.4s ease infinite',
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline icons
// ---------------------------------------------------------------------------

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
