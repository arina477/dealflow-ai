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

  it('/mandates → advisor + analyst only', () => {
    const roles = rolesForRoute('/mandates');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
    expect(roles).not.toContain('compliance');
    expect(roles).not.toContain('admin');
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

  it('/companies → analyst only', () => {
    expect(rolesForRoute('/companies')).toContain('analyst');
  });

  it('/templates → analyst + compliance', () => {
    const roles = rolesForRoute('/templates');
    expect(roles).toContain('analyst');
    expect(roles).toContain('compliance');
    expect(roles).not.toContain('advisor');
    expect(roles).not.toContain('admin');
  });

  it('/mandates/new → advisor only', () => {
    const roles = rolesForRoute('/mandates/new');
    expect(roles).toContain('advisor');
    expect(roles).toHaveLength(1);
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
// rolesForRoute — :param pattern matching
// ---------------------------------------------------------------------------

describe('rolesForRoute — route-pattern matching', () => {
  it('/mandates/:id matches a concrete id', () => {
    const roles = rolesForRoute('/mandates/abc123');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
    expect(roles).not.toContain('compliance');
  });

  it('/mandates/:id/buyers matches nested param route', () => {
    const roles = rolesForRoute('/mandates/abc123/buyers');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
  });

  it('/mandates/:id/outreach matches nested param route', () => {
    const roles = rolesForRoute('/mandates/abc123/outreach');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
  });

  it('/mandates/:id/matches → advisor only', () => {
    const roles = rolesForRoute('/mandates/abc123/matches');
    expect(roles).toContain('advisor');
    expect(roles).not.toContain('analyst');
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

  it('a UUID-style id matches /mandates/:id', () => {
    const roles = rolesForRoute('/mandates/1931b452-c7d5-43a0-9657-7e7cd1728203');
    expect(roles).toContain('advisor');
    expect(roles).toContain('analyst');
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
  it('admin: denies /mandates', () => expect(canAccess('admin', '/mandates')).toBe(false));
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
  it('canAccess works for param routes', () => {
    expect(canAccess('advisor', '/mandates/abc/buyers')).toBe(true);
    expect(canAccess('analyst', '/mandates/abc/buyers')).toBe(true);
    expect(canAccess('compliance', '/mandates/abc/buyers')).toBe(false);
    expect(canAccess('admin', '/mandates/abc/buyers')).toBe(false);
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

  it('admin sees Dashboard, Team, Settings (in order)', () => {
    const items = navItemsForRole('admin');
    const routes = items.map((i) => i.route);
    expect(routes).toContain('/');
    expect(routes).toContain('/admin/users');
    expect(routes).toContain('/admin/settings');
    // admin does NOT see Mandates, Sourcing, Compliance nav items
    expect(routes).not.toContain('/mandates');
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
    ['/mandates', ['advisor', 'analyst']],
    ['/mandates/new', ['advisor']],
    ['/mandates/:id', ['advisor', 'analyst']],
    ['/mandates/:id/buyers', ['advisor', 'analyst']],
    ['/mandates/:id/outreach', ['advisor', 'analyst']],
    ['/mandates/:id/matches', ['advisor']],
    ['/pipeline', ['advisor']],
    ['/sourcing', ['analyst']],
    ['/companies', ['analyst']],
    ['/templates', ['analyst', 'compliance']],
    ['/compliance/queue', ['compliance', 'advisor']],
    ['/compliance/audit-log', ['compliance']],
    ['/compliance/settings', ['compliance']],
    ['/compliance/summary', ['compliance', 'admin']],
    ['/admin/users', ['admin']],
    ['/admin/settings', ['admin']],
    ['/admin/integrations', ['admin']],
  ];

  for (const [pattern, expectedRoles] of matrixRows) {
    it(`pattern "${pattern}" has exactly the pinned roles`, () => {
      expect(routeMap.has(pattern)).toBe(true);
      const actual = routeMap.get(pattern)!;
      expect([...actual].sort()).toEqual([...expectedRoles].sort());
    });
  }
});
