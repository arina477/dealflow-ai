/**
 * T-8 DI-boot — AuditModule wires + resolves in the ComplianceModule context.
 *
 * The AuditLogController lives in ComplianceModule and injects AuditVerifier
 * (exported by AuditModule). This test compiles ComplianceModule exactly as the
 * app does at bootstrap and asserts the audit providers resolve — catching a
 * missing export/import (e.g. AuditModule dropping AuditVerifier from exports,
 * or ComplianceModule not importing AuditModule) as a compile-time throw.
 *
 * It ALSO proves the keyring boot fail-fast is DI-wired: AuditKeyring is
 * instantiated at module init, so a missing AUDIT_LOG_HMAC_KEY would crash the
 * compile. The vitest env sets a dummy key so the happy-path compile succeeds;
 * the explicit-missing-key throw is covered directly in audit.keyring.spec.ts.
 */

import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

vi.mock('supertokens-node', () => ({
  default: {
    init: vi.fn(),
    listUsersByAccountInfo: vi.fn(),
    deleteUser: vi.fn(),
    convertToRecipeUserId: vi.fn((id: string) => ({ getAsString: () => id })),
  },
}));
vi.mock('supertokens-node/recipe/emailpassword', () => ({
  default: { init: vi.fn(), signUp: vi.fn() },
}));
vi.mock('supertokens-node/recipe/session', () => ({
  default: { init: vi.fn(), getSession: vi.fn() },
}));

import { Test } from '@nestjs/testing';
import { DB } from '../../db/db.provider';
import { ComplianceModule } from '../compliance/compliance.module';
import { AuditKeyring } from './audit.keyring';
import { AuditService } from './audit.service';
import { AuditVerifier } from './audit.verifier';

describe('NestJS DI — ComplianceModule (consuming AuditModule) compiles', () => {
  it('resolves AuditVerifier + AuditService + AuditKeyring in the consuming context', async () => {
    const fakeDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      transaction: vi.fn(),
      execute: vi.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [ComplianceModule],
    })
      .overrideProvider(DB)
      .useValue(fakeDb)
      .compile();

    expect(moduleRef.get(AuditVerifier)).toBeInstanceOf(AuditVerifier);
    expect(moduleRef.get(AuditService)).toBeInstanceOf(AuditService);
    // Keyring instantiated at module init (boot fail-fast is live in the graph).
    expect(moduleRef.get(AuditKeyring)).toBeInstanceOf(AuditKeyring);
  });
});
