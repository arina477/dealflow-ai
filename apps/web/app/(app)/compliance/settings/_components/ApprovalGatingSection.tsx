/**
 * ApprovalGatingSection — "Approval & Gating Policy" CRUD panel.
 *
 * Renders the list of compliance_rules rows (from GET /compliance/rules) and
 * allows the compliance user to:
 *   - Toggle a rule's `enabled` flag (PATCH /compliance/rules/:id)
 *   - Add a new rule (POST /compliance/rules)
 *   - Delete a rule (DELETE /compliance/rules/:id — after confirmation)
 *
 * Design tokens: DESIGN-SYSTEM §10 (zinc/emerald). Matches the
 * "Approval & Gating Policy" section in design/compliance-settings.html.
 *
 * Accessibility:
 *   - All interactive elements keyboard-focusable with visible focus ring.
 *   - Delete confirmation uses native window.confirm (accessible dialog).
 *   - Toggle uses <button type="button"> with aria-pressed + aria-label.
 *   - Add form fields are labeled with htmlFor.
 */

'use client';

import type { ComplianceRule, RuleCreate } from '@dealflow/shared';
import { complianceRuleTypeEnum, ruleCreateSchema } from '@dealflow/shared';
import { useCallback, useState } from 'react';

import { apiFetch } from '../../../_lib/apiFetch';

// ---------------------------------------------------------------------------
// Shared style primitives (§10 tokens)
// ---------------------------------------------------------------------------

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#4b5563',
  marginBottom: '4px',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '36px',
  padding: '0 12px',
  borderRadius: '4px',
  border: '1px solid #d1d5db',
  backgroundColor: '#ffffff',
  fontSize: '14px',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: 'pointer',
  appearance: 'none' as React.CSSProperties['appearance'],
};

const BTN_EMERALD: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  borderRadius: '6px',
  border: 'none',
  backgroundColor: '#10b981',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 150ms ease',
};

const BTN_GHOST: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid #e5e7eb',
  backgroundColor: '#ffffff',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  outline: 'none',
  transition: 'background-color 150ms ease, border-color 150ms ease',
};

const BTN_DANGER: React.CSSProperties = {
  ...BTN_GHOST,
  color: '#b91c1c',
  borderColor: '#fecaca',
  backgroundColor: '#fff1f2',
};

// ---------------------------------------------------------------------------
// Rule type label map
// ---------------------------------------------------------------------------

const RULE_TYPE_LABELS: Record<string, string> = {
  blocklist_check: 'Blocklist Check',
  disclaimer_required: 'Disclaimer Required',
  approval_required: 'Approval Required',
  jurisdiction_check: 'Jurisdiction Check',
};

// ---------------------------------------------------------------------------
// Toast helper
// ---------------------------------------------------------------------------

interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'error';
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 14px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: t.kind === 'success' ? '#d1fae5' : '#fecaca',
            backgroundColor: t.kind === 'success' ? '#ecfdf5' : '#fff1f2',
            color: t.kind === 'success' ? '#047857' : '#b91c1c',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 8px 24px rgb(16 24 40 / 0.12)',
            minWidth: '280px',
            pointerEvents: 'auto',
          }}
        >
          {t.kind === 'success' ? (
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-rule form (inline, toggleable)
// ---------------------------------------------------------------------------

interface AddRuleFormProps {
  onAdd: (rule: ComplianceRule) => void;
  onCancel: () => void;
}

function AddRuleForm({ onAdd, onCancel }: AddRuleFormProps) {
  const [ruleType, setRuleType] = useState<ComplianceRule['ruleType']>('approval_required');
  const [jurisdiction, setJurisdiction] = useState('');
  const [configKey, setConfigKey] = useState('');
  const [configValue, setConfigValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const body: RuleCreate = {
        ruleType,
        jurisdiction: jurisdiction.trim() || null,
        config: configKey.trim() ? { [configKey.trim()]: configValue.trim() } : {},
        enabled: true,
      };

      const validation = ruleCreateSchema.safeParse(body);
      if (!validation.success) {
        setError(validation.error.errors[0]?.message ?? 'Validation failed');
        return;
      }

      setSubmitting(true);
      try {
        const res = await apiFetch('/compliance/rules', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
        });
        if (!res.ok) {
          setError(`Failed to add rule (${res.status})`);
          return;
        }
        const created = (await res.json()) as ComplianceRule;
        onAdd(created);
      } catch {
        setError('Network error — please try again');
      } finally {
        setSubmitting(false);
      }
    },
    [ruleType, jurisdiction, configKey, configValue, onAdd]
  );

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      aria-label="Add gating rule"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        backgroundColor: '#f9fafb',
        borderTop: '1px solid #e5e7eb',
      }}
    >
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: '13px', color: '#b91c1c' }}>
          {error}
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
        }}
      >
        {/* Rule type */}
        <div>
          <label htmlFor="rule-type" style={LABEL_STYLE}>
            Rule Type
          </label>
          <select
            id="rule-type"
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as ComplianceRule['ruleType'])}
            style={SELECT_STYLE}
            required
            onFocus={(e) => {
              (e.currentTarget as HTMLSelectElement).style.boxShadow =
                '0 0 0 2px rgb(16 185 129 / 0.4)';
              (e.currentTarget as HTMLSelectElement).style.borderColor = '#10b981';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLSelectElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLSelectElement).style.borderColor = '#d1d5db';
            }}
          >
            {complianceRuleTypeEnum.options.map((v) => (
              <option key={v} value={v}>
                {RULE_TYPE_LABELS[v] ?? v}
              </option>
            ))}
          </select>
        </div>

        {/* Jurisdiction */}
        <div>
          <label htmlFor="rule-jurisdiction" style={LABEL_STYLE}>
            Jurisdiction{' '}
            <span
              style={{ fontWeight: 400, textTransform: 'none', fontSize: '11px', color: '#9ca3af' }}
            >
              (optional — blank = global)
            </span>
          </label>
          <input
            id="rule-jurisdiction"
            type="text"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="e.g. EU, US, UK"
            style={INPUT_STYLE}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow =
                '0 0 0 2px rgb(16 185 129 / 0.4)';
              (e.currentTarget as HTMLInputElement).style.borderColor = '#10b981';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db';
            }}
          />
        </div>

        {/* Config key */}
        <div>
          <label htmlFor="rule-config-key" style={LABEL_STYLE}>
            Config Key{' '}
            <span
              style={{ fontWeight: 400, textTransform: 'none', fontSize: '11px', color: '#9ca3af' }}
            >
              (optional)
            </span>
          </label>
          <input
            id="rule-config-key"
            type="text"
            value={configKey}
            onChange={(e) => setConfigKey(e.target.value)}
            placeholder="e.g. threshold"
            style={INPUT_STYLE}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow =
                '0 0 0 2px rgb(16 185 129 / 0.4)';
              (e.currentTarget as HTMLInputElement).style.borderColor = '#10b981';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db';
            }}
          />
        </div>

        {/* Config value */}
        <div>
          <label htmlFor="rule-config-value" style={LABEL_STYLE}>
            Config Value{' '}
            <span
              style={{ fontWeight: 400, textTransform: 'none', fontSize: '11px', color: '#9ca3af' }}
            >
              (optional)
            </span>
          </label>
          <input
            id="rule-config-value"
            type="text"
            value={configValue}
            onChange={(e) => setConfigValue(e.target.value)}
            placeholder="e.g. 250"
            style={INPUT_STYLE}
            onFocus={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow =
                '0 0 0 2px rgb(16 185 129 / 0.4)';
              (e.currentTarget as HTMLInputElement).style.borderColor = '#10b981';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLInputElement).style.borderColor = '#d1d5db';
            }}
          />
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={BTN_GHOST}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 0 0 2px rgb(16 185 129 / 0.4)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          style={{ ...BTN_EMERALD, opacity: submitting ? 0.7 : 1 }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 0 0 2px rgb(16 185 129 / 0.4)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          {submitting ? 'Adding…' : 'Add Rule'}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ApprovalGatingSectionProps {
  initialRules: ComplianceRule[];
}

export function ApprovalGatingSection({ initialRules }: ApprovalGatingSectionProps) {
  const [rules, setRules] = useState<ComplianceRule[]>(initialRules);
  const [showAddForm, setShowAddForm] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const pushToast = useCallback((message: string, kind: Toast['kind']) => {
    const id = `toast-${Date.now()}`;
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // ── Toggle enabled ─────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    async (rule: ComplianceRule) => {
      const next = !rule.enabled;
      // Optimistic update
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: next } : r)));
      try {
        const res = await apiFetch(`/compliance/rules/${rule.id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ enabled: next }),
          cache: 'no-store',
        });
        if (!res.ok) {
          // Revert
          setRules((prev) =>
            prev.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r))
          );
          pushToast('Failed to update rule', 'error');
          return;
        }
        const updated = (await res.json()) as ComplianceRule;
        setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        pushToast(`Rule ${next ? 'enabled' : 'disabled'}`, 'success');
      } catch {
        setRules((prev) =>
          prev.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r))
        );
        pushToast('Network error', 'error');
      }
    },
    [pushToast]
  );

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(
    async (rule: ComplianceRule) => {
      const confirmed = window.confirm(
        `Delete rule "${RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}"${rule.jurisdiction ? ` (${rule.jurisdiction})` : ''}? This cannot be undone.`
      );
      if (!confirmed) return;

      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      try {
        const res = await apiFetch(`/compliance/rules/${rule.id}`, {
          method: 'DELETE',
          cache: 'no-store',
        });
        if (!res.ok) {
          setRules((prev) => [...prev, rule]);
          pushToast('Failed to delete rule', 'error');
          return;
        }
        pushToast('Rule deleted', 'success');
      } catch {
        setRules((prev) => [...prev, rule]);
        pushToast('Network error', 'error');
      }
    },
    [pushToast]
  );

  // ── Add new ───────────────────────────────────────────────────────────────

  const handleAdd = useCallback(
    (rule: ComplianceRule) => {
      setRules((prev) => [rule, ...prev]);
      setShowAddForm(false);
      pushToast('Rule added', 'success');
    },
    [pushToast]
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <section
      aria-label="Approval and gating policy"
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 2px rgb(16 24 40 / 0.05)',
        overflow: 'hidden',
      }}
    >
      <ToastList toasts={toasts} />

      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #f3f4f6',
          backgroundColor: '#fcfcfd',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            aria-hidden="true"
            style={{
              padding: '6px',
              backgroundColor: '#ecfdf5',
              borderRadius: '6px',
              border: '1px solid #d1fae5',
            }}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              lineHeight: '22px',
              color: '#111827',
            }}
          >
            Approval &amp; Gating Policy
          </h2>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: '9999px',
              backgroundColor: '#f3f4f6',
              border: '1px solid #e5e7eb',
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {rules.length} {rules.length === 1 ? 'rule' : 'rules'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((v) => !v)}
          aria-expanded={showAddForm}
          aria-controls="add-rule-form"
          style={BTN_EMERALD}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 0 0 2px rgb(16 185 129 / 0.4)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
          }}
        >
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Add Rule
        </button>
      </div>

      {/* Add rule form (collapsed by default) */}
      <div id="add-rule-form">
        {showAddForm && <AddRuleForm onAdd={handleAdd} onCancel={() => setShowAddForm(false)} />}
      </div>

      {/* Rules table */}
      {rules.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            color: '#6b7280',
            gap: '8px',
            textAlign: 'center',
          }}
        >
          <svg
            aria-hidden="true"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#374151' }}>
            No rules configured
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: '#9ca3af' }}>
            Add a rule to start gating outreach campaigns.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}
            aria-label="Gating rules"
          >
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#f9fafb',
                }}
              >
                {(['Rule Type', 'Jurisdiction', 'Config', 'Enabled', ''] as const).map((col) => (
                  <th
                    key={col}
                    scope="col"
                    style={{
                      padding: '10px 16px',
                      textAlign: 'left',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: '#6b7280',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  style={{ borderBottom: '1px solid #f3f4f6' }}
                  data-testid={`rule-row-${rule.id}`}
                >
                  {/* Rule type */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: '14px',
                      fontWeight: 500,
                      color: '#111827',
                    }}
                  >
                    {RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType}
                  </td>

                  {/* Jurisdiction */}
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#6b7280' }}>
                    {rule.jurisdiction ?? (
                      <span style={{ color: '#d1d5db', fontStyle: 'italic' }}>Global</span>
                    )}
                  </td>

                  {/* Config preview */}
                  <td
                    style={{
                      padding: '12px 16px',
                      fontSize: '12px',
                      color: '#6b7280',
                      fontFamily: 'ui-monospace, monospace',
                      maxWidth: '180px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {Object.keys(rule.config).length > 0 ? (
                      JSON.stringify(rule.config)
                    ) : (
                      <span style={{ color: '#d1d5db' }}>—</span>
                    )}
                  </td>

                  {/* Enabled toggle */}
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.enabled}
                      aria-label={`${rule.enabled ? 'Disable' : 'Enable'} ${RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType} rule`}
                      onClick={() => void handleToggle(rule)}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        width: '36px',
                        height: '20px',
                        borderRadius: '9999px',
                        border: 'none',
                        backgroundColor: rule.enabled ? '#10b981' : '#d1d5db',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'background-color 150ms ease',
                        flexShrink: 0,
                      }}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow =
                          '0 0 0 2px rgb(16 185 129 / 0.4)';
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: '2px',
                          left: rule.enabled ? '18px' : '2px',
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          backgroundColor: '#ffffff',
                          transition: 'left 150ms ease',
                          boxShadow: '0 1px 2px rgb(16 24 40 / 0.1)',
                        }}
                      />
                    </button>
                  </td>

                  {/* Delete */}
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => void handleDelete(rule)}
                      aria-label={`Delete ${RULE_TYPE_LABELS[rule.ruleType] ?? rule.ruleType} rule`}
                      style={BTN_DANGER}
                      onFocus={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow =
                          '0 0 0 2px rgba(185 28 28 / 0.3)';
                      }}
                      onBlur={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                      }}
                    >
                      <svg
                        aria-hidden="true"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
