/**
 * /matches-shortlist page — B-3 tests (wave-10, tasks fb82d339 + f74dce45).
 *
 * Coverage:
 *
 * A. Page renders (RBAC + SSR-hydration):
 *    - Renders for advisor/admin/analyst (no redirect).
 *    - Compliance → redirects to '/'.
 *    - Unauthenticated → redirects to '/login'.
 *    - "Create match run" CTA renders when no run (initialData=null).
 *    - Candidate table renders when run exists (initialData present).
 *    - No-mandateId state renders an alert.
 *
 * B. MatchesShortlistClient mutations — all via /matches-data (NOT /matches or /matches/:id):
 *    - create-run: POST /matches-data (NOT /matches).
 *    - disposition accept: PATCH /matches-data/:id/candidates/:cid (NOT /matches/:id/candidates/:cid).
 *    - disposition reject: PATCH /matches-data/:id/candidates/:cid.
 *    - disposition flag: PATCH /matches-data/:id/candidates/:cid.
 *    - handoff: POST /matches-data/:id/handoff (NOT /matches/:id/handoff).
 *
 * C. Handoff guards:
 *    - handoff button disabled when no accepted candidates.
 *    - handoff button disabled for analyst (read-only role).
 *
 * D. Mandate-detail D6 anchor (jenny flag 1):
 *    - MandateDetailClient "Ranked Candidates" section links to
 *      /matches-shortlist?mandateId=<id>.
 *
 * E. No-AI-framing assertion (P-4 karen MANDATORY + CODE-OF-CONDUCT provenance):
 *    - Rendered component contains ZERO forbidden AI-capability strings:
 *      "AI Match", "rationale is generated", "explainability engine",
 *      "improve model", "similar mandates", "AI-powered", "generated rationale",
 *      "the model".
 *    - Fit score is framed as "rule-based" (the phrase "rule-based" appears).
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

import type { MandateDetail, MatchRankedList } from '@dealflow/shared';
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
import { MatchesShortlistClient } from './_components/MatchesShortlistClient';
import MatchesShortlistPage from './page';

// ── Fixture data ────────────────────────────────────────────────────────────

type RoleStr = 'advisor' | 'analyst' | 'compliance' | 'admin';

const MANDATE_ID = 'aaaaaaaa-0000-0000-0000-000000000010';
const RUN_ID = 'bbbbbbbb-1111-0000-0000-000000000010';
const CANDIDATE_ID_1 = 'cccccccc-2222-0000-0000-000000000010';
const CANDIDATE_ID_2 = 'cccccccc-2222-0000-0000-000000000011';
const BUC_ID_1 = 'dddddddd-3333-0000-0000-000000000010';
const BUC_ID_2 = 'dddddddd-3333-0000-0000-000000000011';

const NOW_ISO = '2026-07-04T04:42:20.000Z';

function meFor(role: RoleStr) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const CANDIDATE_1 = {
  id: CANDIDATE_ID_1,
  matchRunId: RUN_ID,
  buyerUniverseCandidateId: BUC_ID_1,
  fitScore: 88,
  scoreBreakdown: {
    sectorMatch: { score: 60, weight: 60, label: 'Sector / industry match' },
    contactCompleteness: { score: 20, weight: 30, label: 'Contact completeness' },
    tieBreak: { score: 8, label: 'Tie-break (name order)' },
    notApplied: ['geo (not in M3)', 'deal_type (not in M3)'],
  },
  disposition: 'pending' as const,
  createdAt: NOW_ISO,
};

const CANDIDATE_2 = {
  id: CANDIDATE_ID_2,
  matchRunId: RUN_ID,
  buyerUniverseCandidateId: BUC_ID_2,
  fitScore: 72,
  scoreBreakdown: null,
  disposition: 'pending' as const,
  createdAt: NOW_ISO,
};

const RANKED_LIST: MatchRankedList = {
  run: {
    id: RUN_ID,
    mandateId: MANDATE_ID,
    buyerUniverseId: 'eeeeeeee-4444-0000-0000-000000000010',
    createdBy: 'ffffffff-5555-0000-0000-000000000010',
    status: 'scored',
    readyForOutreach: false,
    createdAt: NOW_ISO,
    updatedAt: null,
  },
  candidates: [CANDIDATE_1, CANDIDATE_2],
};

const RANKED_LIST_ACCEPTED: MatchRankedList = {
  ...RANKED_LIST,
  candidates: [{ ...CANDIDATE_1, disposition: 'accepted' }, CANDIDATE_2],
};

const RANKED_LIST_HANDOFF: MatchRankedList = {
  ...RANKED_LIST_ACCEPTED,
  run: { ...RANKED_LIST.run, readyForOutreach: true },
};

// Minimal MandateDetail fixture for D6 anchor test
const CRITERIA_ID = '11111111-0000-0000-0000-000000000010';
const PROFILE_ID = '22222222-0000-0000-0000-000000000010';
const TEMPLATE_ID = '33333333-0000-0000-0000-000000000010';

const MANDATE_DETAIL: MandateDetail = {
  mandate: {
    id: MANDATE_ID,
    createdBy: '00000000-0000-0000-0000-000000000010',
    sellerName: 'Project Helios LLC',
    sellerIndustry: 'Enterprise SaaS',
    sellerGeo: ['North America'],
    sellerSizeBand: 'mid',
    description: 'Strong recurring revenue.',
    dealType: 'Full Acquisition',
    status: 'active',
    createdAt: NOW_ISO,
    updatedAt: null,
  },
  buyerCriteria: {
    id: CRITERIA_ID,
    mandateId: MANDATE_ID,
    industry: 'Enterprise SaaS',
    geo: 'North America',
    sizeBand: 'mid',
    dealType: 'acquisition',
  },
  complianceProfile: {
    id: PROFILE_ID,
    mandateId: MANDATE_ID,
    jurisdiction: 'us_delaware',
    disclaimerTemplateId: TEMPLATE_ID,
    suppressionScope: 'Helios Corp.',
    lawfulAuthorization: true,
    aiResultsValidated: true,
    conflictDbsReviewed: true,
  },
};

// ── Fetch helpers ──────────────────────────────────────────────────────────

function makePageFetch(role: RoleStr, rankedList: MatchRankedList | null = RANKED_LIST) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    // List fetch: GET /matches?mandateId=
    if (s.includes('/matches') && s.includes('mandateId=')) {
      if (rankedList === null) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ runs: [] }),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ runs: [{ id: RUN_ID }] }),
      } as Response);
    }
    // Detail fetch: GET /matches/:id
    if (s.includes(`/matches/${RUN_ID}`)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(rankedList),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

// ── Page render helper ─────────────────────────────────────────────────────

async function renderPage(mandateId?: string) {
  const searchParams = Promise.resolve(mandateId ? { mandateId } : {});
  try {
    const jsx = await MatchesShortlistPage({ searchParams });
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

describe('A. MatchesShortlistPage — RBAC + SSR-hydration', () => {
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

    it('renders for analyst (no redirect)', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
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
      vi.stubGlobal('fetch', makePageFetch('advisor'));
      const { redirected } = await renderPage(undefined);
      expect(redirected).toBe(false);
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/no mandate selected/i)).toBeDefined();
    });
  });

  describe('SSR-hydration: create-run CTA when no run', () => {
    it('renders "Create Match Run" CTA when no run exists (initialData=null)', async () => {
      vi.stubGlobal('fetch', makePageFetch('advisor', null));
      const { redirected } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(false);
      expect(screen.getByRole('button', { name: /create match run/i })).toBeDefined();
    });
  });

  describe('SSR-hydration: candidate table when run exists', () => {
    it('renders candidate table when run exists', async () => {
      vi.stubGlobal('fetch', makePageFetch('advisor', RANKED_LIST));
      const { redirected } = await renderPage(MANDATE_ID);
      expect(redirected).toBe(false);
      expect(screen.getByRole('table', { name: /ranked match candidates/i })).toBeDefined();
    });
  });
});

// ── B. MatchesShortlistClient mutations via /matches-data ──────────────────

describe('B. MatchesShortlistClient — mutations use /matches-data (NOT /matches or /matches/:id)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('create-run: POST /matches-data (NOT /matches)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === '/matches-data' && (init?.method ?? 'GET') === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(RANKED_LIST),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<MatchesShortlistClient mandateId={MANDATE_ID} initialData={null} userRole="advisor" />);

    await user.click(screen.getByRole('button', { name: /create match run/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      // Must call /matches-data (POST create run)
      expect(calledUrls.some((u) => u === '/matches-data')).toBe(true);
      // Must NOT call /matches (page route)
      expect(calledUrls.some((u) => u === '/matches')).toBe(false);
    });
  });

  it('create-run: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url) === '/matches-data') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(RANKED_LIST),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<MatchesShortlistClient mandateId={MANDATE_ID} initialData={null} userRole="advisor" />);

    await user.click(screen.getByRole('button', { name: /create match run/i }));

    await waitFor(() => {
      const createCalls = mockFetch.mock.calls.filter((c) => String(c[0]) === '/matches-data');
      expect(createCalls.length).toBeGreaterThan(0);
      const [, init] = createCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });

  it('disposition accept: PATCH /matches-data/:id/candidates/:cid (NOT /matches/:id/candidates/:cid)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      const expectedPath = `/matches-data/${RUN_ID}/candidates/${CANDIDATE_ID_1}`;
      if (s === expectedPath && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ...CANDIDATE_1, disposition: 'accepted' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="advisor" />
    );

    // Click the accept button for the first candidate
    const acceptBtns = screen.getAllByRole('button', { name: /accept candidate/i });
    const firstAcceptBtn = acceptBtns[0];
    if (!firstAcceptBtn) throw new Error('Expected at least one accept button');
    await user.click(firstAcceptBtn);

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      const expectedPath = `/matches-data/${RUN_ID}/candidates/${CANDIDATE_ID_1}`;
      expect(calledUrls.some((u) => u === expectedPath)).toBe(true);
      // Must NOT call the bare /matches route
      expect(calledUrls.some((u) => u === `/matches/${RUN_ID}/candidates/${CANDIDATE_ID_1}`)).toBe(
        false
      );
    });
  });

  it('disposition reject: PATCH /matches-data/:id/candidates/:cid', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s.includes(`/matches-data/${RUN_ID}/candidates/`) && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ...CANDIDATE_1, disposition: 'rejected' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="advisor" />
    );

    const rejectBtns = screen.getAllByRole('button', { name: /reject candidate/i });
    const firstRejectBtn = rejectBtns[0];
    if (!firstRejectBtn) throw new Error('Expected at least one reject button');
    await user.click(firstRejectBtn);

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u.includes(`/matches-data/${RUN_ID}/candidates/`))).toBe(true);
      expect(calledUrls.some((u) => u.includes(`/matches/${RUN_ID}/candidates/`))).toBe(false);
    });
  });

  it('disposition flag: PATCH /matches-data/:id/candidates/:cid', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s.includes(`/matches-data/${RUN_ID}/candidates/`) && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ...CANDIDATE_1, disposition: 'flagged' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="advisor" />
    );

    const flagBtns = screen.getAllByRole('button', { name: /flag candidate/i });
    const firstFlagBtn = flagBtns[0];
    if (!firstFlagBtn) throw new Error('Expected at least one flag button');
    await user.click(firstFlagBtn);

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u.includes(`/matches-data/${RUN_ID}/candidates/`))).toBe(true);
    });
  });

  it('handoff: POST /matches-data/:id/handoff (NOT /matches/:id/handoff)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === `/matches-data/${RUN_ID}/handoff` && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(RANKED_LIST_HANDOFF),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MatchesShortlistClient
        mandateId={MANDATE_ID}
        initialData={RANKED_LIST_ACCEPTED}
        userRole="advisor"
      />
    );

    const handoffBtn = screen.getByTestId('handoff-button');
    await user.click(handoffBtn);

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u === `/matches-data/${RUN_ID}/handoff`)).toBe(true);
      // Must NOT call /matches/:id/handoff (bare API path)
      expect(calledUrls.some((u) => u === `/matches/${RUN_ID}/handoff`)).toBe(false);
    });
  });

  it('handoff: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === `/matches-data/${RUN_ID}/handoff` && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(RANKED_LIST_HANDOFF),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MatchesShortlistClient
        mandateId={MANDATE_ID}
        initialData={RANKED_LIST_ACCEPTED}
        userRole="advisor"
      />
    );

    const handoffBtn = screen.getByTestId('handoff-button');
    await user.click(handoffBtn);

    await waitFor(() => {
      const handoffCalls = mockFetch.mock.calls.filter(
        (c) => String(c[0]) === `/matches-data/${RUN_ID}/handoff`
      );
      expect(handoffCalls.length).toBeGreaterThan(0);
      const [, init] = handoffCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });
});

// ── C. Handoff guards ──────────────────────────────────────────────────────

describe('C. MatchesShortlistClient — handoff guards', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handoff button disabled when no accepted candidates', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="advisor" />
    );

    const handoffBtn = screen.getByTestId('handoff-button');
    expect((handoffBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('analyst sees no mutation controls (read-only)', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="analyst" />
    );

    // No accept/reject/flag buttons for analyst
    expect(screen.queryByRole('button', { name: /accept candidate/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /reject candidate/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /flag candidate/i })).toBeNull();
    // Handoff button is present but disabled for analyst (canMutate=false)
    const handoffBtn = screen.getByTestId('handoff-button');
    expect((handoffBtn as HTMLButtonElement).disabled).toBe(true);
  });
});

// ── D. Mandate-detail D6 anchor links to /matches-shortlist?mandateId= ────

describe('D. MandateDetailClient — D6 Ranked Candidates anchor (jenny flag 1)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Open Matches" link pointing to /matches-shortlist?mandateId=<id>', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="advisor"
      />
    );

    const link = screen.getByRole('link', { name: /open matches shortlist/i });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe(`/matches-shortlist?mandateId=${MANDATE_ID}`);
  });

  it('Ranked Candidates section is now a live CTA, not a DeferredPlaceholder', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="analyst"
      />
    );

    // The new live CTA should be present
    expect(screen.getByRole('link', { name: /open matches shortlist/i })).toBeDefined();
    // The old deferred placeholder text should NOT appear for Ranked Candidates
    expect(screen.queryByText(/ranked ai-matched buyer candidates will appear here/i)).toBeNull();
  });

  it('Pipeline remains as DeferredPlaceholder', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="analyst"
      />
    );

    // Pipeline deferred placeholder still present
    expect(screen.getByRole('region', { name: /pipeline.*coming in a later step/i })).toBeDefined();
  });
});

// ── E. No-AI-framing assertion (P-4 karen MANDATORY) ──────────────────────

describe('E. No-AI-framing — ZERO forbidden AI-capability strings in rendered output', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rendered MatchesShortlistClient (with run) has ZERO AI-framing strings', () => {
    vi.stubGlobal('fetch', vi.fn());

    const { container } = render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="advisor" />
    );

    const html = container.innerHTML;
    const htmlLower = html.toLowerCase();

    // ── Forbidden strings (exact from the design prototype, per mandate) ──
    expect(htmlLower).not.toContain('ai match');
    expect(htmlLower).not.toContain('rationale is generated');
    expect(htmlLower).not.toContain('explainability engine');
    expect(htmlLower).not.toContain('improve model');
    expect(htmlLower).not.toContain('similar mandates');
    // ── Paraphrased AI-capability language ────────────────────────────────
    expect(htmlLower).not.toContain('ai-powered');
    expect(htmlLower).not.toContain('generated rationale');
    expect(htmlLower).not.toContain('the model');
    // ── Positive framing: "rule-based" must be present ────────────────────
    expect(htmlLower).toContain('rule-based');
  });

  it('rendered MatchesShortlistClient (empty state — no run) has ZERO AI-framing strings', () => {
    vi.stubGlobal('fetch', vi.fn());

    const { container } = render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={null} userRole="advisor" />
    );

    const htmlLower = container.innerHTML.toLowerCase();
    expect(htmlLower).not.toContain('ai match');
    expect(htmlLower).not.toContain('rationale is generated');
    expect(htmlLower).not.toContain('explainability engine');
    expect(htmlLower).not.toContain('improve model');
    expect(htmlLower).not.toContain('similar mandates');
    expect(htmlLower).not.toContain('ai-powered');
    expect(htmlLower).not.toContain('generated rationale');
    expect(htmlLower).not.toContain('the model');
  });

  it('score breakdown drawer shows "rule-based" framing (NOT AI/model language)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    const { container } = render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="advisor" />
    );

    // Open the score breakdown for the first candidate
    const breakdownBtns = screen.getAllByRole('button', { name: /view score breakdown/i });
    const firstBreakdownBtn = breakdownBtns[0];
    if (!firstBreakdownBtn) throw new Error('Expected at least one score breakdown button');
    await user.click(firstBreakdownBtn);

    await waitFor(() => {
      const htmlLower = container.innerHTML.toLowerCase();
      // Drawer must show "score breakdown" not "AI Match Analysis" or "Rationale Explainability"
      expect(htmlLower).toContain('score breakdown');
      expect(htmlLower).not.toContain('ai match');
      expect(htmlLower).not.toContain('rationale explainability');
      expect(htmlLower).not.toContain('explainability engine');
      expect(htmlLower).not.toContain('model data freshness');
      expect(htmlLower).not.toContain('similar mandates');
      // "Rule-based" badge must be present in the drawer
      expect(htmlLower).toContain('rule-based fit score');
    });
  });
});

// ── G. INFO-1: failed disposition PATCH restores previous disposition ────────

describe('G. INFO-1 — failed disposition PATCH restores original disposition', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('restores previous disposition and shows error when PATCH fails (does NOT keep the attempted value)', async () => {
    const user = userEvent.setup();

    // RANKED_LIST has CANDIDATE_1 with disposition='pending'.
    // We attempt to accept (disposition='accepted'). The PATCH returns 422.
    // After the failure the candidate must be back to 'pending', not 'accepted'.
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s.includes(`/matches-data/${RUN_ID}/candidates/`) && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          status: 422,
          json: () => Promise.resolve({ message: 'Disposition rejected by server.' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="advisor" />
    );

    // Click accept for the first candidate (currently 'pending')
    const acceptBtns = screen.getAllByRole('button', { name: /accept candidate/i });
    const firstAcceptBtn = acceptBtns[0];
    if (!firstAcceptBtn) throw new Error('Expected at least one accept button');
    await user.click(firstAcceptBtn);

    await waitFor(() => {
      // Error message must appear
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/disposition rejected by server/i)).toBeDefined();

      // The accept button must have returned (disposition reverted to 'pending')
      // — meaning there are still accept buttons in the DOM for this candidate.
      const btnsAfter = screen.getAllByRole('button', { name: /accept candidate/i });
      expect(btnsAfter.length).toBeGreaterThan(0);
    });
  });
});

// ── H. INFO-2: wrong-shape create-run response → error shown, data not mutated ──

describe('H. INFO-2 — wrong-shape create-run response → error state, data unchanged', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('shows error and does NOT set data when createRun returns a non-MatchRankedList shape', async () => {
    const user = userEvent.setup();

    // Returns a 200 but with a shape that fails matchRankedListSchema
    const wrongShape = { totally: 'wrong', shape: true };
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === '/matches-data' && (init?.method ?? 'GET') === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(wrongShape),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    // Start with no data (no run) so we can confirm data is NOT set after the bad response
    render(<MatchesShortlistClient mandateId={MANDATE_ID} initialData={null} userRole="advisor" />);

    // The "Create Match Run" button must be visible (initialData=null)
    expect(screen.getByRole('button', { name: /create match run/i })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /create match run/i }));

    await waitFor(() => {
      // Error must be shown
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/unexpected response from server — please refresh/i)).toBeDefined();

      // The ranked candidates table must NOT have appeared (data was not corrupted)
      expect(screen.queryByRole('table', { name: /ranked match candidates/i })).toBeNull();

      // The create-run CTA must still be present (state was not clobbered)
      expect(screen.getByRole('button', { name: /create match run/i })).toBeDefined();
    });
  });
});

// ── F. Anti-csrf (additional paths) ─────────────────────────────────────

describe('F. Anti-csrf on all mutations', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('disposition accept: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes(`/matches-data/${RUN_ID}/candidates/`) && init?.method === 'PATCH') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ...CANDIDATE_1, disposition: 'accepted' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <MatchesShortlistClient mandateId={MANDATE_ID} initialData={RANKED_LIST} userRole="advisor" />
    );

    const acceptBtns = screen.getAllByRole('button', { name: /accept candidate/i });
    const firstAcceptBtnF = acceptBtns[0];
    if (!firstAcceptBtnF) throw new Error('Expected at least one accept button');
    await user.click(firstAcceptBtnF);

    await waitFor(() => {
      const patchCalls = mockFetch.mock.calls.filter(
        (c) =>
          String(c[0]).includes(`/matches-data/${RUN_ID}/candidates/`) &&
          (c[1] as RequestInit)?.method === 'PATCH'
      );
      expect(patchCalls.length).toBeGreaterThan(0);
      const [, init] = patchCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });
});
