/**
 * SessionGuard (wave-2, task e1c0e81e).
 *
 * Verifies a valid SuperTokens session on the request. On no/invalid session
 * it maps to 401 (UnauthorizedException). On success it attaches the verified
 * session object to `req.session` for downstream handlers (e.g. GET /auth/me
 * reads the SuperTokens user id from it).
 *
 * This is AUTHENTICATION (is there a valid session?), not RBAC. It is applied
 * to GET /auth/me this wave — that is in-spec (401 anon). Per-route ROLE
 * enforcement is a separate concern owned by RolesGuard (built, unapplied).
 */

import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { SessionContainer } from 'supertokens-node/recipe/session';
import Session from 'supertokens-node/recipe/session';

/** Express request augmented with the verified SuperTokens session. */
export interface RequestWithSession extends Request {
  session?: SessionContainer;
}

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithSession>();
    const res = context.switchToHttp().getResponse<Response>();

    // sessionRequired:true → getSession throws when no/invalid session, which
    // the SuperTokens errorHandler maps to 401. We also guard defensively.
    const session = await Session.getSession(req, res, {
      sessionRequired: true,
    }).catch(() => undefined);

    if (!session) {
      throw new UnauthorizedException();
    }

    req.session = session;
    return true;
  }
}
