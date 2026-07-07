/**
 * SellerIntentModule — workspace-scoped seller-intent scoring surface.
 *
 * Wave-23 (tasks 9e54cc11 / 1188e7da / 12947422).
 *
 * Exposes GET /seller-intent → SellerIntentController → SellerIntentService →
 * SellerIntentRepository (3-signal workspace-scoped aggregation via getDb()).
 *
 * Imports:
 *   - AuthModule → SessionGuard, RolesGuard, AuthRepository (BUILD rule 2:
 *                  RolesGuard constructor-injects AuthRepository; AuthModule
 *                  exports both so they resolve in this module's DI context).
 *
 * No exports: self-contained feature module (read-only surface, no downstream
 * consumers need a service or repository from here).
 *
 * HARD BOUNDARY:
 *   NO Anthropic/Claude/LLM import anywhere in this module.
 *   NO external send, NO external SDK, NO network call.
 *   NO BullMQ, NO randomness, NO Date.now() inside scorer.
 *   PURE DETERMINISTIC scoring — identical inputs → identical output.
 *   NO tieBreak as a scored/surfaced dimension (SI1 — PRODUCT #1).
 *
 * Security note: this module NEVER writes to any table. The service layer
 * enforces the no-write invariant (SellerIntentRepository has no INSERT/UPDATE/DELETE
 * methods). No AuditService.append call is ever made in this path.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuthModule } from '../auth/auth.module';
import { SellerIntentController } from './seller-intent.controller';
import { SellerIntentRepository } from './seller-intent.repository';
import { SellerIntentService } from './seller-intent.service';

@Module({
  imports: [AuthModule],
  controllers: [SellerIntentController],
  providers: [dbProvider, SellerIntentRepository, SellerIntentService],
})
export class SellerIntentModule {}
