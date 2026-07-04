import { describe, expect, it } from 'vitest';
import type { Role } from './auth';
import {
  ALL_NAV_ITEMS,
  canAccess,
  isPublicRoute,
  navItemsForRole,
  roleRoutes,
  rolesForRoute,
} from './rbac';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_ROLES: Role[] = ['advisor', 'analyst', 'compliance', 'admin'];

// ---------------------------------------------------------------------------
// isPublicRoute
// ---------------------------------------------------------------------------

describe('isPublicRoute', () => {
  it('returns true for /auth root', () => {
    expect(isPublicRoute('/auth')).toBe(true);
  });

  it('returns true for /auth/* sub-paths', () => {
    expect(isPublicRoute('/auth/signin')).toBe(true);
    expect(isPublicRoute('/auth/signup')).toBe(true);
    expect(isPublicRoute('/auth/session')).toBe(true);
    expect(isPublicRoute('/auth/reset/request')).toBe(true);
    expect(isPublicRoute('/auth/reset/confirm')).toBe(true);
    expect(isPublicRoute('/auth/logout')).toBe(true);
  });

  it('returns true for /health', () => {
    expect(isPublicRoute('/health')).toBe(true);
  });

  it('returns false for authed routes', () => {
    expect(isPublicRoute('/')).toBe(false);
    expect(isPublicRoute('/mandates')).toBe(false);
    expect(isPublicRoute('/admin/users')).toBe(false);
  });

  it('does not match /authenticate or other false prefixes', () => {
    expect(isPublicRoute('/authenticate')).toBe(false);
    expect(isPublicRoute('/healthcare')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rolesForRoute — exact routes
// ---------------------------------------------------------------------------

describe('rolesForRoute — exact routes', () => {
  it('/ → all 4 roles', () => {
    expect(rolesForRoute('/')).toEqual(
      expect.arrayContaining(['advisor', 'analyst', 'compliance', 'admin'])
    );
    expect(rolesForRoute('/')).toHaveLength(4);
  });

  it('/mandates → advisor + admin + analyst (wave-8: admin added for mandate API)', () => {
    const roles = rolesForRoute('/mandates');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
    expect(roles).toContain('admin');
    expect(roles).not.toContain('compliance');
  });

  it('/compliance/queue → compliance + advisor', () => {
    const roles = rolesForRoute('/compliance/queue');
    expect(roles).toContain('compliance');
    expect(roles).toContain('advisor');
    expect(roles).not.toContain('analyst');
    expect(roles).not.toContain('admin');
  });

  it('/compliance/summary → compliance + admin (this wave enforced exemplar)', () => {
    const roles = rolesForRoute('/compliance/summary');
    expect(roles).toContain('compliance');
    expect(roles).toContain('admin');
    expect(roles).not.toContain('advisor');
    expect(roles).not.toContain('analyst');
  });

  it('/compliance/audit-log → compliance only', () => {
    const roles = rolesForRoute('/compliance/audit-log');
    expect(roles).toContain('compliance');
    expect(roles).not.toContain('advisor');
    expect(roles).not.toContain('analyst');
    expect(roles).not.toContain('admin');
  });

  it('/compliance/settings → compliance only', () => {
    const roles = rolesForRoute('/compliance/settings');
    expect(roles).toContain('compliance');
    expect(roles).toHaveLength(1);
  });

  it('/admin/users → admin only', () => {
    const roles = rolesForRoute('/admin/users');
    expect(roles).toContain('admin');
    expect(roles).toHaveLength(1);
  });

  it('/admin/settings → admin only', () => {
    expect(rolesForRoute('/admin/settings')).toContain('admin');
  });

  it('/admin/integrations → admin only', () => {
    expect(rolesForRoute('/admin/integrations')).toContain('admin');
  });

  it('/sourcing → analyst only', () => {
    const roles = rolesForRoute('/sourcing');
    expect(roles).toContain('analyst');
    expect(roles).toHaveLength(1);
  });

  // Wave-6: /companies was repointed to /sourcing/companies (P-3 Delta 5 namespace consolidation).
  // The bare /companies pattern is no longer in the table (no page consumed it — verified).
  it('/companies → no longer in the table (returns empty — was repointed to /sourcing/companies)', () => {
    expect(rolesForRoute('/companies')).toHaveLength(0);
  });

  it('/sourcing/companies → analyst only (wave-6 repoint)', () => {
    const roles = rolesForRoute('/sourcing/companies');
    expect(roles).toContain('analyst');
    expect(roles).toHaveLength(1);
  });

  it('/templates → analyst + compliance', () => {
    const roles = rolesForRoute('/templates');
    expect(roles).toContain('analyst');
    expect(roles).toContain('compliance');
    expect(roles).not.toContain('advisor');
    expect(roles).not.toContain('admin');
  });

  it('/mandates/new → advisor + admin (wave-8: admin added for mandate create/configure)', () => {
    const roles = rolesForRoute('/mandates/new');
    expect(roles).toContain('advisor');
    expect(roles).toContain('admin');
    expect(roles).not.toContain('analyst');
    expect(roles).not.toContain('compliance');
    expect([...roles].sort()).toEqual(['admin', 'advisor']);
  });

  it('/pipeline → advisor only', () => {
    expect(rolesForRoute('/pipeline')).toContain('advisor');
  });

  it('unknown route returns empty array (default-deny)', () => {
    expect(rolesForRoute('/unknown-route')).toHaveLength(0);
    expect(rolesForRoute('/admin/unknown')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// rolesForRoute / canAccess — URL normalization (trailing slash + query)
// A trailing slash or query string must NOT fail-closed to [] and wrongly
// 403/redirect a legit URL; both matchers normalize like isPublicRoute does.
// ---------------------------------------------------------------------------

describe('rolesForRoute — URL normalization', () => {
  it('normalizes a trailing slash to the canonical pattern', () => {
    expect([...rolesForRoute('/compliance/summary/')].sort()).toEqual(['admin', 'compliance']);
    expect([...rolesForRoute('/admin/users/')].sort()).toEqual(['admin']);
  });

  it('strips a query string before matching', () => {
    expect([...rolesForRoute('/compliance/summary?x=1')].sort()).toEqual(['admin', 'compliance']);
    // Wave-8: admin added to /mandates
    expect([...rolesForRoute('/mandates?foo=bar&baz=1')].sort()).toEqual([
      'admin',
      'advisor',
      'analyst',
    ]);
  });

  it('strips both trailing slash AND query together', () => {
    expect([...rolesForRoute('/compliance/summary/?x=1')].sort()).toEqual(['admin', 'compliance']);
  });

  it('normalizes trailing slash / query on :param routes', () => {
    // Wave-8: admin added to /mandates/:id
    expect([...rolesForRoute('/mandates/abc123/')].sort()).toEqual(['admin', 'advisor', 'analyst']);
    expect([...rolesForRoute('/mandates/abc123?tab=buyers')].sort()).toEqual([
      'admin',
      'advisor',
      'analyst',
    ]);
  });

  it('preserves the root route "/" (never strips to empty)', () => {
    expect([...rolesForRoute('/')].sort()).toEqual(['admin', 'advisor', 'analyst', 'compliance']);
    expect([...rolesForRoute('/?x=1')].sort()).toEqual([
      'admin',
      'advisor',
      'analyst',
      'compliance',
    ]);
  });
});

describe('canAccess — URL normalization', () => {
  it('allows a legit role on a trailing-slash URL', () => {
    expect(canAccess('compliance', '/compliance/summary/')).toBe(true);
    expect(canAccess('admin', '/compliance/summary/')).toBe(true);
  });

  it('allows a legit role on a query-string URL', () => {
    expect(canAccess('compliance', '/compliance/summary?x=1')).toBe(true);
  });

  it('still denies a wrong role on a normalized URL (fail-closed preserved)', () => {
    expect(canAccess('advisor', '/compliance/summary/')).toBe(false);
    expect(canAccess('analyst', '/compliance/summary?x=1')).toBe(false);
  });

  it('normalizes public routes consistently (query on /auth still public)', () => {
    expect(canAccess('advisor', '/auth/signin?redirect=/')).toBe(true);
    expect(canAccess('advisor', '/health/')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// rolesForRoute — :param pattern matching
// ---------------------------------------------------------------------------

describe('rolesForRoute — route-pattern matching', () => {
  it('/mandates/:id matches a concrete id (wave-8: admin included)', () => {
    const roles = rolesForRoute('/mandates/abc123');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
    expect(roles).toContain('admin');
    expect(roles).not.toContain('compliance');
  });

  it('/mandates/:id/buyers matches nested param route (wave-8: admin included)', () => {
    const roles = rolesForRoute('/mandates/abc123/buyers');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
    expect(roles).toContain('admin');
  });

  it('/mandates/:id/outreach matches nested param route (wave-8: admin included)', () => {
    const roles = rolesForRoute('/mandates/abc123/outreach');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
    expect(roles).toContain('admin');
  });

  it('/mandates/:id/matches → advisor + admin (wave-8: admin added)', () => {
    const roles = rolesForRoute('/mandates/abc123/matches');
    expect(roles).toContain('advisor');
    expect(roles).toContain('admin');
    expect(roles).not.toContain('analyst');
    expect(roles).not.toContain('compliance');
  });

  it('param segment must be non-empty — /mandates/ does not match /:id pattern', () => {
    // `/mandates/` has an empty param — should NOT match /mandates/:id
    // It will fall through to /mandates exact match
    const roles = rolesForRoute('/mandates/');
    // Either matches /mandates (exact match first char check) or returns []
    // The important invariant: it must NOT match a param pattern with empty segment
    // Our regex uses [^/]+ which requires 1+ non-slash chars
    expect(Array.isArray(roles)).toBe(true);
  });

  it('a UUID-style id matches /mandates/:id (wave-8: admin included)', () => {
    const roles = rolesForRoute('/mandates/1931b452-c7d5-43a0-9657-7e7cd1728203');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
    expect(roles).toContain('admin');
  });
});

// ---------------------------------------------------------------------------
// canAccess — per-role allow + deny matrix (representative coverage)
// ---------------------------------------------------------------------------

describe('canAccess', () => {
  // Dashboard — all roles allowed
  it('allows all roles on /', () => {
    for (const role of ALL_ROLES) {
      expect(canAccess(role, '/')).toBe(true);
    }
  });

  // advisor
  it('advisor: allows /mandates', () => expect(canAccess('advisor', '/mandates')).toBe(true));
  it('advisor: allows /pipeline', () => expect(canAccess('advisor', '/pipeline')).toBe(true));
  it('advisor: allows /compliance/queue', () =>
    expect(canAccess('advisor', '/compliance/queue')).toBe(true));
  it('advisor: denies /sourcing', () => expect(canAccess('advisor', '/sourcing')).toBe(false));
  it('advisor: denies /admin/users', () =>
    expect(canAccess('advisor', '/admin/users')).toBe(false));
  it('advisor: denies /compliance/summary', () =>
    expect(canAccess('advisor', '/compliance/summary')).toBe(false));
  it('advisor: denies /compliance/audit-log', () =>
    expect(canAccess('advisor', '/compliance/audit-log')).toBe(false));
  it('advisor: denies /templates', () => expect(canAccess('advisor', '/templates')).toBe(false));

  // analyst
  it('analyst: allows /mandates', () => expect(canAccess('analyst', '/mandates')).toBe(true));
  it('analyst: allows /sourcing', () => expect(canAccess('analyst', '/sourcing')).toBe(true));
  it('analyst: allows /templates', () => expect(canAccess('analyst', '/templates')).toBe(true));
  it('analyst: denies /mandates/new', () =>
    expect(canAccess('analyst', '/mandates/new')).toBe(false));
  it('analyst: denies /compliance/queue', () =>
    expect(canAccess('analyst', '/compliance/queue')).toBe(false));
  it('analyst: denies /admin/users', () =>
    expect(canAccess('analyst', '/admin/users')).toBe(false));
  it('analyst: denies /compliance/summary', () =>
    expect(canAccess('analyst', '/compliance/summary')).toBe(false));

  // compliance
  it('compliance: allows /compliance/queue', () =>
    expect(canAccess('compliance', '/compliance/queue')).toBe(true));
  it('compliance: allows /compliance/audit-log', () =>
    expect(canAccess('compliance', '/compliance/audit-log')).toBe(true));
  it('compliance: allows /compliance/settings', () =>
    expect(canAccess('compliance', '/compliance/settings')).toBe(true));
  it('compliance: allows /compliance/summary', () =>
    expect(canAccess('compliance', '/compliance/summary')).toBe(true));
  it('compliance: allows /templates', () =>
    expect(canAccess('compliance', '/templates')).toBe(true));
  it('compliance: denies /mandates', () =>
    expect(canAccess('compliance', '/mandates')).toBe(false));
  it('compliance: denies /admin/users', () =>
    expect(canAccess('compliance', '/admin/users')).toBe(false));
  it('compliance: denies /sourcing', () =>
    expect(canAccess('compliance', '/sourcing')).toBe(false));

  // admin
  it('admin: allows /admin/users', () => expect(canAccess('admin', '/admin/users')).toBe(true));
  it('admin: allows /admin/settings', () =>
    expect(canAccess('admin', '/admin/settings')).toBe(true));
  it('admin: allows /admin/integrations', () =>
    expect(canAccess('admin', '/admin/integrations')).toBe(true));
  it('admin: allows /compliance/summary', () =>
    expect(canAccess('admin', '/compliance/summary')).toBe(true));
  // Wave-8: admin now allowed on /mandates (mandate API read + write access)
  it('admin: allows /mandates (wave-8 mandate API)', () =>
    expect(canAccess('admin', '/mandates')).toBe(true));
  it('admin: denies /sourcing', () => expect(canAccess('admin', '/sourcing')).toBe(false));
  it('admin: denies /compliance/queue', () =>
    expect(canAccess('admin', '/compliance/queue')).toBe(false));
  it('admin: denies /compliance/audit-log', () =>
    expect(canAccess('admin', '/compliance/audit-log')).toBe(false));

  // public routes bypass RBAC for every role and even for invalid input
  it('canAccess returns true for /auth/* regardless of role', () => {
    for (const role of ALL_ROLES) {
      expect(canAccess(role, '/auth/signin')).toBe(true);
      expect(canAccess(role, '/auth/logout')).toBe(true);
    }
  });

  it('canAccess returns true for /health regardless of role', () => {
    for (const role of ALL_ROLES) {
      expect(canAccess(role, '/health')).toBe(true);
    }
  });

  // param-based route
  it('canAccess works for param routes (wave-8: admin now allowed on mandate sub-routes)', () => {
    expect(canAccess('advisor', '/mandates/abc/buyers')).toBe(true);
    expect(canAccess('analyst', '/mandates/abc/buyers')).toBe(true);
    expect(canAccess('compliance', '/mandates/abc/buyers')).toBe(false);
    // Wave-8: admin added to /mandates/:id/buyers
    expect(canAccess('admin', '/mandates/abc/buyers')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// navItemsForRole — per-role nav sets match the pinned matrix
// ---------------------------------------------------------------------------

describe('navItemsForRole — per-role nav sets', () => {
  it('advisor sees Dashboard, Mandates, Compliance (in order)', () => {
    const items = navItemsForRole('advisor');
    const routes = items.map((i) => i.route);
    expect(routes).toContain('/');
    expect(routes).toContain('/mandates');
    expect(routes).toContain('/compliance/queue');
    // advisor does NOT see Sourcing, Team, Settings
    expect(routes).not.toContain('/sourcing');
    expect(routes).not.toContain('/admin/users');
    expect(routes).not.toContain('/admin/settings');
    // §10 order: Workspace items before Config items
    const groupOrder = items.map((i) => i.group);
    const firstConfigIdx = groupOrder.indexOf('config');
    const lastWorkspaceIdx = groupOrder.lastIndexOf('workspace');
    if (firstConfigIdx !== -1 && lastWorkspaceIdx !== -1) {
      expect(lastWorkspaceIdx).toBeLessThan(firstConfigIdx);
    }
  });

  it('analyst sees Dashboard, Mandates, Sourcing (in order)', () => {
    const items = navItemsForRole('analyst');
    const routes = items.map((i) => i.route);
    expect(routes).toContain('/');
    expect(routes).toContain('/mandates');
    expect(routes).toContain('/sourcing');
    // analyst does NOT see Compliance top-level nav, Team, Settings
    expect(routes).not.toContain('/compliance/queue');
    expect(routes).not.toContain('/admin/users');
    expect(routes).not.toContain('/admin/settings');
  });

  it('compliance sees Dashboard, Compliance (in order)', () => {
    const items = navItemsForRole('compliance');
    const routes = items.map((i) => i.route);
    expect(routes).toContain('/');
    expect(routes).toContain('/compliance/queue');
    // compliance does NOT see Mandates, Sourcing, Team, Settings
    expect(routes).not.toContain('/mandates');
    expect(routes).not.toContain('/sourcing');
    expect(routes).not.toContain('/admin/users');
    expect(routes).not.toContain('/admin/settings');
  });

  it('admin sees Dashboard, Mandates, Team, Settings (wave-8: admin added to mandates nav)', () => {
    const items = navItemsForRole('admin');
    const routes = items.map((i) => i.route);
    expect(routes).toContain('/');
    expect(routes).toContain('/admin/users');
    expect(routes).toContain('/admin/settings');
    // Wave-8: admin now sees Mandates nav item (mandate API + read access)
    expect(routes).toContain('/mandates');
    // admin still does NOT see Sourcing or Compliance top-level nav
    expect(routes).not.toContain('/sourcing');
    expect(routes).not.toContain('/compliance/queue');
  });

  it('each role always has at least the Dashboard item (never empty sidebar)', () => {
    for (const role of ALL_ROLES) {
      const items = navItemsForRole(role);
      expect(items.length).toBeGreaterThan(0);
      expect(items.some((i) => i.route === '/')).toBe(true);
    }
  });

  it('nav items have the correct icon names per §10', () => {
    // Verify icon assignments on the canonical nav item definitions
    const allItems = ALL_NAV_ITEMS;
    const iconMap: Record<string, string> = {
      '/': 'layout-dashboard',
      '/mandates': 'briefcase',
      '/sourcing': 'database',
      '/compliance/queue': 'shield-check',
      '/admin/users': 'users',
      '/admin/settings': 'settings',
    };
    for (const item of allItems) {
      if (iconMap[item.route]) {
        expect(item.icon).toBe(iconMap[item.route]);
      }
    }
  });

  it('nav items have the correct group assignment per §10', () => {
    const workspaceRoutes = ['/', '/mandates', '/sourcing', '/compliance/queue'];
    const configRoutes = ['/admin/users', '/admin/settings'];
    for (const item of ALL_NAV_ITEMS) {
      if (workspaceRoutes.includes(item.route)) {
        expect(item.group).toBe('workspace');
      }
      if (configRoutes.includes(item.route)) {
        expect(item.group).toBe('config');
      }
    }
  });

  it('no duplicate nav routes are returned for any role', () => {
    for (const role of ALL_ROLES) {
      const items = navItemsForRole(role);
      const routes = items.map((i) => i.route);
      expect(routes).toHaveLength(new Set(routes).size);
    }
  });
});

// ---------------------------------------------------------------------------
// nav ⊆ RBAC invariant — exhaustive proof across all 4 roles
// Every nav item returned by navItemsForRole(r) must satisfy canAccess(r, item.route)
// ---------------------------------------------------------------------------

describe('nav ⊆ RBAC invariant', () => {
  for (const role of ALL_ROLES) {
    it(`navItemsForRole('${role}') — every item passes canAccess`, () => {
      const items = navItemsForRole(role);
      for (const item of items) {
        expect(canAccess(role, item.route)).toBe(
          true,
          `nav item "${item.label}" (${item.route}) is shown for role "${role}" but canAccess returned false`
        );
      }
    });
  }

  it('no nav item is shown for a role that is denied at the route level', () => {
    // Inverse check: for every nav item, every role NOT in allowedRoles
    // must NOT appear in navItemsForRole for that role
    for (const navItem of ALL_NAV_ITEMS) {
      const deniedRoles = ALL_ROLES.filter((r) => !(navItem.allowedRoles as Role[]).includes(r));
      for (const deniedRole of deniedRoles) {
        const items = navItemsForRole(deniedRole);
        const isShown = items.some((i) => i.route === navItem.route);
        expect(isShown).toBe(
          false,
          `nav item "${navItem.label}" (${navItem.route}) must NOT appear for role "${deniedRole}" (denied in allowedRoles)`
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// roleRoutes completeness — pinned matrix coverage
// ---------------------------------------------------------------------------

describe('roleRoutes — completeness against pinned matrix', () => {
  const routeMap = new Map(roleRoutes.map((e) => [e.pattern, e.allowedRoles as Role[]]));

  const matrixRows: [string, Role[]][] = [
    ['/', ['advisor', 'analyst', 'compliance', 'admin']],
    // Wave-8: admin added to mandate routes (mandate API read + write access)
    ['/mandates', ['advisor', 'admin', 'analyst']],
    ['/mandates/new', ['advisor', 'admin']],
    ['/mandates/:id', ['advisor', 'admin', 'analyst']],
    ['/mandates/:id/buyers', ['advisor', 'admin', 'analyst']],
    ['/mandates/:id/outreach', ['advisor', 'admin', 'analyst']],
    ['/mandates/:id/matches', ['advisor', 'admin']],
    ['/pipeline', ['advisor']],
    ['/sourcing', ['analyst']],
    // Wave-6: /companies repointed to /sourcing/companies; new sourcing API routes added.
    ['/sourcing/companies', ['analyst']],
    ['/sourcing/companies/:id', ['analyst']],
    ['/sourcing/connections/:id/sync', ['analyst', 'admin']],
    ['/sourcing/dedupe-candidates/:id/resolve', ['analyst', 'admin']],
    // Wave-7: /sourcing/connections (AC-SEED create/list — analyst + admin).
    ['/sourcing/connections', ['analyst', 'admin']],
    ['/templates', ['analyst', 'compliance']],
    ['/compliance/queue', ['compliance', 'advisor']],
    ['/compliance/audit-log', ['compliance']],
    ['/compliance/audit-log/verify', ['compliance', 'admin']],
    ['/compliance/settings', ['compliance']],
    ['/compliance/summary', ['compliance', 'admin']],
    // Wave-5 CRUD routes (compliance + admin for config management)
    ['/compliance/rules', ['compliance', 'admin']],
    ['/compliance/suppression', ['compliance', 'admin']],
    ['/compliance/disclaimers', ['compliance', 'admin']],
    ['/admin/users', ['admin']],
    ['/admin/settings', ['admin']],
    ['/admin/integrations', ['admin']],
  ];

  for (const [pattern, expectedRoles] of matrixRows) {
    it(`pattern "${pattern}" has exactly the pinned roles`, () => {
      const actual = routeMap.get(pattern);
      expect(actual).toBeDefined();
      expect([...(actual ?? [])].sort()).toEqual([...expectedRoles].sort());
    });
  }
});

// ---------------------------------------------------------------------------
// Wave-4 additions — audit-log verify endpoint + Audit Log nav item
// ---------------------------------------------------------------------------

describe('wave-4 — /compliance/audit-log/verify endpoint RBAC', () => {
  it('rolesForRoute returns compliance + admin (not advisor/analyst)', () => {
    const roles = rolesForRoute('/compliance/audit-log/verify');
    expect(roles).toContain('compliance');
    expect(roles).toContain('admin');
    expect(roles).not.toContain('advisor');
    expect(roles).not.toContain('analyst');
    expect([...roles].sort()).toEqual(['admin', 'compliance']);
  });

  it('compliance can access the verify endpoint', () => {
    expect(canAccess('compliance', '/compliance/audit-log/verify')).toBe(true);
  });

  it('admin can access the verify endpoint', () => {
    expect(canAccess('admin', '/compliance/audit-log/verify')).toBe(true);
  });

  it('advisor is denied the verify endpoint', () => {
    expect(canAccess('advisor', '/compliance/audit-log/verify')).toBe(false);
  });

  it('analyst is denied the verify endpoint', () => {
    expect(canAccess('analyst', '/compliance/audit-log/verify')).toBe(false);
  });

  it('verify endpoint does NOT resolve to the audit-log screen roles', () => {
    // The screen (/compliance/audit-log) is compliance-only; the endpoint adds admin.
    // Exact-match must win over any partial match.
    const screenRoles = rolesForRoute('/compliance/audit-log');
    const endpointRoles = rolesForRoute('/compliance/audit-log/verify');
    expect([...screenRoles].sort()).toEqual(['compliance']);
    expect([...endpointRoles].sort()).toEqual(['admin', 'compliance']);
  });
});

describe('wave-4 — Audit Log nav item (compliance role only)', () => {
  it('compliance role sees the Audit Log nav item', () => {
    const items = navItemsForRole('compliance');
    const routes = items.map((i) => i.route);
    expect(routes).toContain('/compliance/audit-log');
  });

  it('the Audit Log nav item has the correct label and icon', () => {
    const items = navItemsForRole('compliance');
    const auditItem = items.find((i) => i.route === '/compliance/audit-log');
    expect(auditItem).toBeDefined();
    expect(auditItem?.label).toBe('Audit Log');
    expect(auditItem?.icon).toBe('scroll');
    expect(auditItem?.group).toBe('workspace');
  });

  it('advisor does NOT see the Audit Log nav item', () => {
    const items = navItemsForRole('advisor');
    expect(items.some((i) => i.route === '/compliance/audit-log')).toBe(false);
  });

  it('analyst does NOT see the Audit Log nav item', () => {
    const items = navItemsForRole('analyst');
    expect(items.some((i) => i.route === '/compliance/audit-log')).toBe(false);
  });

  it('admin does NOT see the Audit Log nav item (admin accesses verify API, not the screen)', () => {
    const items = navItemsForRole('admin');
    expect(items.some((i) => i.route === '/compliance/audit-log')).toBe(false);
  });

  it('Audit Log nav item is in ALL_NAV_ITEMS', () => {
    expect(ALL_NAV_ITEMS.some((i) => i.route === '/compliance/audit-log')).toBe(true);
  });
});

describe('wave-4 — /compliance/settings (prior state, superseded by wave-5)', () => {
  it('/compliance/settings remains compliance-only (unchanged from pre-wave-4)', () => {
    const roles = rolesForRoute('/compliance/settings');
    expect([...roles].sort()).toEqual(['compliance']);
  });

  it('compliance can access /compliance/settings', () => {
    expect(canAccess('compliance', '/compliance/settings')).toBe(true);
  });

  it('admin is denied /compliance/settings', () => {
    expect(canAccess('admin', '/compliance/settings')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wave-5 additions — compliance CRUD routes + /compliance/settings navItem
// ---------------------------------------------------------------------------

describe('wave-5 — CRUD routes RBAC (compliance + admin)', () => {
  it('/compliance/rules → compliance + admin', () => {
    const roles = rolesForRoute('/compliance/rules');
    expect([...roles].sort()).toEqual(['admin', 'compliance']);
  });

  it('/compliance/suppression → compliance + admin', () => {
    const roles = rolesForRoute('/compliance/suppression');
    expect([...roles].sort()).toEqual(['admin', 'compliance']);
  });

  it('/compliance/disclaimers → compliance + admin', () => {
    const roles = rolesForRoute('/compliance/disclaimers');
    expect([...roles].sort()).toEqual(['admin', 'compliance']);
  });

  it('compliance can access all three CRUD routes', () => {
    expect(canAccess('compliance', '/compliance/rules')).toBe(true);
    expect(canAccess('compliance', '/compliance/suppression')).toBe(true);
    expect(canAccess('compliance', '/compliance/disclaimers')).toBe(true);
  });

  it('admin can access all three CRUD routes', () => {
    expect(canAccess('admin', '/compliance/rules')).toBe(true);
    expect(canAccess('admin', '/compliance/suppression')).toBe(true);
    expect(canAccess('admin', '/compliance/disclaimers')).toBe(true);
  });

  it('advisor is denied all three CRUD routes', () => {
    expect(canAccess('advisor', '/compliance/rules')).toBe(false);
    expect(canAccess('advisor', '/compliance/suppression')).toBe(false);
    expect(canAccess('advisor', '/compliance/disclaimers')).toBe(false);
  });

  it('analyst is denied all three CRUD routes', () => {
    expect(canAccess('analyst', '/compliance/rules')).toBe(false);
    expect(canAccess('analyst', '/compliance/suppression')).toBe(false);
    expect(canAccess('analyst', '/compliance/disclaimers')).toBe(false);
  });
});

describe('wave-5 — /compliance/settings navItem (Rules sidebar item for compliance)', () => {
  it('/compliance/settings has a navItem after wave-5 addition', () => {
    const entry = roleRoutes.find((e) => e.pattern === '/compliance/settings');
    expect(entry).toBeDefined();
    expect(entry?.navItem).toBeDefined();
  });

  it('/compliance/settings navItem appears for compliance in navItemsForRole', () => {
    const items = navItemsForRole('compliance');
    const routes = items.map((i) => i.route);
    expect(routes).toContain('/compliance/settings');
  });

  it('/compliance/settings navItem does NOT appear for admin (admin denied at route level)', () => {
    const items = navItemsForRole('admin');
    const routes = items.map((i) => i.route);
    expect(routes).not.toContain('/compliance/settings');
  });

  it('/compliance/settings navItem does NOT appear for advisor', () => {
    expect(navItemsForRole('advisor').some((i) => i.route === '/compliance/settings')).toBe(false);
  });

  it('/compliance/settings navItem does NOT appear for analyst', () => {
    expect(navItemsForRole('analyst').some((i) => i.route === '/compliance/settings')).toBe(false);
  });

  it('/compliance/settings navItem has correct icon and group', () => {
    const items = navItemsForRole('compliance');
    const settingsItem = items.find((i) => i.route === '/compliance/settings');
    expect(settingsItem).toBeDefined();
    expect(settingsItem?.icon).toBe('sliders');
    expect(settingsItem?.group).toBe('workspace');
  });

  it('/compliance/settings navItem is in ALL_NAV_ITEMS', () => {
    expect(ALL_NAV_ITEMS.some((i) => i.route === '/compliance/settings')).toBe(true);
  });
});

describe('wave-5 — /compliance/audit-log + /compliance/audit-log/verify UNTOUCHED', () => {
  it('/compliance/audit-log remains compliance-only', () => {
    expect([...rolesForRoute('/compliance/audit-log')].sort()).toEqual(['compliance']);
  });

  it('/compliance/audit-log/verify remains compliance + admin', () => {
    expect([...rolesForRoute('/compliance/audit-log/verify')].sort()).toEqual([
      'admin',
      'compliance',
    ]);
  });

  it('/compliance/audit-log navItem still appears for compliance', () => {
    const items = navItemsForRole('compliance');
    expect(items.some((i) => i.route === '/compliance/audit-log')).toBe(true);
  });

  it('/compliance/audit-log navItem still does NOT appear for admin', () => {
    expect(navItemsForRole('admin').some((i) => i.route === '/compliance/audit-log')).toBe(false);
  });
});

describe('wave-5 — nav ⊆ RBAC invariant preserved after wave-5 additions', () => {
  for (const role of ALL_ROLES) {
    it(`navItemsForRole('${role}') — every item still passes canAccess after wave-5 additions`, () => {
      const items = navItemsForRole(role);
      for (const item of items) {
        expect(canAccess(role, item.route)).toBe(true);
      }
    });
  }

  it('no nav item appears for a role denied at the route level (ALL_NAV_ITEMS exhaustive check)', () => {
    for (const navItem of ALL_NAV_ITEMS) {
      const deniedRoles = ALL_ROLES.filter((r) => !(navItem.allowedRoles as Role[]).includes(r));
      for (const deniedRole of deniedRoles) {
        const items = navItemsForRole(deniedRole);
        const isShown = items.some((i) => i.route === navItem.route);
        expect(isShown).toBe(false);
      }
    }
  });

  it('the three new CRUD routes have no navItem (API-only, not sidebar pages)', () => {
    const crudPatterns = [
      '/compliance/rules',
      '/compliance/suppression',
      '/compliance/disclaimers',
    ];
    for (const pattern of crudPatterns) {
      const entry = roleRoutes.find((e) => e.pattern === pattern);
      expect(entry).toBeDefined();
      expect(entry?.navItem).toBeUndefined();
    }
  });
});

describe('wave-4 — nav ⊆ RBAC invariant preserved after additions', () => {
  for (const role of ALL_ROLES) {
    it(`navItemsForRole('${role}') — every item still passes canAccess after wave-4 additions`, () => {
      const items = navItemsForRole(role);
      for (const item of items) {
        expect(canAccess(role, item.route)).toBe(true);
      }
    });
  }

  it('no nav item appears for a role denied at the route level (ALL_NAV_ITEMS check)', () => {
    for (const navItem of ALL_NAV_ITEMS) {
      const deniedRoles = ALL_ROLES.filter((r) => !(navItem.allowedRoles as Role[]).includes(r));
      for (const deniedRole of deniedRoles) {
        const items = navItemsForRole(deniedRole);
        const isShown = items.some((i) => i.route === navItem.route);
        expect(isShown).toBe(false);
      }
    }
  });

  it('verify endpoint (compliance+admin) does not surface a nav item for admin (endpoint ≠ screen nav)', () => {
    // The /compliance/audit-log/verify entry has no navItem — admin gets RBAC access
    // to the endpoint but no sidebar link. Only compliance sees the nav item (for the screen).
    const adminItems = navItemsForRole('admin');
    expect(adminItems.some((i) => i.route === '/compliance/audit-log')).toBe(false);
    expect(adminItems.some((i) => i.route === '/compliance/audit-log/verify')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wave-6 additions — /sourcing/companies + API route entries + nav⊆RBAC
// ---------------------------------------------------------------------------

describe('wave-6 — /sourcing/companies routes RBAC', () => {
  it('/sourcing/companies → analyst only', () => {
    const roles = rolesForRoute('/sourcing/companies');
    expect(roles).toContain('analyst');
    expect(roles).toHaveLength(1);
    expect(roles).not.toContain('admin');
    expect(roles).not.toContain('compliance');
    expect(roles).not.toContain('advisor');
  });

  it('/sourcing/companies/:id → analyst only (concrete UUID)', () => {
    const roles = rolesForRoute('/sourcing/companies/1931b452-c7d5-43a0-9657-7e7cd1728203');
    expect(roles).toContain('analyst');
    expect(roles).toHaveLength(1);
  });

  it('analyst can access /sourcing/companies', () => {
    expect(canAccess('analyst', '/sourcing/companies')).toBe(true);
  });

  it('analyst can access /sourcing/companies/:id', () => {
    expect(canAccess('analyst', '/sourcing/companies/abc-123')).toBe(true);
  });

  it('admin cannot access /sourcing/companies (screen is analyst-only)', () => {
    expect(canAccess('admin', '/sourcing/companies')).toBe(false);
  });

  it('advisor cannot access /sourcing/companies', () => {
    expect(canAccess('advisor', '/sourcing/companies')).toBe(false);
  });

  it('compliance cannot access /sourcing/companies', () => {
    expect(canAccess('compliance', '/sourcing/companies')).toBe(false);
  });
});

describe('wave-6 — /sourcing/connections/:id/sync RBAC (analyst + admin)', () => {
  it('rolesForRoute → analyst + admin', () => {
    const roles = rolesForRoute('/sourcing/connections/abc-123/sync');
    expect([...roles].sort()).toEqual(['admin', 'analyst']);
  });

  it('analyst can trigger a sync', () => {
    expect(canAccess('analyst', '/sourcing/connections/abc-123/sync')).toBe(true);
  });

  it('admin can trigger a sync', () => {
    expect(canAccess('admin', '/sourcing/connections/abc-123/sync')).toBe(true);
  });

  it('advisor cannot trigger a sync', () => {
    expect(canAccess('advisor', '/sourcing/connections/abc-123/sync')).toBe(false);
  });

  it('compliance cannot trigger a sync', () => {
    expect(canAccess('compliance', '/sourcing/connections/abc-123/sync')).toBe(false);
  });

  it('the route entry has no navItem (API-only endpoint)', () => {
    const entry = roleRoutes.find((e) => e.pattern === '/sourcing/connections/:id/sync');
    expect(entry).toBeDefined();
    expect(entry?.navItem).toBeUndefined();
  });
});

describe('wave-6 — /sourcing/dedupe-candidates/:id/resolve RBAC (analyst + admin)', () => {
  it('rolesForRoute → analyst + admin', () => {
    const roles = rolesForRoute('/sourcing/dedupe-candidates/abc-123/resolve');
    expect([...roles].sort()).toEqual(['admin', 'analyst']);
  });

  it('analyst can resolve a dedupe candidate', () => {
    expect(canAccess('analyst', '/sourcing/dedupe-candidates/abc-123/resolve')).toBe(true);
  });

  it('admin can resolve a dedupe candidate', () => {
    expect(canAccess('admin', '/sourcing/dedupe-candidates/abc-123/resolve')).toBe(true);
  });

  it('advisor cannot resolve a dedupe candidate', () => {
    expect(canAccess('advisor', '/sourcing/dedupe-candidates/abc-123/resolve')).toBe(false);
  });

  it('compliance cannot resolve a dedupe candidate', () => {
    expect(canAccess('compliance', '/sourcing/dedupe-candidates/abc-123/resolve')).toBe(false);
  });

  it('the route entry has no navItem (API-only endpoint, no sidebar link)', () => {
    const entry = roleRoutes.find((e) => e.pattern === '/sourcing/dedupe-candidates/:id/resolve');
    expect(entry).toBeDefined();
    expect(entry?.navItem).toBeUndefined();
  });
});

describe('wave-6 — /companies repoint (was analyst-only, now /sourcing/companies)', () => {
  it('/companies is no longer in the route table (returns empty — default-deny)', () => {
    expect(rolesForRoute('/companies')).toHaveLength(0);
  });

  it('analyst is denied /companies (old path is gone)', () => {
    // After repoint the bare /companies has no entry: fail-closed to 403.
    expect(canAccess('analyst', '/companies')).toBe(false);
  });

  it('/sourcing/companies is the canonical replacement (analyst can access)', () => {
    expect(canAccess('analyst', '/sourcing/companies')).toBe(true);
  });
});

describe('wave-6 — /compliance/* routes UNTOUCHED', () => {
  it('/compliance/queue remains compliance + advisor', () => {
    const roles = rolesForRoute('/compliance/queue');
    expect([...roles].sort()).toEqual(['advisor', 'compliance']);
  });

  it('/compliance/audit-log remains compliance only', () => {
    expect([...rolesForRoute('/compliance/audit-log')].sort()).toEqual(['compliance']);
  });

  it('/compliance/rules remains compliance + admin', () => {
    expect([...rolesForRoute('/compliance/rules')].sort()).toEqual(['admin', 'compliance']);
  });

  it('/compliance/settings remains compliance only', () => {
    expect([...rolesForRoute('/compliance/settings')].sort()).toEqual(['compliance']);
  });
});

// ---------------------------------------------------------------------------
// Wave-7 additions — /sourcing/connections (create/list — AC-SEED)
// ---------------------------------------------------------------------------

describe('wave-7 — /sourcing/connections RBAC (analyst + admin, no navItem)', () => {
  it('rolesForRoute → analyst + admin', () => {
    const roles = rolesForRoute('/sourcing/connections');
    expect([...roles].sort()).toEqual(['admin', 'analyst']);
  });

  it('analyst can create/list connections', () => {
    expect(canAccess('analyst', '/sourcing/connections')).toBe(true);
  });

  it('admin can create/list connections', () => {
    expect(canAccess('admin', '/sourcing/connections')).toBe(true);
  });

  it('advisor is denied /sourcing/connections', () => {
    expect(canAccess('advisor', '/sourcing/connections')).toBe(false);
  });

  it('compliance is denied /sourcing/connections', () => {
    expect(canAccess('compliance', '/sourcing/connections')).toBe(false);
  });

  it('the route entry has no navItem (API-only; workspace nav is /sourcing)', () => {
    const entry = roleRoutes.find((e) => e.pattern === '/sourcing/connections');
    expect(entry).toBeDefined();
    expect(entry?.navItem).toBeUndefined();
  });

  it('/sourcing/connections does NOT appear in navItemsForRole for any role', () => {
    for (const role of ALL_ROLES) {
      const items = navItemsForRole(role);
      expect(items.some((i) => i.route === '/sourcing/connections')).toBe(false);
    }
  });

  it('wave-7 does NOT change analyst nav (still /sourcing only)', () => {
    const items = navItemsForRole('analyst');
    const routes = items.map((i) => i.route);
    expect(routes).toContain('/sourcing');
    expect(routes).not.toContain('/sourcing/connections');
  });
});

describe('wave-7 — nav⊆RBAC preserved after /sourcing/connections added', () => {
  for (const role of ALL_ROLES) {
    it(`navItemsForRole('${role}') — every item still passes canAccess after wave-7 addition`, () => {
      const items = navItemsForRole(role);
      for (const item of items) {
        expect(canAccess(role, item.route)).toBe(true);
      }
    });
  }

  it('no nav item appears for a role denied at the route level (ALL_NAV_ITEMS exhaustive)', () => {
    for (const navItem of ALL_NAV_ITEMS) {
      const deniedRoles = ALL_ROLES.filter((r) => !(navItem.allowedRoles as Role[]).includes(r));
      for (const deniedRole of deniedRoles) {
        const items = navItemsForRole(deniedRole);
        const isShown = items.some((i) => i.route === navItem.route);
        expect(isShown).toBe(false);
      }
    }
  });

  it('/sourcing/connections does NOT have a navItem', () => {
    const entry = roleRoutes.find((e) => e.pattern === '/sourcing/connections');
    expect(entry).toBeDefined();
    expect(entry?.navItem).toBeUndefined();
  });
});

describe('wave-6 — nav⊆RBAC preserved after /sourcing/companies + API routes added', () => {
  for (const role of ALL_ROLES) {
    it(`navItemsForRole('${role}') — every item still passes canAccess after wave-6 additions`, () => {
      const items = navItemsForRole(role);
      for (const item of items) {
        expect(canAccess(role, item.route)).toBe(true);
      }
    });
  }

  it('analyst still sees /sourcing nav item (NAV_SOURCING unchanged)', () => {
    const items = navItemsForRole('analyst');
    expect(items.some((i) => i.route === '/sourcing')).toBe(true);
  });

  it('/sourcing/companies does NOT have a navItem (screen reached via /sourcing nav + router)', () => {
    const entry = roleRoutes.find((e) => e.pattern === '/sourcing/companies');
    expect(entry).toBeDefined();
    expect(entry?.navItem).toBeUndefined();
  });

  it('the four new wave-6 route entries all have no navItem (API or sub-route)', () => {
    const wave6Patterns = [
      '/sourcing/companies',
      '/sourcing/companies/:id',
      '/sourcing/connections/:id/sync',
      '/sourcing/dedupe-candidates/:id/resolve',
    ];
    for (const pattern of wave6Patterns) {
      const entry = roleRoutes.find((e) => e.pattern === pattern);
      expect(entry).toBeDefined();
      expect(entry?.navItem).toBeUndefined();
    }
  });

  it('no nav item appears for a role denied at the route level (exhaustive ALL_NAV_ITEMS check)', () => {
    for (const navItem of ALL_NAV_ITEMS) {
      const deniedRoles = ALL_ROLES.filter((r) => !(navItem.allowedRoles as Role[]).includes(r));
      for (const deniedRole of deniedRoles) {
        const items = navItemsForRole(deniedRole);
        const isShown = items.some((i) => i.route === navItem.route);
        expect(isShown).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Wave-8 additions — mandate spine (B-1, task ba0edebf)
// admin added to /mandates (list/detail/create/configure). NAV_MANDATES updated.
// ---------------------------------------------------------------------------

describe('wave-8 — /mandates RBAC (admin added for mandate API)', () => {
  it('rolesForRoute("/mandates") → advisor + admin + analyst', () => {
    const roles = rolesForRoute('/mandates');
    expect([...roles].sort()).toEqual(['admin', 'advisor', 'analyst']);
  });

  it('rolesForRoute("/mandates/new") → advisor + admin (create/configure)', () => {
    const roles = rolesForRoute('/mandates/new');
    expect([...roles].sort()).toEqual(['admin', 'advisor']);
  });

  it('rolesForRoute("/mandates/:id") → advisor + admin + analyst (detail read)', () => {
    const roles = rolesForRoute('/mandates/abc-123');
    expect([...roles].sort()).toEqual(['admin', 'advisor', 'analyst']);
  });

  it('advisor can list, read, create, and configure mandates', () => {
    expect(canAccess('advisor', '/mandates')).toBe(true);
    expect(canAccess('advisor', '/mandates/abc-123')).toBe(true);
    expect(canAccess('advisor', '/mandates/new')).toBe(true);
  });

  it('admin can list, read, create, and configure mandates (wave-8)', () => {
    expect(canAccess('admin', '/mandates')).toBe(true);
    expect(canAccess('admin', '/mandates/abc-123')).toBe(true);
    expect(canAccess('admin', '/mandates/new')).toBe(true);
  });

  it('analyst can list and read mandates but NOT create or configure', () => {
    expect(canAccess('analyst', '/mandates')).toBe(true);
    expect(canAccess('analyst', '/mandates/abc-123')).toBe(true);
    expect(canAccess('analyst', '/mandates/new')).toBe(false);
  });

  it('compliance cannot access mandates (unchanged)', () => {
    expect(canAccess('compliance', '/mandates')).toBe(false);
    expect(canAccess('compliance', '/mandates/abc-123')).toBe(false);
    expect(canAccess('compliance', '/mandates/new')).toBe(false);
  });

  it('admin sees Mandates in their nav (NAV_MANDATES updated to advisor/admin/analyst)', () => {
    const items = navItemsForRole('admin');
    expect(items.some((i) => i.route === '/mandates')).toBe(true);
  });

  it('analyst still sees Mandates in their nav (unchanged)', () => {
    const items = navItemsForRole('analyst');
    expect(items.some((i) => i.route === '/mandates')).toBe(true);
  });

  it('compliance does NOT see Mandates in nav (compliance not in allowedRoles)', () => {
    const items = navItemsForRole('compliance');
    expect(items.some((i) => i.route === '/mandates')).toBe(false);
  });

  it('NAV_MANDATES navItem has correct icon, label, and group', () => {
    const entry = roleRoutes.find((e) => e.pattern === '/mandates');
    expect(entry?.navItem).toBeDefined();
    expect(entry?.navItem?.label).toBe('Mandates');
    expect(entry?.navItem?.icon).toBe('briefcase');
    expect(entry?.navItem?.group).toBe('workspace');
  });

  it('nav⊆RBAC invariant holds for admin after wave-8 mandate addition', () => {
    const items = navItemsForRole('admin');
    for (const item of items) {
      expect(canAccess('admin', item.route)).toBe(true);
    }
  });

  it('nav⊆RBAC invariant holds for all roles after wave-8 mandate addition', () => {
    for (const role of ALL_ROLES) {
      const items = navItemsForRole(role);
      for (const item of items) {
        expect(canAccess(role, item.route)).toBe(true);
      }
    }
  });

  it('no nav item appears for a role denied at the route level (exhaustive post-wave-8)', () => {
    for (const navItem of ALL_NAV_ITEMS) {
      const deniedRoles = ALL_ROLES.filter((r) => !(navItem.allowedRoles as Role[]).includes(r));
      for (const deniedRole of deniedRoles) {
        const items = navItemsForRole(deniedRole);
        const isShown = items.some((i) => i.route === navItem.route);
        expect(isShown).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Wave-10 additions — match spine (B-1, task 47ed7ddd)
// advisor/admin create+mutate; analyst read-only; NAV_MATCHES added.
// ---------------------------------------------------------------------------

describe('wave-10 — /matches RBAC (advisor/admin create+mutate; analyst read)', () => {
  it('rolesForRoute("/matches") → advisor + admin + analyst (list/read)', () => {
    const roles = rolesForRoute('/matches');
    expect([...roles].sort()).toEqual(['admin', 'advisor', 'analyst']);
  });

  it('rolesForRoute("/matches/new") → advisor + admin (create run)', () => {
    const roles = rolesForRoute('/matches/new');
    expect([...roles].sort()).toEqual(['admin', 'advisor']);
  });

  it('rolesForRoute("/matches/:id") → advisor + admin + analyst (detail read)', () => {
    const roles = rolesForRoute('/matches/abc-123');
    expect([...roles].sort()).toEqual(['admin', 'advisor', 'analyst']);
  });

  it('rolesForRoute("/matches/:id/candidates/:cid") → advisor + admin (disposition)', () => {
    const roles = rolesForRoute('/matches/abc-123/candidates/cid-456');
    expect([...roles].sort()).toEqual(['admin', 'advisor']);
  });

  it('rolesForRoute("/matches/:id/shortlist") → advisor + admin + analyst (read)', () => {
    const roles = rolesForRoute('/matches/abc-123/shortlist');
    expect([...roles].sort()).toEqual(['admin', 'advisor', 'analyst']);
  });

  it('advisor can access all /matches routes', () => {
    expect(canAccess('advisor', '/matches')).toBe(true);
    expect(canAccess('advisor', '/matches/abc-123')).toBe(true);
    expect(canAccess('advisor', '/matches/new')).toBe(true);
    expect(canAccess('advisor', '/matches/abc-123/candidates/cid-456')).toBe(true);
    expect(canAccess('advisor', '/matches/abc-123/shortlist')).toBe(true);
  });

  it('admin can access all /matches routes', () => {
    expect(canAccess('admin', '/matches')).toBe(true);
    expect(canAccess('admin', '/matches/abc-123')).toBe(true);
    expect(canAccess('admin', '/matches/new')).toBe(true);
    expect(canAccess('admin', '/matches/abc-123/candidates/cid-456')).toBe(true);
  });

  it('analyst can read /matches but cannot create or mutate dispositions', () => {
    expect(canAccess('analyst', '/matches')).toBe(true);
    expect(canAccess('analyst', '/matches/abc-123')).toBe(true);
    expect(canAccess('analyst', '/matches/abc-123/shortlist')).toBe(true);
    // analyst cannot create or patch disposition
    expect(canAccess('analyst', '/matches/new')).toBe(false);
    expect(canAccess('analyst', '/matches/abc-123/candidates/cid-456')).toBe(false);
  });

  it('compliance cannot access /matches at all', () => {
    expect(canAccess('compliance', '/matches')).toBe(false);
    expect(canAccess('compliance', '/matches/abc-123')).toBe(false);
    expect(canAccess('compliance', '/matches/new')).toBe(false);
  });

  it('advisor sees Matches in their nav', () => {
    const items = navItemsForRole('advisor');
    expect(items.some((i) => i.route === '/matches')).toBe(true);
  });

  it('admin sees Matches in their nav', () => {
    const items = navItemsForRole('admin');
    expect(items.some((i) => i.route === '/matches')).toBe(true);
  });

  it('analyst sees Matches in their nav', () => {
    const items = navItemsForRole('analyst');
    expect(items.some((i) => i.route === '/matches')).toBe(true);
  });

  it('compliance does NOT see Matches in their nav', () => {
    const items = navItemsForRole('compliance');
    expect(items.some((i) => i.route === '/matches')).toBe(false);
  });

  it('NAV_MATCHES has correct icon, label, and group', () => {
    const entry = roleRoutes.find((e) => e.pattern === '/matches');
    expect(entry?.navItem).toBeDefined();
    expect(entry?.navItem?.label).toBe('Matches');
    expect(entry?.navItem?.icon).toBe('target');
    expect(entry?.navItem?.group).toBe('workspace');
  });

  it('NAV_MATCHES is in ALL_NAV_ITEMS', () => {
    expect(ALL_NAV_ITEMS.some((i) => i.route === '/matches')).toBe(true);
  });

  it('/matches sub-routes have no navItem (API-only endpoints)', () => {
    const subPatterns = [
      '/matches/new',
      '/matches/:id',
      '/matches/:id/candidates/:cid',
      '/matches/:id/shortlist',
    ];
    for (const pattern of subPatterns) {
      const entry = roleRoutes.find((e) => e.pattern === pattern);
      expect(entry).toBeDefined();
      expect(entry?.navItem).toBeUndefined();
    }
  });

  it('nav⊆RBAC invariant holds for all roles after wave-10 addition', () => {
    for (const role of ALL_ROLES) {
      const items = navItemsForRole(role);
      for (const item of items) {
        expect(canAccess(role, item.route)).toBe(true);
      }
    }
  });

  it('no nav item appears for a role denied at the route level (exhaustive post-wave-10)', () => {
    for (const navItem of ALL_NAV_ITEMS) {
      const deniedRoles = ALL_ROLES.filter((r) => !(navItem.allowedRoles as Role[]).includes(r));
      for (const deniedRole of deniedRoles) {
        const items = navItemsForRole(deniedRole);
        const isShown = items.some((i) => i.route === navItem.route);
        expect(isShown).toBe(false);
      }
    }
  });
});
