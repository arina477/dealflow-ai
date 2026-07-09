/**
 * /pipeline — Pipeline board B-3 tests (wave-12, tasks d1940142 + 45b259e1).
 *
 * Coverage:
 *
 * A. Board structure:
 *    - Renders all 7 fixed stage columns in canonical order:
 *      shortlisted → contacted → engaged → diligence → offer → closed → withdrawn
 *    - Deal appears in the correct stage column.
 *    - Empty state renders all 7 columns (no crash).
 *
 * B. RBAC + SSR-hydration:
 *    - Renders for advisor (no redirect).
 *    - Renders for compliance (no redirect).
 *    - analyst → redirects to '/'.
 *    - admin → redirects to '/'.
 *    - Unauthenticated → redirects to '/login'.
 *
 * C. Stage move (advisor):
 *    - Stage-select control present for advisor.
 *    - Move → PATCH /pipeline-data/:id/stage (NOT /pipeline/:id/stage page route).
 *    - PATCH request carries rid:anti-csrf header.
 *    - Stage-select control absent for compliance (read-only).
 *
 * D. Timeline panel:
 *    - Timeline renders enrolled + stage_changed + note events with actor + timestamp.
 *    - Add-note → POST /pipeline-data/:id/notes (NOT /pipeline/:id/notes page route).
 *    - POST request carries rid:anti-csrf header.
 *    - Empty timeline (0 events, no crash).
 *
 * E. Absent affordances (P-4 karen flag — HARD BOUNDARY):
 *    - NO "Send" text (no send/email affordance).
 *    - NO "AI" text (no AI/drafting affordance).
 *    - NO "Schedule" text.
 *    - NO "Draft" text (AI framing).
 *
 * Strategy:
 *   - Server page component (async) awaited + rendered.
 *   - Client components rendered directly.
 *   - next/navigation + next/headers mocked at module boundary.
 *   - AppShell excluded (inherited from (app)/layout).
 *   - e2e paths excluded.
 */

import type { PipelineEvent } from '@dealflow/shared';
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

import { DealTimelinePanel } from './_components/DealTimelinePanel';
import { PipelineBoardClient } from './_components/PipelineBoardClient';
import type { NormalisedBoard, PipelineRowWithJoins } from './_lib/pipeline-types';
import { PIPELINE_STAGES } from './_lib/pipeline-types';
import PipelinePage from './page';

// ── Fixture data ──────────────────────────────────────────────────────────

type RoleStr = 'advisor' | 'analyst' | 'compliance' | 'admin';

const NOW_ISO = '2026-07-05T10:00:00.000Z';
const MANDATE_ID = 'aaaaaaaa-0000-0000-0000-000000000012';
const PIPELINE_ID = 'bbbbbbbb-1111-0000-0000-000000000012';
const OUTREACH_ID = 'cccccccc-2222-0000-0000-000000000012';
const ACTOR_ID = 'dddddddd-3333-0000-0000-000000000012';
const EVENT_ID_1 = 'eeeeeeee-4444-0000-0000-000000000012';
const EVENT_ID_2 = 'eeeeeeee-4444-0000-0000-000000000013';
const EVENT_ID_3 = 'eeeeeeee-4444-0000-0000-000000000014';

function meFor(role: RoleStr) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const DEAL_IN_CONTACTED: PipelineRowWithJoins = {
  id: PIPELINE_ID,
  mandateId: MANDATE_ID,
  dealSourceType: 'outreach',
  outreachId: OUTREACH_ID,
  matchCandidateId: null,
  stage: 'contacted',
  createdBy: ACTOR_ID,
  updatedBy: null,
  createdAt: NOW_ISO,
  updatedAt: null,
  mandateName: 'Project Apex',
  buyerName: 'Vista Equity Partners',
  buyerFirm: 'Vista Equity',
};

/** A board with one deal in 'contacted' stage; all other stages empty. */
function makeBoard(deal?: PipelineRowWithJoins): NormalisedBoard {
  const empty = Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, [] as PipelineRowWithJoins[]])
  ) as NormalisedBoard['byStage'];
  if (!deal) return { byStage: empty };
  return {
    byStage: {
      ...empty,
      [deal.stage]: [deal],
    } as NormalisedBoard['byStage'],
  };
}

const ENROLLED_EVENT: PipelineEvent = {
  id: EVENT_ID_1,
  pipelineId: PIPELINE_ID,
  eventType: 'enrolled',
  fromStage: null,
  toStage: 'shortlisted',
  note: null,
  actorId: ACTOR_ID,
  createdAt: NOW_ISO,
};

const STAGE_CHANGED_EVENT: PipelineEvent = {
  id: EVENT_ID_2,
  pipelineId: PIPELINE_ID,
  eventType: 'stage_changed',
  fromStage: 'shortlisted',
  toStage: 'contacted',
  note: null,
  actorId: ACTOR_ID,
  createdAt: NOW_ISO,
};

const NOTE_EVENT: PipelineEvent = {
  id: EVENT_ID_3,
  pipelineId: PIPELINE_ID,
  eventType: 'note',
  fromStage: null,
  toStage: null,
  note: 'Preliminary call scheduled',
  actorId: ACTOR_ID,
  createdAt: NOW_ISO,
};

// ── Page fetch factory ──────────────────────────────────────────────────────

function makePageFetch(role: RoleStr, boardDeals?: PipelineRowWithJoins) {
  return vi.fn().mockImplementation((url: string) => {
    const s = String(url);
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    if (s.includes('/pipeline')) {
      const byStage = boardDeals
        ? Object.fromEntries(
            PIPELINE_STAGES.map((st) => [st, st === boardDeals.stage ? [boardDeals] : []])
          )
        : Object.fromEntries(PIPELINE_STAGES.map((st) => [st, []]));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ byStage }),
      } as Response);
    }
    return Promise.reject(new Error(`Unexpected fetch: ${s}`));
  });
}

// ── Page render helper ─────────────────────────────────────────────────────

/**
 * Render PipelinePage. Stubs fetch with `makePageFetch(role, deal)` unless
 * `fetchAlreadyStubbed` is true (caller has already set up vi.stubGlobal).
 */
async function renderPage(role: RoleStr, deal?: PipelineRowWithJoins, fetchAlreadyStubbed = false) {
  if (!fetchAlreadyStubbed) {
    vi.stubGlobal('fetch', makePageFetch(role, deal));
  }
  const searchParams = Promise.resolve({});
  try {
    const jsx = await PipelinePage({ searchParams });
    if (jsx) render(jsx);
    return { redirected: false, path: null as string | null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── A. Board structure ─────────────────────────────────────────────────────

describe('A. Board — 7 fixed stage columns', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('PIPELINE_STAGES exports exactly 7 stages in canonical order', () => {
    expect(PIPELINE_STAGES).toHaveLength(7);
    expect(PIPELINE_STAGES).toEqual([
      'shortlisted',
      'contacted',
      'engaged',
      'diligence',
      'offer',
      'closed',
      'withdrawn',
    ]);
  });

  it('renders all 7 stage columns when board is empty', () => {
    const board = makeBoard();
    render(<PipelineBoardClient initialBoard={board} userRole="advisor" />);
    for (const stage of PIPELINE_STAGES) {
      // aria-label on column container
      expect(
        screen.getByRole('region', { hidden: true, name: new RegExp(stage, 'i') })
      ).toBeDefined();
    }
  });

  it('renders all 7 stage columns (accessible label)', () => {
    const board = makeBoard();
    render(<PipelineBoardClient initialBoard={board} userRole="advisor" />);
    // Column labels (human-readable)
    const expectedLabels = [
      'Shortlisted',
      'Contacted',
      'Engaged',
      'Diligence',
      'Offer',
      'Closed',
      'Withdrawn',
    ];
    for (const label of expectedLabels) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it('renders deal in the correct stage column (contacted)', () => {
    const board = makeBoard(DEAL_IN_CONTACTED);
    render(<PipelineBoardClient initialBoard={board} userRole="advisor" />);
    expect(screen.getByText('Vista Equity Partners')).toBeDefined();
  });

  it('empty state — all 7 columns render without crashing', () => {
    const board = makeBoard();
    // No error thrown
    expect(() =>
      render(<PipelineBoardClient initialBoard={board} userRole="advisor" />)
    ).not.toThrow();
  });
});

// ── B. RBAC + SSR ──────────────────────────────────────────────────────────

describe('B. PipelinePage — RBAC + SSR-hydration', () => {
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
    const { redirected } = await renderPage('advisor');
    expect(redirected).toBe(false);
  });

  it('renders for compliance (no redirect)', async () => {
    const { redirected } = await renderPage('compliance');
    expect(redirected).toBe(false);
  });

  it('redirects to / for analyst role', async () => {
    vi.stubGlobal('fetch', makePageFetch('analyst'));
    // fetchMe returns analyst, assertRole('/pipeline', 'analyst') → redirect('/')
    mockCookies.mockResolvedValue({ toString: () => 'st-access-token=test' });
    const { redirected, path } = await renderPage('analyst');
    expect(redirected).toBe(true);
    expect(path).toBe('/');
  });

  it('renders for admin role (read-only oversight; wave-36)', async () => {
    vi.stubGlobal('fetch', makePageFetch('admin'));
    const { redirected } = await renderPage('admin');
    expect(redirected).toBe(false);
  });

  it('redirects to /login when unauthenticated (fetchMe returns null)', async () => {
    // Stub fetch BEFORE calling renderPage, then pass fetchAlreadyStubbed=true
    // to prevent renderPage from overwriting our stub with makePageFetch.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
    );
    const { redirected, path } = await renderPage('advisor', undefined, true);
    expect(redirected).toBe(true);
    expect(path).toBe('/login');
  });
});

// ── C. Stage move ──────────────────────────────────────────────────────────

describe('C. Stage move — advisor PATCH /pipeline-data/:id/stage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('stage-select control present for advisor', () => {
    const board = makeBoard(DEAL_IN_CONTACTED);
    render(<PipelineBoardClient initialBoard={board} userRole="advisor" />);
    expect(screen.getByRole('combobox', { name: /move to stage/i })).toBeDefined();
  });

  it('stage-select control NOT present for compliance (read-only)', () => {
    const board = makeBoard(DEAL_IN_CONTACTED);
    render(<PipelineBoardClient initialBoard={board} userRole="compliance" />);
    expect(screen.queryByRole('combobox', { name: /move to stage/i })).toBeNull();
  });

  it('PATCH hits /pipeline-data/:id/stage (NOT page route) with rid:anti-csrf', async () => {
    const user = userEvent.setup();
    const board = makeBoard(DEAL_IN_CONTACTED);
    render(<PipelineBoardClient initialBoard={board} userRole="advisor" />);

    // Mock the apiFetch response
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: PIPELINE_ID, stage: 'engaged' }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const select = screen.getByRole('combobox', { name: /move to stage/i });
    await user.selectOptions(select, 'engaged');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(calledUrl).toContain(`/pipeline-data/${PIPELINE_ID}/stage`);
    expect(calledUrl).not.toContain('/pipeline/');
    expect(calledInit.method).toBe('PATCH');
    expect(calledInit.headers.rid).toBe('anti-csrf');
  });
});

// ── D. Timeline panel ──────────────────────────────────────────────────────

describe('D. Timeline panel — enrolled + stage_changed + note events', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders enrolled + stage_changed + note events with actor + timestamp', async () => {
    const eventsResponse = {
      events: [ENROLLED_EVENT, STAGE_CHANGED_EVENT, NOTE_EVENT],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(eventsResponse),
      } as Response)
    );

    render(<DealTimelinePanel deal={DEAL_IN_CONTACTED} userRole="advisor" onClose={vi.fn()} />);

    await waitFor(() => {
      // Event type labels — "Enrolled" appears both in deal meta (field label)
      // and as the event badge, so use getAllByText (at least one occurrence).
      expect(screen.getAllByText('Enrolled').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Stage Changed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Note').length).toBeGreaterThanOrEqual(1);
      // Note text
      expect(screen.getByText('Preliminary call scheduled')).toBeDefined();
    });
  });

  it('renders actor id for each event', async () => {
    const eventsResponse = { events: [ENROLLED_EVENT] };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(eventsResponse),
      } as Response)
    );

    render(<DealTimelinePanel deal={DEAL_IN_CONTACTED} userRole="advisor" onClose={vi.fn()} />);

    await waitFor(() => {
      // Actor shown as truncated UUID prefix
      expect(screen.getByText(/Actor:/)).toBeDefined();
    });
  });

  it('add-note → POST /pipeline-data/:id/notes (NOT page route) with rid:anti-csrf', async () => {
    const user = userEvent.setup();

    // First call: load events
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ events: [] }),
      } as Response)
      // Second call: POST note
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () =>
          Promise.resolve({
            id: EVENT_ID_3,
            pipelineId: PIPELINE_ID,
            eventType: 'note',
            note: 'Test note',
            actorId: ACTOR_ID,
            createdAt: NOW_ISO,
          }),
      } as Response)
      // Third call: reload events after note added
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ events: [{ ...NOTE_EVENT, note: 'Test note' }] }),
      } as Response);

    vi.stubGlobal('fetch', mockFetch);

    render(<DealTimelinePanel deal={DEAL_IN_CONTACTED} userRole="advisor" onClose={vi.fn()} />);

    // Wait for initial events load (textarea placeholder is shown once events load)
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/enter note text/i)).toBeDefined();
    });

    const textarea = screen.getByPlaceholderText(/enter note text/i);
    await user.type(textarea, 'Test note');
    const submitBtn = screen.getByRole('button', { name: /add note/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    // Check the POST call (second call)
    const [calledUrl, calledInit] = mockFetch.mock.calls[1] as [
      string,
      RequestInit & { headers: Record<string, string> },
    ];
    expect(calledUrl).toContain(`/pipeline-data/${PIPELINE_ID}/notes`);
    expect(calledUrl).not.toContain('/pipeline/');
    expect(calledInit.method).toBe('POST');
    expect(calledInit.headers.rid).toBe('anti-csrf');
  });

  it('empty timeline (0 events) — no crash', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ events: [] }),
      } as Response)
    );

    expect(() =>
      render(<DealTimelinePanel deal={DEAL_IN_CONTACTED} userRole="advisor" onClose={vi.fn()} />)
    ).not.toThrow();

    await waitFor(() => {
      expect(screen.queryByText(/No events yet/i)).toBeDefined();
    });
  });
});

// ── F. Board fetch-error vs genuinely-empty (M-2 observability) ────────────
//
// These two cases MUST be visually distinct:
//   • Non-OK HTTP response or safeParse failure → boardError set → error banner
//     (NOT the empty 7-column board)
//   • OK response with zero deals → initialBoard set, all stages empty → 7 columns
//
// This is the regression guard for the wave-8/9/10/11 response-shape-drift class.

describe('F. Board fetch-error vs genuinely-empty board (M-2 observability)', () => {
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

  it('non-OK board fetch (500) → renders error banner, NOT the empty 7-column board', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const s = String(url);
        if (s.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(meFor('advisor')),
          } as Response);
        }
        if (s.includes('/pipeline')) {
          // Simulate a 500 from the board endpoint
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ message: 'Internal Server Error' }),
          } as Response);
        }
        return Promise.reject(new Error(`Unexpected fetch: ${s}`));
      })
    );

    const { redirected } = await renderPage('advisor', undefined, true);
    expect(redirected).toBe(false);

    // Error banner must be present
    expect(screen.getByRole('alert', { name: /pipeline board load error/i })).toBeDefined();
    // Must show the status code
    expect(screen.getByText(/status 500/i)).toBeDefined();
    // Must NOT show the 7-column stage headers (would indicate empty board rendered)
    expect(screen.queryByText('Shortlisted')).toBeNull();
    expect(screen.queryByText('Contacted')).toBeNull();
  });

  it('non-OK board fetch (403) → renders error banner, NOT the empty 7-column board', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        const s = String(url);
        if (s.includes('/auth/me')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(meFor('advisor')),
          } as Response);
        }
        if (s.includes('/pipeline')) {
          return Promise.resolve({
            ok: false,
            status: 403,
            json: () => Promise.resolve({ message: 'Forbidden' }),
          } as Response);
        }
        return Promise.reject(new Error(`Unexpected fetch: ${s}`));
      })
    );

    const { redirected } = await renderPage('advisor', undefined, true);
    expect(redirected).toBe(false);

    expect(screen.getByRole('alert', { name: /pipeline board load error/i })).toBeDefined();
    expect(screen.getByText(/status 403/i)).toBeDefined();
    // Stage columns must NOT be rendered
    expect(screen.queryByText('Shortlisted')).toBeNull();
  });

  it('OK board fetch with zero deals → renders 7 empty stage columns (NOT error state)', async () => {
    // makePageFetch with no deal → returns ok:true + empty byStage
    const { redirected } = await renderPage('advisor', undefined, false);
    expect(redirected).toBe(false);

    // No error banner
    expect(screen.queryByRole('alert', { name: /pipeline board load error/i })).toBeNull();
    // All 7 stage column labels must be present
    for (const label of [
      'Shortlisted',
      'Contacted',
      'Engaged',
      'Diligence',
      'Offer',
      'Closed',
      'Withdrawn',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });
});

// ── E. Absent affordances (P-4 karen flag — HARD BOUNDARY) ─────────────────

describe('E. Absent affordances — NO send/AI/schedule (P-4 karen MANDATORY)', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  const FORBIDDEN_STRINGS = [
    'Send',
    'Schedule',
    'AI',
    'Draft',
    'Generate',
    'Email Campaign',
    'AI-powered',
    'AI Drafting',
  ] as const;

  it('board component contains NO send/AI affordances', () => {
    const board = makeBoard(DEAL_IN_CONTACTED);
    const { container } = render(<PipelineBoardClient initialBoard={board} userRole="advisor" />);
    const text = container.textContent ?? '';
    for (const forbidden of FORBIDDEN_STRINGS) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('timeline panel contains NO send/AI/schedule affordances', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ events: [ENROLLED_EVENT, NOTE_EVENT] }),
      } as Response)
    );

    const { container } = render(
      <DealTimelinePanel deal={DEAL_IN_CONTACTED} userRole="advisor" onClose={vi.fn()} />
    );

    await waitFor(() => {
      // Wait for events to load
      expect(screen.getByText('Enrolled')).toBeDefined();
    });

    const text = container.textContent ?? '';
    for (const forbidden of FORBIDDEN_STRINGS) {
      expect(text).not.toContain(forbidden);
    }
  });
});
