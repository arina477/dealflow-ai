/**
 * SuppressionMatrixSection — "Suppression Matrix" CRUD panel.
 *
 * Renders the suppression list (from GET /compliance/suppression) and
 * allows the compliance user to:
 *   - Add a new suppression entry (POST /compliance/suppression)
 *   - Delete an entry (DELETE /compliance/suppression/:id — after confirmation)
 *
 * Design: matches the "Suppression Matrix" section in design/compliance-settings.html
 * (DESIGN-SYSTEM §10 zinc/emerald tokens, Add Entry modal, table with Entity/Reason/Added).
 *
 * Accessibility:
 *   - Modal dialog: focus-trapped on open; close on Escape.
 *   - All form fields labeled with htmlFor.
 *   - Destructive delete confirmed via window.confirm.
 */

'use client';

import type { SuppressionCreate, SuppressionEntry } from '@dealflow/shared';
import { suppressionCreateSchema, suppressionMatchTypeEnum } from '@dealflow/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '../../../_lib/apiFetch';

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

const BTN_EMERALD: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#10b981',
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
  transition: 'background-color 150ms ease, border-color 150ms ease',
};

const BTN_DANGER_ICON: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  borderRadius: '6px',
  border: '1px solid #fecaca',
  backgroundColor: 'transparent',
  color: '#b91c1c',
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 150ms ease',
};

// ---------------------------------------------------------------------------
// Focus trap hook for the modal
// ---------------------------------------------------------------------------

function useFocusTrap(ref: React.RefObject<HTMLDivElement | null>, active: boolean) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;

    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Auto-focus first focusable on open
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [active, ref]);
}

// ---------------------------------------------------------------------------
// Add suppression modal
// ---------------------------------------------------------------------------

interface AddSuppressionModalProps {
  onAdd: (entry: SuppressionEntry) => void;
  onClose: () => void;
}

function AddSuppressionModal({ onAdd, onClose }: AddSuppressionModalProps) {
  const [matchType, setMatchType] = useState<SuppressionEntry['matchType']>('email');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useFocusTrap(panelRef, true);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const body: SuppressionCreate = {
        matchType,
        value: value.trim().toLowerCase(),
        reason: reason.trim() || null,
      };

      const validation = suppressionCreateSchema.safeParse(body);
      if (!validation.success) {
        setError(validation.error.errors[0]?.message ?? 'Validation failed');
        return;
      }

      setSubmitting(true);
      try {
        const res = await apiFetch('/compliance/suppression', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          setError(
            res.status === 409
              ? 'This entry already exists in the suppression list'
              : `Failed to add entry (${res.status})${text ? `: ${text}` : ''}`
          );
          return;
        }
        const created = (await res.json()) as SuppressionEntry;
        onAdd(created);
      } catch {
        setError('Network error — please try again');
      } finally {
        setSubmitting(false);
      }
    },
    [matchType, value, reason, onAdd]
  );

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        backgroundColor: 'rgba(3, 7, 18, 0.4)',
        backdropFilter: 'blur(4px)',
      }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suppression-modal-title"
        style={{
          position: 'relative',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 24px rgb(16 24 40 / 0.12)',
          width: '100%',
          maxWidth: '440px',
          overflow: 'hidden',
        }}
      >
        {/* Modal header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #f3f4f6',
            backgroundColor: '#fcfcfd',
          }}
        >
          <h3
            id="suppression-modal-title"
            style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}
          >
            Add Suppression Entry
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'transparent',
              color: '#6b7280',
              cursor: 'pointer',
              outline: 'none',
            }}
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
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => void handleSubmit(e)}
          aria-label="Add suppression entry form"
          style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}
        >
          {error && (
            <p role="alert" style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
              {error}
            </p>
          )}

          {/* Match type */}
          <div>
            <label htmlFor="suppression-match-type" style={LABEL_STYLE}>
              Match Type
            </label>
            <select
              id="suppression-match-type"
              value={matchType}
              onChange={(e) => setMatchType(e.target.value as SuppressionEntry['matchType'])}
              required
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
              {suppressionMatchTypeEnum.options.map((v) => (
                <option key={v} value={v}>
                  {v === 'email' ? 'Email address' : 'Domain'}
                </option>
              ))}
            </select>
          </div>

          {/* Value */}
          <div>
            <label htmlFor="suppression-value" style={LABEL_STYLE}>
              {matchType === 'email' ? 'Email Address' : 'Domain'}
            </label>
            <input
              id="suppression-value"
              type={matchType === 'email' ? 'email' : 'text'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                matchType === 'email' ? 'e.g. blocked@example.com' : 'e.g. competitor.com'
              }
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

          {/* Reason */}
          <div>
            <label htmlFor="suppression-reason" style={LABEL_STYLE}>
              Reason{' '}
              <span
                style={{
                  fontWeight: 400,
                  textTransform: 'none',
                  color: '#9ca3af',
                  fontSize: '11px',
                }}
              >
                (optional)
              </span>
            </label>
            <input
              id="suppression-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Competitor Block, OFAC Sanction, Legal Hold"
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

          {/* Footer buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              paddingTop: '8px',
              borderTop: '1px solid #f3f4f6',
            }}
          >
            <button
              type="button"
              onClick={onClose}
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
              type="submit"
              disabled={submitting}
              style={{ ...BTN_EMERALD, opacity: submitting ? 0.7 : 1 }}
              onFocus={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  '0 0 0 2px rgb(16 185 129 / 0.4)';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }}
            >
              {submitting ? 'Adding…' : 'Append Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast list (local to this component)
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

interface SuppressionMatrixSectionProps {
  initialEntries: SuppressionEntry[];
}

export function SuppressionMatrixSection({ initialEntries }: SuppressionMatrixSectionProps) {
  const [entries, setEntries] = useState<SuppressionEntry[]>(initialEntries);
  const [modalOpen, setModalOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, kind: Toast['kind']) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const handleAdd = useCallback(
    (entry: SuppressionEntry) => {
      setEntries((prev) => [entry, ...prev]);
      setModalOpen(false);
      pushToast('Suppression entry added', 'success');
    },
    [pushToast]
  );

  const handleDelete = useCallback(
    async (entry: SuppressionEntry) => {
      const confirmed = window.confirm(
        `Remove "${entry.value}" from the suppression list? This cannot be undone.`
      );
      if (!confirmed) return;

      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        const res = await apiFetch(`/compliance/suppression/${entry.id}`, {
          method: 'DELETE',
          cache: 'no-store',
        });
        if (!res.ok) {
          setEntries((prev) => [entry, ...prev]);
          pushToast('Failed to remove entry', 'error');
          return;
        }
        pushToast('Suppression entry removed', 'success');
      } catch {
        setEntries((prev) => [entry, ...prev]);
        pushToast('Network error', 'error');
      }
    },
    [pushToast]
  );

  return (
    <section
      aria-label="Suppression matrix"
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
      {modalOpen && <AddSuppressionModal onAdd={handleAdd} onClose={() => setModalOpen(false)} />}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #f3f4f6',
          backgroundColor: '#ffffff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              lineHeight: '22px',
              color: '#111827',
            }}
          >
            Suppression Matrix
          </h2>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {entries.length.toLocaleString()} {entries.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={BTN_EMERALD}
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
          Add Entry
        </button>
      </div>

      {/* Table or empty state */}
      {entries.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            flex: 1,
            gap: '8px',
            textAlign: 'center',
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: '44px',
              height: '44px',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgb(16 24 40 / 0.08)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '4px',
            }}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <path d="M9 14h6" />
              <path d="M9 10h6" />
            </svg>
          </div>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            No entries found
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af', maxWidth: '220px' }}>
            Add entities to start blocking outreach.
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            style={{ ...BTN_GHOST, marginTop: '8px' }}
            onFocus={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                '0 0 0 2px rgb(16 185 129 / 0.4)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            Add First Entry
          </button>
        </div>
      ) : (
        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}
            aria-label="Suppression entries"
          >
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                {(['Value', 'Type', 'Reason', 'Added', ''] as const).map((col) => (
                  <th
                    key={col}
                    scope="col"
                    style={{
                      padding: '10px 16px',
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
              {entries.map((entry) => {
                const addedDate = new Date(entry.createdAt);
                const dateStr = addedDate.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: '2-digit',
                });
                return (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: '1px solid #f3f4f6' }}
                    data-testid={`suppression-row-${entry.id}`}
                  >
                    {/* Value */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: '#111827',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.value}
                    </td>

                    {/* Match type badge */}
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          border: '1px solid',
                          backgroundColor: entry.matchType === 'email' ? '#eff6ff' : '#f0fdf4',
                          color: entry.matchType === 'email' ? '#1d4ed8' : '#15803d',
                          borderColor: entry.matchType === 'email' ? '#bfdbfe' : '#bbf7d0',
                        }}
                      >
                        {entry.matchType}
                      </span>
                    </td>

                    {/* Reason */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#6b7280',
                        maxWidth: '160px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {entry.reason ?? (
                        <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>—</span>
                      )}
                    </td>

                    {/* Date added */}
                    <td
                      style={{
                        padding: '12px 16px',
                        fontSize: '13px',
                        color: '#9ca3af',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <time dateTime={entry.createdAt}>{dateStr}</time>
                    </td>

                    {/* Delete */}
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => void handleDelete(entry)}
                        aria-label={`Remove ${entry.value} from suppression list`}
                        style={BTN_DANGER_ICON}
                        onFocus={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.boxShadow =
                            '0 0 0 2px rgba(185 28 28 / 0.3)';
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#fff1f2';
                        }}
                        onBlur={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                            'transparent';
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
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
