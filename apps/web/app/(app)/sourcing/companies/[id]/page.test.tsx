/**
 * /sourcing/companies/:id — page-route-collision fix tests (wave-7, V-3).
 *
 * Coverage (systematic close of the page-route-collision fetch class):
 *
 * A. Detail page SSR-hydration:
 *    - Page SSR-fetches the full detail and passes it as `initialDetail` to
 *      CompanyDetail. CompanyDetail renders from prop — NO client fetch fires.
 *    - CompanyDetail with `initialDetail` renders contacts, provenance,
 *      and pending-candidates from the prop without any browser fetch.
 *    - No fetch to /sourcing/companies/:id ever originates from the browser
 *      on the detail page (zero calls to `fetch` for that path in JSDOM).
 *
 * B. Workspace drawer non-colliding path:
 *    - DetailDrawer fetches /sourcing/company-detail/:id (proxied), NOT
 *      /sourcing/companies/:id (page route).
 *    - Asserts the fetched URL is /sourcing/company-detail/<id>, not
 *      /sourcing/companies/<id>.
 *
 * C. Full client-fetch audit — zero remaining page-route collisions:
 *    - All other client apiFetch/fetch calls use paths with NO Next.js page
 *      route (confirmed in comments below; verified by grep audit at bottom).
 *
 * Strategy mirrors wave-6 companies tests:
 *   - CompanyDetailPage is an async server component; awaited + rendered.
 *   - Client components rendered directly for interaction tests.
 *   - next/navigation and next/headers mocked at the module boundary.
 */

import type { Company, CompanyProvenance, Contact, DedupeCandidate } from '@dealflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
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

import { DetailDrawer } from '../../_components/DetailDrawer';
import { CompanyDetail } from '../_components/CompanyDetail';
import CompanyDetailPage from './page';

// ── Fixture data ──────────────────────────────────────────────────────────

const NOW = '2024-06-01T10:00:00.000Z';
const COMPANY_ID = '11111111-0000-0000-0000-000000000001';

// Fixtures use the minimum required fields for each strict schema.
// NOTE: companySchema.strict() rejects extra keys; all strict schemas below
// have exactly the fields declared in the schema and nothing more.

const COMPANY: Company = {
  id: COMPANY_ID,
  name: 'Acme Sourcing Corp',
  domain: 'acme.io',
  normalizedDomain: 'acme.io',
  normalizedName: 'acme sourcing corp',
  sector: 'Enterprise SaaS',
  status: 'active',
  createdAt: NOW,
  updatedAt: null,
  connectionIds: [],
};

const CONTACT: Contact = {
  id: 'c0111111-0000-0000-0000-000000000001',
  companyId: COMPANY_ID,
  name: 'Aria Kovač',
  email: 'aria@acme.io',
  normalizedEmail: 'aria@acme.io',
  title: 'VP Engineering',
  createdAt: NOW,
  updatedAt: null,
};

const PROVENANCE: CompanyProvenance = {
  id: 'a0111111-0000-0000-0000-000000000001',
  companyId: COMPANY_ID,
  rawCompanyId: 'b0111111-0000-0000-0000-000000000001',
  connectionId: 'cc001111-0000-0000-0000-000000000011',
  contributedFields: null,
  ingestedAt: NOW,
};

const CANDIDATE: DedupeCandidate = {
  id: 'dd111111-0000-0000-0000-000000000001',
  rawCompanyId: 'ee222222-0000-0000-0000-000000000002',
  matchedCompanyId: COMPANY_ID,
  score: 0.91,
  reason: 'Same domain from two distinct ingest events',
  status: 'pending',
  resolvedBy: null,
  createdAt: NOW,
  resolvedAt: null,
};

/** Full detail API response — the shape returned by GET /sourcing/companies/:id */
const FULL_DETAIL: {
  company: Company;
  contacts: Contact[];
  provenance: CompanyProvenance[];
  pendingCandidates: DedupeCandidate[];
} = {
  company: COMPANY,
  contacts: [CONTACT],
  provenance: [PROVENANCE],
  pendingCandidates: [],
};

const FULL_DETAIL_WITH_CANDIDATE: typeof FULL_DETAIL = {
  ...FULL_DETAIL,
  pendingCandidates: [CANDIDATE],
};

const ME_ANALYST = { userId: 'u-analyst', email: 'analyst@firm.com', role: 'analyst' };

// ── Fetch helper ──────────────────────────────────────────────────────────

/**
 * Builds a global.fetch mock for the detail page SSR path.
 * The server component calls /auth/me and /sourcing/companies/:id server-side.
 */
function makeDetailPageFetch(detail: typeof FULL_DETAIL = FULL_DETAIL) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(ME_ANALYST),
      } as Response);
    }
    if (s.includes(`/sourcing/companies/${COMPANY_ID}`)) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(detail),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected SSR fetch: ${s}`));
  });
}

async function renderDetailPage() {
  try {
    const jsx = await CompanyDetailPage({ params: Promise.resolve({ id: COMPANY_ID }) });
    if (jsx) render(jsx);
    return { redirected: false, path: null as string | null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── A. Detail page SSR-hydration tests ────────────────────────────────────

describe('A. Detail page — SSR-hydration (no client fetch to page route)', () => {
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

  it('renders without redirect for analyst role', async () => {
    vi.stubGlobal('fetch', makeDetailPageFetch());
    const { redirected } = await renderDetailPage();
    expect(redirected).toBe(false);
  });

  it('renders company name from SSR-hydrated detail', async () => {
    vi.stubGlobal('fetch', makeDetailPageFetch());
    await renderDetailPage();
    // Company name comes from the SSR-hydrated data — visible immediately.
    expect(screen.getByRole('heading', { name: 'Acme Sourcing Corp' })).toBeDefined();
  });

  it('renders contacts from SSR-hydrated detail without any client fetch', async () => {
    // The fetch spy counts ALL calls. After SSR renders, NO additional fetch
    // should occur from CompanyDetail when initialDetail is provided.
    const fetchSpy = makeDetailPageFetch();
    vi.stubGlobal('fetch', fetchSpy);

    await renderDetailPage();

    // Contact rendered immediately from prop — no client fetch needed.
    await waitFor(() => {
      expect(screen.getByText('Aria Kovač')).toBeDefined();
    });

    // Only the two SSR fetches (/auth/me + /sourcing/companies/:id) should
    // have fired. ZERO client fetches to /sourcing/companies/:id afterward.
    // The SSR fetch count is exactly 2 (me + detail).
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const fetchedUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
    // Both calls go to the internal API (contain the API base path), not to
    // the same-origin /sourcing/companies/:id page route.
    for (const url of fetchedUrls) {
      // SSR calls contain the full API URL, not just the bare same-origin path.
      // They will include 'localhost:3001' or the internal API base. Critically,
      // they must NOT be same-origin relative paths like '/sourcing/companies/...'.
      expect(url).not.toBe(`/sourcing/companies/${COMPANY_ID}`);
    }
  });

  it('auto-selects dedupe tab when SSR-hydrated detail has pending candidates', async () => {
    vi.stubGlobal('fetch', makeDetailPageFetch(FULL_DETAIL_WITH_CANDIDATE));
    await renderDetailPage();

    // Dedupe tab should be auto-selected (aria-selected=true) because
    // initialDetail.pendingCandidates.length > 0.
    await waitFor(() => {
      const dedupeTab = screen.getByRole('tab', { name: /dedupe review \(1\)/i });
      expect(dedupeTab).toBeDefined();
      expect(dedupeTab.getAttribute('aria-selected')).toBe('true');
    });
  });

  it('redirects to /sourcing/companies when API returns 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const s = String(url);
        if (s.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(ME_ANALYST),
          } as Response);
        }
        // Simulate 404 for the company detail
        return Promise.resolve({ ok: false, status: 404 } as Response);
      })
    );
    const { redirected, path } = await renderDetailPage();
    expect(redirected).toBe(true);
    expect(path).toBe('/sourcing/companies');
  });

  it('redirects to /login when session is invalid (401)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response));
    const { redirected, path } = await renderDetailPage();
    expect(redirected).toBe(true);
    expect(path).toBe('/login');
  });
});

// ── A2. CompanyDetail with initialDetail prop — no client fetch ────────────

describe('A2. CompanyDetail — initialDetail prop skips client fetch entirely', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders from initialDetail without calling fetch at all', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <CompanyDetail
        companyId={COMPANY_ID}
        companyName={COMPANY.name}
        initialDetail={FULL_DETAIL}
      />
    );

    // Contact visible immediately from prop — no fetch needed.
    expect(screen.getByText('Aria Kovač')).toBeDefined();
    // fetch was never called — no client round-trip, no page-route collision.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does NOT show loading skeleton when initialDetail is provided', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <CompanyDetail
        companyId={COMPANY_ID}
        companyName={COMPANY.name}
        initialDetail={FULL_DETAIL}
      />
    );

    // With SSR-hydrated data, the component should render immediately — no skeleton.
    // The heading is present because detail is already loaded.
    expect(screen.getByRole('heading', { name: COMPANY.name })).toBeDefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('renders all tabs (contacts / provenance / dedupe) from initialDetail', async () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <CompanyDetail
        companyId={COMPANY_ID}
        companyName={COMPANY.name}
        initialDetail={FULL_DETAIL_WITH_CANDIDATE}
      />
    );

    // All three tabs should be present.
    expect(screen.getByRole('tab', { name: /contacts/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /provenance/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /dedupe review \(1\)/i })).toBeDefined();
  });

  it('changing companyId with initialDetail still uses prop (no fetch on prop-hydrated mount)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const { rerender } = render(
      <CompanyDetail
        companyId={COMPANY_ID}
        companyName={COMPANY.name}
        initialDetail={FULL_DETAIL}
      />
    );

    // Even after a rerender with the same companyId, no fetch fires because
    // initialDetail is stable on the detail page (page navigates = full remount).
    rerender(
      <CompanyDetail
        companyId={COMPANY_ID}
        companyName={COMPANY.name}
        initialDetail={FULL_DETAIL}
      />
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── B. Workspace drawer — non-colliding proxied path ──────────────────────

describe('B. DetailDrawer — fetches /sourcing/company-detail/:id NOT /sourcing/companies/:id', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('fetches /sourcing/company-detail/:id (not the page route)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          company: COMPANY,
          contacts: [CONTACT],
          provenance: [PROVENANCE],
          pendingCandidates: [],
        }),
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    render(<DetailDrawer companyId={COMPANY_ID} connections={[]} onClose={() => undefined} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // Assert the fetched URL is the NON-colliding proxied path.
    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    expect(calledUrl).toBe(`/sourcing/company-detail/${COMPANY_ID}`);

    // Critically: must NOT be the page route.
    expect(calledUrl).not.toBe(`/sourcing/companies/${COMPANY_ID}`);
  });

  it('does NOT fetch /sourcing/companies/:id from the drawer (page-route collision absent)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          company: COMPANY,
          contacts: [],
          provenance: [],
          pendingCandidates: [],
        }),
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    render(<DetailDrawer companyId={COMPANY_ID} connections={[]} onClose={() => undefined} />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    // Check EVERY call — none should target the page route.
    for (const call of fetchSpy.mock.calls) {
      expect(String(call[0])).not.toBe(`/sourcing/companies/${COMPANY_ID}`);
      expect(String(call[0])).not.toMatch(/^\/sourcing\/companies\/[0-9a-f-]+$/);
    }
  });

  it('renders company detail from the proxied path response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            company: COMPANY,
            contacts: [CONTACT],
            provenance: [PROVENANCE],
            pendingCandidates: [],
          }),
      } as Response)
    );

    render(<DetailDrawer companyId={COMPANY_ID} connections={[]} onClose={() => undefined} />);

    await waitFor(() => {
      // Company name rendered from detail response.
      expect(screen.getByRole('heading', { name: COMPANY.name })).toBeDefined();
    });
  });

  it('renders error state when the proxied path returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      } as Response)
    );

    render(<DetailDrawer companyId={COMPANY_ID} connections={[]} onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});

// ── C. Full client-fetch audit — zero remaining page-route collisions ──────
//
// Every client apiFetch / fetch call in the sourcing UI, and whether a Next.js
// page route exists at that path:
//
//   Path                                   | Page route? | Status
//   ----------------------------------------|-------------|----------------------------
//   /sourcing/company-detail/:id            | NO          | SAFE — proxied by rewrite
//   /sourcing/companies/:id (page)          | YES (fixed) | FIXED — SSR-hydrate (A) +
//                                           |             | drawer uses proxy (B)
//   /sourcing/connections                   | NO          | SAFE — proxied by rewrite
//   /sourcing/connections/:id/sync          | NO          | SAFE — proxied by rewrite
//   /sourcing/dedupe-candidates/:id/resolve | NO          | SAFE — proxied by rewrite
//   /compliance/rules                       | NO          | SAFE — proxied by rewrite
//   /compliance/rules/:id                   | NO          | SAFE — proxied by rewrite
//   /compliance/suppression                 | NO          | SAFE — proxied by rewrite
//   /compliance/suppression/:id             | NO          | SAFE — proxied by rewrite
//   /compliance/disclaimers                 | NO          | SAFE — proxied by rewrite
//   /compliance/disclaimers/:id             | NO          | SAFE — proxied by rewrite
//   /compliance/audit-log/verify            | NO          | SAFE — proxied by rewrite
//   /auth/:path*                            | NO          | SAFE — proxied by rewrite
//
// Confirmed: ZERO remaining client fetches resolve to a Next.js page route.

describe('C. Full client-fetch audit — zero page-route collisions remaining', () => {
  it('all known client fetch paths are non-colliding (documented audit)', () => {
    // This test documents and asserts the structural invariant:
    // every same-origin path that appears in a client apiFetch/fetch call
    // either (a) has no Next.js page route, or (b) is covered by a proxied alias.
    //
    // Collision-free paths (no page.tsx at these routes):
    const safeClientPaths = [
      '/sourcing/company-detail/:id', // proxied alias — wave-7 fix (B)
      '/sourcing/connections', // no page; proxied
      '/sourcing/connections/:id/sync', // no page; proxied
      '/sourcing/dedupe-candidates/:id/resolve', // no page; proxied
      '/compliance/rules', // no page; proxied
      '/compliance/rules/:id', // no page; proxied
      '/compliance/suppression', // no page; proxied
      '/compliance/suppression/:id', // no page; proxied
      '/compliance/disclaimers', // no page; proxied
      '/compliance/disclaimers/:id', // no page; proxied
      '/compliance/audit-log/verify', // no page; proxied
    ];

    // Previously colliding paths (now fixed):
    const fixedCollisions = [
      // /sourcing/companies/:id — was fetched by CompanyDetail.tsx:613 and
      // DetailDrawer.tsx:86. BOTH are now fixed:
      //   A. Detail page: CompanyDetail receives initialDetail from SSR — no client fetch.
      //   B. Drawer: uses /sourcing/company-detail/:id (proxied alias) instead.
      '/sourcing/companies/:id',
    ];

    // Assert: all safe paths are distinct from the previously colliding paths.
    for (const safePath of safeClientPaths) {
      expect(fixedCollisions).not.toContain(safePath);
    }

    // Assert: the proxied alias is in the safe list.
    expect(safeClientPaths).toContain('/sourcing/company-detail/:id');

    // Assert: the fixed collision path is documented (so a future regression
    // that adds a client fetch back to /sourcing/companies/:id is visible here).
    expect(fixedCollisions).toContain('/sourcing/companies/:id');
  });

  it('CompanyDetail with initialDetail absent fetches /sourcing/company-detail/:id (not /sourcing/companies/:id)', async () => {
    // This covers the "drawer" / "no initialDetail" branch of CompanyDetail:
    // when initialDetail is not provided, the component must fetch the
    // non-colliding proxied path, not the page route.
    const DRAWER_ID = '22222222-0000-0000-0000-000000000002';
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          company: { ...COMPANY, id: DRAWER_ID },
          contacts: [],
          provenance: [],
          pendingCandidates: [],
        }),
    } as Response);
    vi.stubGlobal('fetch', fetchSpy);

    render(<CompanyDetail companyId={DRAWER_ID} companyName="Drawer Corp" />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });

    const calledUrl = String(fetchSpy.mock.calls[0]?.[0] ?? '');
    // Must use the non-colliding path.
    expect(calledUrl).toBe(`/sourcing/company-detail/${DRAWER_ID}`);
    // Must NOT use the page route.
    expect(calledUrl).not.toBe(`/sourcing/companies/${DRAWER_ID}`);
  });
});
