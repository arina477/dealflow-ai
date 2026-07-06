import { Module } from '@nestjs/common';
import { WorkspaceModule } from './db/workspace.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './modules/admin/admin.module';
import { AdminActivityModule } from './modules/admin-activity/admin-activity.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BuyerUniverseModule } from './modules/buyer-universe/buyer-universe.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ComplianceGateModule } from './modules/compliance-gate/compliance-gate.module';
import { MandateModule } from './modules/mandate/mandate.module';
import { MatchingModule } from './modules/matching/matching.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { RecordkeepingModule } from './modules/recordkeeping/recordkeeping.module';
import { SourcingModule } from './modules/sourcing/sourcing.module';

@Module({
  imports: [
    // Wave-17 (task 96026365): workspace GUC interceptor — MUST be first so the
    // dedicated-connection + GUC are set before any tenant repository runs.
    WorkspaceModule,
    HealthModule,
    AuthModule,
    AuditModule,
    AdminModule,
    // Wave-16 (task 8bb0a22f): admin-activity read surface (P-4 Finding 3).
    AdminActivityModule,
    ComplianceModule,
    ComplianceGateModule,
    BuyerUniverseModule,
    MandateModule,
    MatchingModule,
    OutreachModule,
    PipelineModule,
    RecordkeepingModule,
    SourcingModule,
  ],
})
export class AppModule {}
