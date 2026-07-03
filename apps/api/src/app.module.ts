import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ComplianceModule } from './modules/compliance/compliance.module';

@Module({
  imports: [HealthModule, AuthModule, ComplianceModule],
})
export class AppModule {}
