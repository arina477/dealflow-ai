import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts', 'test/**/*.{spec,test,e2e-spec}.ts'],
    alias: {
      '@dealflow/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
