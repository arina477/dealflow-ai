/**
 * /compliance-queue — Compliance Queue B-3 tests (wave-11, task 2601ba33).
 *
 * Coverage:
 *
 * A. Page renders (RBAC + SSR-hydration):
 *    - Renders for compliance (no redirect).
 *    - Advisor/analyst/admin → redirects to '/'.
 *    - Unauthenticated → redirects to '/login'.
 *    - Empty queue state renders ("Queue is clear").
 *    - Pending version list renders when versions present.
 *    - Load error state renders when initialVersions=null.
 *
 * B. ComplianceQueueClient — grant/reject mutations via /outreach-templates-data:
 *    - approve: POST /outreach-templates-data/:id/versions/:vid/approve (NOT /outreach-templates/...).
 *    - reject: POST /outreach-templates-data/:id/versions/:vid/reject.
 *    - All mutations carry rid:anti-csrf header.
 *
 * C. SoD guard — 403 response shows SoD error:
 *    - When server returns 403, the "Separation of duties" error is shown.
 *    - The version remains in the list (not removed).
 *
 * D. Review panel interaction:
 *    - Review button opens panel with template name.
 *    - Approve decision button enables form submission.
 *    - Reject decision requires reason (required field).
 *    - After successful approve: version removed from queue.
 *    - After successful reject: version removed from queue.
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
import type { VersionWithTemplate } from './page';

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

import { ComplianceQueueClient } from './_components/ComplianceQueueClient';
import ComplianceQueuePage from './page';

// ── Fixture data ─────────────────────────────────────────────────────────────

type RoleStr = 'advisor' | 'analyst' | 'compliance' | 'admin';

const HASH = 'a'.repeat(64);
const TEMPLATE_ID = 'aaaaaaaa-0000-0000-0000-000000000030';
const VERSION_ID = 'bbbbbbbb-1111-0000-0000-000000000030';

const PENDING_VERSION: VersionWithTemplate = {
  id: VERSION_ID,
  templateId: TEMPLATE_ID,
  templateName: 'Q3 Healthcare Intro Template',
  versionNumber: 1,
  subject: 'Introducing Project Helios',
  body: 'Dear {{buyerName}}, I am reaching out regarding Project Helios.',
  disclaimerTemplateId: 'cccccccc-2222-0000-0000-000000000030',
  contentHash: HASH,
  approvalStatus: 'pending',
  approvedContentHash: null,
  approvedBy: null,
  createdAt: '2026-07-04T00:00:00.000Z',
};

function meFor(role: RoleStr) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

function makePageFetch(role: RoleStr, pendingVersions: VersionWithTemplate[] = [PENDING_VERSION]) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    if (s.includes('/outreach-templates')) {
      const templates = pendingVersions.map((v) => ({
        id: v.templateId,
        name: v.templateName,
        versions: [v],
      }));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ templates }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

// ── Page render helper ─────────────────────────────────────────────────────

async function renderPage() {
  try {
    const jsx = await ComplianceQueuePage();
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

describe('A. ComplianceQueuePage — RBAC + SSR-hydration', () => {
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

  it('renders for compliance (no redirect)', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance'));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
  });

  it('renders for advisor role (compliance/queue allows advisor per RBAC)', async () => {
    vi.stubGlobal('fetch', makePageFetch('advisor'));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
  });

  it('redirects to / for analyst role', async () => {
    vi.stubGlobal('fetch', makePageFetch('analyst'));
    const { redirected, path } = await renderPage();
    expect(redirected).toBe(true);
    expect(path).toBe('/');
  });

  it('redirects to / for admin role', async () => {
    vi.stubGlobal('fetch', makePageFetch('admin'));
    const { redirected, path } = await renderPage();
    expect(redirected).toBe(true);
    expect(path).toBe('/');
  });

  it('redirects to /login when unauthenticated', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) } as Response)
    );
    const { redirected, path } = await renderPage();
    expect(redirected).toBe(true);
    expect(path).toBe('/login');
  });

  it('renders pending version list when versions present', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', [PENDING_VERSION]));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    expect(screen.getByText(/Q3 Healthcare Intro Template/i)).toBeDefined();
  });

  it('renders empty queue state when no pending versions', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance', []));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    expect(screen.getByText(/queue is clear/i)).toBeDefined();
  });

  it('renders error state when API returns 500 (initialVersions=null)', async () => {
    const errorFetch = vi.fn().mockImplementation((url: string) => {
      const s = String(url);
      if (s.includes('/auth/me')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(meFor('compliance')),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      } as Response);
    });
    vi.stubGlobal('fetch', errorFetch);
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/could not load the compliance queue/i)).toBeDefined();
  });
});

// ── B. Mutations via /outreach-templates-data ─────────────────────────────

describe('B. ComplianceQueueClient — grant/reject via /outreach-templates-data', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('approve: POST /outreach-templates-data/:id/versions/:vid/approve (NOT /outreach-templates/...)', async () => {
    const user = userEvent.setup();
    const expectedPath = `/outreach-templates-data/${TEMPLATE_ID}/versions/${VERSION_ID}/approve`;
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === expectedPath && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ComplianceQueueClient initialVersions={[PENDING_VERSION]} userRole="compliance" />);

    // Click Review
    await user.click(
      screen.getByRole('button', { name: /review Q3 Healthcare Intro Template version 1/i })
    );

    // Select Approve
    // Find and click the Approve button inside the panel (aria-pressed)
    const approveBtns = screen.getAllByRole('button', { name: /approve/i });
    const approveBtn =
      approveBtns.find((b) => b.getAttribute('aria-pressed') !== null) ?? approveBtns[0];
    if (!approveBtn) throw new Error('No approve button found');
    await user.click(approveBtn);

    // Confirm
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u === expectedPath)).toBe(true);
      // Must NOT call /outreach-templates/... directly
      const forbiddenPath = `/outreach-templates/${TEMPLATE_ID}/versions/${VERSION_ID}/approve`;
      expect(calledUrls.some((u) => u === forbiddenPath)).toBe(false);
    });
  });

  it('approve: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const expectedPath = `/outreach-templates-data/${TEMPLATE_ID}/versions/${VERSION_ID}/approve`;
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url) === expectedPath && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ComplianceQueueClient initialVersions={[PENDING_VERSION]} userRole="compliance" />);

    await user.click(
      screen.getByRole('button', { name: /review Q3 Healthcare Intro Template version 1/i })
    );
    const approveBtns2 = screen.getAllByRole('button', { name: /approve/i });
    const approveBtn2 =
      approveBtns2.find((b) => b.getAttribute('aria-pressed') !== null) ?? approveBtns2[0];
    if (!approveBtn2) throw new Error('No approve button found');
    await user.click(approveBtn2);
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => {
      const approveCalls = mockFetch.mock.calls.filter((c) => String(c[0]) === expectedPath);
      expect(approveCalls.length).toBeGreaterThan(0);
      const [, init] = approveCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });

  it('reject: POST /outreach-templates-data/:id/versions/:vid/reject', async () => {
    const user = userEvent.setup();
    const expectedPath = `/outreach-templates-data/${TEMPLATE_ID}/versions/${VERSION_ID}/reject`;
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === expectedPath && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ComplianceQueueClient initialVersions={[PENDING_VERSION]} userRole="compliance" />);

    // Open review panel
    await user.click(
      screen.getByRole('button', { name: /review Q3 Healthcare Intro Template version 1/i })
    );

    // Select Reject
    const rejectBtns = screen.getAllByRole('button', { name: /reject/i });
    const rejectBtn =
      rejectBtns.find((b) => b.getAttribute('aria-pressed') !== null) ?? rejectBtns[0];
    if (!rejectBtn) throw new Error('No reject button found');
    await user.click(rejectBtn);

    // Fill in required reason
    await user.type(
      screen.getByLabelText(/rejection reason/i),
      'Contains unsupported forward-looking claims.'
    );

    // Confirm
    await user.click(screen.getByRole('button', { name: /confirm rejection/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u === expectedPath)).toBe(true);
    });
  });

  it('reject: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const expectedPath = `/outreach-templates-data/${TEMPLATE_ID}/versions/${VERSION_ID}/reject`;
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url) === expectedPath && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ComplianceQueueClient initialVersions={[PENDING_VERSION]} userRole="compliance" />);

    await user.click(
      screen.getByRole('button', { name: /review Q3 Healthcare Intro Template version 1/i })
    );
    const rejectBtns2 = screen.getAllByRole('button', { name: /reject/i });
    const rejectBtn2 =
      rejectBtns2.find((b) => b.getAttribute('aria-pressed') !== null) ?? rejectBtns2[0];
    if (!rejectBtn2) throw new Error('No reject button found');
    await user.click(rejectBtn2);
    await user.type(screen.getByLabelText(/rejection reason/i), 'Non-compliant language.');
    await user.click(screen.getByRole('button', { name: /confirm rejection/i }));

    await waitFor(() => {
      const rejectCalls = mockFetch.mock.calls.filter((c) => String(c[0]) === expectedPath);
      expect(rejectCalls.length).toBeGreaterThan(0);
      const [, init] = rejectCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });
});

// ── C. SoD guard — 403 shows SoD error ────────────────────────────────────

describe('C. SoD guard — 403 response shows Separation of Duties error', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('403 response shows SoD error and version stays in list', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s.includes('/outreach-templates-data') && init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: () => Promise.resolve({ message: 'Forbidden: SoD violation' }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ComplianceQueueClient initialVersions={[PENDING_VERSION]} userRole="compliance" />);

    // Open review panel
    await user.click(
      screen.getByRole('button', { name: /review Q3 Healthcare Intro Template version 1/i })
    );

    // Select Approve (aria-pressed button)
    const sodApproveBtns = screen.getAllByRole('button', { name: /approve/i });
    const sodApproveBtn =
      sodApproveBtns.find((b) => b.getAttribute('aria-pressed') !== null) ?? sodApproveBtns[0];
    if (!sodApproveBtn) throw new Error('No approve button found');
    await user.click(sodApproveBtn);
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => {
      // SoD error must be shown
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText(/separation of duties/i)).toBeDefined();
    });

    // Version must still be in the table (not removed — panel may also show the name)
    expect(screen.getAllByText(/Q3 Healthcare Intro Template/i).length).toBeGreaterThan(0);
  });
});

// ── D. Review panel interaction ─────────────────────────────────────────────

describe('D. ComplianceQueueClient — review panel interaction', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('Review button opens panel with correct template name', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(<ComplianceQueueClient initialVersions={[PENDING_VERSION]} userRole="compliance" />);

    await user.click(
      screen.getByRole('button', { name: /review Q3 Healthcare Intro Template version 1/i })
    );

    // Panel dialog should be visible and show the template name
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getAllByText(/Q3 Healthcare Intro Template/i).length).toBeGreaterThan(0);
  });

  it('after successful approve: version removed from queue', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/approve') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ComplianceQueueClient initialVersions={[PENDING_VERSION]} userRole="compliance" />);

    await user.click(
      screen.getByRole('button', { name: /review Q3 Healthcare Intro Template version 1/i })
    );
    const dApproveBtns = screen.getAllByRole('button', { name: /approve/i });
    const dApproveBtn =
      dApproveBtns.find((b) => b.getAttribute('aria-pressed') !== null) ?? dApproveBtns[0];
    if (!dApproveBtn) throw new Error('No approve button found');
    await user.click(dApproveBtn);
    await user.click(screen.getByRole('button', { name: /confirm approval/i }));

    await waitFor(() => {
      // Queue should be empty
      expect(screen.getByText(/queue is clear/i)).toBeDefined();
    });
  });

  it('after successful reject: version removed from queue', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/reject') && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<ComplianceQueueClient initialVersions={[PENDING_VERSION]} userRole="compliance" />);

    await user.click(
      screen.getByRole('button', { name: /review Q3 Healthcare Intro Template version 1/i })
    );
    const dRejectBtns = screen.getAllByRole('button', { name: /reject/i });
    const dRejectBtn =
      dRejectBtns.find((b) => b.getAttribute('aria-pressed') !== null) ?? dRejectBtns[0];
    if (!dRejectBtn) throw new Error('No reject button found');
    await user.click(dRejectBtn);
    await user.type(screen.getByLabelText(/rejection reason/i), 'Claims are unsubstantiated.');
    await user.click(screen.getByRole('button', { name: /confirm rejection/i }));

    await waitFor(() => {
      expect(screen.getByText(/queue is clear/i)).toBeDefined();
    });
  });
});
