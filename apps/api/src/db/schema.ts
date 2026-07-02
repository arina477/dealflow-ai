/**
 * Stable re-export shim for existing importers (e.g. apps/api/src/db/index.ts).
 * The canonical schema now lives under src/db/schema/ (per-module files).
 * Δ5 wave-2: flat schema.ts → src/db/schema/<module>.ts layout per _library.md §4.
 */
export * from './schema/index';
