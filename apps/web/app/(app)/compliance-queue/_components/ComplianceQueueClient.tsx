'use client';

/**
 * ComplianceQueueClient — Compliance Queue UI (wave-11 B-3, task 2601ba33).
 *
 * Lists pending-approval outreach template versions for the compliance role.
 * Grant/reject actions call POST /outreach-templates-data/:id/versions/:vid/approve|reject.
 *
 * SoD (Separation of Duties) is enforced server-side. A 403 response means the
 * logged-in compliance user is the same person who drafted the version — the UI
 * surfaces this as an explicit SoD error.
 *
 * Mutations use /outreach-templates-data proxy (non-page-colliding):
 *   POST /outreach-templates-data/:id/versions/:vid/approve → approve
 *   POST /outreach-templates-data/:id/versions/:vid/reject  → reject
 *
 * RBAC: compliance only. Other roles are denied at the page level.
 */

import type { Role } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';
import type { VersionWithTemplate } from '../page';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ComplianceQueueClientProps {
  initialVersions: VersionWithTemplate[] | null;
  userRole: Role;
}

// ---------------------------------------------------------------------------
// Review panel
// ---------------------------------------------------------------------------

interface ReviewPanelProps {
  version: VersionWithTemplate;
  onDecision: (templateId: string, versionId: string, decision: 'approve' | 'reject') => void;
  onClose: () => void;
}

function ReviewPanel({ version, onDecision, onClose }: ReviewPanelProps) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!decision) return;
    if (decision === 'reject' && !reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }
    setError(null);
    setSubmitting(true);

    const endpoint =
      decision === 'approve'
        ? `/outreach-templates-data/${version.templateId}/versions/${version.id}/approve`
        : `/outreach-templates-data/${version.templateId}/versions/${version.id}/reject`;

    try {
      const body =
        decision === 'approve'
          ? JSON.stringify({ notes: reason.trim() || undefined })
          : JSON.stringify({ reason: reason.trim() });

      const res = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (res.status === 403) {
        setError(
          'Separation of duties (SoD) violation: you cannot approve/reject a version you drafted. This action requires a different compliance reviewer.'
        );
        return;
      }

      if (!res.ok) {
        const msg: unknown = await res.json().catch(() => ({}));
        const detail =
          typeof msg === 'object' && msg !== null && 'message' in msg
            ? String((msg as { message: unknown }).message)
            : `Error ${res.status}`;
        setError(detail);
        return;
      }

      onDecision(version.templateId, version.id, decision);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-labelledby="review-panel-title"
      aria-modal="false"
      style={{
        position: 'fixed',
        inset: 0,
        right: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(3, 7, 18, 0.15)',
          pointerEvents: 'auto',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          backgroundColor: '#fff',
          borderLeft: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
          pointerEvents: 'auto',
          overflowY: 'auto',
        }}
      >
        {/* Panel header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #E5E7EB',
            backgroundColor: '#F9FAFB',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}
              >
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  Pending Review
                </span>
              </div>
              <h2
                id="review-panel-title"
                style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}
              >
                {version.templateName}
              </h2>
              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
                Version {version.versionNumber} — submitted for approval
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close review panel"
              style={{
                padding: '6px',
                color: '#9CA3AF',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
                flexShrink: 0,
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {/* Content preview */}
          <div style={{ marginBottom: '20px' }}>
            <h3
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: '#6B7280',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: '10px',
              }}
            >
              Content Preview
            </h3>
            <div
              style={{
                backgroundColor: '#fff',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#F9FAFB',
                  borderBottom: '1px solid #E5E7EB',
                  fontSize: '12px',
                  color: '#6B7280',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Email Draft
              </div>
              <div style={{ padding: '14px', fontFamily: 'Georgia, serif' }}>
                <p
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#374151',
                    marginBottom: '8px',
                  }}
                >
                  Subject: {version.subject}
                </p>
                <p
                  style={{
                    fontSize: '13px',
                    color: '#4B5563',
                    lineHeight: '1.7',
                    whiteSpace: 'pre-wrap' as const,
                  }}
                >
                  {version.body}
                </p>
              </div>
            </div>
          </div>

          {/* Version metadata */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                padding: '10px 12px',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 4px',
                }}
              >
                Content Hash
              </p>
              <code
                style={{
                  fontSize: '11px',
                  color: '#374151',
                  fontFamily: 'monospace',
                  wordBreak: 'break-all' as const,
                }}
              >
                {version.contentHash.slice(0, 24)}…
              </code>
            </div>
            <div
              style={{
                backgroundColor: '#F9FAFB',
                border: '1px solid #E5E7EB',
                borderRadius: '6px',
                padding: '10px 12px',
              }}
            >
              <p
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 4px',
                }}
              >
                Submitted
              </p>
              <p
                style={{
                  fontSize: '12px',
                  color: '#374151',
                  margin: 0,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {new Date(version.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Decision footer (sticky) */}
        <form
          onSubmit={handleSubmit}
          style={{
            borderTop: '1px solid #E5E7EB',
            padding: '16px 24px',
            backgroundColor: '#fff',
            flexShrink: 0,
          }}
          aria-label="Compliance decision form"
        >
          {error && (
            <div
              role="alert"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '6px',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#B91C1C',
                marginBottom: '14px',
              }}
            >
              {error}
            </div>
          )}

          <p
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '10px',
            }}
          >
            Compliance Decision
          </p>

          {/* Decision selector */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginBottom: '14px',
            }}
          >
            <button
              type="button"
              onClick={() => setDecision('approve')}
              aria-pressed={decision === 'approve'}
              style={{
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: decision === 'approve' ? '#047857' : '#374151',
                backgroundColor: decision === 'approve' ? '#ECFDF5' : '#F9FAFB',
                border: `1px solid ${decision === 'approve' ? '#10B981' : '#E5E7EB'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDecision('reject')}
              aria-pressed={decision === 'reject'}
              style={{
                padding: '10px',
                fontSize: '13px',
                fontWeight: 600,
                color: decision === 'reject' ? '#B91C1C' : '#374151',
                backgroundColor: decision === 'reject' ? '#FEF2F2' : '#F9FAFB',
                border: `1px solid ${decision === 'reject' ? '#EF4444' : '#E5E7EB'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              Reject
            </button>
          </div>

          {/* Notes / reason field */}
          {decision !== null && (
            <div style={{ marginBottom: '14px' }}>
              <label
                htmlFor="cq-notes"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                {decision === 'reject' ? 'Rejection Reason (required)' : 'Notes (optional)'}
              </label>
              <textarea
                id="cq-notes"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder={
                  decision === 'reject'
                    ? 'Explain why this cannot be approved…'
                    : 'Optional approval notes…'
                }
                required={decision === 'reject'}
                style={{
                  width: '100%',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Submit decision */}
          <button
            type="submit"
            disabled={!decision || submitting}
            aria-label={
              !decision
                ? 'Select a decision'
                : decision === 'approve'
                  ? 'Confirm approval'
                  : 'Confirm rejection'
            }
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              backgroundColor:
                !decision || submitting
                  ? '#D1D5DB'
                  : decision === 'approve'
                    ? '#10B981'
                    : '#EF4444',
              border: 'none',
              borderRadius: '6px',
              cursor: !decision || submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting
              ? 'Submitting…'
              : !decision
                ? 'Select a decision'
                : decision === 'approve'
                  ? 'Confirm Approval'
                  : 'Confirm Rejection'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function ComplianceQueueClient({
  initialVersions,
  userRole: _userRole,
}: ComplianceQueueClientProps) {
  const [versions, setVersions] = useState<VersionWithTemplate[]>(initialVersions ?? []);
  const [reviewingVersionId, setReviewingVersionId] = useState<string | null>(null);

  const reviewingVersion = versions.find((v) => v.id === reviewingVersionId) ?? null;

  function handleDecision(templateId: string, versionId: string, decision: 'approve' | 'reject') {
    // Remove the version from the pending queue
    setVersions((prev) => prev.filter((v) => v.id !== versionId));
    setReviewingVersionId(null);
    // Suppress unused param warning
    void templateId;
    void decision;
  }

  const pendingCount = versions.length;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: '24px' }}>
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            color: '#6B7280',
            marginBottom: '4px',
          }}
          aria-label="Breadcrumb"
        >
          <span>Compliance</span>
          <span>/</span>
          <span>Template Approval Queue</span>
        </nav>
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
            letterSpacing: '-0.01em',
          }}
        >
          Pending Reviews
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginTop: '8px',
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              border: '1px solid #FDE68A',
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {pendingCount} pending
          </span>
        </div>
      </div>

      {/* Load error */}
      {initialVersions === null && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: '#B91C1C' }}>
            Could not load the compliance queue. Please refresh the page.
          </p>
        </div>
      )}

      {/* Empty queue */}
      {initialVersions !== null && versions.length === 0 && (
        <div
          style={{
            border: '1px dashed #D1D5DB',
            borderRadius: '8px',
            padding: '48px 32px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '16px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            Queue is clear
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280' }}>
            No template versions are awaiting compliance review.
          </p>
        </div>
      )}

      {/* Pending version table */}
      {versions.length > 0 && (
        <table
          style={{
            width: '100%',
            backgroundColor: '#fff',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            overflow: 'hidden',
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {(['Template Name', 'Version', 'Submitted', ''] as const).map((label) => (
                <th
                  key={label || 'actions'}
                  scope="col"
                  style={{
                    padding: '10px 16px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#6B7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    textAlign: 'left',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr
                key={v.id}
                style={{
                  borderBottom: '1px solid #F3F4F6',
                }}
              >
                <td style={{ padding: '14px 16px', minWidth: 0 }}>
                  <button
                    type="button"
                    onClick={() => setReviewingVersionId(v.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      textAlign: 'left' as const,
                      maxWidth: '100%',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#111827',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {v.templateName}
                    </p>
                    <p
                      style={{
                        fontSize: '11px',
                        color: '#6B7280',
                        margin: '2px 0 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      {v.subject}
                    </p>
                  </button>
                </td>
                <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>
                  v{v.versionNumber}
                </td>
                <td
                  style={{
                    padding: '14px 16px',
                    fontSize: '12px',
                    color: '#6B7280',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {new Date(v.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setReviewingVersionId(v.id)}
                    aria-label={`Review ${v.templateName} version ${v.versionNumber}`}
                    style={{
                      padding: '6px 16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#fff',
                      backgroundColor: '#111827',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Review slide-out panel */}
      {reviewingVersion && (
        <ReviewPanel
          version={reviewingVersion}
          onDecision={handleDecision}
          onClose={() => setReviewingVersionId(null)}
        />
      )}
    </div>
  );
}
