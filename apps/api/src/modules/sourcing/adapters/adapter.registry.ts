/**
 * AdapterRegistry — resolves a provider_key to the matching DataSourceAdapter
 * instance.
 *
 * The registry is a simple map from provider_key (case-insensitive) to adapter.
 * At module init, the sourcing module registers the FixtureDataSourceAdapter
 * under 'FIXTURE'. Real provider adapters (Grata / Cyndx / etc.) will be
 * registered when their M3 bundle lands.
 *
 * This is NOT a NestJS @Injectable — it is a plain TypeScript class that the
 * SourcingModule instantiates once and injects as a DI value token, keeping
 * it testable without NestJS overhead.
 *
 * Error behaviour:
 *   getAdapter(providerKey) returns null when no adapter is registered for that
 *   key. Callers (IngestionService) should surface this as a 400/clean error
 *   rather than throw — a missing adapter is a misconfigured connection, not a
 *   crash.
 */

import type { DataSourceAdapter } from '@dealflow/shared';
import { AffinityDataSourceAdapter } from './affinity.adapter';
import { FIXTURE_PROVIDER_KEY, FixtureDataSourceAdapter } from './fixture.adapter';

export const ADAPTER_REGISTRY = Symbol('ADAPTER_REGISTRY');

export class AdapterRegistry {
  private readonly adapters: Map<string, DataSourceAdapter> = new Map();

  /**
   * register — adds an adapter to the registry under its providerKey
   * (uppercased for case-insensitive lookup).
   */
  register(adapter: DataSourceAdapter): void {
    this.adapters.set(adapter.providerKey.toUpperCase(), adapter);
  }

  /**
   * getAdapter — returns the adapter for the given providerKey, or null if
   * none is registered. Lookup is case-insensitive.
   */
  getAdapter(providerKey: string): DataSourceAdapter | null {
    return this.adapters.get(providerKey.toUpperCase()) ?? null;
  }

  /** List all registered provider keys (for diagnostics). */
  registeredKeys(): string[] {
    return Array.from(this.adapters.keys());
  }
}

/**
 * createDefaultRegistry — factory that builds the registry pre-populated with
 * the FixtureDataSourceAdapter. Called once in SourcingModule.
 */
export function createDefaultRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new FixtureDataSourceAdapter());
  registry.register(new AffinityDataSourceAdapter());
  return registry;
}

/**
 * Re-export FIXTURE_PROVIDER_KEY so callers can reference the fixture key
 * without importing the adapter directly.
 */
export { FIXTURE_PROVIDER_KEY };
