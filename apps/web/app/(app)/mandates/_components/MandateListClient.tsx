/**
 * MandateListClient — client component for the mandate list page.
 *
 * Receives mandates SSR-fetched by the server page (no client data fetch).
 * Handles status filter (in-memory on the SSR-loaded list) and renders:
 *   - Status filter segmented control (draft / active / all)
 *   - List rows (seller name, deal-type, status badge, created date)
 *   - Empty state: "Create your first mandate" (not a crash)
 *   - Error state: shown when initialMandates is null (API unavailable)
 *
 * Design: mandates-list.html — zinc/emerald palette, AppShell chrome inherited.
 */
'use client';

import type { Mandate } from '@dealflow/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { type MandateStatusFilter, StatusFilter } from './StatusFilter';

interface MandateListClientProps {
  initialMandates: Mandate[] | null;
}

function formatDate(raw: string): string {
  // PG-wire timestamptz: "2026-07-04 04:42:20+00" — two-step normalization:
  //   1. Replace space with 'T' → "2026-07-04T04:42:20+00"
  //   2. Append ':00' when the timezone offset is +HH or -HH (no minutes) →
  //      "2026-07-04T04:42:20+00:00". V8 requires +HH:MM; bare +HH is invalid ISO 8601.
  // ISO "2026-07-04T04:42:20.000Z" passes through unchanged (neither substitution fires).
  try {
    const normalized = raw.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00');
    const d = new Date(normalized);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return raw;
  }
}

function StatusBadge({ status }: { status: Mandate['status'] }) {
  const isDraft = status === 'draft';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: isDraft ? '#F9FAFB' : '#ECFDF5',
        color: isDraft ? '#4B5563' : '#059669',
        border: `1px solid ${isDraft ? '#E5E7EB' : '#A7F3D0'}`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          backgroundColor: isDraft ? '#9CA3AF' : '#10B981',
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  );
}

export function MandateListClient({ initialMandates }: MandateListClientProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<MandateStatusFilter>('all');

  if (initialMandates === null) {
    return (
      <div
        role="alert"
        style={{
          padding: '40px 24px',
          textAlign: 'center',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FECACA',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#991B1B', marginBottom: '4px' }}>
          Unable to load mandates
        </div>
        <div style={{ fontSize: '13px', color: '#B91C1C' }}>
          The service is temporarily unavailable. Refresh to retry.
        </div>
      </div>
    );
  }

  const filtered =
    statusFilter === 'all'
      ? initialMandates
      : initialMandates.filter((m) => m.status === statusFilter);

  return (
    <div>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#111827',
              letterSpacing: '-0.01em',
              marginBottom: '4px',
            }}
          >
            Mandates
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            Manage active engagements, AI matchmaking, and outreach velocity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/mandates/new')}
          aria-label="Create a new mandate"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#FFFFFF',
            backgroundColor: '#10B981',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
            transition: 'background-color 150ms ease',
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#047857';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = '#10B981';
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 3px rgba(16,185,129,0.4)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(16,24,40,0.08)';
          }}
        >
          {/* Plus icon */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New mandate
        </button>
      </div>

      {/* Filter + table container */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Controls bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#FAFAFA',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <StatusFilter value={statusFilter} onChange={setStatusFilter} />
        </div>

        {filtered.length === 0 ? (
          <EmptyState filter={statusFilter} onNew={() => router.push('/mandates/new')} />
        ) : (
          <MandateTable mandates={filtered} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ filter, onNew }: { filter: MandateStatusFilter; onNew: () => void }) {
  const isFiltered = filter !== 'all';
  return (
    <div
      style={{
        padding: '64px 24px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          backgroundColor: '#F3F4F6',
          border: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      </div>
      <div style={{ fontSize: '15px', fontWeight: 600, color: '#111827', marginBottom: '6px' }}>
        {isFiltered ? `No ${filter} mandates` : 'Create your first mandate'}
      </div>
      <p
        style={{
          fontSize: '13px',
          color: '#6B7280',
          marginBottom: '20px',
          maxWidth: '320px',
          margin: '0 auto 20px',
        }}
      >
        {isFiltered
          ? `No mandates with status "${filter}" exist yet.`
          : 'Start by creating a mandate to capture seller profile, buyer criteria, and compliance guardrails.'}
      </p>
      {!isFiltered && (
        <button
          type="button"
          onClick={onNew}
          style={{
            padding: '8px 18px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#FFFFFF',
            backgroundColor: '#10B981',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          New mandate
        </button>
      )}
    </div>
  );
}

function MandateTable({ mandates }: { mandates: Mandate[] }) {
  const router = useRouter();

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }} aria-label="Mandates list">
      <thead>
        <tr
          style={{
            backgroundColor: 'rgba(249,250,251,0.5)',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          {[
            { label: 'Mandate / Seller', align: 'left' },
            { label: 'Deal Type', align: 'left' },
            { label: 'Status', align: 'left' },
            { label: 'Created', align: 'left' },
          ].map((col) => (
            <th
              key={col.label}
              scope="col"
              style={{
                padding: '10px 16px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#6B7280',
                textAlign: col.align as 'left' | 'right',
              }}
            >
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {mandates.map((m) => (
          <tr
            key={m.id}
            onClick={() => router.push(`/mandates/${m.id}`)}
            style={{
              borderBottom: '1px solid #F3F4F6',
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#FAFAFA';
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#FAFAFA';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '';
            }}
          >
            <td style={{ padding: '14px 16px' }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#111827',
                  marginBottom: '2px',
                }}
              >
                {m.sellerName}
              </div>
              {m.sellerIndustry && (
                <div style={{ fontSize: '12px', color: '#6B7280' }}>{m.sellerIndustry}</div>
              )}
            </td>
            <td style={{ padding: '14px 16px' }}>
              <span style={{ fontSize: '13px', color: '#374151' }}>{m.dealType ?? '—'}</span>
            </td>
            <td style={{ padding: '14px 16px' }}>
              <StatusBadge status={m.status} />
            </td>
            <td style={{ padding: '14px 16px' }}>
              <span
                style={{
                  fontSize: '12px',
                  color: '#6B7280',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatDate(m.createdAt)}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
