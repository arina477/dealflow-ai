/**
 * IntegrityPanel — client component for the audit-log integrity view.
 *
 * Renders chain verification status and provides a "Verify now" action
 * that re-calls GET /compliance/audit-log/verify via a same-origin relative
 * path. The Next.js afterFiles rewrite in next.config.ts proxies
 * /compliance/audit-log/verify → <INTERNAL_API_BASE_URL>/compliance/audit-log/verify
 * so the browser sends its first-party session cookie automatically (no
 * explicit credentials option needed — same-origin fetch default).
 *
 * States:
 *   verified (ok:true)  — emerald "All entries verified" status pill + count.
 *   broken (ok:false)   — PERSISTENT, NON-DISMISSIBLE amber/red panel showing
 *                         firstBreakAt + reason. This is a compliance signal,
 *                         not a toast — it stays on screen until the chain is
 *                         repaired and a fresh verify returns ok:true.
 *   loading             — subtle loading state while verify-now is in-flight.
 *   unavailable         — endpoint unreachable (null initialResult or fetch
 *                         failure); neutral degraded state shown.
 *
 * Design: design/audit-log-export.html §Integrity Validation + DESIGN-SYSTEM §10
 *   - Emerald pill (verified): bg #ECFDF5, text #047857, border #D1FAE5
 *   - Amber banner (broken): bg #FFFBEB, border #FDE68A, text #92400E
 *   - Panel surface: white bg, border #E5E7EB, radius 8px, shadow-xs
 *   - All zinc/emerald tokens; 4px grid; no off-palette colours.
 *
 * Accessibility:
 *   - Broken state: role="alert" aria-live="assertive" (persistent; WCAG 4.1.3)
 *   - Verify button: focusable, visible focus ring (emerald 40% ring).
 *   - Loading spinner: aria-hidden; button aria-label updated during load.
 */

'use client';

import type { AuditVerifyResponse } from '@dealflow/shared';
import { auditVerifyResponseSchema } from '@dealflow/shared';
import { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable break reason label. */
function reasonLabel(reason: string | undefined): string {
  switch (reason) {
    case 'content-hash-mismatch':
      return 'Content hash mismatch — entry data may have been altered.';
    case 'prev-hash-mismatch':
      return 'Chain link broken — prev_hash does not match the prior entry.';
    case 'sequence-gap':
      return 'Sequence gap detected — one or more entries may have been deleted.';
    default:
      return reason ?? 'Unknown integrity failure.';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Verified state: emerald status pill + entry count. */
function VerifiedState({ entriesChecked }: { entriesChecked: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* Status pill — "All entries verified" (design §Integrity Validation) */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: '9999px',
          backgroundColor: '#ECFDF5',
          border: '1px solid #D1FAE5',
          color: '#047857',
          fontWeight: 600,
          fontSize: '14px',
          lineHeight: '20px',
          width: 'fit-content',
        }}
        role="status"
        aria-label="Chain integrity: all entries verified"
      >
        {/* Shield check icon (inline SVG — avoids ESM import in client boundary) */}
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
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
        All entries verified
      </div>

      {/* Entry count + last-verified metadata */}
      <dl
        style={{
          display: 'flex',
          gap: '32px',
          flexWrap: 'wrap',
          margin: 0,
          padding: 0,
        }}
      >
        <div>
          <dt
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#6b7280',
              marginBottom: '4px',
            }}
          >
            Entries checked
          </dt>
          <dd
            style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 700,
              lineHeight: '36px',
              color: '#1f2937',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {entriesChecked.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#6b7280',
              marginBottom: '4px',
            }}
          >
            Chain status
          </dt>
          <dd
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 500,
              lineHeight: '36px',
              color: '#047857',
            }}
          >
            Intact
          </dd>
        </div>
      </dl>

      {entriesChecked === 0 && (
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            lineHeight: '18px',
            color: '#6b7280',
          }}
        >
          No audit entries have been recorded yet. The chain will be verified as entries are
          written.
        </p>
      )}
    </div>
  );
}

/** Broken state: PERSISTENT, NON-DISMISSIBLE amber panel (compliance signal). */
function BrokenState({
  firstBreakAt,
  reason,
  entriesChecked,
}: {
  firstBreakAt: number | undefined;
  reason: string | undefined;
  entriesChecked: number;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        backgroundColor: '#FFFBEB',
        border: '1px solid #FDE68A',
        borderRadius: '8px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Banner header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        {/* Alert triangle icon */}
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#D97706"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: '2px' }}
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>

        <div>
          <h3
            style={{
              margin: '0 0 4px',
              fontSize: '15px',
              fontWeight: 700,
              lineHeight: '22px',
              color: '#92400E',
            }}
          >
            Hash-chain integrity failure detected
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              lineHeight: '18px',
              color: '#92400E',
            }}
          >
            {reasonLabel(reason)}
          </p>
        </div>
      </div>

      {/* Break details */}
      <dl
        style={{
          display: 'flex',
          gap: '24px',
          flexWrap: 'wrap',
          margin: 0,
          padding: '12px',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          borderRadius: '6px',
        }}
      >
        {firstBreakAt !== undefined && (
          <div>
            <dt
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#92400E',
                marginBottom: '2px',
              }}
            >
              First break at sequence
            </dt>
            <dd
              style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: 700,
                lineHeight: '28px',
                color: '#78350F',
                fontVariantNumeric: 'tabular-nums',
              }}
              data-testid="first-break-at"
            >
              #{firstBreakAt}
            </dd>
          </div>
        )}
        <div>
          <dt
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#92400E',
              marginBottom: '2px',
            }}
          >
            Entries checked
          </dt>
          <dd
            style={{
              margin: 0,
              fontSize: '22px',
              fontWeight: 700,
              lineHeight: '28px',
              color: '#78350F',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {entriesChecked.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt
            style={{
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#92400E',
              marginBottom: '2px',
            }}
          >
            Reason code
          </dt>
          <dd
            style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: 600,
              lineHeight: '28px',
              color: '#78350F',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            }}
            data-testid="break-reason"
          >
            {reason ?? 'unknown'}
          </dd>
        </div>
      </dl>

      {/* Compliance advisory note */}
      <p
        style={{
          margin: 0,
          fontSize: '12px',
          lineHeight: '16px',
          color: '#92400E',
          fontStyle: 'italic',
        }}
      >
        This panel is persistent and cannot be dismissed. Contact your system administrator
        immediately. Do not write or export audit data until the chain integrity is restored and
        verified.
      </p>
    </div>
  );
}

/** Unavailable state — endpoint unreachable, degraded neutral display. */
function UnavailableState() {
  return (
    <div
      role="status"
      aria-label="Integrity status unavailable"
      style={{
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        color: '#6b7280',
        fontSize: '14px',
        lineHeight: '20px',
      }}
    >
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
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>
        Integrity status is temporarily unavailable. Use &ldquo;Verify now&rdquo; to retry.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface IntegrityPanelProps {
  /** Null when the server-side fetch failed; component shows degraded state. */
  initialResult: AuditVerifyResponse | null;
}

export function IntegrityPanel({ initialResult }: IntegrityPanelProps) {
  const [result, setResult] = useState<AuditVerifyResponse | null>(initialResult);
  const [loading, setLoading] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(new Date());

  // ── Verify now action ────────────────────────────────────────────────────

  const handleVerifyNow = useCallback(async () => {
    setLoading(true);
    try {
      // Relative same-origin path — Next.js afterFiles rewrite proxies this
      // to the API. The browser sends the session cookie automatically because
      // the request stays on the web origin (no cross-origin, no credentials
      // option needed).
      const res = await fetch('/compliance/audit-log/verify', { cache: 'no-store' });
      if (!res.ok) {
        setResult(null);
        return;
      }
      const raw: unknown = await res.json();
      const parsed = auditVerifyResponseSchema.safeParse(raw);
      setResult(parsed.success ? parsed.data : null);
      setVerifiedAt(new Date());
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Chain integrity status"
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
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f9fafb',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
            Integrity hashes &amp; verification
          </h3>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: '#6b7280',
              padding: '2px 6px',
              backgroundColor: '#f3f4f6',
              borderRadius: '4px',
              border: '1px solid #e5e7eb',
            }}
          >
            Required by FINRA profile
          </span>
        </div>

        {/* Verify now button */}
        <button
          type="button"
          onClick={() => {
            void handleVerifyNow();
          }}
          disabled={loading}
          aria-label={loading ? 'Verifying chain integrity…' : 'Verify chain integrity now'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: loading ? '#f9fafb' : '#ffffff',
            color: loading ? '#9ca3af' : '#374151',
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: '20px',
            cursor: loading ? 'not-allowed' : 'pointer',
            outline: 'none',
            transition: 'background-color 150ms ease, color 150ms ease',
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 0 0 2px rgb(16 185 129 / 0.4)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          {loading ? (
            <>
              {/* Loading spinner */}
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
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              Verifying…
            </>
          ) : (
            <>
              {/* Refresh-cw icon */}
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
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              Verify now
            </>
          )}
        </button>
      </div>

      {/* Panel body */}
      <div style={{ padding: '20px' }}>
        {result === null ? (
          <UnavailableState />
        ) : result.ok ? (
          <VerifiedState entriesChecked={result.entriesChecked} />
        ) : (
          <BrokenState
            firstBreakAt={result.firstBreakAt}
            reason={result.reason}
            entriesChecked={result.entriesChecked}
          />
        )}
      </div>

      {/* Last verified footer */}
      {verifiedAt !== null && (
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid #f3f4f6',
            backgroundColor: '#fafafa',
            fontSize: '12px',
            lineHeight: '16px',
            color: '#9ca3af',
          }}
        >
          Last verified:{' '}
          <time dateTime={verifiedAt.toISOString()}>{verifiedAt.toLocaleString()}</time>
        </div>
      )}

      {/* Keyframe for spinner (inline — no Tailwind required) */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
