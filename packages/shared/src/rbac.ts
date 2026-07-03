import type { Role } from './auth';

// ---------------------------------------------------------------------------
// Nav group identifiers
// ---------------------------------------------------------------------------

export type NavGroup = 'workspace' | 'config';

// ---------------------------------------------------------------------------
// A single sidebar nav destination
// ---------------------------------------------------------------------------

export interface NavItem {
  /** Human-readable sidebar label */
  label: string;
  /** Primary route this nav item links to */
  route: string;
  /** lucide-react icon name */
  icon: string;
  /** §10 sidebar group */
  group: NavGroup;
  /** The roles that may see + access this nav item */
  allowedRoles: ReadonlyArray<Role>;
}

// ---------------------------------------------------------------------------
// Route-entry — one row in roleRoutes
// Covers a primary route plus any sub-routes under it (e.g. /mandates/:id).
// The `navItem` field is present when this route has a direct sidebar link;
// sub-routes that share the parent nav item (e.g. /mandates/:id/buyers) carry
// the same navItem as the parent.
// ---------------------------------------------------------------------------

export interface RouteEntry {
  /**
   * Canonical route pattern.
   * Patterns with `:param` segments are matched by prefix/param awareness
   * (see `rolesForRoute` / `canAccess`).
   */
  pattern: string;
  allowedRoles: ReadonlyArray<Role>;
  /**
   * Defined when this pattern corresponds to a top-level sidebar nav item.
   * Sub-route entries reference the SAME nav item object as their parent.
   */
  navItem?: NavItem;
}

// ---------------------------------------------------------------------------
// THE single source of truth.
//
// Nav visibility and RBAC enforcement BOTH derive from this one array.
// No duplication: `navItemsForRole` reads `entry.navItem.allowedRoles`;
// `rolesForRoute` reads `entry.allowedRoles`. They are always in sync because
// every nav item's route pattern is also an entry in this table, and the
// nav item's `allowedRoles` is always IDENTICAL to the corresponding entry's
// `allowedRoles` (they reference the same array literal).
//
// §10 sidebar order: Workspace group first (Dashboard → Mandates → Sourcing →
// Compliance), then Config group (Team → Settings).
// ---------------------------------------------------------------------------

// ---------- Nav item definitions (defined once, referenced by route entries) ----------

const NAV_DASHBOARD: NavItem = {
  label: 'Dashboard',
  route: '/',
  icon: 'layout-dashboard',
  group: 'workspace',
  allowedRoles: ['advisor', 'analyst', 'compliance', 'admin'],
};

const NAV_MANDATES: NavItem = {
  label: 'Mandates',
  route: '/mandates',
  icon: 'briefcase',
  group: 'workspace',
  allowedRoles: ['advisor', 'analyst'],
};

const NAV_SOURCING: NavItem = {
  label: 'Sourcing',
  route: '/sourcing',
  icon: 'database',
  group: 'workspace',
  allowedRoles: ['analyst'],
};

const NAV_COMPLIANCE: NavItem = {
  label: 'Compliance',
  route: '/compliance/queue',
  icon: 'shield-check',
  group: 'workspace',
  allowedRoles: ['compliance', 'advisor'],
};

const NAV_TEAM: NavItem = {
  label: 'Team',
  route: '/admin/users',
  icon: 'users',
  group: 'config',
  allowedRoles: ['admin'],
};

const NAV_SETTINGS: NavItem = {
  label: 'Settings',
  route: '/admin/settings',
  icon: 'settings',
  group: 'config',
  allowedRoles: ['admin'],
};

const NAV_AUDIT_LOG: NavItem = {
  label: 'Audit Log',
  route: '/compliance/audit-log',
  icon: 'scroll',
  group: 'workspace',
  allowedRoles: ['compliance'],
};

// Wave-5: Compliance Settings nav item (rules-engine config surface).
// Route /compliance/settings is compliance-only (RBAC unchanged from wave-4);
// we attach a navItem so it appears in the sidebar for compliance users.
// nav⊆RBAC holds by construction: navItem.allowedRoles references the same
// literal as the route entry's allowedRoles below.
const NAV_COMPLIANCE_SETTINGS: NavItem = {
  label: 'Rules',
  route: '/compliance/settings',
  icon: 'sliders',
  group: 'workspace',
  allowedRoles: ['compliance'],
};

// ---------- Route entries (the canonical role → route matrix) ----------

export const roleRoutes: ReadonlyArray<RouteEntry> = [
  // --- Dashboard ---
  {
    pattern: '/',
    allowedRoles: ['advisor', 'analyst', 'compliance', 'admin'],
    navItem: NAV_DASHBOARD,
  },

  // --- Mandates group ---
  {
    pattern: '/mandates',
    allowedRoles: ['advisor', 'analyst'],
    navItem: NAV_MANDATES,
  },
  {
    pattern: '/mandates/new',
    allowedRoles: ['advisor'],
  },
  {
    pattern: '/mandates/:id',
    allowedRoles: ['advisor', 'analyst'],
  },
  {
    pattern: '/mandates/:id/buyers',
    allowedRoles: ['advisor', 'analyst'],
  },
  {
    pattern: '/mandates/:id/outreach',
    allowedRoles: ['advisor', 'analyst'],
  },
  {
    pattern: '/mandates/:id/matches',
    allowedRoles: ['advisor'],
  },
  {
    pattern: '/pipeline',
    allowedRoles: ['advisor'],
  },

  // --- Sourcing group ---
  {
    pattern: '/sourcing',
    allowedRoles: ['analyst'],
    navItem: NAV_SOURCING,
  },
  // Wave-6: /companies repointed to /sourcing/companies (namespace consolidation per P-3 Delta 5).
  // The bare /companies placeholder (no page existed — verified no (app)/companies route dir) is
  // superseded by the canonical /sourcing/companies pattern so all sourcing routes share a namespace.
  // rbac.test.ts updated accordingly (karen LOW — named B-1/B-2 step).
  {
    pattern: '/sourcing/companies',
    allowedRoles: ['analyst'],
  },
  {
    pattern: '/sourcing/companies/:id',
    allowedRoles: ['analyst'],
  },
  // Wave-6: API route entries for the sourcing data spine (analyst + admin per P-3 Action 3).
  // No navItem — these are API-only endpoints; the sidebar nav for sourcing is /sourcing (NAV_SOURCING).
  // Admin allowed on sync + resolve (config/ops surface); analyst is the primary sourcing persona.
  {
    // POST /sourcing/connections/:id/sync — on-demand ETL trigger.
    pattern: '/sourcing/connections/:id/sync',
    allowedRoles: ['analyst', 'admin'],
  },
  {
    // POST /sourcing/dedupe-candidates/:id/resolve — human merge/reject decision.
    // Audited via AuditService.append (sourcing-dedupe-resolve) in the same tx.
    pattern: '/sourcing/dedupe-candidates/:id/resolve',
    allowedRoles: ['analyst', 'admin'],
  },
  {
    pattern: '/templates',
    allowedRoles: ['analyst', 'compliance'],
  },

  // --- Compliance group ---
  {
    pattern: '/compliance/queue',
    allowedRoles: ['compliance', 'advisor'],
    navItem: NAV_COMPLIANCE,
  },
  {
    // The human integrity PAGE is compliance-only (journey row 16, persona=Comp):
    // the audit-log UI is compliance's surface. NAV is compliance-only by design —
    // do NOT add admin here (keep the nav journey-faithful).
    pattern: '/compliance/audit-log',
    allowedRoles: ['compliance'],
    navItem: NAV_AUDIT_LOG,
  },
  {
    // INTENTIONAL split from the page above: the verify ENDPOINT additionally
    // allows admin for API/automation-driven ops verification (no nav item — it
    // is API-only, not a page in admin's navigation). The page stays compliance's
    // human surface; the endpoint is the machine/ops surface. Not a bug.
    pattern: '/compliance/audit-log/verify',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    // Wave-5: navItem attached so compliance sees 'Rules' in sidebar.
    // allowedRoles remains compliance-only (unchanged from wave-4).
    // The SoD APPROVER role restriction ('compliance' only, admin excluded)
    // is enforced in the gate service (B-2), NOT here — these CRUD routes
    // allow admin for config management, per the plan's SoD distinction.
    pattern: '/compliance/settings',
    allowedRoles: ['compliance'],
    navItem: NAV_COMPLIANCE_SETTINGS,
  },
  // Wave-5: CRUD API route entries — compliance/admin (config management).
  // SoD distinction: these are config-management routes (compliance/admin);
  // the SoD APPROVER check (compliance-only) is enforced server-side in the
  // gate service's sod evaluator, not via route RBAC.
  {
    pattern: '/compliance/rules',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    pattern: '/compliance/suppression',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    pattern: '/compliance/disclaimers',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    pattern: '/compliance/summary',
    allowedRoles: ['compliance', 'admin'],
  },

  // --- Admin / Config group ---
  {
    pattern: '/admin/users',
    allowedRoles: ['admin'],
    navItem: NAV_TEAM,
  },
  {
    pattern: '/admin/settings',
    allowedRoles: ['admin'],
    navItem: NAV_SETTINGS,
  },
  {
    pattern: '/admin/integrations',
    allowedRoles: ['admin'],
  },
];

// ---------------------------------------------------------------------------
// Public allowlist — routes that bypass auth/RBAC entirely.
// B-2 and B-3 import `isPublicRoute` instead of hardcoding these.
// ---------------------------------------------------------------------------

const PUBLIC_PREFIXES: ReadonlyArray<string> = ['/auth', '/health'];

/**
 * Returns true if `route` is on the public allowlist (no session or role
 * required). Matches `/auth/*` and `/health` (exact or with a trailing path).
 */
export function isPublicRoute(route: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`)
  );
}

// ---------------------------------------------------------------------------
// Route normalization
//
// The RBAC matchers (rolesForRoute / canAccess) match against canonical
// patterns that have NO query string and NO trailing slash. A caller-supplied
// URL like '/compliance/summary/' or '/compliance/summary?x=1' must be reduced
// to its canonical form BEFORE matching, so both matchers treat URLs the same
// way `isPublicRoute` already does (it prefix-matches on `/` and `?`). Without
// this, a legit URL with a trailing slash or query would fail-closed to [] and
// wrongly 403/redirect. The root route '/' is preserved (never stripped to '').
// ---------------------------------------------------------------------------

function normalizeRoute(route: string): string {
  // Strip query string (everything from the first '?') and hash fragment.
  let normalized = route.split('?')[0]?.split('#')[0] ?? route;
  // Strip a single trailing slash, but never reduce the root '/' to ''.
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Route-pattern matching helper
//
// Converts a pattern like `/mandates/:id/buyers` into a regex that matches
// real routes like `/mandates/abc123/buyers`.
// Segments starting with `:` match one non-empty, non-slash path segment.
// ---------------------------------------------------------------------------

function patternToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withParams = escaped.replace(/:[\w]+/g, '[^/]+');
  return new RegExp(`^${withParams}$`);
}

/**
 * Returns the Role[] that are permitted for the given concrete route.
 * Route-pattern matching handles `:param` segments (e.g. `/mandates/:id`).
 * Returns an empty array for routes not in the table (default-deny).
 *
 * Does NOT include public routes — call `isPublicRoute` first if you need
 * to handle `/auth/*` or `/health`.
 */
export function rolesForRoute(route: string): ReadonlyArray<Role> {
  // Normalize (strip query + trailing slash) so URLs are matched identically
  // to isPublicRoute — a trailing slash or query must NOT fail-closed to [].
  const normalized = normalizeRoute(route);
  // Exact match first (faster and avoids regex for the common case)
  for (const entry of roleRoutes) {
    if (entry.pattern === normalized) {
      return entry.allowedRoles;
    }
  }
  // Pattern match (`:param` segments)
  for (const entry of roleRoutes) {
    if (entry.pattern.includes(':')) {
      if (patternToRegex(entry.pattern).test(normalized)) {
        return entry.allowedRoles;
      }
    }
  }
  return [];
}

/**
 * Returns true if `role` may access `route`.
 * Public routes always return true; routes not in the table return false.
 */
export function canAccess(role: Role, route: string): boolean {
  // Normalize before both checks so a trailing slash / query behaves
  // identically across isPublicRoute and rolesForRoute (rolesForRoute
  // normalizes internally too; normalizing here keeps the public-route check
  // consistent with the matrix check).
  const normalized = normalizeRoute(route);
  if (isPublicRoute(normalized)) return true;
  return (rolesForRoute(normalized) as Role[]).includes(role);
}

// ---------------------------------------------------------------------------
// Nav item helpers
// ---------------------------------------------------------------------------

/**
 * Returns the ordered sidebar nav items that `role` is permitted to see.
 * Order follows the §10 canonical order (Workspace group first, Config group
 * second). Derived entirely from `roleRoutes` — no separate lookup table.
 *
 * nav⊆RBAC invariant: every item returned satisfies `canAccess(role, item.route)`
 * by construction, because `item.allowedRoles` is the SAME array referenced in
 * the corresponding `roleRoutes` entry.
 */
export function navItemsForRole(role: Role): NavItem[] {
  const seen = new Set<string>();
  const items: NavItem[] = [];

  for (const entry of roleRoutes) {
    if (!entry.navItem) continue;
    const navItem = entry.navItem;
    if (seen.has(navItem.route)) continue;
    if ((navItem.allowedRoles as Role[]).includes(role)) {
      items.push(navItem);
      seen.add(navItem.route);
    }
  }

  return items;
}

// ---------------------------------------------------------------------------
// Re-export nav item definitions for consumers that need the full set
// (e.g. design-time enumeration, Storybook, admin tooling)
// ---------------------------------------------------------------------------

export const ALL_NAV_ITEMS: ReadonlyArray<NavItem> = [
  NAV_DASHBOARD,
  NAV_MANDATES,
  NAV_SOURCING,
  NAV_COMPLIANCE,
  NAV_AUDIT_LOG,
  NAV_COMPLIANCE_SETTINGS,
  NAV_TEAM,
  NAV_SETTINGS,
];
