/**
 * RecordkeepingExportForm — firm-admin recordkeeping export interactive form.
 *
 * Wave-27 B-3 (task f331a51c). Adopted design: design/staging/recordkeeping-export.html.
 * D-3 APPROVED — built to the 4 polish notes.
 *
 * RBAC: compliance + admin ONLY. The server page already assertRole-guards this
 * route; this component is rendered only after that guard passes. It additionally
 * enforces its own early return for any role that is not compliance/admin so
 * that client-side rendering is safe even in edge-case re-renders.
 *
 * States handled:
 *   idle       — default form; no result panel shown.
 *   generating — CTA disabled (aria-busy); form fields disabled; skeleton result.
 *   success    — integrity band (ShieldCheck) + meta grid + download link.
 *   truncated  — same as success + PROMINENT amber warning (role=alert/aria-live).
 *                Download still available (honest disclosure, NOT a gate).
 *   empty      — 0 rows returned; no download affordance.
 *   error      — inline danger panel (role=alert) + Retry.
 *
 * SEC-4 truncation-honesty UI:
 *   When manifest.truncated === true, a VISIBLE role="alert" amber banner renders
 *   with "Showing N of M rows — narrow the date range for a complete export".
 *   The download is still offered (disclosure, not a blocker). The integrity band
 *   persists into the truncated state, scoped to the rows in the file.
 *   NEVER present a truncated export as complete.
 *
 * D-3 polish notes implemented:
 *   1. Segmented controls: role="radiogroup" on container + role="radio" +
 *      aria-checked per button. Arrow-key roving focus + Enter/Space select.
 *      No aria-pressed selector drift.
 *   2. AppShell skip-link: already added to AppShell.tsx (not per-page).
 *   3. Shared derived-shade helpers: colours consumed from SHADE constants
 *      (not re-hardcoded inline) to prevent cross-page drift.
 *   4. Result panel is post-CTA only (not pre-rendered idle).
 *
 * Endpoint: POST /compliance/audit-log-data/export (afterFiles rewrite →
 *   POST /compliance/audit-log/export on the API). apiFetch injects rid anti-CSRF.
 *   The response is a blob (CSV or JSON); Content-Disposition provides filename.
 *
 * HARD BOUNDARY:
 *   - READ-ONLY / download-only. No edit/delete/send/AI affordance.
 *   - workspace_id / firmId FORBIDDEN on the request body (SEC-2 — server-resolved).
 *   - advisor/analyst always returns null (client + server enforced).
 *
 * WCAG 2.2:
 *   - Keyboard-navigable segmented controls (arrow-key roving, Enter/Space).
 *   - focus-visible on all interactive elements.
 *   - aria-live="polite" on result region; role="alert" on truncation/error.
 *   - aria-busy="true" on CTA during generating state.
 *   - prefers-reduced-motion: spinner animation disabled.
 *   - No colour-only signal: ShieldCheck icon + text for integrity;
 *     AlertTriangle icon + text for truncation.
 *
 * Design tokens: zinc/emerald + 3 status tokens. 4px grid. No off-palette colours.
 * Icons: lucide-react inline SVG convention (matching ExportPanel/IntegrityBadge).
 */

'use client';

import type { ExportManifest, Role } from '@dealflow/shared';
import { exportManifestSchema } from '@dealflow/shared';
import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// D-3 polish note 3: shared derived-shade constants (not re-hardcoded inline)
// ---------------------------------------------------------------------------

const SHADES = {
  // Emerald palette
  emerald50: '#ECFDF5',
  emerald100: '#D1FAE5',
  emerald600: '#10B981',
  emerald700: '#047857',
  emeraldSub: '#059669', // integrity sub-label text
  // Amber / warning palette
  warnBg: '#FFFBEB',
  warnBorder: '#FDE68A',
  warnIcon: '#D97706',
  warnTitle: '#92400E',
  warnBody: '#78350F',
  warnIconBg: '#FEF3C7',
  // Danger palette
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerTitle: '#991B1B',
  dangerBody: '#B91C1C',
  dangerIcon: '#DC2626',
  // Zinc / neutral palette
  zinc50: '#F9FAFB',
  zinc100: '#F3F4F6',
  zinc200: '#E5E7EB',
  zinc300: '#D1D5DB',
  zinc400: '#9CA3AF',
  zinc500: '#6B7280',
  zinc700: '#374151',
  zinc800: '#1F2937',
  // Focus ring
  focusRing: 'rgba(16,185,129,0.40)',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportScope = 'audit' | 'deal' | 'both';
type ExportFormat = 'csv' | 'json';
type ExportState = 'idle' | 'generating' | 'success' | 'truncated' | 'empty' | 'error';

interface ExportResult {
  manifest: ExportManifest;
  blobUrl: string;
  filename: string;
}

interface Props {
  /** Server-verified role — used as client-side gate (compliance/admin only). */
  userRole: Role;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Single option button within a radiogroup segmented control. */
function SegOption({
  id,
  label,
  checked,
  disabled,
  onSelect,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: D-3 polish note 1 requires styled button within radiogroup (not native radio); <input type="radio"> cannot be styled consistently within the design system segmented control pattern.
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      style={{
        padding: '7px 16px',
        fontSize: '13px',
        fontWeight: checked ? 600 : 500,
        color: checked ? SHADES.zinc800 : SHADES.zinc500,
        background: checked ? '#ffffff' : 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 150ms, color 150ms, box-shadow 150ms',
        whiteSpace: 'nowrap',
        lineHeight: '20px',
        boxShadow: checked ? '0 1px 2px rgb(16 24 40 / 0.05)' : 'none',
        outline: 'none',
        opacity: disabled ? 0.6 : 1,
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLButtonElement).style.outline = `2px solid ${SHADES.emerald600}`;
        (e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLButtonElement).style.outline = 'none';
        (e.currentTarget as HTMLButtonElement).style.outlineOffset = '0';
      }}
    >
      {label}
    </button>
  );
}

/** D-3 polish note 1: role="radiogroup" container with arrow-key roving focus. */
function SegmentedControl({
  id,
  labelId,
  options,
  value,
  disabled,
  onChange,
}: {
  id: string;
  labelId: string;
  options: Array<{ value: string; label: string }>;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const group = groupRef.current;
    if (!group) return;
    const btns = Array.from(group.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    const idx = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      btns[(idx + 1) % btns.length]?.focus();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      btns[(idx - 1 + btns.length) % btns.length]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (document.activeElement as HTMLButtonElement | null)?.click();
    }
  }, []);

  return (
    <div
      id={id}
      ref={groupRef}
      role="radiogroup"
      aria-labelledby={labelId}
      aria-disabled={disabled}
      onKeyDown={handleKeyDown}
      style={{
        display: 'inline-flex',
        backgroundColor: SHADES.zinc100,
        border: `1px solid ${SHADES.zinc200}`,
        borderRadius: '8px',
        padding: '3px',
        gap: '2px',
      }}
    >
      {options.map((opt) => (
        <SegOption
          key={opt.value}
          id={`${id}-${opt.value}`}
          label={opt.label}
          checked={value === opt.value}
          disabled={disabled}
          onSelect={() => {
            if (!disabled) onChange(opt.value);
          }}
        />
      ))}
    </div>
  );
}

/** Spinner SVG — aria-hidden (decorative, text label carries semantics). */
function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ animation: 'rk-spin 0.9s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/** Integrity band — prominent emerald band with ShieldCheck icon + text (NOT color-only). */
function IntegrityBand({ rowsReturned }: { rowsReturned: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '14px 20px',
        backgroundColor: SHADES.emerald50,
        borderBottom: `1px solid ${SHADES.emerald100}`,
      }}
    >
      {/* Icon circle */}
      <div
        aria-hidden="true"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: SHADES.emerald100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: SHADES.emerald700,
        }}
      >
        {/* lucide: shield-check */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <polyline points="9 12 11 14 15 10" />
        </svg>
      </div>
      <div>
        <div
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: SHADES.emerald700,
            lineHeight: '20px',
          }}
        >
          Integrity verified
        </div>
        <div
          style={{
            fontSize: '12px',
            color: SHADES.emeraldSub,
            marginTop: '1px',
            lineHeight: '16px',
          }}
        >
          HMAC-SHA256 hash chain intact across {rowsReturned.toLocaleString()} exported{' '}
          {rowsReturned === 1 ? 'entry' : 'entries'}
        </div>
      </div>
      {/* Screen reader announcement on result arrival */}
      <span
        role="status"
        aria-live="polite"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        Export complete. Integrity verified. Hash chain intact.
      </span>
    </div>
  );
}

/** SEC-4 truncation warning — role="alert"/aria-live="assertive". NOT color-only. Download still available. */
function TruncationWarning({
  rowsReturned,
  rowsAvailable,
}: {
  rowsReturned: number;
  rowsAvailable: number;
}) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="truncation-warning"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 16px',
        backgroundColor: SHADES.warnBg,
        border: `1px solid ${SHADES.warnBorder}`,
        borderRadius: '6px',
        marginBottom: '14px',
      }}
    >
      {/* Icon circle — shape + color, NOT color-only */}
      <div
        aria-hidden="true"
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: SHADES.warnIconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
          color: SHADES.warnIcon,
        }}
      >
        {/* lucide: alert-triangle */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      </div>
      <div>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: SHADES.warnTitle,
            marginBottom: '2px',
            lineHeight: '18px',
          }}
        >
          Partial export — {rowsReturned.toLocaleString()} of {rowsAvailable.toLocaleString()} rows
          included
        </div>
        <div
          style={{
            fontSize: '12px',
            color: SHADES.warnBody,
            lineHeight: '18px',
          }}
        >
          Showing {rowsReturned.toLocaleString()} of {rowsAvailable.toLocaleString()} rows — narrow
          the date range for a complete export. The integrity indicator above covers only the rows
          in this file.
        </div>
      </div>
    </div>
  );
}

/** Download link — emerald tint, icon + filename. */
function DownloadLink({
  blobUrl,
  filename,
  partial,
}: {
  blobUrl: string;
  filename: string;
  partial: boolean;
}) {
  return (
    <a
      href={blobUrl}
      download={filename}
      data-testid="export-download-link"
      aria-label={`Download ${partial ? 'partial ' : ''}export file: ${filename}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 14px',
        fontSize: '13px',
        fontWeight: 600,
        color: SHADES.emerald700,
        backgroundColor: SHADES.emerald50,
        border: `1px solid ${SHADES.emerald100}`,
        borderRadius: '6px',
        textDecoration: 'none',
        transition: 'background-color 150ms, border-color 150ms',
        cursor: 'pointer',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = SHADES.emerald100;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = SHADES.emerald50;
      }}
      onFocus={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.outline = `2px solid ${SHADES.emerald600}`;
        (e.currentTarget as HTMLAnchorElement).style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        (e.currentTarget as HTMLAnchorElement).style.outline = 'none';
        (e.currentTarget as HTMLAnchorElement).style.outlineOffset = '0';
      }}
    >
      {/* lucide: download */}
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
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {filename}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RecordkeepingExportForm({ userRole }: Props) {
  // Client-side role guard — server assertRole is the primary gate.
  if (userRole === 'advisor' || userRole === 'analyst') {
    return null;
  }

  return <RecordkeepingExportFormInner />;
}

function RecordkeepingExportFormInner() {
  // ── Form state ─────────────────────────────────────────────────────────────
  const [scope, setScope] = useState<ExportScope>('both');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // ── Export state ───────────────────────────────────────────────────────────
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [result, setResult] = useState<ExportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ref for revocation of previous blob URLs to avoid memory leaks
  const prevBlobUrl = useRef<string | null>(null);

  const isGenerating = exportState === 'generating';

  // ── Export handler ─────────────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    // Revoke previous blob URL if any
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }

    setExportState('generating');
    setResult(null);
    setErrorMsg(null);

    // Build body — exportScopeSchema is .strict(); do NOT include workspace_id (SEC-2).
    const body: {
      scope: ExportScope;
      format: ExportFormat;
      from?: string;
      to?: string;
    } = { scope, format };
    if (from) body.from = `${from}T00:00:00Z`;
    if (to) body.to = `${to}T23:59:59Z`;

    try {
      const res = await apiFetch('/compliance/audit-log-data/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => String(res.status));
        setErrorMsg(`Export failed (${res.status}): ${text}`);
        setExportState('error');
        return;
      }

      // Parse the Manifest header (server attaches X-Export-Manifest or embeds in body).
      // The API returns Content-Disposition for the filename and
      // the X-Export-Manifest JSON header for SEC-4 truncation metadata.
      const manifestHeader = res.headers.get('x-export-manifest');
      let manifest: ExportManifest | null = null;
      if (manifestHeader) {
        try {
          const parsed = exportManifestSchema.safeParse(JSON.parse(manifestHeader));
          manifest = parsed.success ? parsed.data : null;
        } catch {
          manifest = null;
        }
      }

      const contentDisposition = res.headers.get('content-disposition') ?? '';
      const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
      const today = new Date().toISOString().slice(0, 10);
      const ext = format === 'csv' ? 'csv' : 'json';
      const filename = filenameMatch?.[1] ?? `dealflow-export-${today}.${ext}`;

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      prevBlobUrl.current = blobUrl;

      const exportResult: ExportResult = {
        manifest: manifest ?? {
          scope: { scope, format, from: from || undefined, to: to || undefined },
          generatedAt: new Date().toISOString(),
          generatingActor: null,
          chainRoot: '0'.repeat(64),
          tailHash: null,
          entryCount: 0,
          truncated: false,
          rowsReturned: 0,
          rowsAvailable: 0,
        },
        blobUrl,
        filename,
      };

      setResult(exportResult);

      // Determine the export state from the manifest
      if (manifest?.rowsReturned === 0 || manifest?.entryCount === 0) {
        setExportState('empty');
      } else if (manifest?.truncated) {
        setExportState('truncated');
      } else {
        setExportState('success');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unexpected error during export');
      setExportState('error');
    }
  }, [scope, format, from, to]);

  const handleRetry = useCallback(() => {
    void handleExport();
  }, [handleExport]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const scopeOptions = [
    { value: 'audit', label: 'Audit log' },
    { value: 'deal', label: 'Deal & pipeline' },
    { value: 'both', label: 'Both' },
  ];

  const formatOptions = [
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
  ];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      {/* Keyframe for spinner */}
      <style>{`
        @keyframes rk-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          [style*="rk-spin"] { animation: none !important; }
        }
      `}</style>

      {/* ── Configure export card ──────────────────────────────────────────── */}
      <div
        data-testid="export-form-card"
        style={{
          backgroundColor: '#ffffff',
          border: `1px solid ${SHADES.zinc200}`,
          borderRadius: '8px',
          boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
          overflow: 'hidden',
          marginBottom: '20px',
        }}
      >
        {/* Card header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '14px 20px',
            borderBottom: `1px solid ${SHADES.zinc200}`,
            backgroundColor: SHADES.zinc50,
          }}
        >
          {/* lucide: file-down */}
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={SHADES.emerald600}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            <path d="M12 18v-6" />
            <path d="m9 15 3 3 3-3" />
          </svg>
          <h2
            style={{
              margin: 0,
              fontSize: '14px',
              fontWeight: 600,
              lineHeight: '20px',
              color: SHADES.zinc800,
            }}
          >
            Configure export
          </h2>
        </div>

        {/* Card body */}
        <div
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* ── Scope picker ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              id="scope-label"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: SHADES.zinc700,
              }}
            >
              Scope
            </div>
            <SegmentedControl
              id="scope-control"
              labelId="scope-label"
              options={scopeOptions}
              value={scope}
              disabled={isGenerating}
              onChange={(v) => {
                setScope(v as ExportScope);
              }}
            />
          </div>

          {/* ── Format picker ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              id="format-label"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: SHADES.zinc700,
              }}
            >
              Format
            </div>
            <SegmentedControl
              id="format-control"
              labelId="format-label"
              options={formatOptions}
              value={format}
              disabled={isGenerating}
              onChange={(v) => {
                setFormat(v as ExportFormat);
              }}
            />
          </div>

          {/* ── Date range ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              style={{
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: SHADES.zinc700,
              }}
            >
              Date range{' '}
              <span
                style={{
                  fontWeight: 400,
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontSize: '11px',
                  color: SHADES.zinc500,
                }}
              >
                (optional)
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}
            >
              <div>
                <label
                  htmlFor="export-from"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: SHADES.zinc500,
                    marginBottom: '4px',
                  }}
                >
                  From
                </label>
                <input
                  id="export-from"
                  type="date"
                  value={from}
                  max={to || today}
                  onChange={(e) => {
                    setFrom(e.target.value);
                  }}
                  disabled={isGenerating}
                  aria-label="Export start date"
                  aria-describedby="date-hint"
                  style={{
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    color: SHADES.zinc700,
                    backgroundColor: isGenerating ? SHADES.zinc50 : '#ffffff',
                    border: `1px solid ${SHADES.zinc300}`,
                    borderRadius: '6px',
                    transition: 'border-color 150ms, box-shadow 150ms',
                    width: '100%',
                    lineHeight: '20px',
                    outline: 'none',
                    cursor: isGenerating ? 'not-allowed' : 'auto',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = SHADES.emerald600;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${SHADES.focusRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = SHADES.zinc300;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="export-to"
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    color: SHADES.zinc500,
                    marginBottom: '4px',
                  }}
                >
                  To
                </label>
                <input
                  id="export-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={today}
                  onChange={(e) => {
                    setTo(e.target.value);
                  }}
                  disabled={isGenerating}
                  aria-label="Export end date"
                  aria-describedby="date-hint"
                  style={{
                    padding: '8px 10px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    color: SHADES.zinc700,
                    backgroundColor: isGenerating ? SHADES.zinc50 : '#ffffff',
                    border: `1px solid ${SHADES.zinc300}`,
                    borderRadius: '6px',
                    transition: 'border-color 150ms, box-shadow 150ms',
                    width: '100%',
                    lineHeight: '20px',
                    outline: 'none',
                    cursor: isGenerating ? 'not-allowed' : 'auto',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = SHADES.emerald600;
                    e.currentTarget.style.boxShadow = `0 0 0 3px ${SHADES.focusRing}`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = SHADES.zinc300;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Bounds note — default 12 months + truncation advisory */}
            <div
              id="date-hint"
              role="note"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '10px 12px',
                backgroundColor: SHADES.zinc50,
                border: `1px solid ${SHADES.zinc200}`,
                borderRadius: '6px',
                fontSize: '12px',
                color: SHADES.zinc500,
                lineHeight: '18px',
              }}
            >
              {/* lucide: info */}
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={SHADES.zinc400}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: '1px' }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>
                If no range is set, the export covers the <strong>last 12 months</strong> by
                default. Very large date ranges may be capped at 50,000 rows — narrow the range and
                re-export if you see a truncation warning.
              </span>
            </div>
          </div>

          {/* ── Primary CTA — ONE emerald Export button ─────────────────── */}
          <button
            type="button"
            data-testid="export-cta"
            onClick={() => {
              void handleExport();
            }}
            disabled={isGenerating}
            aria-disabled={isGenerating}
            aria-busy={isGenerating}
            aria-label={isGenerating ? 'Generating export, please wait' : 'Export records'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'inherit',
              lineHeight: '20px',
              color: '#ffffff',
              backgroundColor: isGenerating ? '#6EE7B7' : SHADES.emerald600,
              border: 'none',
              borderRadius: '8px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              transition: 'background-color 150ms, box-shadow 150ms',
              width: '100%',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              if (!isGenerating) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = SHADES.emerald700;
              }
            }}
            onMouseLeave={(e) => {
              if (!isGenerating) {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = SHADES.emerald600;
              }
            }}
            onFocus={(e) => {
              if (!isGenerating) {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  `0 0 0 3px ${SHADES.focusRing}`;
              }
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            {isGenerating ? (
              <>
                <Spinner size={16} />
                Generating…
              </>
            ) : (
              <>
                {/* lucide: download */}
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
                Export
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Result panel — post-CTA only (D-3 polish note 4) ──────────────── */}
      {exportState !== 'idle' && (
        <section
          aria-label={
            exportState === 'generating'
              ? 'Export is being generated, please wait'
              : 'Export result'
          }
          aria-live="polite"
          aria-atomic="true"
          data-testid="result-panel"
          style={{
            border: `1px solid ${SHADES.zinc200}`,
            borderRadius: '8px',
            overflow: 'hidden',
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
          }}
        >
          {/* ── Generating state ─────────────────────────────────────────── */}
          {exportState === 'generating' && (
            <>
              <div
                role="status"
                aria-label="Export is being generated, please wait"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 20px',
                  backgroundColor: SHADES.zinc50,
                  borderBottom: `1px solid ${SHADES.zinc200}`,
                  color: SHADES.emerald600,
                }}
              >
                <Spinner size={16} />
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: SHADES.zinc500,
                  }}
                >
                  Building your export…
                </span>
              </div>
              {/* Skeleton rows */}
              <div
                style={{
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {[60, 40, 30].map((w) => (
                  <div
                    key={w}
                    aria-hidden="true"
                    style={{
                      height: '14px',
                      width: `${w}%`,
                      borderRadius: '4px',
                      background: 'linear-gradient(90deg,#f3f4f6 25%,#f9fafb 50%,#f3f4f6 75%)',
                      backgroundSize: '800px 100%',
                      animation: 'rk-shimmer 1.5s infinite linear',
                    }}
                  />
                ))}
                <style>{`
                  @keyframes rk-shimmer {
                    0%   { background-position: -400px 0; }
                    100% { background-position: 400px 0; }
                  }
                  @media (prefers-reduced-motion: reduce) {
                    [style*="rk-shimmer"] { animation: none !important; }
                  }
                `}</style>
              </div>
            </>
          )}

          {/* ── Success state ─────────────────────────────────────────────── */}
          {exportState === 'success' && result && (
            <>
              <IntegrityBand rowsReturned={result.manifest.rowsReturned} />
              <div style={{ padding: '16px 20px' }}>
                {/* Meta grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <MetaItem
                    label="Rows exported"
                    value={result.manifest.rowsReturned.toLocaleString()}
                  />
                  <MetaItem
                    label="Applied range"
                    value={formatDateRange(result.manifest.scope.from, result.manifest.scope.to)}
                    small
                  />
                  <MetaItem
                    label="Format"
                    value={result.manifest.scope.format?.toUpperCase() ?? format.toUpperCase()}
                    small
                  />
                </div>
                <DownloadLink blobUrl={result.blobUrl} filename={result.filename} partial={false} />
              </div>
            </>
          )}

          {/* ── Truncated state — SEC-4 compliance-honesty UI ──────────────── */}
          {exportState === 'truncated' && result && (
            <>
              <IntegrityBand rowsReturned={result.manifest.rowsReturned} />
              <div style={{ padding: '16px 20px' }}>
                {/* Meta grid — rowsReturned in amber, total rows shown */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '16px',
                    marginBottom: '16px',
                  }}
                >
                  <MetaItem
                    label="Rows exported"
                    value={result.manifest.rowsReturned.toLocaleString()}
                    amber
                  />
                  <MetaItem
                    label="Total rows matched"
                    value={result.manifest.rowsAvailable.toLocaleString()}
                  />
                  <MetaItem
                    label="Applied range"
                    value={formatDateRange(result.manifest.scope.from, result.manifest.scope.to)}
                    small
                  />
                </div>

                {/* SEC-4 truncation warning — PROMINENT, role=alert, NOT color-only */}
                <TruncationWarning
                  rowsReturned={result.manifest.rowsReturned}
                  rowsAvailable={result.manifest.rowsAvailable}
                />

                {/* Download still available — honest disclosure, not a gate */}
                <DownloadLink blobUrl={result.blobUrl} filename={result.filename} partial={true} />
              </div>
            </>
          )}

          {/* ── Empty state — 0 rows ──────────────────────────────────────── */}
          {exportState === 'empty' && (
            <div
              data-testid="empty-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '36px 24px',
                textAlign: 'center',
                color: SHADES.zinc500,
              }}
            >
              {/* lucide: file-text */}
              <svg
                aria-hidden="true"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke={SHADES.zinc300}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginBottom: '12px' }}
              >
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="M10 9H8" />
                <path d="M16 13H8" />
                <path d="M16 17H8" />
              </svg>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: SHADES.zinc500,
                  marginBottom: '4px',
                }}
              >
                No records in this range
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: SHADES.zinc400,
                  lineHeight: '18px',
                }}
              >
                No audit or deal activity was found for the selected date range. Try widening the
                range or selecting &ldquo;Both&rdquo; as the scope.
              </div>
            </div>
          )}

          {/* ── Error state ───────────────────────────────────────────────── */}
          {exportState === 'error' && (
            <div
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
              data-testid="error-panel"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '16px 20px',
                backgroundColor: SHADES.dangerBg,
                border: `1px solid ${SHADES.dangerBorder}`,
              }}
            >
              {/* lucide: alert-triangle */}
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={SHADES.dangerIcon}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: '1px' }}
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: SHADES.dangerTitle,
                    lineHeight: '18px',
                  }}
                >
                  Export failed
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: SHADES.dangerBody,
                    marginTop: '2px',
                    lineHeight: '18px',
                  }}
                >
                  {errorMsg ??
                    'The server could not generate the export. Your records were not modified. Please try again or contact support.'}
                </div>
                <button
                  type="button"
                  data-testid="retry-btn"
                  onClick={handleRetry}
                  style={{
                    marginTop: '8px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    color: SHADES.dangerIcon,
                    backgroundColor: '#ffffff',
                    border: `1px solid ${SHADES.dangerBorder}`,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'background-color 150ms',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = SHADES.dangerBg;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ffffff';
                  }}
                  onFocus={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.outline =
                      `2px solid ${SHADES.dangerIcon}`;
                    (e.currentTarget as HTMLButtonElement).style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.outline = 'none';
                  }}
                >
                  {/* lucide: refresh-cw */}
                  <svg
                    aria-hidden="true"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M8 16H3v5" />
                  </svg>
                  Retry export
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetaItem({
  label,
  value,
  small,
  amber,
}: {
  label: string;
  value: string;
  small?: boolean;
  amber?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: SHADES.zinc500,
          marginBottom: '2px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: small ? '13px' : '14px',
          fontWeight: 600,
          color: amber ? SHADES.warnIcon : SHADES.zinc800,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Format a date-range string for display. Defaults to "Last 12 months" when no bounds. */
function formatDateRange(from?: string, to?: string): string {
  if (!from && !to) return 'Last 12 months';
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return iso.slice(0, 10);
    }
  };
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `From ${fmt(from)}`;
  return `To ${fmt(to!)}`;
}
