/**
 * DealActivityTable — filterable, paginated deal-activity browse table.
 *
 * Wave-29 B-3: deal-activity scope on the /compliance/audit-log page.
 *
 * API: GET /compliance/records/deal-activity (proxied via
 * /compliance/records-deal-activity-data — page-route-collision-safe).
 * RBAC: compliance/admin only (rendered only when the parent page passes
 * `canSeeDealActivity={true}`; advisor receives null from the server component
 * and never reaches this component).
 *
 * Columns (from DealActivityRow):
 *   Date (createdAt)       — ISO timestamp
 *   Counterpart/Seller      — mandateSellerName (nullable → "—")
 *   Stage                  — stage
 *   Deal Source Type       — dealSourceType (pill, color-coded by family)
 *   Created By             — createdBy (UUID, truncated)
 *
 * Filter bar:
 *   From date / To date (date inputs)
 *   Deal source type (text select)
 *   Mandate (UUID text input)
 *   [Apply] [Reset]
 *
 * Pagination: prev/next, limit 25, offset-based.
 * Total returned by API — next enabled when offset + rows.length < total.
 *
 * READ-ONLY BOUNDARY:
 *   - NO edit/delete affordance on any row.
 *   - NO send/compose/email/AI affordance anywhere.
 *   - Table rows are display-only (no action menus).
 *
 * WCAG 2.2: keyboard-navigable filters, visible focus rings, role="status"
 * for loading state, aria-live on the table region.
 *
 * Design tokens: reuse the AuditLogTable zinc/emerald palette + 4px grid.
 * No new design tokens are introduced.
 */

'use client';

import type { DealActivityBrowseResponse, DealActivityRow } from '@dealflow/shared';
import { dealActivityBrowseResponseSchema } from '@dealflow/shared';
import { useCallback, useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25;

const DEAL_SOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'match_candidate', label: 'Match Candidate' },
  { value: 'outreach', label: 'Outreach' },
  { value: 'manual', label: 'Manual' },
  { value: 'inbound', label: 'Inbound' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deal source type pill style based on type family. */
function sourcePillStyle(type: string): React.CSSProperties {
  if (type === 'match_candidate') {
    return { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' };
  }
  if (type === 'outreach') {
    return { backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#D1FAE5' };
  }
  if (type === 'manual') {
    return { backgroundColor: '#F3F4F6', color: '#374151', borderColor: '#D1D5DB' };
  }
  if (type === 'inbound') {
    return { backgroundColor: '#FEF3C7', color: '#B45309', borderColor: '#FDE68A' };
  }
  return { backgroundColor: '#F3F4F6', color: '#6B7280', borderColor: '#E5E7EB' };
}

/** Format createdAt string as readable timestamp — mirrors AuditLogTable.formatTs. */
function formatTs(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return ts;
  }
}

/** Truncate UUID for display (show first 8 + "…"). */
function truncateUuid(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 8)}…`;
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

interface FilterState {
  type: string;
  from: string;
  to: string;
  mandateId: string;
}

const EMPTY_FILTER: FilterState = {
  type: '',
  from: '',
  to: '',
  mandateId: '',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DealActivityTableProps {
  /** SSR-hydrated initial page (first page, createdAt DESC). */
  initialRows: DealActivityRow[];
  initialTotal: number;
  initialFrom?: string | undefined;
  initialTo?: string | undefined;
  initialMandateId?: string | undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DealActivityTable({
  initialRows,
  initialTotal,
  initialFrom,
  initialTo,
  initialMandateId,
}: DealActivityTableProps) {
  const [rows, setRows] = useState<DealActivityRow[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
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

  // ── Fetch rows ────────────────────────────────────────────────────────────

  const fetchRows = useCallback(async (f: FilterState, off: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(off));
      if (f.type) params.set('type', f.type);
      if (f.from) params.set('from', f.from);
      if (f.to) params.set('to', f.to);
      if (f.mandateId) params.set('mandateId', f.mandateId);

      // Non-page-colliding proxy: /compliance/records-deal-activity-data
      // → API GET /compliance/records/deal-activity
      const res = await apiFetch(`/compliance/records-deal-activity-data?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setRows([]);
        setTotal(0);
        return;
      }
      const raw: unknown = await res.json();
      const parsed = dealActivityBrowseResponseSchema.safeParse(raw);
      if (parsed.success) {
        setRows(parsed.data.rows);
        setTotal(parsed.data.total);
      } else {
        setRows([]);
        setTotal(0);
      }
    } catch {
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    setFilter(pendingFilter);
    setOffset(0);
    void fetchRows(pendingFilter, 0);
  }, [pendingFilter, fetchRows]);

  const handleReset = useCallback(() => {
    const reset = { ...EMPTY_FILTER };
    setPendingFilter(reset);
    setFilter(reset);
    setOffset(0);
    void fetchRows(reset, 0);
  }, [fetchRows]);

  const handlePrev = useCallback(() => {
    const newOffset = Math.max(0, offset - PAGE_SIZE);
    setOffset(newOffset);
    void fetchRows(filter, newOffset);
  }, [filter, offset, fetchRows]);

  const handleNext = useCallback(() => {
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    void fetchRows(filter, newOffset);
  }, [filter, offset, fetchRows]);

  const hasMore = offset + rows.length < total;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Deal activity entries"
      aria-live="polite"
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
        aria-label="Filter deal activity"
      >
        {/* Deal source type select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="deal-filter-type"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Deal source type
          </label>
          <select
            id="deal-filter-type"
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
            {DEAL_SOURCE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* From date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="deal-filter-from"
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
            id="deal-filter-from"
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
            htmlFor="deal-filter-to"
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
            id="deal-filter-to"
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

        {/* Mandate */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="deal-filter-mandate"
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
            id="deal-filter-mandate"
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
            aria-label="Reset all deal activity filters"
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
            aria-label="Apply deal activity filters"
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
          aria-label="Loading deal activity entries"
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
          aria-label="Deal activity entries table"
        >
          <thead>
            <tr
              style={{
                backgroundColor: '#fff',
                borderBottom: '1px solid #e5e7eb',
              }}
            >
              {(
                [
                  'Date (UTC)',
                  'Counterpart / Seller',
                  'Stage',
                  'Deal Source Type',
                  'Created By',
                ] as const
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
            {rows.length === 0 && !loading ? (
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
                  No deal activity entries match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.pipelineId}
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
                  {/* Date */}
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
                    {formatTs(row.createdAt)}
                  </td>

                  {/* Counterpart / Seller */}
                  <td
                    style={{
                      padding: '12px 12px',
                      verticalAlign: 'top',
                      maxWidth: '180px',
                    }}
                  >
                    {row.mandateSellerName ? (
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: '#1f2937',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={row.mandateSellerName}
                      >
                        {row.mandateSellerName}
                      </div>
                    ) : (
                      <span style={{ fontSize: '13px', color: '#9ca3af' }}>—</span>
                    )}
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
                      title={row.mandateId}
                    >
                      {truncateUuid(row.mandateId)}
                    </div>
                  </td>

                  {/* Stage */}
                  <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        color: '#374151',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.stage}
                    </div>
                  </td>

                  {/* Deal Source Type pill */}
                  <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                    <span
                      data-testid={`deal-source-type-pill-${row.pipelineId}`}
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
                        ...sourcePillStyle(row.dealSourceType),
                      }}
                    >
                      {row.dealSourceType}
                    </span>
                  </td>

                  {/* Created By */}
                  <td
                    style={{
                      padding: '12px 12px',
                      verticalAlign: 'top',
                      maxWidth: '140px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.createdBy}
                    >
                      {truncateUuid(row.createdBy)}
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
          {rows.length > 0
            ? `Showing ${offset + 1}–${offset + rows.length} of ${total}`
            : 'No results'}
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
