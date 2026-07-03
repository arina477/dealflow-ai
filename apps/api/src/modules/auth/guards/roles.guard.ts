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
 * ── DB-AUTHORITATIVE role (B-6 CRITICAL-1 fix) ──────────────────────────────
 * The session role CLAIM is a MIRROR of app-DB users.role, minted at login and
 * NEVER re-verified until token rotation. A user whose DB role is downgraded
 * would keep the stale claim role on guarded routes until their token rotates.
 * We close that window: the guard re-resolves the role from the app-DB users
 * row (by SuperTokens user id — the SAME authoritative source GET /auth/me
 * uses, via AuthRepository.resolveRoleBySupertokensUserId) and authorizes off
 * the DB value, not the claim. This costs one extra DB read per guarded request
 * — accepted: correctness > micro-perf on the RBAC path, and guarded routes are
 * few. (A future architecture could instead revoke sessions on role change; the
 * per-request DB re-verify closes the window today with minimal change.)
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

    // DB-AUTHORITATIVE role: re-verify against the app-DB users row (same source
    // GET /auth/me uses) rather than trusting the possibly-stale session claim.
    // A DB role change takes effect on the NEXT guarded request, not only after
    // token rotation.
    const supertokensUserId = session.getUserId();
    const role = (await this.authRepository.resolveRoleBySupertokensUserId(
      supertokensUserId
    )) as Role | null;

    if (role === null || !required.includes(role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
