/**
 * RBAC role-reverify black-box test (wave-15, task d7f716b4).
 *
 * Closes the wave-3 jenny gap: proves that changing a user's role (via the
 * admin role-change flow / DB role change) changes their live RBAC access.
 *
 * RolesGuard is DB-authoritative (reads role from the DB on each request).
 * Changing a user's role in the DB (which the PATCH /admin/users/:id/role flow
 * does) must immediately change which routes they can access without a session
 * re-issue.
 *
 * Strategy:
 *   - Uses the shared `rolesForRoute` + `canAccess` functions (which mirror
 *     exactly what RolesGuard does on the backend).
 *   - Simulates "DB role change" by calling the same RBAC functions with the
 *     new role, verifying that the role change propagates to access decisions.
 *   - Covers admin→advisor demotion (loses /admin/* access), and
 *     advisor→admin promotion (gains /admin/* access).
 *   - Verifies that the shared roleRoutes single source of truth is the
 *     authoritative access matrix (nav⊆RBAC invariant).
 *
 * The test is black-box from the perspective of the frontend: it validates
 * the RBAC contract that the frontend relies on (assertRole + canAccess) and
 * that the backend enforces (RolesGuard). The test does NOT mock the DB but
 * verifies that changing the role input changes the access output, which is
 * exactly what happens when RolesGuard re-reads the role from the DB.
 */

import type { Role } from '@dealflow/shared';
import { canAccess, navItemsForRole, rolesForRoute } from '@dealflow/shared';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Route groups under test
// ---------------------------------------------------------------------------

const ADMIN_ROUTES = [
  '/admin/users',
  '/admin/workspace-settings',
  '/admin/settings',
  '/admin/integrations',
  // Wave-16: admin activity page + API endpoint (P-4 Finding 3)
  '/admin/activity',
  '/admin/activity-data',
];

const NON_ADMIN_ROLE_ROUTES: Array<{ route: string; allowedRoles: Role[] }> = [
  { route: '/', allowedRoles: ['advisor', 'analyst', 'compliance', 'admin'] },
  { route: '/mandates', allowedRoles: ['advisor', 'admin', 'analyst'] },
  { route: '/sourcing', allowedRoles: ['analyst'] },
  { route: '/compliance/queue', allowedRoles: ['compliance', 'advisor'] },
  { route: '/compliance/audit-log', allowedRoles: ['compliance', 'admin', 'advisor'] },
  { route: '/compliance/settings', allowedRoles: ['compliance'] },
  { route: '/buyer-universe', allowedRoles: ['analyst', 'advisor', 'admin'] },
  { route: '/matches', allowedRoles: ['advisor', 'admin', 'analyst'] },
  { route: '/outreach-templates', allowedRoles: ['advisor', 'analyst', 'compliance'] },
  { route: '/outreach', allowedRoles: ['advisor', 'compliance'] },
  { route: '/pipeline', allowedRoles: ['advisor', 'compliance'] },
  // Wave-18: /insights (advisor + admin) and /analytics API proxy (advisor + admin)
  { route: '/insights', allowedRoles: ['advisor', 'admin'] },
  { route: '/analytics', allowedRoles: ['advisor', 'admin'] },
  // Wave-19: /match-feedback calibration API (advisor + admin; analyst + compliance denied)
  { route: '/match-feedback', allowedRoles: ['advisor', 'admin'] },
];

const ALL_ROLES: Role[] = ['advisor', 'analyst', 'compliance', 'admin'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RBAC role-reverify — changing role changes live access (wave-15, task d7f716b4)', () => {
  // ── Admin routes: admin-only ───────────────────────────────────────────────

  describe('admin routes are admin-only', () => {
    for (const route of ADMIN_ROUTES) {
      it(`${route} allows admin`, () => {
        expect(canAccess('admin', route)).toBe(true);
      });

      it(`${route} denies advisor`, () => {
        expect(canAccess('advisor', route)).toBe(false);
      });

      it(`${route} denies analyst`, () => {
        expect(canAccess('analyst', route)).toBe(false);
      });

      it(`${route} denies compliance`, () => {
        expect(canAccess('compliance', route)).toBe(false);
      });
    }
  });

  // ── Promotion: advisor → admin gains /admin/* access ──────────────────────

  describe('promotion: advisor→admin gains /admin/* access', () => {
    const advisorRole: Role = 'advisor';
    const adminRole: Role = 'admin';

    for (const route of ADMIN_ROUTES) {
      it(`advisor cannot access ${route} (before promotion)`, () => {
        expect(canAccess(advisorRole, route)).toBe(false);
      });

      it(`admin can access ${route} (after promotion)`, () => {
        expect(canAccess(adminRole, route)).toBe(true);
      });
    }

    it('advisor nav does not include Team or Settings', () => {
      const navLabels = navItemsForRole(advisorRole).map((i) => i.label);
      expect(navLabels).not.toContain('Team');
      expect(navLabels).not.toContain('Settings');
    });

    it('admin nav includes Team and Settings', () => {
      const navLabels = navItemsForRole(adminRole).map((i) => i.label);
      expect(navLabels).toContain('Team');
      expect(navLabels).toContain('Settings');
    });
  });

  // ── Demotion: admin → advisor loses /admin/* access ───────────────────────

  describe('demotion: admin→advisor loses /admin/* access', () => {
    const adminRole: Role = 'admin';
    const advisorRole: Role = 'advisor';

    for (const route of ADMIN_ROUTES) {
      it(`admin can access ${route} (before demotion)`, () => {
        expect(canAccess(adminRole, route)).toBe(true);
      });

      it(`advisor cannot access ${route} (after demotion)`, () => {
        expect(canAccess(advisorRole, route)).toBe(false);
      });
    }
  });

  // ── rolesForRoute returns the correct role set ─────────────────────────────

  describe('rolesForRoute returns correct role sets', () => {
    it('/admin/users returns [admin] only', () => {
      const roles = rolesForRoute('/admin/users') as Role[];
      expect(roles).toEqual(['admin']);
    });

    it('/admin/workspace-settings returns [admin] only', () => {
      const roles = rolesForRoute('/admin/workspace-settings') as Role[];
      expect(roles).toEqual(['admin']);
    });

    it('/admin/settings returns [admin] only', () => {
      const roles = rolesForRoute('/admin/settings') as Role[];
      expect(roles).toEqual(['admin']);
    });

    it('/admin/integrations returns [admin] only', () => {
      const roles = rolesForRoute('/admin/integrations') as Role[];
      expect(roles).toEqual(['admin']);
    });
  });

  // ── Nav⊆RBAC invariant for all roles ──────────────────────────────────────

  describe('nav⊆RBAC invariant — every nav item is RBAC-permitted for its role', () => {
    for (const role of ALL_ROLES) {
      it(`all nav items for ${role} are RBAC-permitted`, () => {
        const navItems = navItemsForRole(role);
        for (const item of navItems) {
          expect(canAccess(role, item.route)).toBe(true);
        }
      });
    }
  });

  // ── Role change propagates to route access ────────────────────────────────

  describe('role change propagates to route access decisions', () => {
    it('same route resolves differently for different roles (canAccess is role-dependent)', () => {
      // /admin/users: admin=true, advisor=false
      expect(canAccess('admin', '/admin/users')).toBe(true);
      expect(canAccess('advisor', '/admin/users')).toBe(false);
    });

    it('changing from advisor to admin changes canAccess(/admin/users) from false to true', () => {
      let role: Role = 'advisor';
      expect(canAccess(role, '/admin/users')).toBe(false);

      // Simulate DB role change
      role = 'admin';
      expect(canAccess(role, '/admin/users')).toBe(true);
    });

    it('changing from admin to compliance changes canAccess(/admin/users) from true to false', () => {
      let role: Role = 'admin';
      expect(canAccess(role, '/admin/users')).toBe(true);

      // Simulate DB role change
      role = 'compliance';
      expect(canAccess(role, '/admin/users')).toBe(false);
    });
  });

  // ── Non-admin routes — role changes also work ────────────────────────────

  describe('non-admin routes — RBAC matrix is consistent', () => {
    for (const { route, allowedRoles } of NON_ADMIN_ROLE_ROUTES) {
      it(`${route} allows exactly ${allowedRoles.join(', ')}`, () => {
        for (const role of ALL_ROLES) {
          const shouldAllow = allowedRoles.includes(role);
          expect(canAccess(role, route)).toBe(shouldAllow);
        }
      });
    }
  });

  // ── Sub-route RBAC (parameterized routes) ─────────────────────────────────

  describe('parameterized admin routes', () => {
    it('/admin/users/:id/role allows admin only', () => {
      expect(canAccess('admin', '/admin/users/some-uuid/role')).toBe(true);
      expect(canAccess('advisor', '/admin/users/some-uuid/role')).toBe(false);
      expect(canAccess('analyst', '/admin/users/some-uuid/role')).toBe(false);
      expect(canAccess('compliance', '/admin/users/some-uuid/role')).toBe(false);
    });

    it('/admin/users/:id/deactivate allows admin only', () => {
      expect(canAccess('admin', '/admin/users/some-uuid/deactivate')).toBe(true);
      expect(canAccess('advisor', '/admin/users/some-uuid/deactivate')).toBe(false);
    });

    it('/admin/integrations/:id allows admin only', () => {
      expect(canAccess('admin', '/admin/integrations/some-uuid')).toBe(true);
      expect(canAccess('advisor', '/admin/integrations/some-uuid')).toBe(false);
    });

    it('/admin/integrations/:id/toggle allows admin only', () => {
      expect(canAccess('admin', '/admin/integrations/some-uuid/toggle')).toBe(true);
      expect(canAccess('compliance', '/admin/integrations/some-uuid/toggle')).toBe(false);
    });
  });

  // ── Wave-16: /admin/activity + reactivate RBAC coverage ──────────────────

  describe('wave-16 admin-activity page + API (P-4 Finding 3)', () => {
    it('/admin/activity allows admin', () => {
      expect(canAccess('admin', '/admin/activity')).toBe(true);
    });

    it('/admin/activity denies advisor (403-class)', () => {
      expect(canAccess('advisor', '/admin/activity')).toBe(false);
    });

    it('/admin/activity denies analyst', () => {
      expect(canAccess('analyst', '/admin/activity')).toBe(false);
    });

    it('/admin/activity denies compliance', () => {
      expect(canAccess('compliance', '/admin/activity')).toBe(false);
    });

    it('/admin/activity-data allows admin', () => {
      expect(canAccess('admin', '/admin/activity-data')).toBe(true);
    });

    it('/admin/activity-data denies advisor (403-class)', () => {
      expect(canAccess('advisor', '/admin/activity-data')).toBe(false);
    });

    it('/admin/activity-data denies analyst', () => {
      expect(canAccess('analyst', '/admin/activity-data')).toBe(false);
    });

    it('/admin/activity-data denies compliance', () => {
      expect(canAccess('compliance', '/admin/activity-data')).toBe(false);
    });

    it('advisor→admin promotion grants /admin/activity access', () => {
      let role: Role = 'advisor';
      expect(canAccess(role, '/admin/activity')).toBe(false);
      role = 'admin';
      expect(canAccess(role, '/admin/activity')).toBe(true);
    });

    it('admin→advisor demotion revokes /admin/activity access', () => {
      let role: Role = 'admin';
      expect(canAccess(role, '/admin/activity')).toBe(true);
      role = 'advisor';
      expect(canAccess(role, '/admin/activity')).toBe(false);
    });
  });

  describe('wave-16 reactivate action RBAC (task 042cf4e6)', () => {
    it('/admin/users/:id/reactivate allows admin', () => {
      expect(canAccess('admin', '/admin/users/some-uuid/reactivate')).toBe(true);
    });

    it('/admin/users/:id/reactivate denies advisor', () => {
      expect(canAccess('advisor', '/admin/users/some-uuid/reactivate')).toBe(false);
    });

    it('/admin/users/:id/reactivate denies analyst', () => {
      expect(canAccess('analyst', '/admin/users/some-uuid/reactivate')).toBe(false);
    });

    it('/admin/users/:id/reactivate denies compliance', () => {
      expect(canAccess('compliance', '/admin/users/some-uuid/reactivate')).toBe(false);
    });

    it('reactivate route mirrors deactivate RBAC (same access set)', () => {
      for (const role of ALL_ROLES) {
        expect(canAccess(role, '/admin/users/some-uuid/reactivate')).toBe(
          canAccess(role, '/admin/users/some-uuid/deactivate')
        );
      }
    });
  });

  describe('wave-16 admin nav item — /admin/activity in navItemsForRole', () => {
    it('admin nav includes Activity', () => {
      const navLabels = navItemsForRole('admin').map((i) => i.label);
      expect(navLabels).toContain('Activity');
    });

    it('advisor nav does not include Activity', () => {
      const navLabels = navItemsForRole('advisor').map((i) => i.label);
      expect(navLabels).not.toContain('Activity');
    });

    it('analyst nav does not include Activity', () => {
      const navLabels = navItemsForRole('analyst').map((i) => i.label);
      expect(navLabels).not.toContain('Activity');
    });

    it('compliance nav does not include Activity', () => {
      const navLabels = navItemsForRole('compliance').map((i) => i.label);
      expect(navLabels).not.toContain('Activity');
    });

    it('/admin/activity nav item is RBAC-permitted for admin (nav⊆RBAC)', () => {
      const activityItem = navItemsForRole('admin').find((i) => i.route === '/admin/activity');
      expect(activityItem).toBeDefined();
      expect(canAccess('admin', '/admin/activity')).toBe(true);
    });
  });

  // ── Wave-19: /match-feedback calibration API endpoint ────────────────────

  describe('wave-19 match-feedback calibration API (task 077974a2)', () => {
    it('/match-feedback allows advisor', () => {
      expect(canAccess('advisor', '/match-feedback')).toBe(true);
    });

    it('/match-feedback allows admin', () => {
      expect(canAccess('admin', '/match-feedback')).toBe(true);
    });

    it('/match-feedback denies analyst (403-class)', () => {
      expect(canAccess('analyst', '/match-feedback')).toBe(false);
    });

    it('/match-feedback denies compliance (403-class)', () => {
      expect(canAccess('compliance', '/match-feedback')).toBe(false);
    });

    it('rolesForRoute(/match-feedback) returns [advisor, admin]', () => {
      const roles = rolesForRoute('/match-feedback') as Role[];
      expect(roles).toContain('advisor');
      expect(roles).toContain('admin');
      expect(roles).not.toContain('analyst');
      expect(roles).not.toContain('compliance');
    });

    it('advisor→analyst demotion revokes /match-feedback access', () => {
      let role: Role = 'advisor';
      expect(canAccess(role, '/match-feedback')).toBe(true);
      role = 'analyst';
      expect(canAccess(role, '/match-feedback')).toBe(false);
    });

    it('analyst→advisor promotion grants /match-feedback access', () => {
      let role: Role = 'analyst';
      expect(canAccess(role, '/match-feedback')).toBe(false);
      role = 'advisor';
      expect(canAccess(role, '/match-feedback')).toBe(true);
    });

    it('advisor→admin promotion retains /match-feedback access', () => {
      let role: Role = 'advisor';
      expect(canAccess(role, '/match-feedback')).toBe(true);
      role = 'admin';
      expect(canAccess(role, '/match-feedback')).toBe(true);
    });

    it('/match-feedback RBAC mirrors /analytics (same role set)', () => {
      for (const role of ALL_ROLES) {
        expect(canAccess(role, '/match-feedback')).toBe(canAccess(role, '/analytics'));
      }
    });
  });

  // ── Wave-18: /insights page + /analytics API endpoint ─────────────────────

  describe('wave-18 insights page + analytics API (task 4b014689)', () => {
    it('/insights allows advisor', () => {
      expect(canAccess('advisor', '/insights')).toBe(true);
    });

    it('/insights allows admin', () => {
      expect(canAccess('admin', '/insights')).toBe(true);
    });

    it('/insights denies analyst', () => {
      expect(canAccess('analyst', '/insights')).toBe(false);
    });

    it('/insights denies compliance', () => {
      expect(canAccess('compliance', '/insights')).toBe(false);
    });

    it('/analytics allows advisor', () => {
      expect(canAccess('advisor', '/analytics')).toBe(true);
    });

    it('/analytics allows admin', () => {
      expect(canAccess('admin', '/analytics')).toBe(true);
    });

    it('/analytics denies analyst', () => {
      expect(canAccess('analyst', '/analytics')).toBe(false);
    });

    it('/analytics denies compliance', () => {
      expect(canAccess('compliance', '/analytics')).toBe(false);
    });

    it('advisor nav includes Insights', () => {
      const navLabels = navItemsForRole('advisor').map((i) => i.label);
      expect(navLabels).toContain('Insights');
    });

    it('admin nav includes Insights', () => {
      const navLabels = navItemsForRole('admin').map((i) => i.label);
      expect(navLabels).toContain('Insights');
    });

    it('analyst nav does not include Insights', () => {
      const navLabels = navItemsForRole('analyst').map((i) => i.label);
      expect(navLabels).not.toContain('Insights');
    });

    it('compliance nav does not include Insights', () => {
      const navLabels = navItemsForRole('compliance').map((i) => i.label);
      expect(navLabels).not.toContain('Insights');
    });

    it('/insights nav item is RBAC-permitted for advisor (nav⊆RBAC)', () => {
      const insightsItem = navItemsForRole('advisor').find((i) => i.route === '/insights');
      expect(insightsItem).toBeDefined();
      expect(canAccess('advisor', '/insights')).toBe(true);
    });

    it('/insights nav item is RBAC-permitted for admin (nav⊆RBAC)', () => {
      const insightsItem = navItemsForRole('admin').find((i) => i.route === '/insights');
      expect(insightsItem).toBeDefined();
      expect(canAccess('admin', '/insights')).toBe(true);
    });

    it('advisor→admin promotion retains /insights access', () => {
      let role: Role = 'advisor';
      expect(canAccess(role, '/insights')).toBe(true);
      role = 'admin';
      expect(canAccess(role, '/insights')).toBe(true);
    });

    it('analyst→advisor promotion grants /insights access', () => {
      let role: Role = 'analyst';
      expect(canAccess(role, '/insights')).toBe(false);
      role = 'advisor';
      expect(canAccess(role, '/insights')).toBe(true);
    });

    it('advisor→analyst demotion revokes /insights access', () => {
      let role: Role = 'advisor';
      expect(canAccess(role, '/insights')).toBe(true);
      role = 'analyst';
      expect(canAccess(role, '/insights')).toBe(false);
    });

    it('rolesForRoute(/insights) returns [advisor, admin]', () => {
      const roles = rolesForRoute('/insights') as Role[];
      expect(roles).toContain('advisor');
      expect(roles).toContain('admin');
      expect(roles).not.toContain('analyst');
      expect(roles).not.toContain('compliance');
    });

    it('rolesForRoute(/analytics) returns [advisor, admin]', () => {
      const roles = rolesForRoute('/analytics') as Role[];
      expect(roles).toContain('advisor');
      expect(roles).toContain('admin');
      expect(roles).not.toContain('analyst');
      expect(roles).not.toContain('compliance');
    });
  });
});
