/**
 * AuthController (wave-2, task e1c0e81e) — the six /auth endpoints.
 *
 * Route/auth-model map (spec block-2 Action 3):
 *   POST /auth/invite         201  anon (admin-only deferred)
 *   POST /auth/signup         201  anon; invite-bound; Set-Cookie session
 *   GET  /auth/me             200  SESSION-authed (SessionGuard → 401 anon)
 *   POST /auth/reset/request  202  anon; ALWAYS 202 (no user-enumeration)
 *   POST /auth/reset/confirm  200  anon
 *   POST /auth/logout         200  SESSION-authed
 *
 * These custom routes sit ALONGSIDE the SuperTokens auto-routes under /auth
 * (/auth/signin, /auth/signout, /auth/session/refresh, /auth/user/password/*).
 * None of the custom paths collide with a reserved SDK path (gotcha #1).
 *
 * RBAC guardrail: no @Roles()/@UseGuards(RolesGuard) appears on ANY handler —
 * per-route role enforcement is deferred (arch delta 3). Only SessionGuard
 * (authentication) is applied, and only to /me + /logout.
 */

import type { InviteCreateResponse, MeResponse, SignupResponse } from '@dealflow/shared';
import {
  inviteCreateRequestSchema,
  resetConfirmSchema,
  resetRequestSchema,
  signupRequestSchema,
} from '@dealflow/shared';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { SessionContainer } from 'supertokens-node/recipe/session';

// biome-ignore lint/style/useImportType: value import required for Nest DI
import { AuthService } from './auth.service';
// wave-25 SEC-9: body parameters are now typed as `unknown` with explicit
// safeParse. The DTO file (dto.ts) is retained for Swagger / API docs tooling
// but the DTO classes are no longer used as @Body() parameter types.
import type { RequestWithSession } from './guards/session.guard';
import { SessionGuard } from './guards/session.guard';

// ---------------------------------------------------------------------------
// SEC-9 (wave-25 M10 auth-hardening): per-handler Zod safeParse
//
// Codebase convention: per-controller safeParse (see pipeline.controller.ts,
// compliance-crud.dto.ts). NO global APP_PIPE / useGlobalPipes — that would
// regress 18 controllers, 186 .strict schemas, and the passthrough tests for
// mandate / buyer-universe / matching.
//
// Each auth handler that receives a body types it as `unknown` and runs
// safeParse against its schema BEFORE passing to the service. A missing/
// empty/malformed body or an inviteToken that fails min(1) → 400 (not 500).
//
// SEC-10: all 400 responses from validation return a generic message so that
// missing vs invalid fields are indistinguishable to the caller.
// ---------------------------------------------------------------------------

/** Generic validation 400 helper — no field-level detail to the caller. */
function validationError(message = 'Invalid request'): BadRequestException {
  return new BadRequestException(message);
}

/**
 * Extract the SuperTokens session that SessionGuard guarantees is present on a
 * guarded route. Defensive: throws 401 if somehow absent (keeps the type
 * narrow without a non-null assertion).
 */
function requireSession(req: RequestWithSession): SessionContainer {
  if (!req.session) {
    throw new UnauthorizedException();
  }
  return req.session;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // SEC-9: @Body() typed as unknown; safeParse with inviteCreateRequestSchema.
  // SEC-10: generic 400 message regardless of which field failed.
  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(@Body() body: unknown): Promise<InviteCreateResponse> {
    const result = inviteCreateRequestSchema.safeParse(body);
    if (!result.success) {
      throw validationError('Invalid request');
    }
    return this.authService.createInvite(result.data);
  }

  // SEC-9: @Body() typed as unknown; safeParse with signupRequestSchema.
  // SEC-10: missing/empty/malformed inviteToken → same generic 400 as non-existent.
  // SEC-10 AC: no account is created on the missing-inviteToken path (the 400
  //   is thrown here, before AuthService.signup() is called — no hashToken(undefined)
  //   → 500 path can be reached).
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<SignupResponse> {
    // signupRequestSchema has inviteToken: z.string().min(1) + password: min(8).
    // A missing or empty inviteToken → safeParse fails → 400 here, NOT 500 from
    // hashToken(undefined) in the service.
    const result = signupRequestSchema.safeParse(body);
    if (!result.success) {
      // SEC-10: identical 400 for missing/empty/malformed/non-existent inviteToken.
      throw validationError('Invalid or expired invite');
    }
    return this.authService.signup(result.data, req, res);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() req: RequestWithSession): Promise<MeResponse> {
    return this.authService.me(requireSession(req));
  }

  // SEC-9: @Body() typed as unknown; safeParse with resetRequestSchema.
  @Post('reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestReset(@Body() body: unknown): Promise<{ status: 'accepted' }> {
    // NO user-enumeration: always 202, identical body, regardless of whether
    // the email maps to an account.
    const result = resetRequestSchema.safeParse(body);
    if (!result.success) {
      throw validationError('Invalid request');
    }
    await this.authService.requestReset(result.data);
    return { status: 'accepted' };
  }

  // SEC-9: @Body() typed as unknown; safeParse with resetConfirmSchema.
  @Post('reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmReset(@Body() body: unknown): Promise<{ status: 'ok' }> {
    const result = resetConfirmSchema.safeParse(body);
    if (!result.success) {
      throw validationError('Invalid request');
    }
    await this.authService.confirmReset(result.data);
    return { status: 'ok' };
  }

  // SEC-11: POST /auth/logout is protected by SessionGuard (SuperTokens
  // verifySession with antiCsrf: 'VIA_CUSTOM_HEADER'). A request without
  // the `rid` custom header → SuperTokens rejects → 401 before the handler
  // is reached. No hand-rolled CSRF — the existing SuperTokens config is
  // the anti-CSRF gate (see supertokens.config.ts antiCsrf: 'VIA_CUSTOM_HEADER').
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async logout(@Req() req: RequestWithSession): Promise<{ status: 'ok' }> {
    await this.authService.logout(requireSession(req));
    return { status: 'ok' };
  }
}
