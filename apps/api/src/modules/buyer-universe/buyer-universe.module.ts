/**
 * BuyerUniverseModule — NestJS module for the wave-9 buyer-universe spine.
 *
 * Wires:
 *   - BuyerUniverseRepository (Drizzle read/write queries for buyer_universe tables;
 *     read-only access to M3 companies + contacts and M4 mandate_buyer_criteria)
 *   - BuyerUniverseService (orchestration: assemble/filter/enrich/gaps/submit + audit)
 *   - BuyerUniverseController (HTTP surface: POST/GET/PATCH /buyer-universe/*)
 *
 * Imports:
 *   - AuditModule → exports AuditService (used in-tx for all buyer-universe mutations)
 *   - AuthModule  → exports AuthRepository (getUserWithRole: ST id → app users.id)
 *                   and RolesGuard + SessionGuard (RBAC primitives)
 *
 * The module does NOT export anything — it is a self-contained feature module.
 */

import { Module } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { BuyerUniverseController } from './buyer-universe.controller';
import { BuyerUniverseRepository } from './buyer-universe.repository';
import { BuyerUniverseService } from './buyer-universe.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [BuyerUniverseController],
  providers: [dbProvider, BuyerUniverseRepository, BuyerUniverseService],
})
export class BuyerUniverseModule {}
