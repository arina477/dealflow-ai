/**
 * AffinityDataSourceAdapter — DataSourceAdapter implementation for the Affinity CRM REST API.
 *
 * SDK Reference: command-center/dev/SDK-Docs/Affinity/affinity.md
 *
 * Implements the DataSourceAdapter interface from @dealflow/shared:
 *   - providerKey: 'AFFINITY'
 *   - fetchCompanies(connection): Promise<NormalizedSourceRecord[]>
 *
 * Robustness (all inline in fetchCompanies — NOTE-2: no shared withRetry util):
 *   - Paginates ALL Affinity organization pages (page_token loop until next_page_token is null/absent)
 *   - 429 backoff: reads X-Ratelimit-Limit-User-Reset header (seconds); falls back to exponential
 *   - Retry: transient 5xx / network errors, bounded by MAX_RETRIES
 *   - Per-request timeout: AbortController (REQUEST_TIMEOUT_MS)
 *   - Boundary Zod validation: each Affinity response validated; malformed → logged skip, not crash (NOTE-3)
 *   - Partial failure: a page error logs + returns all records collected so far
 *   - Absent-key no-op: if AFFINITY_API_KEY is unset, returns [] + logs warning; does NOT throw
 *
 * Contacts: per-org person hydration via GET /persons/{id}, capped at MAX_PERSONS_PER_ORG to
 * stay within the 900 req/min rate limit. person_ids come from the org list response.
 *
 * Normalize map (Affinity → NormalizedSourceRecord):
 *   sourceRecordId = String(org.id)
 *   name          = org.name
 *   domain        = org.domain ?? org.domains?.[0]
 *   contacts[]    = fetched persons → { name, email }  (title deferred: LATER)
 *   raw           = full Affinity org JSON
 *
 * Secret: AFFINITY_API_KEY — env only, never hard-coded, never committed.
 * NOTE-1: providerKey = 'AFFINITY'; process.env[providerKey] = process.env['AFFINITY'] would
 * be undefined (providerKey is 'AFFINITY' but env var is AFFINITY_API_KEY). The interface contract
 * says "credentials resolved from process.env[providerKey]" as a conceptual pattern; in practice
 * each adapter chooses the concrete env var name. This adapter reads process.env.AFFINITY_API_KEY
 * and documents the name in .env.example. See deviation note in B-2-backend.md.
 *
 * Workspace isolation: NOT this adapter's concern. IngestionService stamps workspaceId when
 * it writes raw_companies. The adapter is workspace-agnostic (returns records only).
 *
 * NOTE-2: No healthCheck method, no shared withRetry helper — per binding constraints.
 * All robustness is inlined in fetchCompanies.
 */

import type {
  DataSourceAdapter,
  DataSourceConnection,
  NormalizedSourceRecord,
} from '@dealflow/shared';
import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// Configuration constants
// ────────────────────────────────────────────────────────────────────────────

/** Affinity REST API base URL (no version segment). */
const AFFINITY_BASE_URL = 'https://api.affinity.co';

/** Page size for paginated org fetch. 500 is a safe large-page value. */
const PAGE_SIZE = 500;

/**
 * Maximum persons to fetch per organization via GET /persons/{id}.
 * Affinity rate limit is 900 req/min. This cap avoids exhausting the budget
 * on person hydration when an org has hundreds of associated persons.
 */
const MAX_PERSONS_PER_ORG = 10;

/** Per-request timeout in milliseconds. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum retry attempts for transient (5xx / network) errors. */
const MAX_RETRIES = 3;

/** Base backoff for exponential retry when no Retry-After / reset header. */
const BASE_BACKOFF_MS = 1_000;

/** Provider key — must match the env var prefix convention (see NOTE-1 above). */
export const AFFINITY_PROVIDER_KEY = 'AFFINITY';

// ────────────────────────────────────────────────────────────────────────────
// Boundary Zod schemas (internal — NOTE-3: validate at the network boundary)
// These use .passthrough() to tolerate future API additions without breaking.
// ────────────────────────────────────────────────────────────────────────────

const affinityOrganizationSchema = z
  .object({
    id: z.number().int(),
    name: z.string(),
    domain: z.string().nullable().optional(),
    domains: z.array(z.string()).optional(),
    person_ids: z.array(z.number().int()).optional(),
    global: z.boolean().optional(),
  })
  .passthrough();

type AffinityOrganization = z.infer<typeof affinityOrganizationSchema>;

const affinityOrganizationsResponseSchema = z
  .object({
    organizations: z.array(affinityOrganizationSchema),
    next_page_token: z.string().nullable().optional(),
  })
  .passthrough();

const affinityPersonSchema = z
  .object({
    id: z.number().int(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    primary_email: z.string().nullable().optional(),
    emails: z.array(z.string()).optional(),
  })
  .passthrough();

type AffinityPerson = z.infer<typeof affinityPersonSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Helper: sleep
// ────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: build Authorization header value
// Basic auth: base64(":" + apiKey) — empty username, key as password.
// Source: https://api-docs.affinity.co #authentication — curl -u :$APIKEY
// ────────────────────────────────────────────────────────────────────────────

function buildAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: fetch with timeout + retry (inlined — NOTE-2: no shared util)
//
// Handles:
//   - Per-request AbortController timeout
//   - 429 backoff: X-Ratelimit-Limit-User-Reset header (seconds) or exponential
//   - 5xx / network retry: up to MAX_RETRIES, exponential backoff
//
// Returns: { ok: true, data: unknown } | { ok: false, status: number, body: string }
// Throws only on exceeded retry budget or unrecoverable 4xx (non-429).
// ────────────────────────────────────────────────────────────────────────────

interface FetchSuccess {
  ok: true;
  data: unknown;
}

interface FetchFailure {
  ok: false;
  status: number;
  body: string;
}

type FetchResult = FetchSuccess | FetchFailure;

async function fetchWithRetry(url: string, authHeader: string, attempt = 0): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } catch (networkErr) {
    clearTimeout(timer);
    // Network error or timeout abort — retry if budget allows
    if (attempt < MAX_RETRIES) {
      const backoffMs = BASE_BACKOFF_MS * 2 ** attempt;
      console.warn(
        `AffinityAdapter: network error on "${url}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${String(networkErr)}. Retrying in ${backoffMs}ms.`
      );
      await sleep(backoffMs);
      return fetchWithRetry(url, authHeader, attempt + 1);
    }
    throw new Error(
      `AffinityAdapter: network error after ${MAX_RETRIES + 1} attempts on "${url}": ${String(networkErr)}`
    );
  } finally {
    clearTimeout(timer);
  }

  // 429 — rate limited
  if (response.status === 429) {
    if (attempt >= MAX_RETRIES) {
      const body = await response.text();
      return { ok: false, status: 429, body };
    }
    // Use X-Ratelimit-Limit-User-Reset (seconds until window resets) if available
    const resetHeader = response.headers.get('X-Ratelimit-Limit-User-Reset');
    const backoffMs = resetHeader
      ? Math.max(parseInt(resetHeader, 10), 1) * 1_000
      : BASE_BACKOFF_MS * 2 ** attempt;
    console.warn(
      `AffinityAdapter: 429 rate-limited on "${url}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Backing off ${backoffMs}ms.`
    );
    await sleep(backoffMs);
    return fetchWithRetry(url, authHeader, attempt + 1);
  }

  // 5xx — transient server error
  if (response.status >= 500) {
    if (attempt < MAX_RETRIES) {
      const backoffMs = BASE_BACKOFF_MS * 2 ** attempt;
      console.warn(
        `AffinityAdapter: ${response.status} server error on "${url}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${backoffMs}ms.`
      );
      await sleep(backoffMs);
      return fetchWithRetry(url, authHeader, attempt + 1);
    }
    const body = await response.text();
    return { ok: false, status: response.status, body };
  }

  // Non-2xx, non-429, non-5xx (e.g. 401, 403, 404, 422) — do not retry
  if (!response.ok) {
    const body = await response.text();
    return { ok: false, status: response.status, body };
  }

  // Success
  const data: unknown = await response.json();
  return { ok: true, data };
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: normalize a single Affinity organization + fetched persons
// ────────────────────────────────────────────────────────────────────────────

function normalizeOrg(
  org: AffinityOrganization,
  persons: AffinityPerson[]
): NormalizedSourceRecord {
  const domain = org.domain ?? org.domains?.[0] ?? undefined;

  const contacts = persons.map((p) => {
    const nameParts = [p.first_name, p.last_name].filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0
    );
    const name = nameParts.length > 0 ? nameParts.join(' ') : undefined;
    const email = (p.primary_email ?? p.emails?.[0]) || undefined;
    return { name, email };
  });

  return {
    sourceRecordId: String(org.id),
    name: org.name,
    ...(domain !== undefined ? { domain } : {}),
    contacts,
    // Full raw org payload stored for lineage
    raw: org as Record<string, unknown>,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// AffinityDataSourceAdapter
// ────────────────────────────────────────────────────────────────────────────

export class AffinityDataSourceAdapter implements DataSourceAdapter {
  readonly providerKey: string = AFFINITY_PROVIDER_KEY;

  /**
   * fetchCompanies — fetches and normalizes all Affinity organizations.
   *
   * Resolves the API key from process.env.AFFINITY_API_KEY (the env var name
   * documented in .env.example and SDK doc). If the key is absent, logs a
   * warning and returns [] — the app boots and the fixture adapter still works.
   *
   * The `connection` argument is used for interface compliance; credentials
   * come from env, not from the connection row.
   *
   * Algorithm:
   *   1. Read AFFINITY_API_KEY; bail with [] if absent.
   *   2. Paginate GET /organizations (page_size=500, page_token loop).
   *      Boundary-Zod-validate each page response.
   *      Collect all orgs; on page error → log + return partial results.
   *   3. For each org, fetch up to MAX_PERSONS_PER_ORG persons via GET /persons/{id}.
   *      Boundary-Zod-validate each person response; skip malformed.
   *   4. Normalize each org + its persons → NormalizedSourceRecord.
   *   5. Return all records.
   */
  async fetchCompanies(_connection: DataSourceConnection): Promise<NormalizedSourceRecord[]> {
    // NOTE-1: env key is AFFINITY_API_KEY, not process.env['AFFINITY'].
    // The interface contract "process.env[providerKey]" is a conceptual pattern;
    // this adapter uses the documented concrete name. See B-2-backend.md deviation note.
    const apiKey = process.env.AFFINITY_API_KEY;

    if (!apiKey) {
      console.warn(
        'AffinityAdapter: AFFINITY_API_KEY is not set. Skipping Affinity fetch — returning []. ' +
          'Set the key in Railway env vars (dealflow-api service) to enable Affinity sourcing.'
      );
      return [];
    }

    const authHeader = buildAuthHeader(apiKey);
    const allOrgs: AffinityOrganization[] = [];

    // ── Phase 1: Paginate all organizations ──────────────────────────────────
    let pageToken: string | null | undefined;
    let pageNumber = 0;

    while (true) {
      pageNumber++;
      const url = new URL(`${AFFINITY_BASE_URL}/organizations`);
      url.searchParams.set('page_size', String(PAGE_SIZE));
      // Empty term = return all orgs (no search filter)
      url.searchParams.set('term', '');
      if (pageToken) {
        url.searchParams.set('page_token', pageToken);
      }

      console.log(
        `AffinityAdapter: fetching org page ${pageNumber} (page_token=${pageToken ?? 'none'})`
      );

      let result: FetchResult;
      try {
        result = await fetchWithRetry(url.toString(), authHeader);
      } catch (err) {
        // Network failure exhausted retries — partial failure: return what we have
        console.error(
          `AffinityAdapter: page ${pageNumber} fetch failed after retries: ${String(err)}. Returning ${allOrgs.length} orgs collected so far.`
        );
        break;
      }

      if (!result.ok) {
        console.error(
          `AffinityAdapter: page ${pageNumber} returned HTTP ${result.status}: ${result.body}. Returning ${allOrgs.length} orgs collected so far.`
        );
        break;
      }

      // NOTE-3: Boundary-Zod-validate the page response
      const parsed = affinityOrganizationsResponseSchema.safeParse(result.data);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join('; ');
        console.error(
          `AffinityAdapter: page ${pageNumber} response failed Zod validation: ${issues}. Returning ${allOrgs.length} orgs collected so far.`
        );
        break;
      }

      const { organizations, next_page_token } = parsed.data;
      allOrgs.push(...organizations);

      console.log(
        `AffinityAdapter: page ${pageNumber} — ${organizations.length} orgs (total so far: ${allOrgs.length}). next_page_token=${next_page_token ?? 'null (done)'}`
      );

      // Termination: null or absent next_page_token means all records fetched
      if (next_page_token == null) {
        break;
      }
      pageToken = next_page_token;
    }

    // ── Phase 2: Hydrate persons for each org ────────────────────────────────
    const records: NormalizedSourceRecord[] = [];

    for (const org of allOrgs) {
      const personIds = (org.person_ids ?? []).slice(0, MAX_PERSONS_PER_ORG);
      const persons: AffinityPerson[] = [];

      for (const personId of personIds) {
        const personUrl = `${AFFINITY_BASE_URL}/persons/${personId}`;
        let personResult: FetchResult;
        try {
          personResult = await fetchWithRetry(personUrl, authHeader);
        } catch (err) {
          console.warn(
            `AffinityAdapter: person ${personId} fetch failed: ${String(err)}. Skipping.`
          );
          continue;
        }

        if (!personResult.ok) {
          console.warn(
            `AffinityAdapter: person ${personId} returned HTTP ${personResult.status}. Skipping.`
          );
          continue;
        }

        // NOTE-3: Boundary-Zod-validate each person response
        const parsedPerson = affinityPersonSchema.safeParse(personResult.data);
        if (!parsedPerson.success) {
          const issues = parsedPerson.error.issues.map((i) => i.message).join('; ');
          console.warn(
            `AffinityAdapter: person ${personId} failed Zod validation: ${issues}. Skipping.`
          );
          continue;
        }

        persons.push(parsedPerson.data);
      }

      records.push(normalizeOrg(org, persons));
    }

    console.log(`AffinityAdapter: fetchCompanies complete — returning ${records.length} records.`);
    return records;
  }
}
