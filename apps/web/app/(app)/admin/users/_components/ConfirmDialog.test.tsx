/**
 * ConfirmDialog component tests — wave-39 B-5 (task 9e37eeef).
 *
 * Coverage:
 *   - onConfirm fires only on confirm button click.
 *   - Esc key calls onCancel without onConfirm.
 *   - Cancel button calls onCancel without onConfirm.
 *   - Overlay click calls onCancel.
 *   - Focus-trap: Tab cycles within the panel.
 *   - Shift+Tab wraps to last focusable element.
 *   - Focus moves into panel on mount.
 *   - Blocked state: confirm button absent, warning visible, onConfirm NOT callable.
 *   - Loading state: confirm button shows "Processing…" + aria-busy.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  render(
    <ConfirmDialog
      title="Delete item"
      body="This action cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );

  return { onConfirm, onCancel };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ConfirmDialog', () => {
  // ── Basic rendering ───────────────────────────────────────────────────────

  it('renders title and body text', () => {
    renderDialog();
    expect(screen.getByRole('heading', { name: /delete item/i })).toBeDefined();
    expect(screen.getByText(/cannot be undone/i)).toBeDefined();
  });

  it('renders role="dialog" with aria-modal', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('labels the dialog with aria-labelledby pointing to the title', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const titleEl = labelledBy ? document.getElementById(labelledBy) : null;
    expect(titleEl?.textContent).toMatch(/delete item/i);
  });

  // ── onConfirm ─────────────────────────────────────────────────────────────

  it('calls onConfirm when the confirm button is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('does NOT call onConfirm when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // ── Esc key ───────────────────────────────────────────────────────────────

  it('calls onCancel on Esc key press, not onConfirm', async () => {
    const user = userEvent.setup();
    const { onConfirm, onCancel } = renderDialog();

    // Focus into the dialog to receive key events.
    screen.getByRole('dialog').focus();
    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Overlay click ─────────────────────────────────────────────────────────

  it('calls onCancel when clicking the overlay (outside the panel)', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    // The backdrop is an accessible button with aria-label "Close dialog".
    const backdrop = screen.getByRole('button', { name: /close dialog/i });
    await user.click(backdrop);

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  // ── Focus management ──────────────────────────────────────────────────────

  it('moves focus into the panel on mount', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog');
    // The focused element should be inside the dialog panel.
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  // ── Focus-trap (Tab) ──────────────────────────────────────────────────────

  it('keeps Tab within focusable elements in the panel', async () => {
    const user = userEvent.setup();
    renderDialog();

    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled])')
    );

    // There should be at least Cancel + Confirm.
    expect(focusable.length).toBeGreaterThanOrEqual(2);

    // Tab from last focusable should wrap to first.
    focusable[focusable.length - 1]?.focus();
    await user.tab();
    expect(document.activeElement).toBe(focusable[0]);
  });

  it('wraps Shift+Tab from first focusable to last', async () => {
    const user = userEvent.setup();
    renderDialog();

    const dialog = screen.getByRole('dialog');
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled])')
    );

    // Shift+Tab from first should wrap to last.
    focusable[0]?.focus();
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });

  // ── Blocked state ─────────────────────────────────────────────────────────

  it('renders warning instead of confirm button when blockedReason is set', () => {
    renderDialog({ blockedReason: 'Cannot proceed: last admin.' });

    // Warning notice is visible.
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByRole('alert').textContent).toMatch(/cannot proceed/i);

    // Confirm button is absent.
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
  });

  it('does NOT call onConfirm in blocked state (no confirm button)', async () => {
    const user = userEvent.setup();
    const { onConfirm } = renderDialog({ blockedReason: 'Action blocked.' });

    // Cancel is still present.
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    // onConfirm must never be called.
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ── Loading state ─────────────────────────────────────────────────────────

  it('shows "Processing…" and aria-busy when loading=true', () => {
    renderDialog({ loading: true });

    const confirmBtn = screen.getByRole('button', { name: /processing/i });
    expect(confirmBtn).toBeDefined();
    expect(confirmBtn.getAttribute('aria-busy')).toBe('true');
  });

  it('disables Cancel when loading=true', () => {
    renderDialog({ loading: true });

    const cancelBtn = screen.getByRole('button', { name: /cancel/i }) as HTMLButtonElement;
    expect(cancelBtn.disabled).toBe(true);
  });

  // ── Confirm label ─────────────────────────────────────────────────────────

  it('uses custom confirmLabel prop', () => {
    renderDialog({ confirmLabel: 'Transfer admin' });
    expect(screen.getByRole('button', { name: /transfer admin/i })).toBeDefined();
  });
});
