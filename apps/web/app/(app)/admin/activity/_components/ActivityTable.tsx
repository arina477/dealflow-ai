/**
 * ActivityTable — read-only admin activity log table.
 *
 * Mirrors the /compliance/audit-log AuditLogTable layout (wave-13 pattern).
 * Columns: Actor | Target | Action | Timestamp  (4 columns per B-1 row shape).
 *
 * SSR-hydrated from the page server component. Filter/pagination changes
 * fetch from /admin/activity-data proxy (non-page-colliding).
 *
 * Pagination: cursor-based by sequenceNumber (newest-first; cursor = last row's
 * sequenceNumber; present in row but NOT displayed per P-4 Finding 3 — no
 * internal chain cursor exposed in UI).
 *
 * SECURITY INVARIANT (P-4 Finding 3):
 *   - Admin-only gate is at the page level (server component).
 *   - Displays ONLY actor/target/action/timestamp — no hash, credential, PII
 *     beyond actor+target display identity.
 *   - Read-only: no edit/delete affordance.
 *
 * Design tokens: zinc/emerald DESIGN-SYSTEM palette; 4px grid.
 */

'use client';

import type { AdminActivityResponse, AdminActivityRow } from '@dealflow/shared';
import { adminActivityActionEnum, adminActivityResponseSchema } from '@dealflow/shared';
import { useCallback, useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const ACTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All actions' },
  { value: 'user-invite', label: 'User Invite' },
  { value: 'role-change', label: 'Role Change' },
  { value: 'deactivate', label: 'Deactivate' },
  { value: 'user-reactivate', label: 'Reactivate' },
  { value: 'workspace-settings-update', label: 'Settings Update' },
  { value: 'data-source-conn-upsert', label: 'Integration Upsert' },
  { value: 'data-source-conn-toggle', label: 'Integration Toggle' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Action pill colour — admin actions family. */
function actionPillStyle(action: string): React.CSSProperties {
  if (action === 'user-invite' || action === 'user-reactivate') {
    return { backgroundColor: '#ECFDF5', color: '#047857', borderColor: '#D1FAE5' };
  }
  if (action === 'deactivate') {
    return { backgroundColor: '#FEF2F2', color: '#991B1B', borderColor: '#FECACA' };
  }
  if (action === 'role-change') {
    return { backgroundColor: '#FEF3C7', color: '#92400E', borderColor: '#FDE68A' };
  }
  if (action === 'workspace-settings-update') {
    return { backgroundColor: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' };
  }
  if (action.startsWith('data-source')) {
    return { backgroundColor: '#F5F3FF', color: '#6D28D9', borderColor: '#DDD6FE' };
  }
  return { backgroundColor: '#F3F4F6', color: '#6B7280', borderColor: '#E5E7EB' };
}

/** Format ISO timestamp for display. */
function formatTs(ts: string): string {
  try {
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 19);
  } catch {
    return ts;
  }
}

/** Human-readable action label. */
function actionLabel(action: string): string {
  const found = ACTION_OPTIONS.find((o) => o.value === action);
  return found?.label ?? action;
}

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

interface FilterState {
  action: string;
  since: string;
  until: string;
}

const EMPTY_FILTER: FilterState = { action: '', since: '', until: '' };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ActivityTableProps {
  /** SSR-hydrated initial rows (first page, newest-first). */
  initialRows: AdminActivityRow[];
  /** Initial nextCursor from the server fetch (null = last page). */
  initialNextCursor: number | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityTable({ initialRows, initialNextCursor }: ActivityTableProps) {
  const [rows, setRows] = useState<AdminActivityRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<number | null>(initialNextCursor);
  // cursorStack tracks previous page cursors so we can go back.
  // Each entry is the cursor used to FETCH that page (null = first page).
  const [cursorStack, setCursorStack] = useState<Array<number | null>>([null]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTER);
  const [pendingFilter, setPendingFilter] = useState<FilterState>(EMPTY_FILTER);
  const [loading, setLoading] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchPage = useCallback(
    async (f: FilterState, cursor: number | null): Promise<AdminActivityResponse | null> => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        // Only set action if it's a valid enum value
        if (f.action && adminActivityActionEnum.options.includes(f.action as never)) {
          params.set('action', f.action);
        }
        if (f.since) params.set('since', f.since);
        if (f.until) params.set('until', f.until);
        if (cursor !== null) params.set('cursor', String(cursor));

        const res = await apiFetch(`/admin/activity-data?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return null;
        const raw: unknown = await res.json();
        const parsed = adminActivityResponseSchema.safeParse(raw);
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    const result = await fetchPage(pendingFilter, null);
    if (result) {
      setFilter(pendingFilter);
      setRows(result.rows);
      setNextCursor(result.nextCursor);
      setCursorStack([null]);
      setCurrentPageIdx(0);
    }
  }, [pendingFilter, fetchPage]);

  const handleReset = useCallback(async () => {
    const result = await fetchPage(EMPTY_FILTER, null);
    if (result) {
      setPendingFilter(EMPTY_FILTER);
      setFilter(EMPTY_FILTER);
      setRows(result.rows);
      setNextCursor(result.nextCursor);
      setCursorStack([null]);
      setCurrentPageIdx(0);
    }
  }, [fetchPage]);

  const handleNext = useCallback(async () => {
    if (nextCursor === null) return;
    const result = await fetchPage(filter, nextCursor);
    if (result) {
      setRows(result.rows);
      // Push the cursor we used to fetch this page onto the stack
      setCursorStack((prev) => [...prev, nextCursor]);
      setCurrentPageIdx((prev) => prev + 1);
      setNextCursor(result.nextCursor);
    }
  }, [filter, nextCursor, fetchPage]);

  const handlePrev = useCallback(async () => {
    if (currentPageIdx === 0) return;
    const prevIdx = currentPageIdx - 1;
    const prevCursor = cursorStack[prevIdx] ?? null;
    const result = await fetchPage(filter, prevCursor);
    if (result) {
      setRows(result.rows);
      setCursorStack((prev) => prev.slice(0, prevIdx + 1));
      setCurrentPageIdx(prevIdx);
      setNextCursor(result.nextCursor);
    }
  }, [filter, currentPageIdx, cursorStack, fetchPage]);

  const hasPrev = currentPageIdx > 0;
  const hasNext = nextCursor !== null;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Admin activity log"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      {/* biome-ignore lint/a11y/useSemanticElements: <search> not universally adopted in this codebase's JSX pattern */}
      <div
        role="search"
        aria-label="Filter activity log"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          alignItems: 'flex-end',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        {/* Action type select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="activity-filter-action"
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Action
          </label>
          <select
            id="activity-filter-action"
            value={pendingFilter.action}
            onChange={(e) => setPendingFilter((p) => ({ ...p, action: e.target.value }))}
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
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Since date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="activity-filter-since"
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
            id="activity-filter-since"
            type="date"
            value={pendingFilter.since ? pendingFilter.since.slice(0, 10) : ''}
            onChange={(e) =>
              setPendingFilter((p) => ({
                ...p,
                since: e.target.value ? `${e.target.value}T00:00:00.000Z` : '',
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

        {/* Until date */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="activity-filter-until"
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
            id="activity-filter-until"
            type="date"
            value={pendingFilter.until ? pendingFilter.until.slice(0, 10) : ''}
            onChange={(e) =>
              setPendingFilter((p) => ({
                ...p,
                until: e.target.value ? `${e.target.value}T23:59:59.999Z` : '',
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

        {/* Apply / Reset */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', paddingBottom: '1px' }}>
          <button
            type="button"
            onClick={() => void handleReset()}
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
            onClick={() => void handleApply()}
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

      {/* ── Loading status ────────────────────────────────────────────────── */}
      {loading && (
        <div
          role="status"
          aria-label="Loading activity entries"
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

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            lineHeight: '20px',
          }}
          aria-label="Admin activity entries table"
        >
          <thead>
            <tr style={{ backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb' }}>
              {(['Actor', 'Target', 'Action', 'Timestamp (UTC)'] as const).map((col) => (
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
                  colSpan={4}
                  style={{
                    padding: '48px 16px',
                    textAlign: 'center',
                    color: '#9ca3af',
                    fontSize: '14px',
                  }}
                >
                  No admin activity matches the current filters.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.sequenceNumber}
                  style={{ borderBottom: '1px solid #f3f4f6', transition: 'background-color 100ms' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '';
                  }}
                >
                  {/* Actor */}
                  <td style={{ padding: '12px 12px', verticalAlign: 'top', maxWidth: '180px' }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#1f2937',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.actor.email}
                    >
                      {row.actor.displayName}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#9ca3af',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.actor.email}
                    >
                      {row.actor.email}
                    </div>
                  </td>

                  {/* Target */}
                  <td style={{ padding: '12px 12px', verticalAlign: 'top', maxWidth: '180px' }}>
                    {row.target ? (
                      <>
                        <div
                          style={{
                            fontSize: '13px',
                            color: '#374151',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={row.target.email}
                        >
                          {row.target.displayName}
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#9ca3af',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={row.target.email}
                        >
                          {row.target.email}
                        </div>
                      </>
                    ) : (
                      <span style={{ color: '#d1d5db', fontSize: '12px' }}>—</span>
                    )}
                  </td>

                  {/* Action pill */}
                  <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                    <span
                      data-testid={`action-pill-${row.sequenceNumber}`}
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
                        ...actionPillStyle(row.action),
                      }}
                    >
                      {actionLabel(row.action)}
                    </span>
                  </td>

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
                    {formatTs(row.timestamp)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
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
        <span>{rows.length > 0 ? `Page ${currentPageIdx + 1}` : 'No results'}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => void handlePrev()}
            disabled={!hasPrev || loading}
            aria-label="Previous page"
            style={{
              padding: '4px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: !hasPrev || loading ? '#f9fafb' : '#fff',
              color: !hasPrev || loading ? '#9ca3af' : '#374151',
              fontSize: '12px',
              fontWeight: 500,
              cursor: !hasPrev || loading ? 'not-allowed' : 'pointer',
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
            onClick={() => void handleNext()}
            disabled={!hasNext || loading}
            aria-label="Next page"
            style={{
              padding: '4px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: !hasNext || loading ? '#f9fafb' : '#fff',
              color: !hasNext || loading ? '#9ca3af' : '#374151',
              fontSize: '12px',
              fontWeight: 500,
              cursor: !hasNext || loading ? 'not-allowed' : 'pointer',
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
