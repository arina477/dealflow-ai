/**
 * WorkspaceClient — top-level client wrapper for the sourcing workspace.
 *
 * Composes: SearchBar + SourceFacet + ResultsMatrix + DetailDrawer +
 *           SyncTrigger + AddConnectionForm + floating Review-Import CTA.
 *
 * Design: design/sourcing-workspace.html (zinc/emerald palette, §10 AppShell).
 * AC-BADGE: badges rendered from real connection.displayName, NOT literal
 *           provider names from the design mock.
 * AC-CTA:   Review & Import → /sourcing/companies (hand-off), NOT in-page modal.
 */

'use client';

import { useCallback, useState } from 'react';
import type { ConnectionWithCount, WorkspaceCompany } from '../_lib/workspace-types';
import { AddConnectionForm } from './AddConnectionForm';
import { DetailDrawer } from './DetailDrawer';
import { ResultsMatrix } from './ResultsMatrix';
import { SearchBar } from './SearchBar';
import { SourceFacet } from './SourceFacet';
import { SyncTrigger } from './SyncTrigger';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorkspaceClientProps {
  initialConnections: ConnectionWithCount[];
  initialCompanies: WorkspaceCompany[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspaceClient({ initialConnections, initialCompanies }: WorkspaceClientProps) {
  const [connections, setConnections] = useState<ConnectionWithCount[]>(initialConnections);
  const [companies, setCompanies] = useState<WorkspaceCompany[]>(initialCompanies);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Search handler ────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (q: string, sourceId: string | null) => {
    setIsSearching(true);
    try {
      const url = new URL('/sourcing/companies', window.location.origin);
      if (q) url.searchParams.set('q', q);
      if (sourceId) url.searchParams.set('source', sourceId);
      const res = await fetch(url.toString(), {
        credentials: 'include',
        headers: { rid: 'anti-csrf' },
      });
      if (res.ok) {
        const data = (await res.json()) as { companies?: unknown[] };
        const rows = (data.companies ?? []) as WorkspaceCompany[];
        setCompanies(rows);
      }
    } catch {
      // Keep current companies on error
    } finally {
      setIsSearching(false);
    }
  }, []);

  // ── Source facet change ───────────────────────────────────────────────────

  const handleSourceChange = useCallback(
    (sourceId: string | null) => {
      setActiveSource(sourceId);
      void handleSearch(query, sourceId);
    },
    [query, handleSearch]
  );

  // ── Query change ──────────────────────────────────────────────────────────

  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      void handleSearch(q, activeSource);
    },
    [activeSource, handleSearch]
  );

  // ── Sync complete ─────────────────────────────────────────────────────────

  const handleSyncComplete = useCallback(
    (connectionId: string, ingested: number) => {
      // Refresh company list and update connection company count
      void handleSearch(query, activeSource);
      setConnections((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, companyCount: c.companyCount + ingested } : c
        )
      );
    },
    [query, activeSource, handleSearch]
  );

  // ── Connection created ────────────────────────────────────────────────────

  const handleConnectionCreated = useCallback((conn: ConnectionWithCount) => {
    setConnections((prev) => [...prev, conn]);
  }, []);

  // ── Row selection (for Review-Import CTA) ─────────────────────────────────

  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids);
  }, []);

  // ── Detail drawer ─────────────────────────────────────────────────────────

  const handleOpenDetail = useCallback((id: string) => {
    setSelectedCompanyId(id);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedCompanyId(null);
  }, []);

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        height: 'calc(100vh - 57px)',
        margin: '-24px -32px',
        overflow: 'hidden',
        backgroundColor: '#fcfcfd',
        position: 'relative',
      }}
    >
      {/* Top area: connectors row + search bar */}
      <div
        style={{
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#ffffff',
          padding: '12px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        {/* Connectors row + Add connection */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#9ca3af',
              marginRight: '4px',
            }}
          >
            Connectors
          </span>

          {connections.length === 0 && (
            <span
              style={{
                fontSize: '12px',
                color: '#9ca3af',
                fontStyle: 'italic',
              }}
            >
              No connections yet — add one below
            </span>
          )}

          {connections.map((conn) => (
            <div
              key={conn.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ConnectorBadge connection={conn} />
              <SyncTrigger
                connectionId={conn.id}
                onSyncComplete={(ingested) => handleSyncComplete(conn.id, ingested)}
              />
            </div>
          ))}

          <AddConnectionForm onCreated={handleConnectionCreated} />
        </div>

        {/* Search bar */}
        <SearchBar query={query} onQueryChange={handleQueryChange} isSearching={isSearching} />
      </div>

      {/* Body: source facet (left) + results matrix (right) */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {/* Source facet sidebar */}
        <aside
          aria-label="Filter by source"
          style={{
            width: '220px',
            flexShrink: 0,
            borderRight: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <SourceFacet
            connections={connections}
            activeSource={activeSource}
            onSourceChange={handleSourceChange}
          />
        </aside>

        {/* Results matrix */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          <ResultsMatrix
            companies={companies}
            connections={connections}
            isLoading={isSearching}
            onOpenDetail={handleOpenDetail}
            onSelectionChange={handleSelectionChange}
          />
        </div>
      </div>

      {/* Detail drawer */}
      {selectedCompanyId && (
        <DetailDrawer
          companyId={selectedCompanyId}
          connections={connections}
          onClose={handleCloseDetail}
        />
      )}

      {/* Floating Review-Import action bar (AC-CTA → /sourcing/companies) */}
      <ReviewImportBar selectedCount={selectedIds.size} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ConnectorBadge — live pulse dot + displayName abbreviation
// ---------------------------------------------------------------------------

function ConnectorBadge({ connection }: { connection: ConnectionWithCount }) {
  // Abbreviate displayName: take first letters of each word, max 3 chars
  const abbr = connection.displayName
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 3);

  return (
    <div
      title={`${connection.displayName} — ${connection.companyCount} companies`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 8px',
        borderRadius: '4px',
        border: '1px solid',
        borderColor: connection.enabled ? 'rgba(16,185,129,0.3)' : '#e5e7eb',
        backgroundColor: connection.enabled ? '#ecfdf5' : '#ffffff',
        color: connection.enabled ? '#047857' : '#6b7280',
        fontSize: '11px',
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: connection.enabled ? '#10b981' : '#d1d5db',
          display: 'inline-block',
          flexShrink: 0,
          animation: connection.enabled ? 'pulse-dot 2s ease-in-out infinite' : 'none',
        }}
      />
      <span
        role="img"
        aria-label={`${connection.displayName}, ${connection.companyCount} companies`}
      >
        {abbr}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReviewImportBar — floating CTA (AC-CTA: → /sourcing/companies)
// ---------------------------------------------------------------------------

interface ReviewImportBarProps {
  selectedCount: number;
}

function ReviewImportBar({ selectedCount }: ReviewImportBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${selectedCount} candidates selected — Review and Import`}
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '12px 16px',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.08), 0 4px 24px rgba(0,0,0,0.12)',
        minWidth: '400px',
        maxWidth: '560px',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: '#ecfdf5',
          color: '#047857',
          fontWeight: 700,
          fontSize: '14px',
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {selectedCount}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: '14px', color: '#111827' }}>
          Candidates Selected
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
          Ready for deduplication review and import.
        </p>
      </div>
      {/* AC-CTA: → /sourcing/companies (the wave-6 dedupe review queue) */}
      <a
        href="/sourcing/companies"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 20px',
          borderRadius: '8px',
          backgroundColor: '#10b981',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 500,
          textDecoration: 'none',
          flexShrink: 0,
          transition: 'background-color 150ms ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#047857';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#10b981';
        }}
      >
        Review &amp; Import
        <ArrowRightIcon />
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline icon
// ---------------------------------------------------------------------------

function ArrowRightIcon() {
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
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}
