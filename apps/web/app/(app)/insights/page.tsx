/**
 * /insights — Advisor-insights analytics dashboard (wave-18, task 4b014689).
 *
 * SSR-fetches GET /analytics (via apiBase() — server-side, cookie-forwarded,
 * no-store). The non-colliding /analytics proxy (next.config.ts afterFiles)
 * is used by any client-side re-fetch; the SSR fetch uses apiBase() directly.
 *
 * RBAC: advisor + admin. assertRole('/insights', me.role).
 * Non-permitted roles (analyst, compliance, anon) → redirect('/') or '/login'.
 *
 * Metric families (design-system zinc/emerald cards, lucide, 4px grid):
 *   F1 — Mandate throughput:   draft / active / total counts.
 *   F2 — Outreach compliance-gate outcomes: gate-pass / blocked counts + rates.
 *        Labels: "Compliance-gate pass rate" / "Blocked rate" — NOT response rate.
 *        gatePassRate / blockedRate are null when total=0 → rendered as "n/a".
 *   F3 — Advisor productivity: per-advisor mandates-created / pipeline-rows table.
 *   F4 — Match disposition:    pending / accepted / rejected / flagged counts.
 *
 * Empty state: graceful "No analytics data yet" when the firm has no rows.
 * Loading: N/A (SSR); error: graceful error banner (no white screen).
 *
 * NO charts library, NO real-time/websocket, NO export affordance.
 * Read-only — no write side-effects.
 *
 * @see packages/shared/src/analytics.ts  (AnalyticsSummary shape)
 * @see packages/shared/src/rbac.ts       (NAV_INSIGHTS + /insights route entry)
 * @see apps/web/next.config.ts            (/analytics afterFiles rewrite)
 */

import type { AnalyticsSummary, MeResponse, Role } from '@dealflow/shared';
import { analyticsSummarySchema, meResponseSchema } from '@dealflow/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
// Note: explicit React import for the test-environment JSX transform (same
// pattern as admin/activity/page.tsx — esbuild transform requires it).
import type React from 'react';
import { assertRole } from '../_lib/assertRole';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// API base
// ---------------------------------------------------------------------------

function apiBase(): string {
  return (
    process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
  );
}

// ---------------------------------------------------------------------------
// Cookie header
// ---------------------------------------------------------------------------

async function cookieHeader(): Promise<string> {
  return (await cookies()).toString();
}

// ---------------------------------------------------------------------------
// Session fetch
// ---------------------------------------------------------------------------

async function fetchMe(cookie: string): Promise<MeResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/auth/me`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = meResponseSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Analytics fetch — GET /analytics (SSR, cookie-forwarded)
//
// Returns null on any failure (network, 4xx, 5xx, schema mismatch).
// The page renders graceful empty/error state when null is received.
// ---------------------------------------------------------------------------

async function fetchAnalytics(cookie: string): Promise<AnalyticsSummary | null> {
  try {
    const res = await fetch(`${apiBase()}/analytics`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = analyticsSummarySchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Design-system helpers
// ---------------------------------------------------------------------------

/** Format a rate (0–1 or null) as a percentage string. null → "n/a" */
function fmtRate(rate: number | null): string {
  if (rate === null) return 'n/a';
  return `${(rate * 100).toFixed(1)}%`;
}

/** Card container — zinc-50 bg, zinc-200 border, 8px radius, 4px grid padding */
const CARD_STYLE: React.CSSProperties = {
  backgroundColor: '#f9fafb', // zinc-50
  border: '1px solid #e5e7eb', // zinc-200
  borderRadius: '8px',
  padding: '20px 24px',
};

const CARD_TITLE_STYLE: React.CSSProperties = {
  margin: '0 0 16px',
  fontSize: '16px',
  fontWeight: 600,
  lineHeight: '24px',
  color: '#1f2937', // zinc-800
};

/** Large metric value — Display scale (tabular-nums) */
const METRIC_VALUE_STYLE: React.CSSProperties = {
  fontSize: '30px',
  fontWeight: 700,
  lineHeight: '36px',
  color: '#111827', // zinc-900
  fontVariantNumeric: 'tabular-nums',
};

/** Metric label — Body-s muted */
const METRIC_LABEL_STYLE: React.CSSProperties = {
  fontSize: '13px',
  lineHeight: '18px',
  color: '#6b7280', // zinc-500
  marginTop: '2px',
};

/** Emerald accent value (positive outcomes) */
const METRIC_VALUE_EMERALD_STYLE: React.CSSProperties = {
  ...METRIC_VALUE_STYLE,
  color: '#10b981', // emerald-600
};

/** Red accent value (blocked / negative) */
const METRIC_VALUE_DANGER_STYLE: React.CSSProperties = {
  ...METRIC_VALUE_STYLE,
  color: '#dc2626', // status-danger
};

/** Inline metric cell */
const METRIC_CELL_STYLE: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

/** Metric row: horizontal flex of cells */
const METRIC_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '24px',
};

/** Table shared styles */
const TABLE_STYLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '13px',
  lineHeight: '18px',
  fontVariantNumeric: 'tabular-nums',
};

const TH_STYLE: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: '12px',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#6b7280', // zinc-500
  borderBottom: '1px solid #e5e7eb', // zinc-200
};

const TD_STYLE: React.CSSProperties = {
  padding: '8px 12px',
  color: '#374151', // zinc-700
  borderBottom: '1px solid #f3f4f6', // zinc-100
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default async function InsightsPage() {
  const cookie = await cookieHeader();

  // 1. Re-fetch session for fine-grained RBAC.
  const me = await fetchMe(cookie);
  if (!me) redirect('/login');

  // 2. Assert advisor + admin only — other roles → redirect('/').
  assertRole('/insights', me.role as Role);

  // 3. SSR-fetch analytics summary.
  const data = await fetchAnalytics(cookie);

  // ── Error / unavailable state ──────────────────────────────────────────────
  if (!data) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '900px',
        }}
      >
        <PageHeader />
        <div
          role="alert"
          style={{
            backgroundColor: '#fef2f2', // red-50
            border: '1px solid #fecaca', // red-200
            borderRadius: '8px',
            padding: '16px 20px',
            fontSize: '14px',
            color: '#dc2626',
          }}
        >
          Unable to load analytics data. Please try refreshing the page.
        </div>
      </div>
    );
  }

  const { mandateThroughput, outreachGateOutcomes, advisorProductivity, matchDisposition } = data;

  // ── Empty state — all counts zero ─────────────────────────────────────────
  const allZero =
    mandateThroughput.total === 0 &&
    outreachGateOutcomes.total === 0 &&
    advisorProductivity.total === 0 &&
    matchDisposition.total === 0;

  if (allZero) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          maxWidth: '900px',
        }}
      >
        <PageHeader />
        <div
          style={{
            backgroundColor: '#f9fafb', // zinc-50
            border: '1px solid #e5e7eb', // zinc-200
            borderRadius: '8px',
            padding: '32px 24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              margin: '0 0 4px',
              fontSize: '16px',
              fontWeight: 600,
              color: '#374151',
            }}
          >
            No analytics data yet
          </p>
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            Analytics will appear here once your firm has mandates, outreach, and matches.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '900px',
      }}
    >
      <PageHeader />

      {/* ── F1: Mandate Throughput ─────────────────────────────────────── */}
      <section aria-label="Mandate throughput" style={CARD_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>Mandate Throughput</h2>
        <div style={METRIC_ROW_STYLE}>
          <div style={METRIC_CELL_STYLE}>
            <span style={METRIC_VALUE_STYLE}>{mandateThroughput.total}</span>
            <span style={METRIC_LABEL_STYLE}>Total mandates</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={METRIC_VALUE_EMERALD_STYLE}>{mandateThroughput.totalActive}</span>
            <span style={METRIC_LABEL_STYLE}>Active</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={{ ...METRIC_VALUE_STYLE, color: '#6b7280' }}>
              {mandateThroughput.totalDraft}
            </span>
            <span style={METRIC_LABEL_STYLE}>Draft</span>
          </div>
        </div>
      </section>

      {/* ── F2: Outreach Compliance-gate Outcomes ─────────────────────── */}
      <section aria-label="Outreach compliance-gate outcomes" style={CARD_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>Outreach Compliance-gate Outcomes</h2>
        <div style={METRIC_ROW_STYLE}>
          <div style={METRIC_CELL_STYLE}>
            <span style={METRIC_VALUE_STYLE}>{outreachGateOutcomes.total}</span>
            <span style={METRIC_LABEL_STYLE}>Total outreach records</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={METRIC_VALUE_EMERALD_STYLE}>{outreachGateOutcomes.totalSendEligible}</span>
            <span style={METRIC_LABEL_STYLE}>Gate-passed (send eligible)</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span
              style={{
                ...METRIC_VALUE_EMERALD_STYLE,
                fontSize: '24px', // slightly smaller for rate display
              }}
            >
              {fmtRate(outreachGateOutcomes.gatePassRate)}
            </span>
            <span style={METRIC_LABEL_STYLE}>Compliance-gate pass rate</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={METRIC_VALUE_DANGER_STYLE}>{outreachGateOutcomes.totalBlocked}</span>
            <span style={METRIC_LABEL_STYLE}>Blocked</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span
              style={{
                ...METRIC_VALUE_DANGER_STYLE,
                fontSize: '24px',
              }}
            >
              {fmtRate(outreachGateOutcomes.blockedRate)}
            </span>
            <span style={METRIC_LABEL_STYLE}>Blocked rate</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={{ ...METRIC_VALUE_STYLE, color: '#d97706' }}>
              {outreachGateOutcomes.totalCompose}
            </span>
            <span style={METRIC_LABEL_STYLE}>In compose (gate pending)</span>
          </div>
        </div>
      </section>

      {/* ── F3: Advisor Productivity ───────────────────────────────────── */}
      <section aria-label="Advisor productivity" style={CARD_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>Advisor Productivity</h2>
        {advisorProductivity.rows.length === 0 ? (
          <p style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}>
            No advisor activity recorded yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={TABLE_STYLE} aria-label="Per-advisor activity breakdown">
              <thead>
                <tr>
                  <th style={TH_STYLE}>Advisor ID</th>
                  <th style={{ ...TH_STYLE, textAlign: 'right' }}>Mandates Created</th>
                  <th style={{ ...TH_STYLE, textAlign: 'right' }}>Pipeline Rows</th>
                </tr>
              </thead>
              <tbody>
                {advisorProductivity.rows.map((row) => (
                  <tr key={row.userId}>
                    <td style={TD_STYLE}>
                      <span
                        style={{
                          fontSize: '12px',
                          fontFamily: 'ui-monospace, monospace',
                          color: '#6b7280',
                        }}
                      >
                        {row.userId}
                      </span>
                    </td>
                    <td
                      style={{
                        ...TD_STYLE,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {row.mandatesCreated}
                    </td>
                    <td
                      style={{
                        ...TD_STYLE,
                        textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {row.pipelineRows}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p
          style={{
            margin: '12px 0 0',
            fontSize: '13px',
            color: '#6b7280',
          }}
        >
          {advisorProductivity.total} active advisor
          {advisorProductivity.total !== 1 ? 's' : ''} with recorded activity
        </p>
      </section>

      {/* ── F4: Match Disposition ──────────────────────────────────────── */}
      <section aria-label="Match disposition" style={CARD_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>Match Disposition</h2>
        <div style={METRIC_ROW_STYLE}>
          <div style={METRIC_CELL_STYLE}>
            <span style={METRIC_VALUE_STYLE}>{matchDisposition.total}</span>
            <span style={METRIC_LABEL_STYLE}>Total candidates</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={{ ...METRIC_VALUE_STYLE, color: '#d97706' }}>
              {matchDisposition.totalPending}
            </span>
            <span style={METRIC_LABEL_STYLE}>Pending</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={METRIC_VALUE_EMERALD_STYLE}>{matchDisposition.totalAccepted}</span>
            <span style={METRIC_LABEL_STYLE}>Accepted</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={METRIC_VALUE_DANGER_STYLE}>{matchDisposition.totalRejected}</span>
            <span style={METRIC_LABEL_STYLE}>Rejected</span>
          </div>
          <div style={METRIC_CELL_STYLE}>
            <span style={{ ...METRIC_VALUE_STYLE, color: '#2563eb' }}>
              {matchDisposition.totalFlagged}
            </span>
            <span style={METRIC_LABEL_STYLE}>Flagged</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page header sub-component
// ---------------------------------------------------------------------------

function PageHeader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <h1
        style={{
          margin: 0,
          fontSize: '24px',
          fontWeight: 600,
          lineHeight: '32px',
          letterSpacing: '-0.01em',
          color: '#111827', // zinc-900
        }}
      >
        Insights
      </h1>
      <p style={{ margin: 0, fontSize: '14px', lineHeight: '20px', color: '#6b7280' }}>
        Read-only analytics for your firm — workspace-scoped, no cross-firm data.
      </p>
    </div>
  );
}
