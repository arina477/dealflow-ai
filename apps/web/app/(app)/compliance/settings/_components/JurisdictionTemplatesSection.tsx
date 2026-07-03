/**
 * JurisdictionTemplatesSection — "Jurisdiction Templates" CRUD panel.
 *
 * Renders disclaimer templates (from GET /compliance/disclaimers) and allows:
 *   - Select a jurisdiction to view its active template
 *   - Edit (PATCH) a disclaimer body → creates a new version, deactivates prior
 *   - Create (POST) a disclaimer for a new jurisdiction
 *
 * Design: matches the "Jurisdiction Templates" panel in design/compliance-settings.html
 * (DESIGN-SYSTEM §10, zinc/emerald, textarea editor, version badge, amber warning for
 * missing jurisdiction).
 *
 * Accessibility:
 *   - Textarea is labeled via htmlFor.
 *   - Empty-jurisdiction warning uses role="alert".
 *   - Buttons have visible focus rings.
 *   - Version badge is presented in a <dl> for screen readers.
 */

'use client';

import type { DisclaimerCreate, DisclaimerTemplate } from '@dealflow/shared';
import { disclaimerCreateSchema, disclaimerUpdateSchema } from '@dealflow/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';

// ---------------------------------------------------------------------------
// Style primitives (§10)
// ---------------------------------------------------------------------------

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#4b5563',
  marginBottom: '4px',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '36px',
  padding: '0 12px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  fontSize: '14px',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: 'pointer',
  appearance: 'none' as React.CSSProperties['appearance'],
};

const BTN_DARK: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 16px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#111827',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 150ms ease',
};

const BTN_GHOST: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 150ms ease',
};

// ---------------------------------------------------------------------------
// Toast list
// ---------------------------------------------------------------------------

interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'error';
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: t.kind === 'success' ? '#d1fae5' : '#fecaca',
            backgroundColor: t.kind === 'success' ? '#ecfdf5' : '#fff1f2',
            color: t.kind === 'success' ? '#047857' : '#b91c1c',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 8px 24px rgb(16 24 40 / 0.12)',
            minWidth: '280px',
            pointerEvents: 'auto',
          }}
        >
          {t.kind === 'success' ? (
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
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
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
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface JurisdictionTemplatesSectionProps {
  initialTemplates: DisclaimerTemplate[];
}

export function JurisdictionTemplatesSection({
  initialTemplates,
}: JurisdictionTemplatesSectionProps) {
  // Map of jurisdiction → active template (the one with active=true)
  const activeByJurisdiction = useMemo(() => {
    const map = new Map<string, DisclaimerTemplate>();
    for (const t of initialTemplates) {
      if (!t.active) continue;
      const existing = map.get(t.jurisdiction);
      if (!existing || t.version > existing.version) {
        map.set(t.jurisdiction, t);
      }
    }
    return map;
  }, [initialTemplates]);

  const jurisdictions = useMemo(
    () => Array.from(activeByJurisdiction.keys()).sort(),
    [activeByJurisdiction]
  );

  // Local state
  const [templates, setTemplates] = useState<Map<string, DisclaimerTemplate>>(activeByJurisdiction);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>(jurisdictions[0] ?? '');
  const [newJurisdiction, setNewJurisdiction] = useState('');
  const [body, setBody] = useState<string>(() => {
    const active = activeByJurisdiction.get(jurisdictions[0] ?? '');
    return active?.body ?? '';
  });
  const [showNewForm, setShowNewForm] = useState(false);
  const [newBody, setNewBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, kind: Toast['kind']) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Sync body when selected jurisdiction changes
  useEffect(() => {
    const active = templates.get(selectedJurisdiction);
    setBody(active?.body ?? '');
    setError(null);
  }, [selectedJurisdiction, templates]);

  const activeTemplate = templates.get(selectedJurisdiction);
  const isMissing = selectedJurisdiction !== '' && !activeTemplate;
  const bodyIsEmpty = body.trim() === '';

  // ── Save / update existing template ────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setError(null);
    if (!activeTemplate && !showNewForm) return;

    if (bodyIsEmpty) {
      setError('Disclaimer body is required');
      return;
    }

    const validation = disclaimerUpdateSchema.safeParse({ body });
    if (!validation.success) {
      setError(validation.error.errors[0]?.message ?? 'Validation failed');
      return;
    }

    if (!activeTemplate) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/compliance/disclaimers/${activeTemplate.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(`Failed to save template (${res.status})`);
        return;
      }
      const updated = (await res.json()) as DisclaimerTemplate;
      setTemplates((prev) => new Map(prev).set(updated.jurisdiction, updated));
      pushToast(`Template saved (v${updated.version})`, 'success');
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }, [activeTemplate, body, bodyIsEmpty, showNewForm, pushToast]);

  // ── Create new jurisdiction template ──────────────────────────────────────

  const handleCreate = useCallback(async () => {
    setError(null);
    if (newBody.trim() === '') {
      setError('Disclaimer body is required');
      return;
    }

    const body2: DisclaimerCreate = {
      jurisdiction: newJurisdiction.trim().toUpperCase(),
      body: newBody.trim(),
    };

    const validation = disclaimerCreateSchema.safeParse(body2);
    if (!validation.success) {
      setError(validation.error.errors[0]?.message ?? 'Validation failed');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/compliance/disclaimers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body2),
        cache: 'no-store',
      });
      if (!res.ok) {
        setError(`Failed to create template (${res.status})`);
        return;
      }
      const created = (await res.json()) as DisclaimerTemplate;
      setTemplates((prev) => new Map(prev).set(created.jurisdiction, created));
      setSelectedJurisdiction(created.jurisdiction);
      setShowNewForm(false);
      setNewJurisdiction('');
      setNewBody('');
      pushToast(`Template created (${created.jurisdiction} v${created.version})`, 'success');
    } catch {
      setError('Network error — please try again');
    } finally {
      setSubmitting(false);
    }
  }, [newJurisdiction, newBody, pushToast]);

  const allJurisdictions = useMemo(() => Array.from(templates.keys()).sort(), [templates]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Jurisdiction templates"
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <ToastList toasts={toasts} />

      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #f3f4f6',
          backgroundColor: '#fcfcfd',
          flexShrink: 0,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 600,
            lineHeight: '22px',
            color: '#111827',
          }}
        >
          Jurisdiction Templates
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            aria-hidden="true"
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              boxShadow: '0 0 0 2px rgba(16 185 129 / 0.2)',
              display: 'inline-block',
            }}
          />
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>Auto-sync</span>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          flex: 1,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
        }}
      >
        {/* New template form toggle */}
        {!showNewForm ? (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            style={BTN_GHOST}
            onFocus={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            <svg
              aria-hidden="true"
              width="13"
              height="13"
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
            New Jurisdiction
          </button>
        ) : (
          /* New template inline form */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
            }}
          >
            <div>
              <label htmlFor="new-jurisdiction" style={LABEL_STYLE}>
                Jurisdiction Code
              </label>
              <input
                id="new-jurisdiction"
                type="text"
                value={newJurisdiction}
                onChange={(e) => setNewJurisdiction(e.target.value)}
                placeholder="e.g. EU, US, UK, APAC"
                required
                style={INPUT_STYLE}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.boxShadow =
                    '0 0 0 2px rgb(16 185 129 / 0.4)';
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#10b981';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db';
                }}
              />
            </div>
            <div>
              <label htmlFor="new-disclaimer-body" style={LABEL_STYLE}>
                Disclaimer Text
              </label>
              <textarea
                id="new-disclaimer-body"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Enter legally required disclaimer text..."
                rows={4}
                required
                style={{
                  ...INPUT_STYLE,
                  height: 'auto',
                  padding: '10px 12px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLTextAreaElement).style.boxShadow =
                    '0 0 0 2px rgb(16 185 129 / 0.4)';
                  (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#10b981';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLTextAreaElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#d1d5db';
                }}
              />
            </div>
            {error && (
              <p role="alert" style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowNewForm(false);
                  setError(null);
                }}
                style={BTN_GHOST}
                onFocus={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 0 0 2px rgb(16 185 129 / 0.4)';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={submitting || !newJurisdiction.trim() || !newBody.trim()}
                style={{ ...BTN_DARK, opacity: submitting ? 0.7 : 1 }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 0 0 2px rgb(16 185 129 / 0.4)';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {submitting ? 'Creating…' : 'Create Template'}
              </button>
            </div>
          </div>
        )}

        {/* Jurisdiction selector */}
        {allJurisdictions.length > 0 && (
          <div style={{ position: 'relative' }}>
            <label htmlFor="jurisdiction-select" style={LABEL_STYLE}>
              Scope Region
            </label>
            <select
              id="jurisdiction-select"
              value={selectedJurisdiction}
              onChange={(e) => setSelectedJurisdiction(e.target.value)}
              style={SELECT_STYLE}
              onFocus={(e) => {
                (e.currentTarget as HTMLSelectElement).style.boxShadow =
                  '0 0 0 2px rgb(16 185 129 / 0.4)';
                (e.currentTarget as HTMLSelectElement).style.borderColor = '#10b981';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLSelectElement).style.boxShadow = 'none';
                (e.currentTarget as HTMLSelectElement).style.borderColor = '#d1d5db';
              }}
            >
              {allJurisdictions.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
            <div
              aria-hidden="true"
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                right: '10px',
                bottom: '10px',
                color: '#6b7280',
              }}
            >
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
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        )}

        {/* Missing jurisdiction warning */}
        {isMissing && (
          <div
            role="alert"
            style={{
              display: 'flex',
              gap: '10px',
              padding: '12px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: '6px',
              fontSize: '13px',
              lineHeight: '18px',
            }}
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d97706"
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
              <p style={{ margin: '0 0 2px', fontWeight: 600, color: '#92400e' }}>
                Missing Requirement
              </p>
              <p style={{ margin: 0, color: '#b45309', opacity: 0.9 }}>
                Outreach to this region will be blocked until a valid disclaimer is provided.
              </p>
            </div>
          </div>
        )}

        {/* Version badge */}
        {activeTemplate && (
          <dl
            style={{
              display: 'flex',
              gap: '16px',
              margin: 0,
              padding: 0,
              alignItems: 'center',
            }}
          >
            <div>
              <dt
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Version
              </dt>
              <dd
                data-testid="disclaimer-version"
                style={{
                  margin: 0,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#374151',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                v{activeTemplate.version}
              </dd>
            </div>
            <div>
              <dt
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#9ca3af',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Status
              </dt>
              <dd style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    display: 'inline-block',
                  }}
                  aria-hidden="true"
                />
                <span style={{ fontSize: '13px', fontWeight: 500, color: '#047857' }}>Active</span>
              </dd>
            </div>
          </dl>
        )}

        {/* Disclaimer textarea editor */}
        {(activeTemplate || (isMissing && selectedJurisdiction)) && !showNewForm && (
          <>
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <label htmlFor="disclaimer-body" style={{ ...LABEL_STYLE, marginBottom: 0 }}>
                  Mandatory Text
                </label>
              </div>

              {/* Minimal toolbar (decorative — matches design) */}
              <div
                aria-hidden="true"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 8px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderBottom: 'none',
                  borderRadius: '4px 4px 0 0',
                }}
              >
                {['B', 'I'].map((label) => (
                  <button
                    key={label}
                    type="button"
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#6b7280',
                      fontSize: '13px',
                      fontWeight: label === 'B' ? 700 : 400,
                      fontStyle: label === 'I' ? 'italic' : 'normal',
                      cursor: 'pointer',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <textarea
                id="disclaimer-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Enter legally required footer text..."
                rows={6}
                spellCheck={false}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0 0 4px 4px',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: '#374151',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  minHeight: '120px',
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLTextAreaElement).style.boxShadow =
                    '0 0 0 2px rgb(16 185 129 / 0.4)';
                  (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#10b981';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLTextAreaElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLTextAreaElement).style.borderColor = '#e5e7eb';
                }}
              />

              {/* Email preview hint */}
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: '11px',
                  color: '#9ca3af',
                  backgroundColor: '#f9fafb',
                  border: '1px dashed #e5e7eb',
                  borderRadius: '4px',
                  padding: '6px 8px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: '#d1d5db',
                    borderRight: '1px solid #e5e7eb',
                    paddingRight: '8px',
                    marginRight: '8px',
                  }}
                >
                  Email Preview
                </span>
                Best regards, [Sender Name] —{' '}
                <span style={{ fontStyle: 'italic', color: '#d1d5db' }}>
                  Disclaimer appends here...
                </span>
              </p>
            </div>

            {error && (
              <p role="alert" style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
                {error}
              </p>
            )}

            {/* Save action */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                paddingTop: '8px',
                borderTop: '1px solid #f3f4f6',
              }}
            >
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={submitting || bodyIsEmpty || !activeTemplate}
                style={{
                  ...BTN_DARK,
                  opacity: submitting || bodyIsEmpty || !activeTemplate ? 0.6 : 1,
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 0 0 2px rgb(16 185 129 / 0.4)';
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                {submitting ? 'Saving…' : 'Save Template'}
              </button>
            </div>
          </>
        )}

        {/* Empty state: no templates exist at all */}
        {allJurisdictions.length === 0 && !showNewForm && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              padding: '24px',
              textAlign: 'center',
              color: '#6b7280',
            }}
          >
            <svg
              aria-hidden="true"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#d1d5db"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M9 15h6" />
              <path d="M9 11h6" />
            </svg>
            <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
              No disclaimer templates yet. Add a jurisdiction to get started.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
