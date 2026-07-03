/**
 * assertRole — server-side per-segment web route-protection helper.
 *
 * Reads `rolesForRoute(pathname)` from the shared RBAC map (single source of
 * truth) and throws a Next.js redirect to '/' if the authenticated user's role
 * is not in the allowed set.
 *
 * Usage: call at the top of any protected page segment AFTER the (app) layout
 * has already verified the session (the layout provides the role). The layout
 * guard is coarse (authn + "is any valid role"); assertRole is the per-page
 * fine-grained authz check.
 *
 * Deny behavior: redirect('/') — always-permitted for all authed roles (per
 * §10 "Dashboard route = / = all roles"). This gives a graceful deny: the
 * user lands back on the dashboard, not a blank screen or raw 403.
 *
 * This wave: only '/' (all roles) and the compliance exemplar require
 * assertRole. The helper is wired generically from rbac.ts so future pages
 * can call it with their pathname string.
 */

import type { Role } from '@dealflow/shared';
import { canAccess } from '@dealflow/shared';
import { redirect } from 'next/navigation';

/**
 * Asserts that `role` may access `pathname` per the shared RBAC map.
 * Redirects to '/' if denied. Must be called from a Server Component or
 * Server Action — never in a Client Component.
 *
 * @param pathname - The route being protected (e.g. '/compliance/summary').
 * @param role     - The server-verified role from GET /auth/me.
 */
export function assertRole(pathname: string, role: Role): void {
  if (!canAccess(role, pathname)) {
    redirect('/');
  }
}
