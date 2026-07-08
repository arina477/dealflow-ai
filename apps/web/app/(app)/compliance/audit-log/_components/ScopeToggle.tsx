/**
 * ScopeToggle — "Audit log | Deal activity" scope tab bar.
 *
 * Wave-29 B-3: renders two tab buttons; the active scope is highlighted.
 * "Deal activity" tab is conditionally rendered only when `canSeeDealActivity`
 * is true (compliance/admin); advisor sees "Audit log" only.
 *
 * A11y:
 *   - role="tablist" / role="tab" semantics
 *   - aria-selected on the active tab
 *   - Keyboard-navigable (each tab is a button, natural tab order)
 *   - Visible focus ring (2px emerald, matching the audit-log filter bar)
 *
 * Design tokens: reuse the AuditLogTable zinc/emerald palette + 4px grid.
 * No new tokens introduced.
 */

'use client';

export type AuditScope = 'audit' | 'deal';

export interface ScopeToggleProps {
  activeScope: AuditScope;
  onScopeChange: (scope: AuditScope) => void;
  /** Whether the deal-activity tab is visible (compliance/admin only). */
  canSeeDealActivity: boolean;
}

export function ScopeToggle({ activeScope, onScopeChange, canSeeDealActivity }: ScopeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Records scope"
      style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '0',
      }}
    >
      <button
        role="tab"
        type="button"
        aria-selected={activeScope === 'audit'}
        onClick={() => onScopeChange('audit')}
        style={{
          padding: '8px 16px',
          fontSize: '13px',
          fontWeight: activeScope === 'audit' ? 600 : 500,
          color: activeScope === 'audit' ? '#111827' : '#6b7280',
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: activeScope === 'audit' ? '2px solid #111827' : '2px solid transparent',
          cursor: 'pointer',
          outline: 'none',
          marginBottom: '-1px',
        }}
        onFocus={(e) => {
          e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        Audit log
      </button>

      {canSeeDealActivity && (
        <button
          role="tab"
          type="button"
          aria-selected={activeScope === 'deal'}
          data-testid="deal-activity-tab"
          onClick={() => onScopeChange('deal')}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: activeScope === 'deal' ? 600 : 500,
            color: activeScope === 'deal' ? '#111827' : '#6b7280',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeScope === 'deal' ? '2px solid #111827' : '2px solid transparent',
            cursor: 'pointer',
            outline: 'none',
            marginBottom: '-1px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 2px rgb(16 185 129 / 0.4)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Deal activity
        </button>
      )}
    </div>
  );
}
