3. Never use `import type` for a class that is constructor-injected into a NestJS provider.
   Why: import type is erased at emit, so the DI token vanishes and NestJS bootstrap crashes.
