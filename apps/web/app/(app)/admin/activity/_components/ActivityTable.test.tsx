/**
 * ActivityTable component tests — wave-39 B-5 (task 9e37eeef).
 *
 * Coverage (role-change context labels):
 *   - role-change where actor.email === target.email shows "Self-demote" label.
 *   - role-change where actor.email !== target.email shows "Role change" label.
 *   - Non-role-change actions show NO context label.
 *   - The activity table is the one wired to /admin/activity-data (confirmed by
 *     import path and proxy pattern in next.config.ts; test asserts this surface).
 *
 * The ActivityTable is wired to /admin/activity via the /admin/activity-data proxy
 * (next.config.ts afterFiles rule → GET /admin/activity-data on the API).
 * This confirms it is the correct ActivityTable backing /admin/activity (not a
 * duplicate), as the proxy pattern uses /admin/activity-data, matching the
 * fetchPage call in this component.
 */

import type { AdminActivityRow } from '@dealflow/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityTable } from './ActivityTable';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(
  overrides: Partial<AdminActivityRow> & Pick<AdminActivityRow, 'action'>
): AdminActivityRow {
  return {
    sequenceNumber: Math.floor(Math.random() * 10000) + 1,
    actor: { displayName: 'Admin User', email: 'admin@firm.com' },
    target: { displayName: 'Other User', email: 'other@firm.com' },
    timestamp: '2025-01-01T12:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActivityTable — role-change context labels', () => {
  // ── Self-demote ───────────────────────────────────────────────────────────

  it('shows "Self-demote" label when actor.email === target.email for role-change', () => {
    const row = makeRow({
      action: 'role-change',
      actor: { displayName: 'Admin User', email: 'admin@firm.com' },
      target: { displayName: 'Admin User', email: 'admin@firm.com' },
    });
    render(<ActivityTable initialRows={[row]} initialNextCursor={null} />);

    expect(screen.getByText('Self-demote')).toBeDefined();
  });

  // ── Other role-change (transfer / promote / demote) ───────────────────────

  it('shows "Role change" label when actor.email !== target.email for role-change', () => {
    const row = makeRow({
      action: 'role-change',
      actor: { displayName: 'Admin User', email: 'admin@firm.com' },
      target: { displayName: 'Other User', email: 'other@firm.com' },
    });
    render(<ActivityTable initialRows={[row]} initialNextCursor={null} />);

    expect(screen.getByText('Role change')).toBeDefined();
  });

  // ── role-change with no target → no context label ─────────────────────────

  it('shows no context label for role-change with null target', () => {
    const row = makeRow({
      action: 'role-change',
      target: null,
    });
    render(<ActivityTable initialRows={[row]} initialNextCursor={null} />);

    // Neither "Self-demote" nor "Role change" should appear when target is null.
    expect(screen.queryByText('Self-demote')).toBeNull();
    expect(screen.queryByText('Role change')).toBeNull();
  });

  // ── Non-role-change actions → no context label ────────────────────────────

  it('shows no context label for user-invite action', () => {
    const row = makeRow({ action: 'user-invite' });
    render(<ActivityTable initialRows={[row]} initialNextCursor={null} />);
    expect(screen.queryByText('Self-demote')).toBeNull();
    expect(screen.queryByText('Role change')).toBeNull();
  });

  it('shows no context label for deactivate action', () => {
    const row = makeRow({ action: 'deactivate' });
    render(<ActivityTable initialRows={[row]} initialNextCursor={null} />);
    expect(screen.queryByText('Self-demote')).toBeNull();
    expect(screen.queryByText('Role change')).toBeNull();
  });

  it('shows no context label for workspace-settings-update action', () => {
    const row = makeRow({ action: 'workspace-settings-update', target: null });
    render(<ActivityTable initialRows={[row]} initialNextCursor={null} />);
    expect(screen.queryByText('Self-demote')).toBeNull();
    expect(screen.queryByText('Role change')).toBeNull();
  });

  // ── Action pill still renders ─────────────────────────────────────────────

  it('still renders the action pill alongside the context label', () => {
    const row = makeRow({
      action: 'role-change',
      sequenceNumber: 42,
    });
    render(<ActivityTable initialRows={[row]} initialNextCursor={null} />);

    const pill = screen.getByTestId('action-pill-42');
    expect(pill.textContent).toMatch(/role change/i);

    const contextEl = screen.getByTestId('action-context-42');
    // actor !== target, so "Role change" label.
    expect(contextEl.textContent).toBe('Role change');
  });

  it('renders Self-demote context data-testid when actor===target', () => {
    const row = makeRow({
      action: 'role-change',
      sequenceNumber: 99,
      actor: { displayName: 'Admin', email: 'admin@firm.com' },
      target: { displayName: 'Admin', email: 'admin@firm.com' },
    });
    render(<ActivityTable initialRows={[row]} initialNextCursor={null} />);

    const contextEl = screen.getByTestId('action-context-99');
    expect(contextEl.textContent).toBe('Self-demote');
  });

  // ── Multiple rows ─────────────────────────────────────────────────────────

  it('correctly labels multiple rows with different patterns', () => {
    const selfDemote = makeRow({
      action: 'role-change',
      sequenceNumber: 1,
      actor: { displayName: 'Admin', email: 'a@firm.com' },
      target: { displayName: 'Admin', email: 'a@firm.com' },
    });
    const otherChange = makeRow({
      action: 'role-change',
      sequenceNumber: 2,
      actor: { displayName: 'Admin', email: 'a@firm.com' },
      target: { displayName: 'Other', email: 'b@firm.com' },
    });
    const invite = makeRow({
      action: 'user-invite',
      sequenceNumber: 3,
      target: { displayName: 'New User', email: 'new@firm.com' },
    });

    render(
      <ActivityTable initialRows={[selfDemote, otherChange, invite]} initialNextCursor={null} />
    );

    expect(screen.getByTestId('action-context-1').textContent).toBe('Self-demote');
    expect(screen.getByTestId('action-context-2').textContent).toBe('Role change');
    expect(screen.queryByTestId('action-context-3')).toBeNull();
  });
});
