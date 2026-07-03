# Wave 3 — T-1 Static (Pattern A, CI-verified)
- CI green (all merges incl. 935b847): lint (biome, 0 err) + typecheck (tsc strict) pass.
- Bypasses (wave-3 diff): test-fixture `as unknown as {AuthRepository,ExecutionContext,Reflector}` (guard/RBAC test mocks — LOW, test-only) + `X as unknown as LucideIcon` icon-map casts in AppShell (Sidebar/NavItem — lucide-react type coercion, LOW production, common pattern). No @ts-ignore. Non-blocking.
```yaml
mask_mode_signoff: PASS
test_pattern: ci-verified
findings:
  - {severity: low, location: "AppShell icon map", description: "as-unknown-as LucideIcon coercion (lucide-react typing, common)"}
  - {severity: low, location: "*.spec.ts", description: "as-unknown-as test mocks (fixtures)"}
ts_bypasses_in_wave_diff: "test-fixtures + icon-map (all low)"
```
