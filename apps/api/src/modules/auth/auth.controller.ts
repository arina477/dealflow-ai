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
// biome-ignore lint/style/useImportType: DTOs must be value imports (Nest reads them at runtime via emitDecoratorMetadata to validate request bodies)
import { InviteCreateDto, ResetConfirmDto, ResetRequestDto, SignupDto } from './dto';
import type { RequestWithSession } from './guards/session.guard';
import { SessionGuard } from './guards/session.guard';

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

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  async invite(@Body() body: InviteCreateDto): Promise<InviteCreateResponse> {
    return this.authService.createInvite(body);
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(
    @Body() body: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<SignupResponse> {
    return this.authService.signup(body, req, res);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() req: RequestWithSession): Promise<MeResponse> {
    return this.authService.me(requireSession(req));
  }

  @Post('reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestReset(@Body() body: ResetRequestDto): Promise<{ status: 'accepted' }> {
    // NO user-enumeration: always 202, identical body, regardless of whether
    // the email maps to an account.
    await this.authService.requestReset(body);
    return { status: 'accepted' };
  }

  @Post('reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmReset(@Body() body: ResetConfirmDto): Promise<{ status: 'ok' }> {
    await this.authService.confirmReset(body);
    return { status: 'ok' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionGuard)
  async logout(@Req() req: RequestWithSession): Promise<{ status: 'ok' }> {
    await this.authService.logout(requireSession(req));
    return { status: 'ok' };
  }
}
