/**
 * MatchFeedbackModule — workspace-scoped match calibration surface.
 *
 * Wave-19 (tasks 69387b56 / e206a56a).
 *
 * Exposes GET /match-feedback → MatchFeedbackController → MatchFeedbackService →
 * MatchFeedbackRepository (workspace-scoped calibration queries via getDb()).
 *
 * Imports:
 *   - AuthModule → SessionGuard, RolesGuard, AuthRepository (BUILD rule 2:
 *                  RolesGuard constructor-injects AuthRepository; AuthModule
 *                  exports both so they resolve in this module's DI context).
 *
 * No exports: self-contained feature module (read-only surface, no downstream
 * consumers need a service or repository from here).
 *
 * Security note: this module NEVER writes to any table. The service layer
 * enforces the no-write invariant (MatchFeedbackRepository has no INSERT/UPDATE/DELETE
 * methods). No AuditService.append call is ever made in this path. No LLM/ML.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuthModule } from '../auth/auth.module';
import { MatchFeedbackController } from './match-feedback.controller';
import { MatchFeedbackRepository } from './match-feedback.repository';
import { MatchFeedbackService } from './match-feedback.service';

@Module({
  imports: [AuthModule],
  controllers: [MatchFeedbackController],
  providers: [dbProvider, MatchFeedbackRepository, MatchFeedbackService],
})
export class MatchFeedbackModule {}
