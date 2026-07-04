/**
 * StatusFilter — segmented control for mandate list status (draft / active / all).
 *
 * Design: zinc/emerald palette, inline segmented button per mandates-list.html.
 * Accessible: role="radiogroup" + role="radio" + aria-checked pattern.
 */
'use client';

export type MandateStatusFilter = 'all' | 'draft' | 'active';

interface StatusFilterProps {
  value: MandateStatusFilter;
  onChange: (value: MandateStatusFilter) => void;
}

const OPTIONS: { label: string; value: MandateStatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
];

export function StatusFilter({ value, onChange }: StatusFilterProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Filter mandates by status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: 'rgba(243,244,246,0.8)',
        borderRadius: '8px',
        padding: '2px',
        border: '1px solid rgba(229,231,235,0.5)',
        gap: '1px',
      }}
    >
      {OPTIONS.map((opt) => {
        const isActive = value === opt.value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: segmented-control — role="radio" on <button> is a valid WAI-ARIA radiogroup/radio pattern; <input type="radio"> cannot be styled consistently across design system
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: isActive ? 600 : 500,
              borderRadius: '6px',
              border: isActive ? '1px solid rgba(229,231,235,0.5)' : '1px solid transparent',
              backgroundColor: isActive ? '#FFFFFF' : 'transparent',
              color: isActive ? '#111827' : '#6B7280',
              cursor: 'pointer',
              transition: 'all 150ms ease',
              boxShadow: isActive
                ? '0 1px 2px rgba(16,24,40,0.05), 0 0 0 1px rgba(0,0,0,0.05)'
                : 'none',
              outline: 'none',
            }}
            onFocus={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = isActive
                ? '0 1px 2px rgba(16,24,40,0.05), 0 0 0 3px rgba(16,185,129,0.4)'
                : '0 0 0 3px rgba(16,185,129,0.4)';
            }}
            onBlur={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = isActive
                ? '0 1px 2px rgba(16,24,40,0.05), 0 0 0 1px rgba(0,0,0,0.05)'
                : 'none';
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
