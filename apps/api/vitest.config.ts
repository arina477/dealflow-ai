import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // Enable emitDecoratorMetadata so NestJS DI metadata assertions work in tests.
    // Without this, vitest's default esbuild transform strips design:paramtypes,
    // making `import type` DI-injection bugs invisible until the compiled app boots.
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { decoratorMetadata: true },
      },
    }),
  ],
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.{spec,test}.ts', 'test/**/*.{spec,test,e2e-spec}.ts'],
    alias: {
      '@dealflow/shared': new URL('../../packages/shared/src/index.ts', import.meta.url).pathname,
    },
  },
});
