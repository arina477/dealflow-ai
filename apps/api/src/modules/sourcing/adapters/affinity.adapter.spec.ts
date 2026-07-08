/**
 * AffinityDataSourceAdapter — unit tests.
 *
 * All HTTP is mocked via vi.stubGlobal('fetch', ...) — NO live Affinity HTTP.
 *
 * Test coverage:
 *   1. multi-page pagination: adapter fetches ALL 3 pages (the key robustness test)
 *   2. 429 → backoff → retry → success: rate-limit handling
 *   3. 5xx transient retry: server error retried
 *   4. timeout (AbortController): hanging response → aborts cleanly
 *   5. normalize: Affinity org fixture → expected NormalizedSourceRecord shape
 *   6. absent-key no-op: no AFFINITY_API_KEY → returns [], no throw, logs warning
 *   7. partial failure: a page errors → returns records from previous pages
 *   8. boundary Zod: malformed page response → clean logged error, no crash
 */

import type { DataSourceConnection } from '@dealflow/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AFFINITY_PROVIDER_KEY, AffinityDataSourceAdapter } from './affinity.adapter';

// ── Fixture: a minimal DataSourceConnection (credentials come from env, not here) ──

const dummyConnection: DataSourceConnection = {
  id: 'conn-uuid-1234',
  providerKey: 'AFFINITY',
  displayName: 'Affinity CRM',
  enabled: true,
  config: {},
  createdBy: null,
  createdAt: '2026-07-08T00:00:00.000Z',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal valid Affinity organization object. */
function makeOrg(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Test Org ${id}`,
    domain: `testorg${id}.com`,
    domains: [`testorg${id}.com`],
    global: false,
    person_ids: [],
    ...overrides,
  };
}

/** Build a valid paginated organizations response. */
function makeOrgsPage(orgs: ReturnType<typeof makeOrg>[], nextPageToken: string | null = null) {
  return {
    organizations: orgs,
    next_page_token: nextPageToken,
  };
}

/** Build a valid Affinity person object. */
function makePerson(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    type: 0,
    first_name: 'Alice',
    last_name: 'Smith',
    primary_email: `alice.smith${id}@example.com`,
    emails: [`alice.smith${id}@example.com`],
    organization_ids: [],
    ...overrides,
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
  // Ensure AFFINITY_API_KEY is set for most tests
  process.env.AFFINITY_API_KEY = 'test-api-key-do-not-use';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.AFFINITY_API_KEY;
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AffinityDataSourceAdapter', () => {
  it('has the correct providerKey', () => {
    const adapter = new AffinityDataSourceAdapter();
    expect(adapter.providerKey).toBe(AFFINITY_PROVIDER_KEY);
    expect(adapter.providerKey).toBe('AFFINITY');
  });

  // ── TEST 1: Multi-page pagination ─────────────────────────────────────────
  //
  // The adapter MUST fetch ALL pages, not just page 1.
  // Mock: 3 pages via next_page_token. Each page has 2 orgs, no persons.
  // Expect: all 6 orgs returned (2 per page × 3 pages).
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 1 — multi-page pagination: fetches ALL 3 pages and returns all records', async () => {
    const page1Orgs = [makeOrg(1), makeOrg(2)];
    const page2Orgs = [makeOrg(3), makeOrg(4)];
    const page3Orgs = [makeOrg(5), makeOrg(6)];

    const TOKEN_1 = 'page-token-1';
    const TOKEN_2 = 'page-token-2';

    // Track call order to return different responses per request
    let orgFetchCount = 0;

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);

      // person fetches — no person_ids on test orgs, so this should not fire
      if (urlStr.includes('/persons/')) {
        return Promise.resolve(jsonResponse(makePerson(999)));
      }

      // org list fetches
      orgFetchCount++;
      if (orgFetchCount === 1) {
        // First request: no page_token → page 1
        expect(urlStr).not.toContain('page_token=');
        return Promise.resolve(jsonResponse(makeOrgsPage(page1Orgs, TOKEN_1)));
      } else if (orgFetchCount === 2) {
        // Second request: page_token=TOKEN_1 → page 2
        expect(urlStr).toContain(`page_token=${TOKEN_1}`);
        return Promise.resolve(jsonResponse(makeOrgsPage(page2Orgs, TOKEN_2)));
      } else if (orgFetchCount === 3) {
        // Third request: page_token=TOKEN_2 → page 3 (last — null token)
        expect(urlStr).toContain(`page_token=${TOKEN_2}`);
        return Promise.resolve(jsonResponse(makeOrgsPage(page3Orgs, null)));
      }
      throw new Error(`Unexpected fetch call #${orgFetchCount}: ${url}`);
    });

    vi.stubGlobal('fetch', mockFetch);

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // All 3 pages fetched
    expect(orgFetchCount).toBe(3);

    // All 6 orgs returned
    expect(results).toHaveLength(6);
    const ids = results.map((r) => r.sourceRecordId);
    expect(ids).toEqual(['1', '2', '3', '4', '5', '6']);

    // Verify normalized shape of first record
    expect(results[0]).toMatchObject({
      sourceRecordId: '1',
      name: 'Test Org 1',
      domain: 'testorg1.com',
      contacts: [],
    });
  });

  // ── TEST 2: 429 → backoff → retry → success ───────────────────────────────
  //
  // First call returns 429 with X-Ratelimit-Limit-User-Reset: 1 (1 second).
  // Second call returns the org page.
  // Expect: adapter retries and returns results.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 2 — 429 backoff: retries after rate limit and returns results on success', async () => {
    let callCount = 0;

    const mockFetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // 429 with reset header
        return Promise.resolve(
          errorResponse(429, 'rate limited', { 'X-Ratelimit-Limit-User-Reset': '1' })
        );
      }
      // Success on retry
      return Promise.resolve(jsonResponse(makeOrgsPage([makeOrg(10)], null)));
    });

    vi.stubGlobal('fetch', mockFetch);

    // Stub setTimeout to resolve immediately (avoid real wait in tests)
    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // fetch was called at least twice (first: 429, second: success)
    expect(callCount).toBeGreaterThanOrEqual(2);

    // Results returned despite initial 429
    expect(results).toHaveLength(1);
    expect(results[0]?.sourceRecordId).toBe('10');
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
      return Promise.resolve(jsonResponse(makeOrgsPage([makeOrg(20)], null)));
    });

    vi.stubGlobal('fetch', mockFetch);

    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(callCount).toBeGreaterThanOrEqual(2);
    expect(results).toHaveLength(1);
    expect(results[0]?.sourceRecordId).toBe('20');
  });

  // ── TEST 4: Timeout (AbortController) ────────────────────────────────────
  //
  // The fetch call rejects with an AbortError (simulating timeout via AbortController).
  // After MAX_RETRIES exhausted, the adapter logs an error and returns partial results (empty).
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 4 — timeout: hanging request is aborted and adapter returns partial results (empty)', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const mockFetch = vi.fn().mockRejectedValue(abortError);

    vi.stubGlobal('fetch', mockFetch);

    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const adapter = new AffinityDataSourceAdapter();
    // Must NOT throw — partial failure returns []
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toEqual([]);
    // error was logged
    expect(consoleSpy).toHaveBeenCalled();
  });

  // ── TEST 5: Normalize ─────────────────────────────────────────────────────
  //
  // An Affinity org with one person → correct NormalizedSourceRecord shape.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 5 — normalize: Affinity org + person → correct NormalizedSourceRecord', async () => {
    const org = makeOrg(42, {
      name: 'Acme Corp',
      domain: 'acme.com',
      person_ids: [101],
    });
    const person = makePerson(101, {
      first_name: 'Jane',
      last_name: 'Doe',
      primary_email: 'jane.doe@acme.com',
    });

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/persons/101')) {
        return Promise.resolve(jsonResponse(person));
      }
      return Promise.resolve(jsonResponse(makeOrgsPage([org], null)));
    });

    vi.stubGlobal('fetch', mockFetch);

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toHaveLength(1);
    const record = results[0];

    expect(record?.sourceRecordId).toBe('42');
    expect(record?.name).toBe('Acme Corp');
    expect(record?.domain).toBe('acme.com');
    expect(record?.contacts).toHaveLength(1);
    expect(record?.contacts[0]).toMatchObject({
      name: 'Jane Doe',
      email: 'jane.doe@acme.com',
    });
    // title is undefined (Affinity v1 does not return title directly)
    expect(record?.contacts[0]?.title).toBeUndefined();
    // raw is the full org JSON
    expect(record?.raw).toMatchObject({ id: 42, name: 'Acme Corp' });
  });

  // ── TEST 6: Absent-key no-op ──────────────────────────────────────────────
  //
  // AFFINITY_API_KEY unset → returns [], no throw, logs a warning.
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 6 — absent-key no-op: returns [] and logs warning when key is not set', async () => {
    delete process.env.AFFINITY_API_KEY;

    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // Returns empty array
    expect(results).toEqual([]);

    // fetch was never called (no HTTP with no key)
    expect(mockFetch).not.toHaveBeenCalled();

    // Warning was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('AFFINITY_API_KEY is not set')
    );
  });

  // ── TEST 7: Partial failure ───────────────────────────────────────────────
  //
  // Page 1 succeeds, page 2 throws a network error (exhausts retries).
  // Adapter returns the records from page 1 (not zero, not a throw).
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 7 — partial failure: page 2 error returns records from page 1', async () => {
    const page1Orgs = [makeOrg(100), makeOrg(101)];
    const TOKEN_P2 = 'token-for-page-2';

    let orgFetchCount = 0;

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      const urlStr = String(url);

      if (urlStr.includes('/persons/')) {
        return Promise.resolve(jsonResponse(makePerson(999)));
      }

      orgFetchCount++;
      if (orgFetchCount === 1) {
        // Page 1 succeeds — has a next_page_token pointing to page 2
        return Promise.resolve(jsonResponse(makeOrgsPage(page1Orgs, TOKEN_P2)));
      }
      // All subsequent calls (page 2 + all retries) fail with network error
      return Promise.reject(new Error('network failure'));
    });

    vi.stubGlobal('fetch', mockFetch);

    vi.stubGlobal('setTimeout', (fn: () => void) => {
      fn();
      return 0;
    });

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // Records from page 1 are returned
    expect(results).toHaveLength(2);
    expect(results[0]?.sourceRecordId).toBe('100');
    expect(results[1]?.sourceRecordId).toBe('101');

    // Error was logged for the failed page
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('fetch failed after retries'));
  });

  // ── TEST 8: Boundary Zod validation ──────────────────────────────────────
  //
  // A malformed page response (missing required 'organizations' key) →
  // adapter logs an error and returns [] (no crash, no throw).
  // ─────────────────────────────────────────────────────────────────────────

  it('TEST 8 — boundary Zod: malformed response is logged and does not crash', async () => {
    const malformedResponse = {
      // 'organizations' key is missing — required by affinityOrganizationsResponseSchema
      data: 'unexpected shape',
      next_page_token: null,
    };

    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(malformedResponse));

    vi.stubGlobal('fetch', mockFetch);

    const adapter = new AffinityDataSourceAdapter();

    // Must NOT throw
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results).toEqual([]);
    // Error was logged about the Zod validation failure
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('failed Zod validation'));
  });

  // ── Additional: normalize domain fallback ────────────────────────────────
  //
  // When org.domain is null but org.domains has entries, use first domain.
  // ─────────────────────────────────────────────────────────────────────────

  it('normalizes domain from domains[] when domain is null', async () => {
    const org = makeOrg(77, {
      domain: null,
      domains: ['fallback-domain.io'],
      person_ids: [],
    });

    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(makeOrgsPage([org], null)));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results[0]?.domain).toBe('fallback-domain.io');
  });

  // ── Additional: org with no domain ──────────────────────────────────────

  it('handles org with no domain (domain and domains both absent)', async () => {
    const org = {
      id: 88,
      name: 'No Domain Corp',
      global: false,
      person_ids: [],
      // domain and domains intentionally absent
    };

    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(makeOrgsPage([org], null)));
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    expect(results[0]?.domain).toBeUndefined();
    expect(results[0]?.sourceRecordId).toBe('88');
  });

  // ── Additional: person Zod failure skips that person, keeps org ─────────

  it('skips a malformed person but still returns the org', async () => {
    const org = makeOrg(99, { person_ids: [201] });
    const malformedPerson = { bad_key: 'not a person' }; // missing required 'id'

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('/persons/201')) {
        return Promise.resolve(jsonResponse(malformedPerson));
      }
      return Promise.resolve(jsonResponse(makeOrgsPage([org], null)));
    });

    vi.stubGlobal('fetch', mockFetch);

    const adapter = new AffinityDataSourceAdapter();
    const results = await adapter.fetchCompanies(dummyConnection);

    // Org is returned, but with no contacts (person was skipped)
    expect(results).toHaveLength(1);
    expect(results[0]?.sourceRecordId).toBe('99');
    expect(results[0]?.contacts).toHaveLength(0);
    // Warning was logged
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('failed Zod validation'));
  });

  // ── Additional: auth header format ──────────────────────────────────────

  it('sends the correct Basic auth header (empty username, key as password)', async () => {
    const apiKey = 'my-test-api-key';
    process.env.AFFINITY_API_KEY = apiKey;

    const capturedHeaders: Record<string, string> = {};
    const mockFetch = vi.fn().mockImplementation((_url: string, options: RequestInit) => {
      const headers = options.headers as Record<string, string>;
      Object.assign(capturedHeaders, headers);
      return Promise.resolve(jsonResponse(makeOrgsPage([], null)));
    });

    vi.stubGlobal('fetch', mockFetch);

    const adapter = new AffinityDataSourceAdapter();
    await adapter.fetchCompanies(dummyConnection);

    const expectedAuth = `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`;
    expect(capturedHeaders.Authorization).toBe(expectedAuth);
  });
});
