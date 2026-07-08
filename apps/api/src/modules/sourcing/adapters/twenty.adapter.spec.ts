/**
 * TwentyDataSourceAdapter — unit tests.
 *
 * All HTTP is mocked via vi.stubGlobal('fetch', ...) — NO live Twenty HTTP.
 * Mirrors affinity.adapter.spec.ts structure from wave-30.
 *
 * Test coverage:
 *   1. multi-page cursor pagination: adapter fetches ALL 3 pages (key robustness test)
 *   2. 429 → backoff → retry → success: rate-limit handling
 *   3. 5xx transient retry: server error retried
 *   4. timeout (AbortController): hanging response → aborts cleanly, returns []
 *   5. normalize: Twenty company fixture → expected NormalizedSourceRecord shape
 *   6. absent-key no-op: no TWENTY_API_KEY → returns [], no throw, logs warning
 *   7. absent-URL no-op: no TWENTY_BASE_URL → returns [], no throw, logs warning
 *   8. base-URL https-validation: non-https TWENTY_BASE_URL → no-op + warn
 *   9. base-URL malformed: unparseable TWENTY_BASE_URL → no-op + warn
 *  10. boundary Zod: malformed Twenty response → clean logged error, no crash
 *  11. [P2-a] OUTPUT-validation: a normalized record failing normalizedSourceRecordSchema → skipped + logged
 *  12. auth header: Bearer token format verified
 *  13. partial failure: a page errors → returns records from previous pages
 */

import type { DataSourceConnection } from '@dealflow/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TWENTY_PROVIDER_KEY, TwentyDataSourceAdapter } from './twenty.adapter';

// ── Fixture: a minimal DataSourceConnection (credentials come from env, not here) ──

const dummyConnection: DataSourceConnection = {
  id: 'conn-uuid-5678',
  providerKey: 'TWENTY',
  displayName: 'Twenty CRM',
  enabled: true,
  config: {},
  createdBy: null,
  createdAt: '2026-07-08T00:00:00.000Z',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal valid Twenty company object. */
function makeCompany(id: string, name: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name,
    domainName: {
      primaryLinkUrl: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
      primaryLinkLabel: name,
    },
    people: [],
    createdAt: '2026-07-08T00:00:00.000Z',
    updatedAt: '2026-07-08T00:00:00.000Z',
    ...overrides,
  };
}

/** Build a valid Twenty person object. */
function makePerson(
  id: string,
  firstName: string,
  lastName: string,
  email: string,
  jobTitle?: string,
  overrides: Record<string, unknown> = {}
) {
  return {
    id,
    name: { firstName, lastName },
    emails: {
      primaryEmail: email,
      additionalEmails: [],
    },
    jobTitle: jobTitle ?? null,
    ...overrides,
  };
}

/** Build a valid paginated Twenty companies response. */
function makeCompaniesPage(
  companies: ReturnType<typeof makeCompany>[],
  hasNextPage: boolean,
  endCursor: string | null = null
) {
  return {
    data: { companies },
    totalCount: companies.length,
    pageInfo: {
      hasNextPage,
      hasPreviousPage: false,
      startCursor: companies[0]?.id ?? null,
      endCursor: hasNextPage ? endCursor : null,
    },
  };
}

/** A Response factory for fetch mocks. */
function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function errorResponse(status: number, body = 'error', headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

// ── Setup / teardown ─────────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  // Set both env vars for most tests
  process.env.TWENTY_API_KEY = 'test-twenty-api-key-do-not-use';
  process.env.TWENTY_BASE_URL = 'https://api.twenty.com';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.TWENTY_API_KEY;
  delete process.env.TWENTY_BASE_URL;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TwentyDataSourceAdapter', () => {
  it('has the correct providerKey', () => {
    const adapter = new TwentyDataSourceAdapter();
    expect(adapter.providerKey).toBe(TWENTY_PROVIDER_KEY);
    expect(adapter.providerKey).toBe('TWENTY');
  });

  // ── TEST 1: Multi-page cursor pagination ──────────────────────────────────
  //
  // The adapter MUST fetch ALL pages, not just page 1.
  // Mock: 3 pages via pageInfo.endCursor + hasNextPage.
  // Each page has 2 companies. Expect: all 6 companies returned.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 1 — multi-page cursor pagination: fetches ALL 3 pages and returns all records', async () => {
    const page1Companies = [makeCompany('id-1', 'Acme'), makeCompany('id-2', 'Beta')];
    const page2Companies = [makeCompany('id-3', 'Gamma'), makeCompany('id-4', 'Delta')];
    const page3Companies = [makeCompany('id-5', 'Epsilon'), makeCompany('id-6', 'Zeta')];

    const CURSOR_1 = 'cursor-after-page-1';
    const CURSOR_2 = 'cursor-after-page-2';

    let fetchCount = 0;

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);
      fetchCount++;

      if (fetchCount === 1) {
        // First request: no starting_after
        expect(urlStr).not.toContain('starting_after=');
        return Promise.resolve(jsonResponse(makeCompaniesPage(page1Companies, true, CURSOR_1)));
      } else if (fetchCount === 2) {
        // Second request: starting_after=CURSOR_1
        expect(urlStr).toContain(`starting_after=${CURSOR_1}`);
        return Promise.resolve(jsonResponse(makeCompaniesPage(page2Companies, true, CURSOR_2)));
      } else if (fetchCount === 3) {
        // Third request: starting_after=CURSOR_2 → last page
        expect(urlStr).toContain(`starting_after=${CURSOR_2}`);
        return Promise.resolve(jsonResponse(makeCompaniesPage(page3Companies, false, null)));
      }
      throw new Error(`Unexpected fetch call #${fetchCount}: ${url}`);
    });

    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // All 3 pages fetched
    expect(fetchCount).toBe(3);

    // All 6 companies returned
    expect(results).toHaveLength(6);
    const ids = results.map((r) => r.sourceRecordId);
    expect(ids).toEqual(['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6']);

    // Verify normalized shape of first record
    expect(results[0]).toMatchObject({
      sourceRecordId: 'id-1',
      name: 'Acme',
      contacts: [],
    });
  });

  // ── TEST 2: 429 → backoff → retry → success ───────────────────────────────
  //
  // First call returns 429. Second call returns the company page.
  // Expect: adapter retries and returns results.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 2 — 429 backoff: retries after rate limit and returns results on success', async () => {
    let callCount = 0;

    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(errorResponse(429, 'rate limited'));
      }
      // Success on retry
      return Promise.resolve(
        jsonResponse(makeCompaniesPage([makeCompany('id-10', 'RateRetry Corp')], false, null))
      );
    });

    vi.stubGlobal('fetch', mockFetch);

    // Stub setTimeout to resolve immediately (avoid real wait in tests)
    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // fetch was called at least twice (first: 429, second: success)
    expect(callCount).toBeGreaterThanOrEqual(2);

    // Results returned despite initial 429
    expect(results).toHaveLength(1);
    expect(results[0]?.sourceRecordId).toBe('id-10');
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('429 rate-limited'));
  });

  // ── TEST 3: 5xx transient retry ───────────────────────────────────────────
  //
  // First call returns 503. Second call succeeds.
  // Expect: adapter retries and returns results.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 3 — 5xx retry: retries on server error and returns results on success', async () => {
    let callCount = 0;

    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(errorResponse(503, 'service unavailable'));
      }
      return Promise.resolve(
        jsonResponse(makeCompaniesPage([makeCompany('id-20', 'ServerRetry Corp')], false, null))
      );
    });

    vi.stubGlobal('fetch', mockFetch);

    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(results).toHaveLength(1);
    expect(results[0]?.sourceRecordId).toBe('id-20');
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('server error'));
  });

  // ── TEST 4: Timeout (AbortController) ────────────────────────────────────
  //
  // The fetch call rejects with an AbortError (simulating timeout).
  // After MAX_RETRIES exhausted, the adapter logs an error and returns [].
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 4 — timeout: hanging request aborts and adapter returns partial results (empty)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const mockFetch = vi.fn().mockRejectedValue(abortError);

    vi.stubGlobal('fetch', mockFetch);

    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const adapter = new TwentyDataSourceAdapter();
    // Must NOT throw — partial failure returns []
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toEqual([]);
    // error was logged
    expect(consoleSpy).toHaveBeenCalled();
  });

  // ── TEST 5: Normalize ─────────────────────────────────────────────────────
  //
  // A Twenty company with one person → correct NormalizedSourceRecord shape.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 5 — normalize: Twenty company + person → correct NormalizedSourceRecord', async () => {
    const person = makePerson(
      'person-uuid-1',
      'Jane',
      'Doe',
      'jane.doe@acme.com',
      'Head of Engineering'
    );
    const company = makeCompany('company-uuid-42', 'Acme Corp', {
      domainName: {
        primaryLinkUrl: 'https://acme.com',
        primaryLinkLabel: 'Acme',
      },
      people: [person],
    });

    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeCompaniesPage([company], false, null)));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toHaveLength(1);
    const record = results[0];

    expect(record?.sourceRecordId).toBe('company-uuid-42');
    expect(record?.name).toBe('Acme Corp');
    expect(record?.domain).toBe('acme.com');
    expect(record?.contacts).toHaveLength(1);
    expect(record?.contacts[0]).toMatchObject({
      name: 'Jane Doe',
      email: 'jane.doe@acme.com',
      title: 'Head of Engineering',
    });
    // raw is the full company JSON
    expect(record?.raw).toMatchObject({ id: 'company-uuid-42', name: 'Acme Corp' });
  });

  // ── TEST 6: Absent TWENTY_API_KEY no-op ─────────────────────────────────
  //
  // TWENTY_API_KEY unset → returns [], no throw, logs a warning.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 6 — absent-key no-op: returns [] and logs warning when TWENTY_API_KEY is not set', async () => {
    delete process.env.TWENTY_API_KEY;

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // Returns empty array
    expect(results).toEqual([]);

    // fetch was never called (no HTTP with no key)
    expect(mockFetch).not.toHaveBeenCalled();

    // Warning was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('TWENTY_API_KEY is not set')
    );
  });

  // ── TEST 7: Absent TWENTY_BASE_URL no-op ─────────────────────────────────
  //
  // TWENTY_BASE_URL unset → returns [], no throw, logs a warning.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 7 — absent-URL no-op: returns [] and logs warning when TWENTY_BASE_URL is not set', async () => {
    delete process.env.TWENTY_BASE_URL;

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // Returns empty array
    expect(results).toEqual([]);

    // fetch was never called
    expect(mockFetch).not.toHaveBeenCalled();

    // Warning was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('TWENTY_BASE_URL is not set')
    );
  });

  // ── TEST 8: Base URL https-validation (non-https) ─────────────────────────
  //
  // TWENTY_BASE_URL set to a non-https URL → no-op + warn, no HTTP call.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 8 — base-URL https-validation: non-https URL → no-op + warn', async () => {
    process.env.TWENTY_BASE_URL = 'http://api.twenty.com'; // http, not https

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('is not HTTPS'));
  });

  // ── TEST 9: Base URL malformed (unparseable) ──────────────────────────────
  //
  // TWENTY_BASE_URL is not a valid URL at all → no-op + warn.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 9 — base-URL malformed: unparseable URL → no-op + warn', async () => {
    process.env.TWENTY_BASE_URL = 'not-a-url-at-all'; // no scheme, unparseable by new URL()

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    // Either "not a valid URL" or "not HTTPS" warning is acceptable
    expect(consoleWarnSpy).toHaveBeenCalled();
  });

  // ── TEST 10: Boundary Zod validation ──────────────────────────────────────
  //
  // A malformed page response (missing required 'data.companies' key) →
  // adapter logs an error and returns [] (no crash, no throw).
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 10 — boundary Zod: malformed response is logged and does not crash', async () => {
    const malformedResponse = {
      // 'data' key is missing — required by twentyCompaniesResponseSchema
      wrongKey: 'unexpected shape',
      pageInfo: { hasNextPage: false, endCursor: null },
    };

    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(malformedResponse));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();

    // Must NOT throw
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toEqual([]);
    // Error was logged about the Zod validation failure
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('failed Zod validation'));
  });

  // ── TEST 11: [P2-a] OUTPUT-validation ─────────────────────────────────────
  //
  // A normalized record that fails normalizedSourceRecordSchema is skipped + logged.
  // We produce a company with an empty name ('' fails z.string().min(1)).
  // Expect: the invalid record is skipped, the valid one is kept.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 11 — [P2-a] OUTPUT-validation: invalid normalized record is skipped + logged', async () => {
    const validCompany = makeCompany('id-valid', 'Valid Corp');
    // A company with empty name — will pass boundary-Zod (Twenty name field
    // is z.string() in the inbound schema) but FAIL normalizedSourceRecordSchema
    // (which requires z.string().min(1) for the name field).
    const invalidCompany = makeCompany('id-invalid', '', {
      name: '', // empty string fails normalizedSourceRecordSchema z.string().min(1)
    });

    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(makeCompaniesPage([validCompany, invalidCompany], false, null))
      );
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // Only the valid company is returned
    expect(results).toHaveLength(1);
    expect(results[0]?.sourceRecordId).toBe('id-valid');

    // Warning was logged about the skipped record
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('failed output schema validation')
    );
  });

  // ── TEST 12: Auth header format ────────────────────────────────────────────
  //
  // The adapter must send Bearer auth (not Basic).
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 12 — auth header: sends correct Bearer token header', async () => {
    const apiKey = 'my-twenty-api-key';
    process.env.TWENTY_API_KEY = apiKey;

    const capturedHeaders: Record<string, string> = {};

    const mockFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      const headers = options.headers as Record<string, string>;
      Object.assign(capturedHeaders, headers);
      return Promise.resolve(jsonResponse(makeCompaniesPage([], false, null)));
    });

    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    await adapter.fetchCompanies(dummyConnection);

    expect(capturedHeaders.Authorization).toBe(`Bearer ${apiKey}`);
  });

  // ── TEST 13: Partial failure ───────────────────────────────────────────────
  //
  // Page 1 succeeds (2 companies, hasNextPage=true).
  // Page 2 throws a network error (exhausts retries).
  // Adapter returns the records from page 1 (not zero, not a throw).
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 13 — partial failure: page 2 error returns records from page 1', async () => {
    const page1Companies = [makeCompany('id-100', 'First'), makeCompany('id-101', 'Second')];
    const CURSOR_P2 = 'cursor-for-page-2';

    let fetchCount = 0;

    const mockFetch = vi.fn().mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        // Page 1 succeeds — has a cursor pointing to page 2
        return Promise.resolve(jsonResponse(makeCompaniesPage(page1Companies, true, CURSOR_P2)));
      }
      // All subsequent calls (page 2 + all retries) fail with network error
      return Promise.reject(new Error('network failure'));
    });

    vi.stubGlobal('fetch', mockFetch);

    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // Records from page 1 are returned
    expect(results).toHaveLength(2);
    expect(results[0]?.sourceRecordId).toBe('id-100');
    expect(results[1]?.sourceRecordId).toBe('id-101');

    // Error was logged for the failed page
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fetch failed after retries'));
  });

  // ── Additional: normalize domain extraction ──────────────────────────────
  //
  // Domain is extracted correctly from primaryLinkUrl (https://acme.com → acme.com).
  // ─────────────────────────────────────────────────────────────────────────

  it('normalizes domain correctly from primaryLinkUrl', async () => {
    const company = makeCompany('id-dom', 'Domain Test', {
      domainName: {
        primaryLinkUrl: 'https://www.example.com/path/to/page',
        primaryLinkLabel: 'Example',
      },
    });

    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeCompaniesPage([company], false, null)));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results[0]?.domain).toBe('www.example.com');
  });

  // ── Additional: company with no domain ──────────────────────────────────

  it('handles company with no domainName (absent) — domain is undefined', async () => {
    const company = makeCompany('id-nodom', 'No Domain Corp', {
      domainName: null,
    });

    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeCompaniesPage([company], false, null)));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results[0]?.domain).toBeUndefined();
    expect(results[0]?.sourceRecordId).toBe('id-nodom');
  });

  // ── Additional: person with no email → contact.email is undefined ────────

  it('handles person with no email — contact.email is undefined', async () => {
    const person = {
      id: 'person-no-email',
      name: { firstName: 'Bob', lastName: 'Builder' },
      emails: { primaryEmail: null, additionalEmails: [] },
      jobTitle: null,
    };
    const company = makeCompany('id-noemail-company', 'No Email Corp', {
      people: [person],
    });

    const mockFetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(makeCompaniesPage([company], false, null)));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toHaveLength(1);
    expect(results[0]?.contacts[0]?.name).toBe('Bob Builder');
    expect(results[0]?.contacts[0]?.email).toBeUndefined();
    expect(results[0]?.contacts[0]?.title).toBeUndefined();
  });

  // ── Additional: depth=2 query param is sent ──────────────────────────────

  it('sends depth=2 query param in the request URL', async () => {
    const capturedUrls: string[] = [];

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      capturedUrls.push(String(url));
      return Promise.resolve(jsonResponse(makeCompaniesPage([], false, null)));
    });

    vi.stubGlobal('fetch', mockFetch);

    const adapter = new TwentyDataSourceAdapter();
    await adapter.fetchCompanies(dummyConnection);

    expect(capturedUrls[0]).toContain('depth=2');
  });
});
