/**
 * NestJS DTOs bridged from the shared Zod auth contracts (@dealflow/shared).
 * The schemas are the single source of truth — createZodDto wraps them so Nest
 * gets validation + Swagger metadata without redefining shapes.
 */

import { createZodDto } from '@anatine/zod-nestjs';
import {
  inviteCreateRequestSchema,
  resetConfirmSchema,
  resetRequestSchema,
  signupRequestSchema,
} from '@dealflow/shared';

export class InviteCreateDto extends createZodDto(inviteCreateRequestSchema) {}
export class SignupDto extends createZodDto(signupRequestSchema) {}
export class ResetRequestDto extends createZodDto(resetRequestSchema) {}
export class ResetConfirmDto extends createZodDto(resetConfirmSchema) {}
