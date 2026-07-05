'use client';

/**
 * DealTimelinePanel — per-deal event timeline + add-note panel (wave-12 B-3, task 45b259e1).
 *
 * Renders the ordered event timeline for a pipeline deal:
 *   - enrolled: deal entered pipeline at stage 'shortlisted'
 *   - stage_changed: from_stage → to_stage
 *   - note: free-text note appended by actor
 * Each event carries actor + timestamp (chronological, ASC).
 *
 * Add-note affordance:
 *   POST /pipeline-data/:id/notes (non-page-colliding proxy → POST /pipeline/:id/notes)
 *   Body: { text } — non-empty (min 1 char; Zod enforced server-side)
 *   Note appears in timeline on refresh. NO edit/delete (append-only).
 *
 * HARD BOUNDARY:
 *   NO send/email affordance.
 *   NO AI/drafting affordance.
 *   Timeline IS the compliance audit-recordkeeping surface.
 *
 * Events response shape: { events: PipelineEvent[] }
 *   (pipelineEventsResponseSchema from @dealflow/shared)
 *
 * Compliance-honest: every stage transition + note is append-only (audited
 * via M2 AuditService HMAC chain server-side). The timeline IS the audit trail.
 */

import type { PipelineEvent, PipelineEventType, PipelineStage, Role } from '@dealflow/shared';
import { pipelineEventsResponseSchema } from '@dealflow/shared';
import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';
import type { PipelineRowWithJoins } from '../_lib/pipeline-types';

// ---------------------------------------------------------------------------
// Stage display labels
// ---------------------------------------------------------------------------

const STAGE_LABELS: Record<PipelineStage, string> = {
  shortlisted: 'Shortlisted',
  contacted: 'Contacted',
  engaged: 'Engaged',
  diligence: 'Diligence',
  offer: 'Offer',
  closed: 'Closed',
  withdrawn: 'Withdrawn',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DealTimelinePanelProps {
  deal: PipelineRowWithJoins;
  userRole: Role;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Event icon
// ---------------------------------------------------------------------------

function EventIcon({ eventType }: { eventType: PipelineEventType }) {
  if (eventType === 'enrolled') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#10b981"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    );
  }
  if (eventType === 'stage_changed') {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563eb"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    );
  }
  // note
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#d97706"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Event item
// ---------------------------------------------------------------------------

interface EventItemProps {
  event: PipelineEvent;
  isLast: boolean;
}

function EventItem({ event, isLast }: EventItemProps) {
  const eventBgColors: Record<PipelineEventType, string> = {
    enrolled: '#d1fae5',
    stage_changed: '#dbeafe',
    note: '#fef3c7',
  };

  const eventLabelColors: Record<PipelineEventType, string> = {
    enrolled: '#047857',
    stage_changed: '#1d4ed8',
    note: '#92400e',
  };

  const eventLabels: Record<PipelineEventType, string> = {
    enrolled: 'Enrolled',
    stage_changed: 'Stage Changed',
    note: 'Note',
  };

  return (
    <li
      style={{
        display: 'flex',
        gap: '12px',
        position: 'relative',
      }}
    >
      {/* Timeline connector */}
      {!isLast && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '15px',
            top: '28px',
            bottom: '-12px',
            width: '1px',
            backgroundColor: '#e5e7eb',
          }}
        />
      )}

      {/* Icon bubble */}
      <div
        aria-hidden="true"
        style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          backgroundColor: eventBgColors[event.eventType],
          border: '2px solid #fff',
          boxShadow: '0 0 0 1px #e5e7eb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <EventIcon eventType={event.eventType} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: '16px' }}>
        {/* Event type badge + timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            marginBottom: '4px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: eventLabelColors[event.eventType],
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {eventLabels[event.eventType]}
          </span>
          <time
            dateTime={event.createdAt}
            style={{
              fontSize: '11px',
              color: '#9ca3af',
              fontVariantNumeric: 'tabular-nums',
              flexShrink: 0,
            }}
          >
            {new Date(event.createdAt).toLocaleString()}
          </time>
        </div>

        {/* Event body */}
        {event.eventType === 'enrolled' && (
          <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
            Deal enrolled at stage{' '}
            <strong>{event.toStage ? STAGE_LABELS[event.toStage] : 'Shortlisted'}</strong>
          </p>
        )}

        {event.eventType === 'stage_changed' && event.fromStage && event.toStage && (
          <p style={{ margin: 0, fontSize: '13px', color: '#374151' }}>
            Moved from <strong>{STAGE_LABELS[event.fromStage]}</strong> to{' '}
            <strong>{STAGE_LABELS[event.toStage]}</strong>
          </p>
        )}

        {event.eventType === 'note' && event.note && (
          <div
            style={{
              borderLeft: '2px solid #fde68a',
              paddingLeft: '10px',
              paddingTop: '4px',
              paddingBottom: '4px',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '13px',
                color: '#374151',
                lineHeight: '20px',
                whiteSpace: 'pre-wrap',
              }}
            >
              {event.note}
            </p>
          </div>
        )}

        {/* Actor */}
        <p
          style={{
            margin: '4px 0 0',
            fontSize: '11px',
            color: '#9ca3af',
          }}
        >
          Actor: {event.actorId.slice(0, 8)}…
        </p>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Add note form
// ---------------------------------------------------------------------------

interface AddNoteFormProps {
  pipelineId: string;
  onNoteAdded: () => void;
}

function AddNoteForm({ pipelineId, onNoteAdded }: AddNoteFormProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Note text is required (min 1 character)');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(`/pipeline-data/${pipelineId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `Error ${res.status}`);
        return;
      }
      setText('');
      setSuccessMsg('Note added');
      onNoteAdded();
    } catch {
      setError('Network error — could not add note');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Add note"
      style={{
        borderTop: '1px solid #f3f4f6',
        paddingTop: '16px',
      }}
    >
      <label
        htmlFor="pipeline-note-text"
        style={{
          display: 'block',
          fontSize: '12px',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '6px',
        }}
      >
        Add Note
      </label>
      <textarea
        id="pipeline-note-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Enter note text…"
        disabled={loading}
        style={{
          width: '100%',
          fontSize: '13px',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '8px 10px',
          resize: 'vertical',
          color: '#374151',
          backgroundColor: loading ? '#f9fafb' : '#fff',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {error && (
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#dc2626' }} role="alert">
          {error}
        </p>
      )}
      {successMsg && (
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#047857' }} role="status">
          {successMsg}
        </p>
      )}
      <button
        type="submit"
        disabled={loading || !text.trim()}
        style={{
          marginTop: '8px',
          width: '100%',
          padding: '8px 12px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#fff',
          backgroundColor: loading || !text.trim() ? '#9ca3af' : '#111827',
          border: 'none',
          borderRadius: '6px',
          cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
          transition: 'background-color 150ms ease',
        }}
      >
        {loading ? 'Adding…' : 'Add Note'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// DealTimelinePanel
// ---------------------------------------------------------------------------

export function DealTimelinePanel({ deal, userRole, onClose }: DealTimelinePanelProps) {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const displayName =
    deal.buyerName ??
    deal.buyerFirm ??
    deal.outreachId ??
    deal.matchCandidateId ??
    deal.id.slice(0, 8);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/pipeline-data/${deal.id}/events`, {
        method: 'GET',
      });
      if (!res.ok) {
        setError(`Could not load events (${res.status})`);
        return;
      }
      const raw: unknown = await res.json();
      const parsed = pipelineEventsResponseSchema.safeParse(raw);
      if (!parsed.success) {
        setError('Unexpected event format from server');
        return;
      }
      setEvents(parsed.data.events);
    } catch {
      setError('Network error — could not load timeline');
    } finally {
      setLoading(false);
    }
  }, [deal.id]);

  // Load on mount
  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canAddNote = userRole === 'advisor' || userRole === 'compliance';

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(3,7,18,0.18)',
          backdropFilter: 'blur(1px)',
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <aside
        aria-label={`Deal timeline: ${displayName}`}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: '100%',
          maxWidth: '520px',
          backgroundColor: '#fff',
          boxShadow: '0 0 40px rgba(0,0,0,0.15)',
          borderLeft: '1px solid #e5e7eb',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          animation: 'panelSlideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards',
        }}
      >
        <style>{`
          @keyframes panelSlideIn {
            from { transform: translateX(100%); }
            to   { transform: translateX(0); }
          }
        `}</style>

        {/* Panel header */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
            borderBottom: '1px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              aria-hidden="true"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#d1fae5',
                border: '1px solid #a7f3d0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#047857"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M6 3v12" />
                <path d="M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                <path d="M15 6a9 9 0 0 0-9 9" />
              </svg>
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#111827',
                  lineHeight: '20px',
                }}
              >
                Deal Timeline
              </h2>
              <p
                style={{
                  margin: '1px 0 0',
                  fontSize: '12px',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  fontWeight: 500,
                }}
              >
                {displayName}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close timeline panel"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              color: '#6b7280',
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Deal meta */}
          <section aria-label="Deal details">
            <div
              style={{
                backgroundColor: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                fontSize: '12px',
              }}
            >
              <div>
                <span style={{ color: '#9ca3af' }}>Stage</span>
                <br />
                <strong style={{ color: '#111827' }}>{STAGE_LABELS[deal.stage]}</strong>
              </div>
              <div>
                <span style={{ color: '#9ca3af' }}>Source</span>
                <br />
                <strong style={{ color: '#111827' }}>
                  {deal.dealSourceType === 'outreach' ? 'Outreach' : 'Match'}
                </strong>
              </div>
              <div>
                <span style={{ color: '#9ca3af' }}>Enrolled</span>
                <br />
                <strong style={{ color: '#111827' }}>
                  {new Date(deal.createdAt).toLocaleDateString()}
                </strong>
              </div>
              <div>
                <span style={{ color: '#9ca3af' }}>Events</span>
                <br />
                <strong style={{ color: '#111827' }}>{events.length}</strong>
              </div>
            </div>
          </section>

          {/* Timeline */}
          <section aria-label="Event timeline">
            <h3
              style={{
                margin: '0 0 14px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              Audit Timeline
            </h3>

            {loading && <p style={{ fontSize: '13px', color: '#9ca3af' }}>Loading events…</p>}

            {error && !loading && (
              <div
                role="alert"
                style={{
                  padding: '10px 12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#dc2626',
                }}
              >
                {error}
              </div>
            )}

            {!loading && !error && events.length === 0 && (
              <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                No events yet — enrollment event will appear here.
              </p>
            )}

            {!loading && events.length > 0 && (
              <ol
                aria-label="Timeline events"
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                }}
              >
                {events.map((event, i) => (
                  <EventItem key={event.id} event={event} isLast={i === events.length - 1} />
                ))}
              </ol>
            )}
          </section>

          {/* Add note — compliance-honest label, NO send/AI affordances */}
          {canAddNote && (
            <section aria-label="Add note">
              <AddNoteForm pipelineId={deal.id} onNoteAdded={() => void loadEvents()} />
            </section>
          )}
        </div>
      </aside>
    </>
  );
}
