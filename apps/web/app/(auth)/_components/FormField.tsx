/**
 * FormField — design-system form primitive.
 *
 * Implements DESIGN-SYSTEM §8 Input/Select/Textarea contract:
 *   - <label> association via htmlFor/id
 *   - aria-invalid on error
 *   - aria-describedby wired to the error <p> id
 *   - focus-ring via --focus-ring token (emerald-600 @ 40%)
 *   - --radius-sm, --border, --status-danger border on error
 */

'use client';

import { type InputHTMLAttributes, useId } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | undefined;
  /** Optional content rendered to the right of the label (e.g. a "Forgot password?" link) */
  labelRight?: React.ReactNode | undefined;
}

export function FormField({ label, error, labelRight, id: externalId, className, ...rest }: FormFieldProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const errorId = `${id}-error`;
  const hasError = Boolean(error);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          style={{
            display: 'block',
            fontSize: '12px',
            lineHeight: '16px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </label>
        {labelRight}
      </div>

      <input
        id={id}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        style={{
          display: 'block',
          width: '100%',
          borderRadius: 'var(--radius-sm)',
          border: `1px solid ${hasError ? 'var(--status-danger)' : 'var(--border)'}`,
          backgroundColor: 'var(--bg-surface)',
          padding: '8px 14px',
          fontSize: '14px',
          lineHeight: '20px',
          color: 'var(--text-primary)',
          outline: 'none',
          boxShadow: 'var(--shadow-xs)',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = hasError ? 'var(--status-danger)' : 'var(--primary)';
          e.currentTarget.style.boxShadow = hasError
            ? '0 0 0 4px rgba(220,38,38,0.12)'
            : '0 0 0 4px var(--focus-ring)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = hasError ? 'var(--status-danger)' : 'var(--border)';
          e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
        }}
        className={className}
        {...rest}
      />

      {hasError && (
        <p
          id={errorId}
          role="alert"
          style={{
            fontSize: '13px',
            lineHeight: '18px',
            color: 'var(--status-danger)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            margin: 0,
          }}
        >
          {/* AlertCircle icon — inline lucide SVG, no external dep in client bundle */}
          <svg
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}
