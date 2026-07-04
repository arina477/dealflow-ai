import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BuyerUniverseModule } from './modules/buyer-universe/buyer-universe.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ComplianceGateModule } from './modules/compliance-gate/compliance-gate.module';
import { MandateModule } from './modules/mandate/mandate.module';
import { MatchingModule } from './modules/matching/matching.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { SourcingModule } from './modules/sourcing/sourcing.module';

@Module({
  imports: [
    HealthModule,
    AuthModule,
    AuditModule,
    ComplianceModule,
    ComplianceGateModule,
    BuyerUniverseModule,
    MandateModule,
    MatchingModule,
    OutreachModule,
    SourcingModule,
  ],
})
export class AppModule {}
