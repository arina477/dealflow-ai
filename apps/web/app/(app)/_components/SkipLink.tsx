/**
 * SkipLink — WCAG 2.4.1 "bypass blocks" skip-to-content link.
 *
 * Visually hidden until focused; reveals itself on keyboard Tab. Extracted
 * from AppShell as a 'use client' component because onFocus/onBlur event
 * handlers cannot exist in a Server Component (Next.js App Router SSR throws
 * "Event handlers cannot be passed to Client Component props").
 */

'use client';

export function SkipLink() {
  return (
    <a
      href="#main-content"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        zIndex: 9999,
        padding: 0,
      }}
      onFocus={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.left = '16px';
        el.style.top = '16px';
        el.style.width = 'auto';
        el.style.height = 'auto';
        el.style.overflow = 'visible';
        el.style.padding = '8px 16px';
        el.style.backgroundColor = '#10B981';
        el.style.color = '#ffffff';
        el.style.fontWeight = '600';
        el.style.fontSize = '14px';
        el.style.borderRadius = '6px';
        el.style.textDecoration = 'none';
        el.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.4)';
      }}
      onBlur={(e) => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.left = '-9999px';
        el.style.top = 'auto';
        el.style.width = '1px';
        el.style.height = '1px';
        el.style.overflow = 'hidden';
        el.style.padding = '0';
        el.style.backgroundColor = '';
        el.style.color = '';
        el.style.fontWeight = '';
        el.style.fontSize = '';
        el.style.borderRadius = '';
        el.style.textDecoration = '';
        el.style.boxShadow = '';
      }}
    >
      Skip to main content
    </a>
  );
}
