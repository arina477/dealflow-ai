/**
 * /compliance/oversight — B-3 tests (wave-14, task f5074df8).
 *
 * Coverage:
 *
 * A. Page renders (RBAC + SSR-hydration):
 *    - Renders for compliance (no redirect).
 *    - Renders for admin (no redirect).
 *    - Advisor → redirects to '/'.
 *    - Analyst → redirects to '/'.
 *    - Unauthenticated → redirects to '/login'.
 *    - SSR-hydrates outreach records with gate verdict + mandate columns.
 *    - Empty records state (no outreach).
 *    - Load error (API 500) → empty table (no crash).
 *
 * B. Oversight table content (gate verdict + mandate + template):
 *    - send_eligible outreach shows "Send eligible" badge.
 *    - blocked outreach shows "Blocked" badge + block reason code.
 *    - SoD violation outreach shows "SoD violation" in the SoD column.
 *    - mandateId prefix rendered.
 *    - templateVersionId prefix rendered.
 *    - createdBy prefix rendered.
 *
 * C. READ-ONLY assertion — NO approve/edit/delete/send/AI affordance:
 *    - No "Approve" button in the table.
 *    - No "Reject" button in the table.
 *    - No "Send" button in the table.
 *    - No "Delete" button in the table.
 *    - No "AI" or "Draft" button in the table.
 *
 * D. Non-duplication from /compliance-queue (wave-11):
 *    - The oversight page does NOT render the ComplianceQueueClient
 *      (no "Queue is clear" / no pending-version approval UI).
 *    - The oversight page links to /compliance-queue rather than duplicating it.
 *
 * E. SSR + proxy — the oversight table data proxy:
 *    - Client refresh calls /compliance/oversight-data (not /compliance/oversight
 *      or /outreach directly — the non-page-colliding proxy).
 *    - rid:anti-csrf header is included on the client refresh call.
 *
 * Strategy:
 *   - Server page component (async) awaited + rendered.
 *   - Client component rendered directly for unit tests.
 *   - next/navigation + next/headers mocked at module boundary.
 *   - e2e paths excluded.
 */

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

import { ComplianceOversightTable } from './_components/ComplianceOversightTable';
import ComplianceOversightPage from './page';

// ── Fixture data ─────────────────────────────────────────────────────────────

type RoleStr = 'advisor' | 'analyst' | 'compliance' | 'admin';

const MANDATE_ID = 'aaaaaaaa-1111-0000-0000-000000000014';
const MANDATE_ID_2 = 'bbbbbbbb-2222-0000-0000-000000000014';
const TEMPLATE_VERSION_ID = 'cccccccc-3333-0000-0000-000000000014';
const OUTREACH_ID = 'dddddddd-4444-0000-0000-000000000014';
const OUTREACH_ID_2 = 'eeeeeeee-5555-0000-0000-000000000014';
const MATCH_CANDIDATE_ID = 'ffffffff-6666-0000-0000-000000000014';
const USER_ID = '11111111-7777-0000-0000-000000000014';

/** send_eligible outreach record */
const ELIGIBLE_OUTREACH = {
  id: OUTREACH_ID,
  mandateId: MANDATE_ID,
  matchCandidateId: MATCH_CANDIDATE_ID,
  templateVersionId: TEMPLATE_VERSION_ID,
  gateVerdict: {
    allowed: true,
    blocks: [],
    requiredDisclaimers: [],
  },
  status: 'send_eligible' as const,
  createdBy: USER_ID,
  createdAt: '2026-07-06T10:00:00.000Z',
};

/** blocked outreach record with suppression block */
const BLOCKED_OUTREACH = {
  id: OUTREACH_ID_2,
  mandateId: MANDATE_ID_2,
  matchCandidateId: MATCH_CANDIDATE_ID,
  templateVersionId: TEMPLATE_VERSION_ID,
  gateVerdict: {
    allowed: false,
    blocks: [{ code: 'suppression', message: 'Recipient is on the suppression list.' }],
    requiredDisclaimers: [],
  },
  status: 'blocked' as const,
  createdBy: USER_ID,
  createdAt: '2026-07-06T11:00:00.000Z',
};

/** SoD-blocked outreach record */
const SOD_BLOCKED_OUTREACH = {
  id: 'aaaabbbb-cccc-0000-0000-000000000014',
  mandateId: MANDATE_ID,
  matchCandidateId: MATCH_CANDIDATE_ID,
  templateVersionId: TEMPLATE_VERSION_ID,
  gateVerdict: {
    allowed: false,
    blocks: [{ code: 'sod', reason: 'sender-is-approver', message: 'SoD violation.' }],
    requiredDisclaimers: [],
  },
  status: 'blocked' as const,
  createdBy: USER_ID,
  createdAt: '2026-07-06T12:00:00.000Z',
};

function meFor(role: RoleStr) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

function makePageFetch(role: RoleStr, outreachRecords: (typeof ELIGIBLE_OUTREACH)[] = []) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    if (s.includes('/outreach')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ outreach: outreachRecords }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

// ── Page render helper ─────────────────────────────────────────────────────

async function renderPage(searchParams?: Record<string, string>) {
  try {
    const props = searchParams ? { searchParams: Promise.resolve(searchParams) } : {};
    const jsx = await ComplianceOversightPage(props);
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

describe('A. ComplianceOversightPage — RBAC + SSR-hydration', () => {
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

  it('renders for compliance role (no redirect)', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', [ELIGIBLE_OUTREACH]));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
  });

  it('renders for admin role (no redirect)', async () => {
    vi.stubGlobal('fetch', makePageFetch('admin', [ELIGIBLE_OUTREACH]));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
  });

  it('redirects to / for advisor role', async () => {
    vi.stubGlobal('fetch', makePageFetch('advisor'));
    const { redirected, path } = await renderPage();
    expect(redirected).toBe(true);
    expect(path).toBe('/');
  });

  it('redirects to / for analyst role', async () => {
    vi.stubGlobal('fetch', makePageFetch('analyst'));
    const { redirected, path } = await renderPage();
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
    const { redirected, path } = await renderPage();
    expect(redirected).toBe(true);
    expect(path).toBe('/login');
  });

  it('SSR-hydrates outreach records with gate verdict + mandate', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', [ELIGIBLE_OUTREACH]));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    // Page heading present
    expect(screen.getByText(/compliance oversight/i)).toBeDefined();
    // Mandate ID prefix rendered
    expect(screen.getByTitle(MANDATE_ID)).toBeDefined();
  });

  it('renders empty outreach state (no records)', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', []));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    expect(screen.getByText(/no outreach records found/i)).toBeDefined();
  });

  it('renders empty table when API returns 500 (no crash)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const s = String(url);
        if (s.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(meFor('compliance')),
          } as Response);
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        } as Response);
      })
    );
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    // Should show empty state, not crash
    expect(screen.getByText(/no outreach records found/i)).toBeDefined();
  });
});

// ── B. Oversight table content ─────────────────────────────────────────────

describe('B. ComplianceOversightTable — gate verdict + mandate + template content', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('send_eligible outreach shows "Send eligible" badge', () => {
    render(
      <ComplianceOversightTable initialRecords={[ELIGIBLE_OUTREACH]} initialMandateId={undefined} />
    );
    expect(screen.getByText(/send eligible/i)).toBeDefined();
  });

  it('blocked outreach shows "Blocked" badge', () => {
    render(
      <ComplianceOversightTable initialRecords={[BLOCKED_OUTREACH]} initialMandateId={undefined} />
    );
    expect(screen.getByText(/blocked/i)).toBeDefined();
  });

  it('blocked outreach shows the block reason code (suppression)', () => {
    render(
      <ComplianceOversightTable initialRecords={[BLOCKED_OUTREACH]} initialMandateId={undefined} />
    );
    expect(screen.getByText('suppression')).toBeDefined();
  });

  it('SoD-blocked outreach shows "SoD violation" in SoD column', () => {
    render(
      <ComplianceOversightTable
        initialRecords={[SOD_BLOCKED_OUTREACH]}
        initialMandateId={undefined}
      />
    );
    expect(screen.getByText(/sod violation/i)).toBeDefined();
  });

  it('mandateId prefix is rendered', () => {
    render(
      <ComplianceOversightTable initialRecords={[ELIGIBLE_OUTREACH]} initialMandateId={undefined} />
    );
    // The full mandateId is in the title attribute; the shortened form appears in text
    expect(screen.getByTitle(MANDATE_ID)).toBeDefined();
  });

  it('templateVersionId prefix is rendered', () => {
    render(
      <ComplianceOversightTable initialRecords={[ELIGIBLE_OUTREACH]} initialMandateId={undefined} />
    );
    expect(screen.getByTitle(TEMPLATE_VERSION_ID)).toBeDefined();
  });

  it('createdBy prefix is rendered', () => {
    render(
      <ComplianceOversightTable initialRecords={[ELIGIBLE_OUTREACH]} initialMandateId={undefined} />
    );
    expect(screen.getByTitle(USER_ID)).toBeDefined();
  });

  it('send_eligible outreach shows "SoD passed"', () => {
    render(
      <ComplianceOversightTable initialRecords={[ELIGIBLE_OUTREACH]} initialMandateId={undefined} />
    );
    expect(screen.getByText(/sod passed/i)).toBeDefined();
  });
});

// ── C. READ-ONLY — no approve/edit/delete/send/AI affordance ──────────────

describe('C. READ-ONLY — no approve/edit/delete/send/AI affordance', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('no "Approve" button in the oversight table', () => {
    render(
      <ComplianceOversightTable
        initialRecords={[ELIGIBLE_OUTREACH, BLOCKED_OUTREACH]}
        initialMandateId={undefined}
      />
    );
    const approveBtns = screen.queryAllByRole('button', { name: /approve/i });
    expect(approveBtns.length).toBe(0);
  });

  it('no "Reject" button in the oversight table', () => {
    render(
      <ComplianceOversightTable
        initialRecords={[ELIGIBLE_OUTREACH, BLOCKED_OUTREACH]}
        initialMandateId={undefined}
      />
    );
    const rejectBtns = screen.queryAllByRole('button', { name: /reject/i });
    expect(rejectBtns.length).toBe(0);
  });

  it('no "Send" button in the oversight table', () => {
    render(
      <ComplianceOversightTable
        initialRecords={[ELIGIBLE_OUTREACH, BLOCKED_OUTREACH]}
        initialMandateId={undefined}
      />
    );
    const sendBtns = screen.queryAllByRole('button', { name: /send/i });
    expect(sendBtns.length).toBe(0);
  });

  it('no "Delete" button in the oversight table', () => {
    render(
      <ComplianceOversightTable
        initialRecords={[ELIGIBLE_OUTREACH, BLOCKED_OUTREACH]}
        initialMandateId={undefined}
      />
    );
    const deleteBtns = screen.queryAllByRole('button', { name: /delete/i });
    expect(deleteBtns.length).toBe(0);
  });

  it('no "AI" or "Draft" button in the oversight table', () => {
    render(
      <ComplianceOversightTable
        initialRecords={[ELIGIBLE_OUTREACH, BLOCKED_OUTREACH]}
        initialMandateId={undefined}
      />
    );
    const aiBtns = screen.queryAllByRole('button', { name: /ai|draft/i });
    expect(aiBtns.length).toBe(0);
  });
});

// ── D. Non-duplication from /compliance-queue (wave-11) ───────────────────

describe('D. Non-duplication — distinct from /compliance-queue', () => {
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

  it('oversight page does NOT render the "Queue is clear" compliance-queue text', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', []));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    // "Queue is clear" is a /compliance-queue phrase — must NOT appear here
    expect(screen.queryByText(/queue is clear/i)).toBeNull();
  });

  it('oversight page links to /compliance-queue (not a duplicate)', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', [ELIGIBLE_OUTREACH]));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    // Must link to /compliance-queue (the version-approval flow)
    const links = screen.getAllByRole('link');
    const complianceQueueLinks = links.filter((l) =>
      l.getAttribute('href')?.includes('/compliance-queue')
    );
    expect(complianceQueueLinks.length).toBeGreaterThan(0);
  });

  it('oversight page shows heading "Compliance Oversight" (not "Compliance Queue")', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', []));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    expect(screen.getByText(/compliance oversight/i)).toBeDefined();
    // Must NOT have the queue heading
    expect(screen.queryByText(/^compliance queue$/i)).toBeNull();
  });
});

// ── E. SSR + proxy — oversight-data non-page-colliding proxy ──────────────

describe('E. SSR + proxy — client refresh uses /compliance/oversight-data', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('client Refresh calls /compliance/oversight-data (not /outreach directly)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const s = String(url);
      if (s.includes('/compliance/oversight-data')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ outreach: [ELIGIBLE_OUTREACH] }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <ComplianceOversightTable initialRecords={[ELIGIBLE_OUTREACH]} initialMandateId={undefined} />
    );

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      // Must call /compliance/oversight-data
      expect(calledUrls.some((u) => u.includes('/compliance/oversight-data'))).toBe(true);
      // Must NOT call /outreach directly (that is the API-internal path)
      expect(calledUrls.some((u) => u === '/outreach')).toBe(false);
    });
  });

  it('client Refresh includes rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/compliance/oversight-data')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ outreach: [] }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ComplianceOversightTable initialRecords={[]} initialMandateId={undefined} />);

    await user.click(screen.getByRole('button', { name: /refresh/i }));

    await waitFor(() => {
      const oversightCalls = mockFetch.mock.calls.filter((c) =>
        String(c[0]).includes('/compliance/oversight-data')
      );
      expect(oversightCalls.length).toBeGreaterThan(0);
      const [, init] = oversightCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });
});
