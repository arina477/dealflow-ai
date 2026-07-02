# T-7 — Perf

> **Block:** T (Test), 5th of 8 in wave loop: `P → [D] → B → C → ` **`T`** ` → V → L → N`.
> **Stages:** T-1 → T-2 → T-3 → T-4 → T-5 → T-6 → **T-7** → T-8 → T-9 (gate). Advance on stage exit: T-8.
> **Pattern:** gate-only. head-tester spawned at T-9 for verdict; reference card on demand at `~/.claude/agents/head-tester.md`.
> **Dispatcher** (skip rules, layered cascade, gate semantics, exit handoff): `claudomat-brain/blocks/test/test.md`.

## Purpose

Measure Core Web Vitals, bundle size, and request-path latency for the deployed wave. Catches performance regressions before they reach real users — a regressed LCP is paid by every visitor, indefinitely.

## Pattern

**B — Active-execution.**

## Prerequisites

- T-6 exited (or T-5 if T-6 skipped for non-UI wave).
- READ `command-center/principles/test-layer-principles/T-7.md` for project's perf budgets.
- READ `process/waves/wave-<N>/stages/C-2-deploy-and-verify.md` for prod URL.

## Skip condition

Skip unless `wave_type` includes `heavy`, OR the wave's diff touches a known perf-sensitive area (declared in T-7 principles: critical render path, bundle-bloat-prone routes, hot DB queries, etc.). Deliverable records wave_type and reasoning.

For projects without T-7 principles file: apply judgment — skip on small diffs to non-render-path code; fire on any diff touching `app/`, `src/components/`, public API endpoints, or DB query layer.

## Actions

### Action 1 — Bundle size diff

Run the project's bundle-size tool (e.g., `next build` analyze, `vite build --mode analyze`, `webpack-bundle-analyzer`) against `main` HEAD (post-merge). Compare against pre-wave baseline (last ROADMAP-archived bundle report, OR prior wave's T-7 deliverable).

Findings:
- Per-route bundle delta > +10KB → finding.
- Per-package bundle delta > +5KB → finding.
- New dependency contributing > 50KB → critical finding (route for dep audit).

### Action 2 — Core Web Vitals probe

For each route in T-7 principles' `routes_to_probe` list (or wave's primary user routes if no list exists), run a Lighthouse CLI probe:

```
lighthouse <prod-url>/<route> --only-categories=performance --output=json --output-path=process/waves/wave-<N>/stages/T-7-lh-<route>.json
```

Extract: LCP, FID/INP, CLS, TBT, Speed Index.

Compare against perf budgets in T-7 principles. Default budgets if not declared:
- LCP < 2.5s
- INP < 200ms
- CLS < 0.1
- TBT < 200ms

Any metric over budget → finding.

### Action 3 — Request-path latency probe

For each new API endpoint introduced at B-2:

```
hyperfine --warmup 3 --runs 20 'curl -fsS <prod-url>/<endpoint>'
```

Extract p50, p95, p99. Compare against project SLOs (declared in T-7 principles) or sane defaults: p95 < 500ms for read endpoints, < 1s for write endpoints.

### Action 4 — Heavy-wave specific probes

If `wave_type: heavy` is set:
- Run a load-test probe (e.g., `k6`, `wrk`) at modest concurrency (10 RPS for 60s) against new endpoints. Verify no latency cliff.
- Capture memory + CPU during load test if deploy platform exposes it (Railway metrics, Vercel observability).

Skip these for non-heavy waves.

### Action 5 — Triage regressions

For each over-budget metric, classify:
- **Critical (>2x budget OR introduces new latency cliff)** → re-enter B-2 or B-3 for optimization; cap at 3 cycles.
- **Significant (over budget but <2x)** → V-2 decides blocking vs `bug-perf` tag.
- **Within budget but degrading trend** → record for `command-center/principles/test-layer-principles/T-7.md` distillation.

## Deliverable

`process/waves/wave-<N>/stages/T-7-perf.md` — records bundle diff, vitals per route, latency per endpoint, heavy-wave probes, fix-up cycle log, plus YAML footer.

```yaml
test_pattern: active
skipped: false
bundle_delta: {per_route: [...], per_package: [...]}
vitals: [{route, lcp, inp, cls, tbt}]
api_latency: [{endpoint, p50, p95, p99}]
heavy_wave_probes: {load_test: ..., memory_cpu: ...}    # null if not heavy
fix_up_cycles: 0
findings:
  - {severity, metric, value, budget, description}
```

## Exit criteria

- Bundle diff captured.
- Vitals + latency probed per Actions 2 + 3.
- Heavy-wave probes ran (if applicable).
- Critical regressions resolved.
- `process/waves/wave-<N>/checklist.md` T-7 row checked.

## Next

→ `claudomat-brain/blocks/test/test.md` → T-8.
