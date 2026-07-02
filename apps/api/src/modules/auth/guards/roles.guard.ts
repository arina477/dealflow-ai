/**
 * RolesGuard PRIMITIVE + @Roles() decorator (wave-2, task e1c0e81e).
 *
 * ⚠️ BUILT-BUT-UNAPPLIED (arch delta 3 / spec block-2 guardrail).
 *
 * This wave lands the role CLAIM and a reusable guard that CAN read it, but
 * per-route RBAC ENFORCEMENT is a deferred M1 slice. This guard is registered
 * in the module's provider list so it is DI-resolvable, but it is applied to
 * NO route (no @UseGuards(RolesGuard) + @Roles(...) pair exists on any handler
 * this wave). Do not add one here — RBAC enforcement lands in a later slice.
 *
 * Security note: even once applied, the claim is a MIRROR. security.md requires
 * the app-DB users.role to be re-verified server-side on authorization
 * decisions; the claim is a fast-path cache, not the source of truth.
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
import type { Reflector } from '@nestjs/core';
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
