import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    // Use the React 19 automatic JSX runtime so test files don't need
    // `import React from 'react'` and page.tsx JSX compiles correctly.
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    globals: false,
    environment: 'jsdom',
    // NODE_ENV=test ensures React loads its development build which exposes
    // React.act — required by @testing-library/react 16.
    env: { NODE_ENV: 'test' },
    include: ['app/**/*.{spec,test}.{ts,tsx}', 'src/**/*.{spec,test}.{ts,tsx}'],
    alias: {
      '@dealflow/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
    setupFiles: ['./vitest.setup.ts'],
  },
});
