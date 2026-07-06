/**
 * IntegrationsClient — data source connection management UI.
 *
 * SECURITY INVARIANTS (enforced here, mirroring the service):
 *   1. The read shape only includes `hasCredential` (boolean). The plaintext
 *      or ciphertext is NEVER returned by the API, never rendered, never
 *      pre-filled in any input.
 *   2. The credential input is WRITE-ONLY. It starts empty and stays empty
 *      unless the admin types a new value. Submitting without a credential
 *      value leaves the existing stored credential unchanged (service handles this).
 *   3. NO live connection-test button.
 *   4. NO send/AI affordance.
 *
 * Mutations use /admin/integrations-data/* proxy (non-page-colliding).
 *   POST   /admin/integrations-data            → POST   /admin/integrations
 *   PATCH  /admin/integrations-data/:id        → PATCH  /admin/integrations/:id
 *   PATCH  /admin/integrations-data/:id/toggle → PATCH  /admin/integrations/:id/toggle
 */

'use client';

import type { DataSourceConnectionAdminRecord } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IntegrationsClientProps {
  initialConnections: DataSourceConnectionAdminRecord[];
}

// ---------------------------------------------------------------------------
// Connection form state
// ---------------------------------------------------------------------------

type ConnectionFormValues = {
  providerKey: string;
  displayName: string;
  /** WRITE-ONLY — empty by default, never pre-filled. */
  credential: string;
  config: string;
};

const EMPTY_FORM: ConnectionFormValues = {
  providerKey: '',
  displayName: '',
  credential: '',
  config: '',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HasCredentialBadge({ has }: { has: boolean }) {
  return (
    <span
      role="img"
      aria-label={has ? 'Credential stored' : 'No credential'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '18px',
        backgroundColor: has ? '#d1fae5' : '#f3f4f6',
        color: has ? '#065f46' : '#6b7280',
        border: `1px solid ${has ? '#6ee7b7' : '#e5e7eb'}`,
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: has ? '#10b981' : '#9ca3af',
          flexShrink: 0,
        }}
      />
      {has ? 'Credential set' : 'No credential'}
    </span>
  );
}

function EnabledBadge({ enabled }: { enabled: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: '18px',
        backgroundColor: enabled ? '#dbeafe' : '#f3f4f6',
        color: enabled ? '#1e40af' : '#6b7280',
        border: `1px solid ${enabled ? '#93c5fd' : '#e5e7eb'}`,
      }}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function IntegrationsClient({ initialConnections }: IntegrationsClientProps) {
  const [connections, setConnections] =
    useState<DataSourceConnectionAdminRecord[]>(initialConnections);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ConnectionFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // ── Toggle enable/disable ─────────────────────────────────────────────────

  async function handleToggle(conn: DataSourceConnectionAdminRecord) {
    setActionError(null);
    setTogglingId(conn.id);
    try {
      const res = await apiFetch(`/admin/integrations-data/${conn.id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !conn.enabled }),
      });

      if (res.ok) {
        const updated = (await res.json()) as DataSourceConnectionAdminRecord;
        setConnections((prev) => prev.map((c) => (c.id === conn.id ? updated : c)));
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setActionError(body.message ?? 'Failed to update connection. Please try again.');
      }
    } catch {
      setActionError('Network error. Please try again.');
    } finally {
      setTogglingId(null);
    }
  }

  // ── Open edit panel ───────────────────────────────────────────────────────

  function openEdit(conn: DataSourceConnectionAdminRecord) {
    setEditingId(conn.id);
    // SECURITY: credential is NEVER pre-filled — always starts empty.
    setForm({
      providerKey: conn.providerKey,
      displayName: conn.displayName,
      credential: '', // WRITE-ONLY: intentionally empty, never pre-filled
      config: '',
    });
    setFormError(null);
    setFormSuccess(null);
    setShowAddPanel(false);
  }

  // ── Open add panel ────────────────────────────────────────────────────────

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
    setShowAddPanel(true);
  }

  // ── Submit (create or update) ─────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    if (!form.providerKey.trim() || !form.displayName.trim()) {
      setFormError('Provider key and display name are required.');
      setSubmitting(false);
      return;
    }

    const body: Record<string, unknown> = {
      providerKey: form.providerKey.trim(),
      displayName: form.displayName.trim(),
    };

    // Only include credential if the admin typed one — WRITE-ONLY.
    if (form.credential.trim()) {
      body.credential = form.credential.trim();
    }

    if (form.config.trim()) {
      try {
        body.config = JSON.parse(form.config.trim()) as unknown;
      } catch {
        setFormError('Config must be valid JSON.');
        setSubmitting(false);
        return;
      }
    }

    try {
      const url = editingId ? `/admin/integrations-data/${editingId}` : '/admin/integrations-data';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const record = (await res.json()) as DataSourceConnectionAdminRecord;
        if (editingId) {
          setConnections((prev) => prev.map((c) => (c.id === editingId ? record : c)));
        } else {
          setConnections((prev) => [...prev, record]);
        }
        setFormSuccess(editingId ? 'Connection updated.' : 'Connection added.');
        setForm(EMPTY_FORM);
        setEditingId(null);
        setShowAddPanel(false);
      } else {
        const errBody = (await res.json().catch(() => ({}))) as { message?: string };
        setFormError(errBody.message ?? 'Failed to save connection. Please try again.');
      }
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function cancelPanel() {
    setShowAddPanel(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormSuccess(null);
  }

  const panelOpen = showAddPanel || editingId !== null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={openAdd}
          style={{
            height: '36px',
            padding: '0 16px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: '#10b981',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          + Add integration
        </button>
      </div>

      {/* Success banner */}
      {formSuccess && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: '#d1fae5',
            color: '#065f46',
            fontSize: '13px',
            border: '1px solid #6ee7b7',
          }}
        >
          {formSuccess}
        </div>
      )}

      {/* Action error */}
      {actionError && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            padding: '12px 16px',
            borderRadius: '6px',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            fontSize: '13px',
            border: '1px solid #fca5a5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#991b1b',
              fontSize: '16px',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Add/Edit panel */}
      {panelOpen && (
        <section
          aria-label={editingId ? 'Edit integration' : 'Add integration'}
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '24px',
            boxShadow: '0 1px 3px rgb(16 24 40 / 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '20px',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>
              {editingId ? 'Edit integration' : 'Add integration'}
            </h2>
            <button
              type="button"
              onClick={cancelPanel}
              aria-label="Close panel"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '20px',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="providerKey"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
                >
                  Provider key <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                  Environment variable name (e.g. GRATA_API_KEY).
                </p>
                <input
                  id="providerKey"
                  type="text"
                  required
                  value={form.providerKey}
                  onChange={(e) => setForm((f) => ({ ...f, providerKey: e.target.value }))}
                  placeholder="GRATA_API_KEY"
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label
                  htmlFor="displayName"
                  style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
                >
                  Display name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                  Human-readable name shown in the UI (e.g. Grata).
                </p>
                <input
                  id="displayName"
                  type="text"
                  required
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Grata"
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* WRITE-ONLY credential field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="credential"
                style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
              >
                API credential
              </label>
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                {editingId
                  ? 'Enter a new credential to replace the existing one. Leave empty to keep the current credential unchanged.'
                  : 'Enter the API key or credential for this integration.'}{' '}
                <strong style={{ color: '#6b7280' }}>
                  Write-only: stored credentials are never shown.
                </strong>
              </p>
              <input
                id="credential"
                type="password"
                autoComplete="new-password"
                value={form.credential}
                onChange={(e) => setForm((f) => ({ ...f, credential: e.target.value }))}
                placeholder={editingId ? '(leave empty to keep current)' : 'sk-…'}
                style={{
                  height: '36px',
                  padding: '0 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '13px',
                  color: '#111827',
                  backgroundColor: '#ffffff',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Config JSON (optional) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label
                htmlFor="config"
                style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
              >
                Config (JSON, optional)
              </label>
              <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                Non-secret per-connection configuration (field mappings, filters, etc.).
              </p>
              <textarea
                id="config"
                value={form.config}
                onChange={(e) => setForm((f) => ({ ...f, config: e.target.value }))}
                placeholder='{"fieldMapping": {"name": "company_name"}}'
                rows={3}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  color: '#111827',
                  backgroundColor: '#ffffff',
                  width: '100%',
                  boxSizing: 'border-box',
                  resize: 'vertical',
                }}
              />
            </div>

            {formError && (
              <p role="alert" style={{ margin: 0, fontSize: '13px', color: '#dc2626' }}>
                {formError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={cancelPanel}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  height: '36px',
                  padding: '0 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: submitting ? '#6ee7b7' : '#10b981',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: submitting ? 'wait' : 'pointer',
                }}
              >
                {submitting ? 'Saving…' : editingId ? 'Update integration' : 'Add integration'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Connections list */}
      <section
        aria-label="Data source connections"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 80px',
            padding: '12px 20px',
            borderBottom: '1px solid #f3f4f6',
            backgroundColor: '#f9fafb',
          }}
        >
          {['Integration', 'Provider key', 'Status', 'Credential', 'Actions'].map((h) => (
            <span
              key={h}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#6b7280',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {connections.length === 0 ? (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '14px',
            }}
          >
            No integrations configured yet. Click "Add integration" to get started.
          </div>
        ) : (
          connections.map((conn) => (
            <div
              key={conn.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 80px',
                padding: '14px 20px',
                borderBottom: '1px solid #f3f4f6',
                alignItems: 'center',
              }}
            >
              {/* Display name */}
              <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>
                {conn.displayName}
              </span>

              {/* Provider key */}
              <span
                style={{
                  fontSize: '12px',
                  color: '#6b7280',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {conn.providerKey}
              </span>

              {/* Status toggle */}
              <div>
                <button
                  type="button"
                  aria-label={`${conn.enabled ? 'Disable' : 'Enable'} ${conn.displayName}`}
                  disabled={togglingId === conn.id}
                  onClick={() => handleToggle(conn)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: togglingId === conn.id ? 'wait' : 'pointer',
                    padding: 0,
                    opacity: togglingId === conn.id ? 0.5 : 1,
                  }}
                >
                  <EnabledBadge enabled={conn.enabled} />
                </button>
              </div>

              {/* Credential — ONLY shows boolean badge, NEVER the secret */}
              <HasCredentialBadge has={conn.hasCredential} />

              {/* Edit action */}
              <button
                type="button"
                aria-label={`Edit ${conn.displayName}`}
                onClick={() => openEdit(conn)}
                style={{
                  height: '28px',
                  padding: '0 12px',
                  borderRadius: '5px',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#ffffff',
                  color: '#374151',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Edit
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
