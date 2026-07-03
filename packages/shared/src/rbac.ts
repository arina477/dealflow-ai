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
  {
    pattern: '/companies',
    allowedRoles: ['analyst'],
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
    pattern: '/compliance/audit-log',
    allowedRoles: ['compliance'],
    navItem: NAV_AUDIT_LOG,
  },
  {
    pattern: '/compliance/audit-log/verify',
    allowedRoles: ['compliance', 'admin'],
  },
  {
    pattern: '/compliance/settings',
    allowedRoles: ['compliance'],
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
  NAV_TEAM,
  NAV_SETTINGS,
];
