/**
 * SubmitButton — primary CTA for auth forms.
 *
 * DESIGN-SYSTEM §8 Button:
 *   - primary variant: bg-emerald-600, hover:bg-emerald-700
 *   - disabled: zinc-300 bg, zinc-500 text
 *   - aria-busy when loading
 *   - real <button type="submit">
 */

'use client';

interface SubmitButtonProps {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  disabled?: boolean;
}

export function SubmitButton({
  label,
  loadingLabel = 'Processing...',
  isLoading = false,
  disabled = false,
}: SubmitButtonProps) {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={isLoading}
      style={{
        position: 'relative',
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: isDisabled ? 'var(--zinc-300)' : 'var(--primary)',
        border: 'none',
        color: isDisabled ? 'var(--zinc-500)' : '#ffffff',
        fontSize: '14px',
        fontWeight: 500,
        padding: '10px 16px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        boxShadow: isDisabled ? 'none' : 'var(--shadow-xs)',
        transition: 'background-color 150ms ease',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          e.currentTarget.style.backgroundColor = 'var(--primary)';
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = '0 0 0 4px var(--focus-ring)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = isDisabled ? 'none' : 'var(--shadow-xs)';
      }}
    >
      {isLoading && (
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }}
        >
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {isLoading ? loadingLabel : label}
    </button>
  );
}
