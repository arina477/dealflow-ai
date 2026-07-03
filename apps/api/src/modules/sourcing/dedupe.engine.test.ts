/**
 * DedupeEngine unit tests — the load-bearing proof.
 *
 * These tests PROVE the dedupe correctness; they do NOT stub away the dedupe
 * logic. The DB/transaction layer is mocked at the Drizzle tx boundary so the
 * full normalize → match → merge → provenance logic executes against
 * in-memory state, which is asserted at the end of each test.
 *
 * Test cases (all required by spec + P-4 remediation):
 *
 *   (a) CROSS-SOURCE: same normalized domain from 2 connections →
 *       1 canonical company + 2 company_provenance rows.
 *
 *   (b) IDEMPOTENT: re-running promoteStaging over already-promoted staging →
 *       no new canonical company, no new provenance rows.
 *
 *   (c) AMBIGUOUS: partial name-token overlap below auto-merge threshold →
 *       dedupe_candidate (pending), NOT auto-merged into canonical.
 *
 *   (d) NEW COMPANY: raw record matching nothing →
 *       new canonical company + company_provenance written.
 *
 *   (e) CONTACT MERGE: two raw records share same normalized email →
 *       one canonical contact (not two); both contact_provenance rows written.
 *
 *   (f) CONTACT PROVENANCE (principle-3 lineage): any contact promotion →
 *       contact_provenance row written (non-null lineage present).
 *
 * Plus normalization unit tests for normalizeDomain / normalizeName / normalizeEmail
 * and the isAmbiguousNameMatch heuristic.
 *
 * Mock strategy:
 *   We mock the Drizzle tx object by building an in-memory store and wiring
 *   tx.select/insert/update to operate on it. This means the full DedupeEngine
 *   code path (normalize → find → insert/update → provenance) runs real logic;
 *   only the SQL wire (network + DB) is replaced. The assertions are on the
 *   in-memory store state after the engine runs.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import {
  DedupeEngine,
  isAmbiguousNameMatch,
  normalizeDomain,
  normalizeEmail,
  normalizeName,
  type Tx,
} from './dedupe.engine';

// ---------------------------------------------------------------------------
// Normalization unit tests (pure functions)
// ---------------------------------------------------------------------------

describe('normalizeDomain', () => {
  it('strips protocol and www', () => {
    expect(normalizeDomain('https://www.acme.com/about')).toBe('acme.com');
  });

  it('strips http protocol', () => {
    expect(normalizeDomain('http://acme.com')).toBe('acme.com');
  });

  it('strips www without protocol', () => {
    expect(normalizeDomain('www.acme.com')).toBe('acme.com');
  });

  it('lowercases', () => {
    expect(normalizeDomain('ACME.COM')).toBe('acme.com');
  });

  it('strips path', () => {
    expect(normalizeDomain('acme.com/products/foo?bar=1#baz')).toBe('acme.com');
  });

  it('returns null for empty/null', () => {
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain('')).toBeNull();
    expect(normalizeDomain('   ')).toBeNull();
  });

  it('preserves subdomain (not www)', () => {
    expect(normalizeDomain('https://app.acme.com')).toBe('app.acme.com');
  });
});

describe('normalizeName', () => {
  it('strips "Inc" suffix', () => {
    expect(normalizeName('Acme Inc')).toBe('acme');
  });

  it('strips "LLC" suffix', () => {
    expect(normalizeName('Widgets LLC')).toBe('widgets');
  });

  it('strips "Corp." with punctuation', () => {
    expect(normalizeName('BigCo Corp.')).toBe('bigco');
  });

  it('lowercases and trims', () => {
    expect(normalizeName('  Acme  ')).toBe('acme');
  });

  it('collapses whitespace', () => {
    expect(normalizeName('Green   Energy')).toBe('green energy');
  });

  it('strips punctuation', () => {
    // "O'Brien & Sons" → punctuation replaced with spaces → "o brien   sons"
    // → whitespace collapsed → "o brien sons"
    // (The apostrophe in O'Brien becomes a space separator, not a join.)
    expect(normalizeName("O'Brien & Sons")).toBe('o brien sons');
  });

  it('returns null for empty/null', () => {
    expect(normalizeName(null)).toBeNull();
    expect(normalizeName('')).toBeNull();
    expect(normalizeName('Inc')).toBeNull(); // strips to empty
  });

  it('strips multiple suffixes', () => {
    expect(normalizeName('Acme Corp, Inc.')).toBe('acme');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Alice@ACME.com  ')).toBe('alice@acme.com');
  });

  it('returns null for empty/null', () => {
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail('')).toBeNull();
  });
});

describe('isAmbiguousNameMatch', () => {
  it('returns false for exact match', () => {
    expect(isAmbiguousNameMatch('acme', 'acme')).toBe(false);
  });

  it('returns true when shorter name tokens subset of longer', () => {
    // "acme" tokens ⊂ "acme holdings" tokens → ambiguous
    expect(isAmbiguousNameMatch('acme', 'acme holdings')).toBe(true);
  });

  it('returns false when tokens do not overlap', () => {
    expect(isAmbiguousNameMatch('acme', 'beta corp')).toBe(false);
  });

  it('returns false for single-token names with no overlap', () => {
    expect(isAmbiguousNameMatch('acme', 'widget')).toBe(false);
  });

  it('is symmetric', () => {
    const a = isAmbiguousNameMatch('acme', 'acme holdings');
    const b = isAmbiguousNameMatch('acme holdings', 'acme');
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// In-memory mock transaction factory
// ---------------------------------------------------------------------------

/**
 * InMemoryStore — the in-memory DB state for engine tests.
 * We populate initial state (existing canonical + raw rows) before the engine
 * runs, then assert on post-run state.
 */
interface InMemoryStore {
  rawCompanies: Array<Record<string, unknown>>;
  companies: Array<Record<string, unknown>>;
  contacts: Array<Record<string, unknown>>;
  companyProvenance: Array<Record<string, unknown>>;
  contactProvenance: Array<Record<string, unknown>>;
  dedupeCandidates: Array<Record<string, unknown>>;
}

let _idCounter = 0;
function nextId(): string {
  _idCounter++;
  return `00000000-0000-0000-0000-${String(_idCounter).padStart(12, '0')}`;
}

/**
 * buildMockTx — creates a Drizzle-shaped tx mock that operates on the supplied
 * InMemoryStore. The mock implements the subset of the Drizzle query API that
 * DedupeEngine actually calls:
 *   tx.select().from(table).where(...).limit(n)
 *   tx.insert(table).values(v).returning(...)
 *   tx.insert(table).values(v).onConflictDoNothing()
 *   tx.insert(table).values(v).onConflictDoNothing().returning(...)
 *   tx.update(table).set(v).where(...)
 *
 * The mock resolves table identity by a name tag attached to the schema export.
 * We read the Drizzle table symbol name (which is the JS variable name) from the
 * schema import.
 */

// We need to reference the actual schema table objects so the engine's
// comparisons (which use the same table objects) resolve correctly.
// Import them the same way the engine does.
import {
  companies as companiesTable,
  companyProvenance as companyProvenanceTable,
  contactProvenance as contactProvenanceTable,
  contacts as contactsTable,
  dedupeCandidates as dedupeCandidatesTable,
  rawCompanies as rawCompaniesTable,
} from '../../db/schema/sourcing';

/**
 * tableKey — extracts a stable string key from a Drizzle table object.
 * Drizzle tables have a Symbol.for('drizzle:Name') property.
 */
function tableKey(table: unknown): string {
  const sym = Symbol.for('drizzle:Name');
  const t = table as Record<symbol, string>;
  return t[sym] ?? String(table);
}

// Map Drizzle table keys to InMemoryStore field names
const TABLE_MAP: Record<string, keyof InMemoryStore> = {
  raw_companies: 'rawCompanies',
  companies: 'companies',
  contacts: 'contacts',
  company_provenance: 'companyProvenance',
  contact_provenance: 'contactProvenance',
  dedupe_candidates: 'dedupeCandidates',
};

function getStoreKey(table: unknown): keyof InMemoryStore {
  const key = tableKey(table);
  const storeKey = TABLE_MAP[key];
  if (!storeKey) throw new Error(`buildMockTx: unknown table key "${key}"`);
  return storeKey;
}

/**
 * A tiny predicate evaluator for Drizzle eq() / and() / isNotNull() conditions.
 * We serialize the condition to a test-time predicate function.
 */
function buildPredicate(condition: unknown): (row: Record<string, unknown>) => boolean {
  if (!condition) return () => true;

  // Drizzle conditions are objects with internal structure.
  // We inspect by duck-typing the known Drizzle internals.
  const c = condition as Record<string, unknown>;

  // eq() — SQLWrapper with config {left, right, operator: '='}
  if (c['queryChunks'] || (c['left'] && c['operator'])) {
    // Drizzle eq() / and() / isNotNull() all produce SQLWrapper instances.
    // We convert to string and parse the condition.
    const str = String(condition);
    // Fall back to full-scan (always true) for complex conditions in tests.
    // The test fixtures are small enough that false positives are caught by assertion.
    return () => true;
  }

  return () => true;
}

/**
 * extractEqFilter — extracts column=value equality filters from a Drizzle
 * condition object by walking its queryChunks tree.
 *
 * Drizzle SQLWrapper objects carry a queryChunks array. Each chunk is either:
 *   - { value: string[] }                   — a SQL literal fragment
 *   - { name: string, table: {...} }         — a column reference
 *   - another SQLWrapper with queryChunks    — a nested expression
 *   - a raw value (string, number, etc.)    — a bound parameter
 *
 * eq(col, val) produces:
 *   chunks: [ {value:['']}, ColumnRef{name:'col'}, {value:[' = ']}, rawVal, {value:['']} ]
 *
 * and(a, b) produces:
 *   chunks: [ {value:['(']}, exprA, {value:[' and ']}, exprB, {value:[')']} ]
 *   where exprA/B are the wrapped eq() objects.
 */
function extractEqFilter(condition: unknown): Array<{ column: string; value: unknown }> {
  if (!condition) return [];
  const filters: Array<{ column: string; value: unknown }> = [];

  function walk(chunks: unknown[]): void {
    // Look for the pattern: column-ref chunk followed by { value: [' = '] } followed by a value
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i] as Record<string, unknown>;

      // Column reference: has { name: string }
      if (typeof chunk['name'] === 'string' && i + 2 < chunks.length) {
        const opChunk = chunks[i + 1] as Record<string, unknown>;
        if (Array.isArray(opChunk['value']) && String(opChunk['value'][0]).trim() === '=') {
          const valChunk = chunks[i + 2];
          // valChunk is the raw value (string, number) or a wrapped param
          if (typeof valChunk === 'string' || typeof valChunk === 'number') {
            filters.push({ column: chunk['name'] as string, value: valChunk });
          } else if (valChunk && typeof valChunk === 'object') {
            // Drizzle may wrap the value — recurse to find the actual value string
            const vc = valChunk as Record<string, unknown>;
            if (vc['value'] !== undefined && typeof vc['value'] !== 'object') {
              filters.push({ column: chunk['name'] as string, value: vc['value'] });
            }
          }
        }
      }

      // Nested SQLWrapper with queryChunks — recurse
      if (chunk['queryChunks'] && Array.isArray(chunk['queryChunks'])) {
        walk(chunk['queryChunks'] as unknown[]);
      }
    }
  }

  const cond = condition as Record<string, unknown>;
  if (cond['queryChunks'] && Array.isArray(cond['queryChunks'])) {
    walk(cond['queryChunks'] as unknown[]);
  }

  return filters;
}

/**
 * extractIsNotNullCols — extracts column names from isNotNull() Drizzle conditions.
 *
 * isNotNull(col) produces queryChunks:
 *   [ {value:['']}, ColumnRef{name:'col'}, {value:[' is not null']} ]
 *
 * We walk the queryChunks tree looking for a ColumnRef followed by
 * { value: [' is not null'] }.
 */
function extractIsNotNullCols(condition: unknown): string[] {
  if (!condition) return [];
  const cols: string[] = [];

  function walk(chunks: unknown[]): void {
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i] as Record<string, unknown>;
      // ColumnRef: has { name: string }
      if (typeof chunk['name'] === 'string' && i + 1 < chunks.length) {
        const next = chunks[i + 1] as Record<string, unknown>;
        if (
          Array.isArray(next['value']) &&
          String(next['value'][0]).trim().toLowerCase() === 'is not null'
        ) {
          cols.push(chunk['name'] as string);
        }
      }
      // Recurse into nested queryChunks
      if (chunk['queryChunks'] && Array.isArray(chunk['queryChunks'])) {
        walk(chunk['queryChunks'] as unknown[]);
      }
    }
  }

  const cond = condition as Record<string, unknown>;
  if (cond['queryChunks'] && Array.isArray(cond['queryChunks'])) {
    walk(cond['queryChunks'] as unknown[]);
  }
  return cols;
}

function applyFilters(
  rows: Array<Record<string, unknown>>,
  condition: unknown,
  limit?: number
): Array<Record<string, unknown>> {
  const filters = extractEqFilter(condition);
  const isNotNullCols = extractIsNotNullCols(condition);

  let result = rows.filter((row) => {
    for (const { column, value } of filters) {
      // Map snake_case column names to camelCase store keys (our store uses camelCase)
      const camel = column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      const rowVal = row[column] !== undefined ? row[column] : row[camel];
      if (rowVal !== value) return false;
    }
    for (const col of isNotNullCols) {
      const camel = col.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
      const rowVal = row[col] !== undefined ? row[col] : row[camel];
      if (rowVal === null || rowVal === undefined) return false;
    }
    return true;
  });

  if (limit !== undefined) result = result.slice(0, limit);
  return result;
}

/**
 * buildMockTx — creates a minimal Drizzle-compatible mock tx operating on the
 * in-memory store. Sufficient for DedupeEngine's actual query patterns.
 */
function buildMockTx(store: InMemoryStore): Tx {
  // We build a chainable mock using a builder pattern.
  // Each query step returns an object with the next step available.

  // Helper: execute an insert and return the result rows (or [] on conflict).
  function execInsert(
    storeKey: keyof InMemoryStore,
    values: Record<string, unknown>,
    onConflictDoNothing: boolean
  ): Array<Record<string, unknown>> {
    const rows = store[storeKey] as Array<Record<string, unknown>>;
    if (onConflictDoNothing) {
      let conflict = false;
      if (storeKey === 'companies' && values['normalizedDomain']) {
        conflict = rows.some((r) => r['normalizedDomain'] === values['normalizedDomain']);
      }
      if (storeKey === 'rawCompanies') {
        conflict = rows.some(
          (r) =>
            r['connectionId'] === values['connectionId'] &&
            r['sourceRecordId'] === values['sourceRecordId']
        );
      }
      if (storeKey === 'companyProvenance') {
        conflict = rows.some(
          (r) =>
            r['companyId'] === values['companyId'] && r['rawCompanyId'] === values['rawCompanyId']
        );
      }
      if (storeKey === 'contactProvenance') {
        conflict = rows.some(
          (r) =>
            r['contactId'] === values['contactId'] && r['rawCompanyId'] === values['rawCompanyId']
        );
      }
      if (conflict) return [];
    }
    rows.push(values);
    return [values];
  }

  const tx = {
    select: (_cols?: unknown) => {
      return {
        from: (table: unknown) => {
          const storeKey = getStoreKey(table);
          let _where: unknown = null;

          // Build the query result lazily
          const resolve = () =>
            applyFilters(store[storeKey] as Array<Record<string, unknown>>, _where);

          // Return an actual Promise so `await tx.select().from(table)` works,
          // but also attach `.where()` and `.limit()` for chaining.
          // We attach methods to the Promise object itself (they're non-enumerable).
          const basePromise = Promise.resolve().then(resolve);

          const withWhere = Object.assign(basePromise, {
            where(condition: unknown) {
              _where = condition;
              const p = Promise.resolve().then(resolve);
              return Object.assign(p, {
                limit(n: number) {
                  return Promise.resolve().then(() =>
                    applyFilters(store[storeKey] as Array<Record<string, unknown>>, _where, n)
                  );
                },
              });
            },
          });

          return withWhere;
        },
      };
    },

    insert: (table: unknown) => {
      const storeKey = getStoreKey(table);
      let _values: Record<string, unknown> = {};
      let _onConflict = false;

      const chain = {
        values(v: Record<string, unknown>) {
          _values = { id: nextId(), ...v };
          return chain;
        },
        onConflictDoNothing() {
          _onConflict = true;
          // Return a Promise (awaitable for the no-.returning() case)
          // with a .returning() method attached.
          const p = Promise.resolve().then(() => execInsert(storeKey, _values, _onConflict));
          return Object.assign(p, {
            returning(_cols?: unknown) {
              return Promise.resolve().then(() => execInsert(storeKey, _values, _onConflict));
            },
          });
        },
        returning(_cols?: unknown) {
          return Promise.resolve().then(() => execInsert(storeKey, _values, _onConflict));
        },
      };
      return chain;
    },

    update: (table: unknown) => {
      const storeKey = getStoreKey(table);
      let _set: Record<string, unknown> = {};

      const chain = {
        set: (updates: Record<string, unknown>) => {
          _set = updates;
          return chain;
        },
        where: (condition: unknown) => {
          return Promise.resolve().then(() => {
            const rows = store[storeKey] as Array<Record<string, unknown>>;
            const filters = extractEqFilter(condition);
            for (const row of rows) {
              let match = true;
              for (const { column, value } of filters) {
                const camel = column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
                if ((row[column] ?? row[camel]) !== value) {
                  match = false;
                  break;
                }
              }
              if (match) Object.assign(row, _set);
            }
            return rows;
          });
        },
      };
      return chain;
    },
  };

  return tx as unknown as Tx;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Factory: a raw_companies row with sensible defaults. */
function makeRaw(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: nextId(),
    connectionId: 'conn-1',
    sourceRecordId: `src-${nextId()}`,
    name: 'Acme Corp',
    domain: 'acme.com',
    normalizedDomain: 'acme.com',
    raw: { contacts: [{ name: 'Alice', email: 'alice@acme.com', title: 'CEO' }] },
    ingestedAt: '2026-07-03T10:00:00.000Z',
    ...overrides,
  };
}

/** Factory: a canonical companies row. */
function makeCanonical(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: nextId(),
    name: 'Acme Corp',
    domain: 'acme.com',
    normalizedDomain: 'acme.com',
    normalizedName: 'acme',
    sector: null,
    status: 'active',
    createdAt: '2026-07-03T10:00:00.000Z',
    updatedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// (a) CROSS-SOURCE: same normalized_domain from 2 connections → 1 canonical + 2 provenance
// ---------------------------------------------------------------------------

describe('(a) cross-source dedup — same domain, 2 connections → 1 canonical + 2 company_provenance', () => {
  it('produces exactly 1 canonical company and 2 provenance rows', async () => {
    // Reset id counter for determinism
    _idCounter = 0;

    const store: InMemoryStore = {
      rawCompanies: [
        makeRaw({
          id: 'raw-1',
          connectionId: 'conn-1',
          sourceRecordId: 'grata-001',
          domain: 'acme.com',
          normalizedDomain: 'acme.com',
        }),
        makeRaw({
          id: 'raw-2',
          connectionId: 'conn-2',
          sourceRecordId: 'cyndx-001',
          domain: 'www.acme.com',
          normalizedDomain: 'acme.com',
        }),
      ],
      companies: [],
      contacts: [],
      companyProvenance: [],
      contactProvenance: [],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();
    const tx = buildMockTx(store);
    const result = await engine.promoteStaging(tx);

    // Exactly 1 canonical company created
    expect(store.companies).toHaveLength(1);
    expect(store.companies[0]['normalizedDomain']).toBe('acme.com');

    // Exactly 2 company_provenance rows (one per raw row, both pointing to the SAME canonical)
    expect(store.companyProvenance).toHaveLength(2);
    const canonicalId = store.companies[0]['id'];
    expect(store.companyProvenance[0]['companyId']).toBe(canonicalId);
    expect(store.companyProvenance[1]['companyId']).toBe(canonicalId);

    // The two provenance rows reference different raw rows (different connections)
    const rawIds = store.companyProvenance.map((p) => p['rawCompanyId']);
    expect(rawIds).toContain('raw-1');
    expect(rawIds).toContain('raw-2');

    // Result: 1 promoted, 1 merged
    expect(result.promoted).toBe(1);
    expect(result.merged).toBe(1);
    expect(result.candidates).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (b) IDEMPOTENT: re-running promoteStaging → no new canonical/provenance
// ---------------------------------------------------------------------------

describe('(b) idempotent re-run — no new canonical or provenance rows on second pass', () => {
  it('produces identical store state on second call', async () => {
    _idCounter = 100;

    const rawRow = makeRaw({
      id: 'raw-10',
      connectionId: 'conn-1',
      sourceRecordId: 'src-10',
      domain: 'beta.io',
      normalizedDomain: 'beta.io',
    });
    const store: InMemoryStore = {
      rawCompanies: [rawRow],
      companies: [],
      contacts: [],
      companyProvenance: [],
      contactProvenance: [],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();

    // First run
    const tx1 = buildMockTx(store);
    await engine.promoteStaging(tx1);

    const companiesAfterRun1 = store.companies.length;
    const provenanceAfterRun1 = store.companyProvenance.length;
    const contactsAfterRun1 = store.contacts.length;
    const contactProvenanceAfterRun1 = store.contactProvenance.length;

    expect(companiesAfterRun1).toBe(1);
    expect(provenanceAfterRun1).toBe(1);

    // Second run on the same store (same raw, now promoted)
    const tx2 = buildMockTx(store);
    await engine.promoteStaging(tx2);

    // State must be IDENTICAL — no new rows
    expect(store.companies).toHaveLength(companiesAfterRun1);
    expect(store.companyProvenance).toHaveLength(provenanceAfterRun1);
    expect(store.contacts).toHaveLength(contactsAfterRun1);
    expect(store.contactProvenance).toHaveLength(contactProvenanceAfterRun1);
  });
});

// ---------------------------------------------------------------------------
// (c) AMBIGUOUS: partial name-token overlap → dedupe_candidate (pending)
// ---------------------------------------------------------------------------

describe('(c) ambiguous match → dedupe_candidate pending, NOT auto-merged', () => {
  it('writes a pending candidate and does not auto-merge', async () => {
    _idCounter = 200;

    // Existing canonical: "acme" (normalizedName)
    const existingCanonical = makeCanonical({
      id: 'canon-acme',
      normalizedDomain: null, // no domain
      normalizedName: 'acme',
      domain: null,
    });

    // Raw: "Acme Holdings" — tokens "acme" ⊂ "acme holdings" → ambiguous
    const rawRow = makeRaw({
      id: 'raw-20',
      connectionId: 'conn-1',
      sourceRecordId: 'src-20',
      name: 'Acme Holdings',
      domain: null,
      normalizedDomain: null,
    });

    const store: InMemoryStore = {
      rawCompanies: [rawRow],
      companies: [existingCanonical],
      contacts: [],
      companyProvenance: [],
      contactProvenance: [],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();
    const tx = buildMockTx(store);
    const result = await engine.promoteStaging(tx);

    // A dedupe_candidate must be written
    expect(store.dedupeCandidates).toHaveLength(1);
    expect(store.dedupeCandidates[0]['status']).toBe('pending');
    expect(store.dedupeCandidates[0]['rawCompanyId']).toBe('raw-20');
    expect(store.dedupeCandidates[0]['matchedCompanyId']).toBe('canon-acme');

    // Canonical universe must be UNCHANGED — no new canonical company
    expect(store.companies).toHaveLength(1);
    expect(store.companyProvenance).toHaveLength(0);

    expect(result.candidates).toBe(1);
    expect(result.promoted).toBe(0);
    expect(result.merged).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (d) NEW COMPANY: no match → new canonical + provenance
// ---------------------------------------------------------------------------

describe('(d) new company — no existing canonical match → new canonical + company_provenance', () => {
  it('creates a canonical company and a provenance row', async () => {
    _idCounter = 300;

    const rawRow = makeRaw({
      id: 'raw-30',
      connectionId: 'conn-1',
      sourceRecordId: 'src-30',
      name: 'Gamma Ventures',
      domain: 'gamma.vc',
      normalizedDomain: 'gamma.vc',
    });

    const store: InMemoryStore = {
      rawCompanies: [rawRow],
      companies: [], // empty canonical universe
      contacts: [],
      companyProvenance: [],
      contactProvenance: [],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();
    const tx = buildMockTx(store);
    const result = await engine.promoteStaging(tx);

    expect(store.companies).toHaveLength(1);
    expect(store.companies[0]['normalizedDomain']).toBe('gamma.vc');
    expect(store.companies[0]['name']).toBe('Gamma Ventures');

    expect(store.companyProvenance).toHaveLength(1);
    expect(store.companyProvenance[0]['rawCompanyId']).toBe('raw-30');
    expect(store.companyProvenance[0]['connectionId']).toBe('conn-1');

    expect(result.promoted).toBe(1);
    expect(result.merged).toBe(0);
    expect(result.candidates).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// (e) CONTACT MERGE: two raw records share same normalized email → 1 canonical contact
// ---------------------------------------------------------------------------

describe('(e) contact merge — same normalized email from 2 raw records → 1 canonical contact', () => {
  it('produces 1 canonical contact with 2 contact_provenance rows', async () => {
    _idCounter = 400;

    // Two raw rows from different connections, same company domain,
    // each with alice@acme.com as a contact
    const raw1 = makeRaw({
      id: 'raw-40',
      connectionId: 'conn-1',
      sourceRecordId: 'src-40',
      domain: 'acme.com',
      normalizedDomain: 'acme.com',
      raw: { contacts: [{ name: 'Alice Smith', email: 'alice@acme.com', title: 'CEO' }] },
    });
    const raw2 = makeRaw({
      id: 'raw-41',
      connectionId: 'conn-2',
      sourceRecordId: 'src-41',
      domain: 'www.acme.com',
      normalizedDomain: 'acme.com',
      raw: { contacts: [{ name: 'Alice', email: 'Alice@ACME.COM', title: 'Chief Executive' }] },
    });

    const store: InMemoryStore = {
      rawCompanies: [raw1, raw2],
      companies: [],
      contacts: [],
      companyProvenance: [],
      contactProvenance: [],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();
    const tx = buildMockTx(store);
    await engine.promoteStaging(tx);

    // 1 canonical company
    expect(store.companies).toHaveLength(1);

    // 1 canonical contact (alice@acme.com deduped across 2 raw rows)
    expect(store.contacts).toHaveLength(1);
    expect(store.contacts[0]['normalizedEmail']).toBe('alice@acme.com');

    // 2 contact_provenance rows (one per raw row, both pointing to the same contact)
    expect(store.contactProvenance).toHaveLength(2);
    const contactId = store.contacts[0]['id'];
    expect(store.contactProvenance[0]['contactId']).toBe(contactId);
    expect(store.contactProvenance[1]['contactId']).toBe(contactId);
    expect(store.contactProvenance[0]['rawCompanyId']).not.toBe(
      store.contactProvenance[1]['rawCompanyId']
    );
  });
});

// ---------------------------------------------------------------------------
// (f) CONTACT PROVENANCE: principle-3 lineage written for every contact
// ---------------------------------------------------------------------------

describe('(f) contact_provenance — principle-3 lineage written on every contact promotion', () => {
  it('writes contact_provenance rows with non-null lineage columns', async () => {
    _idCounter = 500;

    const rawRow = makeRaw({
      id: 'raw-50',
      connectionId: 'conn-1',
      sourceRecordId: 'src-50',
      domain: 'delta.io',
      normalizedDomain: 'delta.io',
      raw: {
        contacts: [
          { name: 'Bob', email: 'bob@delta.io', title: 'CTO' },
          { name: 'Carol', email: 'carol@delta.io', title: 'CFO' },
        ],
      },
    });

    const store: InMemoryStore = {
      rawCompanies: [rawRow],
      companies: [],
      contacts: [],
      companyProvenance: [],
      contactProvenance: [],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();
    const tx = buildMockTx(store);
    await engine.promoteStaging(tx);

    // Both contacts promoted
    expect(store.contacts).toHaveLength(2);

    // contact_provenance written for each contact
    expect(store.contactProvenance).toHaveLength(2);

    // Non-null lineage invariant (principle-3)
    for (const cp of store.contactProvenance) {
      expect(cp['contactId']).toBeTruthy();
      expect(cp['rawCompanyId']).toBe('raw-50');
      expect(cp['connectionId']).toBe('conn-1');
    }
  });

  it('writes contact_provenance for a merged contact (existing canonical)', async () => {
    _idCounter = 600;

    // Existing canonical company and contact
    const canonId = 'canon-epsilon';
    const existingContact = {
      id: 'contact-epsilon',
      companyId: canonId,
      name: 'Eve',
      email: 'eve@epsilon.com',
      normalizedEmail: 'eve@epsilon.com',
      title: 'COO',
      createdAt: '2026-07-03T10:00:00.000Z',
      updatedAt: null,
    };

    const existingCanonical = makeCanonical({
      id: canonId,
      normalizedDomain: 'epsilon.com',
      domain: 'epsilon.com',
      normalizedName: 'epsilon',
      name: 'Epsilon',
    });

    // New raw row from conn-2 with same domain (cross-source) and same contact email
    const rawRow = makeRaw({
      id: 'raw-60',
      connectionId: 'conn-2',
      sourceRecordId: 'src-60',
      domain: 'epsilon.com',
      normalizedDomain: 'epsilon.com',
      raw: {
        contacts: [{ name: 'Eve', email: 'EVE@EPSILON.COM', title: 'Chief Operating Officer' }],
      },
    });

    // Existing company_provenance from conn-1's prior raw row
    const existingProvenance = {
      id: 'prov-1',
      companyId: canonId,
      rawCompanyId: 'raw-conn1',
      connectionId: 'conn-1',
      contributedFields: null,
      ingestedAt: '2026-07-03T10:00:00.000Z',
    };
    // Existing contact_provenance
    const existingContactProvenance = {
      id: 'cprov-1',
      contactId: 'contact-epsilon',
      rawCompanyId: 'raw-conn1',
      connectionId: 'conn-1',
      ingestedAt: '2026-07-03T10:00:00.000Z',
    };

    const store: InMemoryStore = {
      rawCompanies: [rawRow],
      companies: [existingCanonical],
      contacts: [existingContact],
      companyProvenance: [existingProvenance],
      contactProvenance: [existingContactProvenance],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();
    const tx = buildMockTx(store);
    await engine.promoteStaging(tx);

    // Still only 1 canonical company (merged)
    expect(store.companies).toHaveLength(1);

    // Still only 1 contact (merged by email)
    expect(store.contacts).toHaveLength(1);

    // NEW contact_provenance row added for the merged contact from raw-60
    // (old one from raw-conn1 preserved + new one from raw-60)
    const newCp = store.contactProvenance.find((cp) => cp['rawCompanyId'] === 'raw-60');
    expect(newCp).toBeDefined();
    expect(newCp!['contactId']).toBe('contact-epsilon');
    expect(newCp!['connectionId']).toBe('conn-2');
  });
});

// ---------------------------------------------------------------------------
// Edge case: raw with no domain AND no name → skipped (not silently dropped)
// ---------------------------------------------------------------------------

describe('edge case: raw with no usable name or domain → skipped', () => {
  it('skips the raw row and reports it', async () => {
    _idCounter = 700;

    const rawRow = makeRaw({
      id: 'raw-70',
      connectionId: 'conn-1',
      sourceRecordId: 'src-70',
      name: null,
      domain: null,
      normalizedDomain: null,
      raw: { contacts: [] },
    });

    const store: InMemoryStore = {
      rawCompanies: [rawRow],
      companies: [],
      contacts: [],
      companyProvenance: [],
      contactProvenance: [],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();
    const tx = buildMockTx(store);
    const result = await engine.promoteStaging(tx);

    expect(store.companies).toHaveLength(0);
    expect(result.skipped).toBe(1);
    expect(result.results[0].kind).toBe('skipped');
  });
});

// ---------------------------------------------------------------------------
// Edge case: name-only match (no domain) → auto-merge
// ---------------------------------------------------------------------------

describe('edge case: exact name match, no domain conflict → auto-merge', () => {
  it('merges into existing canonical by name', async () => {
    _idCounter = 800;

    const existingCanonical = makeCanonical({
      id: 'canon-zeta',
      normalizedDomain: null,
      domain: null,
      normalizedName: 'zeta systems',
      name: 'Zeta Systems',
    });

    const rawRow = makeRaw({
      id: 'raw-80',
      connectionId: 'conn-1',
      sourceRecordId: 'src-80',
      name: 'Zeta Systems, Inc.',
      domain: null,
      normalizedDomain: null,
      raw: { contacts: [] },
    });

    const store: InMemoryStore = {
      rawCompanies: [rawRow],
      companies: [existingCanonical],
      contacts: [],
      companyProvenance: [],
      contactProvenance: [],
      dedupeCandidates: [],
    };

    const engine = new DedupeEngine();
    const tx = buildMockTx(store);
    const result = await engine.promoteStaging(tx);

    // Still 1 canonical company (merged, not new)
    expect(store.companies).toHaveLength(1);
    expect(result.merged).toBe(1);
    expect(result.promoted).toBe(0);

    // company_provenance written for the merged raw row
    expect(store.companyProvenance).toHaveLength(1);
    expect(store.companyProvenance[0]['rawCompanyId']).toBe('raw-80');
    expect(store.companyProvenance[0]['companyId']).toBe('canon-zeta');
  });
});
