/**
 * ExportPanel — recordkeeping export panel (compliance/admin only).
 *
 * Role guard: returns null for advisor. The server also enforces 403 on the
 * POST export endpoint for advisors — this component is the client-side gate.
 *
 * Scope pickers:
 *   Mandate UUID (optional) — scope export to a specific mandate's entries
 *   From date / To date     — optional ISO datetime bounds
 *
 * CTA: "Export recordkeeping package"
 *   Calls POST /compliance/audit-log-data/export (non-page-colliding proxy;
 *   afterFiles rewrite → POST /compliance/audit-log/export on the API).
 *   Triggers a browser file download from the JSON response blob.
 *   Includes the rid anti-CSRF header via apiFetch (T-5 pattern).
 *
 * HARD BOUNDARY:
 *   - READ-ONLY over the immutable chain — no edit/delete affordance.
 *   - NO send/email/AI affordance.
 *   - Export is a one-way download — no mutation of audit rows except the
 *     single export_generated entry appended server-side last-in-txn.
 *   - advisor role always returns null (client + server 403 enforced).
 *
 * WCAG 2.2: visible focus rings, keyboard-navigable inputs, role="status"
 * for loading/success states, aria-disabled on CTA during load.
 *
 * Design: design/audit-log-export.html §"Export Package" right panel.
 * Tokens: zinc/emerald DESIGN-SYSTEM palette; 4px grid.
 */

'use client';

import type { Role } from '@dealflow/shared';
import { useCallback, useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExportPanelProps {
  /** User's role — used to gate the export panel (compliance/admin only). */
  userRole: Role;
  initialMandateId?: string | undefined;
  initialFrom?: string | undefined;
  initialTo?: string | undefined;
}

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportPanel({
  userRole,
  initialMandateId,
  initialFrom,
  initialTo,
}: ExportPanelProps) {
  // ── Advisor guard — compliance/admin only ────────────────────────────────
  if (userRole === 'advisor' || userRole === 'analyst') {
    // The server enforces 403; we additionally hide the panel on the client.
    return null;
  }

  return (
    <ExportPanelInner
      initialMandateId={initialMandateId}
      initialFrom={initialFrom}
      initialTo={initialTo}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner component (rendered only for compliance/admin)
// ---------------------------------------------------------------------------

function ExportPanelInner({
  initialMandateId,
  initialFrom,
  initialTo,
}: {
  initialMandateId?: string | undefined;
  initialFrom?: string | undefined;
  initialTo?: string | undefined;
}) {
  const [mandateId, setMandateId] = useState(initialMandateId ?? '');
  const [from, setFrom] = useState(initialFrom ?? '');
  const [to, setTo] = useState(initialTo ?? '');
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Export handler ───────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    setStatus('loading');
    setErrorMsg(null);

    // Build scope body (omit undefined fields — exportScopeSchema is .strict())
    const body: { mandateId?: string; from?: string; to?: string } = {};
    if (mandateId.trim()) body.mandateId = mandateId.trim();
    if (from) body.from = from;
    if (to) body.to = to;

    try {
      // POST /compliance/audit-log-data/export (non-page-colliding proxy)
      // afterFiles rewrite → POST /compliance/audit-log/export on the API.
      // apiFetch adds rid: anti-csrf header (T-5).
      const res = await apiFetch('/compliance/audit-log-data/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => String(res.status));
        setStatus('error');
        setErrorMsg(`Export failed (${res.status}): ${text}`);
        return;
      }

      // Get the JSON response body as a blob and trigger download
      const blob = await res.blob();
      const filename =
        res.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ??
        'audit-log-export.json';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error during export');
    }
  }, [mandateId, from, to]);

  const isLoading = status === 'loading';

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Export recordkeeping package"
      data-testid="export-panel"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        overflow: 'hidden',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '14px 20px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        {/* File-archive icon */}
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="21 8 21 21 3 21 3 8" />
          <rect x="1" y="3" width="22" height="5" />
          <line x1="10" y1="12" x2="14" y2="12" />
        </svg>
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: '20px',
            color: '#1f2937',
          }}
        >
          Export Recordkeeping Package
        </h3>
      </div>

      {/* Panel body */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Scope description */}
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            lineHeight: '18px',
            color: '#6b7280',
          }}
        >
          Exports a deterministic FINRA-compliant recordkeeping package with in-scope audit entries,
          integrity hashes, and the full-chain verification result. Scoped by mandate and/or date
          range (leave blank for the full log).
        </p>

        {/* Mandate UUID */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label
            htmlFor="export-mandate-id"
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#374151',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Mandate (optional)
          </label>
          <input
            id="export-mandate-id"
            type="text"
            placeholder="Mandate UUID (leave blank for all)"
            value={mandateId}
            onChange={(e) => setMandateId(e.target.value)}
            disabled={isLoading}
            style={{
              padding: '8px 10px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '13px',
              color: '#374151',
              backgroundColor: isLoading ? '#f9fafb' : '#fff',
              outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="export-from"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              From
            </label>
            <input
              id="export-from"
              type="date"
              value={from ? from.slice(0, 10) : ''}
              onChange={(e) => setFrom(e.target.value ? `${e.target.value}T00:00:00Z` : '')}
              disabled={isLoading}
              style={{
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#374151',
                backgroundColor: isLoading ? '#f9fafb' : '#fff',
                outline: 'none',
                width: '100%',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="export-to"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              To
            </label>
            <input
              id="export-to"
              type="date"
              value={to ? to.slice(0, 10) : ''}
              onChange={(e) => setTo(e.target.value ? `${e.target.value}T23:59:59Z` : '')}
              disabled={isLoading}
              style={{
                padding: '8px 10px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#374151',
                backgroundColor: isLoading ? '#f9fafb' : '#fff',
                outline: 'none',
                width: '100%',
              }}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>
        </div>

        {/* Payload inclusions (fixed — always included per design) */}
        <div
          style={{
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            border: '1px solid #f3f4f6',
            fontSize: '12px',
            color: '#6b7280',
            lineHeight: '18px',
          }}
        >
          <strong style={{ color: '#374151', display: 'block', marginBottom: '4px' }}>
            Package always includes:
          </strong>
          Audit entries (with hashes) · Full-chain verify result · Manifest for offline
          re-verification
        </div>

        {/* Status: success */}
        {status === 'success' && (
          <div
            role="status"
            aria-live="polite"
            data-testid="export-success"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              backgroundColor: '#ECFDF5',
              border: '1px solid #D1FAE5',
              borderRadius: '6px',
              color: '#047857',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Export package downloaded.
          </div>
        )}

        {/* Status: error */}
        {status === 'error' && (
          <div
            role="alert"
            aria-live="assertive"
            data-testid="export-error"
            style={{
              padding: '10px 12px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              color: '#B91C1C',
              fontSize: '13px',
            }}
          >
            {errorMsg ?? 'Export failed. Please try again.'}
          </div>
        )}

        {/* Primary CTA — "Export recordkeeping package" */}
        <button
          type="button"
          onClick={() => {
            void handleExport();
          }}
          disabled={isLoading}
          aria-disabled={isLoading}
          aria-label={isLoading ? 'Generating export package…' : 'Export recordkeeping package'}
          data-testid="export-cta"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: isLoading ? '#6ee7b7' : '#10b981',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: '20px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            outline: 'none',
            transition: 'background-color 150ms',
            width: '100%',
          }}
          onFocus={(e) => {
            if (!isLoading) {
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#047857';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading) {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#10b981';
            }
          }}
        >
          {isLoading ? (
            <>
              {/* Spinner */}
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Generating…
            </>
          ) : (
            <>
              {/* Download icon */}
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export recordkeeping package
            </>
          )}
        </button>
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
