/**
 * WorkspaceSettingsClient — firm profile form + default compliance profile.
 *
 * Client component for PUT /admin/settings-data
 * (proxied → PUT /admin/workspace-settings).
 *
 * All fields are optional (partial update semantics).
 *
 * HARD BOUNDARIES:
 *   NO send/AI affordance.
 */

'use client';

import type { WorkspaceSettings } from '@dealflow/shared';
import { workspaceSettingsUpdateSchema } from '@dealflow/shared';
import { useState } from 'react';
import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface WorkspaceSettingsClientProps {
  initialSettings: WorkspaceSettings | null;
}

// ---------------------------------------------------------------------------
// Form state helpers
// ---------------------------------------------------------------------------

type FormValues = {
  firmName: string;
  firmAddress: string;
  regulatoryIds: string;
  primaryContactName: string;
  primaryContactEmail: string;
  defaultJurisdiction: string;
  defaultDisclaimerTemplateId: string;
  defaultSuppressionScope: '' | 'firm' | 'mandate';
};

function initFormValues(settings: WorkspaceSettings | null): FormValues {
  return {
    firmName: settings?.firmName ?? '',
    firmAddress: settings?.firmAddress ?? '',
    regulatoryIds: settings?.regulatoryIds ?? '',
    primaryContactName: settings?.primaryContactName ?? '',
    primaryContactEmail: settings?.primaryContactEmail ?? '',
    defaultJurisdiction: settings?.defaultJurisdiction ?? '',
    defaultDisclaimerTemplateId: settings?.defaultDisclaimerTemplateId ?? '',
    defaultSuppressionScope: settings?.defaultSuppressionScope ?? '',
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormField({
  id,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
  hint,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <label htmlFor={id} style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>
        {label}
        {required && <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>}
      </label>
      {hint && <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>{hint}</p>}
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
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
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <h2
        style={{
          margin: 0,
          fontSize: '16px',
          fontWeight: 600,
          color: '#111827',
          lineHeight: '24px',
        }}
      >
        {title}
      </h2>
      {description && (
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>{description}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function WorkspaceSettingsClient({ initialSettings }: WorkspaceSettingsClientProps) {
  const [form, setForm] = useState<FormValues>(() => initFormValues(initialSettings));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaveSuccess(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    // Build partial update — only include non-empty fields.
    const update: Record<string, unknown> = {};
    if (form.firmName) update.firmName = form.firmName;
    if (form.firmAddress) update.firmAddress = form.firmAddress;
    if (form.regulatoryIds) update.regulatoryIds = form.regulatoryIds;
    if (form.primaryContactName) update.primaryContactName = form.primaryContactName;
    if (form.primaryContactEmail) update.primaryContactEmail = form.primaryContactEmail;
    if (form.defaultJurisdiction) update.defaultJurisdiction = form.defaultJurisdiction;
    if (form.defaultDisclaimerTemplateId)
      update.defaultDisclaimerTemplateId = form.defaultDisclaimerTemplateId;
    if (form.defaultSuppressionScope) update.defaultSuppressionScope = form.defaultSuppressionScope;

    // Validate via shared schema before submit
    const parsed = workspaceSettingsUpdateSchema.safeParse(update);
    if (!parsed.success) {
      setSaveError('Invalid form data. Please check your inputs.');
      setSaving(false);
      return;
    }

    try {
      const res = await apiFetch('/admin/settings-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (res.ok) {
        setSaveSuccess(true);
      } else {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setSaveError(body.message ?? 'Failed to save settings. Please try again.');
      }
    } catch {
      setSaveError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Firm Profile section */}
      <section
        aria-label="Firm profile"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        }}
      >
        <SectionHeader
          title="Firm Profile"
          description="Your firm's legal identity and primary contact."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormField
            id="firmName"
            label="Firm name"
            value={form.firmName}
            onChange={(v) => setField('firmName', v)}
            placeholder="Acme Capital Advisors LLC"
            hint="Legal registered name of the firm."
          />
          <FormField
            id="firmAddress"
            label="Registered address"
            value={form.firmAddress}
            onChange={(v) => setField('firmAddress', v)}
            placeholder="123 Main St, New York, NY 10001"
          />
          <FormField
            id="regulatoryIds"
            label="Regulatory identifiers"
            value={form.regulatoryIds}
            onChange={(v) => setField('regulatoryIds', v)}
            placeholder="CRD #12345"
            hint="CRD number or other regulatory identifiers."
          />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
            }}
          >
            <FormField
              id="primaryContactName"
              label="Primary contact name"
              value={form.primaryContactName}
              onChange={(v) => setField('primaryContactName', v)}
              placeholder="Jane Smith"
            />
            <FormField
              id="primaryContactEmail"
              label="Primary contact email"
              type="email"
              value={form.primaryContactEmail}
              onChange={(v) => setField('primaryContactEmail', v)}
              placeholder="jane@firm.com"
            />
          </div>
        </div>
      </section>

      {/* Default compliance profile section */}
      <section
        aria-label="Default compliance profile"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '8px',
          padding: '24px',
          boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        }}
      >
        <SectionHeader
          title="Default Compliance Profile"
          description="Defaults applied to new mandates. Existing mandates are not retroactively changed."
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormField
            id="defaultJurisdiction"
            label="Default jurisdiction"
            value={form.defaultJurisdiction}
            onChange={(v) => setField('defaultJurisdiction', v)}
            placeholder="US-NY"
            hint="ISO-3166 code or jurisdiction label (e.g. US-NY, UK-ENG)."
          />

          <FormField
            id="defaultDisclaimerTemplateId"
            label="Default disclaimer template ID"
            value={form.defaultDisclaimerTemplateId}
            onChange={(v) => setField('defaultDisclaimerTemplateId', v)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            hint="UUID of the disclaimer template to use by default for new mandates."
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label
              htmlFor="defaultSuppressionScope"
              style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}
            >
              Default suppression scope
            </label>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
              Controls whether suppression lists apply at the firm level or per-mandate.
            </p>
            <select
              id="defaultSuppressionScope"
              value={form.defaultSuppressionScope}
              onChange={(e) =>
                setField('defaultSuppressionScope', e.target.value as '' | 'firm' | 'mandate')
              }
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
            >
              <option value="">— Not set —</option>
              <option value="firm">Firm-wide</option>
              <option value="mandate">Per-mandate</option>
            </select>
          </div>
        </div>
      </section>

      {/* Status messages */}
      {saveError && (
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
          }}
        >
          {saveError}
        </div>
      )}

      {saveSuccess && (
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
          Settings saved successfully.
        </div>
      )}

      {/* Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          disabled={saving}
          style={{
            height: '36px',
            padding: '0 24px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: saving ? '#6ee7b7' : '#10b981',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
