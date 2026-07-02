import { defineConfig } from 'drizzle-kit';

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL is required for drizzle-kit commands');
}

export default defineConfig({
  dialect: 'postgresql',
  // Δ5 wave-2: repointed from flat ./src/db/schema.ts to per-module index.
  // All tables in src/db/schema/*.ts are re-exported via index.ts.
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  dbCredentials: {
    url: process.env['DATABASE_URL'],
  },
});
