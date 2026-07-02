/**
 * NestJS DI provider for the Drizzle database handle (wave-2).
 *
 * Wave-1 exposes a module-level singleton `db` in src/db/index.ts (used by the
 * health check). The auth module needs the same handle via constructor
 * injection so the repository is unit-testable with a mock. This provider wraps
 * the existing singleton behind an injection token — it does NOT open a second
 * pool.
 */

import type { Provider } from '@nestjs/common';

import { db } from './index';

export type Database = typeof db;

/** Injection token for the Drizzle database handle. */
export const DB = Symbol('DB');

export const dbProvider: Provider = {
  provide: DB,
  useValue: db,
};
