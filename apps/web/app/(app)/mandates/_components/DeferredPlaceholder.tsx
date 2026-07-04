/**
 * DeferredPlaceholder — D6 stable mount point for sections not yet built.
 *
 * Wave-8 mandate spine: the Buyer Engine, Ranked Candidates, and Pipeline
 * sections shown in mandate-detail.html are deferred to the M4 bundle. These
 * placeholders occupy the correct DOM position so future work mounts directly
 * here without restructuring the page.
 *
 * "Coming in a later step" — NOT a permanent empty state. Do not drop these.
 */
'use client';

interface DeferredPlaceholderProps {
  title: string;
  description?: string;
}

export function DeferredPlaceholder({ title, description }: DeferredPlaceholderProps) {
  return (
    <section
      aria-label={`${title} — coming in a later step`}
      style={{
        border: '1px dashed #D1D5DB',
        borderRadius: '8px',
        padding: '40px 24px',
        textAlign: 'center',
        backgroundColor: '#FAFAFA',
        marginBottom: '16px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '8px',
          backgroundColor: '#F3F4F6',
          border: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px',
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '4px',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: '12px', color: '#6B7280' }}>
        {description ?? 'Coming in a later step'}
      </div>
    </section>
  );
}
