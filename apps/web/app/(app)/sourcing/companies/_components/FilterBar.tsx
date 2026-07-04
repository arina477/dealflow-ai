/**
 * FilterBar — filter chip strip for the companies list.
 *
 * Renders filter pills: status (all / active / archived) and duplicates-only.
 * Design tokens: §10 zinc/emerald.
 */

'use client';

import { useCallback } from 'react';

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function chipStyle(active: boolean, danger = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    borderRadius: '9999px',
    border: `1px solid ${active ? (danger ? '#fecaca' : '#d1fae5') : '#e5e7eb'}`,
    backgroundColor: active ? (danger ? '#fff1f2' : '#ecfdf5') : '#f9fafb',
    padding: '4px 12px',
    fontSize: '13px',
    fontWeight: 500,
    color: active ? (danger ? '#b91c1c' : '#047857') : '#374151',
    cursor: 'pointer',
    outline: 'none',
    whiteSpace: 'nowrap' as const,
    transition: 'background-color 150ms ease, border-color 150ms ease, color 150ms ease',
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FilterBarProps {
  statusFilter: 'all' | 'active' | 'archived';
  onStatusChange: (v: 'all' | 'active' | 'archived') => void;
  showDuplicatesOnly: boolean;
  onDuplicatesOnlyChange: (v: boolean) => void;
  duplicateCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilterBar({
  statusFilter,
  onStatusChange,
  showDuplicatesOnly,
  onDuplicatesOnlyChange,
  duplicateCount,
}: FilterBarProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, action: () => void) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      }
    },
    []
  );

  return (
    <fieldset
      aria-label="Filter companies"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '2px',
        border: 'none',
        margin: 0,
        padding: 0,
      }}
    >
      <legend
        className="sr-only"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        Filter companies
      </legend>
      {/* Status: All */}
      <button
        type="button"
        aria-pressed={statusFilter === 'all'}
        aria-label="Show all companies"
        onClick={() => onStatusChange('all')}
        onKeyDown={(e) => handleKeyDown(e, () => onStatusChange('all'))}
        style={chipStyle(statusFilter === 'all')}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 0 2px rgb(16 185 129 / 0.3)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        All
      </button>

      {/* Status: Active */}
      <button
        type="button"
        aria-pressed={statusFilter === 'active'}
        aria-label="Show active companies only"
        onClick={() => onStatusChange('active')}
        onKeyDown={(e) => handleKeyDown(e, () => onStatusChange('active'))}
        style={chipStyle(statusFilter === 'active')}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 0 2px rgb(16 185 129 / 0.3)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        Active
      </button>

      {/* Status: Archived */}
      <button
        type="button"
        aria-pressed={statusFilter === 'archived'}
        aria-label="Show archived companies only"
        onClick={() => onStatusChange('archived')}
        onKeyDown={(e) => handleKeyDown(e, () => onStatusChange('archived'))}
        style={chipStyle(statusFilter === 'archived')}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            '0 0 0 2px rgb(16 185 129 / 0.3)';
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        Archived
      </button>

      {/* Duplicates filter */}
      {duplicateCount > 0 && (
        <button
          type="button"
          aria-pressed={showDuplicatesOnly}
          aria-label={`Show duplicate-risk companies only — ${duplicateCount} pending`}
          onClick={() => onDuplicatesOnlyChange(!showDuplicatesOnly)}
          onKeyDown={(e) => handleKeyDown(e, () => onDuplicatesOnlyChange(!showDuplicatesOnly))}
          style={chipStyle(showDuplicatesOnly, true)}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 0 0 2px rgba(185 28 28 / 0.3)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          <svg
            aria-hidden="true"
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Duplicates ({duplicateCount})
        </button>
      )}
    </fieldset>
  );
}
