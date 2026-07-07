/**
 * /outreach/activity — unit tests (wave-20 B-3, task b2acf4ce).
 *
 * Tests:
 *   1. OutreachActivityForm — create form renders + validation + submit.
 *   2. OutreachActivityList — list renders + empty state + status transitions.
 *   3. OutreachActivityPanel — form + list composition (onCreated prepends).
 *   4. RBAC gate — /outreach-activity route: advisor/admin allowed;
 *      analyst/compliance denied.
 *
 * Uses: vitest + @testing-library/react (same as the rest of the web test suite).
 * Mocks: apiFetch (avoids real network calls in unit tests).
 * No Playwright (unit layer only).
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// RBAC imports
// ---------------------------------------------------------------------------

import { canAccess, rolesForRoute } from '@dealflow/shared';

// ---------------------------------------------------------------------------
// Component imports
// ---------------------------------------------------------------------------

import type { OutreachActivity } from '@dealflow/shared';
import { OutreachActivityForm } from './_components/OutreachActivityForm';
import { OutreachActivityList } from './_components/OutreachActivityList';
import { OutreachActivityPanel } from './_components/OutreachActivityPanel';

// ---------------------------------------------------------------------------
// apiFetch mock (prevents real network calls)
// The components in _components/ import apiFetch as '../../../_lib/apiFetch'
// (relative to _components/). Vitest resolves module IDs to their real path,
// so we mock via the path relative to THIS test file: '../../_lib/apiFetch'.
// ---------------------------------------------------------------------------

vi.mock('../../_lib/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../../_lib/apiFetch';
const mockApiFetch = vi.mocked(apiFetch);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLANNED_ACTIVITY: OutreachActivity = {
  id: '11111111-1111-1111-1111-111111111111',
  workspaceId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  channel: 'call',
  status: 'planned',
  subject: 'Follow-up with ABC Capital',
  notes: 'Discussed term sheet',
  dueAt: '2026-07-10T00:00:00.000Z',
  completedAt: null,
  outreachId: null,
  matchCandidateId: null,
  pipelineId: null,
  mandateId: null,
  createdBy: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  createdAt: '2026-07-07T10:00:00.000Z',
  updatedAt: null,
};

const COMPLETED_ACTIVITY: OutreachActivity = {
  ...PLANNED_ACTIVITY,
  id: '22222222-2222-2222-2222-222222222222',
  status: 'completed',
  subject: 'Intro call with XYZ PE',
  completedAt: '2026-07-06T15:00:00.000Z',
};

// ---------------------------------------------------------------------------
// RBAC tests — /outreach-activity (advisor + admin see; analyst/compliance denied)
// ---------------------------------------------------------------------------

describe('RBAC: /outreach-activity route', () => {
  it('advisor is allowed on /outreach-activity', () => {
    const roles = rolesForRoute('/outreach-activity');
    expect(roles).toContain('advisor');
  });

  it('admin is allowed on /outreach-activity', () => {
    const roles = rolesForRoute('/outreach-activity');
    expect(roles).toContain('admin');
  });

  it('analyst is denied on /outreach-activity', () => {
    const roles = rolesForRoute('/outreach-activity');
    expect(roles).not.toContain('analyst');
    expect(canAccess('analyst', '/outreach-activity')).toBe(false);
  });

  it('compliance is denied on /outreach-activity', () => {
    const roles = rolesForRoute('/outreach-activity');
    expect(roles).not.toContain('compliance');
    expect(canAccess('compliance', '/outreach-activity')).toBe(false);
  });

  it('advisor canAccess /outreach-activity', () => {
    expect(canAccess('advisor', '/outreach-activity')).toBe(true);
  });

  it('admin canAccess /outreach-activity', () => {
    expect(canAccess('admin', '/outreach-activity')).toBe(true);
  });

  it('/outreach-activity route has exactly advisor + admin (2 roles)', () => {
    const roles = [...rolesForRoute('/outreach-activity')].sort();
    expect(roles).toEqual(['admin', 'advisor']);
  });

  it('/outreach-activity/:id route has exactly advisor + admin (2 roles)', () => {
    const roles = [...rolesForRoute('/outreach-activity/some-uuid')].sort();
    expect(roles).toEqual(['admin', 'advisor']);
  });

  it('/outreach/activity page route has advisor + admin', () => {
    const roles = [...rolesForRoute('/outreach/activity')].sort();
    expect(roles).toEqual(['admin', 'advisor']);
  });

  it('analyst canAccess /outreach/activity returns false', () => {
    expect(canAccess('analyst', '/outreach/activity')).toBe(false);
  });

  it('compliance canAccess /outreach/activity returns false', () => {
    expect(canAccess('compliance', '/outreach/activity')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// OutreachActivityForm — create form
// ---------------------------------------------------------------------------

describe('OutreachActivityForm', () => {
  const noopOnCreated = vi.fn();

  it('renders the create form with channel, subject, notes, dueAt fields', () => {
    render(<OutreachActivityForm mandateOptions={[]} onCreated={noopOnCreated} />);
    expect(screen.getByRole('form', { name: /log outreach touch/i })).toBeDefined();
    expect(screen.getByLabelText(/channel/i)).toBeDefined();
    expect(screen.getByLabelText(/subject/i)).toBeDefined();
    expect(screen.getByLabelText(/notes/i)).toBeDefined();
    expect(screen.getByLabelText(/due date/i)).toBeDefined();
  });

  it('renders the Log touch submit button', () => {
    render(<OutreachActivityForm mandateOptions={[]} onCreated={noopOnCreated} />);
    expect(screen.getByRole('button', { name: /log touch/i })).toBeDefined();
  });

  it('shows validation error when channel is not selected', async () => {
    render(<OutreachActivityForm mandateOptions={[]} onCreated={noopOnCreated} />);

    // Fill subject but leave channel empty
    const subjectInput = screen.getByLabelText(/subject/i);
    fireEvent.change(subjectInput, { target: { value: 'Test subject' } });
    fireEvent.click(screen.getByRole('button', { name: /log touch/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/channel is required/i)).toBeDefined();
    });
  });

  it('shows validation error when subject is empty', async () => {
    render(<OutreachActivityForm mandateOptions={[]} onCreated={noopOnCreated} />);

    // Select channel but leave subject empty
    const channelSelect = screen.getByLabelText(/channel/i);
    fireEvent.change(channelSelect, { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: /log touch/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/subject is required/i)).toBeDefined();
    });
  });

  it('renders mandate dropdown when mandateOptions are provided', () => {
    const opts = [{ id: 'uuid-1', label: 'Acme Manufacturing' }];
    render(<OutreachActivityForm mandateOptions={opts} onCreated={noopOnCreated} />);
    expect(screen.getByLabelText(/linked mandate/i)).toBeDefined();
    expect(screen.getByText('Acme Manufacturing')).toBeDefined();
  });

  it('does NOT render mandate dropdown when mandateOptions is empty', () => {
    render(<OutreachActivityForm mandateOptions={[]} onCreated={noopOnCreated} />);
    expect(screen.queryByLabelText(/linked mandate/i)).toBeNull();
  });

  it('calls onCreated with the new activity after successful POST 201', async () => {
    const onCreated = vi.fn();
    const newActivity: OutreachActivity = {
      ...PLANNED_ACTIVITY,
      id: '33333333-3333-3333-3333-333333333333',
      channel: 'email',
      subject: 'New outreach touch',
    };

    mockApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(newActivity), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<OutreachActivityForm mandateOptions={[]} onCreated={onCreated} />);

    const channelSelect = screen.getByLabelText(/channel/i);
    const subjectInput = screen.getByLabelText(/subject/i);

    fireEvent.change(channelSelect, { target: { value: 'email' } });
    fireEvent.change(subjectInput, { target: { value: 'New outreach touch' } });
    fireEvent.click(screen.getByRole('button', { name: /log touch/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: newActivity.id }));
    });
  });

  it('shows error banner on non-201 response', async () => {
    mockApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<OutreachActivityForm mandateOptions={[]} onCreated={noopOnCreated} />);

    const channelSelect = screen.getByLabelText(/channel/i);
    const subjectInput = screen.getByLabelText(/subject/i);

    fireEvent.change(channelSelect, { target: { value: 'call' } });
    fireEvent.change(subjectInput, { target: { value: 'Test touch' } });
    fireEvent.click(screen.getByRole('button', { name: /log touch/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('does not render any "Send" button (no external send affordance)', () => {
    render(<OutreachActivityForm mandateOptions={[]} onCreated={noopOnCreated} />);
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// OutreachActivityList — list + empty state + status transitions
// ---------------------------------------------------------------------------

const noopOnTransitioned = vi.fn();

describe('OutreachActivityList — empty state', () => {
  it('renders empty state when activities is empty', () => {
    render(<OutreachActivityList activities={[]} onTransitioned={noopOnTransitioned} />);
    expect(
      screen.getByRole('region', { name: /my open touches.*empty/i })
    ).toBeDefined();
    expect(screen.getByText(/no outreach touches logged yet/i)).toBeDefined();
  });

  it('empty state shows guidance text', () => {
    render(<OutreachActivityList activities={[]} onTransitioned={noopOnTransitioned} />);
    expect(screen.getByText(/use the form above/i)).toBeDefined();
  });
});

describe('OutreachActivityList — with data', () => {
  it('renders the list with activity data', () => {
    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);
    expect(screen.getByRole('region', { name: /my open touches$/i })).toBeDefined();
    expect(screen.getByText('Follow-up with ABC Capital')).toBeDefined();
  });

  it('renders channel label', () => {
    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);
    expect(screen.getByText('Call')).toBeDefined();
  });

  it('renders status badge for planned activity', () => {
    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);
    expect(screen.getByText('Planned')).toBeDefined();
  });

  it('renders status badge for completed activity', () => {
    render(<OutreachActivityList activities={[COMPLETED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);
    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('renders Complete and Cancel action buttons for planned activities', () => {
    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);
    expect(
      screen.getByRole('button', { name: /mark.*as completed/i })
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: /cancel.*follow-up/i })
    ).toBeDefined();
  });

  it('does NOT render action buttons for completed activities', () => {
    render(<OutreachActivityList activities={[COMPLETED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);
    expect(screen.queryByRole('button', { name: /complete/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
  });

  it('shows notes when present', () => {
    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);
    expect(screen.getByText('Discussed term sheet')).toBeDefined();
  });

  it('renders table with accessible column headers', () => {
    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);
    expect(screen.getByRole('table', { name: /outreach activity list/i })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /channel/i })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /subject/i })).toBeDefined();
    expect(screen.getByRole('columnheader', { name: /status/i })).toBeDefined();
  });
});

describe('OutreachActivityList — status transitions', () => {
  it('calls onTransitioned with the updated activity on Complete button click', async () => {
    const onTransitioned = vi.fn();
    const completedVersion: OutreachActivity = { ...PLANNED_ACTIVITY, status: 'completed' };
    mockApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(completedVersion), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={onTransitioned} />);

    const completeBtn = screen.getByRole('button', { name: /mark.*as completed/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(onTransitioned).toHaveBeenCalledWith(
        expect.objectContaining({ id: PLANNED_ACTIVITY.id, status: 'completed' })
      );
    });
  });

  it('calls onTransitioned with the cancelled activity on Cancel button click', async () => {
    const onTransitioned = vi.fn();
    const cancelledVersion: OutreachActivity = { ...PLANNED_ACTIVITY, status: 'cancelled' };
    mockApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(cancelledVersion), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={onTransitioned} />);

    const cancelBtn = screen.getByRole('button', { name: /cancel.*follow-up/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(onTransitioned).toHaveBeenCalledWith(
        expect.objectContaining({ id: PLANNED_ACTIVITY.id, status: 'cancelled' })
      );
    });
  });

  it('shows inline error on transition failure', async () => {
    mockApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(<OutreachActivityList activities={[PLANNED_ACTIVITY]} onTransitioned={noopOnTransitioned} />);

    const completeBtn = screen.getByRole('button', { name: /mark.*as completed/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});

// ---------------------------------------------------------------------------
// OutreachActivityPanel — form + list wired together
// ---------------------------------------------------------------------------

describe('OutreachActivityPanel', () => {
  it('renders both the form and the list', () => {
    render(
      <OutreachActivityPanel
        initialActivities={[PLANNED_ACTIVITY]}
        mandateOptions={[]}
      />
    );
    expect(screen.getByRole('form', { name: /log outreach touch/i })).toBeDefined();
    expect(screen.getByRole('region', { name: /my open touches$/i })).toBeDefined();
  });

  it('renders empty list state when no initial activities', () => {
    render(
      <OutreachActivityPanel
        initialActivities={[]}
        mandateOptions={[]}
      />
    );
    expect(screen.getByText(/no outreach touches logged yet/i)).toBeDefined();
  });

  it('prepends a newly created activity to the list on form submit', async () => {
    const newActivity: OutreachActivity = {
      ...PLANNED_ACTIVITY,
      id: '44444444-4444-4444-4444-444444444444',
      channel: 'linkedin',
      subject: 'New LinkedIn touch',
    };

    mockApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(newActivity), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(
      <OutreachActivityPanel
        initialActivities={[PLANNED_ACTIVITY]}
        mandateOptions={[]}
      />
    );

    // Initially one activity
    expect(screen.getByText('Follow-up with ABC Capital')).toBeDefined();

    // Submit new activity via form
    const channelSelect = screen.getByLabelText(/channel/i);
    const subjectInput = screen.getByLabelText(/subject/i);
    fireEvent.change(channelSelect, { target: { value: 'linkedin' } });
    fireEvent.change(subjectInput, { target: { value: 'New LinkedIn touch' } });
    fireEvent.click(screen.getByRole('button', { name: /log touch/i }));

    await waitFor(() => {
      // New activity appears in the list
      expect(screen.getByText('New LinkedIn touch')).toBeDefined();
      // Old activity still present
      expect(screen.getByText('Follow-up with ABC Capital')).toBeDefined();
    });
  });

  it('updates activity status in the list after transition', async () => {
    const completedVersion: OutreachActivity = { ...PLANNED_ACTIVITY, status: 'completed' };
    mockApiFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(completedVersion), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    render(
      <OutreachActivityPanel
        initialActivities={[PLANNED_ACTIVITY]}
        mandateOptions={[]}
      />
    );

    const completeBtn = screen.getByRole('button', { name: /mark.*as completed/i });
    fireEvent.click(completeBtn);

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeDefined();
      expect(screen.queryByRole('button', { name: /complete/i })).toBeNull();
    });
  });

  it('does not render any AI, send, or notification affordance', () => {
    render(
      <OutreachActivityPanel
        initialActivities={[]}
        mandateOptions={[]}
      />
    );
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /remind/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /notif/i })).toBeNull();
  });
});
