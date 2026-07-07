/**
 * OutreachActivityList — client component for the "My open touches" list.
 *
 * Wave-20 B-3 (task b2acf4ce).
 *
 * Controlled component: receives `activities` as a prop (managed by the
 * parent OutreachActivityPanel). Status transition mutations are fired via
 * `onTransition(id, newStatus)` callback — the panel updates its state on
 * success. Per-row error state is managed locally for inline error display.
 *
 * Design-system: zinc/emerald table/card pattern (Linear/Stripe aesthetic).
 * Status colors per §1 design-system:
 *   planned   → amber-600 (#D97706)  — warn (pending)
 *   completed → emerald-600 (#10B981) — positive
 *   cancelled → zinc-400 (#9CA3AF)  — neutral (idle/cancelled)
 *
 * HARD BOUNDARY: NO external send, NO rich-text, NO reminders.
 * Status transitions only (planned → completed | cancelled).
 */
'use client';

import type { OutreachActivity, OutreachActivityStatus } from '@dealflow/shared';
import { outreachActivitySchema, updateOutreachActivitySchema } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Channel display helpers
// ---------------------------------------------------------------------------

const CHANNEL_LABELS: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  linkedin: 'LinkedIn',
  other: 'Other',
};

function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<
  OutreachActivityStatus,
  { bg: string; text: string; label: string }
> = {
  planned: { bg: '#FFFBEB', text: '#B45309', label: 'Planned' },
  completed: { bg: '#ECFDF5', text: '#047857', label: 'Completed' },
  cancelled: { bg: '#F9FAFB', text: '#6B7280', label: 'Cancelled' },
};

function StatusBadge({ status }: { status: OutreachActivityStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.planned;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: s.bg,
        color: s.text,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface OutreachActivityListProps {
  /** Controlled: activities managed by the parent panel. */
  activities: OutreachActivity[];
  /**
   * Called after a successful status-transition PATCH.
   * The parent panel updates its activities state from the returned row.
   */
  onTransitioned: (updated: OutreachActivity) => void;
}

// ---------------------------------------------------------------------------
// OutreachActivityList component
// ---------------------------------------------------------------------------

export function OutreachActivityList({ activities, onTransitioned }: OutreachActivityListProps) {
  const [transitioning, setTransitioning] = useState<Record<string, boolean>>({});
  const [transitionErrors, setTransitionErrors] = useState<Record<string, string>>({});

  /** Patch status transition: planned → completed | cancelled */
  async function handleTransition(id: string, newStatus: OutreachActivityStatus) {
    setTransitioning((prev) => ({ ...prev, [id]: true }));
    setTransitionErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    const payload = updateOutreachActivitySchema.safeParse({ status: newStatus });
    if (!payload.success) {
      setTransitioning((prev) => ({ ...prev, [id]: false }));
      setTransitionErrors((prev) => ({ ...prev, [id]: 'Invalid status transition.' }));
      return;
    }

    try {
      const res = await apiFetch(`/outreach-activity/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload.data),
      });

      if (res.ok) {
        const json: unknown = await res.json();
        const parseResult = outreachActivitySchema.safeParse(json);
        if (parseResult.success) {
          onTransitioned(parseResult.data);
          return;
        }
      }

      let errMsg = 'Failed to update status.';
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) errMsg = body.message;
      } catch {
        // ignore
      }
      setTransitionErrors((prev) => ({ ...prev, [id]: errMsg }));
    } catch {
      setTransitionErrors((prev) => ({ ...prev, [id]: 'Network error. Try again.' }));
    } finally {
      setTransitioning((prev) => ({ ...prev, [id]: false }));
    }
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <section
        aria-label="My open touches — empty"
        style={{
          backgroundColor: '#F9FAFB',
          border: '1px dashed #D1D5DB',
          borderRadius: '8px',
          padding: '48px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '8px',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 500,
            color: '#374151',
          }}
        >
          No outreach touches logged yet
        </p>
        <p style={{ margin: 0, fontSize: '13px', color: '#9CA3AF' }}>
          Use the form above to log your first outreach touch.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="My open touches">
      {/* Section header */}
      <div style={{ marginBottom: '12px' }}>
        <h2
          style={{
            margin: '0 0 2px',
            fontSize: '15px',
            fontWeight: 600,
            color: '#111827',
          }}
        >
          My open touches
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
          {activities.length} {activities.length === 1 ? 'touch' : 'touches'} — planned first, then
          by due date
        </p>
      </div>

      {/* Responsive table wrapper */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
        }}
      >
        <table
          role="table"
          aria-label="Outreach activity list"
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'fixed',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: '1px solid #F3F4F6',
                backgroundColor: '#F9FAFB',
              }}
            >
              {(['Channel', 'Subject', 'Status', 'Due', 'Actions'] as const).map((col) => (
                <th
                  key={col}
                  scope="col"
                  style={{
                    padding: '10px 16px',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#6B7280',
                    textAlign: 'left',
                    width:
                      col === 'Channel'
                        ? '100px'
                        : col === 'Status'
                          ? '110px'
                          : col === 'Due'
                            ? '120px'
                            : col === 'Actions'
                              ? '200px'
                              : undefined,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activities.map((activity, idx) => {
              const isLast = idx === activities.length - 1;
              const isTransitioning = transitioning[activity.id] ?? false;
              const transitionError = transitionErrors[activity.id];

              return (
                <tr
                  key={activity.id}
                  style={{
                    borderBottom: isLast ? 'none' : '1px solid #F3F4F6',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {/* Channel */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      color: '#374151',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {channelLabel(activity.channel)}
                  </td>

                  {/* Subject + notes */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      color: '#111827',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {activity.subject}
                    </div>
                    {activity.notes && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#6B7280',
                          marginTop: '2px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {activity.notes}
                      </div>
                    )}
                    {transitionError && (
                      <div
                        role="alert"
                        style={{
                          fontSize: '12px',
                          color: '#DC2626',
                          marginTop: '4px',
                        }}
                      >
                        {transitionError}
                      </div>
                    )}
                  </td>

                  {/* Status badge */}
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <StatusBadge status={activity.status} />
                  </td>

                  {/* Due date */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: '13px',
                      color: '#6B7280',
                      fontVariantNumeric: 'tabular-nums',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDate(activity.dueAt)}
                  </td>

                  {/* Actions: status transitions for 'planned' rows */}
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    {activity.status === 'planned' && (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          disabled={isTransitioning}
                          aria-label={`Mark "${activity.subject}" as completed`}
                          onClick={() => handleTransition(activity.id, 'completed')}
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: '#047857',
                            backgroundColor: '#ECFDF5',
                            border: '1px solid #A7F3D0',
                            borderRadius: '6px',
                            cursor: isTransitioning ? 'not-allowed' : 'pointer',
                            opacity: isTransitioning ? 0.6 : 1,
                            transition: 'opacity 150ms ease',
                          }}
                        >
                          {isTransitioning ? '…' : 'Complete'}
                        </button>
                        <button
                          type="button"
                          disabled={isTransitioning}
                          aria-label={`Cancel "${activity.subject}"`}
                          onClick={() => handleTransition(activity.id, 'cancelled')}
                          style={{
                            padding: '4px 12px',
                            fontSize: '12px',
                            fontWeight: 500,
                            color: '#6B7280',
                            backgroundColor: '#F9FAFB',
                            border: '1px solid #E5E7EB',
                            borderRadius: '6px',
                            cursor: isTransitioning ? 'not-allowed' : 'pointer',
                            opacity: isTransitioning ? 0.6 : 1,
                            transition: 'opacity 150ms ease',
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                    {activity.status !== 'planned' && (
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export type { OutreachActivity };
