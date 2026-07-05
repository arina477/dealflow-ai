/**
 * /outreach-templates — Templates Library B-3 tests (wave-11, task 102a2f00).
 *
 * Coverage:
 *
 * A. Page renders (RBAC + SSR-hydration):
 *    - Renders for advisor/analyst/compliance (no redirect).
 *    - Admin → redirects to '/'.
 *    - Unauthenticated → redirects to '/login'.
 *    - Empty list state renders ("No templates yet").
 *    - Template list renders when templates present.
 *    - Load error state renders when initialTemplates=null.
 *
 * B. TemplatesLibraryClient mutations via /outreach-templates-data (NOT /outreach-templates):
 *    - create: POST /outreach-templates-data (NOT /outreach-templates).
 *    - draftNewVersion: POST /outreach-templates-data/:id/versions.
 *    - requestApproval: POST /outreach-templates-data/:id/versions/:vid/request-approval.
 *    - All mutations carry rid:anti-csrf header.
 *
 * C. RBAC guards:
 *    - Compliance role sees no "New Template" button (read-only).
 *    - Advisor/analyst see "New Template" button.
 *
 * D. No-AI-drafting assertion (P-4 karen MANDATORY + CODE-OF-CONDUCT provenance AC-STRIP):
 *    - Rendered component NEVER contains:
 *      "Generate with AI", "AI Drafting", "AI-powered", "ai drafting in progress",
 *      "ai auto-draft", "sparkles" (as AI-action label).
 *    - Drafting is manual — textarea for body present (no AI button).
 *
 * E. Version-binding / send-eligible badge:
 *    - Approved version with matching approved_content_hash shows "Send-eligible".
 *    - Pending version does NOT show "Send-eligible".
 *
 * Strategy:
 *   - Server page component (async) awaited + rendered.
 *   - Client component rendered directly for unit tests.
 *   - next/navigation + next/headers mocked at module boundary.
 *   - AppShell excluded (inherited from (app)/layout).
 *   - e2e paths excluded.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TemplateWithVersions } from './page';

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

import { TemplatesLibraryClient } from './_components/TemplatesLibraryClient';
import TemplatesLibraryPage from './page';

// ── Fixture data ─────────────────────────────────────────────────────────────

type RoleStr = 'advisor' | 'analyst' | 'compliance' | 'admin';

const TEMPLATE_ID = 'aaaaaaaa-0000-0000-0000-000000000011';
const VERSION_ID = 'bbbbbbbb-1111-0000-0000-000000000011';
const DISCLAIMER_ID = 'cccccccc-2222-0000-0000-000000000011';
const HASH = 'a'.repeat(64);

const PENDING_VERSION = {
  id: VERSION_ID,
  templateId: TEMPLATE_ID,
  versionNumber: 1,
  subject: 'Strategic Buyer Introduction',
  body: 'Hi {{buyerName}}, I wanted to introduce Project {{dealName}}.',
  disclaimerTemplateId: DISCLAIMER_ID,
  contentHash: HASH,
  approvalStatus: 'pending' as const,
  approvedContentHash: null,
  approvedBy: null,
  createdAt: '2026-07-04T00:00:00.000Z',
};

const APPROVED_VERSION = {
  ...PENDING_VERSION,
  id: 'dddddddd-3333-0000-0000-000000000011',
  versionNumber: 2,
  approvalStatus: 'approved' as const,
  approvedContentHash: HASH, // matches contentHash → send-eligible
  approvedBy: 'eeeeeeee-4444-0000-0000-000000000011',
};

const TEMPLATE: TemplateWithVersions = {
  id: TEMPLATE_ID,
  name: 'Strategic Buyer Intro',
  mandateScope: null,
  ownerId: 'ffffffff-5555-0000-0000-000000000011',
  createdAt: '2026-07-04T00:00:00.000Z',
  updatedAt: null,
  versions: [PENDING_VERSION, APPROVED_VERSION],
};

const DISCLAIMER = {
  id: DISCLAIMER_ID,
  jurisdiction: 'us_delaware',
  body: 'Required compliance block text.',
};

function meFor(role: RoleStr) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

function makePageFetch(role: RoleStr, templates: TemplateWithVersions[] | null = [TEMPLATE]) {
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
      if (templates === null) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({}),
        } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ templates }),
      } as Response);
    }
    if (s.includes('/compliance/disclaimers')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([DISCLAIMER]),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

// ── Page render helper ─────────────────────────────────────────────────────

async function renderPage() {
  try {
    const jsx = await TemplatesLibraryPage();
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

describe('A. TemplatesLibraryPage — RBAC + SSR-hydration', () => {
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

  it('renders for advisor (no redirect)', async () => {
    vi.stubGlobal('fetch', makePageFetch('advisor'));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
  });

  it('renders for analyst (no redirect)', async () => {
    vi.stubGlobal('fetch', makePageFetch('analyst'));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
  });

  it('renders for compliance (no redirect)', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance'));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
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

  it('renders template list when templates present', async () => {
    vi.stubGlobal('fetch', makePageFetch('advisor', [TEMPLATE]));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    expect(screen.getByRole('table', { name: /outreach templates/i })).toBeDefined();
    expect(screen.getByText(/Strategic Buyer Intro/i)).toBeDefined();
  });

  it('renders empty state when no templates', async () => {
    vi.stubGlobal('fetch', makePageFetch('advisor', []));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    expect(screen.getByText(/no templates yet/i)).toBeDefined();
  });

  it('renders error state when API returns 500 (initialTemplates=null)', async () => {
    vi.stubGlobal('fetch', makePageFetch('advisor', null));
    const { redirected } = await renderPage();
    expect(redirected).toBe(false);
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/could not load templates/i)).toBeDefined();
  });
});

// ── B. Mutations via /outreach-templates-data ──────────────────────────────

describe('B. TemplatesLibraryClient — mutations use /outreach-templates-data (NOT /outreach-templates)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('create: POST /outreach-templates-data (NOT /outreach-templates)', async () => {
    const user = userEvent.setup();
    const newTemplate: TemplateWithVersions = {
      ...TEMPLATE,
      id: 'new-id-1111-0000-0000-000000000011',
      name: 'New Template',
      versions: [],
    };
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === '/outreach-templates-data' && (init?.method ?? 'GET') === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(newTemplate),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <TemplatesLibraryClient
        initialTemplates={[]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    // Click "Create First Template" (empty state CTA)
    await user.click(screen.getByRole('button', { name: /create first template/i }));

    // Fill in the form
    await user.type(screen.getByLabelText(/template name/i), 'New Template');
    await user.type(screen.getByLabelText(/subject line/i), 'Test Subject');
    await user.type(screen.getByLabelText(/body/i), 'Test body content for the template.');

    // Submit
    await user.click(screen.getByRole('button', { name: /create template/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      // Must call /outreach-templates-data (proxy)
      expect(calledUrls.some((u) => u === '/outreach-templates-data')).toBe(true);
      // Must NOT call /outreach-templates directly
      expect(calledUrls.some((u) => u === '/outreach-templates')).toBe(false);
    });
  });

  it('create: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const newTemplate: TemplateWithVersions = { ...TEMPLATE, id: 'new-id-csrf', versions: [] };
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url) === '/outreach-templates-data') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(newTemplate),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <TemplatesLibraryClient
        initialTemplates={[]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    await user.click(screen.getByRole('button', { name: /create first template/i }));
    await user.type(screen.getByLabelText(/template name/i), 'CSRF Test');
    await user.type(screen.getByLabelText(/subject line/i), 'Subject');
    await user.type(screen.getByLabelText(/body/i), 'Body content.');
    await user.click(screen.getByRole('button', { name: /create template/i }));

    await waitFor(() => {
      const createCalls = mockFetch.mock.calls.filter(
        (c) => String(c[0]) === '/outreach-templates-data'
      );
      expect(createCalls.length).toBeGreaterThan(0);
      const [, init] = createCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });

  it('draftNewVersion: POST /outreach-templates-data/:id/versions (NOT /outreach-templates/:id/versions)', async () => {
    const user = userEvent.setup();
    const updatedTemplate: TemplateWithVersions = {
      ...TEMPLATE,
      versions: [
        PENDING_VERSION,
        APPROVED_VERSION,
        { ...PENDING_VERSION, id: 'vv-new', versionNumber: 3 },
      ],
    };
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      const expectedPath = `/outreach-templates-data/${TEMPLATE_ID}/versions`;
      if (s === expectedPath && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve({}),
        } as Response);
      }
      // Re-fetch after draft
      if (s === `/outreach-templates-data/${TEMPLATE_ID}` && (init?.method ?? 'GET') === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(updatedTemplate),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <TemplatesLibraryClient
        initialTemplates={[TEMPLATE]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    // Open version history
    await user.click(
      screen.getByRole('button', { name: /view version history for strategic buyer intro/i })
    );

    // Click "Draft New Version"
    await user.click(screen.getByRole('button', { name: /draft new version/i }));

    // Fill in the new version form
    await user.type(screen.getByLabelText(/^subject \*/i), 'New subject line');
    await user.type(
      screen.getByLabelText(/^body \* \(manual drafting\)/i),
      'New body content for version.'
    );

    // Submit
    await user.click(screen.getByRole('button', { name: /save draft version/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      const expectedPath = `/outreach-templates-data/${TEMPLATE_ID}/versions`;
      expect(calledUrls.some((u) => u === expectedPath)).toBe(true);
      // Must NOT call the bare /outreach-templates/:id/versions (page route conflict)
      expect(calledUrls.some((u) => u === `/outreach-templates/${TEMPLATE_ID}/versions`)).toBe(
        false
      );
    });
  });

  it('requestApproval: POST /outreach-templates-data/:id/versions/:vid/request-approval', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      const expectedPath = `/outreach-templates-data/${TEMPLATE_ID}/versions/${VERSION_ID}/request-approval`;
      if (s === expectedPath && init?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({}),
        } as Response);
      }
      // Re-fetch
      if (s === `/outreach-templates-data/${TEMPLATE_ID}` && (init?.method ?? 'GET') === 'GET') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ...TEMPLATE, versions: [{ ...PENDING_VERSION }] }),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(
      <TemplatesLibraryClient
        initialTemplates={[TEMPLATE]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    // Open version history
    await user.click(
      screen.getByRole('button', { name: /view version history for strategic buyer intro/i })
    );

    // Click "Request Approval" for version 1 (pending)
    await user.click(screen.getByRole('button', { name: /request approval for version 1/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      const expectedPath = `/outreach-templates-data/${TEMPLATE_ID}/versions/${VERSION_ID}/request-approval`;
      expect(calledUrls.some((u) => u === expectedPath)).toBe(true);
    });
  });
});

// ── C. RBAC guards ───────────────────────────────────────────────────────────

describe('C. TemplatesLibraryClient — RBAC guards', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('compliance role sees no "New Template" button (read-only)', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <TemplatesLibraryClient
        initialTemplates={[TEMPLATE]}
        disclaimers={[DISCLAIMER]}
        userRole="compliance"
        userId="u-compliance"
      />
    );

    expect(screen.queryByRole('button', { name: /new template/i })).toBeNull();
  });

  it('advisor sees "New Template" button', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <TemplatesLibraryClient
        initialTemplates={[TEMPLATE]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    expect(screen.getByRole('button', { name: /new template/i })).toBeDefined();
  });

  it('analyst sees "New Template" button', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(
      <TemplatesLibraryClient
        initialTemplates={[TEMPLATE]}
        disclaimers={[DISCLAIMER]}
        userRole="analyst"
        userId="u-analyst"
      />
    );

    expect(screen.getByRole('button', { name: /new template/i })).toBeDefined();
  });
});

// ── D. No-AI-drafting assertion (P-4 karen MANDATORY, AC-STRIP) ─────────────

describe('D. No-AI-drafting — ZERO forbidden AI-capability strings (AC-STRIP)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rendered TemplatesLibraryClient has ZERO AI-drafting strings', () => {
    vi.stubGlobal('fetch', vi.fn());

    const { container } = render(
      <TemplatesLibraryClient
        initialTemplates={[TEMPLATE]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    const html = container.innerHTML.toLowerCase();

    // Forbidden strings (AC-STRIP)
    expect(html).not.toContain('generate with ai');
    expect(html).not.toContain('ai drafting');
    expect(html).not.toContain('ai drafting in progress');
    expect(html).not.toContain('ai auto-draft');
    expect(html).not.toContain('ai-powered');
    expect(html).not.toContain('generated by ai');
    // "sparkles" as an AI action button label
    expect(html).not.toContain('sparkles');
  });

  it('new template form has a manual body textarea (NOT an AI-generate button)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(
      <TemplatesLibraryClient
        initialTemplates={[]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    await user.click(screen.getByRole('button', { name: /create first template/i }));

    // Body textarea must exist (manual drafting)
    expect(screen.getByRole('textbox', { name: /body/i })).toBeDefined();

    // No AI-generate button
    const buttons = screen.getAllByRole('button');
    const aiButton = buttons.find(
      (btn) =>
        btn.textContent?.toLowerCase().includes('generate with ai') ||
        btn.textContent?.toLowerCase().includes('ai draft')
    );
    expect(aiButton).toBeUndefined();
  });
});

// ── E. Version-binding / send-eligible badge ────────────────────────────────

describe('E. Version-binding — send-eligible badge logic', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('approved version with matching approved_content_hash shows "Send-eligible"', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    render(
      <TemplatesLibraryClient
        initialTemplates={[TEMPLATE]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    // The template list row should show "Has send-eligible version" (approved version 2)
    expect(screen.getByText(/has send-eligible version/i)).toBeDefined();

    // Open version history to see individual version badges
    await user.click(
      screen.getByRole('button', { name: /view version history for strategic buyer intro/i })
    );

    // Version 2 (approved, version-binding holds) should show send-eligible badge
    expect(screen.getByText(/send-eligible/i)).toBeDefined();
  });

  it('pending version does NOT show "Send-eligible" badge', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn());

    const onlyPending: TemplateWithVersions = {
      ...TEMPLATE,
      versions: [PENDING_VERSION], // no approved version
    };

    render(
      <TemplatesLibraryClient
        initialTemplates={[onlyPending]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    // No "Has send-eligible version" badge
    expect(screen.queryByText(/has send-eligible version/i)).toBeNull();

    // Open version history
    await user.click(
      screen.getByRole('button', { name: /view version history for strategic buyer intro/i })
    );

    // No send-eligible badge for the pending version
    expect(screen.queryByText(/send-eligible/i)).toBeNull();
  });

  it('approved version with mismatched approved_content_hash does NOT show "Send-eligible"', async () => {
    vi.stubGlobal('fetch', vi.fn());

    const mismatchedVersion = {
      ...APPROVED_VERSION,
      approvedContentHash: 'b'.repeat(64), // different from contentHash ('a'.repeat(64))
    };
    const template: TemplateWithVersions = {
      ...TEMPLATE,
      versions: [mismatchedVersion],
    };

    render(
      <TemplatesLibraryClient
        initialTemplates={[template]}
        disclaimers={[DISCLAIMER]}
        userRole="advisor"
        userId="u-advisor"
      />
    );

    // No "Has send-eligible version" (version-binding not satisfied)
    expect(screen.queryByText(/has send-eligible version/i)).toBeNull();
  });
});
