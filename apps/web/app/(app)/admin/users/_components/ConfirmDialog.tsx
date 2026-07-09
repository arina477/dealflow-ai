/**
 * ConfirmDialog — reusable destructive-action confirmation modal.
 *
 * DESIGN-SYSTEM § Modal/Drawer:
 *   overlay zinc-950 @ 50%; panel --radius-lg + --shadow-md.
 *   focus-trap, Esc closes, role="dialog" + aria-modal.
 *   Focus returns to the trigger element on close.
 *
 * Props:
 *   title        — modal heading.
 *   body         — descriptive consequence text.
 *   confirmLabel — label on the danger confirm button (default "Confirm").
 *   onConfirm    — called only when the user clicks the confirm button.
 *   onCancel     — called when Esc is pressed or Cancel is clicked.
 *   blockedReason — when set, replaces the confirm button with a non-interactive
 *                   warning. The action cannot proceed in this state (e.g. last-admin).
 *
 * Usage:
 *   const triggerRef = useRef<HTMLButtonElement>(null);
 *   <button ref={triggerRef} onClick={() => setOpen(true)}>Action</button>
 *   {open && (
 *     <ConfirmDialog
 *       title="Title"
 *       body="Consequence description."
 *       confirmLabel="Proceed"
 *       onConfirm={handleConfirm}
 *       onCancel={() => { setOpen(false); triggerRef.current?.focus(); }}
 *     />
 *   )}
 */

'use client';

import { useCallback, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Focusable element selector (focus-trap scope)
// ---------------------------------------------------------------------------

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  /** Dialog heading — concise action title. */
  title: string;
  /** Consequence description displayed in the dialog body. */
  body: string;
  /** Label for the danger confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Called when the user clicks the confirm button. */
  onConfirm: () => void;
  /** Called when the user cancels (Esc key or Cancel button). */
  onCancel: () => void;
  /**
   * When set, shows a warning notice instead of the confirm button.
   * The action is blocked and cannot proceed.
   */
  blockedReason?: string;
  /** Whether the confirm action is in-progress (loading state). */
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  blockedReason,
  loading = false,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Focus management ──────────────────────────────────────────────────────

  // Move focus into the panel on mount.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Focus the first focusable element inside the panel.
    const first = panel.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    first?.focus();

    return () => {
      // Focus is returned to the trigger by the caller in onCancel/onConfirm.
    };
  }, []);

  // Focus-trap: keep Tab/Shift+Tab cycling within the dialog.
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // Shift+Tab: if on first, wrap to last.
        if (active === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        // Tab: if on last, wrap to first.
        if (active === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    },
    [onCancel]
  );

  // ── Overlay click handler (click-outside cancels) ─────────────────────────

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    // Only cancel if the click landed directly on the overlay, not the panel.
    if (e.target === e.currentTarget) {
      onCancel();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    /* Overlay */
    <div
      aria-label="Dialog backdrop"
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.5)', // zinc-950 @ 50%
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
    >
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-body"
        onKeyDown={handleKeyDown}
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '12px', // --radius-lg
          boxShadow: '0 8px 24px rgb(16 24 40 / 0.12)', // --shadow-md
          padding: '24px',
          maxWidth: '440px',
          width: '100%',
          margin: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Title */}
        <h2
          id="confirm-dialog-title"
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            lineHeight: '24px',
            color: '#111827',
          }}
        >
          {title}
        </h2>

        {/* Body */}
        <p
          id="confirm-dialog-body"
          style={{
            margin: 0,
            fontSize: '14px',
            lineHeight: '20px',
            color: '#374151',
          }}
        >
          {body}
        </p>

        {/* Blocked-reason notice — replaces confirm button */}
        {blockedReason && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: '6px',
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              fontSize: '13px',
              lineHeight: '18px',
              border: '1px solid #fca5a5',
            }}
          >
            {blockedReason}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginTop: '4px',
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '6px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#ffffff',
              color: '#374151',
              fontSize: '13px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Cancel
          </button>

          {/* Only render confirm button when action is not blocked */}
          {!blockedReason && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              aria-busy={loading}
              style={{
                height: '36px',
                padding: '0 16px',
                borderRadius: '6px',
                border: 'none',
                // Destructive variant: --status-danger
                backgroundColor: loading ? '#f87171' : '#dc2626',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 500,
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Processing…' : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
