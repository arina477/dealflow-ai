/**
 * /insights — Advisor-insights analytics dashboard (wave-18, task 4b014689).
 *
 * SSR-fetches GET /analytics (via apiBase() — server-side, cookie-forwarded,
 * no-store). The non-colliding /analytics proxy (next.config.ts afterFiles)
 * is used by any client-side re-fetch; the SSR fetch uses apiBase() directly.
 *
 * Wave-19 addition (task 077974a2): Match score calibration section.
 * SSR-fetches GET /match-feedback (same pattern: apiBase(), cookie-forwarded,
 * no-store). The non-colliding /match-feedback proxy (next.config.ts afterFiles)
 * is used for any client-side re-fetch.
 *
 * Wave-23 addition (task 6840c25d): Seller intent section.
 * SSR-fetches GET /seller-intent (same pattern: apiBase(), cookie-forwarded,
 * no-store). The non-colliding /seller-intent proxy (next.config.ts afterFiles)
 * is used for any client-side re-fetch.
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
 *   C  — Match score calibration (wave-19):
 *        4 fit_score bands (0-25/26-50/51-75/76-100): decidedCount + acceptRate.
 *        2 per-dimension lifts (sectorMatch/contactCompleteness): high vs low cohort.
 *        tieBreak is excluded (row-ID hash — noise, not signal; B-6 metric honesty).
 *        G2: acceptRate null → "n/a" (0 decided); acceptRate 0 (number) → "0%".
 *        Small-sample: decidedCount < LOW_SAMPLE_THRESHOLD → rate shown as "X% (low sample)".
 *        Empty state when totalDecided=0.
 *   SI — Seller intent (wave-23, task 6840c25d):
 *        Per-mandate: score (0-100), direction (heating/cooling/flat), 3-signal breakdown.
 *        direction color: heating=emerald-600, cooling=amber-600, flat=zinc-500.
 *        Sorted by score descending (hottest mandates first).
 *        SI1: NO tieBreak shown — API does not return it, never surfaced.
 *        notApplied: signal with zero data → renders "—" (not "0" or NaN/undefined).
 *        Empty state when list is empty.
 *
 * Empty state: graceful "No analytics data yet" when the firm has no rows.
 * Loading: N/A (SSR); error: graceful error banner (no white screen).
 *
 * NO charts library, NO real-time/websocket, NO export affordance.
 * Read-only — no write side-effects.
 *
 * @see packages/shared/src/analytics.ts      (AnalyticsSummary shape)
 * @see packages/shared/src/match-feedback.ts (CalibrationSummary shape)
 * @see packages/shared/src/seller-intent.ts  (SellerIntentListResponse shape)
 * @see packages/shared/src/rbac.ts           (NAV_INSIGHTS + /insights route entry)
 * @see apps/web/next.config.ts               (/analytics + /match-feedback + /seller-intent afterFiles rewrites)
 */

import type {
  AnalyticsSummary,
  CalibrationSummary,
  MeResponse,
  Role,
  SellerIntentDirection,
  SellerIntentListResponse,
} from '@dealflow/shared';
import {
  analyticsSummarySchema,
  calibrationSummarySchema,
  meResponseSchema,
  sellerIntentListResponseSchema,
} from '@dealflow/shared';
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
// Match-feedback calibration fetch — GET /match-feedback (SSR, cookie-forwarded)
//
// Wave-19 (task 077974a2). Returns null on any failure.
// The calibration section renders a graceful error state when null is received.
// ---------------------------------------------------------------------------

async function fetchCalibration(cookie: string): Promise<CalibrationSummary | null> {
  try {
    const res = await fetch(`${apiBase()}/match-feedback`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = calibrationSummarySchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Seller-intent fetch — GET /seller-intent (SSR, cookie-forwarded)
//
// Wave-23 (task 6840c25d). Returns null on any failure.
// The seller-intent section renders a graceful error state when null is received.
// ---------------------------------------------------------------------------

async function fetchSellerIntent(cookie: string): Promise<SellerIntentListResponse | null> {
  try {
    const res = await fetch(`${apiBase()}/seller-intent`, {
      headers: { cookie },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const raw: unknown = await res.json();
    const parsed = sellerIntentListResponseSchema.safeParse(raw);
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

/**
 * G2: Honest accept-rate formatting (load-bearing — CODE-OF-CONDUCT §metric).
 *
 *   null   → "n/a"  (0 decided in cohort; measurement gap, NOT a 0% outcome)
 *   0      → "0%"   (decided > 0 but 0 accepted; real 0% outcome)
 *   number → "X.X%" (real rate)
 *
 * MUST NOT conflate null and 0 — rendering null as "0%" is a misleading metric.
 */
function fmtAcceptRate(rate: number | null): string {
  if (rate === null) return 'n/a';
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Small-sample threshold (B-6, CODE-OF-CONDUCT §metric honesty).
 * A band or cohort with fewer than this many decided candidates is not a strong
 * signal. Rates for these cohorts carry a visible "(low sample)" annotation so
 * M&A advisors can calibrate confidence themselves.
 */
const LOW_SAMPLE_THRESHOLD = 5;

/**
 * G2 + small-sample: format an accept-rate cell value.
 *
 *   null              → "n/a"              (0 decided — measurement gap)
 *   0/number, low n   → "X.X% (low sample)" (decidedCount < LOW_SAMPLE_THRESHOLD — weak signal)
 *   0/number, ok n    → "X.X%"              (sufficient sample — normal display)
 *
 * decidedCount=0 must produce null acceptRate (caller invariant, G2). When
 * decidedCount>0 AND rate is non-null AND decidedCount < LOW_SAMPLE_THRESHOLD,
 * append "(low sample)" so advisors see the caveat.
 */
function fmtAcceptRateWithCaveat(rate: number | null, decidedCount: number): string {
  if (rate === null) return 'n/a';
  const pct = `${(rate * 100).toFixed(1)}%`;
  if (decidedCount < LOW_SAMPLE_THRESHOLD) {
    return `${pct} (n=${String(decidedCount)})`;
  }
  return pct;
}

/** Dimension name → human label (sectorMatch / contactCompleteness only — tieBreak excluded). */
function dimensionLabel(dimension: string): string {
  switch (dimension) {
    case 'sectorMatch':
      return 'Sector Match';
    case 'contactCompleteness':
      return 'Contact Completeness';
    default:
      return dimension;
  }
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
// Seller-intent helpers (wave-23, task 6840c25d)
// ---------------------------------------------------------------------------

/**
 * Direction indicator chip — color-coded per the design system:
 *   heating → emerald-600 (#10b981) + ↑
 *   cooling → amber-600  (#d97706) + ↓
 *   flat    → zinc-500   (#6b7280) + —
 *
 * SI1 invariant: tieBreak is NEVER a direction; direction is one of the
 * three real values above, always present (never null/undefined).
 */
function directionChip(direction: SellerIntentDirection): React.ReactElement {
  switch (direction) {
    case 'heating':
      return (
        <span style={{ color: '#10b981', fontWeight: 600 }} aria-label="Heating">
          ↑ Heating
        </span>
      );
    case 'cooling':
      return (
        <span style={{ color: '#d97706', fontWeight: 600 }} aria-label="Cooling">
          ↓ Cooling
        </span>
      );
    case 'flat':
      return (
        <span style={{ color: '#6b7280', fontWeight: 600 }} aria-label="Flat">
          — Flat
        </span>
      );
  }
}

/**
 * Returns true when a signal key (e.g. 'outreachEngagement') appears in the
 * notApplied array. Each notApplied entry is a description string that starts
 * with the signal key, e.g. 'outreachEngagement: not applied — no data'.
 *
 * When a signal is not applied its numeric score is 0 — but "0" (zero engagement)
 * and "—" (no engagement data at all) are different facts. Render "—" for
 * notApplied signals to avoid conflating absence-of-data with zero-activity.
 */
function isSignalNotApplied(notApplied: string[], signalKey: string): boolean {
  return notApplied.some((s) => s.startsWith(signalKey));
}

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

  // 3. SSR-fetch analytics summary + calibration + seller-intent (parallel — independent fetches).
  const [data, calibration, sellerIntent] = await Promise.all([
    fetchAnalytics(cookie),
    fetchCalibration(cookie),
    fetchSellerIntent(cookie),
  ]);

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
        <CalibrationSection calibration={calibration} />
        <SellerIntentSection sellerIntent={sellerIntent} />
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

      {/* ── C: Match Score Calibration (wave-19, task 077974a2) ───────── */}
      <CalibrationSection calibration={calibration} />

      {/* ── SI: Seller Intent (wave-23, task 6840c25d) ────────────────── */}
      <SellerIntentSection sellerIntent={sellerIntent} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seller-intent section sub-component (wave-23, task 6840c25d)
//
// Per-mandate: score (0-100), direction (heating/cooling/flat) + 3-signal breakdown
// (outreachEngagement/pipelineVelocity/matchDisposition). NO tieBreak (SI1).
// Sorted by score descending (hottest mandates first).
//
// notApplied signals: a signal present in the notApplied array had zero source
// data — render "—" (absence of data) NOT "0" (zero-activity). See isSignalNotApplied.
//
// direction: always one of 'heating' | 'cooling' | 'flat' — never null/undefined.
// ---------------------------------------------------------------------------

interface SellerIntentSectionProps {
  sellerIntent: SellerIntentListResponse | null;
}

function SellerIntentSection({ sellerIntent }: SellerIntentSectionProps) {
  // Error state: API failed or schema mismatch.
  if (sellerIntent === null) {
    return (
      <section aria-label="Seller intent" style={CARD_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>Seller Intent</h2>
        <div
          role="alert"
          style={{
            backgroundColor: '#fef2f2', // red-50
            border: '1px solid #fecaca', // red-200
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#dc2626',
          }}
        >
          Unable to load seller-intent data. Please try refreshing the page.
        </div>
      </section>
    );
  }

  // Sort by score descending — hottest mandates first (actionable "which deals are hot" view).
  const sorted = [...sellerIntent].sort((a, b) => b.score - a.score);

  // Empty state: workspace has no scored mandates yet.
  if (sorted.length === 0) {
    return (
      <section aria-label="Seller intent" style={CARD_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>Seller Intent</h2>
        <p
          style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}
          data-testid="seller-intent-empty"
        >
          No seller-intent signals yet. Signals will appear once your firm has scored mandates.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Seller intent" style={CARD_STYLE}>
      <h2 style={CARD_TITLE_STYLE}>Seller Intent</h2>
      {/* Signals: outreachEngagement / pipelineVelocity / matchDisposition only.
          SI1: tieBreak is NEVER surfaced — not in the API response, not rendered. */}
      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE_STYLE} aria-label="Seller intent per mandate">
          <thead>
            <tr>
              <th style={TH_STYLE}>Mandate</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>Intent score</th>
              <th style={TH_STYLE}>Direction</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>Outreach Eng.</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>Pipeline Vel.</th>
              <th style={{ ...TH_STYLE, textAlign: 'right' }}>Match Disp.</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const { breakdown } = item;
              const oeNA = isSignalNotApplied(breakdown.notApplied, 'outreachEngagement');
              const pvNA = isSignalNotApplied(breakdown.notApplied, 'pipelineVelocity');
              const mdNA = isSignalNotApplied(breakdown.notApplied, 'matchDisposition');
              return (
                <tr key={item.mandateId}>
                  <td style={TD_STYLE}>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '12px',
                        color: '#6b7280',
                      }}
                    >
                      {item.mandateId.slice(0, 8)}&hellip;
                    </span>
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: 700,
                      color: '#111827',
                    }}
                    data-testid="si-score"
                  >
                    {item.score}
                  </td>
                  <td style={TD_STYLE} data-testid="si-direction">
                    {directionChip(item.direction)}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: oeNA ? '#9ca3af' : '#374151',
                    }}
                  >
                    {oeNA ? '—' : breakdown.outreachEngagement}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: pvNA ? '#9ca3af' : '#374151',
                    }}
                  >
                    {pvNA ? '—' : breakdown.pipelineVelocity}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: mdNA ? '#9ca3af' : '#374151',
                    }}
                  >
                    {mdNA ? '—' : breakdown.matchDisposition}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Calibration section sub-component (wave-19, task 077974a2)
//
// G2 (load-bearing): acceptRate is `number | null`.
//   null   → decidedCount = 0 → render "n/a" (measurement gap, not a 0% outcome).
//   0      → decidedCount > 0 but 0 accepted → render "0%" (real outcome).
// Never conflate null and 0 (CODE-OF-CONDUCT §metric).
//
// Small-sample honesty (B-6, CODE-OF-CONDUCT §metric):
//   decidedCount > 0 but < LOW_SAMPLE_THRESHOLD → render "X.X% (n=N)" and mute
//   the value (zinc-400 instead of emerald). A single-row cohort "100.0%" is not
//   a strong signal — the n= annotation lets the advisor judge confidence themselves.
//   Applies to BOTH bands (fit_score) AND dimension-lift cohorts.
// ---------------------------------------------------------------------------

interface CalibrationSectionProps {
  calibration: CalibrationSummary | null;
}

function CalibrationSection({ calibration }: CalibrationSectionProps) {
  // Error state: API failed or schema mismatch.
  if (calibration === null) {
    return (
      <section aria-label="Match score calibration" style={CARD_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>Match Score Calibration</h2>
        <div
          role="alert"
          style={{
            backgroundColor: '#fef2f2', // red-50
            border: '1px solid #fecaca', // red-200
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '13px',
            color: '#dc2626',
          }}
        >
          Unable to load calibration data. Please try refreshing the page.
        </div>
      </section>
    );
  }

  // Empty state: no decided matches yet (all acceptRates will be null).
  if (calibration.totalDecided === 0) {
    return (
      <section aria-label="Match score calibration" style={CARD_STYLE}>
        <h2 style={CARD_TITLE_STYLE}>Match Score Calibration</h2>
        <p
          style={{ margin: 0, fontSize: '14px', color: '#6b7280' }}
          data-testid="calibration-empty"
        >
          Not enough decided matches yet to show calibration.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Match score calibration" style={CARD_STYLE}>
      <h2 style={CARD_TITLE_STYLE}>Match Score Calibration</h2>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#6b7280' }}>
        Does a higher fit score predict acceptance? Based on {calibration.totalDecided} decided
        match
        {calibration.totalDecided !== 1 ? 'es' : ''}.
      </p>

      {/* ── Overall calibration: 4 fit_score bands ───────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <h3
          style={{
            margin: '0 0 12px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#6b7280',
          }}
        >
          Accept rate by fit score band
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE_STYLE} aria-label="Accept rate by fit score band">
            <thead>
              <tr>
                <th style={TH_STYLE}>Score band</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>Decided</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>Accepted</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>Accept rate</th>
              </tr>
            </thead>
            <tbody>
              {calibration.bands.map((band) => (
                <tr key={band.band}>
                  <td style={TD_STYLE}>
                    <span
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontSize: '12px',
                        color: '#374151',
                      }}
                    >
                      {band.band}
                    </span>
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {band.decidedCount}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {band.acceptedCount}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      // G2: null → muted "n/a"; low-sample → zinc-400 (not confident);
                      // real 0 → zinc-500; positive → emerald-500.
                      color:
                        band.acceptRate === null
                          ? '#9ca3af' // zinc-400 — measurement gap
                          : band.decidedCount < LOW_SAMPLE_THRESHOLD
                            ? '#9ca3af' // zinc-400 — low sample, not confident
                            : band.acceptRate === 0
                              ? '#6b7280' // zinc-500 — real 0%
                              : '#10b981', // emerald-500 — positive rate
                    }}
                  >
                    {/* G2 + small-sample: null → "n/a"; low n → "X.X% (n=N)"; else "X.X%" */}
                    {fmtAcceptRateWithCaveat(band.acceptRate, band.decidedCount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Per-dimension lift: sectorMatch / contactCompleteness (tieBreak excluded — B-6) */}
      <div>
        <h3
          style={{
            margin: '0 0 12px',
            fontSize: '13px',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#6b7280',
          }}
        >
          Accept rate by score dimension (high vs low cohort)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE_STYLE} aria-label="Accept rate by score dimension">
            <thead>
              <tr>
                <th style={TH_STYLE}>Dimension</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>High cohort</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>Low cohort</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>High decided</th>
                <th style={{ ...TH_STYLE, textAlign: 'right' }}>Low decided</th>
              </tr>
            </thead>
            <tbody>
              {calibration.dimensionLifts.map((lift) => (
                <tr key={lift.dimension}>
                  <td style={TD_STYLE}>{dimensionLabel(lift.dimension)}</td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      // G2 + small-sample: null → muted; low n → zinc-400 (not confident);
                      // real 0 → zinc-500; positive → emerald-500.
                      color:
                        lift.high.acceptRate === null
                          ? '#9ca3af'
                          : lift.high.decidedCount < LOW_SAMPLE_THRESHOLD
                            ? '#9ca3af'
                            : lift.high.acceptRate === 0
                              ? '#6b7280'
                              : '#10b981',
                    }}
                  >
                    {fmtAcceptRateWithCaveat(lift.high.acceptRate, lift.high.decidedCount)}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      // G2 + small-sample: same logic for low cohort.
                      color:
                        lift.low.acceptRate === null
                          ? '#9ca3af'
                          : lift.low.decidedCount < LOW_SAMPLE_THRESHOLD
                            ? '#9ca3af'
                            : lift.low.acceptRate === 0
                              ? '#6b7280'
                              : '#10b981',
                    }}
                  >
                    {fmtAcceptRateWithCaveat(lift.low.acceptRate, lift.low.decidedCount)}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#374151',
                    }}
                  >
                    {lift.high.decidedCount}
                  </td>
                  <td
                    style={{
                      ...TD_STYLE,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                      color: '#374151',
                    }}
                  >
                    {lift.low.decidedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
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
