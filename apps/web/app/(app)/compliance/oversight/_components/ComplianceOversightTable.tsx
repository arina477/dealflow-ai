/**
 * ComplianceOversightTable — READ-ONLY oversight table for compliance/admin.
 *
 * Renders the outreach gate-outcome oversight surface: each outreach record with
 * its gate verdict (send_eligible / blocked + block reason), template version,
 * SoD/approver status, and mandate reference.
 *
 * HARD BOUNDARY (CRITICAL):
 *   - READ-ONLY: NO approve/reject/edit/delete/send/AI affordance.
 *   - Advisor role is excluded at the page level (server assertRole) and the
 *     component never renders for that role.
 *   - No mutations — this component only GETs outreach records.
 *
 * Client refresh: if a client-side reload is needed, fetch via
 *   /compliance/oversight-data?mandateId=...  (proxied to GET /outreach)
 *   with apiFetch (rid:anti-csrf). SSR already hydrates the initial data.
 *
 * Design references: design/audit-log-export.html + design/compliance-queue.html
 * Tokens: zinc/emerald/red palette, 4px grid (DESIGN-SYSTEM).
 *
 * WCAG 2.2: visible focus rings, accessible table headers, aria-live for
 * empty/loading states.
 */

'use client';

import type { GateVerdictRecord, Outreach } from '@dealflow/shared';
import { useCallback, useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComplianceOversightTableProps {
  /** SSR-hydrated outreach records. */
  initialRecords: Outreach[];
  /** Mandate filter pre-populated from deep-link (optional). */
  initialMandateId?: string | undefined;
}

type LoadStatus = 'idle' | 'loading' | 'error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the first block reason code from a gate verdict, if blocked.
 */
function blockReason(verdict: GateVerdictRecord): string | null {
  if (verdict.allowed) return null;
  const first = verdict.blocks[0];
  if (!first) return 'unknown';
  const code = (first as Record<string, unknown>).code;
  if (typeof code === 'string') return code;
  return 'unknown';
}

/**
 * Formats an ISO timestamp to a short locale string.
 */
function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Row status badge
// ---------------------------------------------------------------------------

function StatusBadge({ record }: { record: Outreach }) {
  const eligible = record.status === 'send_eligible';
  return (
    <span
      role="status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: '16px',
        backgroundColor: eligible ? '#d1fae5' : '#fee2e2',
        color: eligible ? '#065f46' : '#991b1b',
        whiteSpace: 'nowrap',
      }}
    >
      {eligible ? '✓ Send eligible' : '✗ Blocked'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComplianceOversightTable({
  initialRecords,
  initialMandateId,
}: ComplianceOversightTableProps) {
  const [records, setRecords] = useState<Outreach[]>(initialRecords);
  const [mandateFilter, setMandateFilter] = useState(initialMandateId ?? '');
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');

  // ── Client refresh (optional — SSR already hydrates initial data) ────────
  const refresh = useCallback(async () => {
    setLoadStatus('loading');
    try {
      const qs = new URLSearchParams();
      if (mandateFilter.trim()) qs.set('mandateId', mandateFilter.trim());
      const res = await apiFetch(
        `/compliance/oversight-data${qs.toString() ? `?${qs.toString()}` : ''}`
      );
      if (!res.ok) {
        setLoadStatus('error');
        return;
      }
      const raw: unknown = await res.json();
      // The GET /outreach response wraps in { outreach: [...] }
      const data = raw as { outreach?: Outreach[] };
      setRecords(Array.isArray(data.outreach) ? data.outreach : []);
      setLoadStatus('idle');
    } catch {
      setLoadStatus('error');
    }
  }, [mandateFilter]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      data-testid="compliance-oversight-table"
    >
      {/* ── Filter bar ─────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label
            htmlFor="oversight-mandate-filter"
            style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
          >
            Filter by mandate ID
          </label>
          <input
            id="oversight-mandate-filter"
            type="text"
            placeholder="UUID (optional)"
            value={mandateFilter}
            onChange={(e) => setMandateFilter(e.target.value)}
            style={{
              padding: '6px 10px',
              fontSize: '13px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              width: '280px',
              outline: 'none',
            }}
            aria-label="Filter oversight table by mandate UUID"
          />
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loadStatus === 'loading'}
          aria-disabled={loadStatus === 'loading'}
          style={{
            padding: '7px 14px',
            fontSize: '13px',
            fontWeight: 500,
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            backgroundColor: '#f9fafb',
            color: '#374151',
            cursor: loadStatus === 'loading' ? 'not-allowed' : 'pointer',
            opacity: loadStatus === 'loading' ? 0.6 : 1,
          }}
        >
          {loadStatus === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── Error state ─────────────────────────────────────────────────── */}
      {loadStatus === 'error' && (
        <div
          role="alert"
          style={{
            padding: '10px 14px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#991b1b',
          }}
        >
          Could not load oversight data. Please try again.
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {records.length === 0 && loadStatus !== 'loading' && (
        <div
          aria-live="polite"
          style={{
            padding: '32px',
            textAlign: 'center',
            color: '#6b7280',
            fontSize: '14px',
            border: '1px dashed #d1d5db',
            borderRadius: '8px',
            backgroundColor: '#f9fafb',
          }}
        >
          No outreach records found.
        </div>
      )}

      {/* ── Oversight table ──────────────────────────────────────────────── */}
      {records.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '13px',
              color: '#1f2937',
            }}
            aria-label="Outreach gate-outcome oversight table"
          >
            <thead>
              <tr
                style={{
                  backgroundColor: '#f3f4f6',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                {[
                  'Mandate',
                  'Template version',
                  'Gate verdict',
                  'Block reason',
                  'SoD / Approver',
                  'Composed by',
                  'Date',
                ].map((header) => (
                  <th
                    key={header}
                    scope="col"
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#374151',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record, idx) => {
                const verdict = record.gateVerdict as GateVerdictRecord;
                const reason = blockReason(verdict);
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={record.id}
                    style={{
                      backgroundColor: isEven ? '#ffffff' : '#f9fafb',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    {/* Mandate */}
                    <td
                      style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px' }}
                      title={record.mandateId}
                    >
                      {record.mandateId.slice(0, 8)}…
                    </td>

                    {/* Template version */}
                    <td
                      style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px' }}
                      title={record.templateVersionId}
                    >
                      {record.templateVersionId.slice(0, 8)}…
                    </td>

                    {/* Gate verdict badge */}
                    <td style={{ padding: '10px 12px' }}>
                      <StatusBadge record={record} />
                    </td>

                    {/* Block reason */}
                    <td style={{ padding: '10px 12px', color: reason ? '#b91c1c' : '#6b7280' }}>
                      {reason ?? (verdict.allowed ? '—' : 'none')}
                    </td>

                    {/* SoD / approver — derived from gate verdict block codes */}
                    <td style={{ padding: '10px 12px', color: '#6b7280' }}>
                      {(() => {
                        const blocks = verdict.blocks as Array<Record<string, unknown>>;
                        const sodBlock = blocks.find((b) => b.code === 'sod');
                        if (sodBlock) {
                          const sodReason = sodBlock.reason as string | undefined;
                          if (sodReason === 'sender-is-approver') return 'SoD violation';
                          if (sodReason === 'approver-unknown') return 'Approver unknown';
                          return 'SoD block';
                        }
                        // If approved (no sod block), the approver is tracked at the
                        // template-version level (not surfaced in the gate verdict directly).
                        return verdict.allowed ? 'SoD passed' : '—';
                      })()}
                    </td>

                    {/* Composed by */}
                    <td
                      style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px' }}
                      title={record.createdBy}
                    >
                      {record.createdBy.slice(0, 8)}…
                    </td>

                    {/* Date */}
                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {fmtDate(record.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Required disclaimers footer (informational) ──────────────────── */}
      {records.some(
        (r) => (r.gateVerdict as GateVerdictRecord).requiredDisclaimers?.length > 0
      ) && (
        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
          Some outreach records carry required disclaimer obligations. See the individual outreach
          records or the audit log for the full disclaimer list.
        </p>
      )}

      {/* READ-ONLY sentinel — no send/approve/edit/delete/AI affordance */}
    </div>
  );
}
