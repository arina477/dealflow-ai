# DISPATCHER — Wave Sequencer

This file owns one thing: the order blocks run in. Stage-level decisions live in each block's dispatcher; per-stage actions live in the stage file.

**Three-level dispatch:**

1. **DISPATCHER.md** (this file) — block sequence + index.
2. **`blocks/<X>/<X>.md`** — stage sequence within the block, skip rules, gate semantics.
3. **`blocks/<X>/stages/<X-N>.md`** — actions for the stage.

Read all three before entering any stage. No file read = no instructions = do not proceed.

---

## Block sequence (per wave)

```
P → [D if UI wave] → B → C → T → V → L → N → loop to next wave's P-0
```

`D` runs only when `P-1 Decompose` flags `design_gap_flag: true`. Block dispatcher (`blocks/design/design.md`) owns the skip decision; this dispatcher only enforces order.

---

## How to use this loop

0. **Session start: read `process/session/.last-wave-completed.yaml`** — orchestrator's anchor across sessions. Records last completed wave, next wave's seed, `loop_state: ready | install-pending | paused`. Routing per state:

   | `loop_state` | Action |
   |---|---|
   | (file absent) | Greenfield. Run onboarding from `claudomat-brain/onboarding/onboarding-loop.md` v0. Onboarding creates this file at v13. |
   | `install-pending` | **Wave loop is NOT open.** v11 audited install gaps; v12 must execute the delta; v13 must verify and flip to `ready`. Re-enter onboarding at the appropriate v11 / v12 / v13 stage per the existing `process/session/onboarding/` deliverables. NEVER enter the wave loop in this state — wave-1 will start with an incomplete agent catalog. |
   | `ready` | Wave loop is open. **Preflight check:** (a) refresh capability sheet — run `claudomat capabilities` if `process/session/.capability-sheet.md` is missing OR mtime > 60min; (b) run `claudomat doctor` (non-strict). On any `[FAIL]`, halt and route to install.md for the failing phase — do not enter the wave loop. On clean: identify the current block from the next wave's checklist (`process/waves/wave-<N+1>/checklist.md`) and proceed below. |
   | `paused` | Wait for founder prompt or scheduled wake. |

   **Resume-mailbox check (before any routing).** After reading `.last-wave-completed.yaml`, read `process/session/.loop-resume.yaml`. The presence of this file is the sole trigger for the consume — **do NOT gate it on `.loop-paused.yaml` still existing or on `STATUS` still being `BLOCKED`.** If `.loop-resume.yaml` exists, a turn was dispatched precisely to consume it: route to the active mode file's § Resume protocol step "Resolve from `.loop-resume.yaml`" (`claudomat-brain/management/<mode>-mode.md`) **regardless of `loop_state` / `STATUS`** — the worker (sole writer; brain is sole reader + deleter) wrote it to resolve a founder-reserved `.loop-paused.yaml` pause. The worker may have already pre-cleared the pause before dispatching this turn (removed `.loop-paused.yaml` + flipped `STATUS: RUNNING` per the worker-clears-pause contract in `claudomat-brain/process/process-paths.md` § Named files), so even a watchdog generic-revive that finds `STATUS: RUNNING` must still route here whenever `.loop-resume.yaml` is present. That step maps `choice.kind` → promote milestone / drain the unassigned queue / founder-direct, sets `STATUS: RUNNING` (no-op if already RUNNING), opens the next wave, and deletes `.loop-resume.yaml` (and `.loop-paused.yaml` if still present). Do not pause again on the still-present `.loop-paused.yaml` while a resume is in flight (see `claudomat-brain/CLAUDE.md` rule #13 precedence).

   **Mid-block resume.** If the active wave's checklist shows a non-headless block (P / D / B / T / V) partially complete (block-entry stage checked, gate stage unchecked), re-load `~/.claude/agents/head-<X>.md` before resuming the active stage. The mask is in-context state, lost across sessions; the manifest at `process/waves/wave-<N>/blocks/<X>/review-artifacts.md` is the persistent state.

   **Recovery from `install-pending` mid-wave drift.** If `loop_state: ready` but `claudomat doctor` reports FAIL during the preflight (e.g., founder uninstalled a CLI, MCP config drifted), set `loop_state: install-pending` immediately, halt the wave loop, and route to install.md / onboarding v11 to re-audit. Do not attempt to recover via `/investigate` — install gaps are runbook territory, not orchestrator-fix territory.

   **Path conventions:** every artifact path follows `claudomat-brain/process/process-paths.md`.
1. Identify the current block from the sequence above.
2. Read `blocks/<X>/<X>.md` for the block's stage sequence, skip rules, and gate semantics.
3. Read `blocks/<X>/stages/<X-N>.md` for stage actions.
4. Execute. On stage exit, advance per the block dispatcher.
5. On block exit, advance to the next block per this file.
6. After `N-3 Handoff`, increment the wave number and re-enter at `P-0`.

---

## Block index

| Block | Dispatcher | Purpose |
|---|---|---|
| **P** — Product | `blocks/product/product.md` | Frame (discover + reframe) → decompose → spec → plan → gate |
| **D** — Design | `blocks/design/design.md` | Brief → variants (with bounded iteration) → review & adopt (conditional) |
| **B** — Build | `blocks/build/build.md` | Branch & schema → contracts → backend → frontend → wiring → verify → review |
| **C** — CI/CD | `blocks/ci-cd/ci-cd.md` | PR & CI & merge → deploy & verify (with conditional canary) |
| **T** — Test | `blocks/test/test.md` | Static → unit → contract → integration → e2e → layout → perf → security → journey |
| **V** — Verify | `blocks/verify/verify.md` | Karen + jenny (parallel) → triage → fast-fix loop |
| **L** — Learn | `blocks/learn/learn.md` | Docs → distill (claimed tasks marked `done` in DB + ≤1 principle promoted per `*-PRINCIPLES.md` file) |
| **N** — Next | `blocks/next/next.md` | Survey & triggers → seed → handoff |

---

## Iron Law

The orchestrator NEVER fixes technical errors directly. On any error / bug / failure: invoke `/investigate` → classify → route to the specialist named in `command-center/AGENTS.md`. No debug-by-deploy. No "let me try a fix and see if CI passes."

This rule applies in every block, every stage, every wave.

---

## Operational rules (always-on)

1. **Never deploy from local.** All deploys go through PR → CI → platform.
2. **Never skip a stage or block for time pressure.** Only the block dispatcher's declared skip conditions justify skipping.
3. **Specs live inside their `tasks` row** as a fenced YAML block at the head of `description`, followed by `---` and prose body (see `claudomat-brain/db/SCHEMA.md` § structured-content carve-outs). The spec contract is the queue's payload; `process/waves/wave-<N>/stages/P-2-spec.md` is the convenience pointer copy, not a separate source of truth.
4. **Generate secrets yourself** (`openssl rand -base64 32`). Routine; never gate the loop on the founder for this.
5. **Sub-agent spawn = `AGENTS.md` check first.** If the target isn't listed, route through `claudomat-brain/setup-tools/agent-creator/agent-creator.md` rather than substituting silently.
6. **Never `browser_close` in a Playwright swarm.** Kills the MCP instance for subsequent batch agents.
7. **Mode flag respect.** Hard-stop routing follows the active mode (`founder-review` / `default` / `automatic` / `degenerate`); see `claudomat-brain/management/<mode>-mode.md`.

---

## Stage completion ledger

Every wave maintains a checklist in `process/waves/wave-<N>/checklist.md`, seeded at `P-0` from the template below. Stage gates may not advance without the prior stages checked off. `N-3` cannot fire until all preceding stages are checked.

```markdown
## Wave <N> stage completion

PRODUCT:
- [ ] P-0 Frame (discover + reframe)
- [ ] P-1 Decompose
- [ ] P-2 Spec
- [ ] P-3 Plan
- [ ] P-4 Gate

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [ ] B-0 Branch & schema
- [ ] B-1 Contracts
- [ ] B-2 Backend
- [ ] B-3 Frontend
- [ ] B-4 Wiring
- [ ] B-5 Verify
- [ ] B-6 Review

CI/CD:
- [ ] C-1 PR, CI & merge
- [ ] C-2 Deploy & verify (canary armed when real users > 1000)

TEST:
- [ ] T-1 Static
- [ ] T-2 Unit
- [ ] T-3 Contract
- [ ] T-4 Integration
- [ ] T-5 E2E
- [ ] T-6 Layout
- [ ] T-7 Perf
- [ ] T-8 Security
- [ ] T-9 Journey

VERIFY:
- [ ] V-1 Independent reviews (Karen + jenny, parallel)
- [ ] V-2 Triage
- [ ] V-3 Fast-fix loop (or close)

LEARN:
- [ ] L-1 Docs
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff
```
