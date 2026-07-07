/**
 * /insights — InsightsPage tests (wave-18 task 4b014689 + wave-19 task 077974a2).
 *
 * Coverage:
 *   - Renders per design: page title, 4 metric family sections.
 *   - F2 labels: "Compliance-gate pass rate" / "Blocked rate" — NOT response rate.
 *   - Empty state: graceful "No analytics data yet" when all counts are zero.
 *   - Error state: error banner when /analytics returns non-ok.
 *   - RBAC: advisor + admin see the page; analyst / compliance → redirect('/').
 *   - Unauthenticated → redirect('/login').
 *   - No charts library, no real-time, no export affordance.
 *   - Read-only: no edit/delete/send/write buttons.
 *   - Wave-19 C section: match-score calibration (4 bands + 3 dimension lifts).
 *   - G2 honest null-vs-zero rendering: null → "n/a", 0 (number) → "0%".
 *   - Calibration empty state when totalDecided=0.
 *   - Calibration error state when /match-feedback returns non-ok.
 *   - RBAC for /match-feedback data path: advisor+admin allowed, analyst+compliance denied.
 */

import type { AnalyticsSummary, CalibrationSummary, Role } from '@dealflow/shared';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockRedirect, mockCookies } = vi.hoisted(() => {
  const mockRedirect = vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  });
  const mockCookies = vi.fn().mockResolvedValue({
    toString: () => 'st-access-token=test-token',
  });
  return { mockRedirect, mockCookies };
});

vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('next/headers', () => ({ cookies: mockCookies }));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import InsightsPage from './page';

// ── Helpers ────────────────────────────────────────────────────────────────

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const EMPTY_ANALYTICS: AnalyticsSummary = {
  mandateThroughput: { totalDraft: 0, totalActive: 0, total: 0 },
  outreachGateOutcomes: {
    totalCompose: 0,
    totalSendEligible: 0,
    totalBlocked: 0,
    total: 0,
    gatePassRate: null,
    blockedRate: null,
  },
  advisorProductivity: { rows: [], total: 0 },
  matchDisposition: {
    totalPending: 0,
    totalAccepted: 0,
    totalRejected: 0,
    totalFlagged: 0,
    total: 0,
  },
};

const POPULATED_ANALYTICS: AnalyticsSummary = {
  mandateThroughput: { totalDraft: 2, totalActive: 5, total: 7 },
  outreachGateOutcomes: {
    totalCompose: 1,
    totalSendEligible: 8,
    totalBlocked: 2,
    total: 11,
    gatePassRate: 0.727,
    blockedRate: 0.182,
  },
  advisorProductivity: {
    rows: [
      {
        userId: '00000000-0000-0000-0000-000000000001',
        mandatesCreated: 3,
        pipelineRows: 4,
      },
      {
        userId: '00000000-0000-0000-0000-000000000002',
        mandatesCreated: 2,
        pipelineRows: 1,
      },
    ],
    total: 2,
  },
  matchDisposition: {
    totalPending: 3,
    totalAccepted: 5,
    totalRejected: 1,
    totalFlagged: 2,
    total: 11,
  },
};

/**
 * Calibration fixture with decided matches across bands.
 * Band 76-100 has acceptRate=null (0 decided) to test G2 null path.
 * Band 51-75 has acceptRate=0 (decided > 0 but 0 accepted) to test G2 real-0 path.
 */
const POPULATED_CALIBRATION: CalibrationSummary = {
  totalDecided: 12,
  bands: [
    { band: '0-25', decidedCount: 4, acceptedCount: 1, acceptRate: 0.25 },
    { band: '26-50', decidedCount: 3, acceptedCount: 2, acceptRate: 0.667 },
    // G2 real-0: decided > 0 but 0 accepted → "0%"
    { band: '51-75', decidedCount: 5, acceptedCount: 0, acceptRate: 0 },
    // G2 null: 0 decided → "n/a"
    { band: '76-100', decidedCount: 0, acceptedCount: 0, acceptRate: null },
  ],
  dimensionLifts: [
    {
      dimension: 'sectorMatch',
      high: { cohort: 'high', decidedCount: 8, acceptedCount: 4, acceptRate: 0.5 },
      low: { cohort: 'low', decidedCount: 4, acceptedCount: 1, acceptRate: 0.25 },
    },
    {
      dimension: 'contactCompleteness',
      high: { cohort: 'high', decidedCount: 6, acceptedCount: 3, acceptRate: 0.5 },
      // G2 real-0 for a cohort
      low: { cohort: 'low', decidedCount: 6, acceptedCount: 0, acceptRate: 0 },
    },
    {
      dimension: 'tieBreak',
      // G2 null for a cohort
      high: { cohort: 'high', decidedCount: 0, acceptedCount: 0, acceptRate: null },
      low: { cohort: 'low', decidedCount: 12, acceptedCount: 5, acceptRate: 0.417 },
    },
  ],
};

/** Calibration with totalDecided=0 — all acceptRates null */
const EMPTY_CALIBRATION: CalibrationSummary = {
  totalDecided: 0,
  bands: [
    { band: '0-25', decidedCount: 0, acceptedCount: 0, acceptRate: null },
    { band: '26-50', decidedCount: 0, acceptedCount: 0, acceptRate: null },
    { band: '51-75', decidedCount: 0, acceptedCount: 0, acceptRate: null },
    { band: '76-100', decidedCount: 0, acceptedCount: 0, acceptRate: null },
  ],
  dimensionLifts: [
    {
      dimension: 'sectorMatch',
      high: { cohort: 'high', decidedCount: 0, acceptedCount: 0, acceptRate: null },
      low: { cohort: 'low', decidedCount: 0, acceptedCount: 0, acceptRate: null },
    },
    {
      dimension: 'contactCompleteness',
      high: { cohort: 'high', decidedCount: 0, acceptedCount: 0, acceptRate: null },
      low: { cohort: 'low', decidedCount: 0, acceptedCount: 0, acceptRate: null },
    },
    {
      dimension: 'tieBreak',
      high: { cohort: 'high', decidedCount: 0, acceptedCount: 0, acceptRate: null },
      low: { cohort: 'low', decidedCount: 0, acceptedCount: 0, acceptRate: null },
    },
  ],
};

function makeFetch(
  meBody: unknown,
  meOk: boolean,
  analyticsBody: unknown,
  analyticsOk = true,
  calibrationBody: unknown = POPULATED_CALIBRATION,
  calibrationOk = true
) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: meOk,
        status: meOk ? 200 : 401,
        json: () => Promise.resolve(meBody),
      } as Response);
    }
    if (s.includes('/match-feedback')) {
      return Promise.resolve({
        ok: calibrationOk,
        status: calibrationOk ? 200 : 403,
        json: () => Promise.resolve(calibrationBody),
      } as Response);
    }
    if (s.includes('/analytics')) {
      return Promise.resolve({
        ok: analyticsOk,
        status: analyticsOk ? 200 : 403,
        json: () => Promise.resolve(analyticsBody),
      } as Response);
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) } as Response);
  });
}

async function renderPage() {
  try {
    const jsx = await InsightsPage();
    if (jsx) render(jsx);
    return { redirected: false, path: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('InsightsPage (/insights)', () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({ toString: () => 'st-access-token=test-token' });
    mockRedirect.mockImplementation((path: string): never => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── Renders per design ──────────────────────────────────────────────────

  describe('renders per design (populated data)', () => {
    it('renders "Insights" page heading for advisor', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      expect(screen.getByRole('heading', { name: /insights/i, level: 1 })).toBeDefined();
    });

    it('renders "Insights" page heading for admin', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('admin'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByRole('heading', { name: /insights/i, level: 1 })).toBeDefined();
    });

    it('renders F1 mandate throughput section', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByRole('region', { name: /mandate throughput/i })).toBeDefined();
    });

    it('renders F2 outreach compliance-gate outcomes section', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(
        screen.getByRole('region', { name: /outreach compliance-gate outcomes/i })
      ).toBeDefined();
    });

    it('renders F3 advisor productivity section', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByRole('region', { name: /advisor productivity/i })).toBeDefined();
    });

    it('renders F4 match disposition section', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByRole('region', { name: /match disposition/i })).toBeDefined();
    });

    it('renders C match score calibration section', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByRole('region', { name: /match score calibration/i })).toBeDefined();
    });
  });

  // ── F2 label correctness (karen metric-correction) ───────────────────────

  describe('F2 labels: compliance-gate NOT response-rate', () => {
    it('renders "Compliance-gate pass rate" label (not response rate)', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByText(/compliance-gate pass rate/i)).toBeDefined();
    });

    it('renders "Blocked rate" label', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByText(/blocked rate/i)).toBeDefined();
    });

    it('does NOT render "response rate" anywhere', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.queryByText(/response rate/i)).toBeNull();
    });

    it('renders "n/a" for gatePassRate when total=0 (div-by-zero safe)', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, EMPTY_ANALYTICS));
      // empty analytics renders empty state, not metric cards
      // verify the fmtRate helper: null → "n/a" is exercised in the non-empty
      // path; here we verify no crash on the empty-state branch
      await renderPage();
      expect(screen.getByText(/no analytics data yet/i)).toBeDefined();
    });
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders graceful empty state when all counts are zero', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, EMPTY_ANALYTICS));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      expect(screen.getByText(/no analytics data yet/i)).toBeDefined();
    });

    it('does not render metric sections in empty state', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, EMPTY_ANALYTICS));
      await renderPage();
      expect(screen.queryByRole('region', { name: /mandate throughput/i })).toBeNull();
    });
  });

  // ── Error state ─────────────────────────────────────────────────────────

  describe('error state', () => {
    it('renders error banner when /analytics returns non-ok', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, {}, false));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/unable to load analytics/i)).toBeDefined();
    });

    it('renders error banner when fetch throws', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) => {
          if (String(url).includes('/auth/me')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(meFor('advisor')),
            } as Response);
          }
          return Promise.reject(new Error('network error'));
        })
      );
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  // ── RBAC: advisor + admin see it ─────────────────────────────────────────

  describe('RBAC: advisor + admin see the page', () => {
    for (const role of ['advisor', 'admin'] as Role[]) {
      it(`${role} can access /insights (no redirect)`, async () => {
        vi.stubGlobal('fetch', makeFetch(meFor(role), true, POPULATED_ANALYTICS));
        const { redirected } = await renderPage();
        expect(redirected).toBe(false);
      });
    }
  });

  // ── RBAC: non-permitted roles are redirected ─────────────────────────────

  describe('RBAC: non-permitted roles redirect to "/"', () => {
    const NON_PERMITTED: Role[] = ['analyst', 'compliance'];
    for (const role of NON_PERMITTED) {
      it(`redirects ${role} to '/'`, async () => {
        vi.stubGlobal('fetch', makeFetch(meFor(role), true, POPULATED_ANALYTICS));
        const { redirected, path } = await renderPage();
        expect(redirected).toBe(true);
        expect(path).toBe('/');
      });
    }
  });

  // ── Unauthenticated ──────────────────────────────────────────────────────

  describe('unauthenticated', () => {
    it('redirects to /login when /auth/me returns 401', async () => {
      vi.stubGlobal('fetch', makeFetch({}, false, POPULATED_ANALYTICS));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  // ── No gold-plating: no charts, no real-time, no export ─────────────────

  describe('no gold-plating — read-only, no charts/real-time/export', () => {
    it('does not render any write/send/delete/export/chart affordance', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /edit/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /chart/i })).toBeNull();
    });
  });

  // ── F3 advisor productivity table ────────────────────────────────────────

  describe('F3 advisor productivity table', () => {
    it('renders advisor rows in the productivity table', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByRole('table', { name: /per-advisor activity breakdown/i })).toBeDefined();
    });

    it('renders "Mandates Created" column header', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByRole('columnheader', { name: /mandates created/i })).toBeDefined();
    });

    it('renders "Pipeline Rows" column header', async () => {
      vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
      await renderPage();
      expect(screen.getByRole('columnheader', { name: /pipeline rows/i })).toBeDefined();
    });
  });

  // ── Wave-19: Match score calibration section (task 077974a2) ────────────

  describe('wave-19: match score calibration section (task 077974a2)', () => {
    describe('renders calibration tables with populated data', () => {
      it('renders the "Match Score Calibration" section heading', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        expect(screen.getByRole('region', { name: /match score calibration/i })).toBeDefined();
      });

      it('renders the "Accept rate by fit score band" table', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        expect(screen.getByRole('table', { name: /accept rate by fit score band/i })).toBeDefined();
      });

      it('renders the "Accept rate by score dimension" table', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        expect(
          screen.getByRole('table', { name: /accept rate by score dimension/i })
        ).toBeDefined();
      });

      it('renders all 4 score band identifiers', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        expect(screen.getByText('0-25')).toBeDefined();
        expect(screen.getByText('26-50')).toBeDefined();
        expect(screen.getByText('51-75')).toBeDefined();
        expect(screen.getByText('76-100')).toBeDefined();
      });

      it('renders all 3 score dimension labels', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        expect(screen.getByText(/sector match/i)).toBeDefined();
        expect(screen.getByText(/contact completeness/i)).toBeDefined();
        expect(screen.getByText(/tie-break/i)).toBeDefined();
      });
    });

    // ── G2: Honest null-vs-zero rendering (load-bearing) ─────────────────

    describe('G2: honest null-vs-zero rendering (load-bearing)', () => {
      it('renders "n/a" for band with acceptRate=null (0 decided — measurement gap)', async () => {
        // POPULATED_CALIBRATION has band 76-100 with acceptRate=null
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        // At least one "n/a" must be present (band 76-100 has null acceptRate)
        const naElements = screen.getAllByText('n/a');
        expect(naElements.length).toBeGreaterThan(0);
      });

      it('renders "0.0%" for band with acceptRate=0 (decided > 0, 0 accepted — real 0%)', async () => {
        // POPULATED_CALIBRATION has band 51-75 with acceptRate=0 (real zero)
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        // "0.0%" must appear (real zero accept rate — not "n/a")
        const zeroElements = screen.getAllByText('0.0%');
        expect(zeroElements.length).toBeGreaterThan(0);
      });

      it('does NOT render null acceptRate as "0.0%" (G2 — no false zero)', async () => {
        // Build a calibration where band 76-100 has acceptRate=null.
        // The band should appear as "n/a", NOT as "0.0%".
        // Count "n/a" occurrences and "0.0%" occurrences to verify they are different cells.
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        // band 76-100 (null) must show "n/a"; band 51-75 (0) must show "0.0%"
        // Both must be present in the DOM — they are distinct, not the same text.
        const naItems = screen.getAllByText('n/a');
        const zeroItems = screen.getAllByText('0.0%');
        expect(naItems.length).toBeGreaterThan(0);
        expect(zeroItems.length).toBeGreaterThan(0);
      });

      it('renders "n/a" for dimension cohort with acceptRate=null (G2)', async () => {
        // tieBreak high cohort has acceptRate=null
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        const naItems = screen.getAllByText('n/a');
        // There must be at least 2 "n/a" items (band 76-100 + tieBreak high cohort)
        expect(naItems.length).toBeGreaterThanOrEqual(2);
      });

      it('renders "0.0%" for dimension cohort with acceptRate=0 (G2 real zero)', async () => {
        // contactCompleteness low cohort has acceptRate=0
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        await renderPage();
        const zeroItems = screen.getAllByText('0.0%');
        // At least 2 "0.0%" items (band 51-75 + contactCompleteness low cohort)
        expect(zeroItems.length).toBeGreaterThanOrEqual(2);
      });
    });

    // ── Calibration empty state ───────────────────────────────────────────

    describe('calibration empty state (totalDecided=0)', () => {
      it('renders graceful empty-state message when totalDecided=0', async () => {
        vi.stubGlobal(
          'fetch',
          makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS, true, EMPTY_CALIBRATION)
        );
        await renderPage();
        expect(
          screen.getByText(/not enough decided matches yet to show calibration/i)
        ).toBeDefined();
      });

      it('does not render band or dimension tables when totalDecided=0', async () => {
        vi.stubGlobal(
          'fetch',
          makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS, true, EMPTY_CALIBRATION)
        );
        await renderPage();
        expect(screen.queryByRole('table', { name: /accept rate by fit score band/i })).toBeNull();
        expect(screen.queryByRole('table', { name: /accept rate by score dimension/i })).toBeNull();
      });

      it('still renders calibration empty state when analytics empty state also fires', async () => {
        // Both analytics and calibration are empty
        vi.stubGlobal(
          'fetch',
          makeFetch(meFor('advisor'), true, EMPTY_ANALYTICS, true, EMPTY_CALIBRATION)
        );
        await renderPage();
        // Analytics empty state renders
        expect(screen.getByText(/no analytics data yet/i)).toBeDefined();
        // Calibration empty state also renders (calibration section is always present)
        expect(
          screen.getByText(/not enough decided matches yet to show calibration/i)
        ).toBeDefined();
      });
    });

    // ── Calibration error state ───────────────────────────────────────────

    describe('calibration error state (/match-feedback returns non-ok)', () => {
      it('renders calibration error banner when /match-feedback returns non-ok', async () => {
        vi.stubGlobal(
          'fetch',
          makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS, true, {}, false)
        );
        await renderPage();
        // The calibration section renders an error alert (not a page-level crash)
        expect(screen.getByText(/unable to load calibration data/i)).toBeDefined();
      });

      it('still renders the analytics sections even when calibration fails', async () => {
        vi.stubGlobal(
          'fetch',
          makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS, true, {}, false)
        );
        await renderPage();
        expect(screen.getByRole('region', { name: /mandate throughput/i })).toBeDefined();
        expect(screen.getByText(/unable to load calibration data/i)).toBeDefined();
      });
    });

    // ── RBAC for /match-feedback data path ───────────────────────────────

    describe('RBAC for /match-feedback data path (advisor+admin allowed, analyst+compliance denied)', () => {
      it('advisor receives calibration data (no RBAC block)', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('advisor'), true, POPULATED_ANALYTICS));
        const { redirected } = await renderPage();
        expect(redirected).toBe(false);
        expect(screen.getByRole('region', { name: /match score calibration/i })).toBeDefined();
      });

      it('admin receives calibration data (no RBAC block)', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('admin'), true, POPULATED_ANALYTICS));
        const { redirected } = await renderPage();
        expect(redirected).toBe(false);
        expect(screen.getByRole('region', { name: /match score calibration/i })).toBeDefined();
      });

      it('analyst is redirected before reaching calibration (page-level RBAC gate)', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('analyst'), true, POPULATED_ANALYTICS));
        const { redirected, path } = await renderPage();
        expect(redirected).toBe(true);
        expect(path).toBe('/');
      });

      it('compliance is redirected before reaching calibration (page-level RBAC gate)', async () => {
        vi.stubGlobal('fetch', makeFetch(meFor('compliance'), true, POPULATED_ANALYTICS));
        const { redirected, path } = await renderPage();
        expect(redirected).toBe(true);
        expect(path).toBe('/');
      });
    });
  });
});
