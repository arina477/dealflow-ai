/**
 * RetentionPolicyForm — firm-admin retention-policy settings interactive form.
 *
 * Wave-28 B-3 (task ce75c6c6). Adopted design: design/staging/retention-settings.html.
 * D-3 APPROVED.
 *
 * RBAC: compliance + admin ONLY. The server page assertRole-guards the route; this
 * component additionally enforces its own early return for any role that is not
 * compliance/admin so that client-side rendering is safe in edge-case re-renders.
 *
 * YEARS ↔ DAYS CONVERSION:
 *   UI shows years (1–30). The API takes retentionPeriodDays (30–10950).
 *   Conversion: years * 365 = days (integer division; 1yr = 365 days, 30yr = 10950 days).
 *   The bounds displayed are 1–30 years (≈ 365–10950 days). The schema minimum of 30
 *   days means a value of 0 years is never representable; the UI min is 1yr = 365 days.
 *   On load: days → years via Math.round(days / 365), clamped to 1–30.
 *   On save: years → days via years * 365.
 *
 * States handled:
 *   loading  — skeleton shimmer while GET /compliance/retention-data runs.
 *   idle     — form at rest; current value populated, Save enabled.
 *   saving   — Save disabled + spinner + aria-busy; stepper and input disabled.
 *   saved    — Saved pill appears briefly; provenance updates; returns to idle.
 *   error    — inline danger alert (role=alert aria-live=assertive) + Retry; Save still enabled.
 *   invalid  — red border + aria-invalid + inline error (role=alert); Save disabled;
 *              cutoff panel shows placeholder copy.
 *
 * [WORM — LOAD-BEARING]
 *   NO purge/delete control anywhere. The cutoff panel is read-only and informational.
 *   A test asserts that no button with a name matching /purge|delete|clean/i renders.
 *
 * Audit note (LOAD-BEARING):
 *   "This change is recorded in your audit log." ShieldCheck trust note is ALWAYS
 *   rendered below the Save button in every non-loading state. Not conditional.
 *
 * API:
 *   GET /compliance/retention-data → proxied to GET /compliance/retention
 *   PUT /compliance/retention-data → proxied to PUT /compliance/retention
 *   Body: { retentionPeriodDays: number } — workspace resolved server-side. No workspace_id.
 *   Response: { retentionPeriodDays, cutoffDate, updatedBy, updatedAt } (RetentionPolicy)
 *
 * Accessibility (WCAG 2.2):
 *   - <label for="retention-years"> associated with input (not placeholder-only).
 *   - aria-describedby="years-error years-hint" on the input.
 *   - aria-invalid="true/false" toggled in sync with validation state.
 *   - aria-live="assertive" + role="alert" on validation error and server-error alert.
 *   - aria-live="polite" + role="status" + aria-atomic on saved pill.
 *   - aria-busy="true" on Save button during saving state.
 *   - role="note" on cutoff panel; role="note" on audit note.
 *   - focus-visible: 2px emerald outline + 2px offset on all interactive controls.
 *   - prefers-reduced-motion: shimmer and spinner animations suppressed.
 *   - No colour-only signal: invalid = red border + icon + text; error = icon + title + body.
 *   - Keyboard: Tab → label → input → decrement stepper → increment stepper → Save.
 *
 * Design tokens: zinc/emerald + status-danger only. 4px grid. lucide inline SVG.
 * No off-palette colours invented.
 */

'use client';

import type { Role } from '@dealflow/shared';
import { retentionPolicySchema } from '@dealflow/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Design-system colour constants (matches design/staging/retention-settings.html)
// ---------------------------------------------------------------------------

const DS = {
  // Zinc / neutral
  zinc50: '#F9FAFB',
  zinc100: '#F3F4F6',
  zinc200: '#E5E7EB',
  zinc300: '#D1D5DB',
  zinc400: '#9CA3AF',
  zinc500: '#6B7280',
  zinc600: '#4B5563',
  zinc700: '#374151',
  zinc800: '#1F2937',
  // Emerald
  emerald50: '#ECFDF5',
  emerald100: '#D1FAE5',
  emerald600: '#10B981',
  emerald700: '#047857',
  // Status – danger
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  dangerText: '#991B1B',
  dangerBody: '#B91C1C',
  dangerIcon: '#DC2626',
  // Focus ring
  focusRing: 'rgba(16,185,129,0.40)',
  focusRingDanger: 'rgba(220,38,38,0.20)',
} as const;

// ---------------------------------------------------------------------------
// Years ↔ days conversion
// ---------------------------------------------------------------------------

const YEARS_MIN = 1;
const YEARS_MAX = 30;

function daysToYears(days: number): number {
  return Math.min(YEARS_MAX, Math.max(YEARS_MIN, Math.round(days / 365)));
}

function yearsToDays(years: number): number {
  return years * 365;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FormState = 'loading' | 'idle' | 'saving' | 'saved' | 'error' | 'invalid';

interface Provenance {
  updatedBy: string | null;
  updatedAt: string | null;
}

interface Props {
  /** Server-verified role — client-side RBAC gate (compliance/admin only). */
  userRole: Role;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Shimmer skeleton bar. prefers-reduced-motion: animation suppressed. */
function SkeletonBar({ width, height = 14 }: { width: string; height?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        height: `${height}px`,
        width,
        borderRadius: '4px',
        background: `linear-gradient(90deg,${DS.zinc100} 25%,${DS.zinc50} 50%,${DS.zinc100} 75%)`,
        backgroundSize: '800px 100%',
        animation: 'rs-shimmer 1.5s infinite linear',
      }}
    />
  );
}

/** Spinner SVG — decorative (aria-hidden); text label carries semantics. */
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
      style={{ animation: 'rs-spin 0.9s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Provenance formatter
// ---------------------------------------------------------------------------

function formatProvenance(provenance: Provenance): string | null {
  if (!provenance.updatedBy && !provenance.updatedAt) return null;
  const parts: string[] = [];
  if (provenance.updatedBy) parts.push(`Last updated by ${provenance.updatedBy}`);
  if (provenance.updatedAt) {
    try {
      const d = new Date(provenance.updatedAt);
      const formatted = d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      parts.push(`on ${formatted}`);
    } catch {
      parts.push(`on ${provenance.updatedAt.slice(0, 10)}`);
    }
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Cutoff date formatter
// ---------------------------------------------------------------------------

function formatCutoffDate(isoDate: string): string {
  try {
    const d = new Date(isoDate);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return isoDate.slice(0, 10);
  }
}

// ---------------------------------------------------------------------------
// Main exported component — RBAC gate wrapper
// ---------------------------------------------------------------------------

export function RetentionPolicyForm({ userRole }: Props) {
  // Client-side RBAC guard — server assertRole is the primary gate.
  if (userRole === 'advisor' || userRole === 'analyst') {
    return null;
  }
  return <RetentionPolicyFormInner />;
}

// ---------------------------------------------------------------------------
// Inner form (rendered only after RBAC gate passes)
// ---------------------------------------------------------------------------

function RetentionPolicyFormInner() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [formState, setFormState] = useState<FormState>('loading');
  const [years, setYears] = useState<number>(7);
  const [inputValue, setInputValue] = useState<string>('7');
  const [provenance, setProvenance] = useState<Provenance>({ updatedBy: null, updatedAt: null });
  const [cutoffDate, setCutoffDate] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInvalid, setIsInvalid] = useState<boolean>(false);

  // Ref to track saved-pill fade-out timer
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load initial policy ────────────────────────────────────────────────────

  const loadPolicy = useCallback(async () => {
    setFormState('loading');
    try {
      const res = await apiFetch('/compliance/retention-data', { method: 'GET' });
      if (!res.ok) {
        setFormState('error');
        setErrorMsg(`Failed to load retention policy (${res.status.toString()}).`);
        return;
      }
      const raw: unknown = await res.json();
      const parsed = retentionPolicySchema.safeParse(raw);
      if (!parsed.success) {
        setFormState('error');
        setErrorMsg('The server returned an unexpected response format.');
        return;
      }
      const policy = parsed.data;
      const yearsVal = daysToYears(policy.retentionPeriodDays);
      setYears(yearsVal);
      setInputValue(String(yearsVal));
      setProvenance({ updatedBy: policy.updatedBy, updatedAt: policy.updatedAt });
      setCutoffDate(policy.cutoffDate);
      setIsInvalid(false);
      setFormState('idle');
    } catch {
      setFormState('error');
      setErrorMsg('Could not reach the server. Please check your connection and retry.');
    }
  }, []);

  useEffect(() => {
    void loadPolicy();
    return () => {
      if (savedTimerRef.current !== null) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, [loadPolicy]);

  // ── Input / stepper handlers ───────────────────────────────────────────────

  const validateYears = useCallback((val: number): boolean => {
    return Number.isInteger(val) && val >= YEARS_MIN && val <= YEARS_MAX;
  }, []);

  const handleInputChange = useCallback(
    (raw: string) => {
      setInputValue(raw);
      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed) || !validateYears(parsed)) {
        setIsInvalid(true);
        if (formState === 'idle') setFormState('invalid');
      } else {
        setIsInvalid(false);
        setYears(parsed);
        if (formState === 'invalid') setFormState('idle');
      }
    },
    [formState, validateYears]
  );

  const adjustYears = useCallback(
    (delta: number) => {
      const current = Number.parseInt(inputValue, 10);
      const base = Number.isNaN(current) ? years : current;
      const next = Math.min(YEARS_MAX, Math.max(YEARS_MIN, base + delta));
      setYears(next);
      setInputValue(String(next));
      setIsInvalid(false);
      if (formState === 'invalid') setFormState('idle');
    },
    [inputValue, years, formState]
  );

  // ── Save handler ───────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (isInvalid || formState === 'invalid' || formState === 'saving') return;

    const retentionPeriodDays = yearsToDays(years);
    setFormState('saving');
    setErrorMsg(null);

    try {
      const res = await apiFetch('/compliance/retention-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // workspace_id MUST NOT appear — server resolves it (SEC-A / SEC-2).
        body: JSON.stringify({ retentionPeriodDays }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => String(res.status));
        setErrorMsg(`Could not save retention policy (${res.status.toString()}): ${text}`);
        setFormState('error');
        return;
      }

      const raw: unknown = await res.json();
      const parsed = retentionPolicySchema.safeParse(raw);
      if (parsed.success) {
        const policy = parsed.data;
        const yearsVal = daysToYears(policy.retentionPeriodDays);
        setYears(yearsVal);
        setInputValue(String(yearsVal));
        setProvenance({ updatedBy: policy.updatedBy, updatedAt: policy.updatedAt });
        setCutoffDate(policy.cutoffDate);
      }

      setFormState('saved');

      // Auto-return to idle after 3 s
      savedTimerRef.current = setTimeout(() => {
        setFormState('idle');
      }, 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setFormState('error');
    }
  }, [isInvalid, formState, years]);

  const handleRetry = useCallback(() => {
    setErrorMsg(null);
    // If error was during initial load, re-load; otherwise return to idle.
    if (cutoffDate === null) {
      void loadPolicy();
    } else {
      setFormState('idle');
    }
  }, [cutoffDate, loadPolicy]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const isSaving = formState === 'saving';
  const isSaved = formState === 'saved';
  const isLoading = formState === 'loading';
  const isError = formState === 'error';
  const isFormInvalid = formState === 'invalid' || isInvalid;

  const canSave = !isSaving && !isFormInvalid && !isLoading;
  const provenanceLine = formatProvenance(provenance);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Keyframes — prefers-reduced-motion suppresses these */}
      <style>{`
        @keyframes rs-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position:  400px 0; }
        }
        @keyframes rs-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          [style*="rs-shimmer"], [style*="rs-spin"] { animation: none !important; }
        }
      `}</style>

      {/* ── Loading state ────────────────────────────────────────────────────── */}
      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Loading retention policy"
          data-testid="loading-state"
        >
          {/* Settings card skeleton */}
          <div
            style={{
              backgroundColor: '#ffffff',
              border: `1px solid ${DS.zinc200}`,
              borderRadius: '8px',
              boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${DS.zinc200}`,
                backgroundColor: DS.zinc50,
              }}
            >
              <SkeletonBar width="140px" height={16} />
            </div>
            <div
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <SkeletonBar width="120px" height={12} />
              <SkeletonBar width="200px" height={42} />
              <SkeletonBar width="240px" height={12} />
              <SkeletonBar width="120px" height={40} />
            </div>
          </div>

          {/* Cutoff panel skeleton */}
          <div
            aria-busy="true"
            style={{
              backgroundColor: DS.zinc50,
              border: `1px solid ${DS.zinc200}`,
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: DS.zinc100,
                border: `1px solid ${DS.zinc200}`,
                flexShrink: 0,
              }}
            />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <SkeletonBar width="80px" height={12} />
              <SkeletonBar width="320px" height={16} />
              <SkeletonBar width="260px" height={12} />
            </div>
          </div>
        </div>
      )}

      {/* ── Idle / Saving / Saved / Error / Invalid states (non-loading) ──────── */}
      {!isLoading && (
        <>
          {/* ── Settings card ─────────────────────────────────────────────────── */}
          <div
            data-testid="retention-settings-card"
            style={{
              backgroundColor: '#ffffff',
              border: `1px solid ${DS.zinc200}`,
              borderRadius: '8px',
              boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
              overflow: 'hidden',
              marginBottom: '16px',
            }}
          >
            {/* Card header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 20px',
                borderBottom: `1px solid ${DS.zinc200}`,
                backgroundColor: DS.zinc50,
              }}
            >
              {/* lucide: clock */}
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={DS.emerald600}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <h2
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: 600,
                  lineHeight: '20px',
                  color: DS.zinc800,
                }}
              >
                Retention window
              </h2>
            </div>

            {/* Card body */}
            <div style={{ padding: '24px' }}>
              {/* ── Years field ─────────────────────────────────────────────── */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginBottom: '20px',
                }}
              >
                <label
                  htmlFor="retention-years"
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase' as const,
                    color: DS.zinc700,
                  }}
                >
                  Retention period{' '}
                  <span
                    style={{
                      fontWeight: 400,
                      textTransform: 'none',
                      letterSpacing: 0,
                      fontSize: '11px',
                      color: DS.zinc500,
                    }}
                  >
                    (1–30 years)
                  </span>
                </label>

                {/* Years stepper row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Decrement */}
                  <button
                    type="button"
                    aria-label="Decrease retention by 1 year"
                    disabled={isSaving || Number.parseInt(inputValue, 10) <= YEARS_MIN}
                    onClick={() => {
                      adjustYears(-1);
                    }}
                    data-testid="btn-decrement"
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${DS.zinc200}`,
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: DS.zinc500,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      transition: 'background-color 150ms, border-color 150ms, color 150ms',
                      flexShrink: 0,
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = `2px solid ${DS.emerald600}`;
                      e.currentTarget.style.outlineOffset = '2px';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.outline = 'none';
                    }}
                  >
                    {/* lucide: minus */}
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
                    </svg>
                  </button>

                  {/* Number input */}
                  <input
                    id="retention-years"
                    type="number"
                    inputMode="numeric"
                    value={inputValue}
                    min={YEARS_MIN}
                    max={YEARS_MAX}
                    step={1}
                    disabled={isSaving}
                    aria-label="Retention period in years"
                    aria-describedby="years-error years-hint"
                    aria-invalid={isFormInvalid}
                    data-testid="retention-years-input"
                    onChange={(e) => {
                      handleInputChange(e.target.value);
                    }}
                    style={{
                      width: '80px',
                      padding: '8px 10px',
                      fontSize: '20px',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      fontVariantNumeric: 'tabular-nums',
                      color: DS.zinc800,
                      textAlign: 'center',
                      backgroundColor: isSaving ? DS.zinc50 : '#ffffff',
                      border: `1px solid ${isFormInvalid ? DS.dangerIcon : DS.zinc300}`,
                      borderRadius: '6px',
                      transition: 'border-color 150ms, box-shadow 150ms',
                      outline: 'none',
                      appearance: 'textfield' as never,
                      // biome-ignore lint/suspicious/noExplicitAny: vendor-specific CSS property
                      MozAppearance: 'textfield' as any,
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isFormInvalid
                        ? DS.dangerIcon
                        : DS.emerald600;
                      e.currentTarget.style.boxShadow = isFormInvalid
                        ? `0 0 0 3px ${DS.focusRingDanger}`
                        : `0 0 0 3px ${DS.focusRing}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isFormInvalid
                        ? DS.dangerIcon
                        : DS.zinc300;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />

                  {/* Increment */}
                  <button
                    type="button"
                    aria-label="Increase retention by 1 year"
                    disabled={isSaving || Number.parseInt(inputValue, 10) >= YEARS_MAX}
                    onClick={() => {
                      adjustYears(1);
                    }}
                    data-testid="btn-increment"
                    style={{
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${DS.zinc200}`,
                      borderRadius: '6px',
                      backgroundColor: '#ffffff',
                      color: DS.zinc500,
                      cursor: isSaving ? 'not-allowed' : 'pointer',
                      transition: 'background-color 150ms, border-color 150ms, color 150ms',
                      flexShrink: 0,
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = `2px solid ${DS.emerald600}`;
                      e.currentTarget.style.outlineOffset = '2px';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.outline = 'none';
                    }}
                  >
                    {/* lucide: plus */}
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
                      <path d="M12 5v14" />
                    </svg>
                  </button>

                  <span
                    aria-hidden="true"
                    style={{
                      fontSize: '14px',
                      color: DS.zinc500,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    years
                  </span>
                </div>

                {/* Screen-reader hint (hidden visually; linked via aria-describedby) */}
                <span
                  id="years-hint"
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
                  Enter a value between 1 and 30 years. Default is 7 years.
                </span>

                {/* Inline validation error */}
                <div
                  id="years-error"
                  role="alert"
                  aria-live="assertive"
                  data-testid="years-error"
                  style={{
                    display: isFormInvalid ? 'flex' : 'none',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: DS.dangerIcon,
                    lineHeight: '16px',
                  }}
                >
                  {/* lucide: alert-circle */}
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
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                  <span>Enter a value between 1 and 30.</span>
                </div>
              </div>

              {/* ── Provenance line ──────────────────────────────────────────── */}
              {provenanceLine && (
                <p
                  data-testid="provenance-line"
                  style={{
                    fontSize: '12px',
                    color: DS.zinc500,
                    lineHeight: '16px',
                    margin: '0 0 24px',
                  }}
                >
                  {provenanceLine}
                </p>
              )}

              {/* ── Server-error alert ──────────────────────────────────────── */}
              {isError && (
                <div
                  role="alert"
                  aria-live="assertive"
                  aria-atomic="true"
                  data-testid="save-error-panel"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    padding: '12px 16px',
                    backgroundColor: DS.dangerBg,
                    border: `1px solid ${DS.dangerBorder}`,
                    borderRadius: '8px',
                    marginBottom: '16px',
                  }}
                >
                  {/* lucide: alert-triangle */}
                  <svg
                    aria-hidden="true"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={DS.dangerIcon}
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
                        color: DS.dangerText,
                        lineHeight: '18px',
                        marginBottom: '2px',
                      }}
                    >
                      Could not save retention policy
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: DS.dangerBody,
                        lineHeight: '18px',
                      }}
                    >
                      {errorMsg ??
                        'An unexpected error occurred. Please try again or contact support.'}
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
                        padding: '5px 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        color: DS.dangerIcon,
                        backgroundColor: '#ffffff',
                        border: `1px solid ${DS.dangerBorder}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'background-color 150ms',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.outline = `2px solid ${DS.dangerIcon}`;
                        e.currentTarget.style.outlineOffset = '2px';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.outline = 'none';
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
                      Retry
                    </button>
                  </div>
                </div>
              )}

              {/* ── Save row ─────────────────────────────────────────────────── */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginTop: provenanceLine ? '0' : '24px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* ── ONE primary CTA (emerald) — WORM/compliance design §10 ── */}
                  <button
                    type="button"
                    data-testid="save-btn"
                    disabled={!canSave}
                    aria-disabled={!canSave}
                    aria-busy={isSaving}
                    aria-label={isSaving ? 'Saving, please wait' : 'Save'}
                    aria-describedby="audit-note-text"
                    onClick={() => {
                      void handleSave();
                    }}
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
                      color: isSaving ? DS.emerald700 : '#ffffff',
                      backgroundColor: isSaving
                        ? DS.emerald100
                        : isSaved
                          ? DS.emerald50
                          : DS.emerald600,
                      border: isSaved ? `1px solid ${DS.emerald100}` : 'none',
                      borderRadius: '8px',
                      cursor: canSave ? 'pointer' : 'not-allowed',
                      transition: 'background-color 150ms, box-shadow 150ms',
                      outline: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (canSave && !isSaved) {
                        e.currentTarget.style.backgroundColor = DS.emerald700;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSaving && !isSaved) {
                        e.currentTarget.style.backgroundColor = DS.emerald600;
                      }
                    }}
                    onFocus={(e) => {
                      if (canSave) {
                        e.currentTarget.style.boxShadow = `0 0 0 3px ${DS.focusRing}`;
                      }
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {isSaving ? (
                      <>
                        <Spinner size={16} />
                        <span>Saving&hellip;</span>
                      </>
                    ) : isSaved ? (
                      <>
                        {/* lucide: check */}
                        <svg
                          aria-hidden="true"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Saved</span>
                      </>
                    ) : (
                      <>
                        {/* lucide: save */}
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
                          <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
                          <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
                          <path d="M7 3v4a1 1 0 0 0 1 1h7" />
                        </svg>
                        <span>Save</span>
                      </>
                    )}
                  </button>

                  {/* Saved confirmation pill — aria-live="polite" */}
                  <div
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                    data-testid="saved-pill"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: DS.emerald700,
                      backgroundColor: DS.emerald50,
                      border: `1px solid ${DS.emerald100}`,
                      borderRadius: '9999px',
                      padding: '4px 10px',
                      opacity: isSaved ? 1 : 0,
                      transition: 'opacity 200ms',
                    }}
                  >
                    {/* lucide: check */}
                    <svg
                      aria-hidden="true"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Saved
                  </div>
                </div>

                {/* ── Audit note — LOAD-BEARING, always rendered (non-loading) ── */}
                <div
                  id="audit-note-text"
                  role="note"
                  data-testid="audit-note"
                  aria-label="Compliance note: changes are recorded in the audit log"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    color: DS.zinc500,
                    lineHeight: '16px',
                  }}
                >
                  {/* lucide: shield-check */}
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={DS.emerald600}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <span>This change is recorded in your audit log.</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Cutoff-surfacing panel — READ-ONLY, INFORMATIONAL (WORM) ─────── */}
          <div
            role="note"
            aria-label="Retention cutoff — read-only informational panel"
            data-testid="cutoff-panel"
            style={{
              backgroundColor: DS.zinc50,
              border: `1px solid ${DS.zinc200}`,
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
            }}
          >
            {/* Icon */}
            <div
              aria-hidden="true"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: DS.zinc100,
                border: `1px solid ${DS.zinc200}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: DS.zinc500,
              }}
            >
              {/* lucide: calendar-clock */}
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h5" />
                <path d="M17.5 17.5 16 16.25V14" />
                <circle cx="16" cy="16" r="6" />
              </svg>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Eyebrow + Read-only badge */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase' as const,
                  color: DS.zinc400,
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                Retention cutoff
                <span
                  data-testid="readonly-badge"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.03em',
                    textTransform: 'uppercase' as const,
                    color: DS.zinc500,
                    backgroundColor: DS.zinc100,
                    border: `1px solid ${DS.zinc200}`,
                    borderRadius: '9999px',
                    padding: '2px 8px',
                    marginLeft: '8px',
                    verticalAlign: 'middle',
                  }}
                >
                  {/* lucide: lock */}
                  <svg
                    aria-hidden="true"
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Read-only
                </span>
              </div>

              {/* Statement */}
              {cutoffDate && !isFormInvalid ? (
                <p
                  data-testid="cutoff-statement"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: DS.zinc700,
                    lineHeight: '20px',
                    margin: '0 0 6px',
                  }}
                >
                  Under your{' '}
                  <strong style={{ color: DS.zinc800 }} data-testid="cutoff-years">
                    {years}-year
                  </strong>{' '}
                  policy, records dated before{' '}
                  <strong
                    style={{
                      color: DS.zinc800,
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                    data-testid="cutoff-date"
                  >
                    {formatCutoffDate(cutoffDate)}
                  </strong>{' '}
                  are eligible for deletion.
                </p>
              ) : (
                <p
                  data-testid="cutoff-statement-placeholder"
                  style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: DS.zinc400,
                    lineHeight: '20px',
                    margin: '0 0 6px',
                  }}
                >
                  {isFormInvalid
                    ? 'Enter a valid retention period above to preview the cutoff date.'
                    : 'Loading cutoff date…'}
                </p>
              )}

              {/* Note */}
              <p
                data-testid="cutoff-note"
                style={{
                  fontSize: '12px',
                  color: DS.zinc500,
                  lineHeight: '18px',
                  margin: 0,
                }}
              >
                Records are preserved. Deletion is not performed automatically — this policy
                determines the eligibility window only.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
