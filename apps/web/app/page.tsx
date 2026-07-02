/**
 * Landing / health-check page — server component.
 *
 * Runtime environment:
 *   NEXT_PUBLIC_API_URL — base URL of the NestJS API (default: http://localhost:3001)
 *   See root .env.example (INTERNAL_API_BASE_URL) for the Railway private-network value.
 *
 * Build-time safety: `export const dynamic = 'force-dynamic'` prevents Next.js from
 * attempting to statically render this page during `next build`, which would fail when
 * the API is not running in CI. The health fetch executes at request time only.
 */
export const dynamic = 'force-dynamic';

import type { HealthResponse } from '@dealflow/shared';
import { healthResponseSchema } from '@dealflow/shared';

type FetchResult = { ok: true; data: HealthResponse } | { ok: false; reason: string };

async function fetchHealth(): Promise<FetchResult> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  try {
    const res = await fetch(`${apiUrl}/health`, {
      // No caching — always show live status.
      cache: 'no-store',
      // Tight timeout so a cold boot doesn't stall the page indefinitely.
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { ok: false, reason: `api returned ${res.status}` };
    }

    const raw: unknown = await res.json();
    const parsed = healthResponseSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, reason: 'invalid response shape' };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unreachable';
    return { ok: false, reason: `api unreachable — ${message}` };
  }
}

export default async function HomePage() {
  const result = await fetchHealth();

  const isHealthy = result.ok && result.data.status === 'ok' && result.data.db === 'ok';
  const status = result.ok ? result.data.status : 'degraded';
  const db = result.ok ? result.data.db : 'down';
  const version = result.ok ? result.data.version : '—';
  const errorReason = !result.ok ? result.reason : null;

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            aria-hidden="true"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {/* Network icon — inline SVG (lucide/network, 1.5px stroke) */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="16" y="16" width="6" height="6" rx="1" />
              <rect x="2" y="16" width="6" height="6" rx="1" />
              <rect x="9" y="2" width="6" height="6" rx="1" />
              <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" />
              <path d="M12 12V8" />
            </svg>
          </div>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 600,
              lineHeight: '28px',
              color: 'var(--text-primary)',
            }}
          >
            DealFlow AI
          </span>
        </div>

        {/* Health card */}
        <section
          aria-label="API health status"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-xs)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Card header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                lineHeight: '16px',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
              }}
            >
              System Status
            </span>
            <StatusPill ok={isHealthy} label={status} />
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)' }} />

          {/* Detail rows */}
          <dl
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              margin: 0,
            }}
          >
            <DetailRow label="API" value={status} ok={status === 'ok'} />
            <DetailRow label="Database" value={db} ok={db === 'ok'} />
            <DetailRow label="Version" value={version} neutral />
          </dl>

          {/* Degraded reason */}
          {errorReason != null && (
            <div
              role="alert"
              style={{
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                padding: '10px 12px',
                fontSize: '13px',
                lineHeight: '18px',
                color: 'var(--status-danger)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
              }}
            >
              {/* AlertTriangle icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ flexShrink: 0, marginTop: '1px' }}
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
              <span>{errorReason}</span>
            </div>
          )}
        </section>

        <p
          style={{
            fontSize: '13px',
            lineHeight: '18px',
            color: 'var(--text-muted)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          Walking skeleton — wave 1
        </p>
      </div>
    </main>
  );
}

/* ── Sub-components (co-located; no client boundary needed) ── */

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  const color = ok ? 'var(--status-positive)' : 'var(--status-danger)';
  const bg = ok ? 'var(--emerald-50)' : '#fef2f2';
  const border = ok ? '#a7f3d0' : '#fecaca';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 10px',
        borderRadius: 'var(--radius-pill)',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: '16px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: '6px',
          height: '6px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}

function DetailRow({
  label,
  value,
  ok,
  neutral,
}: {
  label: string;
  value: string;
  ok?: boolean;
  neutral?: boolean;
}) {
  const valueColor = neutral
    ? 'var(--text-primary)'
    : ok
      ? 'var(--status-positive)'
      : 'var(--status-danger)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <dt
        style={{
          fontSize: '14px',
          lineHeight: '20px',
          color: 'var(--text-muted)',
          margin: 0,
        }}
      >
        {label}
      </dt>
      <dd
        style={{
          fontSize: '14px',
          lineHeight: '20px',
          fontWeight: 500,
          color: valueColor,
          fontVariantNumeric: 'tabular-nums',
          margin: 0,
        }}
      >
        {value}
      </dd>
    </div>
  );
}
