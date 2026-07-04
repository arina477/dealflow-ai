/**
 * MatchingModule — NestJS module for the wave-10 match spine.
 *
 * Wires:
 *   - MatchingRepository (Drizzle read/write queries for match_run + match_candidates;
 *     read-only access to buyer_universe/candidates, M3 companies/contacts,
 *     and mandate_buyer_criteria)
 *   - MatchingService (orchestration: createRunAsActor/patchDispositionAsActor/
 *     handoffAsActor/getRun/listByMandate/getShortlist + pure scorer + audit)
 *   - MatchingController (HTTP surface: POST/GET/PATCH /matches/*)
 *
 * Imports:
 *   - AuditModule → exports AuditService (used in-tx for all match mutations)
 *   - AuthModule  → exports AuthRepository (getUserWithRole: ST id → app users.id)
 *                   and RolesGuard + SessionGuard (RBAC primitives)
 *
 * HARD BOUNDARY: NO Anthropic/Claude/LLM dep imported here.
 * The module does NOT export anything — it is a self-contained feature module.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { MatchingController } from './matching.controller';
import { MatchingRepository } from './matching.repository';
import { MatchingService } from './matching.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [MatchingController],
  providers: [dbProvider, MatchingRepository, MatchingService],
})
export class MatchingModule {}
