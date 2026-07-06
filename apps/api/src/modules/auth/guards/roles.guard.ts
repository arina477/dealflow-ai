/**
 * RolesGuard + @Roles() decorator (wave-2 primitive, ENFORCED in wave-3).
 *
 * ✅ APPLIED (wave-3, task 2ecc4a7b — per-route RBAC enforcement).
 *
 * The guard + role CLAIM landed in wave-2 as a built-but-unapplied primitive.
 * Wave-3 turns it into LIVE enforcement by decorating a real protected route
 * (GET /compliance/summary → @UseGuards(SessionGuard, RolesGuard) +
 * @Roles('compliance','admin'), roles sourced from the shared roleRoutes map).
 *
 * ── Allowlist safety (load-bearing) ────────────────────────────────────────
 * Enforcement is OPT-IN BY DECORATION. This guard is a pass-through on any
 * route with NO @Roles() DECORATOR AT ALL (Reflector returns `undefined`).
 * There is NO global RBAC guard: /auth/* (SuperTokens auto-routes + custom),
 * /health, GET /auth/me (SessionGuard only), and every other undecorated route
 * stay ungated — the live wave-2 login is NOT affected. Behaviour changes ONLY
 * on @Roles()-decorated handlers. Do not register this globally.
 *
 * ── FAIL-CLOSED on config drift (B-6 CRITICAL-2 fix) ────────────────────────
 * There is a CRITICAL distinction between the two "no roles" cases:
 *   1. `undefined`  → NO @Roles() decorator present → pass-through (allowlist).
 *   2. `[]`         → @Roles() decorator PRESENT but EMPTY → DENY (fail-closed).
 * Case (2) means an authorization surface was declared but resolved to zero
 * roles — e.g. `@Roles(...rolesForRoute('/x'))` where the route was renamed in
 * rbac.ts and rolesForRoute now returns []. Treating that as pass-through would
 * silently open the route to EVERY authenticated user (fail-OPEN on config
 * drift). We instead throw ForbiddenException — a declared-but-empty allowlist
 * grants nobody. Defence in depth pairs with the module-load assertion in the
 * controller (COMPLIANCE_SUMMARY_ROLES non-empty check) so drift also fails at
 * boot, not just at request time.
 *
 * ── DB-AUTHORITATIVE role (B-6 CRITICAL-1 fix; RLS-exempt path B-6 rework3) ──
 * The session role CLAIM is a MIRROR of app-DB users.role, minted at login and
 * NEVER re-verified until token rotation. A user whose DB role is downgraded
 * would keep the stale claim role on guarded routes until their token rotates.
 * We close that window: the guard re-resolves the role from the app-DB users
 * row (by SuperTokens user id — the SAME authoritative source GET /auth/me
 * uses) and authorizes off the DB value, not the claim.
 *
 * B-6 rework3 — RLS-exempt path (P0 fix):
 * NestJS runs GUARDS BEFORE INTERCEPTORS. The WorkspaceInterceptor (APP_INTERCEPTOR)
 * has NOT yet run when canActivate fires → ALS empty → no app.workspace_id GUC →
 * under dealflow_app (NOSUPERUSER FORCE RLS) the direct users SELECT returns 0
 * rows → null role → ForbiddenException → 403-EVERYTHING. Fix: use
 * AuthRepository.resolveRoleRlsExempt (→ SECURITY DEFINER resolve_user_workspace
 * via pool.query) instead of resolveRoleBySupertokensUserId (→ getDb Drizzle query).
 * EXECUTE already granted to dealflow_app (migration 0016 step 5).
 */

import type { Role } from '@dealflow/shared';
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
// biome-ignore lint/style/useImportType: injected via DI, needs runtime metadata
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import Session from 'supertokens-node/recipe/session';

// biome-ignore lint/style/useImportType: injected via DI, needs runtime metadata
import { AuthRepository } from '../auth.repository';
import type { RequestWithSession } from './session.guard';

/** Metadata key carrying the roles a route requires. */
export const ROLES_KEY = 'dealflow:required-roles';

/**
 * @Roles('admin', 'compliance') — declares the roles allowed on a handler.
 * Paired with RolesGuard. An EMPTY @Roles() (no args) is a FAIL-CLOSED deny at
 * the guard, distinct from having no @Roles() decorator at all.
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authRepository: AuthRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() DECORATOR at all → Reflector returns undefined → the guard is
    // a pass-through (allowlist safety: /auth/*, /health, /auth/me stay ungated).
    if (required === undefined) {
      return true;
    }

    // @Roles() DECORATOR PRESENT but EMPTY → fail-CLOSED. A declared
    // authorization surface that resolves to zero roles must NOT open the route
    // to everyone (config-drift fail-open). Deny outright.
    if (required.length === 0) {
      throw new ForbiddenException();
    }

    const req = context.switchToHttp().getRequest<RequestWithSession>();
    const res = context.switchToHttp().getResponse<Response>();

    const session =
      req.session ??
      (await Session.getSession(req, res, { sessionRequired: true }).catch(() => undefined));

    if (!session) {
      throw new UnauthorizedException();
    }

    // DB-AUTHORITATIVE role (B-6 rework3): re-verify against the app-DB users row
    // via the RLS-EXEMPT SECURITY DEFINER path (resolveRoleRlsExempt →
    // resolve_user_workspace). This guard runs BEFORE the WorkspaceInterceptor
    // (NestJS guard-before-interceptor ordering), so the app.workspace_id GUC is
    // NOT yet set. Under dealflow_app (NOSUPERUSER NOBYPASSRLS FORCE RLS), a
    // direct Drizzle users SELECT returns 0 rows → null → 403-everything.
    // resolveRoleRlsExempt calls the SECURITY DEFINER fn via pool.query (same
    // pattern as getInviteEmail) — bypasses FORCE RLS, EXECUTE already granted.
    // A DB role change still takes effect on the NEXT guarded request (not only
    // after token rotation) — DB-authoritative property is preserved.
    const supertokensUserId = session.getUserId();
    const role = (await this.authRepository.resolveRoleRlsExempt(
      supertokensUserId
    )) as Role | null;

    if (role === null || !required.includes(role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
