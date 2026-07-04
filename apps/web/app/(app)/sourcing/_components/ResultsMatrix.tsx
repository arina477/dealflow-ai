/**
 * ResultsMatrix — company rows table for the sourcing workspace.
 *
 * Renders the canonical company universe with:
 *   - Company name (initials avatar + name button)
 *   - Source/provenance badges — from real data_source_connections.displayName
 *     (AC-BADGE: NOT literal "PitchBook"/"Crunchbase" from design mock)
 *   - Sector, domain fields
 *   - Row checkbox selection for the Review-Import CTA
 *   - Quick-view eye button → opens DetailDrawer
 *   - Staggered row animation per design
 *
 * Design: design/sourcing-workspace.html results table (§10 zinc/emerald).
 * Accessibility: table with proper thead/tbody, labeled checkboxes, keyboard.
 */

'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ConnectionWithCount, WorkspaceCompany } from '../_lib/workspace-types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResultsMatrixProps {
  companies: WorkspaceCompany[];
  connections: ConnectionWithCount[];
  isLoading: boolean;
  onOpenDetail: (id: string) => void;
  onSelectionChange: (ids: Set<string>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a map from connectionId → displayName for O(1) badge lookup. */
function buildConnectionMap(connections: ConnectionWithCount[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of connections) {
    map.set(c.id, c.displayName);
  }
  return map;
}

/** Derive initials from company name (up to 2 chars). */
function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return (words[0]?.slice(0, 2) ?? '').toUpperCase();
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase();
}

/** Pick a deterministic avatar color from a small palette. */
const AVATAR_COLORS = [
  { bg: '#ecfdf5', color: '#047857' },
  { bg: '#eff6ff', color: '#1d4ed8' },
  { bg: '#fdf4ff', color: '#7e22ce' },
  { bg: '#fff7ed', color: '#c2410c' },
  { bg: '#f0fdf4', color: '#15803d' },
];

function avatarColor(name: string): { bg: string; color: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const fallback = { bg: '#ecfdf5', color: '#047857' };
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? fallback;
}

// ---------------------------------------------------------------------------
// Source badge — AC-BADGE: uses real displayName, not hard-coded provider name
// ---------------------------------------------------------------------------

interface SourceBadgeProps {
  displayName: string;
}

function SourceBadge({ displayName }: SourceBadgeProps) {
  return (
    <span
      role="img"
      aria-label={`Source: ${displayName}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 6px',
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
        backgroundColor: '#ecfdf5',
        color: '#047857',
        border: '1px solid #d1fae5',
        whiteSpace: 'nowrap',
        maxWidth: '120px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
      title={displayName}
    >
      {displayName}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ResultsMatrix({
  companies,
  connections,
  isLoading,
  onOpenDetail,
  onSelectionChange,
}: ResultsMatrixProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);
  const checkboxRef = useRef<HTMLInputElement>(null);
  const headingId = useId();

  const connectionMap = buildConnectionMap(connections);

  // Notify parent when selection changes
  useEffect(() => {
    onSelectionChange(selectedIds);
  }, [selectedIds, onSelectionChange]);

  // Sync indeterminate state on the "select all" checkbox
  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate =
        selectedIds.size > 0 && selectedIds.size < companies.length;
    }
  }, [selectedIds, companies.length]);

  // Reset selection when companies list identity changes (new search result)
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — companies array identity as reset signal
  useEffect(() => {
    setSelectedIds(new Set());
    setAllSelected(false);
  }, [companies]);

  const toggleAll = useCallback(() => {
    if (allSelected) {
      setSelectedIds(new Set());
      setAllSelected(false);
    } else {
      setSelectedIds(new Set(companies.map((c) => c.id)));
      setAllSelected(true);
    }
  }, [allSelected, companies]);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (isLoading) {
    return <LoadingState />;
  }

  if (companies.length === 0) {
    return <EmptyState />;
  }

  return (
    <div style={{ width: '100%', height: '100%', overflowX: 'auto' }} aria-busy={isLoading}>
      {/* Result count header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <h2
          id={headingId}
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          Candidates Found{' '}
          <span
            style={{
              marginLeft: '6px',
              fontSize: '13px',
              fontWeight: 400,
              color: '#9ca3af',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            ({companies.length})
          </span>
        </h2>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: '#10b981',
          }}
        >
          <DedupeIcon />
          Deduplication active
        </div>
      </div>

      <table
        aria-labelledby={headingId}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          minWidth: '700px',
          fontSize: '13px',
        }}
      >
        <thead>
          <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <th
              style={{
                width: '44px',
                padding: '10px 12px',
                textAlign: 'center',
              }}
            >
              <input
                ref={checkboxRef}
                type="checkbox"
                aria-label="Select all companies"
                checked={allSelected}
                onChange={toggleAll}
                style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#10b981' }}
              />
            </th>
            <th style={TH_STYLE}>Company</th>
            <th style={TH_STYLE}>Source</th>
            <th style={TH_STYLE}>Sector</th>
            <th style={TH_STYLE}>Domain</th>
            <th style={{ ...TH_STYLE, width: '44px' }}></th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company, idx) => (
            <CompanyRow
              key={company.id}
              company={company}
              index={idx}
              connectionMap={connectionMap}
              isSelected={selectedIds.has(company.id)}
              onToggle={() => toggleRow(company.id)}
              onOpenDetail={() => onOpenDetail(company.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CompanyRow
// ---------------------------------------------------------------------------

interface CompanyRowProps {
  company: WorkspaceCompany;
  index: number;
  connectionMap: Map<string, string>;
  isSelected: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
}

function CompanyRow({
  company,
  index,
  connectionMap,
  isSelected,
  onToggle,
  onOpenDetail,
}: CompanyRowProps) {
  const { bg, color } = avatarColor(company.name);
  const abbr = initials(company.name);

  // Resolve source badge labels from real connection rows (AC-BADGE)
  const sourceBadges: string[] = [];
  for (const connId of company.connectionIds) {
    const name = connectionMap.get(connId);
    if (name && !sourceBadges.includes(name)) {
      sourceBadges.push(name);
    }
  }

  return (
    <tr
      style={{
        borderBottom: '1px solid #f3f4f6',
        backgroundColor: isSelected ? '#f0fdf4' : '#ffffff',
        transition: 'background-color 150ms ease',
        animation: `fadeInRow 0.3s ease ${index * 40}ms both`,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f9fafb';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#ffffff';
      }}
    >
      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Checkbox */}
      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
        <input
          type="checkbox"
          aria-label={`Select ${company.name}`}
          checked={isSelected}
          onChange={onToggle}
          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#10b981' }}
        />
      </td>

      {/* Company name + avatar */}
      <td style={{ padding: '10px 16px', minWidth: '180px' }}>
        <button
          type="button"
          aria-label={`View details for ${company.name}`}
          onClick={onOpenDetail}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontWeight: 600,
            color: '#111827',
            fontSize: '13px',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#10b981';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#111827';
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
              backgroundColor: bg,
              color,
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {abbr}
          </span>
          {company.name}
        </button>
      </td>

      {/* Source badges — AC-BADGE: from real connection displayName */}
      <td style={{ padding: '10px 16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {sourceBadges.length > 0 ? (
            sourceBadges.map((name) => <SourceBadge key={name} displayName={name} />)
          ) : (
            <span style={{ fontSize: '11px', color: '#d1d5db' }}>—</span>
          )}
        </div>
      </td>

      {/* Sector */}
      <td
        style={{
          padding: '10px 16px',
          color: '#4b5563',
          maxWidth: '160px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={company.sector ?? ''}
      >
        {company.sector ?? <span style={{ color: '#d1d5db' }}>—</span>}
      </td>

      {/* Domain */}
      <td
        style={{
          padding: '10px 16px',
          color: '#6b7280',
          maxWidth: '140px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontVariantNumeric: 'tabular-nums',
        }}
        title={company.domain ?? ''}
      >
        {company.domain ?? <span style={{ color: '#d1d5db' }}>—</span>}
      </td>

      {/* Quick view button */}
      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
        <button
          type="button"
          aria-label={`Quick view ${company.name}`}
          onClick={onOpenDetail}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: '#9ca3af',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px',
            transition: 'color 150ms ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#10b981';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = '#9ca3af';
          }}
        >
          <EyeIcon />
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Empty / Loading states
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        gap: '12px',
        color: '#9ca3af',
        textAlign: 'center',
      }}
    >
      <svg
        aria-hidden="true"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d1d5db"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#374151' }}>
        No companies found
      </p>
      <p style={{ margin: 0, fontSize: '13px' }}>
        Try a different search term or sync a data source.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      aria-live="polite"
      aria-busy="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 24px',
        gap: '12px',
        color: '#9ca3af',
        textAlign: 'center',
      }}
    >
      <svg
        aria-hidden="true"
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animation: 'spin 0.8s linear infinite' }}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </svg>
      <p style={{ margin: 0, fontSize: '14px', color: '#374151', fontWeight: 500 }}>
        Querying data sources…
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline icons
// ---------------------------------------------------------------------------

const TH_STYLE: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#6b7280',
  whiteSpace: 'nowrap',
};

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DedupeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
