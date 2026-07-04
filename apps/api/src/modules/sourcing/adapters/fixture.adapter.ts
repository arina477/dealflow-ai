/**
 * FixtureDataSourceAdapter — a DataSourceAdapter that reads from a bundled
 * JSON fixture dataset. Used for local-dev + CI when no real provider SDK is
 * available. Real provider adapters will implement the same DataSourceAdapter
 * interface and replace this in the AdapterRegistry.
 *
 * FIXTURE DATASET REQUIREMENT:
 *   The bundled companies.fixture.json MUST contain cross-source duplicates —
 *   records that, when normalized, resolve to the same domain from two separate
 *   connections. This is how the dedupe merge path gets exercised in tests
 *   (P-0 watch-item / P-4 AC). The fixture registers under provider_key
 *   'FIXTURE' (no env credential required).
 *
 * SECRETS:
 *   The fixture adapter requires no credential. The DataSourceAdapter contract
 *   establishes the env-by-providerKey pattern for real adapters; fixture simply
 *   ignores it, documenting that env resolution is the real-adapter concern.
 *
 * NO new external dependency: bundled JSON imported via fs.readFileSync (Node
 * built-in) — the plan's zero-new-dep constraint holds.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  DataSourceAdapter,
  DataSourceConnection,
  NormalizedSourceRecord,
} from '@dealflow/shared';
import { normalizedSourceRecordSchema } from '@dealflow/shared';

/** provider_key value for the fixture adapter (case-insensitive comparison in registry). */
export const FIXTURE_PROVIDER_KEY = 'FIXTURE';

/**
 * FixtureDataSourceAdapter — reads the bundled companies.fixture.json.
 *
 * Cross-source dedup design:
 *   The fixture dataset deliberately contains two records (sourceRecordId
 *   "grata-001" and "grata-005") that, after normalization, resolve to the same
 *   normalized domain ("acme.com"). When two separate data_source_connections
 *   both use this fixture adapter, their respective upserts will produce two
 *   raw_companies rows sharing the same normalized_domain — exercising the
 *   cross-source dedup merge path in the DedupeEngine.
 */
export class FixtureDataSourceAdapter implements DataSourceAdapter {
  readonly providerKey: string = FIXTURE_PROVIDER_KEY;

  private readonly fixturePath: string;

  constructor(fixturePath?: string) {
    this.fixturePath = fixturePath ?? join(__dirname, '..', 'fixtures', 'companies.fixture.json');
  }

  /**
   * fetchCompanies — reads the bundled JSON fixture and validates each record
   * against the shared NormalizedSourceRecord Zod schema.
   *
   * Validation ensures fixture data matches the contract the ETL expects.
   * Invalid records are skipped with a console warning (never crash on fixture
   * data — a CI fixture parse failure is louder than a skipped record).
   *
   * The `connection` argument is accepted for interface compliance but unused;
   * the fixture is provider-agnostic.
   */
  async fetchCompanies(_connection: DataSourceConnection): Promise<NormalizedSourceRecord[]> {
    let rawJson: unknown;
    try {
      const content = readFileSync(this.fixturePath, 'utf-8');
      rawJson = JSON.parse(content) as unknown;
    } catch (err) {
      throw new Error(
        `FixtureDataSourceAdapter: failed to read fixture at "${this.fixturePath}": ${String(err)}`
      );
    }

    if (!Array.isArray(rawJson)) {
      throw new Error(
        `FixtureDataSourceAdapter: fixture root must be a JSON array, got ${typeof rawJson}`
      );
    }

    const records: NormalizedSourceRecord[] = [];
    for (const item of rawJson) {
      const result = normalizedSourceRecordSchema.safeParse(item);
      if (result.success) {
        // Embed the validated record as its own `raw` payload (the ETL stores
        // this verbatim in raw_companies.raw for lineage). We exclude `raw`
        // itself from the re-embedded payload to avoid infinite nesting.
        const { raw: _existingRaw, ...rest } = result.data;
        records.push({
          ...result.data,
          raw: rest as Record<string, unknown>,
        });
      } else {
        const errorMessages = result.error.issues.map((i) => i.message).join('; ');
        console.warn(`FixtureDataSourceAdapter: skipping invalid record: ${errorMessages}`);
      }
    }

    return records;
  }
}
