/**
 * Mandate pages — B-3 tests (wave-8, C-2 defect fixes).
 *
 * Coverage:
 *
 * A. List page (/mandates):
 *    - Renders for advisor, admin, analyst roles (no redirect).
 *    - Compliance/unauthenticated → redirects.
 *    - Mandate seller name + deal-type visible in list.
 *    - Status filter renders (All / Draft / Active buttons).
 *    - Status filter in-memory: selecting 'draft' hides 'active' row.
 *    - Empty state renders when list is empty ("create your first mandate").
 *    - Error state renders when API returns null (initialMandates=null).
 *    - PG-wire-timestamp renders without crashing (wave-7 regression).
 *
 * B. Create form page (/mandates/new):
 *    - Renders 3 section headings for advisor/admin.
 *    - Analyst → redirects to '/'.
 *    - 3 required acknowledgment checkboxes present.
 *    - Jurisdiction dropdown populated from availableJurisdictions prop (CRITICAL-2 fix).
 *      No hardcoded list; only prop-driven options rendered.
 *    - Jurisdiction dropdown NOT present (no separate disclaimer picker element).
 *    - Client POST targets /mandates-data (not /mandates — CRITICAL-1 fix).
 *    - Form validates: missing seller name → error message, no POST.
 *    - Form validates: un-checked acks → error, no POST.
 *    - On 201 response: router.push called with /mandates/:id.
 *    - On API error: error message shown.
 *    - Empty jurisdictions → empty-state alert (no dropdown rendered).
 *
 * C. Detail page (/mandates/:id):
 *    - SSR-hydrated: renders seller name from initialDetail (no client fetch to
 *      /mandates/:id page route).
 *    - 0 client fetches to /mandates/:id after render.
 *    - Analyst: no "Configure" button (read-only).
 *    - Advisor/Admin: "Configure" button present.
 *    - Deferred placeholders: 3 labelled sections render (D6).
 *    - PG-wire timestamp renders (wave-7 regression).
 *    - 404: not-found state rendered (not a throw/crash).
 *    - PATCH configure: fires PATCH to /mandates-data/:id (CRITICAL-1 fix).
 *
 * Strategy:
 *   - Server page components are async; awaited + rendered.
 *   - Client components rendered directly for unit tests.
 *   - next/navigation + next/headers mocked at module boundary.
 *   - AppShell excluded (inherited from (app)/layout).
 *   - e2e paths excluded from vitest include glob.
 */

import type { Mandate, MandateDetail } from '@dealflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────

const { mockRedirect, mockCookies, mockRouterPush } = vi.hoisted(() => {
  const mockRedirect = vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  });
  const mockCookies = vi.fn().mockResolvedValue({
    toString: () => 'st-access-token=test-token',
  });
  const mockRouterPush = vi.fn();
  return { mockRedirect, mockCookies, mockRouterPush };
});

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  useRouter: () => ({ push: mockRouterPush }),
}));
vi.mock('next/headers', () => ({ cookies: mockCookies }));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { MandateDetailClient } from './_components/MandateDetailClient';
import type { AvailableJurisdiction } from './_components/MandateForm';
import { MandateForm } from './_components/MandateForm';
import { MandateListClient } from './_components/MandateListClient';
import { StatusFilter } from './_components/StatusFilter';
import MandateDetailPage from './[id]/page';
import NewMandatePage from './new/page';
import MandatesPage from './page';

// ── Fixture data ───────────────────────────────────────────────────────────

/** Available jurisdictions fixture — matches active disclaimer templates (CRITICAL-2). */
const AVAILABLE_JURISDICTIONS: AvailableJurisdiction[] = [{ value: 'US', label: 'US' }];

type RoleStr = 'advisor' | 'analyst' | 'compliance' | 'admin';

const NOW_ISO = '2026-07-04T04:42:20.000Z';
const NOW_PG = '2026-07-04 04:42:20+00';
const MANDATE_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
// All IDs use only valid hex chars (0-9 a-f) — z.string().uuid() validates hex only.
const TEMPLATE_ID = '11111111-0000-0000-0000-000000000001';
const CRITERIA_ID = 'cccccccc-0000-0000-0000-000000000001';
const PROFILE_ID = '22222222-0000-0000-0000-000000000001';

function meFor(role: RoleStr) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const MANDATE_DRAFT: Mandate = {
  id: MANDATE_ID,
  // hex-only UUID — 'u' is not a hex char, use '00000000...' (z.string().uuid() validates hex)
  createdBy: '00000000-0000-0000-0000-000000000001',
  sellerName: 'Apex Analytics Inc.',
  sellerIndustry: 'Enterprise Software / SaaS',
  // Different from buyerCriteria.geo ('North America') to avoid getByText duplicate-match errors.
  sellerGeo: ['Europe'],
  sellerSizeBand: 'mid',
  description: 'Strong recurring revenue.',
  dealType: 'Full Acquisition',
  status: 'draft',
  createdAt: NOW_ISO,
  updatedAt: null,
};

const MANDATE_ACTIVE: Mandate = {
  ...MANDATE_DRAFT,
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  sellerName: 'Delta Systems Corp.',
  status: 'active',
};

const MANDATE_PG_WIRE: Mandate = {
  ...MANDATE_DRAFT,
  id: 'cccccccc-1111-0000-0000-000000000001',
  sellerName: 'PgWire Corp',
  createdAt: NOW_PG, // PG-wire timestamp — wave-7 regression fixture
};

const MANDATE_DETAIL: MandateDetail = {
  mandate: MANDATE_DRAFT,
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

function makeListPageFetch(role: RoleStr, mandates: Mandate[] = [MANDATE_DRAFT, MANDATE_ACTIVE]) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    if (s.includes('/mandates')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ mandates }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

function makeDetailPageFetch(role: RoleStr, detail: MandateDetail | null = MANDATE_DETAIL) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    if (s.includes(`/mandates/${MANDATE_ID}`)) {
      if (detail === null) return Promise.resolve({ ok: false, status: 404 } as Response);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(detail),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

/**
 * makeNewPageFetch — mocks /auth/me and /mandates/jurisdictions for the
 * new-mandate server page (CRITICAL-2 fix: page SSR-fetches advisor-readable
 * jurisdiction list from GET /mandates/jurisdictions, not /compliance/disclaimers).
 *
 * @param role - the authenticated user's role
 * @param jurisdictions - jurisdictions to return (default: [{jurisdiction:'US'}])
 */
function makeNewPageFetch(
  role: RoleStr,
  jurisdictions: Array<{ jurisdiction: string }> = [{ jurisdiction: 'US' }]
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
    // CRITICAL-2 (C-2 fix): page SSR-fetches /mandates/jurisdictions.
    // advisor + admin → 200; analyst → 403 (read-only — cannot create mandates).
    if (s.includes('/mandates/jurisdictions')) {
      const canAccess = role === 'advisor' || role === 'admin';
      if (!canAccess) {
        return Promise.resolve({ ok: false, status: 403 } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jurisdictions),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

// ── Page render helpers ─────────────────────────────────────────────────────

async function renderListPage() {
  try {
    const jsx = await MandatesPage();
    if (jsx) render(jsx);
    return { redirected: false, path: null as string | null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

async function renderNewPage() {
  try {
    const jsx = await NewMandatePage();
    if (jsx) render(jsx);
    return { redirected: false, path: null as string | null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

async function renderDetailPage(id = MANDATE_ID) {
  try {
    const jsx = await MandateDetailPage({ params: Promise.resolve({ id }) });
    if (jsx) render(jsx);
    return { redirected: false, path: null as string | null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── A. List page tests ─────────────────────────────────────────────────────

describe('A. MandatesPage (/mandates)', () => {
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
      vi.stubGlobal('fetch', makeListPageFetch('advisor'));
      const { redirected } = await renderListPage();
      expect(redirected).toBe(false);
    });

    it('renders for admin (no redirect)', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('admin'));
      const { redirected } = await renderListPage();
      expect(redirected).toBe(false);
    });

    it('renders for analyst (no redirect)', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('analyst'));
      const { redirected } = await renderListPage();
      expect(redirected).toBe(false);
    });

    it('redirects to / for compliance role', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('compliance'));
      const { redirected, path } = await renderListPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/');
    });

    it('redirects to /login when unauthenticated (401)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          json: () => Promise.resolve({}),
        } as Response)
      );
      const { redirected, path } = await renderListPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  describe('list renders', () => {
    it('renders mandate seller names', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('advisor'));
      await renderListPage();
      expect(screen.getByText('Apex Analytics Inc.')).toBeDefined();
      expect(screen.getByText('Delta Systems Corp.')).toBeDefined();
    });

    it('renders deal type in list', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('advisor'));
      await renderListPage();
      // "Full Acquisition" deal type from MANDATE_DRAFT
      expect(screen.getAllByText('Full Acquisition').length).toBeGreaterThan(0);
    });

    it('renders status filter with All / Draft / Active options', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('advisor'));
      await renderListPage();
      expect(screen.getByRole('radio', { name: 'All' })).toBeDefined();
      expect(screen.getByRole('radio', { name: 'Draft' })).toBeDefined();
      expect(screen.getByRole('radio', { name: 'Active' })).toBeDefined();
    });

    it('renders "New mandate" button linking to /mandates/new', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('advisor'));
      await renderListPage();
      expect(screen.getByRole('button', { name: /new mandate/i })).toBeDefined();
    });
  });

  describe('empty state', () => {
    it('renders empty-state heading when list is empty (advisor)', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('advisor', []));
      await renderListPage();
      expect(screen.getByText(/no mandates yet/i)).toBeDefined();
    });

    it('does not crash on empty list (no throw)', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('advisor', []));
      const { redirected } = await renderListPage();
      expect(redirected).toBe(false);
    });
  });

  describe('error state', () => {
    it('renders error alert when API returns error (initialMandates=null)', () => {
      render(<MandateListClient initialMandates={null} userRole="advisor" />);
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/unable to load mandates/i)).toBeDefined();
    });
  });

  describe('PG-wire timestamp regression (wave-7)', () => {
    it('renders mandate with PG-wire createdAt without crashing', async () => {
      vi.stubGlobal('fetch', makeListPageFetch('analyst', [MANDATE_PG_WIRE]));
      const { redirected } = await renderListPage();
      expect(redirected).toBe(false);
      expect(screen.getByText('PgWire Corp')).toBeDefined();
    });

    it('renders date string from PG-wire timestamp (not raw timestamp)', () => {
      render(<MandateListClient initialMandates={[MANDATE_PG_WIRE]} userRole="advisor" />);
      expect(screen.getByText('PgWire Corp')).toBeDefined();
      // The date should be formatted (not raw PG-wire string)
      // We check that the raw wire string is NOT rendered as-is
      expect(screen.queryByText(NOW_PG)).toBeNull();
    });
  });
});

// ── A2. StatusFilter unit tests ────────────────────────────────────────────

describe('A2. StatusFilter unit', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders All / Draft / Active options', () => {
    const noop = vi.fn();
    render(<StatusFilter value="all" onChange={noop} />);
    expect(screen.getByRole('radio', { name: 'All' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Draft' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Active' })).toBeDefined();
  });

  it('calls onChange with "draft" when Draft is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatusFilter value="all" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'Draft' }));
    expect(onChange).toHaveBeenCalledWith('draft');
  });

  it('calls onChange with "all" when All is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StatusFilter value="draft" onChange={onChange} />);
    await user.click(screen.getByRole('radio', { name: 'All' }));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('marks active filter as aria-checked=true', () => {
    const noop = vi.fn();
    render(<StatusFilter value="active" onChange={noop} />);
    expect(screen.getByRole('radio', { name: 'Active' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Draft' }).getAttribute('aria-checked')).toBe('false');
  });
});

// ── A3. MandateListClient in-memory filter tests ───────────────────────────

describe('A3. MandateListClient — in-memory status filter', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows all mandates when filter=all', () => {
    render(
      <MandateListClient initialMandates={[MANDATE_DRAFT, MANDATE_ACTIVE]} userRole="advisor" />
    );
    expect(screen.getByText('Apex Analytics Inc.')).toBeDefined();
    expect(screen.getByText('Delta Systems Corp.')).toBeDefined();
  });

  it('filters to only draft mandates when "Draft" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MandateListClient initialMandates={[MANDATE_DRAFT, MANDATE_ACTIVE]} userRole="advisor" />
    );
    await user.click(screen.getByRole('radio', { name: 'Draft' }));
    await waitFor(() => {
      expect(screen.getByText('Apex Analytics Inc.')).toBeDefined();
      expect(screen.queryByText('Delta Systems Corp.')).toBeNull();
    });
  });

  it('filters to only active mandates when "Active" is clicked', async () => {
    const user = userEvent.setup();
    render(
      <MandateListClient initialMandates={[MANDATE_DRAFT, MANDATE_ACTIVE]} userRole="advisor" />
    );
    await user.click(screen.getByRole('radio', { name: 'Active' }));
    await waitFor(() => {
      expect(screen.queryByText('Apex Analytics Inc.')).toBeNull();
      expect(screen.getByText('Delta Systems Corp.')).toBeDefined();
    });
  });

  it('restores all mandates when "All" is clicked after filtering', async () => {
    const user = userEvent.setup();
    render(
      <MandateListClient initialMandates={[MANDATE_DRAFT, MANDATE_ACTIVE]} userRole="advisor" />
    );

    await user.click(screen.getByRole('radio', { name: 'Draft' }));
    await waitFor(() => {
      expect(screen.queryByText('Delta Systems Corp.')).toBeNull();
    });

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await waitFor(() => {
      expect(screen.getByText('Delta Systems Corp.')).toBeDefined();
    });
  });

  it('no fetch fired during in-memory filter changes', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const user = userEvent.setup();
    render(
      <MandateListClient initialMandates={[MANDATE_DRAFT, MANDATE_ACTIVE]} userRole="advisor" />
    );
    await user.click(screen.getByRole('radio', { name: 'Draft' }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── A4. W8-3 — "New mandate" button RBAC-UX consistency ───────────────────
//
// advisor + admin → button visible; analyst → button hidden (W8-3).
// Gated by rolesForRoute('/mandates/new') from the shared RBAC map.

describe('A4. MandateListClient — W8-3 "New mandate" button RBAC-UX', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows "New mandate" header button for advisor (write role)', () => {
    render(<MandateListClient initialMandates={[MANDATE_DRAFT]} userRole="advisor" />);
    expect(screen.getByRole('button', { name: /create a new mandate/i })).toBeDefined();
  });

  it('shows "New mandate" header button for admin (write role)', () => {
    render(<MandateListClient initialMandates={[MANDATE_DRAFT]} userRole="admin" />);
    expect(screen.getByRole('button', { name: /create a new mandate/i })).toBeDefined();
  });

  it('hides "New mandate" header button for analyst (read-only role)', () => {
    render(<MandateListClient initialMandates={[MANDATE_DRAFT]} userRole="analyst" />);
    expect(screen.queryByRole('button', { name: /create a new mandate/i })).toBeNull();
  });

  it('hides "New mandate" header button for compliance (read-only role)', () => {
    // compliance cannot access /mandates at all (server-gated), but defensive check:
    render(<MandateListClient initialMandates={[MANDATE_DRAFT]} userRole="compliance" />);
    expect(screen.queryByRole('button', { name: /create a new mandate/i })).toBeNull();
  });

  it('shows empty-state "New mandate" button for advisor (write role)', () => {
    render(<MandateListClient initialMandates={[]} userRole="advisor" />);
    // The empty-state "New mandate" button (no aria-label; match by text)
    expect(screen.getByRole('button', { name: /^new mandate$/i })).toBeDefined();
  });

  it('hides empty-state "New mandate" button for analyst (read-only role)', () => {
    render(<MandateListClient initialMandates={[]} userRole="analyst" />);
    // No create button in the empty state — analyst is read-only
    expect(screen.queryByRole('button', { name: /^new mandate$/i })).toBeNull();
  });
});

// ── A5. W8-2 — MandateForm 3-ack client validation reliability ────────────
//
// Confirms the submit handler reads live ack state from the current form
// snapshot (not a stale closure). Unchecking any ack → blocked; all 3 → allowed.

describe('A5. MandateForm — W8-2 reliable 3-ack client validation', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('blocks submit and shows error when ack-1 (lawful_authorization) is unchecked', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    // Fill required fields
    await user.type(screen.getByLabelText(/company name/i), 'Test Corp');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    // Check only ack-2 and ack-3; leave ack-1 unchecked
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(3);
    const [, cb1, cb2] = checkboxes as [HTMLElement, HTMLElement, HTMLElement];
    // cb0 = ack-1 (lawful_authorization) — left unchecked
    if (!(cb1 as HTMLInputElement).checked) await user.click(cb1);
    if (!(cb2 as HTMLInputElement).checked) await user.click(cb2);

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      // Error message appears in the alert list — match inside the role="alert" element
      expect(screen.getAllByText(/lawfully authorized by the seller/i).length).toBeGreaterThan(0);
    });
    // No POST fired
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks submit and shows error when ack-2 (ai_results_validated) is unchecked', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    await user.type(screen.getByLabelText(/company name/i), 'Test Corp');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    const checkboxes = screen.getAllByRole('checkbox');
    const [cb0, , cb2b] = checkboxes as [HTMLElement, HTMLElement, HTMLElement];
    // Check ack-1 and ack-3; leave ack-2 (index 1) unchecked
    if (!(cb0 as HTMLInputElement).checked) await user.click(cb0);
    // cb1 = ack-2 (ai_results_validated) — left unchecked
    if (!(cb2b as HTMLInputElement).checked) await user.click(cb2b);

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getAllByText(/AI results.*validated/i).length).toBeGreaterThan(0);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('blocks submit and shows error when ack-3 (conflict_dbs_reviewed) is unchecked', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    await user.type(screen.getByLabelText(/company name/i), 'Test Corp');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    const checkboxes = screen.getAllByRole('checkbox');
    const [cb0c, cb1c] = checkboxes as [HTMLElement, HTMLElement, HTMLElement];
    // Check ack-1 and ack-2; leave ack-3 (index 2) unchecked
    if (!(cb0c as HTMLInputElement).checked) await user.click(cb0c);
    if (!(cb1c as HTMLInputElement).checked) await user.click(cb1c);
    // cb2c = ack-3 (conflict_dbs_reviewed) — left unchecked

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getAllByText(/conflict databases.*reviewed/i).length).toBeGreaterThan(0);
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('allows submit (POSTs) when all 3 acks are checked', async () => {
    const user = userEvent.setup();
    // Mock a 201 so the form proceeds past the ack gate
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(MANDATE_DRAFT),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    await user.type(screen.getByLabelText(/company name/i), 'Test Corp');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    // Check all 3 acks
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      if (!(cb as HTMLInputElement).checked) await user.click(cb);
    }

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    // POST must fire when all 3 acks are checked
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/mandates-data',
        expect.objectContaining({ method: 'POST' })
      );
    });
    // No ack-related error alert shown
    expect(screen.queryByText(/All three compliance acknowledgments are required/i)).toBeNull();
  });

  it('blocks submit immediately after unchecking a previously-checked ack (live state)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    await user.type(screen.getByLabelText(/company name/i), 'Test Corp');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    const checkboxes = screen.getAllByRole('checkbox');

    // Check all 3 first
    for (const cb of checkboxes) {
      if (!(cb as HTMLInputElement).checked) await user.click(cb);
    }

    // Now uncheck ack-1 — validate() must see the live unchecked state
    const [firstCb] = checkboxes as [HTMLElement, ...HTMLElement[]];
    await user.click(firstCb);
    expect((firstCb as HTMLInputElement).checked).toBe(false);

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getAllByText(/lawfully authorized by the seller/i).length).toBeGreaterThan(0);
    });
    // Validate blocked the submit — no POST fired
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── B. Create form page tests ──────────────────────────────────────────────

describe('B. NewMandatePage (/mandates/new)', () => {
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
      vi.stubGlobal('fetch', makeNewPageFetch('advisor'));
      const { redirected } = await renderNewPage();
      expect(redirected).toBe(false);
    });

    it('renders for admin (no redirect)', async () => {
      vi.stubGlobal('fetch', makeNewPageFetch('admin'));
      const { redirected } = await renderNewPage();
      expect(redirected).toBe(false);
    });

    it('redirects to / for analyst role (read-only)', async () => {
      vi.stubGlobal('fetch', makeNewPageFetch('analyst'));
      const { redirected, path } = await renderNewPage();
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
      const { redirected, path } = await renderNewPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  describe('form structure', () => {
    it('renders 3 section headings', async () => {
      vi.stubGlobal('fetch', makeNewPageFetch('advisor'));
      await renderNewPage();
      expect(screen.getByRole('heading', { name: /seller.*target profile/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /buyer universe criteria/i })).toBeDefined();
      expect(screen.getByRole('heading', { name: /compliance guardrails/i })).toBeDefined();
    });
  });
});

// ── B2. MandateForm unit tests ─────────────────────────────────────────────
// All renders pass availableJurisdictions prop (CRITICAL-2 fix).
// The prop replaces the old hardcoded JURISDICTIONS constant.

describe('B2. MandateForm unit', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders 3 required acknowledgment checkboxes', () => {
    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);
    const checkboxes = screen.getAllByRole('checkbox');
    // 3 required acks (D5)
    const acks = checkboxes.filter(
      (cb) => cb.getAttribute('aria-required') === 'true' || cb.hasAttribute('required')
    );
    expect(acks.length).toBeGreaterThanOrEqual(3);
  });

  it('renders jurisdiction dropdown (D2 — no separate disclaimer picker)', () => {
    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);
    expect(screen.getByLabelText(/legal jurisdiction/i)).toBeDefined();
    // The disclaimer is derived server-side — there must be NO separate "disclaimer" picker
    const disclaimerInput = screen.queryByLabelText(/disclaimer/i);
    expect(disclaimerInput).toBeNull();
  });

  it('renders jurisdiction options from availableJurisdictions prop (not hardcoded)', () => {
    // CRITICAL-2: the dropdown must be populated from the prop, not a hardcoded list.
    const jurisdictions: AvailableJurisdiction[] = [
      { value: 'US', label: 'US' },
      { value: 'CA', label: 'CA' },
    ];
    render(<MandateForm availableJurisdictions={jurisdictions} />);
    const select = screen.getByLabelText(/legal jurisdiction/i);
    const options = Array.from((select as HTMLSelectElement).options);
    const optionValues = options.map((o) => o.value).filter((v) => v !== '');
    // Only prop-supplied values should appear — no hardcoded extras like 'us_delaware', 'uk', 'eu'
    expect(optionValues).toContain('US');
    expect(optionValues).toContain('CA');
    expect(optionValues).not.toContain('us_delaware');
    expect(optionValues).not.toContain('uk');
    expect(optionValues).not.toContain('eu');
  });

  it('renders empty-state alert when availableJurisdictions is empty', () => {
    render(<MandateForm availableJurisdictions={[]} />);
    // No dropdown when no jurisdictions available
    expect(screen.queryByRole('combobox', { name: /legal jurisdiction/i })).toBeNull();
    // Empty-state alert is shown
    const alert = screen.getByRole('alert', { name: /no compliance jurisdictions configured/i });
    expect(alert).toBeDefined();
  });

  it('renders seller name input as required', () => {
    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);
    const nameInput = screen.getByLabelText(/company name/i);
    expect(nameInput).toBeDefined();
    expect(nameInput.getAttribute('required')).not.toBeNull();
  });

  it('shows error when submitting with missing seller name', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);
    // Do not fill name; fill required acks + jurisdiction
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    // Check all 3 acks
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      if (!(cb as HTMLInputElement).checked) await user.click(cb);
    }

    // Submit without seller name
    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/seller company name is required/i)).toBeDefined();
    });

    // No POST fired
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows error when submitting with unchecked acknowledgments', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    // Fill seller name
    await user.type(screen.getByLabelText(/company name/i), 'Test Corp');
    // Select jurisdiction
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');
    // Leave acks unchecked

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    // No POST fired
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls POST /mandates-data (not /mandates) with rid:anti-csrf header on valid submit (CRITICAL-1 fix)', async () => {
    // CRITICAL-1: client create must target /mandates-data, NOT /mandates (page route).
    const user = userEvent.setup();

    // Mock returns the REAL flat Mandate shape (top-level id, no wrapper) — C-2 fix.
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () => Promise.resolve(MANDATE_DRAFT),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    // Fill required fields
    await user.type(screen.getByLabelText(/company name/i), 'Apex Analytics Inc.');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    // Check all 3 acknowledgments
    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      if (!(cb as HTMLInputElement).checked) await user.click(cb);
    }

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/mandates-data',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ rid: 'anti-csrf' }),
        })
      );
      // Must NOT call /mandates (the page route)
      const calledUrls = mockFetch.mock.calls.map((c) => c[0] as string);
      expect(calledUrls.some((u) => u === '/mandates')).toBe(false);
    });
  });

  it('redirects to /mandates/:id on 201 response — flat Mandate shape (C-2 regression)', async () => {
    // C-2 regression test: POST /mandates returns a FLAT Mandate (top-level id).
    // The pre-fix code read `created?.mandate?.id` (wrapped shape) so id was always
    // undefined → no redirect + silent mandate duplication on retry.
    // After the fix: `mandateSchema.safeParse(json).data.id` reads the flat id correctly.
    //
    // This test MUST FAIL on the pre-fix `created?.mandate?.id` path and PASS after.
    const user = userEvent.setup();

    // Real flat API shape — matches what POST /mandates actually returns.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(MANDATE_DRAFT),
      } as Response)
    );

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    await user.type(screen.getByLabelText(/company name/i), 'Apex Analytics Inc.');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      if (!(cb as HTMLInputElement).checked) await user.click(cb);
    }

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    // After fix: redirects to the created mandate's detail page.
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith(`/mandates/${MANDATE_ID}`);
    });

    // No error message shown — the redirect must have fired.
    expect(screen.queryByText(/failed to create mandate/i)).toBeNull();
  });

  it('does NOT redirect on 201 with wrapped shape { mandate: { id } } (pre-fix shape — must show error)', async () => {
    // Confirms the old wrapped shape { mandate: { id } } is NOT the real API response:
    // mandateSchema.safeParse fails (no top-level id / sellerName / etc.) → id is undefined
    // → form shows "Failed to create mandate." error instead of redirecting.
    // This test documents the pre-fix failure mode so the distinction stays clear.
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ mandate: { id: MANDATE_ID } }),
      } as Response)
    );

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    await user.type(screen.getByLabelText(/company name/i), 'Apex Analytics Inc.');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      if (!(cb as HTMLInputElement).checked) await user.click(cb);
    }

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    // The wrapped shape fails mandateSchema.safeParse → no id → no redirect → shows error.
    await waitFor(() => {
      expect(mockRouterPush).not.toHaveBeenCalled();
      expect(screen.getByText(/failed to create mandate/i)).toBeDefined();
    });
  });

  it('shows error message on API error response', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: 'Jurisdiction not found.' }),
      } as Response)
    );

    render(<MandateForm availableJurisdictions={AVAILABLE_JURISDICTIONS} />);

    await user.type(screen.getByLabelText(/company name/i), 'Test Corp');
    await user.selectOptions(screen.getByLabelText(/legal jurisdiction/i), 'US');

    const checkboxes = screen.getAllByRole('checkbox');
    for (const cb of checkboxes) {
      if (!(cb as HTMLInputElement).checked) await user.click(cb);
    }

    await user.click(screen.getByRole('button', { name: /create mandate/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });
});

// ── C. Detail page tests ───────────────────────────────────────────────────

describe('C. MandateDetailPage (/mandates/:id)', () => {
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
      vi.stubGlobal('fetch', makeDetailPageFetch('advisor'));
      const { redirected } = await renderDetailPage();
      expect(redirected).toBe(false);
    });

    it('renders for admin (no redirect)', async () => {
      vi.stubGlobal('fetch', makeDetailPageFetch('admin'));
      const { redirected } = await renderDetailPage();
      expect(redirected).toBe(false);
    });

    it('renders for analyst (no redirect)', async () => {
      vi.stubGlobal('fetch', makeDetailPageFetch('analyst'));
      const { redirected } = await renderDetailPage();
      expect(redirected).toBe(false);
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
      const { redirected, path } = await renderDetailPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/login');
    });
  });

  describe('SSR-hydration (no page-route client fetch)', () => {
    it('renders seller name from SSR-hydrated initialDetail', async () => {
      vi.stubGlobal('fetch', makeDetailPageFetch('advisor'));
      await renderDetailPage();
      expect(screen.getByRole('heading', { name: 'Apex Analytics Inc.' })).toBeDefined();
    });

    it('fetches exactly 2 times server-side (me + detail) — no client fetch', async () => {
      const fetchSpy = makeDetailPageFetch('advisor');
      vi.stubGlobal('fetch', fetchSpy);

      await renderDetailPage();

      // Only the 2 SSR fetches: /auth/me + /mandates/:id
      expect(fetchSpy).toHaveBeenCalledTimes(2);

      const calledUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
      // Both calls go to the INTERNAL API (apiBase()), NOT the same-origin page route
      for (const url of calledUrls) {
        // The same-origin path /mandates/:id would have no host prefix
        expect(url).not.toBe(`/mandates/${MANDATE_ID}`);
        // Internal API calls contain 'localhost' or the configured API base
        expect(url.includes('localhost') || url.includes('3001') || url.includes('/mandates')).toBe(
          true
        );
      }
    });

    it('0 client fetches to /mandates/:id after render (no page-route collision)', async () => {
      const fetchSpy = makeDetailPageFetch('advisor');
      vi.stubGlobal('fetch', fetchSpy);

      await renderDetailPage();

      // All fetches are SSR (complete before render); check none target the bare path
      for (const call of fetchSpy.mock.calls) {
        const url = String(call[0]);
        // Bare same-origin path would be exactly '/mandates/:id' — must not appear
        expect(url).not.toBe(`/mandates/${MANDATE_ID}`);
      }
    });
  });

  describe('not-found state', () => {
    it('renders not-found state when API returns 404 (does not throw)', async () => {
      vi.stubGlobal('fetch', makeDetailPageFetch('advisor', null));
      const { redirected } = await renderDetailPage();
      // Must NOT redirect — renders a not-found UI instead
      expect(redirected).toBe(false);
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/mandate not found/i)).toBeDefined();
    });
  });

  describe('PG-wire timestamp regression (wave-7)', () => {
    it('renders detail page without crash when createdAt is PG-wire format', async () => {
      const detailWithPgTs: MandateDetail = {
        ...MANDATE_DETAIL,
        mandate: { ...MANDATE_DRAFT, createdAt: NOW_PG },
      };
      vi.stubGlobal('fetch', makeDetailPageFetch('advisor', detailWithPgTs));
      const { redirected } = await renderDetailPage();
      expect(redirected).toBe(false);
      // Use getByRole('heading') — 'Apex Analytics Inc.' appears in both the <h1>
      // and the Company <dd> row, so getByText would throw "found multiple".
      expect(screen.getByRole('heading', { name: 'Apex Analytics Inc.' })).toBeDefined();
    });
  });
});

// ── C2. MandateDetailClient unit tests ────────────────────────────────────

describe('C2. MandateDetailClient — unit', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders seller name from initialDetail prop', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="advisor"
      />
    );
    expect(screen.getByRole('heading', { name: 'Apex Analytics Inc.' })).toBeDefined();
  });

  it('renders without any client fetch (initialDetail is used directly)', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="analyst"
      />
    );

    expect(screen.getByRole('heading', { name: 'Apex Analytics Inc.' })).toBeDefined();
    // No fetch was made — SSR-hydrated prop is used directly
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('analyst: no "Configure" button (read-only)', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="analyst"
      />
    );
    expect(screen.queryByRole('button', { name: /configure/i })).toBeNull();
  });

  it('advisor: "Configure" button is present', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="advisor"
      />
    );
    expect(screen.getByRole('button', { name: /configure/i })).toBeDefined();
  });

  it('admin: "Configure" button is present', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <MandateDetailClient mandateId={MANDATE_ID} initialDetail={MANDATE_DETAIL} userRole="admin" />
    );
    expect(screen.getByRole('button', { name: /configure/i })).toBeDefined();
  });

  it('renders D6 sections: Buyer Engine live CTA + Ranked Candidates + Pipeline deferred', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="analyst"
      />
    );
    // Wave-9 B-3: Buyer Engine is now a live CTA linking to /buyer-universe?mandateId=
    // (no longer a DeferredPlaceholder — the "coming in a later step" text is gone for this section)
    const buyerEngineLink = screen.getByRole('link', { name: /open buyer universe/i });
    expect(buyerEngineLink).toBeDefined();
    expect(buyerEngineLink.getAttribute('href')).toBe(`/buyer-universe?mandateId=${MANDATE_ID}`);

    // Ranked Candidates + Pipeline remain deferred (M5/later)
    expect(
      screen.getByRole('region', { name: /ranked candidates.*coming in a later step/i })
    ).toBeDefined();
    expect(screen.getByRole('region', { name: /pipeline.*coming in a later step/i })).toBeDefined();
  });

  it('renders compliance profile jurisdiction', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="advisor"
      />
    );
    expect(screen.getByText('us_delaware')).toBeDefined();
  });

  it('renders buyer criteria geography', () => {
    vi.stubGlobal('fetch', vi.fn());
    render(
      <MandateDetailClient
        mandateId={MANDATE_ID}
        initialDetail={MANDATE_DETAIL}
        userRole="advisor"
      />
    );
    // Use getAllByText because seller geo + buyer geo may both render geographic text.
    expect(screen.getAllByText('North America').length).toBeGreaterThan(0);
  });

  describe('configure (advisor/admin) — PATCH with rid', () => {
    it('opens configure form when Configure button is clicked', async () => {
      const user = userEvent.setup();
      vi.stubGlobal('fetch', vi.fn());

      render(
        <MandateDetailClient
          mandateId={MANDATE_ID}
          initialDetail={MANDATE_DETAIL}
          userRole="advisor"
        />
      );

      await user.click(screen.getByRole('button', { name: /configure/i }));

      expect(screen.getByRole('form', { name: /configure mandate/i })).toBeDefined();
    });

    it('fires PATCH /mandates-data/:id (not /mandates/:id) with rid:anti-csrf on save (CRITICAL-1 fix)', async () => {
      // CRITICAL-1: client configure must target /mandates-data/:id, NOT /mandates/:id (page route).
      const user = userEvent.setup();

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(MANDATE_DETAIL),
      } as Response);
      vi.stubGlobal('fetch', mockFetch);

      render(
        <MandateDetailClient
          mandateId={MANDATE_ID}
          initialDetail={MANDATE_DETAIL}
          userRole="advisor"
        />
      );

      // Open configure form
      await user.click(screen.getByRole('button', { name: /configure/i }));

      // Click save (minimal change)
      await user.click(screen.getByRole('button', { name: /^save$/i }));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          `/mandates-data/${MANDATE_ID}`,
          expect.objectContaining({
            method: 'PATCH',
            headers: expect.objectContaining({ rid: 'anti-csrf' }),
          })
        );
        // Must NOT call /mandates/:id (the page route)
        const calledUrls = mockFetch.mock.calls.map((c) => c[0] as string);
        expect(calledUrls.some((u) => u === `/mandates/${MANDATE_ID}`)).toBe(false);
      });
    });
  });
});
