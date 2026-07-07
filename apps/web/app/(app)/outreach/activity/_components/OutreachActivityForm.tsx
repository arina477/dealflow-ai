/**
 * OutreachActivityForm — client component for POST /outreach-activity (create).
 *
 * Wave-20 B-3 (task b2acf4ce). MandateForm pattern.
 *
 * Fields:
 *   channel (required select: call | email | linkedin | other)
 *   subject (required text)
 *   notes   (optional textarea)
 *   dueAt   (optional date)
 *   status  (defaults 'planned' — server default; not shown in create form)
 *
 * 0-or-1 deal-target link: mandateId (optional dropdown).
 *   v1: mandateId only (simplest useful link). outreachId/matchCandidateId/
 *   pipelineId deferred (keep contract nullable per the shared schema).
 *
 * On submit: validates with createOutreachActivitySchema, POSTs to
 * /outreach-activity (afterFiles proxy → POST /outreach-activity on API),
 * on 201 calls onCreated() to trigger a list refresh.
 *
 * HARD BOUNDARY: NO external send, NO reminders, NO rich-text.
 * Internal record only.
 */
'use client';

import type { CreateOutreachActivityInput, OutreachActivity } from '@dealflow/shared';
import { createOutreachActivitySchema, outreachActivitySchema } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Select channel…' },
  { value: 'call', label: 'Phone call' },
  { value: 'email', label: 'Email' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'other', label: 'Other' },
];

// ---------------------------------------------------------------------------
// Shared input styles (design-system §1 zinc/emerald, §2 14px body-m)
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '6px',
  padding: '8px 12px',
  fontSize: '14px',
  color: '#1F2937',
  boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  color: '#374151',
  marginBottom: '6px',
};

const requiredMark = (
  <span style={{ color: '#DC2626', marginLeft: '2px' }} aria-hidden="true">
    *
  </span>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * A mandate option for the optional 0-or-1 deal-target dropdown.
 * Populated by the server component (SSR-fetched mandate list).
 */
export interface MandateOption {
  id: string;
  label: string;
}

export interface OutreachActivityFormProps {
  /** SSR-fetched mandate options for the optional deal-target link. */
  mandateOptions: MandateOption[];
  /** Called with the newly created activity after a successful POST 201. */
  onCreated: (activity: OutreachActivity) => void;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  channel: string;
  subject: string;
  notes: string;
  dueAt: string;
  /** 0-or-1 deal-target link: mandateId ('' = not linked). */
  mandateId: string;
}

const INITIAL_STATE: FormState = {
  channel: '',
  subject: '',
  notes: '',
  dueAt: '',
  mandateId: '',
};

// ---------------------------------------------------------------------------
// OutreachActivityForm component
// ---------------------------------------------------------------------------

export function OutreachActivityForm({ mandateOptions, onCreated }: OutreachActivityFormProps) {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validate(snapshot: FormState): string[] {
    const msgs: string[] = [];
    if (!snapshot.channel) msgs.push('Channel is required.');
    if (!snapshot.subject.trim()) msgs.push('Subject is required.');
    return msgs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const currentForm = form;

    const clientErrors = validate(currentForm);
    if (clientErrors.length > 0) {
      setErrors(clientErrors);
      return;
    }
    setErrors([]);

    // Build the createOutreachActivitySchema-compatible payload.
    // Conditional spreads for nullable/optional fields (exactOptionalPropertyTypes:true).
    const payload: CreateOutreachActivityInput = {
      channel: currentForm.channel as CreateOutreachActivityInput['channel'],
      subject: currentForm.subject.trim(),
      ...(currentForm.notes.trim() ? { notes: currentForm.notes.trim() } : {}),
      ...(currentForm.dueAt ? { dueAt: currentForm.dueAt } : {}),
      ...(currentForm.mandateId ? { mandateId: currentForm.mandateId } : {}),
    };

    const parsed = createOutreachActivitySchema.safeParse(payload);
    if (!parsed.success) {
      const msgs = parsed.error.errors.map((err) => err.message);
      setErrors(msgs);
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/outreach-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 201) {
        const json: unknown = await res.json();
        const parseResult = outreachActivitySchema.safeParse(json);
        if (parseResult.success) {
          setForm(INITIAL_STATE);
          onCreated(parseResult.data);
          return;
        }
      }

      let errMsg = 'Failed to log outreach touch.';
      try {
        const body = (await res.json()) as { message?: string };
        if (body.message) errMsg = body.message;
      } catch {
        // ignore
      }
      setSubmitError(errMsg);
    } catch {
      setSubmitError('Network error — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Log outreach touch form">
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
          overflow: 'hidden',
        }}
      >
        {/* Card header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#111827' }}>
            Log outreach touch
          </h2>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Internal record only</span>
        </div>

        {/* Form body */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Global error summary */}
          {(errors.length > 0 || submitError) && (
            <div
              role="alert"
              aria-live="assertive"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div
                style={{ fontSize: '13px', fontWeight: 600, color: '#991B1B', marginBottom: '6px' }}
              >
                Please fix the following:
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px' }}>
                {submitError && (
                  <li style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '4px' }}>
                    {submitError}
                  </li>
                )}
                {errors.map((err) => (
                  <li key={err} style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '4px' }}>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Row 1: Channel + Subject */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(140px, 180px) 1fr',
              gap: '12px',
              alignItems: 'start',
            }}
          >
            {/* Channel */}
            <div>
              <label htmlFor="oa-channel" style={labelStyle}>
                Channel {requiredMark}
              </label>
              <select
                id="oa-channel"
                required
                value={form.channel}
                onChange={(e) => setField('channel', e.target.value)}
                style={{ ...inputStyle, appearance: 'none' }}
                aria-required="true"
              >
                {CHANNEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="oa-subject" style={labelStyle}>
                Subject {requiredMark}
              </label>
              <input
                id="oa-subject"
                type="text"
                required
                autoComplete="off"
                placeholder="e.g. Initial outreach to ABC Capital"
                value={form.subject}
                onChange={(e) => setField('subject', e.target.value)}
                style={inputStyle}
                aria-required="true"
              />
            </div>
          </div>

          {/* Row 2: Notes */}
          <div>
            <label htmlFor="oa-notes" style={labelStyle}>
              Notes
            </label>
            <textarea
              id="oa-notes"
              rows={2}
              placeholder="Context or outcome notes…"
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '64px' }}
            />
          </div>

          {/* Row 3: Due date + Deal-target link */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              alignItems: 'start',
            }}
          >
            {/* Due date */}
            <div>
              <label htmlFor="oa-due-at" style={labelStyle}>
                Due date
              </label>
              <input
                id="oa-due-at"
                type="date"
                value={form.dueAt}
                onChange={(e) => setField('dueAt', e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* 0-or-1 deal-target: mandateId dropdown (v1) */}
            {mandateOptions.length > 0 && (
              <div>
                <label htmlFor="oa-mandate" style={labelStyle}>
                  Linked mandate
                  <span style={{ color: '#9CA3AF', fontWeight: 400, marginLeft: '4px' }}>
                    (optional)
                  </span>
                </label>
                <select
                  id="oa-mandate"
                  value={form.mandateId}
                  onChange={(e) => setField('mandateId', e.target.value)}
                  style={{ ...inputStyle, appearance: 'none' }}
                >
                  <option value="">None</option>
                  {mandateOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Card footer: submit */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #F3F4F6',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="submit"
            disabled={submitting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#FFFFFF',
              backgroundColor: submitting ? '#D1D5DB' : '#10B981',
              border: '1px solid transparent',
              borderRadius: '8px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
              transition: 'background-color 150ms ease',
            }}
          >
            {submitting ? 'Saving…' : 'Log touch'}
          </button>
        </div>
      </div>
    </form>
  );
}
