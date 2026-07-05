/**
 * /outreach-composer — Outreach Composer B-3 tests (wave-11, tasks e90a4a99 + 2601ba33).
 *
 * Coverage:
 *
 * A. Page renders (RBAC + SSR-hydration):
 *    - Renders for advisor (no redirect).
 *    - Compliance/analyst/admin → redirects to '/'.
 *    - Unauthenticated → redirects to '/login'.
 *    - Prerequisite warnings rendered when no approved versions / no candidates.
 *
 * B. OutreachComposerClient mutations via /outreach-data (NOT /outreach or /outreach-composer):
 *    - compose: POST /outreach-data (NOT /outreach).
 *    - All mutations carry rid:anti-csrf header.
 *
 * C. Gate verdict rendered (send_eligible | blocked):
 *    - send_eligible: "Send-eligible record created" shown.
 *    - blocked: "Outreach blocked" shown + block reasons listed.
 *    - Gate verdict section is visible with outreach record ID.
 *
 * D. No-Send/No-Schedule/No-AI assertion (P-4 karen MANDATORY, AC-STRIP):
 *    - "Send Immediate Campaign" NEVER appears.
 *    - "Schedule Send" NEVER appears.
 *    - "WORM storage upon send" / "upon send" NEVER appears.
 *    - "AI Drafting" / "AI-powered" / "Generate with AI" NEVER appears.
 *    - "AI Auto-Draft" NEVER appears.
 *    - The action button says "Run Compliance Gate & Create Record" (not "Send").
 *
 * E. SoD / send-eligible: gate verdict surfaced correctly.
 *    - Send-eligible: note says "no email has been sent".
 *    - Blocked: block reasons rendered.
 *
 * Strategy:
 *   - Server page component (async) awaited + rendered.
 *   - Client component rendered directly for unit tests.
 *   - next/navigation + next/headers mocked at module boundary.
 *   - e2e paths excluded.
 */

import type { Outreach } from '@dealflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComposerInitialData } from './page';

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

import { OutreachComposerClient } from './_components/OutreachComposerClient';
import OutreachComposerPage from './page';

// ── Fixture data ─────────────────────────────────────────────────────────────

type RoleStr = 'advisor' | 'analyst' | 'compliance' | 'admin';

const HASH = 'a'.repeat(64);
const MANDATE_ID = 'aaaaaaaa-0000-0000-0000-000000000020';
const CANDIDATE_ID = 'bbbbbbbb-1111-0000-0000-000000000020';
const VERSION_ID = 'cccccccc-2222-0000-0000-000000000020';
const OUTREACH_ID = 'dddddddd-3333-0000-0000-000000000020';
const DISCLAIMER_ID = 'eeeeeeee-4444-0000-0000-000000000020';

const APPROVED_VERSION = {
  id: VERSION_ID,
  templateId: 'ffffffff-5555-0000-0000-000000000020',
  templateName: 'Strategic Buyer Intro',
  versionNumber: 2,
  subject: 'Acquisition Opportunity',
  body: 'Hi {{buyerName}}, I wanted to reach out about {{dealName}}.',
  disclaimerTemplateId: DISCLAIMER_ID,
  contentHash: HASH,
  approvalStatus: 'approved' as const,
  approvedContentHash: HASH, // matches → send-eligible
  approvedBy: '11111111-0000-0000-0000-000000000020',
  createdAt: '2026-07-04T00:00:00.000Z',
};

const CANDIDATE = {
  id: CANDIDATE_ID,
  matchRunId: '22222222-0000-0000-0000-000000000020',
  buyerUniverseCandidateId: '33333333-0000-0000-0000-000000000020',
  fitScore: 88,
  disposition: 'accepted',
  createdAt: '2026-07-04T00:00:00.000Z',
};

const MANDATE = { id: MANDATE_ID, sellerName: 'Project Titan LLC' };

const DISCLAIMER = {
  id: DISCLAIMER_ID,
  jurisdiction: 'us_delaware',
  body: 'Compliance required text.',
};

const INITIAL_DATA: ComposerInitialData = {
  approvedVersions: [APPROVED_VERSION],
  acceptedCandidates: [CANDIDATE],
  disclaimers: [DISCLAIMER],
  mandates: [MANDATE],
};

const EMPTY_INITIAL_DATA: ComposerInitialData = {
  approvedVersions: [],
  acceptedCandidates: [],
  disclaimers: [],
  mandates: [],
};

const SEND_ELIGIBLE_OUTREACH: Outreach = {
  id: OUTREACH_ID,
  mandateId: MANDATE_ID,
  matchCandidateId: CANDIDATE_ID,
  templateVersionId: VERSION_ID,
  gateVerdict: {
    allowed: true,
    blocks: [],
    requiredDisclaimers: ['us_delaware'],
  },
  status: 'send_eligible',
  createdBy: '44444444-0000-0000-0000-000000000020',
  createdAt: '2026-07-04T00:00:00.000Z',
};

const BLOCKED_OUTREACH: Outreach = {
  ...SEND_ELIGIBLE_OUTREACH,
  id: '55555555-6666-0000-0000-000000000020',
  gateVerdict: {
    allowed: false,
    blocks: [
      {
        rule: 'suppression-list',
        reason: 'Recipient buyer@blocked.com is on the firm suppression list.',
      },
    ],
    requiredDisclaimers: [],
  },
  status: 'blocked',
};

function meFor(role: RoleStr) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

function makePageFetch(role: RoleStr) {
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
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            templates: [
              {
                id: APPROVED_VERSION.templateId,
                name: 'Strategic Buyer Intro',
                versions: [APPROVED_VERSION],
              },
            ],
          }),
      } as Response);
    }
    if (s.includes('/compliance/disclaimers')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([DISCLAIMER]),
      } as Response);
    }
    if (s.includes('/mandates')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ mandates: [MANDATE] }),
      } as Response);
    }
    if (s.includes('/matches')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ runs: [] }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

// ── Page render helper ─────────────────────────────────────────────────────

async function renderPage() {
  try {
    const jsx = await OutreachComposerPage();
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

describe('A. OutreachComposerPage — RBAC + SSR-hydration', () => {
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

  it('renders for compliance role (/outreach allows compliance per RBAC — compose action advisor-only server-side)', async () => {
    vi.stubGlobal('fetch', makePageFetch('compliance'));
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
});

// ── B. Mutations via /outreach-data ───────────────────────────────────────

describe('B. OutreachComposerClient — mutations use /outreach-data (NOT /outreach)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('compose: POST /outreach-data (NOT /outreach)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      const s = String(url);
      if (s === '/outreach-data' && (init?.method ?? 'GET') === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(SEND_ELIGIBLE_OUTREACH),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${s} ${init?.method ?? 'GET'}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />);

    // Fill recipient
    await user.type(screen.getByLabelText(/recipient email/i), 'buyer@fund.com');

    // Submit compose
    await user.click(screen.getByRole('button', { name: /run compliance gate & create record/i }));

    await waitFor(() => {
      const calledUrls = mockFetch.mock.calls.map((c) => String(c[0]));
      // Must call /outreach-data (proxy)
      expect(calledUrls.some((u) => u === '/outreach-data')).toBe(true);
      // Must NOT call /outreach (page route)
      expect(calledUrls.some((u) => u === '/outreach')).toBe(false);
    });
  });

  it('compose: carries rid:anti-csrf header', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url) === '/outreach-data') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(SEND_ELIGIBLE_OUTREACH),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />);

    await user.type(screen.getByLabelText(/recipient email/i), 'buyer@fund.com');
    await user.click(screen.getByRole('button', { name: /run compliance gate & create record/i }));

    await waitFor(() => {
      const composeCalls = mockFetch.mock.calls.filter((c) => String(c[0]) === '/outreach-data');
      expect(composeCalls.length).toBeGreaterThan(0);
      const [, init] = composeCalls[0] as [string, RequestInit];
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.rid).toBe('anti-csrf');
    });
  });
});

// ── C. Gate verdict rendered ──────────────────────────────────────────────

describe('C. OutreachComposerClient — gate verdict rendered (send_eligible | blocked)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('send_eligible: shows "Send-eligible record created" and record ID', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url) === '/outreach-data') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(SEND_ELIGIBLE_OUTREACH),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />);

    await user.type(screen.getByLabelText(/recipient email/i), 'buyer@fund.com');
    await user.click(screen.getByRole('button', { name: /run compliance gate & create record/i }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /gate verdict/i })).toBeDefined();
      expect(screen.getByText(/send-eligible record created/i)).toBeDefined();
      // Record ID shown
      expect(screen.getByText(OUTREACH_ID)).toBeDefined();
    });
  });

  it('blocked: shows "Outreach blocked" and block reason', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url) === '/outreach-data') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(BLOCKED_OUTREACH),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />);

    await user.type(screen.getByLabelText(/recipient email/i), 'buyer@blocked.com');
    await user.click(screen.getByRole('button', { name: /run compliance gate & create record/i }));

    await waitFor(() => {
      expect(screen.getByText(/outreach blocked/i)).toBeDefined();
      expect(screen.getByText(/suppression-list/i)).toBeDefined();
      expect(screen.getByText(/firm suppression list/i)).toBeDefined();
    });
  });

  it('send_eligible: note says "no email has been sent"', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url) === '/outreach-data') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(SEND_ELIGIBLE_OUTREACH),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected: ${String(url)}`));
    });
    vi.stubGlobal('fetch', mockFetch);

    render(<OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />);

    await user.type(screen.getByLabelText(/recipient email/i), 'buyer@fund.com');
    await user.click(screen.getByRole('button', { name: /run compliance gate & create record/i }));

    await waitFor(() => {
      const note = screen.getByRole('note', { name: /send-eligible notice/i });
      expect(note).toBeDefined();
      expect(note.textContent?.toLowerCase()).toContain('no email has been sent');
    });
  });
});

// ── D. No-Send/No-Schedule/No-AI assertion (AC-STRIP) ─────────────────────

describe('D. AC-STRIP — ZERO forbidden send/schedule/AI-capability strings', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rendered OutreachComposerClient (empty state) has ZERO forbidden strings', () => {
    vi.stubGlobal('fetch', vi.fn());

    const { container } = render(
      <OutreachComposerClient initialData={EMPTY_INITIAL_DATA} userRole="advisor" />
    );

    const html = container.innerHTML.toLowerCase();

    // ── Forbidden send-capability strings ──
    expect(html).not.toContain('send immediate campaign');
    expect(html).not.toContain('schedule send');
    // WORM-on-send
    expect(html).not.toContain('worm storage upon send');
    expect(html).not.toContain('upon send');
    // ── Forbidden AI-capability strings ──
    expect(html).not.toContain('ai drafting');
    expect(html).not.toContain('ai drafting in progress');
    expect(html).not.toContain('ai auto-draft');
    expect(html).not.toContain('ai-powered');
    expect(html).not.toContain('generate with ai');
    expect(html).not.toContain('generated by ai');
    // "generated" as a capability ("generated by the model", "ai-generated")
    expect(html).not.toContain('ai-generated');
  });

  it('rendered OutreachComposerClient (with data) has ZERO forbidden strings', () => {
    vi.stubGlobal('fetch', vi.fn());

    const { container } = render(
      <OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />
    );

    const html = container.innerHTML.toLowerCase();

    expect(html).not.toContain('send immediate campaign');
    expect(html).not.toContain('schedule send');
    expect(html).not.toContain('worm storage upon send');
    expect(html).not.toContain('upon send');
    expect(html).not.toContain('ai drafting');
    expect(html).not.toContain('ai-powered');
    expect(html).not.toContain('generate with ai');
    expect(html).not.toContain('ai auto-draft');
    expect(html).not.toContain('ai-generated');
  });

  it('compose button says "Run Compliance Gate & Create Record" (NOT "Send")', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(<OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />);

    // The action button must NOT say "Send"
    const submitBtn = screen.getByRole('button', {
      name: /run compliance gate & create record/i,
    });
    expect(submitBtn).toBeDefined();
    expect(submitBtn.textContent?.toLowerCase()).not.toContain('send immediate');
    expect(submitBtn.textContent?.toLowerCase()).not.toContain('schedule');
  });

  it('prerequisite note says "Email delivery is a separate step" (not "send")', () => {
    vi.stubGlobal('fetch', vi.fn());

    const { container } = render(
      <OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />
    );

    // The note under the submit button
    const html = container.innerHTML.toLowerCase();
    expect(html).toContain('email delivery is available in a later step');
    // Must NOT say "you will send" or "sends the email"
    expect(html).not.toContain('sends the email');
    expect(html).not.toContain('you will send');
  });

  it('gate verdict send_eligible note has ZERO forbidden send strings', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url) === '/outreach-data') {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () => Promise.resolve(SEND_ELIGIBLE_OUTREACH),
        } as Response);
      }
      return Promise.reject(new Error(`Unexpected`));
    });
    vi.stubGlobal('fetch', mockFetch);

    const { container } = render(
      <OutreachComposerClient initialData={INITIAL_DATA} userRole="advisor" />
    );

    await user.type(screen.getByLabelText(/recipient email/i), 'buyer@fund.com');
    await user.click(screen.getByRole('button', { name: /run compliance gate & create record/i }));

    await waitFor(() => {
      const html = container.innerHTML.toLowerCase();
      // Send-eligible verdict present
      expect(html).toContain('send-eligible record created');
      // Still no forbidden send affordances in the verdict display
      expect(html).not.toContain('send immediate campaign');
      expect(html).not.toContain('schedule send');
      expect(html).not.toContain('worm storage upon send');
      expect(html).not.toContain('ai drafting');
      expect(html).not.toContain('ai-powered');
    });
  });
});

// ── E. Prerequisites warning ──────────────────────────────────────────────

describe('E. Prerequisites — warnings shown when missing', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows prerequisite warning when no approved versions', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(<OutreachComposerClient initialData={EMPTY_INITIAL_DATA} userRole="advisor" />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/no approved template versions available/i)).toBeDefined();
  });

  it('shows prerequisite warning when no accepted candidates', () => {
    vi.stubGlobal('fetch', vi.fn());

    const noCandidate: ComposerInitialData = {
      ...INITIAL_DATA,
      acceptedCandidates: [],
    };

    render(<OutreachComposerClient initialData={noCandidate} userRole="advisor" />);

    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/no accepted match candidates found/i)).toBeDefined();
  });

  it('compose button is disabled when prerequisites missing', () => {
    vi.stubGlobal('fetch', vi.fn());

    render(<OutreachComposerClient initialData={EMPTY_INITIAL_DATA} userRole="advisor" />);

    const btn = screen.getByRole('button', { name: /run compliance gate & create record/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });
});
