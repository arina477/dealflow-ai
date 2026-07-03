2. When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard.
   Why: NestJS DI resolves constructor tokens at the consuming module boundary, not where defined.
