import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ComplianceGateModule } from './modules/compliance-gate/compliance-gate.module';

@Module({
  imports: [HealthModule, AuthModule, AuditModule, ComplianceModule, ComplianceGateModule],
})
export class AppModule {}
