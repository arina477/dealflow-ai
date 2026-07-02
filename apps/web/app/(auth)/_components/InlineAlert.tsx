/**
 * InlineAlert — danger/info/warn alert for auth pages.
 *
 * DESIGN-SYSTEM §8 Toast/inline alert:
 *   - variants: info / positive / warn / danger using status colors + tinted bg
 *   - role="alert" (persistent, not auto-dismiss)
 *   - aria-live="assertive" for screen readers
 *
 * No-user-enumeration enforcement: callers must pass only GENERIC messages
 * (e.g. "Invalid email or password" — never reveal which field is wrong).
 */

type AlertVariant = 'danger' | 'info' | 'warn' | 'positive';

interface InlineAlertProps {
  variant: AlertVariant;
  message: string;
}

const STYLES: Record<AlertVariant, { bg: string; border: string; text: string }> = {
  danger: { bg: '#fef2f2', border: '#fecaca', text: 'var(--status-danger)' },
  info: { bg: '#eff6ff', border: '#bfdbfe', text: 'var(--status-info)' },
  warn: { bg: '#fffbeb', border: '#fde68a', text: 'var(--status-warn)' },
  positive: { bg: 'var(--emerald-50)', border: '#a7f3d0', text: 'var(--status-positive)' },
};

const ICON_PATHS: Record<AlertVariant, React.ReactNode> = {
  danger: (
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01" />
  ),
  warn: (
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01" />
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  positive: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
};

export function InlineAlert({ variant, message }: InlineAlertProps) {
  const style = STYLES[variant];

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
        color: style.text,
        fontSize: '13px',
        lineHeight: '18px',
      }}
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: '1px' }}
      >
        {ICON_PATHS[variant]}
      </svg>
      <span>{message}</span>
    </div>
  );
}
