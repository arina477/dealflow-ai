/**
 * OutreachActivityPanel — client island composing form + list.
 *
 * Wave-20 B-3 (task b2acf4ce).
 *
 * This component is the single client boundary for /outreach/activity.
 * It owns the `activities` state so:
 *   - onCreated from the form prepends the new activity to the top.
 *   - onTransitioned from the list replaces the updated activity in-place.
 *
 * Props are SSR-injected by the server page:
 *   initialActivities — SSR-fetched list (may be empty).
 *   mandateOptions    — SSR-fetched mandate labels for the 0-or-1 link dropdown.
 */
'use client';

import type { OutreachActivity } from '@dealflow/shared';
import { useState } from 'react';
import type { MandateOption } from './OutreachActivityForm';
import { OutreachActivityForm } from './OutreachActivityForm';
import { OutreachActivityList } from './OutreachActivityList';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OutreachActivityPanelProps {
  initialActivities: OutreachActivity[];
  mandateOptions: MandateOption[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OutreachActivityPanel({
  initialActivities,
  mandateOptions,
}: OutreachActivityPanelProps) {
  const [activities, setActivities] = useState<OutreachActivity[]>(initialActivities);

  /** Called by form after POST 201 — prepend to list. */
  function handleCreated(activity: OutreachActivity) {
    setActivities((prev) => [activity, ...prev]);
  }

  /** Called by list after PATCH 200 — replace updated row in-place. */
  function handleTransitioned(updated: OutreachActivity) {
    setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Create form */}
      <OutreachActivityForm mandateOptions={mandateOptions} onCreated={handleCreated} />

      {/* My open touches list (controlled: receives activities from panel state) */}
      <OutreachActivityList activities={activities} onTransitioned={handleTransitioned} />
    </div>
  );
}
