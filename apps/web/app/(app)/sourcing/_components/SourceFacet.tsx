/**
 * SourceFacet — filter by connection (data source).
 *
 * Renders per-connection facet buttons with company counts from the real
 * data_source_connections rows. The ≥2-source view becomes real once ≥2
 * connections exist (created via AddConnectionForm + POST /sourcing/connections).
 *
 * Design: design/sourcing-workspace.html left sidebar filter pattern, §10 tokens.
 * AC-BADGE: counts and labels come from real connection rows, not literals.
 *
 * Accessibility: role=group, labeled buttons, keyboard-operable.
 */

'use client';

import type { ConnectionWithCount } from '../_lib/workspace-types';

interface SourceFacetProps {
  connections: ConnectionWithCount[];
  activeSource: string | null;
  onSourceChange: (sourceId: string | null) => void;
}

export function SourceFacet({ connections, activeSource, onSourceChange }: SourceFacetProps) {
  const totalCompanies = connections.reduce((sum, c) => sum + c.companyCount, 0);

  return (
    <fieldset
      aria-label="Filter companies by source"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        border: 'none',
        padding: 0,
        margin: 0,
      }}
    >
      <legend
        style={{
          margin: '0 0 8px',
          padding: 0,
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: '#9ca3af',
          float: 'left',
          width: '100%',
        }}
      >
        Source Filter
      </legend>

      {/* All sources */}
      <FacetButton
        label="All Sources"
        count={totalCompanies}
        isActive={activeSource === null}
        onClick={() => onSourceChange(null)}
      />

      {/* Per-connection facets (the ≥2-source view) */}
      {connections.map((conn) => (
        <FacetButton
          key={conn.id}
          label={conn.displayName}
          count={conn.companyCount}
          isActive={activeSource === conn.id}
          onClick={() => onSourceChange(conn.id)}
        />
      ))}

      {connections.length === 0 && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: '12px',
            color: '#9ca3af',
            fontStyle: 'italic',
            lineHeight: '1.5',
          }}
        >
          Add a data source to enable filtering.
        </p>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// FacetButton
// ---------------------------------------------------------------------------

interface FacetButtonProps {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}

function FacetButton({ label, count, isActive, onClick }: FacetButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      aria-label={`Filter by ${label} — ${count} companies`}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '6px 10px',
        borderRadius: '6px',
        border: '1px solid',
        borderColor: isActive ? '#10b981' : 'transparent',
        backgroundColor: isActive ? '#ecfdf5' : 'transparent',
        color: isActive ? '#047857' : '#374151',
        fontSize: '13px',
        fontWeight: isActive ? 600 : 400,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 150ms ease',
        outline: 'none',
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 2px rgba(16,185,129,0.25)';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f9fafb';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
        }
      }}
    >
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginRight: '6px',
        }}
      >
        {label}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontSize: '11px',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: isActive ? '#047857' : '#9ca3af',
          backgroundColor: isActive ? '#d1fae5' : '#f3f4f6',
          padding: '1px 5px',
          borderRadius: '10px',
        }}
      >
        {count}
      </span>
    </button>
  );
}
