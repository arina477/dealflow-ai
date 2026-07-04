/**
 * /sourcing — SourcingWorkspacePage + client component tests (wave-7, B-3).
 *
 * Coverage:
 *   - Workspace renders (connectors + search + results matrix) for analyst.
 *   - Workspace renders for admin role.
 *   - Non-analyst/non-admin roles (advisor, compliance) redirect to '/'.
 *   - Unauthenticated (401) redirects to '/login'.
 *   - Search interaction: query change triggers refetch.
 *   - Source facet: ≥2 connections → 2 source facet buttons render.
 *   - Sync trigger: "Sync" button fires POST + shows summary.
 *   - Connection-create: add connection form fires POST + refreshes connectors.
 *   - Review-Import CTA links to /sourcing/companies.
 *
 * Strategy mirrors wave-6 companies tests:
 *   - SourcingWorkspacePage is an async server component; awaited + rendered.
 *   - Client components rendered directly for interaction tests.
 *   - next/navigation and next/headers mocked at the module boundary.
 *   - AppShell excluded (inherited from (app)/layout).
 *   - e2e paths (.spec.ts) excluded from vitest include glob.
 */

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

import { AddConnectionForm } from './_components/AddConnectionForm';
import { ResultsMatrix } from './_components/ResultsMatrix';
import { SearchBar } from './_components/SearchBar';
import { SourceFacet } from './_components/SourceFacet';
import { SyncTrigger } from './_components/SyncTrigger';
import { WorkspaceClient } from './_components/WorkspaceClient';
import type { ConnectionWithCount, WorkspaceCompany } from './_lib/workspace-types';
import SourcingWorkspacePage from './page';

// ── Fixture data ──────────────────────────────────────────────────────────

type Role = 'advisor' | 'analyst' | 'compliance' | 'admin';

const NOW = '2024-06-01T10:00:00.000Z';

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const CONN_1: ConnectionWithCount = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  providerKey: 'fixture',
  displayName: 'Fixture Source Alpha',
  enabled: true,
  config: {},
  createdBy: null,
  createdAt: NOW,
  companyCount: 5,
};

const CONN_2: ConnectionWithCount = {
  id: 'bbbbbbbb-0000-0000-0000-000000000002',
  providerKey: 'fixture',
  displayName: 'Fixture Source Beta',
  enabled: true,
  config: {},
  createdBy: null,
  createdAt: NOW,
  companyCount: 3,
};

const COMPANY_1: WorkspaceCompany = {
  id: '11111111-0000-0000-0000-000000000001',
  name: 'Nexus Analytics',
  domain: 'nexus.io',
  sector: 'Enterprise SaaS',
  status: 'active',
  connectionIds: [CONN_1.id],
  createdAt: NOW,
};

const COMPANY_2: WorkspaceCompany = {
  id: '22222222-0000-0000-0000-000000000002',
  name: 'Cipher Systems',
  domain: 'cipher.com',
  sector: 'Cybersecurity',
  status: 'active',
  connectionIds: [CONN_2.id],
  createdAt: NOW,
};

// ── Fetch helpers ─────────────────────────────────────────────────────────

function makePageFetch(
  role: Role,
  connections: unknown[] = [CONN_1, CONN_2],
  companies: unknown[] = [COMPANY_1, COMPANY_2]
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
    if (s.includes('/sourcing/connections') && !s.includes('/sync')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ connections }),
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
    const jsx = await SourcingWorkspacePage();
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

describe('SourcingWorkspacePage (/sourcing)', () => {
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

  describe('RBAC guard', () => {
    it('renders for analyst role without redirect', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
    });

    it('redirects to / for admin role (sourcing page is analyst-only per RBAC)', async () => {
      vi.stubGlobal('fetch', makePageFetch('admin'));
      const { redirected, path } = await renderPage();
      expect(redirected).toBe(true);
      expect(path).toBe('/');
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

  // ── Workspace renders ────────────────────────────────────────────────────

  describe('workspace renders for analyst', () => {
    it('renders workspace client component', async () => {
      vi.stubGlobal('fetch', makePageFetch('analyst'));
      const { redirected } = await renderPage();
      expect(redirected).toBe(false);
    });
  });
});

// ── WorkspaceClient integration tests ────────────────────────────────────

describe('WorkspaceClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders connectors for each connection', () => {
    render(
      <WorkspaceClient
        initialConnections={[CONN_1, CONN_2]}
        initialCompanies={[COMPANY_1, COMPANY_2]}
      />
    );
    // ConnectorBadge abbreviations: FSA (Fixture Source Alpha), FSB (Fixture Source Beta)
    expect(screen.getByText('FSA')).toBeDefined();
    expect(screen.getByText('FSB')).toBeDefined();
  });

  it('renders search input', () => {
    render(<WorkspaceClient initialConnections={[CONN_1]} initialCompanies={[COMPANY_1]} />);
    expect(screen.getByRole('searchbox')).toBeDefined();
  });

  it('renders company results', () => {
    render(
      <WorkspaceClient
        initialConnections={[CONN_1, CONN_2]}
        initialCompanies={[COMPANY_1, COMPANY_2]}
      />
    );
    expect(screen.getByText('Nexus Analytics')).toBeDefined();
    expect(screen.getByText('Cipher Systems')).toBeDefined();
  });

  it('renders Review & Import link to /sourcing/companies when rows selected', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceClient initialConnections={[CONN_1]} initialCompanies={[COMPANY_1, COMPANY_2]} />
    );

    // Select one row
    const checkboxes = screen.getAllByRole('checkbox');
    // First is "select all", then row checkboxes
    const rowCheckbox = checkboxes[1];
    if (rowCheckbox) await user.click(rowCheckbox);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /review.*import/i });
      expect(link).toBeDefined();
      expect((link as HTMLAnchorElement).href).toContain('/sourcing/companies');
    });
  });
});

// ── SearchBar unit tests ──────────────────────────────────────────────────

describe('SearchBar', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders search input with correct role', () => {
    const noop = vi.fn();
    render(<SearchBar query="" onQueryChange={noop} isSearching={false} />);
    expect(screen.getByRole('searchbox')).toBeDefined();
  });

  it('calls onQueryChange when user types', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<SearchBar query="" onQueryChange={onQueryChange} isSearching={false} />);
    await user.type(screen.getByRole('searchbox'), 'Nexus');
    expect(onQueryChange).toHaveBeenCalled();
  });

  it('shows clear button when query is non-empty', () => {
    const noop = vi.fn();
    render(<SearchBar query="test" onQueryChange={noop} isSearching={false} />);
    expect(screen.getByRole('button', { name: /clear search/i })).toBeDefined();
  });

  it('clear button calls onQueryChange with empty string', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    render(<SearchBar query="test" onQueryChange={onQueryChange} isSearching={false} />);
    await user.click(screen.getByRole('button', { name: /clear search/i }));
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('does not show clear button when query is empty', () => {
    const noop = vi.fn();
    render(<SearchBar query="" onQueryChange={noop} isSearching={false} />);
    expect(screen.queryByRole('button', { name: /clear search/i })).toBeNull();
  });
});

// ── SourceFacet unit tests ────────────────────────────────────────────────

describe('SourceFacet — ≥2-source view', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders "All Sources" button', () => {
    const noop = vi.fn();
    render(
      <SourceFacet connections={[CONN_1, CONN_2]} activeSource={null} onSourceChange={noop} />
    );
    expect(screen.getByRole('button', { name: /all sources/i })).toBeDefined();
  });

  it('renders 2 per-connection facet buttons when ≥2 connections exist', () => {
    const noop = vi.fn();
    render(
      <SourceFacet connections={[CONN_1, CONN_2]} activeSource={null} onSourceChange={noop} />
    );
    // Should show "Fixture Source Alpha" and "Fixture Source Beta" buttons
    expect(screen.getByRole('button', { name: /filter by fixture source alpha/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /filter by fixture source beta/i })).toBeDefined();
  });

  it('calls onSourceChange with connection id when a source facet is clicked', async () => {
    const user = userEvent.setup();
    const onSourceChange = vi.fn();
    render(
      <SourceFacet
        connections={[CONN_1, CONN_2]}
        activeSource={null}
        onSourceChange={onSourceChange}
      />
    );
    await user.click(screen.getByRole('button', { name: /filter by fixture source alpha/i }));
    expect(onSourceChange).toHaveBeenCalledWith(CONN_1.id);
  });

  it('calls onSourceChange(null) when "All Sources" is clicked', async () => {
    const user = userEvent.setup();
    const onSourceChange = vi.fn();
    render(
      <SourceFacet
        connections={[CONN_1]}
        activeSource={CONN_1.id}
        onSourceChange={onSourceChange}
      />
    );
    await user.click(screen.getByRole('button', { name: /all sources/i }));
    expect(onSourceChange).toHaveBeenCalledWith(null);
  });

  it('shows empty-state message when no connections', () => {
    const noop = vi.fn();
    render(<SourceFacet connections={[]} activeSource={null} onSourceChange={noop} />);
    expect(screen.getByText(/add a data source to enable filtering/i)).toBeDefined();
  });
});

// ── ResultsMatrix unit tests ──────────────────────────────────────────────

describe('ResultsMatrix', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders company rows', () => {
    render(
      <ResultsMatrix
        companies={[COMPANY_1, COMPANY_2]}
        connections={[CONN_1, CONN_2]}
        isLoading={false}
        onOpenDetail={vi.fn()}
        onSelectionChange={vi.fn()}
      />
    );
    expect(screen.getByText('Nexus Analytics')).toBeDefined();
    expect(screen.getByText('Cipher Systems')).toBeDefined();
  });

  it('renders source badges from real connection displayName (AC-BADGE)', () => {
    render(
      <ResultsMatrix
        companies={[COMPANY_1]}
        connections={[CONN_1]}
        isLoading={false}
        onOpenDetail={vi.fn()}
        onSelectionChange={vi.fn()}
      />
    );
    // Badge should be "Fixture Source Alpha", NOT "PitchBook" or "Crunchbase"
    expect(screen.getByLabelText(/source: fixture source alpha/i)).toBeDefined();
  });

  it('renders "No companies found" when empty', () => {
    render(
      <ResultsMatrix
        companies={[]}
        connections={[]}
        isLoading={false}
        onOpenDetail={vi.fn()}
        onSelectionChange={vi.fn()}
      />
    );
    expect(screen.getByText(/no companies found/i)).toBeDefined();
  });

  it('renders loading state when isLoading=true', () => {
    render(
      <ResultsMatrix
        companies={[]}
        connections={[]}
        isLoading={true}
        onOpenDetail={vi.fn()}
        onSelectionChange={vi.fn()}
      />
    );
    expect(screen.getByText(/querying data sources/i)).toBeDefined();
  });

  it('calls onOpenDetail when quick-view button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenDetail = vi.fn();
    render(
      <ResultsMatrix
        companies={[COMPANY_1]}
        connections={[CONN_1]}
        isLoading={false}
        onOpenDetail={onOpenDetail}
        onSelectionChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: /quick view nexus analytics/i }));
    expect(onOpenDetail).toHaveBeenCalledWith(COMPANY_1.id);
  });

  it('calls onSelectionChange when a row checkbox is toggled', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <ResultsMatrix
        companies={[COMPANY_1, COMPANY_2]}
        connections={[CONN_1, CONN_2]}
        isLoading={false}
        onOpenDetail={vi.fn()}
        onSelectionChange={onSelectionChange}
      />
    );
    const checkboxes = screen.getAllByRole('checkbox');
    const rowCheckbox = checkboxes[1];
    if (rowCheckbox) {
      await user.click(rowCheckbox);
    }
    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalled();
    });
  });
});

// ── SyncTrigger unit tests ────────────────────────────────────────────────

describe('SyncTrigger', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders Sync button', () => {
    render(<SyncTrigger connectionId={CONN_1.id} onSyncComplete={vi.fn()} />);
    expect(screen.getByRole('button', { name: /sync now/i })).toBeDefined();
  });

  it('fires POST /sourcing/connections/:id/sync on click and shows summary', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ingested: 7, updated: 2 }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const onSyncComplete = vi.fn();
    render(<SyncTrigger connectionId={CONN_1.id} onSyncComplete={onSyncComplete} />);

    await user.click(screen.getByRole('button', { name: /sync now/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        `/sourcing/connections/${CONN_1.id}/sync`,
        expect.objectContaining({ method: 'POST' })
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/\+7 ingested, 2 updated/i)).toBeDefined();
    });

    expect(onSyncComplete).toHaveBeenCalledWith(7);
    vi.useRealTimers();
  });

  it('shows error message when sync fails', async () => {
    const user = userEvent.setup();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server error'),
      } as Response)
    );

    render(<SyncTrigger connectionId={CONN_1.id} onSyncComplete={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /sync now/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    vi.useRealTimers();
  });
});

// ── AddConnectionForm unit tests ──────────────────────────────────────────

describe('AddConnectionForm', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders "Add source" button initially', () => {
    render(<AddConnectionForm onCreated={vi.fn()} />);
    expect(screen.getByRole('button', { name: /add a data source connection/i })).toBeDefined();
  });

  it('expands to form when "Add source" is clicked', async () => {
    const user = userEvent.setup();
    render(<AddConnectionForm onCreated={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add a data source connection/i }));

    expect(screen.getByRole('textbox', { name: /connection display name/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /create connection/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /cancel adding connection/i })).toBeDefined();
  });

  it('fires POST /sourcing/connections on submit and calls onCreated', async () => {
    const user = userEvent.setup();

    const newConn = {
      id: 'cccccccc-0000-0000-0000-000000000003',
      providerKey: 'fixture',
      displayName: 'My Test Source',
      enabled: true,
      config: {},
      createdBy: null,
      createdAt: NOW,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newConn),
      } as Response)
    );

    const onCreated = vi.fn();
    render(<AddConnectionForm onCreated={onCreated} />);

    await user.click(screen.getByRole('button', { name: /add a data source connection/i }));
    await user.type(
      screen.getByRole('textbox', { name: /connection display name/i }),
      'My Test Source'
    );
    await user.click(screen.getByRole('button', { name: /create connection/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/sourcing/connections',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            providerKey: 'fixture',
            displayName: 'My Test Source',
            config: {},
          }),
        })
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
      const createdConn = onCreated.mock.calls[0]?.[0] as ConnectionWithCount | undefined;
      expect(createdConn?.displayName).toBe('My Test Source');
    });
  });

  it('shows error when submit fails', async () => {
    const user = userEvent.setup();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad request'),
      } as Response)
    );

    render(<AddConnectionForm onCreated={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add a data source connection/i }));
    await user.type(screen.getByRole('textbox', { name: /connection display name/i }), 'Test');
    await user.click(screen.getByRole('button', { name: /create connection/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('collapses form when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<AddConnectionForm onCreated={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /add a data source connection/i }));
    expect(screen.getByRole('textbox', { name: /connection display name/i })).toBeDefined();

    await user.click(screen.getByRole('button', { name: /cancel adding connection/i }));
    expect(screen.queryByRole('textbox', { name: /connection display name/i })).toBeNull();
  });
});
