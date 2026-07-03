/**
 * NestJS DTOs for the B-2 compliance CRUD endpoints (wave-5).
 *
 * Bridges shared Zod schemas to NestJS DTO classes via @anatine/zod-nestjs
 * createZodDto — the same pattern as auth/dto.ts. This gives Nest the class
 * metadata it needs for DI / body deserialization; validation is done by Zod
 * parsing in the controller before the service call (400 on ZodError).
 */

import { createZodDto } from '@anatine/zod-nestjs';
import {
  disclaimerCreateSchema,
  disclaimerUpdateSchema,
  ruleCreateSchema,
  ruleUpdateSchema,
  suppressionCreateSchema,
} from '@dealflow/shared';

export class RuleCreateDto extends createZodDto(ruleCreateSchema) {}
export class RuleUpdateDto extends createZodDto(ruleUpdateSchema) {}
export class SuppressionCreateDto extends createZodDto(suppressionCreateSchema) {}
export class DisclaimerCreateDto extends createZodDto(disclaimerCreateSchema) {}
export class DisclaimerUpdateDto extends createZodDto(disclaimerUpdateSchema) {}
