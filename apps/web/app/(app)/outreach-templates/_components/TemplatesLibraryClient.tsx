'use client';

/**
 * TemplatesLibraryClient — interactive templates library UI (wave-11 B-3).
 *
 * AC-STRIP (P-4 karen MANDATORY + CODE-OF-CONDUCT provenance):
 *   NO "Generate with AI", NO "AI Drafting", NO AI-capability language.
 *   The design's "Generate with AI" button and "AI Drafting in Progress" modal
 *   are STRIPPED. Drafting is MANUAL/structured only.
 *
 * Mutations use /outreach-templates-data proxy (non-page-colliding):
 *   POST   /outreach-templates-data              → POST   /outreach-templates (create)
 *   POST   /outreach-templates-data/:id/versions → POST   /outreach-templates/:id/versions
 *   POST   /outreach-templates-data/:id/versions/:vid/request-approval
 *
 * Compliance role: read-only on this page (approve/reject is on compliance-queue).
 */

import type { OutreachApprovalStatus, OutreachTemplateVersion, Role } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../_lib/apiFetch';
import type { DisclaimerTemplate, TemplateWithVersions } from '../page';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TemplatesLibraryClientProps {
  initialTemplates: TemplateWithVersions[] | null;
  disclaimers: DisclaimerTemplate[];
  userRole: Role;
  userId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Advisor and analyst may draft/create/request-approval. Compliance is read-only here. */
function canDraft(role: Role): boolean {
  return role === 'advisor' || role === 'analyst';
}

function approvalStatusBadge(status: OutreachApprovalStatus): React.ReactElement {
  const styles: Record<OutreachApprovalStatus, { bg: string; color: string; label: string }> = {
    pending: { bg: '#FEF3C7', color: '#B45309', label: 'Pending' },
    approved: { bg: '#ECFDF5', color: '#047857', label: 'Approved' },
    rejected: { bg: '#FEF2F2', color: '#B91C1C', label: 'Rejected' },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase' as const,
        backgroundColor: s.bg,
        color: s.color,
      }}
    >
      {s.label}
    </span>
  );
}

/** Returns true when a version is usable for send (version-binding invariant). */
function isUsableForSend(v: OutreachTemplateVersion): boolean {
  return (
    v.approvalStatus === 'approved' &&
    v.approvedContentHash !== null &&
    v.approvedContentHash === v.contentHash
  );
}

// ---------------------------------------------------------------------------
// New Template Form
// ---------------------------------------------------------------------------

interface NewTemplateFormProps {
  disclaimers: DisclaimerTemplate[];
  onCreated: (t: TemplateWithVersions) => void;
  onCancel: () => void;
}

function NewTemplateForm({ disclaimers, onCreated, onCancel }: NewTemplateFormProps) {
  const [name, setName] = useState('');
  const [mandateScope, setMandateScope] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [disclaimerTemplateId, setDisclaimerTemplateId] = useState(disclaimers[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Template name is required.');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required.');
      return;
    }
    if (!body.trim()) {
      setError('Body is required.');
      return;
    }
    if (!disclaimerTemplateId) {
      setError('A disclaimer template is required.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch('/outreach-templates-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          mandateScope: mandateScope.trim() || null,
          subject: subject.trim(),
          body: body.trim(),
          disclaimerTemplateId,
        }),
      });
      if (!res.ok) {
        const msg: unknown = await res.json().catch(() => ({}));
        const detail =
          typeof msg === 'object' && msg !== null && 'message' in msg
            ? String((msg as { message: unknown }).message)
            : `Error ${res.status}`;
        setError(detail);
        return;
      }
      const raw: unknown = await res.json();
      // Server may return { template: { ...template, versions: [...] } } or the template directly
      const data =
        typeof raw === 'object' && raw !== null && 'template' in raw
          ? (raw as { template: unknown }).template
          : raw;
      onCreated(data as TemplateWithVersions);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleCreate} aria-label="Create template form">
      <div
        style={{
          backgroundColor: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          padding: '24px',
          marginBottom: '24px',
        }}
      >
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', marginBottom: '20px' }}>
          New Outreach Template
        </h2>

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
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              htmlFor="tl-name"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Template Name *
            </label>
            <input
              id="tl-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Strategic Buyer Intro"
              style={{
                width: '100%',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#111827',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="tl-scope"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Mandate Scope (optional)
            </label>
            <input
              id="tl-scope"
              type="text"
              value={mandateScope}
              onChange={(e) => setMandateScope(e.target.value)}
              placeholder="Mandate ID or descriptive label (leave blank for firm-wide)"
              style={{
                width: '100%',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#111827',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="tl-subject"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Subject Line *
            </label>
            <input
              id="tl-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line"
              style={{
                width: '100%',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '14px',
                color: '#111827',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="tl-body"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Body *
            </label>
            {/* Manual drafting only — NO AI-drafting affordance (AC-STRIP) */}
            <textarea
              id="tl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Draft your message here. Use {{buyerName}}, {{dealName}} for merge fields."
              rows={8}
              style={{
                width: '100%',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '13px',
                color: '#111827',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="tl-disclaimer"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 600,
                color: '#374151',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Required Compliance Block *
            </label>
            {disclaimers.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#6B7280' }}>
                No disclaimer templates available. Contact compliance to add one.
              </p>
            ) : (
              <select
                id="tl-disclaimer"
                value={disclaimerTemplateId}
                onChange={(e) => setDisclaimerTemplateId(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  color: '#111827',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {disclaimers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.jurisdiction}
                  </option>
                ))}
              </select>
            )}
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
              The selected compliance block is appended automatically. Required for approval.
            </p>
          </div>

          <div
            style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}
          >
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#374151',
                backgroundColor: '#fff',
                border: '1px solid #D1D5DB',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                backgroundColor: saving ? '#9CA3AF' : '#10B981',
                border: 'none',
                borderRadius: '6px',
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Creating...' : 'Create Template'}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Version history panel
// ---------------------------------------------------------------------------

interface VersionHistoryProps {
  template: TemplateWithVersions;
  canDraftVersion: boolean;
  disclaimers: DisclaimerTemplate[];
  onVersionAction: (
    templateId: string,
    action: 'draft' | 'request-approval',
    versionId?: string
  ) => void;
  onClose: () => void;
}

function VersionHistoryPanel({
  template,
  canDraftVersion,
  disclaimers,
  onVersionAction,
  onClose,
}: VersionHistoryProps) {
  const [draftingVersion, setDraftingVersion] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newDisclaimerId, setNewDisclaimerId] = useState(disclaimers[0]?.id ?? '');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const sortedVersions = [...template.versions].sort((a, b) => b.versionNumber - a.versionNumber);

  async function handleDraftVersion(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newBody.trim()) {
      setDraftError('Subject and body are required.');
      return;
    }
    setDraftError(null);
    setDraftSaving(true);
    try {
      const res = await apiFetch(`/outreach-templates-data/${template.id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject.trim(),
          body: newBody.trim(),
          disclaimerTemplateId: newDisclaimerId,
        }),
      });
      if (!res.ok) {
        const msg: unknown = await res.json().catch(() => ({}));
        const detail =
          typeof msg === 'object' && msg !== null && 'message' in msg
            ? String((msg as { message: unknown }).message)
            : `Error ${res.status}`;
        setDraftError(detail);
        return;
      }
      setDraftingVersion(false);
      onVersionAction(template.id, 'draft');
    } catch {
      setDraftError('Network error — please try again.');
    } finally {
      setDraftSaving(false);
    }
  }

  async function handleRequestApproval(versionId: string) {
    setRequestingApproval(versionId);
    setApprovalError(null);
    try {
      const res = await apiFetch(
        `/outreach-templates-data/${template.id}/versions/${versionId}/request-approval`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        const msg: unknown = await res.json().catch(() => ({}));
        const detail =
          typeof msg === 'object' && msg !== null && 'message' in msg
            ? String((msg as { message: unknown }).message)
            : `Error ${res.status}`;
        setApprovalError(detail);
        return;
      }
      onVersionAction(template.id, 'request-approval', versionId);
    } catch {
      setApprovalError('Network error — please try again.');
    } finally {
      setRequestingApproval(null);
    }
  }

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: '8px',
        padding: '24px',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>
            {template.name}
          </h2>
          {template.mandateScope && (
            <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
              Scope: {template.mandateScope}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {canDraftVersion && (
            <button
              type="button"
              onClick={() => setDraftingVersion(true)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#fff',
                backgroundColor: '#10B981',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Draft New Version
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close version history"
            style={{
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 500,
              color: '#6B7280',
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>

      {approvalError && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#B91C1C',
            marginBottom: '16px',
          }}
        >
          {approvalError}
        </div>
      )}

      {/* Draft new version form */}
      {draftingVersion && (
        <form
          onSubmit={handleDraftVersion}
          aria-label="Draft new version form"
          style={{
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '12px' }}>
            New Draft Version
          </h3>
          {draftError && (
            <div
              role="alert"
              style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '6px',
                padding: '8px 12px',
                fontSize: '13px',
                color: '#B91C1C',
                marginBottom: '12px',
              }}
            >
              {draftError}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                htmlFor="vs-subject"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                Subject *
              </label>
              <input
                id="vs-subject"
                type="text"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="vs-body"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                Body * (manual drafting)
              </label>
              {/* Manual drafting only — NO AI-drafting (AC-STRIP) */}
              <textarea
                id="vs-body"
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={6}
                style={{
                  width: '100%',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label
                htmlFor="vs-disclaimer"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '4px',
                }}
              >
                Required Compliance Block *
              </label>
              <select
                id="vs-disclaimer"
                value={newDisclaimerId}
                onChange={(e) => setNewDisclaimerId(e.target.value)}
                style={{
                  width: '100%',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              >
                {disclaimers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.jurisdiction}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDraftingVersion(false)}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#374151',
                  backgroundColor: '#fff',
                  border: '1px solid #D1D5DB',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={draftSaving}
                style={{
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: draftSaving ? '#9CA3AF' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: draftSaving ? 'not-allowed' : 'pointer',
                }}
              >
                {draftSaving ? 'Saving...' : 'Save Draft Version'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Version list */}
      <ul
        aria-label="Version history"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          listStyle: 'none',
          margin: 0,
          padding: 0,
        }}
      >
        {sortedVersions.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#6B7280' }}>No versions yet.</p>
        ) : (
          sortedVersions.map((v) => {
            const usable = isUsableForSend(v);
            return (
              <li
                key={v.id}
                style={{
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  backgroundColor: '#F9FAFB',
                  listStyle: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                        Version {v.versionNumber}
                      </span>
                      {approvalStatusBadge(v.approvalStatus)}
                      {usable && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase' as const,
                            backgroundColor: '#ECFDF5',
                            color: '#047857',
                            border: '1px solid #A7F3D0',
                          }}
                        >
                          Send-eligible
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#6B7280',
                        margin: '2px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap' as const,
                      }}
                    >
                      Subject: {v.subject}
                    </p>
                    <p
                      style={{
                        fontSize: '11px',
                        color: '#9CA3AF',
                        margin: '2px 0',
                        fontFamily: 'monospace',
                      }}
                    >
                      Hash: {v.contentHash.slice(0, 16)}…
                    </p>
                    {v.approvedBy && (
                      <p style={{ fontSize: '11px', color: '#6B7280', margin: '2px 0' }}>
                        Approved by: {v.approvedBy.slice(0, 8)}…
                      </p>
                    )}
                  </div>
                  {canDraftVersion && v.approvalStatus === 'pending' && (
                    <button
                      type="button"
                      onClick={() => handleRequestApproval(v.id)}
                      disabled={requestingApproval === v.id}
                      aria-label={`Request approval for version ${v.versionNumber}`}
                      style={{
                        flexShrink: 0,
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#fff',
                        backgroundColor: requestingApproval === v.id ? '#9CA3AF' : '#374151',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: requestingApproval === v.id ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {requestingApproval === v.id ? 'Submitting…' : 'Request Approval'}
                    </button>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function TemplatesLibraryClient({
  initialTemplates,
  disclaimers,
  userRole,
  userId: _userId,
}: TemplatesLibraryClientProps) {
  const [templates, setTemplates] = useState<TemplateWithVersions[]>(initialTemplates ?? []);
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const draftEnabled = canDraft(userRole);

  function handleTemplateCreated(t: TemplateWithVersions) {
    // Prepend the new template and close the form
    setTemplates((prev) => [t, ...prev]);
    setShowNewForm(false);
    setExpandedTemplateId(t.id);
  }

  async function handleVersionAction(
    templateId: string,
    _action: 'draft' | 'request-approval',
    _versionId?: string
  ) {
    // Re-fetch the template detail to get the updated versions list
    setGlobalError(null);
    try {
      const res = await apiFetch(`/outreach-templates-data/${templateId}`, {
        method: 'GET',
      });
      if (!res.ok) return;
      const raw: unknown = await res.json();
      const data =
        typeof raw === 'object' && raw !== null && 'template' in raw
          ? (raw as { template: unknown }).template
          : raw;
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? (data as TemplateWithVersions) : t))
      );
    } catch {
      setGlobalError('Failed to refresh template data. Please reload.');
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
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
            <span>Templates Library</span>
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
            Outreach Templates
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '4px' }}>
            {userRole === 'compliance'
              ? 'Review template versions. Approve or reject via the Compliance Queue.'
              : 'Draft and manage outreach templates. All versions require compliance approval before use.'}
          </p>
        </div>
        {draftEnabled && !showNewForm && (
          <button
            type="button"
            onClick={() => setShowNewForm(true)}
            style={{
              padding: '8px 18px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              backgroundColor: '#10B981',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            New Template
          </button>
        )}
      </div>

      {globalError && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '6px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#B91C1C',
            marginBottom: '16px',
          }}
        >
          {globalError}
        </div>
      )}

      {/* New template form */}
      {showNewForm && (
        <NewTemplateForm
          disclaimers={disclaimers}
          onCreated={handleTemplateCreated}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* Expanded version history */}
      {expandedTemplateId &&
        (() => {
          const t = templates.find((tpl) => tpl.id === expandedTemplateId);
          if (!t) return null;
          return (
            <VersionHistoryPanel
              template={t}
              canDraftVersion={draftEnabled}
              disclaimers={disclaimers}
              onVersionAction={handleVersionAction}
              onClose={() => setExpandedTemplateId(null)}
            />
          );
        })()}

      {/* Template list */}
      {initialTemplates === null && templates.length === 0 ? (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: '#B91C1C' }}>
            Could not load templates. Please refresh the page.
          </p>
        </div>
      ) : templates.length === 0 ? (
        <div
          style={{
            border: '1px dashed #D1D5DB',
            borderRadius: '8px',
            padding: '48px 32px',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '15px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            No templates yet
          </p>
          <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
            Create your first outreach template to get started.
          </p>
          {draftEnabled && (
            <button
              type="button"
              onClick={() => setShowNewForm(true)}
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#fff',
                backgroundColor: '#10B981',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Create First Template
            </button>
          )}
        </div>
      ) : (
        <table
          aria-label="Outreach templates"
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
              {(['Template Name', 'Versions', 'Latest Status', ''] as const).map((label) => (
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
            {templates.map((t) => {
              const latest = [...t.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
              const hasUsable = t.versions.some(isUsableForSend);

              return (
                <tr key={t.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '14px 16px', minWidth: 0 }}>
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
                      {t.name}
                    </p>
                    {t.mandateScope && (
                      <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0' }}>
                        Scope: {t.mandateScope}
                      </p>
                    )}
                    {hasUsable && expandedTemplateId !== t.id && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          marginTop: '4px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 600,
                          backgroundColor: '#ECFDF5',
                          color: '#047857',
                          border: '1px solid #A7F3D0',
                        }}
                      >
                        Has send-eligible version
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151' }}>
                    {t.versions.length} version{t.versions.length !== 1 ? 's' : ''}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {latest ? (
                      approvalStatusBadge(latest.approvalStatus)
                    ) : (
                      <span style={{ fontSize: '12px', color: '#9CA3AF' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => setExpandedTemplateId((prev) => (prev === t.id ? null : t.id))}
                      aria-label={`View version history for ${t.name}`}
                      style={{
                        padding: '5px 12px',
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#374151',
                        backgroundColor: '#F9FAFB',
                        border: '1px solid #E5E7EB',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {expandedTemplateId === t.id ? 'Collapse' : 'View Versions'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
