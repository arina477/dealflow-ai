# Wave 2 — T-1 Static (Pattern A, CI-verified)
- CI final green run (PR #4 → merge ab23d4c): lint pass, typecheck pass (tsc strict + noUncheckedIndexedAccess). Also green on PR #3 (4e09807) + PR #2.
- Coverage: whole auth surface under Biome + tsc; strict from day one.
- Bypass grep (wave diff, non-test): none in production code. 1 LOW in a TEST fixture — `apps/api/src/modules/auth/auth.di-boot.spec.ts` `} as unknown as AuthRepository` (a deliberate mock for the DI-metadata assertion). Non-blocking.
```yaml
mask_mode_signoff: PASS
test_pattern: ci-verified
evidence: ["PR#4 run 28610846423 lint+typecheck green on ab23d4c"]
findings:
  - {severity: low, location: "auth.di-boot.spec.ts", description: "as-unknown-as AuthRepository mock (test fixture)"}
ts_bypasses_in_wave_diff: 1
```
