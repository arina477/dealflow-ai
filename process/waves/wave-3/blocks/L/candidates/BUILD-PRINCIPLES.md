1. Resolve transitive high-severity audit advisories via pnpm-workspace.yaml overrides, not package.json.
   Why: In pnpm 10+ the overrides key lives in pnpm-workspace.yaml, not package.json.
