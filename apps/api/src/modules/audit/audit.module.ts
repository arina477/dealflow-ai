/**
 * AuditModule (wave-4, task a8b2b5a2 / e6a4cbfe) — the audit-log domain module.
 *
 * Providers: keyring (boot fail-fast on missing AUDIT_LOG_HMAC_KEY), DB provider,
 * repository, append service, verifier. Exports AuditService (for future audited
 * call-sites, M6+) and AuditVerifier (consumed by the compliance module's
 * audit-log controller).
 *
 * Boot fail-fast note: AuditKeyring's constructor parses AUDIT_LOG_HMAC_KEY and
 * THROWS if it is missing/empty. Because AuditService/AuditVerifier depend on
 * the keyring, NestJS instantiates the keyring at module init — so a missing key
 * crashes the app at boot, before any request is served. No unsigned entry is
 * ever writable.
 */

import { Module, type Provider } from '@nestjs/common';

import { dbProvider } from '../../db/db.provider';
import { AuditKeyring } from './audit.keyring';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { AuditVerifier } from './audit.verifier';

/**
 * AuditKeyring is provided via a FACTORY (not class-provider) because its
 * constructor takes an env `source` param (defaulted to process.env). A plain
 * class-provider would make Nest attempt to DI-resolve that param and fail. The
 * factory constructs it explicitly from process.env — the boot fail-fast still
 * fires at module init (the factory runs when the provider is instantiated),
 * so a missing AUDIT_LOG_HMAC_KEY crashes the app at boot.
 */
const auditKeyringProvider: Provider = {
  provide: AuditKeyring,
  useFactory: () => new AuditKeyring(process.env),
};

@Module({
  providers: [dbProvider, auditKeyringProvider, AuditRepository, AuditService, AuditVerifier],
  // AuditRepository exported so the admin-activity module can call the READ-ONLY
  // findAdminActivity / countAdminActivity methods (P-4 Finding 3, task 8bb0a22f).
  // AuditService and AuditVerifier are the pre-existing exports.
  exports: [AuditService, AuditVerifier, AuditRepository],
})
export class AuditModule {}
