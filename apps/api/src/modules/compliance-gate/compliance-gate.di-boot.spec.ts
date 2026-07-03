/**
 * DI-boot regression — ComplianceGateModule consuming-context guard (wave-5).
 *
 * WHY THIS TEST EXISTS:
 *   ComplianceGateService constructor-injects AuditService, which is provided by
 *   AuditModule and must be EXPORTED by it for the gate to resolve in
 *   ComplianceGateModule's injector context. This test compiles the module
 *   exactly as app bootstrap does and asserts the gate + its AuditService
 *   dependency + the gate repository all resolve.
 *
 * FAIL-ON-REVERT:
 *   - Remove AuditService from AuditModule's exports[] → UnknownDependencies at
 *     compile.
 *   - Remove AuditModule from ComplianceGateModule's imports[] → same.
 *   - Drop the DB provider from ComplianceGateModule → ComplianceGateRepository
 *     cannot resolve the DB token.
 *
 * Also pins the AuditKeyring boot fail-fast contract (the module transitively
 * instantiates the keyring), so AUDIT_LOG_HMAC_KEY is set for this compile.
 */

import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { DB } from '../../db/db.provider';
import { AuditService } from '../audit/audit.service';
import { ComplianceGateModule } from './compliance-gate.module';
import { ComplianceGateRepository } from './compliance-gate.repository';
import { ComplianceGateService } from './compliance-gate.service';

const ORIGINAL_ENV = { ...process.env };

describe('NestJS DI container boot — ComplianceGateModule compiles', () => {
  beforeAll(() => {
    // AuditKeyring throws at module init without a key; set a test key.
    process.env.AUDIT_LOG_HMAC_KEY = 'gate-di-boot-test-key';
    process.env.AUDIT_LOG_HMAC_KEY_VERSION = '1';
  });

  afterAll(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('resolves ComplianceGateService + AuditService + ComplianceGateRepository', async () => {
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ComplianceGateModule],
    })
      .overrideProvider(DB)
      .useValue(fakeDb)
      .compile();

    const gate = moduleRef.get(ComplianceGateService);
    expect(gate).toBeInstanceOf(ComplianceGateService);

    // The gate's injected AuditService (exported by AuditModule) must resolve.
    const audit = moduleRef.get(AuditService);
    expect(audit).toBeInstanceOf(AuditService);

    const repo = moduleRef.get(ComplianceGateRepository);
    expect(repo).toBeInstanceOf(ComplianceGateRepository);
  });
});
