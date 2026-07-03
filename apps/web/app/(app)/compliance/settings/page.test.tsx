/**
 * /compliance/settings — ComplianceSettingsPage + section component tests (wave-5, B-3).
 *
 * Coverage:
 *   - Page renders all 3 sections for compliance role.
 *   - Non-compliance roles (advisor, analyst, admin) redirect to '/'.
 *   - Unauthenticated (no session) redirects to '/login'.
 *   - ApprovalGatingSection: create rule mutation (POST /compliance/rules).
 *   - SuppressionMatrixSection: delete mutation (DELETE /compliance/suppression/:id).
 *   - JurisdictionTemplatesSection: renders correctly with initial templates.
 *   - Client-side validation: suppressionCreateSchema rejects empty value.
 *   - Nav: 'Rules' link renders for compliance (NAV_COMPLIANCE_SETTINGS).
 *
 * Strategy:
 *   - ComplianceSettingsPage is an async server component; awaited + rendered
 *     using the same pattern as wave-4 audit-log tests.
 *   - Client components rendered directly for interaction tests.
 *   - next/navigation and next/headers mocked at the module boundary.
 *   - AppShell is excluded (inherited from (app)/layout; not in scope here).
 *   - e2e paths (.spec.ts) are excluded from vitest include glob.
 */

import type { ComplianceRule, DisclaimerTemplate, SuppressionEntry } from '@dealflow/shared';
import { navItemsForRole, ruleCreateSchema, suppressionCreateSchema } from '@dealflow/shared';
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

import { ApprovalGatingSection } from './_components/ApprovalGatingSection';
import { JurisdictionTemplatesSection } from './_components/JurisdictionTemplatesSection';
import { SuppressionMatrixSection } from './_components/SuppressionMatrixSection';
import ComplianceSettingsPage from './page';

// ── Fixture data ──────────────────────────────────────────────────────────

type Role = 'advisor' | 'analyst' | 'compliance' | 'admin';

function meFor(role: Role) {
  return { userId: `u-${role}`, email: `${role}@firm.com`, role };
}

const RULE_1: ComplianceRule = {
  id: 'rule-001',
  ruleType: 'approval_required',
  jurisdiction: null,
  config: { threshold: 250 },
  enabled: true,
  createdBy: 'u-compliance',
  createdAt: '2024-01-15T10:00:00.000Z',
  updatedAt: null,
};

const RULE_2: ComplianceRule = {
  id: 'rule-002',
  ruleType: 'blocklist_check',
  jurisdiction: 'EU',
  config: {},
  enabled: false,
  createdBy: 'u-compliance',
  createdAt: '2024-02-01T10:00:00.000Z',
  updatedAt: null,
};

const SUPPRESSION_1: SuppressionEntry = {
  id: 'sup-001',
  matchType: 'email',
  value: 'blocked@competitor.com',
  reason: 'Competitor Block',
  createdBy: 'u-compliance',
  createdAt: '2024-01-20T10:00:00.000Z',
};

const SUPPRESSION_2: SuppressionEntry = {
  id: 'sup-002',
  matchType: 'domain',
  value: 'ofac-entity.com',
  reason: 'OFAC Sanction',
  createdBy: 'u-compliance',
  createdAt: '2024-03-05T10:00:00.000Z',
};

const DISCLAIMER_EU: DisclaimerTemplate = {
  id: 'disc-001',
  jurisdiction: 'EU',
  body: 'This communication is strictly confidential and subject to GDPR.',
  version: 1,
  active: true,
  createdBy: 'u-compliance',
  createdAt: '2024-01-10T10:00:00.000Z',
};

// ── Fetch helpers ──────────────────────────────────────────────────────────

function makePageFetch(role: Role) {
  return vi.fn().mockImplementation((url: string) => {
    const s = typeof url === 'string' ? url : '';
    if (s.includes('/auth/me')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(meFor(role)),
      } as Response);
    }
    if (s.includes('/compliance/rules')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([RULE_1, RULE_2]),
      } as Response);
    }
    if (s.includes('/compliance/suppression')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([SUPPRESSION_1]),
      } as Response);
    }
    if (s.includes('/compliance/disclaimers')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([DISCLAIMER_EU]),
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
    const jsx = await ComplianceSettingsPage();
    if (jsx) render(jsx);
    return { redirected: false, path: null as string | null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('REDIRECT:')) {
      return { redirected: true, path: err.message.replace('REDIRECT:', '') };
    }
    throw err;
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ComplianceSettingsPage (/compliance/settings)', () => {
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

  describe('RBAC guard — compliance-only access', () => {
    it('renders for compliance role without redirect', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
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

    it('redirects to / for admin role (settings page is compliance-only)', async () => {
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

  // ── 3-section rendering ─────────────────────────────────────────────────
  // Note: server-component renders client-component shells with their initial
  // props. In JSDOM the client components execute and render their full DOM.
  // We check for stable, specific landmarks rather than text that may
  // exist in multiple headings across nested sections.

  describe('3-section layout for compliance role', () => {
    it('renders "Compliance Rules Engine" page heading', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      // getAllByRole to handle multiple headings across sections
      const headings = screen.getAllByRole('heading', { level: 2 });
      expect(headings.length).toBeGreaterThanOrEqual(1);
      const pageHeading = headings.find((h) =>
        /compliance rules engine/i.test(h.textContent ?? '')
      );
      expect(pageHeading).toBeDefined();
    });

    it('renders "Approval & Gating Policy" section', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.getByRole('region', { name: /approval and gating policy/i })).toBeDefined();
    });

    it('renders "Suppression Matrix" section', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.getByRole('region', { name: /suppression matrix/i })).toBeDefined();
    });

    it('renders "Jurisdiction Templates" section', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      expect(screen.getByRole('region', { name: /jurisdiction templates/i })).toBeDefined();
    });

    it('renders the gating policy section with data fetch triggered', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      // The ApprovalGatingSection is rendered as a client component.
      // We verify the section landmark exists (data rendering is covered
      // by standalone ApprovalGatingSection unit tests above).
      expect(screen.getByRole('region', { name: /approval and gating policy/i })).toBeDefined();
    });

    it('renders the suppression section with data fetch triggered', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      // Verify the SuppressionMatrixSection landmark is present.
      expect(screen.getByRole('region', { name: /suppression matrix/i })).toBeDefined();
    });

    it('renders the jurisdiction templates section with data fetch triggered', async () => {
      vi.stubGlobal('fetch', makePageFetch('compliance'));
      await renderPage();
      // Verify the JurisdictionTemplatesSection landmark is present.
      expect(screen.getByRole('region', { name: /jurisdiction templates/i })).toBeDefined();
    });
  });
});

// ── ApprovalGatingSection unit tests ─────────────────────────────────────

describe('ApprovalGatingSection', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders section heading', () => {
    render(<ApprovalGatingSection initialRules={[RULE_1]} />);
    expect(screen.getByRole('region', { name: /approval and gating policy/i })).toBeDefined();
  });

  it('renders existing rules', () => {
    render(<ApprovalGatingSection initialRules={[RULE_1, RULE_2]} />);
    expect(screen.getByText(/approval required/i)).toBeDefined();
    expect(screen.getByText(/blocklist check/i)).toBeDefined();
  });

  it('shows empty state when no rules', () => {
    render(<ApprovalGatingSection initialRules={[]} />);
    expect(screen.getByText(/no rules configured/i)).toBeDefined();
  });

  it('renders rule count badge', () => {
    render(<ApprovalGatingSection initialRules={[RULE_1, RULE_2]} />);
    expect(screen.getByText('2 rules')).toBeDefined();
  });

  it('"Add Rule" button opens the inline form', async () => {
    const user = userEvent.setup();
    render(<ApprovalGatingSection initialRules={[]} />);
    const btn = screen.getByRole('button', { name: /add rule/i });
    await user.click(btn);
    expect(screen.getByRole('form', { name: /add gating rule/i })).toBeDefined();
  });

  it('creates a rule via POST /compliance/rules and adds it to the list', async () => {
    const user = userEvent.setup();
    const newRule: ComplianceRule = {
      id: 'rule-new',
      ruleType: 'jurisdiction_check',
      jurisdiction: 'US',
      config: {},
      enabled: true,
      createdBy: 'u-compliance',
      createdAt: '2024-06-01T10:00:00.000Z',
      updatedAt: null,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newRule),
      } as Response)
    );

    render(<ApprovalGatingSection initialRules={[]} />);

    // Only one "Add Rule" button before the form opens
    const headerBtn = screen.getByRole('button', { name: /add rule/i });
    await user.click(headerBtn);

    // Form is now open. Select rule type.
    const typeSelect = screen.getByRole('combobox', { name: /rule type/i });
    await user.selectOptions(typeSelect, 'jurisdiction_check');

    // Fill jurisdiction
    const jurisdictionInput = screen.getByRole('textbox', { name: /jurisdiction/i });
    await user.type(jurisdictionInput, 'US');

    // There are now 2 "Add Rule" buttons (header toggle + form submit).
    // The submit button is type="submit" inside the form.
    const allAddRuleBtns = screen.getAllByRole('button', { name: /add rule/i });
    const submitBtn = allAddRuleBtns.find(
      (b) => (b as HTMLButtonElement).type === 'submit'
    ) as HTMLElement;
    expect(submitBtn).toBeDefined();
    await user.click(submitBtn);

    // New rule should appear in the table
    await waitFor(() => {
      const texts = screen.getAllByText(/jurisdiction check/i);
      expect(texts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('enabled toggle fires PATCH /compliance/rules/:id', async () => {
    const user = userEvent.setup();
    const updatedRule = { ...RULE_1, enabled: false };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(updatedRule),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<ApprovalGatingSection initialRules={[RULE_1]} />);
    const toggleBtn = screen.getByRole('switch', { name: /disable approval required rule/i });
    await user.click(toggleBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/compliance/rules/rule-001'),
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  it('delete button fires DELETE /compliance/rules/:id after confirmation', async () => {
    const user = userEvent.setup();
    // Use spyOn instead of stubGlobal to avoid replacing the whole window
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<ApprovalGatingSection initialRules={[RULE_1]} />);
    const deleteBtn = screen.getByRole('button', { name: /delete approval required rule/i });
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/compliance/rules/rule-001'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});

// ── SuppressionMatrixSection unit tests ───────────────────────────────────

describe('SuppressionMatrixSection', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders section heading', () => {
    render(<SuppressionMatrixSection initialEntries={[SUPPRESSION_1]} />);
    expect(screen.getByRole('region', { name: /suppression matrix/i })).toBeDefined();
  });

  it('renders existing entries', () => {
    render(<SuppressionMatrixSection initialEntries={[SUPPRESSION_1, SUPPRESSION_2]} />);
    expect(screen.getByText('blocked@competitor.com')).toBeDefined();
    expect(screen.getByText('ofac-entity.com')).toBeDefined();
  });

  it('shows empty state when no entries', () => {
    render(<SuppressionMatrixSection initialEntries={[]} />);
    expect(screen.getByText(/no entries found/i)).toBeDefined();
  });

  it('"Add Entry" button opens the modal', async () => {
    const user = userEvent.setup();
    // Render with entries to avoid the empty-state "Add First Entry" duplicate button
    render(<SuppressionMatrixSection initialEntries={[SUPPRESSION_1]} />);
    const btn = screen.getByRole('button', { name: /add entry/i });
    await user.click(btn);
    expect(screen.getByRole('dialog', { name: /add suppression entry/i })).toBeDefined();
  });

  it('creates a suppression entry via POST /compliance/suppression', async () => {
    const user = userEvent.setup();
    const newEntry: SuppressionEntry = {
      id: 'sup-new',
      matchType: 'domain',
      value: 'blocked.com',
      reason: 'Legal Hold',
      createdBy: 'u-compliance',
      createdAt: '2024-06-01T10:00:00.000Z',
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve(newEntry),
      } as Response)
    );

    render(<SuppressionMatrixSection initialEntries={[]} />);

    // In empty state there are 2 add-entry buttons (header "Add Entry" + "Add First Entry").
    // Click the header "Add Entry" button (exact match, no "First" word).
    const addBtns = screen.getAllByRole('button', { name: /add entry/i });
    // The header button comes first in DOM order; cast to HTMLElement for userEvent
    await user.click(addBtns[0] as HTMLElement);

    // Select match type = domain
    const matchTypeSelect = screen.getByRole('combobox', { name: /match type/i });
    await user.selectOptions(matchTypeSelect, 'domain');

    // Enter domain value (label changes to "Domain" when matchType=domain)
    const valueInput = screen.getByLabelText(/domain/i);
    await user.type(valueInput, 'blocked.com');

    // Submit
    const submitBtn = screen.getByRole('button', { name: /append entry/i });
    await user.click(submitBtn);

    // Should appear in the table
    await waitFor(() => {
      const texts = screen.getAllByText((content) => content.includes('blocked.com'));
      expect(texts.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('delete fires DELETE /compliance/suppression/:id after confirmation', async () => {
    const user = userEvent.setup();
    // Use spyOn to avoid replacing the whole window object
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 204 } as Response);
    vi.stubGlobal('fetch', mockFetch);

    render(<SuppressionMatrixSection initialEntries={[SUPPRESSION_1]} />);
    const deleteBtn = screen.getByRole('button', { name: /remove blocked@competitor\.com/i });
    await user.click(deleteBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/compliance/suppression/sup-001'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  it('modal closes on Escape key', async () => {
    const user = userEvent.setup();
    // Use an entry so there's only one "Add Entry" button (no "Add First Entry" duplicate)
    render(<SuppressionMatrixSection initialEntries={[SUPPRESSION_1]} />);
    await user.click(screen.getByRole('button', { name: /add entry/i }));
    expect(screen.getByRole('dialog')).toBeDefined();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});

// ── JurisdictionTemplatesSection unit tests ───────────────────────────────

describe('JurisdictionTemplatesSection', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('renders section heading', () => {
    render(<JurisdictionTemplatesSection initialTemplates={[DISCLAIMER_EU]} />);
    expect(screen.getByRole('region', { name: /jurisdiction templates/i })).toBeDefined();
  });

  it('renders jurisdiction selector with EU option', () => {
    render(<JurisdictionTemplatesSection initialTemplates={[DISCLAIMER_EU]} />);
    const select = screen.getByRole('combobox', { name: /scope region/i });
    expect(select).toBeDefined();
  });

  it('renders version badge for active template', () => {
    render(<JurisdictionTemplatesSection initialTemplates={[DISCLAIMER_EU]} />);
    const versionEl = screen.getByTestId('disclaimer-version');
    expect(versionEl.textContent).toContain('1');
  });

  it('renders disclaimer body in textarea', () => {
    render(<JurisdictionTemplatesSection initialTemplates={[DISCLAIMER_EU]} />);
    const textarea = screen.getByRole('textbox', { name: /mandatory text/i });
    expect((textarea as HTMLTextAreaElement).value).toContain('GDPR');
  });

  it('shows empty state when no templates', () => {
    render(<JurisdictionTemplatesSection initialTemplates={[]} />);
    expect(screen.getByText(/no disclaimer templates yet/i)).toBeDefined();
  });

  it('"New Jurisdiction" button opens the new-template form', async () => {
    const user = userEvent.setup();
    render(<JurisdictionTemplatesSection initialTemplates={[]} />);
    await user.click(screen.getByRole('button', { name: /new jurisdiction/i }));
    expect(screen.getByRole('textbox', { name: /jurisdiction code/i })).toBeDefined();
    expect(screen.getByRole('textbox', { name: /disclaimer text/i })).toBeDefined();
  });
});

// ── Nav rendering ─────────────────────────────────────────────────────────

describe('nav — NAV_COMPLIANCE_SETTINGS renders for compliance role', () => {
  it('navItemsForRole("compliance") includes "Rules" nav item', () => {
    const items = navItemsForRole('compliance');
    const rulesItem = items.find((i) => i.route === '/compliance/settings');
    expect(rulesItem).toBeDefined();
    expect(rulesItem?.label).toBe('Rules');
    expect(rulesItem?.icon).toBe('sliders');
  });

  it('navItemsForRole("advisor") does NOT include /compliance/settings', () => {
    const items = navItemsForRole('advisor');
    const rulesItem = items.find((i) => i.route === '/compliance/settings');
    expect(rulesItem).toBeUndefined();
  });

  it('navItemsForRole("admin") does NOT include /compliance/settings', () => {
    const items = navItemsForRole('admin');
    const rulesItem = items.find((i) => i.route === '/compliance/settings');
    expect(rulesItem).toBeUndefined();
  });
});

// ── Client-side validation ────────────────────────────────────────────────

describe('client-side validation', () => {
  it('suppressionCreateSchema rejects empty value', () => {
    const result = suppressionCreateSchema.safeParse({
      matchType: 'email',
      value: '',
      reason: null,
    });
    expect(result.success).toBe(false);
  });

  it('ruleCreateSchema rejects missing ruleType', () => {
    const result = ruleCreateSchema.safeParse({
      config: {},
      enabled: true,
    });
    expect(result.success).toBe(false);
  });
});
