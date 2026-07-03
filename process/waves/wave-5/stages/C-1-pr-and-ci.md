# Wave 5 — C-1 PR & CI
- Branch wave-5-compliance-gate → main ff-merge. CI initially FAILED (web test: require('@dealflow/shared') bypassed vitest ESM alias → hit gitignored/unbuilt dist in CI) → fixed a58b699 (require→aliased import). Then actor-id FK fix ce97423. main @ ce97423.
- CI (run 28684486202 @ ce97423): GREEN all 5.
```yaml
ci_verdict: PASS
merge: fast-forward-to-main
ci_run: 28684486202
sha: ce97423
fix_cycles: [a58b699 (CI dist-resolution), ce97423 (actor-id FK)]
jobs_green: [lint, typecheck, test, build, audit]
```
