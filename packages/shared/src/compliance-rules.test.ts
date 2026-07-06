import { describe, expect, it } from 'vitest';
import {
  blockReasonEnum,
  blockReasonSchema,
  gateContextSchema,
  gateVerdictSchema,
} from './compliance-gate';
import {
  approvalCreateSchema,
  approvalStatusEnum,
  complianceApprovalSchema,
  complianceRuleSchema,
  complianceRuleTypeEnum,
  disclaimerCreateSchema,
  disclaimerTemplateSchema,
  disclaimerUpdateSchema,
  ruleCreateSchema,
  ruleUpdateSchema,
  suppressionCreateSchema,
  suppressionEntrySchema,
  suppressionMatchTypeEnum,
} from './compliance-rules';

// ---------------------------------------------------------------------------
// GateVerdict
// ---------------------------------------------------------------------------

describe('gateVerdictSchema — parse + reject', () => {
  it('parses a clean allow verdict (no blocks, no disclaimers)', () => {
    const result = gateVerdictSchema.parse({
      allowed: true,
      blocks: [],
      requiredDisclaimers: [],
    });
    expect(result.allowed).toBe(true);
    expect(result.blocks).toHaveLength(0);
    expect(result.requiredDisclaimers).toHaveLength(0);
  });

  it('parses a blocked verdict with a suppression block', () => {
    const result = gateVerdictSchema.parse({
      allowed: false,
      blocks: [
        {
          code: 'suppression',
          recipient: 'bad@example.com',
          matchType: 'email',
          matchedValue: 'bad@example.com',
          message: 'Recipient is on the suppression list',
        },
      ],
      requiredDisclaimers: [],
    });
    expect(result.allowed).toBe(false);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]?.code).toBe('suppression');
  });

  it('parses a blocked verdict with an SoD block', () => {
    const result = gateVerdictSchema.parse({
      allowed: false,
      blocks: [
        {
          code: 'sod',
          reason: 'sender-is-approver',
          message: 'Sender cannot be the SoD approver',
        },
      ],
      requiredDisclaimers: [],
    });
    expect(result.blocks[0]?.code).toBe('sod');
  });

  it('parses a blocked verdict with a content-hash-mismatch block', () => {
    const result = gateVerdictSchema.parse({
      allowed: false,
      blocks: [
        {
          code: 'content-hash-mismatch',
          approvedHash: 'a'.repeat(64),
          currentHash: 'b'.repeat(64),
          message: 'Content has changed since approval',
        },
      ],
      requiredDisclaimers: [],
    });
    expect(result.blocks[0]?.code).toBe('content-hash-mismatch');
  });

  it('parses a blocked verdict with a missing-disclaimer block', () => {
    const result = gateVerdictSchema.parse({
      allowed: false,
      blocks: [
        {
          code: 'missing-disclaimer',
          jurisdiction: 'US',
          disclaimerTemplateId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
          message: 'Required disclaimer for US jurisdiction not satisfied',
        },
      ],
      requiredDisclaimers: ['1931b452-c7d5-43a0-9657-7e7cd1728203'],
    });
    expect(result.blocks[0]?.code).toBe('missing-disclaimer');
    expect(result.requiredDisclaimers).toHaveLength(1);
  });

  it('parses a blocked verdict with a no-approval block', () => {
    const result = gateVerdictSchema.parse({
      allowed: false,
      blocks: [{ code: 'no-approval', message: 'No compliance approval found' }],
      requiredDisclaimers: [],
    });
    expect(result.blocks[0]?.code).toBe('no-approval');
  });

  it('parses a verdict with multiple simultaneous blocks', () => {
    const result = gateVerdictSchema.parse({
      allowed: false,
      blocks: [
        {
          code: 'suppression',
          recipient: 'a@bad.com',
          matchType: 'domain',
          matchedValue: 'bad.com',
          message: 'Domain suppressed',
        },
        {
          code: 'sod',
          reason: 'approver-unknown',
          message: 'Approver account deleted — SoD cannot be verified',
        },
      ],
      requiredDisclaimers: [],
    });
    expect(result.blocks).toHaveLength(2);
  });

  it('rejects a verdict missing the allowed field', () => {
    expect(() => gateVerdictSchema.parse({ blocks: [], requiredDisclaimers: [] })).toThrow();
  });

  it('rejects a verdict missing the blocks array', () => {
    expect(() => gateVerdictSchema.parse({ allowed: true, requiredDisclaimers: [] })).toThrow();
  });

  it('rejects a verdict missing requiredDisclaimers', () => {
    expect(() => gateVerdictSchema.parse({ allowed: true, blocks: [] })).toThrow();
  });

  it('rejects extra fields (strict mode)', () => {
    expect(() =>
      gateVerdictSchema.parse({ allowed: true, blocks: [], requiredDisclaimers: [], extra: 'oops' })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// BlockReason — discriminated union parse + reject
// ---------------------------------------------------------------------------

describe('blockReasonSchema — discriminated union', () => {
  it('parses suppression block with email matchType', () => {
    const result = blockReasonSchema.parse({
      code: 'suppression',
      recipient: 'user@example.com',
      matchType: 'email',
      matchedValue: 'user@example.com',
      message: 'Suppressed',
    });
    expect(result.code).toBe('suppression');
  });

  it('parses suppression block with domain matchType', () => {
    const result = blockReasonSchema.parse({
      code: 'suppression',
      recipient: 'user@blocked.com',
      matchType: 'domain',
      matchedValue: 'blocked.com',
      message: 'Domain suppressed',
    });
    if (result.code === 'suppression') {
      expect(result.matchType).toBe('domain');
    }
  });

  it('rejects suppression block with invalid matchType', () => {
    expect(() =>
      blockReasonSchema.parse({
        code: 'suppression',
        recipient: 'a@b.com',
        matchType: 'phone',
        matchedValue: 'a@b.com',
        message: 'x',
      })
    ).toThrow();
  });

  it('parses all four sod sub-reasons', () => {
    const reasons = [
      'sender-is-approver',
      'invalid-approver-role',
      'approval-revoked',
      'approver-unknown',
    ] as const;
    for (const reason of reasons) {
      const result = blockReasonSchema.parse({
        code: 'sod',
        reason,
        message: `SoD block: ${reason}`,
      });
      expect(result.code).toBe('sod');
    }
  });

  it('rejects sod block with unknown sub-reason', () => {
    expect(() =>
      blockReasonSchema.parse({ code: 'sod', reason: 'admin-approved', message: 'x' })
    ).toThrow();
  });

  it('parses content-hash-mismatch block', () => {
    const result = blockReasonSchema.parse({
      code: 'content-hash-mismatch',
      approvedHash: 'a'.repeat(64),
      currentHash: 'b'.repeat(64),
      message: 'Hash mismatch',
    });
    expect(result.code).toBe('content-hash-mismatch');
  });

  it('parses missing-disclaimer block with valid UUID', () => {
    const result = blockReasonSchema.parse({
      code: 'missing-disclaimer',
      jurisdiction: 'EU',
      disclaimerTemplateId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
      message: 'Missing disclaimer',
    });
    expect(result.code).toBe('missing-disclaimer');
  });

  it('rejects missing-disclaimer block with non-UUID disclaimerTemplateId', () => {
    expect(() =>
      blockReasonSchema.parse({
        code: 'missing-disclaimer',
        jurisdiction: 'EU',
        disclaimerTemplateId: 'not-a-uuid',
        message: 'x',
      })
    ).toThrow();
  });

  it('parses no-approval block', () => {
    const result = blockReasonSchema.parse({
      code: 'no-approval',
      message: 'No approval',
    });
    expect(result.code).toBe('no-approval');
  });

  it('rejects a block with an unknown code', () => {
    expect(() => blockReasonSchema.parse({ code: 'unknown-code', message: 'x' })).toThrow();
  });

  it('rejects extra fields on a block variant (strict mode)', () => {
    expect(() =>
      blockReasonSchema.parse({
        code: 'no-approval',
        message: 'x',
        extraField: 'oops',
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// blockReasonEnum — all 6 codes accepted
// ---------------------------------------------------------------------------

describe('blockReasonEnum', () => {
  it('accepts all six block codes', () => {
    const codes = [
      'suppression',
      'sod',
      'content-hash-mismatch',
      'missing-disclaimer',
      'no-approval',
      'version-binding',
    ] as const;
    for (const code of codes) {
      expect(blockReasonEnum.parse(code)).toBe(code);
    }
  });

  it('rejects unknown block codes', () => {
    expect(() => blockReasonEnum.parse('bypass')).toThrow();
    expect(() => blockReasonEnum.parse('')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// GateContext
// ---------------------------------------------------------------------------

describe('gateContextSchema', () => {
  const validCtx = {
    senderUserId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
    senderRole: 'advisor' as const,
    recipients: ['alice@example.com'],
    jurisdiction: 'US',
    content: 'Hello, this is the outreach content.',
    contentHash: 'a'.repeat(64),
    resourceType: 'outreach',
    resourceId: 'batch-001',
    // Wave-14 (task 487b0f0c): mandateId is now a required field of GateContext.
    // It is hash-excluded (recorded in the mandate_id column, not the HMAC preimage).
    mandateId: 'aaaaaaaa-0000-4000-8000-000000000001',
  };

  it('parses a valid gate context', () => {
    const result = gateContextSchema.parse(validCtx);
    expect(result.senderUserId).toBe(validCtx.senderUserId);
    expect(result.recipients).toHaveLength(1);
    expect(result.contentHash).toHaveLength(64);
  });

  it('accepts multiple recipients', () => {
    const result = gateContextSchema.parse({
      ...validCtx,
      recipients: ['a@example.com', 'b@example.com'],
    });
    expect(result.recipients).toHaveLength(2);
  });

  it('rejects a non-UUID senderUserId', () => {
    expect(() => gateContextSchema.parse({ ...validCtx, senderUserId: 'not-a-uuid' })).toThrow();
  });

  it('rejects an invalid senderRole', () => {
    expect(() => gateContextSchema.parse({ ...validCtx, senderRole: 'superuser' })).toThrow();
  });

  it('rejects an empty recipients array', () => {
    expect(() => gateContextSchema.parse({ ...validCtx, recipients: [] })).toThrow();
  });

  it('rejects a recipient that is not a valid email', () => {
    expect(() => gateContextSchema.parse({ ...validCtx, recipients: ['not-an-email'] })).toThrow();
  });

  it('rejects a contentHash that is not 64 chars', () => {
    expect(() => gateContextSchema.parse({ ...validCtx, contentHash: 'abc' })).toThrow();
    expect(() => gateContextSchema.parse({ ...validCtx, contentHash: 'a'.repeat(65) })).toThrow();
  });

  it('rejects extra fields (strict mode)', () => {
    expect(() => gateContextSchema.parse({ ...validCtx, skipChecks: true })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ComplianceRule entity + create/update input schemas
// ---------------------------------------------------------------------------

describe('complianceRuleTypeEnum', () => {
  it('accepts all four rule types', () => {
    const types = [
      'blocklist_check',
      'disclaimer_required',
      'approval_required',
      'jurisdiction_check',
    ] as const;
    for (const t of types) {
      expect(complianceRuleTypeEnum.parse(t)).toBe(t);
    }
  });

  it('rejects unknown rule types', () => {
    expect(() => complianceRuleTypeEnum.parse('custom_check')).toThrow();
  });
});

const validRule = {
  id: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  ruleType: 'blocklist_check' as const,
  jurisdiction: null,
  config: { checkDomain: true },
  enabled: true,
  createdBy: '1931b452-c7d5-43a0-9657-7e7cd1728204',
  createdAt: '2026-07-03T12:00:00.000Z',
  updatedAt: null,
};

describe('complianceRuleSchema', () => {
  it('parses a valid rule with null jurisdiction and null updatedAt', () => {
    const result = complianceRuleSchema.parse(validRule);
    expect(result.id).toBe(validRule.id);
    expect(result.jurisdiction).toBeNull();
    expect(result.updatedAt).toBeNull();
  });

  it('parses a rule with a jurisdiction and updatedAt', () => {
    const result = complianceRuleSchema.parse({
      ...validRule,
      jurisdiction: 'EU',
      updatedAt: '2026-07-03T14:00:00.000Z',
    });
    expect(result.jurisdiction).toBe('EU');
    expect(result.updatedAt).toBeDefined();
  });

  it('rejects a non-UUID id', () => {
    expect(() => complianceRuleSchema.parse({ ...validRule, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects an invalid ruleType', () => {
    expect(() => complianceRuleSchema.parse({ ...validRule, ruleType: 'bad_type' })).toThrow();
  });

  it('rejects extra fields (strict mode)', () => {
    expect(() => complianceRuleSchema.parse({ ...validRule, extra: 'oops' })).toThrow();
  });
});

describe('ruleCreateSchema', () => {
  it('parses a valid create input with defaults', () => {
    const result = ruleCreateSchema.parse({ ruleType: 'approval_required', config: {} });
    expect(result.enabled).toBe(true); // default
    expect(result.jurisdiction).toBeUndefined();
  });

  it('accepts enabled: false explicitly', () => {
    const result = ruleCreateSchema.parse({
      ruleType: 'disclaimer_required',
      config: { jurisdiction: 'US' },
      enabled: false,
    });
    expect(result.enabled).toBe(false);
  });

  it('rejects missing config', () => {
    expect(() => ruleCreateSchema.parse({ ruleType: 'blocklist_check' })).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() =>
      ruleCreateSchema.parse({ ruleType: 'blocklist_check', config: {}, unknownProp: true })
    ).toThrow();
  });
});

describe('ruleUpdateSchema', () => {
  it('parses a valid update with just enabled toggle', () => {
    const result = ruleUpdateSchema.parse({ enabled: false });
    expect(result.enabled).toBe(false);
  });

  it('parses a valid update with multiple fields', () => {
    const result = ruleUpdateSchema.parse({ enabled: true, jurisdiction: 'US' });
    expect(result.jurisdiction).toBe('US');
  });

  it('rejects an empty update object (at least one field required)', () => {
    expect(() => ruleUpdateSchema.parse({})).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() => ruleUpdateSchema.parse({ enabled: true, unknown: 'x' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// SuppressionEntry entity + create input schema
// ---------------------------------------------------------------------------

describe('suppressionMatchTypeEnum', () => {
  it('accepts email and domain', () => {
    expect(suppressionMatchTypeEnum.parse('email')).toBe('email');
    expect(suppressionMatchTypeEnum.parse('domain')).toBe('domain');
  });

  it('rejects unknown match types', () => {
    expect(() => suppressionMatchTypeEnum.parse('phone')).toThrow();
  });
});

const validSuppressionEntry = {
  id: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  matchType: 'email' as const,
  value: 'blocked@example.com',
  reason: 'Regulatory opt-out',
  createdBy: '1931b452-c7d5-43a0-9657-7e7cd1728204',
  createdAt: '2026-07-03T12:00:00.000Z',
};

describe('suppressionEntrySchema', () => {
  it('parses a valid suppression entry', () => {
    const result = suppressionEntrySchema.parse(validSuppressionEntry);
    expect(result.matchType).toBe('email');
    expect(result.value).toBe('blocked@example.com');
  });

  it('accepts null reason and null createdBy', () => {
    const result = suppressionEntrySchema.parse({
      ...validSuppressionEntry,
      reason: null,
      createdBy: null,
    });
    expect(result.reason).toBeNull();
    expect(result.createdBy).toBeNull();
  });

  it('rejects extra fields (strict)', () => {
    expect(() => suppressionEntrySchema.parse({ ...validSuppressionEntry, extra: 'x' })).toThrow();
  });
});

describe('suppressionCreateSchema', () => {
  it('parses a valid email suppression create', () => {
    const result = suppressionCreateSchema.parse({
      matchType: 'email',
      value: 'bad@example.com',
    });
    expect(result.matchType).toBe('email');
    expect(result.reason).toBeUndefined();
  });

  it('parses a domain suppression create with reason', () => {
    const result = suppressionCreateSchema.parse({
      matchType: 'domain',
      value: 'badactor.com',
      reason: 'Known spam domain',
    });
    expect(result.value).toBe('badactor.com');
    expect(result.reason).toBe('Known spam domain');
  });

  it('rejects missing value', () => {
    expect(() => suppressionCreateSchema.parse({ matchType: 'email' })).toThrow();
  });

  it('rejects empty value string', () => {
    expect(() => suppressionCreateSchema.parse({ matchType: 'email', value: '' })).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() =>
      suppressionCreateSchema.parse({ matchType: 'email', value: 'x@x.com', extra: 'y' })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// DisclaimerTemplate entity + create/update input schemas
// ---------------------------------------------------------------------------

const validDisclaimer = {
  id: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  jurisdiction: 'US',
  body: 'This communication is confidential.',
  version: 1,
  active: true,
  createdBy: '1931b452-c7d5-43a0-9657-7e7cd1728204',
  createdAt: '2026-07-03T12:00:00.000Z',
};

describe('disclaimerTemplateSchema', () => {
  it('parses a valid active disclaimer template', () => {
    const result = disclaimerTemplateSchema.parse(validDisclaimer);
    expect(result.jurisdiction).toBe('US');
    expect(result.version).toBe(1);
    expect(result.active).toBe(true);
  });

  it('parses an inactive versioned disclaimer (prior version, deactivated)', () => {
    const result = disclaimerTemplateSchema.parse({
      ...validDisclaimer,
      active: false,
      version: 2,
    });
    expect(result.active).toBe(false);
    expect(result.version).toBe(2);
  });

  it('rejects version <= 0', () => {
    expect(() => disclaimerTemplateSchema.parse({ ...validDisclaimer, version: 0 })).toThrow();
  });

  it('rejects non-integer version', () => {
    expect(() => disclaimerTemplateSchema.parse({ ...validDisclaimer, version: 1.5 })).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() => disclaimerTemplateSchema.parse({ ...validDisclaimer, extraField: 'x' })).toThrow();
  });
});

describe('disclaimerCreateSchema', () => {
  it('parses a valid create input', () => {
    const result = disclaimerCreateSchema.parse({
      jurisdiction: 'EU',
      body: 'EU compliance disclaimer text.',
    });
    expect(result.jurisdiction).toBe('EU');
    expect(result.body).toBe('EU compliance disclaimer text.');
  });

  it('rejects missing jurisdiction', () => {
    expect(() => disclaimerCreateSchema.parse({ body: 'text' })).toThrow();
  });

  it('rejects empty body', () => {
    expect(() => disclaimerCreateSchema.parse({ jurisdiction: 'US', body: '' })).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() =>
      disclaimerCreateSchema.parse({ jurisdiction: 'US', body: 'x', version: 1 })
    ).toThrow();
  });
});

describe('disclaimerUpdateSchema', () => {
  it('parses a body-only update', () => {
    const result = disclaimerUpdateSchema.parse({ body: 'New disclaimer body.' });
    expect(result.body).toBe('New disclaimer body.');
  });

  it('parses a jurisdiction-only update', () => {
    const result = disclaimerUpdateSchema.parse({ jurisdiction: 'CA' });
    expect(result.jurisdiction).toBe('CA');
  });

  it('rejects an empty update object', () => {
    expect(() => disclaimerUpdateSchema.parse({})).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() => disclaimerUpdateSchema.parse({ body: 'x', version: 2 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// ComplianceApproval entity + create input schema
// ---------------------------------------------------------------------------

describe('approvalStatusEnum', () => {
  it('accepts approved and revoked', () => {
    expect(approvalStatusEnum.parse('approved')).toBe('approved');
    expect(approvalStatusEnum.parse('revoked')).toBe('revoked');
  });

  it('rejects unknown statuses', () => {
    expect(() => approvalStatusEnum.parse('pending')).toThrow();
  });
});

const validApproval = {
  id: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  resourceType: 'outreach',
  resourceId: 'batch-001',
  contentHash: 'a'.repeat(64),
  approverUserId: '1931b452-c7d5-43a0-9657-7e7cd1728204',
  approverRole: 'compliance',
  status: 'approved' as const,
  createdAt: '2026-07-03T12:00:00.000Z',
};

describe('complianceApprovalSchema', () => {
  it('parses a valid approval row', () => {
    const result = complianceApprovalSchema.parse(validApproval);
    expect(result.status).toBe('approved');
    expect(result.approverRole).toBe('compliance');
    expect(result.contentHash).toHaveLength(64);
  });

  it('parses a revoked approval', () => {
    const result = complianceApprovalSchema.parse({ ...validApproval, status: 'revoked' });
    expect(result.status).toBe('revoked');
  });

  it('accepts null approverUserId (deleted user)', () => {
    const result = complianceApprovalSchema.parse({ ...validApproval, approverUserId: null });
    expect(result.approverUserId).toBeNull();
  });

  it('rejects a contentHash that is not 64 chars', () => {
    expect(() =>
      complianceApprovalSchema.parse({ ...validApproval, contentHash: 'short' })
    ).toThrow();
  });

  it('rejects an invalid status', () => {
    expect(() => complianceApprovalSchema.parse({ ...validApproval, status: 'pending' })).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() => complianceApprovalSchema.parse({ ...validApproval, bypassGate: true })).toThrow();
  });
});

describe('approvalCreateSchema', () => {
  it('parses a valid approval create input', () => {
    const result = approvalCreateSchema.parse({
      resourceType: 'outreach',
      resourceId: 'batch-001',
      contentHash: 'a'.repeat(64),
    });
    expect(result.contentHash).toHaveLength(64);
  });

  it('rejects a contentHash that is not 64 chars', () => {
    expect(() =>
      approvalCreateSchema.parse({
        resourceType: 'outreach',
        resourceId: 'batch-001',
        contentHash: 'short',
      })
    ).toThrow();
  });

  it('rejects missing resourceType', () => {
    expect(() =>
      approvalCreateSchema.parse({ resourceId: 'x', contentHash: 'a'.repeat(64) })
    ).toThrow();
  });

  it('rejects extra fields (strict)', () => {
    expect(() =>
      approvalCreateSchema.parse({
        resourceType: 'outreach',
        resourceId: 'x',
        contentHash: 'a'.repeat(64),
        approverUserId: 'self-approve',
      })
    ).toThrow();
  });
});
