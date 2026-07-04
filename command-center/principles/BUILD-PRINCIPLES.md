# Build Principles — <Your Project>

Cross-wave build / implementation / code-conventions rules promoted from L-2 distill. Append-only; numbered sequentially. Read at every B-block stage.

---

## Contract for new rules

Format (deterministic; karen + L-2 linter reject anything that doesn't match):

```
N. <one-line declarative rule, ≤120 chars, ending in a period>
   Why: <one-line causal explanation, ≤100 chars, ending in a period>
```

Hard limits: rule line ≤ 120 chars; why line ≤ 100 chars; entry = exactly 2 non-empty lines.

Forbidden tokens (rule or why line, case-insensitive): `we`, `our`, `the team`, `during wave-`, `wave-<N>`, `because ... because`, em-dash (`—`), any parenthetical longer than ~5 words.

### GOOD

```
4. Never mock the database in integration tests.
   Why: A passing mock that doesn't match prod schema masks broken migrations.
```

### REJECTED — multi-clause prose

```
4. We've found that mocking the database, while convenient, can sometimes lead
to issues during integration testing because the mock might not accurately
reflect the production schema, especially after migrations...
```

Reasons: prose voice (`We've found`), runs > 1 line, hedging (`can sometimes`), war-story preamble.

### REJECTED — wave reference

```
4. After wave-7's auth bug, always validate session tokens at the edge.
```

Reason: cites a wave; rules outlive the wave they were learned from.

### REJECTED — non-falsifiable

```
4. Write good error messages.
```

Reason: not falsifiable; can't be checked by any subsequent reviewer.

### Authoring discipline

- Before adding: grep for the concept; do not add a near-dup.
- Number sequentially; renumber on insert.
- Group under an existing H2 unless ≥3 new rules share a theme.
- Wave-specific ("broke once") stays in `process/waves/wave-<N>/blocks/L/observations.md` until a second wave confirms.

---

## Promotion path

Promoted at L-2 Distill from `process/waves/wave-<N>/blocks/L/observations.md` by `karen` (rule-quality vetter) when an observation appears across 2+ waves AND head-builder approves. Maximum 1 rule promoted per wave per file (cap is per-file, not per-wave — multiple principles files may each receive one). See `claudomat-brain/blocks/learn/stages/L-2-distill.md`.

---

## Rules

1. Resolve transitive high-severity audit advisories via pnpm-workspace.yaml overrides, not package.json.
   Why: In pnpm 10+ the overrides key lives in pnpm-workspace.yaml, not package.json.
2. When a NestJS guard injects a repository, that repository must be exported by every module that imports the guard.
   Why: NestJS DI resolves constructor tokens at the consuming module boundary, not where defined.
3. Never use `import type` for a class that is constructor-injected into a NestJS provider.
   Why: import type is erased at emit, so the DI token vanishes and NestJS bootstrap crashes.
4. Any hand-authored drizzle migration must appear in `_journal.json` with a `when` greater than all prior entries.
   Why: drizzle skips a migration with a missing or stale `when` while reporting success.
5. Author every client parse of an API response against that endpoint's real return shape, not an assumed wrapper.
   Why: A wrong-shape mock passes CI while the live client mis-parses ids and raises false errors.
