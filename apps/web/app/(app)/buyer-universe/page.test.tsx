/**
 * /buyer-universe page — B-3 tests (wave-9).
 *
 * Coverage:
 *
 * A. Page renders (RBAC + SSR-hydration):
 *    - Renders for analyst/advisor/admin (no redirect).
 *    - Compliance → redirects to '/'.
 *    - Unauthenticated → redirects to '/login'.
 *    - Assemble CTA renders when no universe (initialDetail=null).
 *    - Candidate table renders when assembled (initialDetail present).
 *    - No-mandateId state renders an alert.
 *
 * B. BuyerUniverseClient mutations — all via /buyer-universe-data (NOT /buyer-universe):
 *    - assemble: POST /buyer-universe-data (not /buyer-universe).
 *    - filter: POST /buyer-universe-data/:id/filter.
 *    - include/exclude: PATCH /buyer-universe-data/:id/candidates/:cid.
 *    - enrich: POST /buyer-universe-data/:id/enrich.
 *    - view gaps: GET /buyer-universe-data/:id/gaps.
 *    - submit: POST /buyer-universe-data/:id/submit → ready-to-rank (status changes to 'submitted').
 *
 * C. Submit guards:
 *    - submit button disabled when no included candidates.
 *    - submit button disabled when already submitted.
 *
 * D. Mandate-detail D6 anchor:
 *    - The 'Buyer Engine' section in MandateDetailClient renders a link to
 *      /buyer-universe?mandateId=<id>.
 *
 * E. M4/M5 boundary:
 *    - No score / rank field rendered in candidate row.
 *
 * F. Anti-csrf:
 *    - All mutations include rid:anti-csrf header.
 *
 * Strategy:
 *   - Server page component (async) awaited + rendered.
 *   - Client component rendered directly for unit tests.
 *   - next/navigation + next/headers mocked at module boundary.
 *   - AppShell excluded (inherited from (app)/layout).
 *   - e2e paths excluded.
 */

import type { BuyerUniverseDetail, MandateDetail } from '@dealflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockRedirect, mockCookies } = vi.hoisted(() => {
  const mockRedirect = vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  });
  const mockCookies = vi.fn().mockResolvedValue({
    toString: () => 'st-access-token=test-token',
  });
  return { mockRedirect, mockCookies };
});

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next/headers', () => ({ cookies: mockCookies }));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { MandateDetailClient } from '../mandates/_components/MandateDetailClient';
import { BuyerUniverseClient } from './_components/BuyerUniverseClient';
import BuyerUniversePage from './page';

// ── Fixture data ────────────────────────────────────────────────────────────

type RoleStr = 'advisor' | 'analyst' | 'compliance' | 'admin';

const MANDATE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const UNIVERSE_ID = 'bbbbbbbb-1111-0000-0000-000000000001';
const CANDIDATE_ID = 'cccccccc-2222-0000-0000-000000000001';
const COMPANY_ID = 'dddddddd-3333-0000-0000-000000000001';

const NOW_ISO = '2026-07-04T04:42:20.000Z';

function meFor(role: RoleStr) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const CANDIDATE_1 = {
  id: CANDIDATE_ID,
  buyerUniverseId: UNIVERSE_ID,
  companyId: COMPANY_ID,
  membershipStatus: 'included' as const,
  provenance: 'criteria-match',
  createdAt: NOW_ISO,
  contacts: [
    {
      id: 'eeeeeeee-4444-0000-0000-000000000001',
      companyId: COMPANY_ID,
      name: 'Jane Doe',
      email: 'jane@apex.com',
      normalizedEmail: 'jane@apex.com',
      title: 'Partner',
      createdAt: NOW_ISO,
      updatedAt: null,
    },
  ],
};

const UNIVERSE_DETAIL: BuyerUniverseDetail = {
  universe: {
    id: UNIVERSE_ID,
    mandateId: MANDATE_ID,
    createdBy: 'ffffffff-5555-0000-0000-000000000001',
    status: 'draft',
    createdAt: NOW_ISO,
    updatedAt: null,
  },
  candidates: [CANDIDATE_1],
};

const UNIVERSE_DETAIL_SUBMITTED: BuyerUniverseDetail = {
  universe: {
    ...UNIVERSE_DETAIL.universe,
    status: 'submitted',
  },
  candidates: [CANDIDATE_1],
};

// Minimal MandateDetail fixture for D6 anchor test
const CRITERIA_ID = '11111111-0000-0000-0000-000000000001';
const PROFILE_ID = '22222222-0000-0000-0000-000000000001';
const TEMPLATE_ID = '33333333-0000-0000-0000-000000000001';

const MANDATE_DETAIL: MandateDetail = {
  mandate: {
    id: MANDATE_ID,
    createdBy: '00000000-0000-0000-0000-000000000001',
    sellerName: 'Apex Analytics Inc.',
    sellerIndustry: 'Enterprise Software / SaaS',
    sellerGeo: ['North America'],
    sellerSizeBand: 'mid',
    description: 'Strong recurring revenue.',
    dealType: 'Full Acquisition',
    status: 'draft',
    createdAt: NOW_ISO,
    updatedAt: null,
  },
  buyerCriteria: {
    id: CRITERIA_ID,
    mandateId: MANDATE_ID,
    industry: 'Enterprise Software / SaaS',
    geo: 'North America',
    sizeBand: 'mid',
    dealType: 'acquisition',
  },
  complianceProfile: {
    id: PROFILE_ID,
    mandateId: MANDATE_ID,
    jurisdiction: 'us_delaware',
    disclaimerTemplateId: TEMPLATE_ID,
    suppressionScope: 'Acme Inc.',
    lawfulAuthorization: true,
    aiResultsValidated: true,
    conflictDbsReviewed: true,
  },
};

// ── Fetch helpers ──────────────────────────────────────────────────────────

function makePageFetch(
  role: RoleStr,
  universeDetail: BuyerUniverseDetail | null = UNIVERSE_DETAIL
) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    // List fetch: GET /buyer-universe?mandateId=
    // The controller returns { universes: BuyerUniverseRow[] } — NOT a bare array.
    if (s.includes('/buyer-universe') && s.includes('mandateId=')) {
      if (universeDetail === null) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ universes: [] }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ universes: [{ id: UNIVERSE_ID }] }),
      } as Response);
    }
    // Detail fetch: GET /buyer-universe/:id
    if (s.includes(`/buyer-universe/${UNIVERSE_ID}`)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(universeDetail),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

/**
 * makePageFetchBareArray — returns the old (broken) list shape: a bare array
 * instead of { universes: [...] }. Used to verify the pre-fix z.array parse
 * would have silently returned null (page always showed assemble CTA).
 */
function makePageFetchBareArray(role: RoleStr) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    // Old (broken) list shape: bare array — the pre-fix z.array parse accepted this,
    // but the pre-fix z.array parse was WRONG — the real API returns { universes: [] }.
    // We use this fixture to confirm the old parse would have returned null.
    if (s.includes('/buyer-universe') && s.includes('mandateId=')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ id: UNIVERSE_ID }]),
      } as Response);
    }
    if (s.includes(`/buyer-universe/${UNIVERSE_ID}`)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(UNIVERSE_DETAIL),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

// ── Page render helper ─────────────────────────────────────────────────────

async function renderPage(mandateId?: string) {
  const searchParams = Promise.resolve(mandateId ? { mandateId } : {});
  try {
    const jsx = await BuyerUniversePage({ searchParams });
    if (jsx) render(jsx);
    return { redirected: false, path: null as string | null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── A. RBAC + SSR renders ──────────────────────────────────────────────────

describe('A. BuyerUniversePage — RBAC + SSR-hydration', () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({ toString: () => 'st-access-token=test' });
    mockRedirect.mockImplementation((path: string): never => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('RBAC guard', () => {
    it('renders for analyst (no redirect)', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      const { redirected } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(false);
    });

    it('renders for advisor (no redirect)', async () => {
      vi.stubGlobal('fetch', makePageFetch('advisor'));
      const { redirected } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(false);
    });

    it('renders for admin (no redirect)', async () => {
      vi.stubGlobal('fetch', makePageFetch('admin'));
      const { redirected } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(false);
    });

    it('redirects to / for compliance role', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      const { redirected, path } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(true);
      expect(path).toBe('/');
    });

    it('redirects to /login when unauthenticated', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({}),
        } as Response)
      );
      const { redirected, path } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  describe('no-mandateId state', () => {
    it('renders alert when no mandateId provided', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      const { redirected } = await renderPage(undefined);
      expect(redirected).toBe(false);
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/no mandate selected/i)).toBeDefined();
    });
  });

  describe('SSR-hydration: assemble CTA when no universe', () => {
    it('renders "Assemble" CTA when no universe exists (initialDetail=null)', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst', null));
      const { redirected } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(false);
      expect(screen.getByRole('button', { name: /assemble buyer universe/i })).toBeDefined();
    });
  });

  describe('SSR-hydration: candidate table when assembled', () => {
    it('renders candidate table when universe exists', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst', UNIVERSE_DETAIL));
      const { redirected } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(false);
      // The candidates table should be present
      expect(screen.getByRole('table', { name: /buyer universe candidates/i })).toBeDefined();
    });
  });
});

// ── B. BuyerUniverseClient mutations via /buyer-universe-data ──────────────

describe('B. BuyerUniverseClient — mutations use /buyer-universe-data (not /buyer-universe)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('assemble: POST /buyer-universe-data (NOT /buyer-universe)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === '/buyer-universe-data' && (init?.method ?? 'GET') === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: UNIVERSE_ID }),
        } as Response);
      }
      if (s === `/buyer-universe-data/${UNIVERSE_ID}`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(UNIVERSE_DETAIL),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<BuyerUniverseClient mandateId={MANDATE_ID} initialDetail={null} userRole="analyst" />);

    await user.click(screen.getByRole('button', { name: /assemble buyer universe/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      // Must call /buyer-universe-data (POST assemble)
      expect(calledUrls.some((u) => u === '/buyer-universe-data')).toBe(true);
      // Must NOT call /buyer-universe (page route)
      expect(calledUrls.some((u) => u === '/buyer-universe')).toBe(false);
    });
  });

  it('assemble: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, _init?: RequestInit) => {
      const s = String(url);
      if (s === '/buyer-universe-data') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ id: UNIVERSE_ID }),
        } as Response);
      }
      if (s === `/buyer-universe-data/${UNIVERSE_ID}`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(UNIVERSE_DETAIL),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<BuyerUniverseClient mandateId={MANDATE_ID} initialDetail={null} userRole="analyst" />);

    await user.click(screen.getByRole('button', { name: /assemble buyer universe/i }));

    await waitFor(() => {
      const assembleCalls = mockFetch.mock.calls.filter(
        (c) => String(c[0]) === '/buyer-universe-data'
      );
      expect(assembleCalls.length).toBeGreaterThan(0);
      const [, init] = assembleCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });

  it('filter: POST /buyer-universe-data/:id/filter (NOT /buyer-universe/:id/filter)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const s = String(url);
      if (s === `/buyer-universe-data/${UNIVERSE_ID}/filter`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(UNIVERSE_DETAIL),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    await user.click(screen.getByRole('button', { name: /apply filter/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u === `/buyer-universe-data/${UNIVERSE_ID}/filter`)).toBe(true);
      // Must NOT call /buyer-universe/:id/filter
      expect(calledUrls.some((u) => u === `/buyer-universe/${UNIVERSE_ID}/filter`)).toBe(false);
    });
  });

  it('include/exclude: PATCH /buyer-universe-data/:id/candidates/:cid (NOT /buyer-universe/...)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ...CANDIDATE_1, membershipStatus: 'excluded' }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    // Click the membership toggle (aria-role="switch")
    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      const expectedPath = `/buyer-universe-data/${UNIVERSE_ID}/candidates/${CANDIDATE_ID}`;
      expect(calledUrls.some((u) => u === expectedPath)).toBe(true);
      // Must NOT call /buyer-universe/:id/candidates/:cid
      expect(
        calledUrls.some((u) => u === `/buyer-universe/${UNIVERSE_ID}/candidates/${CANDIDATE_ID}`)
      ).toBe(false);
    });
  });

  it('include/exclude: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ...CANDIDATE_1, membershipStatus: 'excluded' }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    await waitFor(() => {
      const patchCalls = mockFetch.mock.calls.filter((c) => String(c[0]).includes('/candidates/'));
      expect(patchCalls.length).toBeGreaterThan(0);
      const [, init] = patchCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });

  it('enrich: POST /buyer-universe-data/:id/enrich (NOT /buyer-universe/:id/enrich)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const s = String(url);
      if (s === `/buyer-universe-data/${UNIVERSE_ID}/enrich`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(UNIVERSE_DETAIL),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    await user.click(screen.getByRole('button', { name: /enrich/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u === `/buyer-universe-data/${UNIVERSE_ID}/enrich`)).toBe(true);
      expect(calledUrls.some((u) => u === `/buyer-universe/${UNIVERSE_ID}/enrich`)).toBe(false);
    });
  });

  it('view gaps: GET /buyer-universe-data/:id/gaps (NOT /buyer-universe/:id/gaps)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const s = String(url);
      if (s === `/buyer-universe-data/${UNIVERSE_ID}/gaps`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ universeId: UNIVERSE_ID, gaps: [] }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    await user.click(screen.getByRole('button', { name: /view gaps/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u === `/buyer-universe-data/${UNIVERSE_ID}/gaps`)).toBe(true);
      expect(calledUrls.some((u) => u === `/buyer-universe/${UNIVERSE_ID}/gaps`)).toBe(false);
    });
  });

  it('submit: POST /buyer-universe-data/:id/submit (NOT /buyer-universe/:id/submit)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const s = String(url);
      if (s === `/buyer-universe-data/${UNIVERSE_ID}/submit`) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(UNIVERSE_DETAIL_SUBMITTED),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    await user.click(screen.getByRole('button', { name: /submit to match engine/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u === `/buyer-universe-data/${UNIVERSE_ID}/submit`)).toBe(true);
      expect(calledUrls.some((u) => u === `/buyer-universe/${UNIVERSE_ID}/submit`)).toBe(false);
    });
  });

  it('submit: status changes to ready-to-rank (submitted) after POST', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(UNIVERSE_DETAIL_SUBMITTED),
      } as Response)
    );

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    await user.click(screen.getByRole('button', { name: /submit to match engine/i }));

    await waitFor(() => {
      // After submit the status badge should show 'submitted'
      expect(screen.getByText('submitted')).toBeDefined();
    });
  });
});

// ── C. Submit guards ────────────────────────────────────────────────────────

describe('C. BuyerUniverseClient — submit guards', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('submit button disabled when no included candidates', () => {
    const noIncludedDetail: BuyerUniverseDetail = {
      ...UNIVERSE_DETAIL,
      candidates: [{ ...CANDIDATE_1, membershipStatus: 'candidate' }],
    };
    vi.stubGlobal('fetch', vi.fn());

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={noIncludedDetail}
        userRole="analyst"
      />
    );

    const submitBtn = screen.getByRole('button', { name: /submit to match engine/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('submit button disabled (shows "Submitted") when universe already submitted', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL_SUBMITTED}
        userRole="analyst"
      />
    );

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    expect(submitBtn.textContent).toMatch(/submitted/i);
  });
});

// ── D. Mandate-detail D6 anchor links to /buyer-universe?mandateId= ────────

describe('D. MandateDetailClient — D6 Buyer Engine anchor', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Open Buyer Universe" link pointing to /buyer-universe?mandateId=<id>', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="analyst"
      />
    );

    const link = screen.getByRole('link', { name: /open buyer universe/i });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe(`/buyer-universe?mandateId=${MANDATE_ID}`);
  });

  it('renders Buyer Engine section (not a DeferredPlaceholder "coming in a later step")', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="advisor"
      />
    );

    // The Buyer Engine section should be a live CTA, not a "coming in a later step" placeholder
    // (The old placeholder text should no longer appear for Buyer Engine)
    expect(
      screen.queryByText(
        /The AI buyer universe and criteria tuning will appear here in a later step/i
      )
    ).toBeNull();
    // The new "Open Buyer Universe" CTA should be present
    expect(screen.getByRole('link', { name: /open buyer universe/i })).toBeDefined();
  });

  it('Ranked Candidates is a live CTA to /matches-shortlist; Pipeline remains deferred (wave-10 B-3)', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="analyst"
      />
    );

    // Ranked Candidates (D6) is now a live CTA link — NOT a deferred placeholder
    const openMatchesLink = screen.getByRole('link', { name: /open matches/i });
    expect((openMatchesLink as HTMLAnchorElement).href).toContain(
      `/matches-shortlist?mandateId=${MANDATE_ID}`
    );
    // Deferred placeholder for Ranked Candidates must NOT appear
    expect(
      screen.queryByRole('region', { name: /ranked candidates.*coming in a later step/i })
    ).toBeNull();

    // Pipeline still remains deferred
    expect(screen.getByRole('region', { name: /pipeline.*coming in a later step/i })).toBeDefined();
  });
});

// ── F-extra. CRITICAL-1 regression — list-wrapper parse (must fail on bare array) ─
//
// The list endpoint returns { universes: [...] } (object), NOT a bare array.
// The pre-fix code used z.array(...) which would silently return null for a bare
// array that matched the old wrong assumption — but the real API never returned
// a bare array in the first place; what made it a bug is it also returns null
// for the CORRECT { universes: [...] } shape. This test suite validates:
//   1. Correct { universes: [...] } → page hydrates candidate table (NOT assemble CTA).
//   2. Bare array (wrong shape, was the old mock) → page shows assemble CTA (parse fails → null).

describe('F-extra. CRITICAL-1 — list-wrapper parse regression', () => {
  beforeEach(() => {
    mockCookies.mockResolvedValue({ toString: () => 'st-access-token=test' });
    mockRedirect.mockImplementation((path: string): never => {
      throw new Error(`REDIRECT:${path}`);
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('hydrates candidate table when list returns { universes: [{id}] } (CRITICAL-1 fix)', async () => {
    // Correct shape: { universes: [{ id }] } — the real API shape
    vi.stubGlobal('fetch', makePageFetch('analyst', UNIVERSE_DETAIL));
    const { redirected } = await renderPage(MANDATE_ID);
    expect(redirected).toBe(false);
    // Candidate table must be present — universe was hydrated, NOT the assemble CTA
    expect(screen.getByRole('table', { name: /buyer universe candidates/i })).toBeDefined();
    // Assemble CTA must NOT be present
    expect(screen.queryByRole('button', { name: /assemble buyer universe/i })).toBeNull();
  });

  it('shows assemble CTA when list returns bare array (wrong shape — parse fails → null → empty state)', async () => {
    // Bare array: the old (broken) mock shape — the page should treat this as
    // "no universe" and show the assemble CTA, because the real API never returns
    // a bare array; a bare-array response is unrecognized and must be treated as null.
    vi.stubGlobal('fetch', makePageFetchBareArray('analyst'));
    const { redirected } = await renderPage(MANDATE_ID);
    expect(redirected).toBe(false);
    // The z.object({ universes: ... }) parse fails on a bare array → null → assemble CTA
    expect(screen.getByRole('button', { name: /assemble buyer universe/i })).toBeDefined();
    // Candidate table must NOT be present
    expect(screen.queryByRole('table', { name: /buyer universe candidates/i })).toBeNull();
  });
});

// ── G-extra. CRITICAL-2 regression — filter/submit/enrich consume BuyerUniverseDetail ─
//
// After backend commit 8e40c08, filter/submit/enrich all return BuyerUniverseDetail
// (universe + candidates). These tests verify the client parses the response with
// buyerUniverseDetailSchema and the candidate table stays populated after each mutation.

describe('G-extra. CRITICAL-2 — filter/submit/enrich consume BuyerUniverseDetail (table stays populated)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('filter: candidate table stays populated after Apply Filter (consumes BuyerUniverseDetail)', async () => {
    const user = userEvent.setup();
    const FILTERED_DETAIL: BuyerUniverseDetail = {
      universe: { ...UNIVERSE_DETAIL.universe, status: 'filtered' },
      candidates: [{ ...CANDIDATE_1, membershipStatus: 'included' }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const s = String(url);
        if (s === `/buyer-universe-data/${UNIVERSE_ID}/filter`) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(FILTERED_DETAIL),
          } as Response);
        }
        return Promise.reject(new Error(`Unexpected: ${s}`));
      })
    );

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    // Before filter: candidate table is present
    expect(screen.getByRole('table', { name: /buyer universe candidates/i })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /apply filter/i }));

    await waitFor(() => {
      // After Apply Filter: candidate table still present (NOT wiped)
      expect(screen.getByRole('table', { name: /buyer universe candidates/i })).toBeDefined();
      // Status badge updated to 'filtered'
      expect(screen.getByText('filtered')).toBeDefined();
    });
  });

  it('submit: candidate table stays populated after Submit (consumes BuyerUniverseDetail)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const s = String(url);
        if (s === `/buyer-universe-data/${UNIVERSE_ID}/submit`) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(UNIVERSE_DETAIL_SUBMITTED),
          } as Response);
        }
        return Promise.reject(new Error(`Unexpected: ${s}`));
      })
    );

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    await user.click(screen.getByRole('button', { name: /submit to match engine/i }));

    await waitFor(() => {
      // After Submit: candidate table still present (NOT wiped)
      expect(screen.getByRole('table', { name: /buyer universe candidates/i })).toBeDefined();
      // Status badge updated to 'submitted'
      expect(screen.getByText('submitted')).toBeDefined();
    });
  });

  it('enrich: candidate table stays populated after Enrich (consumes BuyerUniverseDetail)', async () => {
    const user = userEvent.setup();
    const ENRICHED_DETAIL: BuyerUniverseDetail = {
      universe: UNIVERSE_DETAIL.universe,
      candidates: [CANDIDATE_1],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const s = String(url);
        if (s === `/buyer-universe-data/${UNIVERSE_ID}/enrich`) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(ENRICHED_DETAIL),
          } as Response);
        }
        return Promise.reject(new Error(`Unexpected: ${s}`));
      })
    );

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    await user.click(screen.getByRole('button', { name: /enrich/i }));

    await waitFor(() => {
      // After Enrich: candidate table still present (NOT wiped)
      expect(screen.getByRole('table', { name: /buyer universe candidates/i })).toBeDefined();
    });
  });

  it('filter: surfaces error banner when response is not BuyerUniverseDetail shape', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const s = String(url);
        if (s === `/buyer-universe-data/${UNIVERSE_ID}/filter`) {
          return Promise.resolve({
            ok: true,
            status: 200,
            // Return a bare row (wrong shape) to simulate pre-fix behaviour
            json: () => Promise.resolve({ id: UNIVERSE_ID, status: 'filtered' }),
          } as Response);
        }
        return Promise.reject(new Error(`Unexpected: ${s}`));
      })
    );

    render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    await user.click(screen.getByRole('button', { name: /apply filter/i }));

    await waitFor(() => {
      // Error banner should surface, not a blank table
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});

// ── E. M4/M5 boundary: no score/rank in candidate row ─────────────────────

describe('E. M4/M5 boundary — no score/rank/fit in rendered candidate row', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('candidate row does not render score, rank, or fit-score text', () => {
    vi.stubGlobal('fetch', vi.fn());

    const { container } = render(
      <BuyerUniverseClient
        mandateId={MANDATE_ID}
        initialDetail={UNIVERSE_DETAIL}
        userRole="analyst"
      />
    );

    const html = container.innerHTML.toLowerCase();
    // M4/M5 boundary: none of these should appear in the candidate row UI
    expect(html).not.toContain('fit score');
    expect(html).not.toContain('fit-score');
    expect(html).not.toContain('rank score');
    // 'rank' alone is too broad (could appear in aria text); check for "rank" as a column header
    // by querying for a th with 'rank' text content
    const ths = Array.from(container.querySelectorAll('th'));
    const rankHeader = ths.find((th) => (th.textContent ?? '').toLowerCase().includes('rank'));
    expect(rankHeader).toBeUndefined();
  });
});
