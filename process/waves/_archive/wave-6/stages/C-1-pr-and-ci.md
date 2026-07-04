# Wave 6 — C-1 PR & CI
- Branch wave-6-deal-sourcing → main ff-merge; then 3 C-2 fix branches (sourcing-di-fix 96179b0, fixture-asset-fix 918dbf0). main @ 918dbf0.
- CI (run 28691019428 @ 918dbf0): GREEN all 5.
```yaml
ci_verdict: PASS
merge: fast-forward-to-main
sha: 918dbf0
fix_cycles: [96179b0 (import-type DI boot), 918dbf0 (fixture-asset-copy)]
jobs_green: [lint, typecheck, test, build, audit]
```
