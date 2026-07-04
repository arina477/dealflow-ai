/**
 * SourcingModule — NestJS module for the wave-6 deal-sourcing data spine.
 *
 * Wires:
 *   - AdapterRegistry (value provider; pre-populated with FixtureDataSourceAdapter)
 *   - IngestionService (ETL; depends on DB + AdapterRegistry + DedupeEngine)
 *   - SourcingRepository (Drizzle read/write queries)
 *   - SourcingService (orchestration; depends on Repository, Ingestion, Audit, Auth)
 *   - SourcingController (HTTP surface; depends on SourcingService)
 *
 * Imports:
 *   - AuditModule → exports AuditService (used in-tx for dedupe-resolve audit)
 *   - AuthModule  → exports AuthRepository (getUserWithRole: ST id → app users.id)
 *                   and RolesGuard + SessionGuard (the M1 RBAC primitives)
 *
 * The module does NOT export anything — it is a self-contained feature module.
 * External consumers (M4/M5 outreach) will import SourcingModule if they need
 * to read the canonical companies tier; for now it's internal-only.
 */

import { Module, type Provider } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ADAPTER_REGISTRY, createDefaultRegistry } from './adapters/adapter.registry';
import { IngestionService } from './ingestion.service';
import { SourcingController } from './sourcing.controller';
import { SourcingRepository } from './sourcing.repository';
import { SourcingService } from './sourcing.service';

/**
 * AdapterRegistry is a plain class (not @Injectable); we provide it via a
 * factory so NestJS does not try to DI-resolve its constructor.
 * The ADAPTER_REGISTRY symbol token is imported by IngestionService via @Inject.
 */
const adapterRegistryProvider: Provider = {
  provide: ADAPTER_REGISTRY,
  useFactory: () => createDefaultRegistry(),
};

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [SourcingController],
  providers: [
    dbProvider,
    adapterRegistryProvider,
    IngestionService,
    SourcingRepository,
    SourcingService,
  ],
})
export class SourcingModule {}
