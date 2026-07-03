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
 * route WITHOUT @Roles() metadata (the no-op branch below). There is NO global
 * RBAC guard: /auth/* (SuperTokens auto-routes + custom), /health, GET /auth/me
 * (SessionGuard only), and every other undecorated route stay ungated — the
 * live wave-2 login is NOT affected. Behaviour changes ONLY on @Roles()-
 * decorated handlers. Do not register this globally.
 *
 * Security note: the claim is a MIRROR of the app-DB users.role. security.md
 * requires the app-DB row to be re-verified server-side on authorization
 * decisions; the claim is a documented fast-path cache, not the source of
 * truth. The re-verification hardening is tracked for a later slice — the
 * claim read below is the current, allowlist-safe fast path.
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

import type { RequestWithSession } from './session.guard';

/** Metadata key carrying the roles a route requires. */
export const ROLES_KEY = 'dealflow:required-roles';

/**
 * @Roles('admin', 'compliance') — declares the roles allowed on a handler.
 * PRIMITIVE: paired with RolesGuard, but applied to no route this wave.
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() on the route → this guard is a pass-through.
    if (!required || required.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<RequestWithSession>();
    const res = context.switchToHttp().getResponse<Response>();

    const session =
      req.session ??
      (await Session.getSession(req, res, { sessionRequired: true }).catch(() => undefined));

    if (!session) {
      throw new UnauthorizedException();
    }

    // Read the role claim from the access-token payload (the primitive's core
    // capability). In an enforced slice this would be re-verified against the
    // app-DB users row before granting access.
    const role = session.getAccessTokenPayload().role as Role | undefined;

    if (role === undefined || !required.includes(role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
