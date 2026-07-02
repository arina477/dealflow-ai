# T — Test Block Dispatcher

**Purpose.** Per-layer testing of the deployed wave. Each layer (static, unit, contract, integration, E2E, layout, perf, security, journey) gets its own stage with discipline, skip conditions, reviewer expectations.

**When it runs.** Every wave, after C-2 (deploy & verify) confirms merge commit live. The canary phase within C-2 runs asynchronously; T does NOT wait on canary.

## Stage sequence

```
T-1 ∥ T-2 → T-3 ∥ T-4 → T-5 → T-6 → T-7 → T-8 → T-9 → exit
```

Two parallel bands at the front of the block:

- **Fast-tier (T-1 ∥ T-2)** — both Pattern A (CI-verified), both read C-1's `verdict_evidence` independently. T-1 Action 0 (manifest seed) runs first; once the manifest exists, T-1 Actions 1–4 and T-2 Actions 1–4 spawn concurrently.
- **Contract+integration tier (T-3 ∥ T-4)** — both Pattern A (CI-verified) typically, both read C-1 evidence independently. T-3 reads B-1 contracts; T-4 reads B-0 schema + B-2 backend. Neither produces output the other consumes.

T-5 hard-depends on T-3 AND T-4 both exiting (it's the first active-execution stage hitting deployed prod, so it pays to wait for the cheap CI-verified tier to finish first).

| Stage | File | Layer | When to fire |
|---|---|---|---|
| **T-1** | `stages/T-1-static.md` | Typecheck + lint | Every wave (verified via C-1 green) |
| **T-2** | `stages/T-2-unit.md` | Pure-function + module tests | Every wave with code changes (verified via C-1 green) |
| **T-3** | `stages/T-3-contract.md` | API/SDK contract tests | Waves touching APIs/SDKs |
| **T-4** | `stages/T-4-integration.md` | DB + service + API integration | Waves touching schema or services |
| **T-5** | `stages/T-5-e2e.md` | Playwright tester swarm | Every wave with user-visible behavior |
| **T-6** | `stages/T-6-layout.md` | Visual regression / layout diff | UI waves only |
| **T-7** | `stages/T-7-perf.md` | Core Web Vitals, bundle size | Heavy waves only |
| **T-8** | `stages/T-8-security.md` | Auth smoke, CSRF, session, rate-limit | Auth/payments/sessions waves only |
| **T-9** | `stages/T-9-journey.md` | user-journey-map regen + scenario smoke; block-exit gate | Every wave |

## Deliverable footer (every T-stage)

```yaml
test_pattern: ci-verified | active
evidence:
  - <CI run reference, log link, screenshot path, or probe output>
findings: []                          # regressions / coverage gaps
```

Findings recorded in deliverable AND aggregated into `process/waves/wave-<N>/blocks/T/findings-aggregate.md` as the block runs.

## Block-level skip rules

T-block **never skips** — every wave runs at minimum T-1, T-2, T-9.

| Stage | Skip when |
|---|---|
| T-1 | Never |
| T-2 | No code changes (doc-only wave) |
| T-3 | No API / SDK / contract surface changes |
| T-4 | No schema / service changes |
| T-5 | No user-visible behavior changes |
| T-6 | Non-UI wave (`wave_type ≠ ui`) |
| T-7 | Not a heavy wave (skip unless `wave_type == heavy` or perf budget at risk) |
| T-8 | Non-auth / non-payments / non-session wave |
| T-9 | Never |

`wave_type` declared on the spec contract at P-1. Skip rules use OR logic on the type set.

## Parallelization — sibling stage bands

Two bands of independent stages run concurrently. Both bands consume C-1 evidence independently and write to separate deliverable files + separate principles lanes.

### Fast-tier band (T-1 ∥ T-2)

T-1 (typecheck + lint) and T-2 (unit tests) run concurrently. Per-stage skip rules still apply — T-1 never skips, T-2 skips on doc-only waves; the dispatcher fires T-2 only when its own skip rule says fire.

**Sequencing constraint.** T-1 Action 0 (block-entry: seed `process/waves/wave-<N>/blocks/T/review-artifacts.md` and create empty findings-aggregate) runs first and sequentially — T-2's deliverable updates the manifest's T-2 row, so the manifest must exist before T-2 starts. Once Action 0 completes, the orchestrator spawns T-1 Actions 1–4 ∥ T-2 Actions 1–4 in a single message. Both finish before T-3 / T-4 band enters.

### Contract+integration band (T-3 ∥ T-4)

T-3 (API/SDK contract tests) and T-4 (DB + service + integration tests) run concurrently. Both Pattern A typically; either may flip to Pattern B when CI doesn't cover that layer. Skip rules independent — T-3 fires when wave touches APIs/SDKs, T-4 fires when wave touches schema/services.

**Sequencing constraint.** T-3 and T-4 both depend only on the fast-tier band having exited — they read C-1 evidence + their own B-block source files (B-1 for T-3, B-0 + B-2 for T-4). Orchestrator spawns both in a single message. Both finish before T-5 enters.

### T-5 hard-dependency

T-5 lists "T-1 AND T-2 AND T-3 AND T-4 exited" in its prerequisites — neither fires before all four pre-active-execution stages complete.

### Findings aggregation

All parallel stages append to `findings-aggregate.md`. Append-only writes from independent processes don't conflict in practice (each stage owns its prefix); orchestrator audits the file once each band returns.

## Two execution patterns

Each stage file declares pattern in `Prerequisites`.

### Pattern A — Verified-via-CI (T-1, T-2, T-3, T-4 when fully covered by CI)

Do NOT re-execute tests. CI ran them at C-1; the C-1 PR & CI verdict is authoritative. T's job:
1. Confirm CI run for merge commit included this layer.
2. Audit coverage adequacy.
3. Document the layer's discipline.

### Pattern B — Active-execution (T-5, T-6, T-7, T-8, T-9, plus T-3/T-4 when CI doesn't cover)

Run tests against deployed prod state — Playwright swarms, layout diffs, perf probes, security probes, user-flow regen. Requires the live deploy.

## Wave-type classification

`wave_type` values (set at P-1, multi-valued):

- **`backend`** — API + service + schema only
- **`ui`** — frontend + design surface
- **`auth`** — authentication, sessions, payments, secrets
- **`heavy`** — large diff, performance-sensitive, or first wave of a new module
- **`infra`** — deployment, CI, monitoring
- **`docs`** — markdown / config only

## Findings pipeline → V-2

T-block does NOT decide which findings block. Surface findings with evidence; V-2 classifies each as blocking (re-enter B), non-blocking (`bug-design` / `bug-perf` / `bug-security` tags in `tasks.description`), or noise.

Aggregate at `process/waves/wave-<N>/blocks/T/findings-aggregate.md` is V-2's canonical input.

## Block exit / handoff

```yaml
test_block_status:    complete
stages_run:           [list]
stages_skipped:       [list with reason]
findings_total:       <count>
findings_critical:    <count>
findings_evidence_dir: process/waves/wave-<N>/stages/
findings_aggregate:   process/waves/wave-<N>/blocks/T/findings-aggregate.md
ready_for_verify:     true
```

→ next block: `claudomat-brain/blocks/verify/verify.md`

## References

- Spec contract — `process/waves/wave-<N>/stages/P-2-spec.md` (T-1 entry, for wave_type)
- Plan — `process/waves/wave-<N>/stages/P-3-plan.md` (active-execution stages)
- C-1 verdict — `process/waves/wave-<N>/stages/C-1-pr-ci-merge.md` (T-1..T-4 for CI evidence)
- User journey — `command-center/artifacts/user-journey-map.md` (T-9)
- Test-writing principles — `command-center/testing/test-writing-principles.md`
- Block principles — `command-center/principles/test-layer-principles/T-<N>.md`
- Triage routing — `command-center/dev/triage-routing-table.md`
- Mode routing — `claudomat-brain/management/<mode>-mode.md`
- Path conventions — `claudomat-brain/process/process-paths.md`
