/**
 * CompanyDetail — right-pane detail view for a selected company.
 *
 * Fetches company detail (contacts + provenance + pending dedupe candidates)
 * from GET /sourcing/companies/:id client-side (after SSR list). Renders:
 *   - Company header (name, domain, status, ID)
 *   - Contacts table (per design tabbed section)
 *   - Provenance / source badges (data lineage)
 *   - Pending dedupe candidates review surface (merge | reject)
 *
 * Design tokens: DESIGN-SYSTEM §10 (zinc/emerald). Build to
 * design/companies-contacts.html detail pane.
 *
 * Accessibility:
 *   - Tabs keyboard-navigable (arrow keys, Enter/Space).
 *   - Resolve buttons: merge = primary, reject = destructive (confirmed).
 *   - Focus ring: 2px emerald ring on all interactive elements.
 *   - aria-live region for status feedback.
 */

'use client';

import type { CompanyProvenance, Contact, DedupeCandidate } from '@dealflow/shared';
import {
  companyProvenanceSchema,
  companySchema,
  contactSchema,
  dedupeCandidateSchema,
} from '@dealflow/shared';
import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// API response schema
// ---------------------------------------------------------------------------

const detailResponseSchema = z.object({
  company: companySchema,
  contacts: z.array(contactSchema),
  provenance: z.array(companyProvenanceSchema),
  pendingCandidates: z.array(dedupeCandidateSchema),
});

type DetailResponse = z.infer<typeof detailResponseSchema>;

// ---------------------------------------------------------------------------
// Style primitives
// ---------------------------------------------------------------------------

const CARD: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
  overflow: 'hidden',
};

const BTN_EMERALD: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#10b981',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 150ms ease',
};

const BTN_GHOST: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 150ms ease',
};

const BTN_DANGER: React.CSSProperties = {
  ...BTN_GHOST,
  color: '#b91c1c',
  borderColor: '#fecaca',
  backgroundColor: '#fff1f2',
};

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'error';
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: `1px solid ${t.kind === 'success' ? '#d1fae5' : '#fecaca'}`,
            backgroundColor: t.kind === 'success' ? '#ecfdf5' : '#fff1f2',
            color: t.kind === 'success' ? '#047857' : '#b91c1c',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 8px 24px rgb(16 24 40 / 0.12)',
            minWidth: '280px',
            pointerEvents: 'auto',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dedupe candidate review card
// ---------------------------------------------------------------------------

interface DedupeCandidateCardProps {
  candidate: DedupeCandidate;
  onResolved: (candidateId: string, action: 'merge' | 'reject') => void;
}

function DedupeCandidateCard({ candidate, onResolved }: DedupeCandidateCardProps) {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = useCallback(
    async (action: 'merge' | 'reject') => {
      if (action === 'reject') {
        const confirmed = window.confirm(
          'Reject this match and keep the companies separate? This cannot be undone.'
        );
        if (!confirmed) return;
      }

      setError(null);
      setResolving(true);
      try {
        const res = await apiFetch(`/sourcing/dedupe-candidates/${candidate.id}/resolve`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action }),
          cache: 'no-store',
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          setError(`Failed to resolve (${res.status})${txt ? `: ${txt}` : ''}`);
          return;
        }
        onResolved(candidate.id, action);
      } catch {
        setError('Network error — please try again');
      } finally {
        setResolving(false);
      }
    },
    [candidate.id, onResolved]
  );

  const scoreLabel =
    candidate.score !== null
      ? `${Math.round(candidate.score * 100)}% confidence`
      : 'confidence unknown';

  return (
    <article
      style={{
        border: '2px solid #fecaca',
        borderRadius: '8px',
        backgroundColor: '#fff8f8',
        overflow: 'hidden',
      }}
      aria-label={`Dedupe candidate: ${scoreLabel}`}
    >
      {/* Card header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#fff1f2',
        }}
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#b91c1c"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#b91c1c' }}>
          Potential Duplicate Detected
        </span>
        {candidate.score !== null && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '12px',
              fontWeight: 500,
              color: '#ef4444',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {scoreLabel}
          </span>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '16px' }}>
        {candidate.reason && (
          <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#4b5563', lineHeight: '18px' }}>
            {candidate.reason}
          </p>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#9ca3af',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span>Raw company ID:</span>
          <code
            style={{
              backgroundColor: '#f3f4f6',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px',
              color: '#374151',
            }}
          >
            {candidate.rawCompanyId.slice(0, 8)}…
          </code>
          {candidate.matchedCompanyId && (
            <>
              <span>→ Canonical:</span>
              <code
                style={{
                  backgroundColor: '#f3f4f6',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  color: '#374151',
                }}
              >
                {candidate.matchedCompanyId.slice(0, 8)}…
              </code>
            </>
          )}
        </div>

        {error && (
          <p role="alert" style={{ margin: '0 0 12px', fontSize: '13px', color: '#b91c1c' }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            disabled={resolving}
            onClick={() => void handleResolve('reject')}
            aria-label="Reject match — keep companies separate"
            style={{ ...BTN_DANGER, opacity: resolving ? 0.7 : 1 }}
            onFocus={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 0 2px rgba(185 28 28 / 0.3)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            {resolving ? 'Working…' : 'Reject match'}
          </button>
          <button
            type="button"
            disabled={resolving}
            onClick={() => void handleResolve('merge')}
            aria-label="Merge records — confirm this is a duplicate and merge"
            style={{ ...BTN_EMERALD, opacity: resolving ? 0.7 : 1 }}
            onFocus={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            {resolving ? 'Working…' : 'Merge records'}
          </button>
        </div>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Provenance badges
// ---------------------------------------------------------------------------

function ProvenanceBadges({ provenance }: { provenance: CompanyProvenance[] }) {
  if (provenance.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '16px 20px',
      }}
    >
      {provenance.map((p) => (
        <span
          key={p.id}
          role="img"
          title={`Source connection: ${p.connectionId}\nIngested: ${new Date(p.ingestedAt).toLocaleDateString()}`}
          aria-label={`Data source: connection ${p.connectionId.slice(0, 8)}, ingested ${new Date(p.ingestedAt).toLocaleDateString()}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            backgroundColor: '#ecfdf5',
            border: '1px solid #d1fae5',
            fontSize: '12px',
            fontWeight: 500,
            color: '#047857',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <svg
            aria-hidden="true"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
          {p.connectionId.slice(0, 8)}…
          <span style={{ opacity: 0.7 }}>
            {new Date(p.ingestedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contacts table
// ---------------------------------------------------------------------------

function ContactsTable({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <div
        style={{
          padding: '32px 20px',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '14px',
        }}
      >
        No contacts for this company yet.
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}
        aria-label="Company contacts"
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            {(['Name', 'Title', 'Email'] as const).map((col) => (
              <th
                key={col}
                scope="col"
                style={{
                  padding: '10px 20px',
                  textAlign: 'left',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: '#6b7280',
                  whiteSpace: 'nowrap',
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td
                style={{
                  padding: '12px 20px',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: '#111827',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div
                    aria-hidden="true"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#4b5563',
                      border: '1px solid #d1d5db',
                      flexShrink: 0,
                    }}
                  >
                    {contact.name
                      ? contact.name
                          .split(' ')
                          .slice(0, 2)
                          .map((w) => w[0]?.toUpperCase() ?? '')
                          .join('')
                      : '?'}
                  </div>
                  {contact.name ?? (
                    <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unknown</span>
                  )}
                </div>
              </td>
              <td style={{ padding: '12px 20px', fontSize: '13px', color: '#6b7280' }}>
                {contact.title ?? <span style={{ color: '#d1d5db' }}>—</span>}
              </td>
              <td
                style={{
                  padding: '12px 20px',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontFamily: 'ui-monospace, monospace',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {contact.email ? (
                  // Mask email for display (show first char + *** + domain)
                  <span>{maskEmail(contact.email)}</span>
                ) : (
                  <span style={{ color: '#d1d5db' }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const masked = `${local[0]}***`;
  return `${masked}@${domain}`;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  const pulse: React.CSSProperties = {
    backgroundColor: '#f3f4f6',
    borderRadius: '4px',
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
  };
  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ ...pulse, height: '28px', width: '50%' }} />
        <div style={{ ...pulse, height: '16px', width: '30%' }} />
      </div>
      <div style={{ ...pulse, height: '120px', width: '100%' }} />
      <div style={{ ...pulse, height: '200px', width: '100%' }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab state
// ---------------------------------------------------------------------------

type TabKey = 'contacts' | 'provenance' | 'dedupe';

function tabLabel(key: TabKey, pendingCount: number): string {
  if (key === 'contacts') return 'Contacts';
  if (key === 'provenance') return 'Provenance';
  return `Dedupe Review${pendingCount > 0 ? ` (${pendingCount})` : ''}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CompanyDetailProps {
  companyId: string;
  companyName: string;
  companyDomain?: string;
  onCandidateResolved: (companyId: string, hasPending: boolean) => void;
}

export function CompanyDetail({
  companyId,
  companyName,
  companyDomain,
  onCandidateResolved,
}: CompanyDetailProps) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('contacts');
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Fetch detail whenever companyId changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    void (async () => {
      try {
        const res = await fetch(`/sourcing/companies/${companyId}`, {
          credentials: 'include',
          cache: 'no-store',
          headers: { rid: 'anti-csrf' },
        });
        if (!res.ok) {
          if (!cancelled) setError(`Failed to load company (${res.status})`);
          return;
        }
        const raw: unknown = await res.json();
        const parsed = detailResponseSchema.safeParse(raw);
        if (!parsed.success) {
          if (!cancelled) setError('Unexpected response format');
          return;
        }
        if (!cancelled) {
          setDetail(parsed.data);
          // Auto-select dedupe tab if there are pending candidates
          if (parsed.data.pendingCandidates.length > 0) {
            setActiveTab('dedupe');
          }
        }
      } catch {
        if (!cancelled) setError('Network error — please try again');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const pushToast = useCallback((message: string, kind: Toast['kind']) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleCandidateResolved = useCallback(
    (candidateId: string, action: 'merge' | 'reject') => {
      setDetail((prev) => {
        if (!prev) return prev;
        const remaining = prev.pendingCandidates.filter((c) => c.id !== candidateId);
        onCandidateResolved(companyId, remaining.length > 0);
        return { ...prev, pendingCandidates: remaining };
      });
      pushToast(
        action === 'merge'
          ? 'Records merged successfully'
          : 'Match rejected — companies kept separate',
        'success'
      );
    },
    [companyId, onCandidateResolved, pushToast]
  );

  if (loading) return <DetailSkeleton />;

  if (error) {
    return (
      <div
        role="alert"
        style={{
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          color: '#b91c1c',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontWeight: 500 }}>{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setLoading(true);
          }}
          style={BTN_GHOST}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!detail) return null;

  const { company, contacts, provenance, pendingCandidates } = detail;
  const TABS: TabKey[] = ['contacts', 'provenance', 'dedupe'];

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <ToastList toasts={toasts} />

      {/* ── Company header ── */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
          padding: '24px',
        }}
      >
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" style={{ marginBottom: '16px' }}>
          <ol
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              listStyle: 'none',
              margin: 0,
              padding: 0,
              fontSize: '12px',
              color: '#6b7280',
              fontWeight: 500,
            }}
          >
            <li>Companies</li>
            <li aria-hidden="true" style={{ fontSize: '10px' }}>
              ›
            </li>
            <li aria-current="page" style={{ color: '#111827' }}>
              {companyName}
            </li>
          </ol>
        </nav>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: 600,
                  color: '#111827',
                  letterSpacing: '-0.01em',
                }}
              >
                {company.name}
              </h2>
              {/* Company ID badge */}
              <span
                title={`Company ID: ${company.id}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #e5e7eb',
                  fontSize: '11px',
                  fontWeight: 500,
                  color: '#6b7280',
                  fontFamily: 'ui-monospace, monospace',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ID: {company.id.slice(0, 8)}…
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {(company.domain ?? companyDomain) && (
                <a
                  href={`https://${company.domain ?? companyDomain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Visit ${company.domain ?? companyDomain} (opens in new tab)`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '14px',
                    color: '#10b981',
                    textDecoration: 'none',
                    transition: 'color 150ms ease',
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow =
                      '0 0 0 2px rgb(16 185 129 / 0.3)';
                    (e.currentTarget as HTMLAnchorElement).style.borderRadius = '2px';
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
                  }}
                >
                  {company.domain ?? companyDomain}
                  <svg
                    aria-hidden="true"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              )}

              {company.sector && (
                <>
                  <span aria-hidden="true" style={{ color: '#d1d5db' }}>
                    ·
                  </span>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>{company.sector}</span>
                </>
              )}

              {/* Status */}
              <span aria-hidden="true" style={{ color: '#d1d5db' }}>
                ·
              </span>
              <span
                role="img"
                aria-label={`Status: ${company.status}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: company.status === 'active' ? '#047857' : '#6b7280',
                  backgroundColor: company.status === 'active' ? '#ecfdf5' : '#f3f4f6',
                  border: `1px solid ${company.status === 'active' ? '#d1fae5' : '#e5e7eb'}`,
                  padding: '2px 8px',
                  borderRadius: '4px',
                }}
              >
                {company.status === 'active' ? 'Active' : 'Archived'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ── Pending dedupe alert banner ── */}
      {pendingCandidates.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            padding: '12px 16px',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d97706"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p style={{ margin: 0, fontSize: '14px', color: '#92400e' }}>
              <strong>{pendingCandidates.length}</strong> pending dedupe{' '}
              {pendingCandidates.length === 1 ? 'match' : 'matches'} need review.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('dedupe')}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#b45309',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              outline: 'none',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 0 2px rgb(217 119 6 / 0.3)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            Review
          </button>
        </div>
      )}

      {/* ── Tabbed content ── */}
      <div style={CARD}>
        {/* Tab headers */}
        <div
          role="tablist"
          aria-label="Company details sections"
          style={{
            display: 'flex',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: 'rgba(249,250,251,0.5)',
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`tabpanel-${tab}`}
                id={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight') {
                    const idx = TABS.indexOf(tab);
                    setActiveTab(TABS[(idx + 1) % TABS.length] ?? tab);
                  }
                  if (e.key === 'ArrowLeft') {
                    const idx = TABS.indexOf(tab);
                    setActiveTab(TABS[(idx - 1 + TABS.length) % TABS.length] ?? tab);
                  }
                }}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#065f46' : '#6b7280',
                  backgroundColor: isActive ? '#ffffff' : 'transparent',
                  cursor: 'pointer',
                  outline: 'none',
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? '#10b981' : 'transparent'}`,
                  transition: 'color 150ms ease',
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 0 0 2px rgb(16 185 129 / 0.3) inset';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {tabLabel(tab, pendingCandidates.length)}
              </button>
            );
          })}
        </div>

        {/* Tab panels */}
        <div
          id="tabpanel-contacts"
          role="tabpanel"
          aria-labelledby="tab-contacts"
          hidden={activeTab !== 'contacts'}
        >
          <ContactsTable contacts={contacts} />
        </div>

        <div
          id="tabpanel-provenance"
          role="tabpanel"
          aria-labelledby="tab-provenance"
          hidden={activeTab !== 'provenance'}
        >
          {provenance.length === 0 ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '14px',
              }}
            >
              No provenance data available for this company.
            </div>
          ) : (
            <div>
              <div style={{ padding: '16px 20px 0' }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '18px' }}>
                  These source connections contributed data to this canonical record. Each badge
                  represents one raw ingest event.
                </p>
              </div>
              <ProvenanceBadges provenance={provenance} />
              {/* Contributed fields table */}
              <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
                <table
                  style={{ width: '100%', borderCollapse: 'collapse', minWidth: '420px' }}
                  aria-label="Provenance details"
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                      {(['Source ID', 'Connection', 'Ingested', 'Fields'] as const).map((col) => (
                        <th
                          key={col}
                          scope="col"
                          style={{
                            padding: '10px 20px',
                            textAlign: 'left',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            color: '#6b7280',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {provenance.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td
                          style={{
                            padding: '10px 20px',
                            fontSize: '12px',
                            fontFamily: 'ui-monospace, monospace',
                            color: '#374151',
                          }}
                        >
                          {p.rawCompanyId.slice(0, 12)}…
                        </td>
                        <td
                          style={{
                            padding: '10px 20px',
                            fontSize: '12px',
                            fontFamily: 'ui-monospace, monospace',
                            color: '#374151',
                          }}
                        >
                          {p.connectionId.slice(0, 12)}…
                        </td>
                        <td
                          style={{
                            padding: '10px 20px',
                            fontSize: '12px',
                            color: '#6b7280',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {new Date(p.ingestedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td
                          style={{
                            padding: '10px 20px',
                            fontSize: '12px',
                            color: '#6b7280',
                          }}
                        >
                          {p.contributedFields && Object.keys(p.contributedFields).length > 0 ? (
                            <code
                              style={{
                                backgroundColor: '#f3f4f6',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                              }}
                            >
                              {Object.keys(p.contributedFields).join(', ')}
                            </code>
                          ) : (
                            <span style={{ color: '#d1d5db' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div
          id="tabpanel-dedupe"
          role="tabpanel"
          aria-labelledby="tab-dedupe"
          hidden={activeTab !== 'dedupe'}
        >
          {pendingCandidates.length === 0 ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '14px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <svg
                aria-hidden="true"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d1fae5"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p style={{ margin: 0, fontWeight: 500, color: '#374151' }}>
                No pending dedupe matches
              </p>
              <p style={{ margin: 0, fontSize: '13px' }}>
                This company has no unresolved duplicate candidates.
              </p>
            </div>
          ) : (
            <div
              style={{
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <p style={{ margin: 0, fontSize: '13px', color: '#6b7280', lineHeight: '18px' }}>
                The system detected potential duplicate matches during ingest. Review each candidate
                and choose whether to merge the raw record into the canonical company or keep them
                separate.
              </p>
              {pendingCandidates.map((candidate) => (
                <DedupeCandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  onResolved={handleCandidateResolved}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
