import { describe, expect, it } from 'vitest';
import type { DataSourceAdapter, DataSourceConnection, NormalizedSourceRecord } from './sourcing';
import {
  companiesListFilterSchema,
  companyProvenanceSchema,
  companySchema,
  connectionCreateSchema,
  contactProvenanceSchema,
  contactSchema,
  dataSourceConnectionSchema,
  dedupeCandidateSchema,
  dedupeCandidateStatusEnum,
  dedupeResolveInputSchema,
  normalizedContactSchema,
  normalizedSourceRecordSchema,
  syncSummarySchema,
} from './sourcing';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const validNormalizedRecord: NormalizedSourceRecord = {
  sourceRecordId: 'src-001',
  name: 'Acme Corp',
  domain: 'acme.com',
  contacts: [{ name: 'Alice', email: 'alice@acme.com', title: 'CEO' }],
  raw: { original_id: 'src-001' },
};

const validCompany = {
  id: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  name: 'Acme Corp',
  domain: 'acme.com',
  normalizedDomain: 'acme.com',
  normalizedName: 'acme corp',
  sector: null,
  status: 'active',
  createdAt: '2026-07-03T10:00:00.000Z',
  updatedAt: null,
};

const validContact = {
  id: '2931b452-c7d5-43a0-9657-7e7cd1728203',
  companyId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  name: 'Alice Smith',
  email: 'alice@acme.com',
  normalizedEmail: 'alice@acme.com',
  title: 'CEO',
  createdAt: '2026-07-03T10:00:00.000Z',
  updatedAt: null,
};

const validConnection = {
  id: '3931b452-c7d5-43a0-9657-7e7cd1728203',
  providerKey: 'FIXTURE_PROVIDER',
  displayName: 'Fixture Provider',
  enabled: true,
  config: { field_map: {} },
  createdBy: null,
  createdAt: '2026-07-03T10:00:00.000Z',
};

const validCompanyProvenance = {
  id: '4931b452-c7d5-43a0-9657-7e7cd1728203',
  companyId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  rawCompanyId: '5931b452-c7d5-43a0-9657-7e7cd1728203',
  connectionId: '3931b452-c7d5-43a0-9657-7e7cd1728203',
  contributedFields: { name: true, domain: true },
  ingestedAt: '2026-07-03T10:00:00.000Z',
};

const validContactProvenance = {
  id: '6931b452-c7d5-43a0-9657-7e7cd1728203',
  contactId: '2931b452-c7d5-43a0-9657-7e7cd1728203',
  rawCompanyId: '5931b452-c7d5-43a0-9657-7e7cd1728203',
  connectionId: '3931b452-c7d5-43a0-9657-7e7cd1728203',
  ingestedAt: '2026-07-03T10:00:00.000Z',
};

const validDedupeCandidate = {
  id: '7931b452-c7d5-43a0-9657-7e7cd1728203',
  rawCompanyId: '5931b452-c7d5-43a0-9657-7e7cd1728203',
  matchedCompanyId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
  score: 0.85,
  reason: 'Partial name token overlap without domain agreement',
  status: 'pending' as const,
  resolvedBy: null,
  createdAt: '2026-07-03T10:00:00.000Z',
  resolvedAt: null,
};

// ---------------------------------------------------------------------------
// normalizedContactSchema
// ---------------------------------------------------------------------------

describe('normalizedContactSchema', () => {
  it('parses a full contact', () => {
    const result = normalizedContactSchema.parse({
      name: 'Alice',
      email: 'alice@acme.com',
      title: 'CEO',
    });
    expect(result.name).toBe('Alice');
    expect(result.email).toBe('alice@acme.com');
    expect(result.title).toBe('CEO');
  });

  it('parses an empty contact (all fields optional)', () => {
    const result = normalizedContactSchema.parse({});
    expect(result.name).toBeUndefined();
    expect(result.email).toBeUndefined();
    expect(result.title).toBeUndefined();
  });

  it('rejects an invalid email', () => {
    expect(() => normalizedContactSchema.parse({ email: 'not-an-email' })).toThrow();
  });

  it('rejects an empty name string', () => {
    expect(() => normalizedContactSchema.parse({ name: '' })).toThrow();
  });

  it('rejects unknown extra fields (strict mode)', () => {
    expect(() => normalizedContactSchema.parse({ phone: '555-0100' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// normalizedSourceRecordSchema — the adapter return shape
// ---------------------------------------------------------------------------

describe('normalizedSourceRecordSchema', () => {
  it('parses a valid full record', () => {
    const result = normalizedSourceRecordSchema.parse(validNormalizedRecord);
    expect(result.sourceRecordId).toBe('src-001');
    expect(result.name).toBe('Acme Corp');
    expect(result.domain).toBe('acme.com');
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0]?.email).toBe('alice@acme.com');
  });

  it('parses a record with no domain (domain is optional)', () => {
    const result = normalizedSourceRecordSchema.parse({
      sourceRecordId: 'src-002',
      name: 'Beta Ltd',
      contacts: [],
    });
    expect(result.domain).toBeUndefined();
    expect(result.contacts).toHaveLength(0);
  });

  it('parses a record with no raw payload', () => {
    const result = normalizedSourceRecordSchema.parse({
      sourceRecordId: 'src-003',
      name: 'Gamma Inc',
      contacts: [],
    });
    expect(result.raw).toBeUndefined();
  });

  it('parses a record with multiple contacts', () => {
    const result = normalizedSourceRecordSchema.parse({
      sourceRecordId: 'src-004',
      name: 'Delta Co',
      contacts: [
        { name: 'Bob', email: 'bob@delta.co' },
        { name: 'Carol', title: 'CFO' },
      ],
    });
    expect(result.contacts).toHaveLength(2);
  });

  it('rejects empty sourceRecordId', () => {
    expect(() =>
      normalizedSourceRecordSchema.parse({ ...validNormalizedRecord, sourceRecordId: '' })
    ).toThrow();
  });

  it('rejects empty name', () => {
    expect(() =>
      normalizedSourceRecordSchema.parse({ ...validNormalizedRecord, name: '' })
    ).toThrow();
  });

  it('rejects missing sourceRecordId', () => {
    const { sourceRecordId: _id, ...withoutId } = validNormalizedRecord;
    expect(() => normalizedSourceRecordSchema.parse(withoutId)).toThrow();
  });

  it('rejects missing contacts array', () => {
    const { contacts: _c, ...withoutContacts } = validNormalizedRecord;
    expect(() => normalizedSourceRecordSchema.parse(withoutContacts)).toThrow();
  });

  it('rejects extra unknown fields (strict mode)', () => {
    expect(() =>
      normalizedSourceRecordSchema.parse({ ...validNormalizedRecord, extraProp: true })
    ).toThrow();
  });

  it('rejects a contact with an invalid email inside the contacts array', () => {
    expect(() =>
      normalizedSourceRecordSchema.parse({
        ...validNormalizedRecord,
        contacts: [{ email: 'bad-email' }],
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// DataSourceAdapter interface — structural shape test
// ---------------------------------------------------------------------------

describe('DataSourceAdapter interface', () => {
  it('accepts an object that satisfies the DataSourceAdapter interface', () => {
    // Type-level test: if this compiles, the interface shape is correct.
    const mockConnection: DataSourceConnection = {
      id: '3931b452-c7d5-43a0-9657-7e7cd1728203',
      providerKey: 'FIXTURE',
      displayName: 'Fixture',
      enabled: true,
      config: {},
      createdBy: null,
      createdAt: '2026-07-03T10:00:00.000Z',
    };

    const adapter: DataSourceAdapter = {
      providerKey: 'FIXTURE',
      fetchCompanies: async (
        _connection: DataSourceConnection
      ): Promise<NormalizedSourceRecord[]> => {
        return [
          {
            sourceRecordId: 'src-001',
            name: 'Test Co',
            contacts: [],
          },
        ];
      },
    };

    // Runtime: verify the adapter is callable and satisfies the contract.
    expect(adapter.providerKey).toBe('FIXTURE');
    // Verify fetchCompanies is present and callable.
    expect(typeof adapter.fetchCompanies).toBe('function');
    return expect(adapter.fetchCompanies(mockConnection)).resolves.toHaveLength(1);
  });

  it('adapter.fetchCompanies returns records that parse against normalizedSourceRecordSchema', async () => {
    const mockConnection: DataSourceConnection = {
      id: '3931b452-c7d5-43a0-9657-7e7cd1728203',
      providerKey: 'FIXTURE',
      displayName: 'Fixture',
      enabled: true,
      config: {},
      createdBy: null,
      createdAt: '2026-07-03T10:00:00.000Z',
    };

    const adapter: DataSourceAdapter = {
      providerKey: 'FIXTURE',
      fetchCompanies: async (_conn) => [validNormalizedRecord],
    };

    const records = await adapter.fetchCompanies(mockConnection);
    expect(records).toHaveLength(1);
    // Each record must parse cleanly — this is the ETL boundary contract.
    for (const record of records) {
      expect(() => normalizedSourceRecordSchema.parse(record)).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// companySchema
// ---------------------------------------------------------------------------

describe('companySchema', () => {
  it('parses a valid active company', () => {
    const result = companySchema.parse(validCompany);
    expect(result.id).toBe(validCompany.id);
    expect(result.status).toBe('active');
    expect(result.updatedAt).toBeNull();
  });

  it('parses a company with all optional fields absent', () => {
    const result = companySchema.parse({
      id: '1931b452-c7d5-43a0-9657-7e7cd1728203',
      name: 'Min Co',
      status: 'active',
      createdAt: '2026-07-03T10:00:00.000Z',
      updatedAt: null,
    });
    expect(result.domain).toBeUndefined();
    expect(result.normalizedDomain).toBeUndefined();
    expect(result.sector).toBeUndefined();
  });

  it('accepts null domain and normalizedDomain', () => {
    const result = companySchema.parse({ ...validCompany, domain: null, normalizedDomain: null });
    expect(result.domain).toBeNull();
    expect(result.normalizedDomain).toBeNull();
  });

  it('rejects non-UUID id', () => {
    expect(() => companySchema.parse({ ...validCompany, id: 'not-a-uuid' })).toThrow();
  });

  it('rejects empty name', () => {
    expect(() => companySchema.parse({ ...validCompany, name: '' })).toThrow();
  });

  it('rejects invalid createdAt', () => {
    expect(() => companySchema.parse({ ...validCompany, createdAt: 'not-a-date' })).toThrow();
  });

  it('rejects extra unknown fields (strict mode)', () => {
    expect(() => companySchema.parse({ ...validCompany, extraField: true })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// contactSchema
// ---------------------------------------------------------------------------

describe('contactSchema', () => {
  it('parses a valid contact', () => {
    const result = contactSchema.parse(validContact);
    expect(result.companyId).toBe(validContact.companyId);
    expect(result.email).toBe('alice@acme.com');
  });

  it('parses a minimal contact (all optional fields absent)', () => {
    const result = contactSchema.parse({
      id: '2931b452-c7d5-43a0-9657-7e7cd1728203',
      companyId: '1931b452-c7d5-43a0-9657-7e7cd1728203',
      createdAt: '2026-07-03T10:00:00.000Z',
      updatedAt: null,
    });
    expect(result.name).toBeUndefined();
    expect(result.email).toBeUndefined();
  });

  it('accepts null name, email, title', () => {
    const result = contactSchema.parse({
      ...validContact,
      name: null,
      email: null,
      title: null,
    });
    expect(result.name).toBeNull();
  });

  it('rejects non-UUID id', () => {
    expect(() => contactSchema.parse({ ...validContact, id: 'bad' })).toThrow();
  });

  it('rejects non-UUID companyId', () => {
    expect(() => contactSchema.parse({ ...validContact, companyId: 'bad' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// dataSourceConnectionSchema
// ---------------------------------------------------------------------------

describe('dataSourceConnectionSchema', () => {
  it('parses a valid connection', () => {
    const result = dataSourceConnectionSchema.parse(validConnection);
    expect(result.providerKey).toBe('FIXTURE_PROVIDER');
    expect(result.enabled).toBe(true);
    expect(result.createdBy).toBeNull();
  });

  it('rejects empty providerKey (must not store a secret name as empty)', () => {
    expect(() =>
      dataSourceConnectionSchema.parse({ ...validConnection, providerKey: '' })
    ).toThrow();
  });

  it('rejects non-UUID id', () => {
    expect(() =>
      dataSourceConnectionSchema.parse({ ...validConnection, id: 'not-a-uuid' })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// companyProvenanceSchema
// ---------------------------------------------------------------------------

describe('companyProvenanceSchema', () => {
  it('parses a valid provenance row', () => {
    const result = companyProvenanceSchema.parse(validCompanyProvenance);
    expect(result.companyId).toBe(validCompanyProvenance.companyId);
    expect(result.connectionId).toBe(validCompanyProvenance.connectionId);
  });

  it('parses a provenance row with null contributedFields', () => {
    const result = companyProvenanceSchema.parse({
      ...validCompanyProvenance,
      contributedFields: null,
    });
    expect(result.contributedFields).toBeNull();
  });

  it('rejects missing companyId (non-null lineage invariant)', () => {
    const { companyId: _c, ...withoutCompanyId } = validCompanyProvenance;
    expect(() => companyProvenanceSchema.parse(withoutCompanyId)).toThrow();
  });

  it('rejects missing rawCompanyId (non-null lineage invariant)', () => {
    const { rawCompanyId: _r, ...withoutRaw } = validCompanyProvenance;
    expect(() => companyProvenanceSchema.parse(withoutRaw)).toThrow();
  });

  it('rejects missing connectionId (non-null lineage invariant)', () => {
    const { connectionId: _c, ...withoutConn } = validCompanyProvenance;
    expect(() => companyProvenanceSchema.parse(withoutConn)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// contactProvenanceSchema
// ---------------------------------------------------------------------------

describe('contactProvenanceSchema', () => {
  it('parses a valid contact provenance row', () => {
    const result = contactProvenanceSchema.parse(validContactProvenance);
    expect(result.contactId).toBe(validContactProvenance.contactId);
    expect(result.rawCompanyId).toBe(validContactProvenance.rawCompanyId);
    expect(result.connectionId).toBe(validContactProvenance.connectionId);
  });

  it('rejects missing contactId (non-null lineage invariant)', () => {
    const { contactId: _c, ...withoutContactId } = validContactProvenance;
    expect(() => contactProvenanceSchema.parse(withoutContactId)).toThrow();
  });

  it('rejects non-UUID contactId', () => {
    expect(() =>
      contactProvenanceSchema.parse({ ...validContactProvenance, contactId: 'not-a-uuid' })
    ).toThrow();
  });

  it('rejects invalid ingestedAt datetime', () => {
    expect(() =>
      contactProvenanceSchema.parse({ ...validContactProvenance, ingestedAt: 'not-a-date' })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// dedupeCandidateSchema
// ---------------------------------------------------------------------------

describe('dedupeCandidateSchema', () => {
  it('parses a valid pending candidate', () => {
    const result = dedupeCandidateSchema.parse(validDedupeCandidate);
    expect(result.status).toBe('pending');
    expect(result.score).toBe(0.85);
    expect(result.resolvedAt).toBeNull();
  });

  it('parses a merged candidate', () => {
    const result = dedupeCandidateSchema.parse({
      ...validDedupeCandidate,
      status: 'merged',
      resolvedBy: '1931b452-c7d5-43a0-9657-7e7cd1728203',
      resolvedAt: '2026-07-03T11:00:00.000Z',
    });
    expect(result.status).toBe('merged');
    expect(result.resolvedAt).toBe('2026-07-03T11:00:00.000Z');
  });

  it('parses a rejected candidate', () => {
    const result = dedupeCandidateSchema.parse({
      ...validDedupeCandidate,
      status: 'rejected',
      resolvedAt: '2026-07-03T11:00:00.000Z',
    });
    expect(result.status).toBe('rejected');
  });

  it('parses a candidate with null matchedCompanyId (no match found)', () => {
    const result = dedupeCandidateSchema.parse({ ...validDedupeCandidate, matchedCompanyId: null });
    expect(result.matchedCompanyId).toBeNull();
  });

  it('parses a candidate with null score (not applicable)', () => {
    const result = dedupeCandidateSchema.parse({ ...validDedupeCandidate, score: null });
    expect(result.score).toBeNull();
  });

  it('rejects score > 1', () => {
    expect(() => dedupeCandidateSchema.parse({ ...validDedupeCandidate, score: 1.1 })).toThrow();
  });

  it('rejects score < 0', () => {
    expect(() => dedupeCandidateSchema.parse({ ...validDedupeCandidate, score: -0.1 })).toThrow();
  });

  it('rejects unknown status value', () => {
    expect(() =>
      dedupeCandidateSchema.parse({ ...validDedupeCandidate, status: 'unknown' })
    ).toThrow();
  });

  it('rejects extra unknown fields (strict mode)', () => {
    expect(() =>
      dedupeCandidateSchema.parse({ ...validDedupeCandidate, extraField: true })
    ).toThrow();
  });
});

describe('dedupeCandidateStatusEnum', () => {
  it('accepts all three status values', () => {
    expect(dedupeCandidateStatusEnum.parse('pending')).toBe('pending');
    expect(dedupeCandidateStatusEnum.parse('merged')).toBe('merged');
    expect(dedupeCandidateStatusEnum.parse('rejected')).toBe('rejected');
  });

  it('rejects unknown status values', () => {
    expect(() => dedupeCandidateStatusEnum.parse('unknown')).toThrow();
    expect(() => dedupeCandidateStatusEnum.parse('')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// syncSummarySchema
// ---------------------------------------------------------------------------

describe('syncSummarySchema', () => {
  it('parses a valid sync summary', () => {
    const result = syncSummarySchema.parse({ ingested: 10, updated: 3 });
    expect(result.ingested).toBe(10);
    expect(result.updated).toBe(3);
  });

  it('parses a zero-result sync (empty source)', () => {
    const result = syncSummarySchema.parse({ ingested: 0, updated: 0 });
    expect(result.ingested).toBe(0);
    expect(result.updated).toBe(0);
  });

  it('rejects negative ingested', () => {
    expect(() => syncSummarySchema.parse({ ingested: -1, updated: 0 })).toThrow();
  });

  it('rejects negative updated', () => {
    expect(() => syncSummarySchema.parse({ ingested: 0, updated: -1 })).toThrow();
  });

  it('rejects non-integer ingested', () => {
    expect(() => syncSummarySchema.parse({ ingested: 1.5, updated: 0 })).toThrow();
  });

  it('rejects missing ingested', () => {
    expect(() => syncSummarySchema.parse({ updated: 0 })).toThrow();
  });

  it('rejects missing updated', () => {
    expect(() => syncSummarySchema.parse({ ingested: 0 })).toThrow();
  });

  it('rejects extra unknown fields (strict mode)', () => {
    expect(() => syncSummarySchema.parse({ ingested: 0, updated: 0, extra: true })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// dedupeResolveInputSchema
// ---------------------------------------------------------------------------

describe('dedupeResolveInputSchema', () => {
  it('parses action: merge', () => {
    const result = dedupeResolveInputSchema.parse({ action: 'merge' });
    expect(result.action).toBe('merge');
  });

  it('parses action: reject', () => {
    const result = dedupeResolveInputSchema.parse({ action: 'reject' });
    expect(result.action).toBe('reject');
  });

  it('rejects unknown action', () => {
    expect(() => dedupeResolveInputSchema.parse({ action: 'auto-merge' })).toThrow();
    expect(() => dedupeResolveInputSchema.parse({ action: '' })).toThrow();
    expect(() => dedupeResolveInputSchema.parse({ action: 42 })).toThrow();
  });

  it('rejects missing action', () => {
    expect(() => dedupeResolveInputSchema.parse({})).toThrow();
  });

  it('rejects extra unknown fields (strict mode)', () => {
    expect(() => dedupeResolveInputSchema.parse({ action: 'merge', extra: true })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// connectionCreateSchema (wave-7 AC-SEED)
// ---------------------------------------------------------------------------

describe('connectionCreateSchema', () => {
  it('parses a full input with all fields', () => {
    const result = connectionCreateSchema.parse({
      providerKey: 'fixture',
      displayName: 'Internal Fixture',
      config: { field_map: {} },
    });
    expect(result.providerKey).toBe('fixture');
    expect(result.displayName).toBe('Internal Fixture');
    expect(result.config).toEqual({ field_map: {} });
  });

  it('defaults config to {} when absent (field is optional)', () => {
    const result = connectionCreateSchema.parse({
      providerKey: 'grata',
      displayName: 'Grata',
    });
    expect(result.config).toEqual({});
  });

  it('parses config as an arbitrary record', () => {
    const result = connectionCreateSchema.parse({
      providerKey: 'custom',
      displayName: 'Custom',
      config: { nested: { key: 'value' }, count: 5 },
    });
    expect(result.config).toMatchObject({ nested: { key: 'value' }, count: 5 });
  });

  it('rejects empty providerKey (credential name must be non-empty)', () => {
    expect(() => connectionCreateSchema.parse({ providerKey: '', displayName: 'Test' })).toThrow();
  });

  it('rejects missing providerKey', () => {
    expect(() => connectionCreateSchema.parse({ displayName: 'Test' })).toThrow();
  });

  it('rejects empty displayName', () => {
    expect(() =>
      connectionCreateSchema.parse({ providerKey: 'fixture', displayName: '' })
    ).toThrow();
  });

  it('rejects missing displayName', () => {
    expect(() => connectionCreateSchema.parse({ providerKey: 'fixture' })).toThrow();
  });

  it('rejects extra unknown fields (strict mode)', () => {
    expect(() =>
      connectionCreateSchema.parse({
        providerKey: 'fixture',
        displayName: 'Test',
        secretValue: 'oops',
      })
    ).toThrow();
  });

  it('rejects config that is not a record (array)', () => {
    expect(() =>
      connectionCreateSchema.parse({
        providerKey: 'fixture',
        displayName: 'Test',
        config: [1, 2, 3],
      })
    ).toThrow();
  });

  it('rejects config that is not a record (string)', () => {
    expect(() =>
      connectionCreateSchema.parse({
        providerKey: 'fixture',
        displayName: 'Test',
        config: 'not-an-object',
      })
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// companiesListFilterSchema
// ---------------------------------------------------------------------------

describe('companiesListFilterSchema', () => {
  it('parses an empty filter (all fields optional)', () => {
    const result = companiesListFilterSchema.parse({});
    expect(result.q).toBeUndefined();
    expect(result.source).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('parses a query-only filter', () => {
    const result = companiesListFilterSchema.parse({ q: 'acme' });
    expect(result.q).toBe('acme');
  });

  it('parses a source filter (valid UUID)', () => {
    const result = companiesListFilterSchema.parse({
      source: '3931b452-c7d5-43a0-9657-7e7cd1728203',
    });
    expect(result.source).toBe('3931b452-c7d5-43a0-9657-7e7cd1728203');
  });

  it('parses status: active', () => {
    const result = companiesListFilterSchema.parse({ status: 'active' });
    expect(result.status).toBe('active');
  });

  it('parses status: archived', () => {
    const result = companiesListFilterSchema.parse({ status: 'archived' });
    expect(result.status).toBe('archived');
  });

  it('parses all three filters together', () => {
    const result = companiesListFilterSchema.parse({
      q: 'acme',
      source: '3931b452-c7d5-43a0-9657-7e7cd1728203',
      status: 'active',
    });
    expect(result.q).toBe('acme');
    expect(result.status).toBe('active');
  });

  it('rejects a non-UUID source value', () => {
    expect(() => companiesListFilterSchema.parse({ source: 'not-a-uuid' })).toThrow();
  });

  it('rejects an unknown status value', () => {
    expect(() => companiesListFilterSchema.parse({ status: 'unknown' })).toThrow();
  });

  it('rejects extra unknown fields (strict mode)', () => {
    expect(() => companiesListFilterSchema.parse({ q: 'x', page: 1 })).toThrow();
  });
});
