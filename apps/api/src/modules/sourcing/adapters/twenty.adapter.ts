/**
 * TwentyDataSourceAdapter — DataSourceAdapter implementation for the Twenty CRM REST API.
 *
 * SDK Reference: command-center/dev/SDK-Docs/Twenty/twenty.md
 *
 * Implements the DataSourceAdapter interface from @dealflow/shared:
 *   - providerKey: 'TWENTY'
 *   - fetchCompanies(connection): Promise<NormalizedSourceRecord[]>
 *
 * MIRROR: affinity.adapter.ts (wave-30) — same structural pattern:
 *   fetchWithRetry (429/5xx backoff + retry + AbortController timeout),
 *   internal cursor-based pagination (all pages), boundary-Zod safeParse on
 *   inbound responses, graceful absent-key/URL no-op, registered in
 *   createDefaultRegistry.
 *
 * Robustness (all inline in fetchCompanies — mirroring NOTE-2 from Affinity):
 *   - INTERNAL cursor pagination: fetches ALL pages until hasNextPage=false or
 *     endCursor=null (Twenty REST cursor model — starting_after param)
 *   - 429 backoff: exponential from BASE_BACKOFF_MS (no documented reset header)
 *   - Retry: transient 5xx / network errors, bounded by MAX_RETRIES
 *   - Per-request timeout: AbortController (REQUEST_TIMEOUT_MS), cleared in finally
 *   - Boundary Zod validation: each Twenty response validated; malformed → logged
 *     skip, not crash
 *   - Partial failure: a page error logs + returns all records collected so far
 *   - Absent-key no-op: if TWENTY_API_KEY is unset → return [] + warn, no throw
 *   - Absent-URL no-op: if TWENTY_BASE_URL is unset → return [] + warn, no throw
 *   - [SSRF/misconfig guard] https-validate TWENTY_BASE_URL before any HTTP
 *
 * [P2-a FOLD — wave-31 gap closure from wave-30] safeParse the OUTPUT against
 * normalizedSourceRecordSchema (skip + log any record that fails) — mirrors
 * fixture.adapter.ts:85 pattern. Closes the gap in the Affinity adapter (which
 * validates inbound but not outbound).
 *
 * Contacts: included inline via depth=1 relation loading on GET /rest/companies.
 * Twenty returns associated people as nested objects — no separate per-company
 * person call needed. People relation is absent/empty-array for companies with
 * no contacts.
 *
 * Normalize map (Twenty → NormalizedSourceRecord):
 *   sourceRecordId = company.id               (UUID string, used directly)
 *   name          = company.name
 *   domain        = extracted from company.domainName.primaryLinkUrl
 *                   (strip https:// / http:// and trailing path)
 *   contacts[]    = company.people (depth=1) → { name, email, title }
 *   raw           = full Twenty company JSON
 *
 * Secrets:
 *   TWENTY_API_KEY  — env only, never hard-coded, never committed
 *   TWENTY_BASE_URL — env only, never hard-coded, never committed
 *   (config schema dataSourceConnectionConfigSchema is UNTOUCHED — wave-16 boundary)
 *
 * NOTE-2 (mirrored): No healthCheck, no shared withRetry helper — all robustness
 * inlined in fetchCompanies.
 *
 * NOTE-3 (mirrored): Boundary-Zod validates each Twenty page response and
 * each normalized output record; malformed → logged skip.
 */

import type {
  DataSourceAdapter,
  DataSourceConnection,
  NormalizedSourceRecord,
} from '@dealflow/shared';
import { normalizedSourceRecordSchema } from '@dealflow/shared';
import { z } from 'zod';

// ────────────────────────────────────────────────────────────────────────────
// Configuration constants
// ────────────────────────────────────────────────────────────────────────────

/** Page size for paginated company fetch. 60 is the Twenty default limit. */
const PAGE_SIZE = 60;

/** Per-request timeout in milliseconds (mirrors Affinity adapter). */
const REQUEST_TIMEOUT_MS = 30_000;

/** Maximum retry attempts for transient (5xx / network) errors. */
const MAX_RETRIES = 3;

/** Base backoff for exponential retry (no Twenty rate-limit reset header documented). */
const BASE_BACKOFF_MS = 1_000;

/** Provider key — registered in createDefaultRegistry. */
export const TWENTY_PROVIDER_KEY = 'TWENTY';

// ────────────────────────────────────────────────────────────────────────────
// Boundary Zod schemas (internal — NOTE-3: validate at the network boundary)
// Use .passthrough() to tolerate future Twenty API additions without breaking.
// ────────────────────────────────────────────────────────────────────────────

const twentyPersonNameSchema = z
  .object({
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  })
  .passthrough();

const twentyPersonEmailsSchema = z
  .object({
    primaryEmail: z.string().nullable().optional(),
    additionalEmails: z.array(z.string()).nullable().optional(),
  })
  .passthrough();

const twentyPersonSchema = z
  .object({
    id: z.string(),
    name: twentyPersonNameSchema.optional(),
    emails: twentyPersonEmailsSchema.optional(),
    jobTitle: z.string().nullable().optional(),
  })
  .passthrough();

type TwentyPerson = z.infer<typeof twentyPersonSchema>;

const twentyDomainNameSchema = z
  .object({
    primaryLinkUrl: z.string().nullable().optional(),
    primaryLinkLabel: z.string().nullable().optional(),
  })
  .passthrough();

const twentyCompanySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    domainName: twentyDomainNameSchema.nullable().optional(),
    people: z.array(twentyPersonSchema).nullable().optional(),
  })
  .passthrough();

type TwentyCompany = z.infer<typeof twentyCompanySchema>;

const twentyPageInfoSchema = z
  .object({
    hasNextPage: z.boolean().optional(),
    hasPreviousPage: z.boolean().optional(),
    startCursor: z.string().nullable().optional(),
    endCursor: z.string().nullable().optional(),
  })
  .passthrough();

const twentyCompaniesResponseSchema = z
  .object({
    data: z
      .object({
        companies: z.array(twentyCompanySchema),
      })
      .passthrough(),
    totalCount: z.number().optional(),
    pageInfo: twentyPageInfoSchema.optional(),
  })
  .passthrough();

// ────────────────────────────────────────────────────────────────────────────
// Helper: sleep
// ────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: extract domain from Twenty domainName.primaryLinkUrl
//
// Twenty stores domain as a full URL (e.g. "https://acme.com" or
// "https://acme.com/path"). We extract just the hostname.
// ────────────────────────────────────────────────────────────────────────────

function extractDomain(primaryLinkUrl: string | null | undefined): string | undefined {
  if (!primaryLinkUrl || primaryLinkUrl.trim().length === 0) {
    return undefined;
  }
  try {
    const url = new URL(
      primaryLinkUrl.startsWith('http') ? primaryLinkUrl : `https://${primaryLinkUrl}`
    );
    return url.hostname || undefined;
  } catch {
    // If URL parsing fails, return the raw value stripped of protocol
    const stripped = primaryLinkUrl
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .trim();
    return stripped.length > 0 ? stripped : undefined;
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: fetch with timeout + retry (inlined — mirrors Affinity NOTE-2)
//
// Handles:
//   - Per-request AbortController timeout (cleared in finally)
//   - 429 backoff: exponential (no documented Twenty reset header)
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
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });
  } catch (networkErr) {
    clearTimeout(timer);
    // Network error or timeout abort — retry if budget allows
    if (attempt < MAX_RETRIES) {
      const backoffMs = BASE_BACKOFF_MS * 2 ** attempt;
      console.warn(
        `TwentyAdapter: network error on "${url}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${String(networkErr)}. Retrying in ${backoffMs}ms.`
      );
      await sleep(backoffMs);
      return fetchWithRetry(url, authHeader, attempt + 1);
    }
    throw new Error(
      `TwentyAdapter: network error after ${MAX_RETRIES + 1} attempts on "${url}": ${String(networkErr)}`
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
    // Twenty does not document a Retry-After or reset header — use exponential backoff
    const backoffMs = BASE_BACKOFF_MS * 2 ** attempt;
    console.warn(
      `TwentyAdapter: 429 rate-limited on "${url}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Backing off ${backoffMs}ms.`
    );
    await sleep(backoffMs);
    return fetchWithRetry(url, authHeader, attempt + 1);
  }

  // 5xx — transient server error
  if (response.status >= 500) {
    if (attempt < MAX_RETRIES) {
      const backoffMs = BASE_BACKOFF_MS * 2 ** attempt;
      console.warn(
        `TwentyAdapter: ${response.status} server error on "${url}" (attempt ${attempt + 1}/${MAX_RETRIES + 1}). Retrying in ${backoffMs}ms.`
      );
      await sleep(backoffMs);
      return fetchWithRetry(url, authHeader, attempt + 1);
    }
    const body = await response.text();
    return { ok: false, status: response.status, body };
  }

  // Non-2xx, non-429, non-5xx (e.g. 400, 401, 403, 404) — do not retry
  if (!response.ok) {
    const body = await response.text();
    return { ok: false, status: response.status, body };
  }

  // Success
  const data: unknown = await response.json();
  return { ok: true, data };
}

// ────────────────────────────────────────────────────────────────────────────
// Helper: normalize a single Twenty company (+ inline persons from depth=1)
// into a NormalizedSourceRecord.
// ────────────────────────────────────────────────────────────────────────────

function normalizeCompany(company: TwentyCompany): NormalizedSourceRecord {
  const domain = extractDomain(company.domainName?.primaryLinkUrl);

  const people = company.people ?? [];
  const contacts = people.map((p: TwentyPerson) => {
    const firstName = p.name?.firstName;
    const lastName = p.name?.lastName;
    const nameParts = [firstName, lastName].filter(
      (s): s is string => typeof s === 'string' && s.trim().length > 0
    );
    const name = nameParts.length > 0 ? nameParts.join(' ') : undefined;

    const email = p.emails?.primaryEmail ?? p.emails?.additionalEmails?.[0] ?? undefined;

    const title =
      typeof p.jobTitle === 'string' && p.jobTitle.trim().length > 0
        ? p.jobTitle.trim()
        : undefined;

    return { name, email, title };
  });

  return {
    sourceRecordId: company.id,
    name: company.name,
    ...(domain !== undefined ? { domain } : {}),
    contacts,
    raw: company as Record<string, unknown>,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// TwentyDataSourceAdapter
// ────────────────────────────────────────────────────────────────────────────

export class TwentyDataSourceAdapter implements DataSourceAdapter {
  readonly providerKey: string = TWENTY_PROVIDER_KEY;

  /**
   * fetchCompanies — fetches and normalizes all Twenty companies.
   *
   * Resolves:
   *   - TWENTY_API_KEY from process.env (Bearer auth)
   *   - TWENTY_BASE_URL from process.env (per-instance base URL)
   *
   * Both are read lazily inside fetchCompanies (NOT the constructor) for
   * boot-safety — mirrors Affinity adapter design.
   *
   * Graceful no-op: if EITHER key or URL is absent, logs a warning and
   * returns [] — the app boots and fixture/Affinity search still works.
   *
   * [SSRF guard]: https-validates TWENTY_BASE_URL before any HTTP call.
   * A non-https or malformed URL returns [] + warns.
   *
   * Algorithm:
   *   1. Read TWENTY_API_KEY + TWENTY_BASE_URL from env; bail with [] if
   *      either is absent.
   *   2. https-validate TWENTY_BASE_URL; bail with [] if invalid.
   *   3. Cursor-paginate GET /rest/companies?depth=1&limit=PAGE_SIZE
   *      (all pages via starting_after cursor loop).
   *      Boundary-Zod-validate each page response.
   *      Collect all companies; on page error → log + return partial results.
   *   4. Normalize each company + its inline people → NormalizedSourceRecord.
   *   5. [P2-a] safeParse each normalized record against normalizedSourceRecordSchema;
   *      skip + warn on failure.
   *   6. Return all valid records.
   *
   * The `connection` argument is used for interface compliance; credentials
   * come from env, not from the connection row.
   * (config schema dataSourceConnectionConfigSchema is UNTOUCHED — wave-16 boundary)
   */
  async fetchCompanies(_connection: DataSourceConnection): Promise<NormalizedSourceRecord[]> {
    // ── Step 1: Read env vars (lazy — NOT constructor) ───────────────────────
    const apiKey = process.env.TWENTY_API_KEY;
    if (!apiKey) {
      console.warn(
        'TwentyAdapter: TWENTY_API_KEY is not set. Skipping Twenty fetch — returning []. ' +
          'Set the key in Railway env vars (dealflow-api service) to enable Twenty sourcing.'
      );
      return [];
    }

    const baseUrl = process.env.TWENTY_BASE_URL;
    if (!baseUrl) {
      console.warn(
        'TwentyAdapter: TWENTY_BASE_URL is not set. Skipping Twenty fetch — returning []. ' +
          'Set the per-instance base URL in Railway env vars (dealflow-api service) to enable Twenty sourcing.'
      );
      return [];
    }

    // ── Step 2: https-validate TWENTY_BASE_URL (SSRF/misconfig guard) ────────
    let parsedBaseUrl: URL;
    try {
      parsedBaseUrl = new URL(baseUrl);
    } catch {
      console.warn(
        `TwentyAdapter: TWENTY_BASE_URL "${baseUrl}" is not a valid URL. Skipping Twenty fetch — returning [].`
      );
      return [];
    }

    if (parsedBaseUrl.protocol !== 'https:') {
      console.warn(
        `TwentyAdapter: TWENTY_BASE_URL "${baseUrl}" is not HTTPS (got "${parsedBaseUrl.protocol}"). ` +
          'Refusing to make HTTP call to non-HTTPS base URL. Returning []. ' +
          'Set TWENTY_BASE_URL to an https:// URL.'
      );
      return [];
    }

    const authHeader = `Bearer ${apiKey}`;
    // Strip trailing slashes to avoid double-slash in path construction
    const normalizedBase = baseUrl.replace(/\/+$/, '');
    const allCompanies: TwentyCompany[] = [];

    // ── Step 3: Cursor-paginate all company pages ─────────────────────────────
    let cursor: string | null | undefined;
    let pageNumber = 0;

    while (true) {
      pageNumber++;
      const url = new URL(`${normalizedBase}/rest/companies`);
      url.searchParams.set('limit', String(PAGE_SIZE));
      // depth=1 loads associated people inline — avoids per-company person round-trips
      url.searchParams.set('depth', '1');
      if (cursor) {
        url.searchParams.set('starting_after', cursor);
      }

      console.log(
        `TwentyAdapter: fetching company page ${pageNumber} (starting_after=${cursor ?? 'none'})`
      );

      let result: FetchResult;
      try {
        result = await fetchWithRetry(url.toString(), authHeader);
      } catch (err) {
        // Network failure exhausted retries — partial failure: return what we have
        console.error(
          `TwentyAdapter: page ${pageNumber} fetch failed after retries: ${String(err)}. Returning ${allCompanies.length} companies collected so far.`
        );
        break;
      }

      if (!result.ok) {
        console.error(
          `TwentyAdapter: page ${pageNumber} returned HTTP ${result.status}: ${result.body}. Returning ${allCompanies.length} companies collected so far.`
        );
        break;
      }

      // NOTE-3: Boundary-Zod-validate the page response
      const parsed = twentyCompaniesResponseSchema.safeParse(result.data);
      if (!parsed.success) {
        const issues = parsed.error.issues.map((i) => i.message).join('; ');
        console.error(
          `TwentyAdapter: page ${pageNumber} response failed Zod validation: ${issues}. Returning ${allCompanies.length} companies collected so far.`
        );
        break;
      }

      const { companies } = parsed.data.data;
      const pageInfo = parsed.data.pageInfo;

      allCompanies.push(...companies);

      console.log(
        `TwentyAdapter: page ${pageNumber} — ${companies.length} companies (total so far: ${allCompanies.length}). hasNextPage=${pageInfo?.hasNextPage ?? false} endCursor=${pageInfo?.endCursor ?? 'null (done)'}`
      );

      // Termination: hasNextPage=false OR endCursor is null/absent
      if (!pageInfo?.hasNextPage || pageInfo.endCursor == null) {
        break;
      }
      cursor = pageInfo.endCursor;
    }

    // ── Step 4 + 5: Normalize + [P2-a] output-validate ───────────────────────
    const records: NormalizedSourceRecord[] = [];

    for (const company of allCompanies) {
      const normalized = normalizeCompany(company);

      // [P2-a FOLD] safeParse the normalized output against normalizedSourceRecordSchema
      // This closes the wave-30 Affinity gap — fixture.adapter.ts:85 pattern.
      const outputValidation = normalizedSourceRecordSchema.safeParse(normalized);
      if (!outputValidation.success) {
        const issues = outputValidation.error.issues.map((i) => i.message).join('; ');
        console.warn(
          `TwentyAdapter: normalized record for company "${company.id}" failed output schema validation: ${issues}. Skipping.`
        );
        continue;
      }

      records.push(outputValidation.data);
    }

    console.log(`TwentyAdapter: fetchCompanies complete — returning ${records.length} records.`);
    return records;
  }
}
