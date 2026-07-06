/**
 * IntegrityBadge — compact top-right chain-integrity status pill.
 *
 * Renders the REAL AuditVerifyResponse shape:
 *   ok:true  → emerald "All entries verified (N entries)" pill
 *   ok:false → amber "Break at #N (reason)" pill (NOT a false "all verified")
 *   null     → neutral "Unavailable" pill
 *
 * This is a READ-ONLY display component — no verify action, no mutation,
 * no send/AI affordance.
 *
 * Design: design/audit-log-export.html §header "Integrity Status" pill.
 *   Emerald: bg #ECFDF5, text #047857, border #D1FAE5
 *   Amber:   bg #FFFBEB, text #92400E, border #FDE68A
 *   Neutral: bg #F3F4F6, text #6B7280, border #E5E7EB
 *
 * Accessibility: role="status" with descriptive aria-label.
 */

'use client';

import type { AuditVerifyResponse } from '@dealflow/shared';

interface IntegrityBadgeProps {
  result: AuditVerifyResponse | null;
}

export function IntegrityBadge({ result }: IntegrityBadgeProps) {
  // ── null / unavailable ────────────────────────────────────────────────────
  if (result === null) {
    return (
      <div
        role="status"
        aria-label="Chain integrity status unavailable"
        data-testid="integrity-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '9999px',
          backgroundColor: '#F3F4F6',
          border: '1px solid #E5E7EB',
          color: '#6B7280',
          fontWeight: 600,
          fontSize: '12px',
          lineHeight: '18px',
        }}
      >
        {/* Info circle icon */}
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
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <span>Integrity unavailable</span>
      </div>
    );
  }

  // ── ok: true — chain intact ───────────────────────────────────────────────
  if (result.ok) {
    return (
      <div
        role="status"
        aria-label={`Chain integrity verified — ${result.entriesChecked.toLocaleString()} entries checked`}
        data-testid="integrity-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '9999px',
          backgroundColor: '#ECFDF5',
          border: '1px solid #D1FAE5',
          color: '#047857',
          fontWeight: 600,
          fontSize: '12px',
          lineHeight: '18px',
          whiteSpace: 'nowrap',
        }}
      >
        {/* Shield check icon */}
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
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
        <span>All entries verified</span>
        <span
          data-testid="badge-entries-count"
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: '#059669',
            marginLeft: '2px',
          }}
        >
          ({result.entriesChecked.toLocaleString()})
        </span>
      </div>
    );
  }

  // ── ok: false — break detected ────────────────────────────────────────────
  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label={`Chain integrity failure at entry #${result.firstBreakAt ?? '?'}: ${result.reason ?? 'unknown'}`}
      data-testid="integrity-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        borderRadius: '9999px',
        backgroundColor: '#FFFBEB',
        border: '1px solid #FDE68A',
        color: '#92400E',
        fontWeight: 600,
        fontSize: '12px',
        lineHeight: '18px',
        whiteSpace: 'nowrap',
      }}
    >
      {/* Alert triangle icon */}
      <svg
        aria-hidden="true"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#D97706"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span data-testid="badge-break-label">
        {result.entriesChecked} entries — break at{' '}
        <strong data-testid="badge-break-at">#{result.firstBreakAt ?? '?'}</strong>
        {result.reason ? (
          <>
            {' '}
            (<span data-testid="badge-break-reason">{result.reason}</span>)
          </>
        ) : null}
      </span>
    </div>
  );
}
