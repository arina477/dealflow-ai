/**
 * /sourcing/companies — CompaniesPage + client component tests (wave-6, B-3).
 *
 * Coverage:
 *   - Page renders companies list for analyst role.
 *   - Non-analyst roles (advisor, compliance, admin) redirect to '/'.
 *   - Unauthenticated (no session / 401) redirects to '/login'.
 *   - Filter interaction: search query, status chips, duplicate-only chip.
 *   - Dedupe candidate resolve: merge action fires POST + updates UI.
 *   - Dedupe candidate resolve: reject action fires POST after confirmation.
 *   - Provenance / source badges render in provenance tab.
 *   - Nav: analyst sees 'Sourcing' nav item.
 *
 * Strategy mirrors wave-5 compliance settings tests:
 *   - CompaniesPage is an async server component; awaited + rendered.
 *   - Client components rendered directly for interaction tests.
 *   - next/navigation and next/headers mocked at the module boundary.
 *   - AppShell excluded (inherited from (app)/layout — not in scope).
 *   - e2e paths (.spec.ts) excluded from vitest include glob.
 */

import type { Company, CompanyProvenance, Contact, DedupeCandidate } from '@dealflow/shared';
import { navItemsForRole } from '@dealflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

import { CompaniesClient } from './_components/CompaniesClient';
import { CompanyDetail } from './_components/CompanyDetail';
import { FilterBar } from './_components/FilterBar';
import CompaniesPage from './page';

// ── Fixture data ──────────────────────────────────────────────────────────

type Role = 'advisor' | 'analyst' | 'compliance' | 'admin';

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const NOW = '2024-06-01T10:00:00.000Z';

// Real connection UUIDs emitted by the API alongside company rows (B-6 badge fix).
const CONN_UUID_1 = 'cc001111-0000-0000-0000-000000000011';
const CONN_UUID_2 = 'cc002222-0000-0000-0000-000000000022';

const COMPANY_1: Company & {
  contactCount: number;
  sourceCount: number;
  hasPendingCandidates: boolean;
} = {
  id: '11111111-0000-0000-0000-000000000001',
  name: 'Nexus Data Systems',
  domain: 'nexusdata.io',
  normalizedDomain: 'nexusdata.io',
  normalizedName: 'nexus data systems',
  sector: 'Enterprise SaaS',
  status: 'active',
  createdAt: NOW,
  updatedAt: null,
  // connectionIds is now part of the real API shape (B-6 badge fix).
  // The strict companySchema must declare it; omitting it here would hide a
  // future schema-drift regression (the "test the REAL API shape" lesson).
  connectionIds: [CONN_UUID_1, CONN_UUID_2],
  contactCount: 3,
  sourceCount: 2,
  hasPendingCandidates: false,
};

const COMPANY_2: Company & {
  contactCount: number;
  sourceCount: number;
  hasPendingCandidates: boolean;
} = {
  id: '22222222-0000-0000-0000-000000000002',
  name: 'Cipher Dynamics Inc',
  domain: 'cipherdynamics.com',
  normalizedDomain: 'cipherdynamics.com',
  normalizedName: 'cipher dynamics',
  sector: 'Cybersecurity',
  status: 'active',
  createdAt: NOW,
  updatedAt: null,
  connectionIds: [CONN_UUID_1],
  contactCount: 1,
  sourceCount: 1,
  hasPendingCandidates: true,
};

const CONTACT_1: Contact = {
  id: 'cc111111-0000-0000-0000-000000000001',
  companyId: COMPANY_1.id,
  name: 'Elena Rostova',
  email: 'e.rostova@nexusdata.io',
  normalizedEmail: 'e.rostova@nexusdata.io',
  title: 'CTO',
  createdAt: NOW,
  updatedAt: null,
};

const PROVENANCE_1: CompanyProvenance = {
  id: 'aa111111-0000-0000-0000-000000000001',
  companyId: COMPANY_1.id,
  rawCompanyId: 'bb111111-0000-0000-0000-000000000001',
  connectionId: 'cc001111-0000-0000-0000-000000000001',
  contributedFields: { name: true, domain: true },
  ingestedAt: NOW,
};

const CANDIDATE_1: DedupeCandidate = {
  id: 'dd111111-0000-0000-0000-000000000001',
  rawCompanyId: 'ee222222-0000-0000-0000-000000000002',
  matchedCompanyId: COMPANY_2.id,
  score: 0.87,
  reason: 'Same normalized domain from two connections',
  status: 'pending',
  resolvedBy: null,
  createdAt: NOW,
  resolvedAt: null,
};

// ── Fetch helpers ─────────────────────────────────────────────────────────

function makePageFetch(role: Role, companies: unknown[] = [COMPANY_1, COMPANY_2]) {
  return vi.fn().mockImplementation((url: string) => {
    const s = typeof url === 'string' ? url : '';
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    if (s.includes('/sourcing/companies')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ companies }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

function makeAuthFetch(status: number) {
  return vi
    .fn()
    .mockResolvedValue({ ok: false, status, json: () => Promise.resolve({}) } as Response);
}

async function renderPage() {
  try {
    const jsx = await CompaniesPage();
    if (jsx) render(jsx);
    return { redirected: false, path: null as string | null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('CompaniesPage (/sourcing/companies)', () => {
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

  // ── RBAC guard ──────────────────────────────────────────────────────────

  describe('RBAC guard — analyst-only access', () => {
    it('renders for analyst role without redirect', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
    });

    it('redirects to / for advisor role', async () => {
      vi.stubGlobal('fetch', makePageFetch('advisor'));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/');
    });

    it('redirects to / for compliance role', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/');
    });

    it('redirects to / for admin role (companies page is analyst-only)', async () => {
      vi.stubGlobal('fetch', makePageFetch('admin'));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/');
    });

    it('redirects to /login when session is invalid (401)', async () => {
      vi.stubGlobal('fetch', makeAuthFetch(401));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });

    it('redirects to /login when /auth/me returns 403', async () => {
      vi.stubGlobal('fetch', makeAuthFetch(403));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  // ── Companies list rendering ──────────────────────────────────────────

  describe('companies list renders for analyst', () => {
    it('renders the companies list heading', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      await renderPage();
      expect(screen.getByRole('heading', { name: /companies/i })).toBeDefined();
    });

    it('renders company names in the list', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      await renderPage();
      expect(screen.getByText('Nexus Data Systems')).toBeDefined();
      expect(screen.getByText('Cipher Dynamics Inc')).toBeDefined();
    });

    it('shows record count', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      await renderPage();
      expect(screen.getByText(/2 records/i)).toBeDefined();
    });

    it('renders empty state when no companies', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst', []));
      await renderPage();
      expect(screen.getByText(/no companies yet/i)).toBeDefined();
    });
  });
});

// ── CRITICAL-1 regression: PG-wire timestamp — deep-screen ───────────────────
//
// The /sourcing/companies SSR page fetches companies and parses them via
// companySchema (from @dealflow/shared). Before the shared-schema fix,
// companySchema used z.string().datetime() for createdAt/updatedAt; the API
// returns PG-wire format ("2026-07-04 04:42:20.996353+00", SPACE separator,
// +00 offset, microseconds) which z.string().datetime() REJECTS.
//
// Failure path (pre-fix):
//   fetchCompanies → safeParse companiesWithMetaResponseSchema → FAIL
//   (companySchema.createdAt z.string().datetime() rejects PG-wire) →
//   returns [] → page renders "No companies yet" despite real data.
//
// This test MUST fail on the pre-fix shared schema and MUST pass after the fix
// (companySchema.createdAt/updatedAt changed to z.string()).

const PG_WIRE_TS = '2026-07-04 04:42:20.996353+00';

const COMPANY_PG_WIRE_DEEP: typeof COMPANY_1 = {
  id: '33333333-0000-0000-0000-000000000033',
  name: 'PgWire Deep Corp',
  domain: 'pgwiredeep.io',
  normalizedDomain: 'pgwiredeep.io',
  normalizedName: 'pgwire deep corp',
  sector: 'Data',
  status: 'active',
  // PG-wire format — the shape that actually arrives from the API.
  createdAt: PG_WIRE_TS,
  updatedAt: null,
  // connectionIds is part of the real API shape (B-6 badge fix).
  // Pre-fix (before this wave's companySchema change): connectionIds is an
  // unrecognized key → strict safeParse rejects → fetchCompanies returns [] →
  // page shows "No companies yet". Post-fix: schema accepts → company shown.
  connectionIds: [CONN_UUID_1],
  contactCount: 0,
  sourceCount: 1,
  hasPendingCandidates: false,
};

// ── CRITICAL-2 regression: connectionIds in strict companySchema — deep screen ─
//
// The /sourcing/companies API now emits connectionIds:string[] on every company
// row (added in the B-6 badge fix). The shared companySchema was .strict() and
// did NOT declare connectionIds, so every company in the SSR parse was rejected
// with unrecognized_keys:['connectionIds'] → fetchCompanies returned [] →
// the deep screen rendered "No companies yet" despite real data.
//
// Failure path (pre-fix):
//   fetchCompanies → safeParse companiesWithMetaResponseSchema → FAIL
//   (companySchema strict rejects unrecognized 'connectionIds') →
//   returns [] → page renders "No companies yet" despite 4 real companies.
//
// This test block MUST fail on the pre-fix companySchema (missing connectionIds)
// and MUST pass after the fix (connectionIds declared in companySchema).

describe('CRITICAL-2 regression — connectionIds in API payload accepted by deep-screen (strict companySchema)', () => {
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

  it('SSR page renders company when API payload includes connectionIds (not "No companies yet")', async () => {
    // Full real API shape: base fields + connectionIds + sourceCount + contactCount.
    // Pre-fix: strict companySchema rejects connectionIds → returns [] → "No companies yet".
    // Post-fix: connectionIds declared in companySchema → parse succeeds → company shown.
    const realApiShape = {
      id: '44444444-0000-0000-0000-000000000044',
      name: 'ConnectionIds Corp',
      domain: 'connids.io',
      normalizedDomain: 'connids.io',
      normalizedName: 'connectionids corp',
      sector: 'FinTech',
      status: 'active',
      createdAt: '2026-07-04 04:42:20.996353+00',
      updatedAt: null,
      connectionIds: [CONN_UUID_1, CONN_UUID_2],
      sourceCount: 2,
      contactCount: 1,
      hasPendingCandidates: false,
    };
    vi.stubGlobal('fetch', makePageFetch('analyst', [realApiShape]));
    await renderPage();
    // Pre-fix: safeParse rejects connectionIds → "No companies yet"
    // Post-fix: parse succeeds → company is shown
    expect(screen.getByText('ConnectionIds Corp')).toBeDefined();
    expect(screen.queryByText(/no companies yet/i)).toBeNull();
  });

  it('SSR page renders all companies when API includes connectionIds on multiple rows', async () => {
    // COMPANY_1 and COMPANY_2 fixtures now carry connectionIds — the full API shape.
    vi.stubGlobal('fetch', makePageFetch('analyst', [COMPANY_1, COMPANY_2]));
    await renderPage();
    expect(screen.getByText('Nexus Data Systems')).toBeDefined();
    expect(screen.getByText('Cipher Dynamics Inc')).toBeDefined();
    expect(screen.queryByText(/no companies yet/i)).toBeNull();
  });

  it('SSR page shows correct record count when API payload includes connectionIds', async () => {
    vi.stubGlobal('fetch', makePageFetch('analyst', [COMPANY_1, COMPANY_2]));
    await renderPage();
    // 2 companies must be parsed (not 0 due to strict rejection)
    expect(screen.getByText(/2 records/i)).toBeDefined();
  });

  it('CompaniesClient renders company from real-API-shape payload (connectionIds present)', () => {
    // Client component receives pre-parsed data — confirm it renders correctly
    // even when the company object carries connectionIds.
    render(<CompaniesClient initialCompanies={[COMPANY_1, COMPANY_2]} />);
    expect(screen.getByText('Nexus Data Systems')).toBeDefined();
    expect(screen.queryByText(/no companies yet/i)).toBeNull();
  });
});

describe('CRITICAL-1 regression — PG-wire timestamp accepted by deep-screen (shared companySchema)', () => {
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

  it('SSR page renders company name when API returns PG-wire-format createdAt (not "No companies yet")', async () => {
    // The API response has a real PG-wire timestamp — NOT the ISO mock used elsewhere.
    vi.stubGlobal('fetch', makePageFetch('analyst', [COMPANY_PG_WIRE_DEEP]));
    await renderPage();
    // Company MUST be visible — pre-fix: safeParse fails → empty → "No companies yet"
    // Post-fix: companySchema.createdAt = z.string() → parse succeeds → company shown
    expect(screen.getByText('PgWire Deep Corp')).toBeDefined();
    expect(screen.queryByText(/no companies yet/i)).toBeNull();
  });

  it('fetchCompanies returns companies when API returns PG-wire-format createdAt', async () => {
    // Directly validate that the SSR fetch function (which uses companySchema) accepts PG-wire.
    vi.stubGlobal('fetch', makePageFetch('analyst', [COMPANY_PG_WIRE_DEEP]));
    await renderPage();
    // The page shows "1 records" — confirming 1 company was parsed, not 0.
    expect(screen.getByText(/1 record/i)).toBeDefined();
  });

  it('CompaniesClient renders correctly when pre-parsed company has PG-wire createdAt', () => {
    // Confirm the client component renders a company that arrived with a PG-wire timestamp.
    render(<CompaniesClient initialCompanies={[COMPANY_PG_WIRE_DEEP]} />);
    expect(screen.getByText('PgWire Deep Corp')).toBeDefined();
    expect(screen.queryByText(/no companies yet/i)).toBeNull();
  });
});

// ── CompaniesClient unit tests ────────────────────────────────────────────

describe('CompaniesClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders company list', () => {
    render(<CompaniesClient initialCompanies={[COMPANY_1, COMPANY_2]} />);
    expect(screen.getByText('Nexus Data Systems')).toBeDefined();
    expect(screen.getByText('Cipher Dynamics Inc')).toBeDefined();
  });

  it('shows "need review" count when there are pending candidates', () => {
    render(<CompaniesClient initialCompanies={[COMPANY_1, COMPANY_2]} />);
    expect(screen.getByText(/1 need review/i)).toBeDefined();
  });

  it('renders filter bar group', () => {
    render(<CompaniesClient initialCompanies={[COMPANY_1]} />);
    expect(screen.getByRole('group', { name: /filter companies/i })).toBeDefined();
  });

  it('shows empty state when no companies', () => {
    render(<CompaniesClient initialCompanies={[]} />);
    expect(screen.getByText(/no companies yet/i)).toBeDefined();
  });

  it('renders duplicate risk badge for company with pending candidates', () => {
    render(<CompaniesClient initialCompanies={[COMPANY_2]} />);
    expect(screen.getByLabelText(/status: duplicate risk/i)).toBeDefined();
  });

  it('renders active badge for active company without pending candidates', () => {
    render(<CompaniesClient initialCompanies={[COMPANY_1]} />);
    expect(screen.getByLabelText(/status: active/i)).toBeDefined();
  });
});

// ── FilterBar unit tests ──────────────────────────────────────────────────

describe('FilterBar', () => {
  const noop = () => {};

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders filter group', () => {
    render(
      <FilterBar
        statusFilter="all"
        onStatusChange={noop}
        showDuplicatesOnly={false}
        onDuplicatesOnlyChange={noop}
        duplicateCount={0}
      />
    );
    expect(screen.getByRole('group', { name: /filter companies/i })).toBeDefined();
  });

  it('renders All, Active, Archived buttons', () => {
    render(
      <FilterBar
        statusFilter="all"
        onStatusChange={noop}
        showDuplicatesOnly={false}
        onDuplicatesOnlyChange={noop}
        duplicateCount={0}
      />
    );
    expect(screen.getByRole('button', { name: /show all companies/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /show active companies only/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /show archived companies only/i })).toBeDefined();
  });

  it('shows duplicates chip when duplicateCount > 0', () => {
    render(
      <FilterBar
        statusFilter="all"
        onStatusChange={noop}
        showDuplicatesOnly={false}
        onDuplicatesOnlyChange={noop}
        duplicateCount={3}
      />
    );
    expect(screen.getByRole('button', { name: /show duplicate-risk companies/i })).toBeDefined();
  });

  it('does not show duplicates chip when duplicateCount = 0', () => {
    render(
      <FilterBar
        statusFilter="all"
        onStatusChange={noop}
        showDuplicatesOnly={false}
        onDuplicatesOnlyChange={noop}
        duplicateCount={0}
      />
    );
    expect(screen.queryByRole('button', { name: /show duplicate-risk/i })).toBeNull();
  });

  it('calls onStatusChange when clicking "Active"', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(
      <FilterBar
        statusFilter="all"
        onStatusChange={onStatusChange}
        showDuplicatesOnly={false}
        onDuplicatesOnlyChange={noop}
        duplicateCount={0}
      />
    );
    await user.click(screen.getByRole('button', { name: /show active companies only/i }));
    expect(onStatusChange).toHaveBeenCalledWith('active');
  });

  it('calls onStatusChange when clicking "Archived"', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(
      <FilterBar
        statusFilter="all"
        onStatusChange={onStatusChange}
        showDuplicatesOnly={false}
        onDuplicatesOnlyChange={noop}
        duplicateCount={0}
      />
    );
    await user.click(screen.getByRole('button', { name: /show archived companies only/i }));
    expect(onStatusChange).toHaveBeenCalledWith('archived');
  });

  it('calls onDuplicatesOnlyChange when clicking duplicates chip', async () => {
    const user = userEvent.setup();
    const onDuplicatesOnlyChange = vi.fn();
    render(
      <FilterBar
        statusFilter="all"
        onStatusChange={noop}
        showDuplicatesOnly={false}
        onDuplicatesOnlyChange={onDuplicatesOnlyChange}
        duplicateCount={2}
      />
    );
    await user.click(screen.getByRole('button', { name: /show duplicate-risk/i }));
    expect(onDuplicatesOnlyChange).toHaveBeenCalledWith(true);
  });
});

// ── CompanyDetail unit tests ──────────────────────────────────────────────

describe('CompanyDetail', () => {
  const noop = (_companyId: string, _hasPending: boolean) => undefined;

  const DETAIL_RESPONSE = {
    company: {
      id: COMPANY_1.id,
      name: COMPANY_1.name,
      domain: COMPANY_1.domain,
      normalizedDomain: COMPANY_1.normalizedDomain,
      normalizedName: COMPANY_1.normalizedName,
      sector: COMPANY_1.sector,
      status: COMPANY_1.status,
      createdAt: NOW,
      updatedAt: null,
    },
    contacts: [CONTACT_1],
    provenance: [PROVENANCE_1],
    pendingCandidates: [],
  };

  const DETAIL_WITH_CANDIDATE = {
    ...DETAIL_RESPONSE,
    company: {
      ...DETAIL_RESPONSE.company,
      id: COMPANY_2.id,
      name: COMPANY_2.name,
      domain: COMPANY_2.domain,
    },
    contacts: [],
    provenance: [],
    pendingCandidates: [CANDIDATE_1],
  };

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders loading skeleton initially', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => new Promise(() => {}), // never resolves
      } as unknown as Response)
    );
    render(
      <CompanyDetail
        companyId={COMPANY_1.id}
        companyName={COMPANY_1.name}
        onCandidateResolved={noop}
      />
    );
    // skeleton has no company name while loading
    expect(screen.queryByRole('heading', { name: /nexus data systems/i })).toBeNull();
  });

  it('renders company details after fetch', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_RESPONSE),
      } as Response)
    );

    render(
      <CompanyDetail
        companyId={COMPANY_1.id}
        companyName={COMPANY_1.name}
        {...(COMPANY_1.domain != null ? { companyDomain: COMPANY_1.domain } : {})}
        onCandidateResolved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nexus Data Systems' })).toBeDefined();
    });

    expect(screen.getByText('Elena Rostova')).toBeDefined();
  });

  it('renders provenance badges in provenance tab', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_RESPONSE),
      } as Response)
    );

    render(
      <CompanyDetail
        companyId={COMPANY_1.id}
        companyName={COMPANY_1.name}
        onCandidateResolved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nexus Data Systems' })).toBeDefined();
    });

    // Switch to provenance tab
    const provenanceTab = screen.getByRole('tab', { name: /provenance/i });
    await user.click(provenanceTab);

    // Provenance badge should contain a snippet of the connection ID
    const connectionIdSlice = PROVENANCE_1.connectionId.slice(0, 8);
    expect(screen.getByLabelText(new RegExp(connectionIdSlice, 'i'))).toBeDefined();
  });

  it('shows dedupe review tab with pending candidate count', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_WITH_CANDIDATE),
      } as Response)
    );

    render(
      <CompanyDetail
        companyId={COMPANY_2.id}
        companyName={COMPANY_2.name}
        onCandidateResolved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /dedupe review \(1\)/i })).toBeDefined();
    });
  });

  it('renders dedupe candidate card with merge and reject buttons', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_WITH_CANDIDATE),
      } as Response)
    );

    render(
      <CompanyDetail
        companyId={COMPANY_2.id}
        companyName={COMPANY_2.name}
        onCandidateResolved={noop}
      />
    );

    await waitFor(() => {
      // auto-selects dedupe tab when there are pending candidates
      expect(screen.getByRole('button', { name: /merge records/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /reject match/i })).toBeDefined();
    });
  });

  it('resolve merge: fires POST /sourcing/dedupe-candidates/:id/resolve with action=merge', async () => {
    const user = userEvent.setup();

    const resolveResponse = {
      candidateId: CANDIDATE_1.id,
      status: 'merged',
      companyId: COMPANY_2.id,
    };

    const mockFetch = vi
      .fn()
      // First call: GET /sourcing/companies/:id (detail fetch)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_WITH_CANDIDATE),
      } as Response)
      // Second call: POST resolve
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(resolveResponse),
      } as Response);

    vi.stubGlobal('fetch', mockFetch);

    const onCandidateResolved = vi.fn();
    render(
      <CompanyDetail
        companyId={COMPANY_2.id}
        companyName={COMPANY_2.name}
        onCandidateResolved={onCandidateResolved}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /merge records/i })).toBeDefined();
    });

    await user.click(screen.getByRole('button', { name: /merge records/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/sourcing/dedupe-candidates/${CANDIDATE_1.id}/resolve`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'merge' }),
        })
      );
    });

    // Candidate should be removed from view
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /merge records/i })).toBeNull();
    });

    expect(onCandidateResolved).toHaveBeenCalledWith(COMPANY_2.id, false);
  });

  it('resolve reject: fires POST with action=reject after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const resolveResponse = {
      candidateId: CANDIDATE_1.id,
      status: 'rejected',
    };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_WITH_CANDIDATE),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(resolveResponse),
      } as Response);

    vi.stubGlobal('fetch', mockFetch);

    render(
      <CompanyDetail
        companyId={COMPANY_2.id}
        companyName={COMPANY_2.name}
        onCandidateResolved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject match/i })).toBeDefined();
    });

    await user.click(screen.getByRole('button', { name: /reject match/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/sourcing/dedupe-candidates/${CANDIDATE_1.id}/resolve`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ action: 'reject' }),
        })
      );
    });
  });

  it('reject: does NOT fire API if user cancels confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve(DETAIL_WITH_CANDIDATE),
    } as Response);

    vi.stubGlobal('fetch', mockFetch);

    render(
      <CompanyDetail
        companyId={COMPANY_2.id}
        companyName={COMPANY_2.name}
        onCandidateResolved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reject match/i })).toBeDefined();
    });

    await user.click(screen.getByRole('button', { name: /reject match/i }));

    // Only the initial detail fetch should have been called (no resolve call)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Candidate card should still be visible
    expect(screen.getByRole('button', { name: /reject match/i })).toBeDefined();
  });

  it('renders error state when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve(''),
      } as Response)
    );

    render(
      <CompanyDetail
        companyId={COMPANY_1.id}
        companyName={COMPANY_1.name}
        onCandidateResolved={noop}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});

// ── Nav rendering ─────────────────────────────────────────────────────────

describe('nav — NAV_SOURCING renders for analyst role', () => {
  it('navItemsForRole("analyst") includes "Sourcing" nav item', () => {
    const items = navItemsForRole('analyst');
    const sourcingItem = items.find((i) => i.route === '/sourcing');
    expect(sourcingItem).toBeDefined();
    expect(sourcingItem?.label).toBe('Sourcing');
    expect(sourcingItem?.icon).toBe('database');
  });

  it('navItemsForRole("advisor") does NOT include /sourcing', () => {
    const items = navItemsForRole('advisor');
    const sourcingItem = items.find((i) => i.route === '/sourcing');
    expect(sourcingItem).toBeUndefined();
  });

  it('navItemsForRole("compliance") does NOT include /sourcing', () => {
    const items = navItemsForRole('compliance');
    const sourcingItem = items.find((i) => i.route === '/sourcing');
    expect(sourcingItem).toBeUndefined();
  });

  it('navItemsForRole("admin") does NOT include /sourcing', () => {
    const items = navItemsForRole('admin');
    const sourcingItem = items.find((i) => i.route === '/sourcing');
    expect(sourcingItem).toBeUndefined();
  });
});

// ── Filter interaction integration tests ─────────────────────────────────

describe('filter interaction — CompaniesClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('search query filters companies by name', async () => {
    const user = userEvent.setup();
    render(<CompaniesClient initialCompanies={[COMPANY_1, COMPANY_2]} />);

    const search = screen.getByRole('searchbox', { name: /search companies/i });
    await user.type(search, 'Nexus');

    await waitFor(() => {
      expect(screen.getByText('Nexus Data Systems')).toBeDefined();
      expect(screen.queryByText('Cipher Dynamics Inc')).toBeNull();
    });
  });

  it('search query filters companies by domain', async () => {
    const user = userEvent.setup();
    render(<CompaniesClient initialCompanies={[COMPANY_1, COMPANY_2]} />);

    const search = screen.getByRole('searchbox', { name: /search companies/i });
    await user.type(search, 'cipher');

    await waitFor(() => {
      expect(screen.getByText('Cipher Dynamics Inc')).toBeDefined();
      expect(screen.queryByText('Nexus Data Systems')).toBeNull();
    });
  });

  it('status filter "archived" hides active companies', async () => {
    const user = userEvent.setup();
    render(<CompaniesClient initialCompanies={[COMPANY_1, COMPANY_2]} />);

    await user.click(screen.getByRole('button', { name: /show archived companies only/i }));

    await waitFor(() => {
      // Both companies are 'active', so archived filter shows empty state
      // Empty state with no search query shows "No companies yet"
      expect(screen.getByText(/no companies yet/i)).toBeDefined();
    });
  });

  it('duplicates-only filter shows only companies with pending candidates', async () => {
    const user = userEvent.setup();
    render(<CompaniesClient initialCompanies={[COMPANY_1, COMPANY_2]} />);

    await user.click(screen.getByRole('button', { name: /show duplicate-risk/i }));

    await waitFor(() => {
      // Only COMPANY_2 has hasPendingCandidates=true
      expect(screen.queryByText('Nexus Data Systems')).toBeNull();
      expect(screen.getByText('Cipher Dynamics Inc')).toBeDefined();
    });
  });
});

// ── wave-7: CompanyDetail optional onCandidateResolved — server→client fix ──
//
// Root cause: /sourcing/companies/[id]/page.tsx is a SERVER component that
// previously passed `onCandidateResolved={(...) => undefined}` — a function
// prop — to the 'use client' CompanyDetail component. Next.js App Router
// forbids function props crossing the server→client boundary and throws a
// runtime 500.
//
// Fix: onCandidateResolved is now optional (?) on CompanyDetailProps; the
// call site is guarded with optional chaining (?.); the [id] page passes NO
// function prop. These tests guard the optional-prop contract:
//   (a) CompanyDetail renders and functions correctly without the callback.
//   (b) Resolving a candidate without a callback does NOT throw.
//   (c) CompaniesClient (client parent) still passes the callback and it fires.

describe('wave-7 fix — CompanyDetail.onCandidateResolved is optional (server→client boundary)', () => {
  const DETAIL_RESPONSE_NO_CANDIDATES = {
    company: {
      id: COMPANY_1.id,
      name: COMPANY_1.name,
      domain: COMPANY_1.domain,
      normalizedDomain: COMPANY_1.normalizedDomain,
      normalizedName: COMPANY_1.normalizedName,
      sector: COMPANY_1.sector,
      status: COMPANY_1.status,
      createdAt: NOW,
      updatedAt: null,
    },
    contacts: [CONTACT_1],
    provenance: [PROVENANCE_1],
    pendingCandidates: [],
  };

  const DETAIL_WITH_CANDIDATE_NO_CB = {
    ...DETAIL_RESPONSE_NO_CANDIDATES,
    company: {
      ...DETAIL_RESPONSE_NO_CANDIDATES.company,
      id: COMPANY_2.id,
      name: COMPANY_2.name,
      domain: COMPANY_2.domain,
    },
    contacts: [],
    provenance: [],
    pendingCandidates: [CANDIDATE_1],
  };

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // (a) Detail page case: no onCandidateResolved prop — renders without throwing.
  it('renders loading skeleton without onCandidateResolved prop (detail page case)', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => new Promise(() => {}), // never resolves — stays in loading
      } as unknown as Response)
    );
    // onCandidateResolved is intentionally omitted — simulates the server-component
    // detail page which cannot pass function props across the boundary.
    expect(() =>
      render(<CompanyDetail companyId={COMPANY_1.id} companyName={COMPANY_1.name} />)
    ).not.toThrow();
    // Still in loading state; no heading yet
    expect(screen.queryByRole('heading', { name: /nexus data systems/i })).toBeNull();
  });

  // (a) continued — detail renders after fetch without the callback.
  it('renders company detail after fetch with onCandidateResolved absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_RESPONSE_NO_CANDIDATES),
      } as Response)
    );
    render(<CompanyDetail companyId={COMPANY_1.id} companyName={COMPANY_1.name} />);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Nexus Data Systems' })).toBeDefined();
    });
    expect(screen.getByText('Elena Rostova')).toBeDefined();
  });

  // (b) Resolving a candidate without the callback must not throw.
  it('resolving a dedupe candidate with onCandidateResolved absent does not throw', async () => {
    const user = userEvent.setup();

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_WITH_CANDIDATE_NO_CB),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'merged' }),
      } as Response);

    vi.stubGlobal('fetch', mockFetch);

    // No onCandidateResolved — the guard (onCandidateResolved?.(...)) must swallow it.
    render(<CompanyDetail companyId={COMPANY_2.id} companyName={COMPANY_2.name} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /merge records/i })).toBeDefined();
    });

    // Should not throw even though onCandidateResolved is undefined.
    await expect(
      user.click(screen.getByRole('button', { name: /merge records/i }))
    ).resolves.not.toThrow();

    // Candidate card is removed from view — state update happened correctly.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /merge records/i })).toBeNull();
    });
  });

  // (c) List screen (client parent) still passes the callback and it fires correctly.
  it('onCandidateResolved fires when provided by a client parent (list-screen case)', async () => {
    const user = userEvent.setup();

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DETAIL_WITH_CANDIDATE_NO_CB),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'merged' }),
      } as Response);

    vi.stubGlobal('fetch', mockFetch);

    const onCandidateResolved = vi.fn();
    render(
      <CompanyDetail
        companyId={COMPANY_2.id}
        companyName={COMPANY_2.name}
        onCandidateResolved={onCandidateResolved}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /merge records/i })).toBeDefined();
    });

    await user.click(screen.getByRole('button', { name: /merge records/i }));

    await waitFor(() => {
      expect(onCandidateResolved).toHaveBeenCalledWith(COMPANY_2.id, false);
    });
  });
});
