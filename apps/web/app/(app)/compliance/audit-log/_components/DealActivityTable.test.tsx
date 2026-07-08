/**
 * DealActivityTable + ScopeToggle + RecordsPanel — wave-29 B-3 component tests.
 *
 * Coverage:
 *   - ScopeToggle: renders "Audit log" tab always; "Deal activity" tab only when
 *     canSeeDealActivity=true; hides deal tab when canSeeDealActivity=false.
 *   - DealActivityTable: renders rows; loading/empty/error states; filter bar;
 *     pagination controls; fetches from /compliance/records-deal-activity-data;
 *     includes rid anti-csrf header; READ-ONLY (no mutation control).
 *   - RecordsPanel: scope toggle switches between AuditLogTable and
 *     DealActivityTable; deal-activity scope gated (advisor hidden).
 *   - RBAC gating: advisor does NOT see the deal-activity tab.
 */

import type { DealActivityBrowseResponse, DealActivityRow } from '@dealflow/shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DealActivityTable } from './DealActivityTable';
import { RecordsPanel } from './RecordsPanel';
import { ScopeToggle } from './ScopeToggle';

// ── Fixtures ───────────────────────────────────────────────────────────────

const DEAL_ROW_1: DealActivityRow = {
  pipelineId: 'p1000000-0000-0000-0000-000000000001',
  mandateId: 'm1000000-0000-0000-0000-000000000001',
  dealSourceType: 'match_candidate',
  outreachId: null,
  matchCandidateId: 'mc100000-0000-0000-0000-000000000001',
  stage: 'initial_contact',
  createdBy: 'u1000000-0000-0000-0000-000000000001',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: null,
  mandateSellerName: 'Acme Corp',
};

const DEAL_ROW_2: DealActivityRow = {
  pipelineId: 'p2000000-0000-0000-0000-000000000002',
  mandateId: 'm2000000-0000-0000-0000-000000000002',
  dealSourceType: 'outreach',
  outreachId: 'o2000000-0000-0000-0000-000000000002',
  matchCandidateId: null,
  stage: 'due_diligence',
  createdBy: 'u2000000-0000-0000-0000-000000000002',
  createdAt: '2026-07-02T12:00:00.000Z',
  updatedAt: '2026-07-03T09:00:00.000Z',
  mandateSellerName: null,
};

const DEAL_ROWS = [DEAL_ROW_1, DEAL_ROW_2];

const DEAL_RESPONSE: DealActivityBrowseResponse = {
  rows: DEAL_ROWS,
  total: 2,
  limit: 25,
  offset: 0,
};

const AUDIT_ENTRY = {
  sequenceNumber: 1,
  actorUserId: 'aaa00000-0000-0000-0000-000000000001',
  actorRole: 'advisor',
  action: 'outreach-compose',
  resourceType: 'outreach',
  resourceId: 'bbb00000-0000-0000-0000-000000000002',
  contentHash: 'c'.repeat(64),
  payloadHash: 'd'.repeat(64),
  prevHash: '0'.repeat(64),
  entryHash: 'e'.repeat(64),
  chainVersion: 1,
  createdAt: '2026-07-01T10:00:00.000Z',
};

// ── Cleanup ────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

// ── ScopeToggle ────────────────────────────────────────────────────────────

describe('ScopeToggle', () => {
  it('always renders "Audit log" tab', () => {
    const onScopeChange = vi.fn();
    render(
      <ScopeToggle activeScope="audit" onScopeChange={onScopeChange} canSeeDealActivity={false} />
    );
    expect(screen.getByRole('tab', { name: /audit log/i })).toBeDefined();
  });

  it('renders "Deal activity" tab when canSeeDealActivity=true', () => {
    const onScopeChange = vi.fn();
    render(
      <ScopeToggle activeScope="audit" onScopeChange={onScopeChange} canSeeDealActivity={true} />
    );
    expect(screen.getByTestId('deal-activity-tab')).toBeDefined();
  });

  it('does NOT render "Deal activity" tab when canSeeDealActivity=false (advisor)', () => {
    const onScopeChange = vi.fn();
    render(
      <ScopeToggle activeScope="audit" onScopeChange={onScopeChange} canSeeDealActivity={false} />
    );
    expect(screen.queryByTestId('deal-activity-tab')).toBeNull();
  });

  it('"Audit log" tab has aria-selected=true when activeScope=audit', () => {
    const onScopeChange = vi.fn();
    render(
      <ScopeToggle activeScope="audit" onScopeChange={onScopeChange} canSeeDealActivity={true} />
    );
    const auditTab = screen.getByRole('tab', { name: /audit log/i });
    expect(auditTab.getAttribute('aria-selected')).toBe('true');
    const dealTab = screen.getByTestId('deal-activity-tab');
    expect(dealTab.getAttribute('aria-selected')).toBe('false');
  });

  it('"Deal activity" tab has aria-selected=true when activeScope=deal', () => {
    const onScopeChange = vi.fn();
    render(
      <ScopeToggle activeScope="deal" onScopeChange={onScopeChange} canSeeDealActivity={true} />
    );
    const dealTab = screen.getByTestId('deal-activity-tab');
    expect(dealTab.getAttribute('aria-selected')).toBe('true');
  });

  it('calls onScopeChange with "deal" when deal-activity tab is clicked', async () => {
    const user = userEvent.setup();
    const onScopeChange = vi.fn();
    render(
      <ScopeToggle activeScope="audit" onScopeChange={onScopeChange} canSeeDealActivity={true} />
    );
    await user.click(screen.getByTestId('deal-activity-tab'));
    expect(onScopeChange).toHaveBeenCalledWith('deal');
  });

  it('calls onScopeChange with "audit" when audit log tab is clicked', async () => {
    const user = userEvent.setup();
    const onScopeChange = vi.fn();
    render(
      <ScopeToggle activeScope="deal" onScopeChange={onScopeChange} canSeeDealActivity={true} />
    );
    await user.click(screen.getByRole('tab', { name: /audit log/i }));
    expect(onScopeChange).toHaveBeenCalledWith('audit');
  });
});

// ── DealActivityTable ──────────────────────────────────────────────────────

describe('DealActivityTable', () => {
  it('renders SSR-hydrated rows without a client fetch', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    expect(screen.getByText('Acme Corp')).toBeDefined();
    expect(screen.getByText('initial_contact')).toBeDefined();
    expect(screen.getByText('due_diligence')).toBeDefined();
  });

  it('renders null seller name as "—" placeholder', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('renders deal source type pills for each row', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    expect(screen.getByTestId(`deal-source-type-pill-${DEAL_ROW_1.pipelineId}`)).toBeDefined();
    expect(screen.getByTestId(`deal-source-type-pill-${DEAL_ROW_2.pipelineId}`)).toBeDefined();
  });

  it('renders filter bar with deal source type, from, to, mandate inputs', () => {
    render(<DealActivityTable initialRows={[]} initialTotal={0} />);
    expect(screen.getByLabelText(/deal source type/i)).toBeDefined();
    expect(screen.getByLabelText(/^from$/i)).toBeDefined();
    expect(screen.getByLabelText(/^to$/i)).toBeDefined();
    expect(screen.getByLabelText(/mandate/i)).toBeDefined();
  });

  it('renders Apply and Reset filter buttons', () => {
    render(<DealActivityTable initialRows={[]} initialTotal={0} />);
    expect(screen.getByRole('button', { name: /apply deal activity filters/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /reset all deal activity filters/i })).toBeDefined();
  });

  it('Apply button is keyboard-focusable (not disabled)', () => {
    render(<DealActivityTable initialRows={[]} initialTotal={0} />);
    const btn = screen.getByRole('button', { name: /apply deal activity filters/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders Prev/Next pagination buttons', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    expect(screen.getByRole('button', { name: /previous page/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /next page/i })).toBeDefined();
  });

  it('Prev button is disabled on first page (offset=0)', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    const prev = screen.getByRole('button', { name: /previous page/i });
    expect((prev as HTMLButtonElement).disabled).toBe(true);
  });

  it('Next button is disabled when all rows are shown (total=2, rows.length=2)', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    const next = screen.getByRole('button', { name: /next page/i });
    expect((next as HTMLButtonElement).disabled).toBe(true);
  });

  it('Next button is enabled when total > rows.length (more pages)', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={50} />);
    const next = screen.getByRole('button', { name: /next page/i });
    expect((next as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders empty state message when no rows match', () => {
    render(<DealActivityTable initialRows={[]} initialTotal={0} />);
    expect(screen.getByText(/no deal activity entries match/i)).toBeDefined();
  });

  it('shows loading status after Apply is clicked (before fetch resolves)', async () => {
    const user = userEvent.setup();
    let resolvePromise!: (value: Response) => void;
    const pendingFetch = new Promise<Response>((res) => {
      resolvePromise = res;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(pendingFetch));

    render(<DealActivityTable initialRows={[]} initialTotal={0} />);
    await user.click(screen.getByRole('button', { name: /apply deal activity filters/i }));

    expect(screen.getByRole('status', { name: /loading deal activity/i })).toBeDefined();

    // Resolve to avoid hanging test
    resolvePromise({
      ok: true,
      json: () => Promise.resolve(DEAL_RESPONSE),
    } as Response);
  });

  it('fetches from /compliance/records-deal-activity-data on Apply', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(DEAL_RESPONSE),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    await user.click(screen.getByRole('button', { name: /apply deal activity filters/i }));

    await waitFor(() => {
      const calls = mockFetch.mock.calls as Array<[string, ...unknown[]]>;
      const hit = calls.find(
        ([url]) => typeof url === 'string' && url.includes('/compliance/records-deal-activity-data')
      );
      expect(hit).toBeDefined();
    });
  });

  it('does NOT fetch from /compliance/records/deal-activity directly (uses proxy path)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(DEAL_RESPONSE),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<DealActivityTable initialRows={[]} initialTotal={0} />);
    await user.click(screen.getByRole('button', { name: /apply deal activity filters/i }));

    await waitFor(() => {
      const calls = mockFetch.mock.calls as Array<[string, ...unknown[]]>;
      // No call to the direct API path
      const directCall = calls.find(
        ([url]) => typeof url === 'string' && url.includes('/compliance/records/deal-activity')
      );
      expect(directCall).toBeUndefined();
    });
  });

  it('includes rid anti-csrf header in filter fetch', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(DEAL_RESPONSE),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<DealActivityTable initialRows={[]} initialTotal={0} />);
    await user.click(screen.getByRole('button', { name: /apply deal activity filters/i }));

    await waitFor(() => {
      const calls = mockFetch.mock.calls as Array<[string, RequestInit]>;
      const hit = calls.find(
        ([url]) => typeof url === 'string' && url.includes('/compliance/records-deal-activity-data')
      );
      expect(hit).toBeDefined();
      const headers = hit?.[1]?.headers as Record<string, string> | undefined;
      expect(headers?.['rid']).toBe('anti-csrf');
    });
  });

  it('renders error/empty state when fetch returns non-ok status', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      } as Response)
    );

    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    await user.click(screen.getByRole('button', { name: /apply deal activity filters/i }));

    await waitFor(() => {
      expect(screen.getByText(/no deal activity entries match/i)).toBeDefined();
    });
  });

  // ── READ-ONLY boundary ──────────────────────────────────────────────────

  it('renders NO edit or delete button (read-only boundary)', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^delete$/i })).toBeNull();
  });

  it('renders NO send/compose/email/AI affordance (hard boundary)', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    expect(screen.queryByRole('button', { name: /send/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /compose/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /email/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ai/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /generate/i })).toBeNull();
  });

  it('renders NO export button in the deal-activity table', () => {
    render(<DealActivityTable initialRows={DEAL_ROWS} initialTotal={2} />);
    expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
  });
});

// ── RecordsPanel ───────────────────────────────────────────────────────────

describe('RecordsPanel', () => {
  it('shows audit log table by default (activeScope=audit)', () => {
    render(
      <RecordsPanel
        initialEntries={[AUDIT_ENTRY]}
        initialDealRows={DEAL_ROWS}
        initialDealTotal={2}
        canSeeDealActivity={true}
      />
    );
    // Audit log table is visible (has its aria label)
    expect(screen.getByRole('table', { name: /audit log entries/i })).toBeDefined();
    // Deal activity table is NOT visible
    expect(screen.queryByRole('table', { name: /deal activity entries/i })).toBeNull();
  });

  it('renders deal-activity tab visible for compliance/admin (canSeeDealActivity=true)', () => {
    render(
      <RecordsPanel
        initialEntries={[]}
        initialDealRows={[]}
        initialDealTotal={0}
        canSeeDealActivity={true}
      />
    );
    expect(screen.getByTestId('deal-activity-tab')).toBeDefined();
  });

  it('does NOT render deal-activity tab for advisor (canSeeDealActivity=false)', () => {
    render(
      <RecordsPanel
        initialEntries={[]}
        initialDealRows={[]}
        initialDealTotal={0}
        canSeeDealActivity={false}
      />
    );
    expect(screen.queryByTestId('deal-activity-tab')).toBeNull();
  });

  it('switches to deal-activity table when deal tab is clicked', async () => {
    const user = userEvent.setup();
    render(
      <RecordsPanel
        initialEntries={[AUDIT_ENTRY]}
        initialDealRows={DEAL_ROWS}
        initialDealTotal={2}
        canSeeDealActivity={true}
      />
    );

    // Initially on audit log
    expect(screen.getByRole('table', { name: /audit log entries/i })).toBeDefined();

    // Click deal activity tab
    await user.click(screen.getByTestId('deal-activity-tab'));

    // Now deal activity table is visible
    expect(screen.getByRole('table', { name: /deal activity entries/i })).toBeDefined();
    // Audit log table is gone
    expect(screen.queryByRole('table', { name: /audit log entries/i })).toBeNull();
  });

  it('switches back to audit log table when audit tab is clicked after deal', async () => {
    const user = userEvent.setup();
    render(
      <RecordsPanel
        initialEntries={[AUDIT_ENTRY]}
        initialDealRows={DEAL_ROWS}
        initialDealTotal={2}
        canSeeDealActivity={true}
      />
    );

    await user.click(screen.getByTestId('deal-activity-tab'));
    expect(screen.getByRole('table', { name: /deal activity entries/i })).toBeDefined();

    await user.click(screen.getByRole('tab', { name: /audit log/i }));
    expect(screen.getByRole('table', { name: /audit log entries/i })).toBeDefined();
  });

  it('advisor sees only audit log table (canSeeDealActivity=false, no tab switch possible)', () => {
    render(
      <RecordsPanel
        initialEntries={[AUDIT_ENTRY]}
        initialDealRows={[]}
        initialDealTotal={0}
        canSeeDealActivity={false}
      />
    );
    // Audit log always visible
    expect(screen.getByRole('table', { name: /audit log entries/i })).toBeDefined();
    // Deal activity table never visible
    expect(screen.queryByRole('table', { name: /deal activity entries/i })).toBeNull();
    // No deal activity tab
    expect(screen.queryByTestId('deal-activity-tab')).toBeNull();
  });

  it('deal-activity tab renders deal rows when switched (SSR-hydrated)', async () => {
    const user = userEvent.setup();
    render(
      <RecordsPanel
        initialEntries={[]}
        initialDealRows={DEAL_ROWS}
        initialDealTotal={2}
        canSeeDealActivity={true}
      />
    );
    await user.click(screen.getByTestId('deal-activity-tab'));
    // Acme Corp is from DEAL_ROW_1.mandateSellerName
    expect(screen.getByText('Acme Corp')).toBeDefined();
  });
});
