/**
 * AuditLogTable — filterable, sortable, paginated audit log table.
 *
 * SSR-hydrated: receives `initialEntries` from the server component; no
 * client fetch on first render. Filter/pagination changes fetch from the
 * non-page-colliding proxy path `/compliance/audit-log-data` (afterFiles
 * rewrite → GET /compliance/audit-log on the API).
 *
 * Column schema (from AuditLogEntryRead):
 *   Timestamp (UTC)   — createdAt (string, timestamp DESC default)
 *   Event Type         — action (pill color-coded by event family)
 *   Actor              — actorRole + actorUserId (truncated)
 *   Resource           — resourceType + resourceId (truncated)
 *   Integrity Hash     — entryHash (truncated to 8+4 chars)
 *
 * Filter bar:
 *   Event Type (text select — common families)
 *   From date / To date (date inputs)
 *   Actor (UUID text input)
 *   Mandate (UUID text input)
 *   [Apply] [Reset]
 *
 * Pagination: prev/next based on page size (limit 50). No cursor/total
 * returned by API — next page disabled when response length < limit.
 *
 * READ-ONLY BOUNDARY:
 *   - NO edit/delete affordance on any row.
 *   - NO send/compose/email/AI affordance anywhere.
 *   - Table rows are display-only (no action menus).
 *
 * WCAG 2.2: keyboard-navigable filters, visible focus rings, role="status"
 * for loading state.
 *
 * Design: design/audit-log-export.html (pane 1 + pane 2).
 * Tokens: zinc/emerald DESIGN-SYSTEM palette; 4px grid.
 */

'use client';

import type { AuditLogEntryRead } from '@dealflow/shared';
import { auditLogEntryReadSchema } from '@dealflow/shared';
import { useCallback, useState } from 'react';
import { z } from 'zod';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const EVENT_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'outreach-compose', label: 'Outreach Compose' },
  { value: 'send', label: 'Send' },
  { value: 'gate-evaluate', label: 'Compliance Check' },
  { value: 'approve', label: 'Approval' },
  { value: 'mandate-create', label: 'Mandate Create' },
  { value: 'mandate-configure', label: 'Mandate Configure' },
  { value: 'pipeline-enroll', label: 'Pipeline Enroll' },
  { value: 'pipeline-transition', label: 'Pipeline Stage' },
  { value: 'pipeline-note', label: 'Pipeline Note' },
  { value: 'rule-change', label: 'Rule Update' },
  { value: 'suppression-change', label: 'Suppression' },
  { value: 'export_generated', label: 'Export Generated' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Event-type pill style based on action family. */
function pillStyle(action: string): React.CSSProperties {
  if (action.startsWith('outreach') || action === 'send' || action === 'compose') {
    return { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' };
  }
  if (action === 'gate-evaluate' || action === 'approve' || action === 'suppress') {
    return { backgroundColor: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' };
  }
  if (action === 'mandate-create' || action === 'mandate-configure') {
    return { backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#D1FAE5' };
  }
  if (action.startsWith('pipeline')) {
    return { backgroundColor: '#F3F4F6', color: '#374151', borderColor: '#D1D5DB' };
  }
  if (action === 'export_generated') {
    return { backgroundColor: '#F5F3FF', color: '#6D28D9', borderColor: '#DDD6FE' };
  }
  return { backgroundColor: '#F3F4F6', color: '#6B7280', borderColor: '#E5E7EB' };
}

/** Truncate hash for display (show first 8 + "..." + last 4). */
function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
}

/** Format createdAt string as readable timestamp. */
function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    // ISO format: YYYY-MM-DD HH:MM:SS UTC
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return ts;
  }
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

interface FilterState {
  type: string;
  from: string;
  to: string;
  actor: string;
  mandateId: string;
}

const EMPTY_FILTER: FilterState = {
  type: '',
  from: '',
  to: '',
  actor: '',
  mandateId: '',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AuditLogTableProps {
  /** SSR-hydrated initial entries (first page, timestamp DESC). */
  initialEntries: AuditLogEntryRead[];
  initialFrom?: string | undefined;
  initialTo?: string | undefined;
  initialMandateId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AuditLogTable({
  initialEntries,
  initialFrom,
  initialTo,
  initialMandateId,
}: AuditLogTableProps) {
  const [entries, setEntries] = useState<AuditLogEntryRead[]>(initialEntries);
  const [filter, setFilter] = useState<FilterState>({
    ...EMPTY_FILTER,
    from: initialFrom ?? '',
    to: initialTo ?? '',
    mandateId: initialMandateId ?? '',
  });
  const [pendingFilter, setPendingFilter] = useState<FilterState>({
    ...EMPTY_FILTER,
    from: initialFrom ?? '',
    to: initialTo ?? '',
    mandateId: initialMandateId ?? '',
  });
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialEntries.length === PAGE_SIZE);

  // ── Fetch entries ────────────────────────────────────────────────────────

  const fetchEntries = useCallback(async (f: FilterState, off: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(off));
      if (f.type) params.set('type', f.type);
      if (f.from) params.set('from', f.from);
      if (f.to) params.set('to', f.to);
      if (f.actor) params.set('actor', f.actor);
      if (f.mandateId) params.set('mandateId', f.mandateId);

      // Non-page-colliding proxy: /compliance/audit-log-data → API GET /compliance/audit-log
      const res = await apiFetch(`/compliance/audit-log-data?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setEntries([]);
        setHasMore(false);
        return;
      }
      const raw: unknown = await res.json();
      const parsed = z.array(auditLogEntryReadSchema).safeParse(raw);
      const rows = parsed.success ? parsed.data : [];
      setEntries(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setEntries([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setFilter(pendingFilter);
    setOffset(0);
    void fetchEntries(pendingFilter, 0);
  }, [pendingFilter, fetchEntries]);

  const handleReset = useCallback(() => {
    const reset = { ...EMPTY_FILTER };
    setPendingFilter(reset);
    setFilter(reset);
    setOffset(0);
    void fetchEntries(reset, 0);
  }, [fetchEntries]);

  const handlePrev = useCallback(() => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    void fetchEntries(filter, newOffset);
  }, [filter, offset, fetchEntries]);

  const handleNext = useCallback(() => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    void fetchEntries(filter, newOffset);
  }, [filter, offset, fetchEntries]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Audit log entries"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      {/* biome-ignore lint/a11y/useSemanticElements: <search> semantic element not universally supported in this codebase's JSX pattern */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'flex-end',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
        role="search"
        aria-label="Filter audit log"
      >
        {/* Event Type select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="audit-filter-type"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Event type
          </label>
          <select
            id="audit-filter-type"
            value={pendingFilter.type}
            onChange={(e) => setPendingFilter((p) => ({ ...p, type: e.target.value }))}
            style={{
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#374151',
              backgroundColor: '#fff',
              cursor: 'pointer',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* From date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="audit-filter-from"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            From
          </label>
          <input
            id="audit-filter-from"
            type="date"
            value={pendingFilter.from ? pendingFilter.from.slice(0, 10) : ''}
            onChange={(e) =>
              setPendingFilter((p) => ({
                ...p,
                from: e.target.value ? `${e.target.value}T00:00:00Z` : '',
              }))
            }
            style={{
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#374151',
              backgroundColor: '#fff',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* To date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="audit-filter-to"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            To
          </label>
          <input
            id="audit-filter-to"
            type="date"
            value={pendingFilter.to ? pendingFilter.to.slice(0, 10) : ''}
            onChange={(e) =>
              setPendingFilter((p) => ({
                ...p,
                to: e.target.value ? `${e.target.value}T23:59:59Z` : '',
              }))
            }
            style={{
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#374151',
              backgroundColor: '#fff',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Actor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="audit-filter-actor"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Actor
          </label>
          <input
            id="audit-filter-actor"
            type="text"
            placeholder="User UUID"
            value={pendingFilter.actor}
            onChange={(e) => setPendingFilter((p) => ({ ...p, actor: e.target.value }))}
            style={{
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#374151',
              backgroundColor: '#fff',
              outline: 'none',
              width: '160px',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Mandate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="audit-filter-mandate"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Mandate
          </label>
          <input
            id="audit-filter-mandate"
            type="text"
            placeholder="Mandate UUID"
            value={pendingFilter.mandateId}
            onChange={(e) => setPendingFilter((p) => ({ ...p, mandateId: e.target.value }))}
            style={{
              padding: '6px 8px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#374151',
              backgroundColor: '#fff',
              outline: 'none',
              width: '160px',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Apply / Reset */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', paddingBottom: '1px' }}>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset all filters"
            style={{
              padding: '6px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#fff',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleApply}
            aria-label="Apply filters"
            style={{
              padding: '6px 14px',
              border: '1px solid transparent',
              borderRadius: '6px',
              backgroundColor: '#111827',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* ── Loading status ─────────────────────────────────────────────── */}
      {loading && (
        <div
          role="status"
          aria-label="Loading audit log entries"
          style={{
            padding: '8px 16px',
            fontSize: '12px',
            color: '#6b7280',
            backgroundColor: '#fafafa',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          Loading…
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            lineHeight: '20px',
          }}
          aria-label="Audit log entries table"
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#fff',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              {(
                ['Timestamp (UTC)', 'Event Type', 'Actor', 'Resource', 'Integrity Hash'] as const
              ).map((col) => (
                <th
                  key={col}
                  scope="col"
                  style={{
                    padding: '10px 12px',
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
            {entries.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: '32px 16px',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '14px',
                  }}
                >
                  No audit entries match the current filters.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr
                  key={entry.sequenceNumber}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    transition: 'background-color 100ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '';
                  }}
                >
                  {/* Timestamp */}
                  <td
                    style={{
                      padding: '12px 12px',
                      verticalAlign: 'top',
                      whiteSpace: 'nowrap',
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '12px',
                      color: '#4b5563',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatTs(entry.createdAt)}
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      seq #{entry.sequenceNumber}
                    </div>
                  </td>

                  {/* Event Type pill */}
                  <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                    <span
                      data-testid={`event-type-pill-${entry.sequenceNumber}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        border: '1px solid transparent',
                        whiteSpace: 'nowrap',
                        ...pillStyle(entry.action),
                      }}
                    >
                      {entry.action}
                    </span>
                  </td>

                  {/* Actor */}
                  <td style={{ padding: '12px 12px', verticalAlign: 'top', maxWidth: '140px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#1f2937',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.actorRole}
                    </div>
                    {entry.actorUserId && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#9ca3af',
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={entry.actorUserId}
                      >
                        {entry.actorUserId.slice(0, 8)}…
                      </div>
                    )}
                  </td>

                  {/* Resource */}
                  <td style={{ padding: '12px 12px', verticalAlign: 'top', maxWidth: '180px' }}>
                    <div style={{ fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {entry.resourceType}
                    </div>
                    {entry.resourceId && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: '#9ca3af',
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={entry.resourceId}
                      >
                        {entry.resourceId.slice(0, 8)}…
                      </div>
                    )}
                  </td>

                  {/* Integrity Hash */}
                  <td
                    style={{
                      padding: '12px 12px',
                      verticalAlign: 'top',
                      textAlign: 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '11px',
                          color: '#6b7280',
                        }}
                        title={entry.entryHash}
                      >
                        {truncateHash(entry.entryHash)}
                      </span>
                      {/* Shield check — immutable integrity indicator */}
                      <svg
                        aria-hidden="true"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        <polyline points="9 12 11 14 15 10" />
                      </svg>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderTop: '1px solid #f3f4f6',
          backgroundColor: '#fafafa',
          fontSize: '12px',
          color: '#6b7280',
        }}
      >
        <span>
          {entries.length > 0 ? `Showing ${offset + 1}–${offset + entries.length}` : 'No results'}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={handlePrev}
            disabled={offset === 0 || loading}
            aria-label="Previous page"
            style={{
              padding: '4px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: offset === 0 || loading ? '#f9fafb' : '#fff',
              color: offset === 0 || loading ? '#9ca3af' : '#374151',
              fontSize: '12px',
              fontWeight: 500,
              cursor: offset === 0 || loading ? 'not-allowed' : 'pointer',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (!(e.currentTarget as HTMLButtonElement).disabled)
                e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!hasMore || loading}
            aria-label="Next page"
            style={{
              padding: '4px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: !hasMore || loading ? '#f9fafb' : '#fff',
              color: !hasMore || loading ? '#9ca3af' : '#374151',
              fontSize: '12px',
              fontWeight: 500,
              cursor: !hasMore || loading ? 'not-allowed' : 'pointer',
              outline: 'none',
            }}
            onFocus={(e) => {
              if (!(e.currentTarget as HTMLButtonElement).disabled)
                e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
