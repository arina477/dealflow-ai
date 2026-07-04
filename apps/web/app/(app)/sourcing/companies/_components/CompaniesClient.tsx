/**
 * CompaniesClient — interactive master-list panel for the companies screen.
 *
 * Renders the left-side master list (list + filter bar) per
 * design/companies-contacts.html. Clicking a company row navigates to the
 * detail panel (right pane or /sourcing/companies/:id).
 *
 * Design tokens: DESIGN-SYSTEM §10 (zinc/emerald). Inline styles match the
 * wave-5 compliance components convention (no Tailwind in .tsx).
 *
 * Accessibility:
 *   - Filter inputs are labeled.
 *   - Company rows are <button> elements with aria-pressed for selected state.
 *   - Source badge uses <abbr> with title.
 *   - Status badge uses aria-label with full status text.
 */

'use client';

import { useCallback, useState } from 'react';
import type { CompanyWithMeta } from '../page';
import { CompanyDetail } from './CompanyDetail';
import { FilterBar } from './FilterBar';

// ---------------------------------------------------------------------------
// Style primitives (§10 tokens)
// ---------------------------------------------------------------------------

const PANEL_STYLE: React.CSSProperties = {
  display: 'flex',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: '#fcfcfd',
};

const LIST_PANEL: React.CSSProperties = {
  width: '400px',
  minWidth: '320px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  borderRight: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  overflow: 'hidden',
};

const LIST_HEADER: React.CSSProperties = {
  padding: '16px',
  borderBottom: '1px solid #e5e7eb',
  backgroundColor: 'rgba(255,255,255,0.8)',
  position: 'sticky',
  top: 0,
  zIndex: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const DETAIL_PANEL: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  backgroundColor: '#fcfcfd',
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

type StatusKind = 'active' | 'archived' | 'duplicate';

function StatusBadge({ kind }: { kind: StatusKind }) {
  const config: Record<StatusKind, { label: string; bg: string; color: string; border: string }> = {
    active: {
      label: 'Active',
      bg: '#ecfdf5',
      color: '#047857',
      border: '#d1fae5',
    },
    archived: {
      label: 'Archived',
      bg: '#f3f4f6',
      color: '#6b7280',
      border: '#e5e7eb',
    },
    duplicate: {
      label: 'Duplicate Risk',
      bg: '#fff1f2',
      color: '#b91c1c',
      border: '#fecaca',
    },
  };
  const { label, bg, color, border } = config[kind];

  return (
    <span
      title={`Status: ${label}`}
      aria-label={`Status: ${label}`}
      role="img"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        borderRadius: '4px',
        padding: '2px 6px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Company row
// ---------------------------------------------------------------------------

interface CompanyRowProps {
  company: CompanyWithMeta;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function CompanyRow({ company, isSelected, onSelect }: CompanyRowProps) {
  const statusKind: StatusKind = company.hasPendingCandidates
    ? 'duplicate'
    : company.status === 'archived'
      ? 'archived'
      : 'active';

  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={`View ${company.name}`}
      onClick={() => onSelect(company.id)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '16px',
        backgroundColor: isSelected ? '#ffffff' : '#ffffff',
        borderLeft: `2px solid ${isSelected ? '#10b981' : 'transparent'}`,
        borderBottom: '1px solid #e5e7eb',
        cursor: 'pointer',
        outline: 'none',
        transition: 'background-color 150ms ease, border-color 150ms ease',
        display: 'block',
      }}
      onFocus={(e) => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
      }}
      onBlur={(e) => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ffffff';
      }}
      onMouseEnter={(e) => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ffffff';
      }}
    >
      {/* Row header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '6px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: '#111827',
            lineHeight: '20px',
            flex: 1,
            marginRight: '8px',
          }}
        >
          {company.name}
        </h3>
        <StatusBadge kind={statusKind} />
      </div>

      {/* Domain */}
      {company.domain && (
        <div
          style={{
            fontSize: '12px',
            color: '#6b7280',
            marginBottom: '8px',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {company.domain}
        </div>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {company.contactCount > 0 && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: '#9ca3af',
            }}
          >
            <ContactIcon />
            {company.contactCount} {company.contactCount === 1 ? 'contact' : 'contacts'}
          </span>
        )}
        {company.sourceCount > 0 && (
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: '#9ca3af',
            }}
          >
            <SourceIcon />
            {company.sourceCount} {company.sourceCount === 1 ? 'source' : 'sources'}
          </span>
        )}
        {company.hasPendingCandidates && (
          <span
            style={{
              fontSize: '12px',
              color: '#b91c1c',
              fontWeight: 500,
            }}
          >
            Pending dedupe review
          </span>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (lucide-style — no import needed, avoids bundle churn)
// ---------------------------------------------------------------------------

function ContactIcon() {
  return (
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SourceIcon() {
  return (
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
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9ca3af"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ query }: { query: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
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
        {query ? `No companies match "${query}"` : 'No companies yet'}
      </p>
      <p style={{ margin: 0, fontSize: '13px' }}>
        {query
          ? 'Try a different search term or clear the filters.'
          : 'Companies appear here once data sources are synced.'}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CompaniesClientProps {
  initialCompanies: CompanyWithMeta[];
}

export function CompaniesClient({ initialCompanies }: CompaniesClientProps) {
  const [companies, setCompanies] = useState<CompanyWithMeta[]>(initialCompanies);
  const [selectedId, setSelectedId] = useState<string | null>(initialCompanies[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);

  // Filter companies based on active filters
  const filtered = companies.filter((c) => {
    if (query) {
      const q = query.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchDomain = c.domain?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchDomain) return false;
    }
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    if (showDuplicatesOnly && !c.hasPendingCandidates) return false;
    return true;
  });

  const selectedCompany = filtered.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  // When a dedupe candidate is resolved, update the company's hasPendingCandidates state
  const handleCandidateResolved = useCallback((companyId: string, hasPending: boolean) => {
    setCompanies((prev) =>
      prev.map((c) => (c.id === companyId ? { ...c, hasPendingCandidates: hasPending } : c))
    );
  }, []);

  const pendingCount = companies.filter((c) => c.hasPendingCandidates).length;

  return (
    <div style={PANEL_STYLE}>
      {/* ── Left: Master list ── */}
      <aside style={LIST_PANEL} aria-label="Companies list">
        {/* Header */}
        <div style={LIST_HEADER}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#111827',
                  letterSpacing: '-0.01em',
                }}
              >
                Companies
              </h1>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '12px',
                  color: '#6b7280',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {companies.length} records
                {pendingCount > 0 && (
                  <span
                    style={{
                      marginLeft: '8px',
                      color: '#b91c1c',
                      fontWeight: 500,
                    }}
                  >
                    · {pendingCount} need review
                  </span>
                )}
              </p>
            </div>
            {/* +Add button is OUT OF SCOPE per wave-6 plan — omitted */}
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
              }}
            >
              <SearchIcon />
            </span>
            <input
              type="search"
              aria-label="Search companies by name or domain"
              placeholder="Search name or domain…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                paddingLeft: '36px',
                paddingRight: '12px',
                borderRadius: '6px',
                border: '1px solid #d1d5db',
                backgroundColor: '#ffffff',
                fontSize: '14px',
                color: '#111827',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 150ms ease, box-shadow 150ms ease',
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = '#10b981';
                (e.currentTarget as HTMLInputElement).style.boxShadow =
                  '0 0 0 2px rgb(16 185 129 / 0.2)';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db';
                (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Filter bar */}
          <FilterBar
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            showDuplicatesOnly={showDuplicatesOnly}
            onDuplicatesOnlyChange={setShowDuplicatesOnly}
            duplicateCount={pendingCount}
          />
        </div>

        {/* Scrollable list */}
        <ul
          aria-label="Company entries"
          style={{ flex: 1, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}
        >
          {filtered.length === 0 ? (
            <li>
              <EmptyState query={query} />
            </li>
          ) : (
            filtered.map((company) => (
              <li key={company.id} style={{ listStyle: 'none' }}>
                <CompanyRow
                  company={company}
                  isSelected={selectedCompany?.id === company.id}
                  onSelect={setSelectedId}
                />
              </li>
            ))
          )}
        </ul>
      </aside>

      {/* ── Right: Detail pane ── */}
      <div style={DETAIL_PANEL}>
        {selectedCompany ? (
          <CompanyDetail
            companyId={selectedCompany.id}
            companyName={selectedCompany.name}
            {...(selectedCompany.domain != null ? { companyDomain: selectedCompany.domain } : {})}
            onCandidateResolved={handleCandidateResolved}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af',
              gap: '12px',
              textAlign: 'center',
              padding: '48px',
            }}
          >
            <svg
              aria-hidden="true"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d1d5db"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
            <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#374151' }}>
              Select a company
            </p>
            <p style={{ margin: 0, fontSize: '13px' }}>
              Choose a company from the list to view its details.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
