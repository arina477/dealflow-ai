# Wave 1 — T-1 Static

**Pattern:** A (verified-via-CI). Typecheck + lint were executed by CI at C-1; T-1 audits coverage, does not re-run.

## CI evidence (merge commit)
- CI run `28595065716`, SHA `feeb7ad6479683782b2bfbdab7261bf2dc758c57` == PR #1 head (no Ghost Green); merge commit `4cad0179…`.
- `lint` job: **pass** (Biome, `preset: recommended`).
- `typecheck` job `84788225571`: **pass** (TypeScript `strict: true`, `noUncheckedIndexedAccess: true` in `tsconfig.base.json`).

## Coverage audit
- Static analysis covers the whole wave surface: all authored code is `.ts`/`.tsx` under Biome + tsc; no un-linted file types introduced.
- Strictness is high from day one (`strict`, `noUncheckedIndexedAccess`) — no loose baseline to tighten later.

## Bypass grep (`git grep` over tracked `*.ts`/`*.tsx`)
2 bypasses, both in **test fixtures** (not production code):
- `apps/api/test/health.e2e-spec.ts:59` — `let app: any;` (Nest test app handle).
- `apps/web/app/page.test.tsx:39` — `as unknown as Response` (mocked `fetch` return).
Both LOW severity, non-blocking; typed test-harness helpers would remove them (T-1 discipline note for later).

## Discipline note (→ T-1 principles at L-2)
- Consider a typed Nest e2e app helper (`INestApplication`) to drop `any` in e2e specs.
- No production-code bypasses — good baseline.

```yaml
mask_mode_signoff: PASS
signoff_note: ""
test_pattern: ci-verified
evidence:
  - "C-1 lint job: run 28595065716 green (Biome recommended)"
  - "C-1 typecheck job: 84788225571 green (tsc strict + noUncheckedIndexedAccess)"
findings:
  - {severity: low, location: "apps/api/test/health.e2e-spec.ts:59", description: "any-typed test app handle (test fixture)"}
  - {severity: low, location: "apps/web/app/page.test.tsx:39", description: "as-unknown-as-Response mock cast (test fixture)"}
ts_bypasses_in_wave_diff: 2
```
