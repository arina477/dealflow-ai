# Onboarding Loop — Pre-Wave Stage Dispatcher

Runs ONCE at project seeding. Produces baseline artifacts the wave loop assumes exist: vision, founder stage, competitor tier-ranking, scope, page map, stack decision, architecture, design direction, design system, page designs, milestones, tasks (DB-resident). After v13 handoff, control passes to `claudomat-brain/DISPATCHER.md` and every wave enters the P-block at `P-0`.

Before EVERY stage, READ the corresponding stage file. Do not invent, skip, or reorder stages.

---

## Prerequisites

- `claudomat init` has scaffolded the project (`command-center/`, `design/`, `process/`, vendored `claudomat-brain/`, `CLAUDE.md`, `project.yaml`, `README.md`, `.env.example`, `.mcp.json`).
- `claudomat doctor` passes — see v0 Action 0 for the full external-dependency checklist.
- This file has been read in full.

**v0 Action 0 is the HARD GATE for external-dependency completeness.** If `claudomat doctor` reports any `[FAIL]` or any `[WARN]` for an external-dependency item, v0 refuses to proceed. Missing dependencies otherwise surface as silent degradations downstream (missing Playwright degrades v2 + v9; missing `GEMINI_API_KEY` for the bundled `gemini-deep-research` skill degrades agent-creator briefs; missing `aidesigner` blocks v7/v8/v9).

---

## Stage sequence

```
v0 → v1 → v2 → v3 → v4 → v5 → v6 → v6b → v7 → v8 → v9 → v10 → v11 → v12 → v13
```

The v11 → v12 → v13 trio is the **install-completeness verification loop** (audit → install → verify-and-handoff). install.md Phase 6b (BOARD bench) and Phase 6d (bespoke per-stack executors) require project context that only emerges from v0–v10 — pre-onboarding install can only do Phase 6a (pre-built collections) + Phase 6c (Heads). v11 audits the gap; v12 installs it; v13 final-verifies and flips `loop_state: ready`.

| Stage | File | Purpose |
|-------|------|---------|
| v0 | `stages/stage-v0-input.md` | Receive product/service description documents (incl. external-tool HARD GATE) |
| v1 | `stages/stage-v1-vision-and-gaps.md` | Parse docs → poll only for missing essentials → seed `founder_bets` + `milestones` rows (DB) + `founder-stage.md` (FS) |
| v2 | `stages/stage-v2-competitive-scan.md` | 360° competitive scan (5–10 targets, agent-ranked Tier 1/2/3) |
| v3 | `stages/stage-v3-product-scope.md` | Personas × flows × feature catalog × tools/modules map |
| v4 | `stages/stage-v4-page-map.md` | Page enumeration + per-page PDs (parallel) |
| v5 | `stages/stage-v5-stack-selection.md` | Tech stack — claudomat baseline default with override path |
| v6 | `stages/stage-v6-architecture.md` | 8 parallel branches (Modules / Services / DB / SDK / Tools / Security / DevOps / Test) |
| v6b | `stages/stage-v6b-architecture-integrate.md` | Cross-check + integrate to single library doc; lock module-list; populate `.env.example` |
| v7 | `stages/stage-v7-design-direction.md` | `/aidesigner` direction proposal + founder approval loop |
| v8 | `stages/stage-v8-design-system.md` | DESIGN-SYSTEM.md build (gated on v6b lock + v7 approval) |
| v9 | `stages/stage-v9-page-designs.md` | Per-page design generation loop (approval per page) |
| v10 | `stages/stage-v10-planning.md` | Milestones → INSERT into `milestones` table → child tasks INSERT into `tasks` table → product-decisions backfill |
| **v11** | `stages/stage-v11-install-audit.md` | Detect install gaps — strict doctor + probe ~/.claude/agents/ for BOARD seats / Heads / pre-built collection / bespoke executors / capability-sheet / AgentMail. Writes delta report + `loop_state: install-pending`. |
| **v12** | `stages/stage-v12-install-execute.md` | Install delta — invoke install.md Phase 3–8 procedures per dependency order. Loops until clean. |
| **v13** | `stages/stage-v13-handoff.md` | Final verify + handoff — strict doctor (HARD GATE), git init + CI seed + status-check + test-accounts + commit + push + onboarding-complete marker; only this stage flips `loop_state: ready`. |

---

## How to use this loop

1. Before entering stage `vN`: READ `stages/stage-vN-<name>.md`.
2. Execute exactly what the stage file says.
3. When the stage's exit criteria are met, return here.
4. Identify the next stage from the sequence above.
5. READ the next stage file.
6. Repeat until v13.

No file read = no instructions = do not proceed.

---

## Options-and-custom contract (applies to every product/taste decision)

Onboarding splits decisions into two buckets (per `claudomat-brain/CLAUDE.md` always-on rule 17):

- **Technical / engineering defaults** — tech stack, ORM, hosting / deploy target, linter, test framework, secret-management approach, test-account provisioning mechanism, and the like. claudomat applies the baseline **silently**, states the consequential ones in one plain-language line, and records the decision in `product-decisions.md`. **No `AskUserQuestion`.** Poll only when the founder already named a preference or constraint (in v0 docs, `project.yaml`, or an explicit request), or when no safe default exists.
- **Product / taste decisions** — vision, market, scope, features, design direction and system, milestone priorities, and any choice with product / data / legal / cost consequences (compliance regime, industry domain). These are founder-facing and MUST surface as an `AskUserQuestion`.

Every product/taste `AskUserQuestion` MUST have:

1. **≥2 concrete options** — extracted from docs / prior-stage analysis / framework defaults. Never present a question without at least two named choices.
2. **A `custom` option** — always last. Wording: *"Custom — tell me what you want and I'll work with it."*
3. **A `defer` option where applicable** — *"Log as Tier 3 / decide later"* — only when the decision can safely be revisited at v10 batch-resolve or first refresh ritual. Decisions that are downstream blockers (v0 docs, v1 essentials, v6b conflicts, v7/v8/v9 approvals, and any stack override the founder explicitly requested) MUST NOT offer `defer`.
4. **Plain-language phrasing** — per always-on rule 16 (`CLAUDE.md`), the question stem, the `header` chips, and every option label read like a product manager wrote them: short, jargon-free, decision-first. No stage codes, table/column names, agent names, or stack jargon in the founder-facing text unless the founder used the term first. (Structure stays as above; this governs the words.)

**No free-text-only prompts.** Free text appears only inside the `custom` branch — never as the primary ask. The founder always sees a concrete proposal before being asked to think from scratch.

When the founder picks `custom`, restate the free-text response as a concrete option and confirm via one `AskUserQuestion` (`Confirm / Refine / Cancel`) before treating as final.

For product/taste decisions the contract holds even when the answer seems obvious — show the obvious option as choice #1, not as an assumption. Technical defaults are the inverse case: do NOT manufacture a poll for them — apply the baseline and announce it (rule 17).

---

## Skip conditions

| Stage | May skip when |
|-------|--------------|
| v1 poll step | Docs from v0 already contain complete vision + ≥1 founder bet + target market. Stage still seeds scaffolds; only the gap-poll `AskUserQuestion` is skipped. |
| v2 fan-out | Founder explicitly opts out via v2 `custom` branch. Per-competitor files skipped; INDEX.md still written with rationale. |
| v5 stack poll | No stack preference or constraint appears in v0 docs / `project.yaml` / an explicit founder request. v5 applies the claudomat baseline silently (no `AskUserQuestion`), announces it in one line, and logs it. The poll fires only when a stack signal is present (per rule 17). |
| v7 / v8 / v9 | Backend-only / API-only / CLI projects with no UI surface. The design block (D) skips on every wave for non-UI projects. v6b → v10 jump. The v6 Tools branch confirms classification. |
| All others | NEVER. |

---

## Cross-references (apply at every stage)

| Trigger | READ |
|---|---|
| Spawning ANY sub-agent | `claudomat-brain/rules/sub-agent-invocation.md` + relevant agent card from `command-center/AGENTS.md` |
| Invoking ANY skill | `claudomat-brain/rules/skill-use.md` (routing table) |
| Any product/UX decision | `claudomat-brain/management/default-mode.md` § 3-tier classification — but **BOARD is OFF during onboarding regardless of declared mode** (per `claudomat-brain/management/board-process.md` § Onboarding carve-out). Founder-review applies. ceo-agent is also OFF. |
| Competitive methodology | `claudomat-brain/management/default-mode.md` § Competitive intelligence pre-decision benchmark — Playwright live-browsing mandate; WebSearch-only is insufficient |
| Design gaps in v7/v8/v9 | `design/brief-template.md` + `design/review-gate.md` |
| Test / DevOps defaults | `command-center/principles/BUILD-PRINCIPLES.md` + `command-center/testing/test-writing-principles.md` |
| Roadmap schema in v1 + v10 | `claudomat-brain/ROADMAP/roadmap-lifecycle.md` (lifecycle + states + edit permissions) + `claudomat-brain/db/SCHEMA.md` (Postgres tables `founder_bets` / `milestones` / `tasks` / `waves` + recipe labels for INSERT/SELECT) |

---

## Deliverables of the onboarding loop (cumulative)

By v13 commit, all of the following must exist and be committed:

| Path | Source stage | Content |
|---|---|---|
| `process/session/onboarding/docs-input/*.md` | v0 | Verbatim founder docs (or paste capture) |
| `founder_bets` rows in Postgres | v1 | Vision + ≥1 row with `status='live'` (prose description per `claudomat-brain/db/SCHEMA.md` § founder_bets) |
| `command-center/product/founder-stage.md` | v1 | One of `self-use-mvp` / `pilot-customer` / `paying-customers` / `regulated-day-1` |
| `milestones` rows in Postgres | v1 seed (horizon themes) → v10 populate (full milestone set) | North star + horizons + initial milestone rows |
| `command-center/product/product-decisions.md` | v10 | 10–20 backfilled decisions from v5–v9 + any v1 deferrals |
| `command-center/artifacts/competitive-benchmarks/<competitor>.md` × 5–10 | v2 | Per-competitor evidence + tier ranking |
| `command-center/artifacts/competitive-benchmarks/INDEX.md` | v2 | Tier ranking + freshness log |
| `command-center/product/user-flows.md` | v3 | Persona × flow narratives |
| `command-center/product/feature-list.md` | v3 | MVP / H2 / H3 feature catalog (compliance horizon-defaulted by founder-stage) |
| `command-center/product/tools-modules-map.md` | v3 | Reusable building-block inventory |
| `command-center/artifacts/user-journey-map.md` | v4 | Page map + flow cross-reference |
| `command-center/product/per-page-pd/<page>.md` × N | v4 | Per-page product descriptions |
| `command-center/dev/stack-decisions.md` | v5 | Locked tech stack (baseline or override) |
| `command-center/dev/architecture/{modules,services,databases,sdks,tools,security,devops,test}.md` | v6 | 8 architecture branches |
| `command-center/dev/architecture/_library.md` | v6b | Unified architecture reference |
| `command-center/dev/module-list.md` | v6b | `status: locked` module inventory (gates v8) |
| `.env.example` | v6b | Env-var placeholders sourced from architecture branches |
| `./project.yaml` (all fields except `test_users.local_dev[]`) | v6b | Consolidated project facts: `name`, `description`, `stack.*`, `quick_start.*`, `commands[]`, `merge_strategy`, `deploy_targets[]`. Schema-validated by `claudomat doctor`. |
| `design/direction.html` | v7 | Approved visual direction (UI projects only) |
| `design/DESIGN-SYSTEM.md` | v8 | Tokens + module primitives (UI projects only) |
| `design/<page>.html` × N | v9 | Per-page approved mockups (UI projects only) |
| `milestones` + `tasks` rows in Postgres | v10 | Populated milestones; per-wave bundle decomposition fills `tasks` rows under `tasks.milestone_id` FK during active life (per `claudomat-brain/db/SCHEMA.md` § tasks + `claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md`) |
| `.gitignore` | v13 | Baseline + onboarding-specific entries |
| `.github/workflows/ci.yml` | v13 | CI baseline matching v6 DevOps branch |
| `process/session/onboarding/v11-install-audit.md` | v11 | Categorized delta report. Triggers `loop_state: install-pending`. |
| `process/session/onboarding/v12-install-execute.md` | v12 | Per-category install audit log. |
| `~/.claude/agents/<tag>.md` × N | v12 | All BOARD seats (7) + Heads (8) + pre-built collection + bespoke executors. |
| `command-center/management/ceo-blocklist.md` | v13 | ceo-agent charter — Conservative / Permissive / Skip / Custom |
| `command-center/principles/CI-PRINCIPLES.md` | v13 | deploy_targets + canary + pr_conventions populated |
| `process/session/status-check.yaml` | v13 | Tick state for `/loop` (`STATUS: IDLE` at handoff) |
| `command-center/testing/test-accounts.md` + `project.yaml: test_users.local_dev[]` | v13 | Test-account registry (seeded, planned via signup flow at first wave's B-5, or deferral logged) |
| `./README.md` ({{name}} / {{description}} substituted from `project.yaml`) | v13 | README finalized after `project.yaml` locks |
| Initial git commit | v13 | All scaffold + generated files on `main` |
| `process/session/onboarding/onboarding-complete-<YYYY-MM-DD>.md` | v13 | Handoff marker — DISPATCHER reads at session start |
| `process/session/.last-wave-completed.yaml` | v13 | `loop_state: ready` + `next_wave_seed_task: <task-id>` + `next_wave_bundled_siblings: []` (v11 set `install-pending`; v13 flips to `ready` ONLY after final strict-doctor passes) |

---

## Operational rules

- **No waves during onboarding.** Wave loop's `P-0 Frame` presumes seeded state. Do not invoke `claudomat-brain/DISPATCHER.md` until v13 hands off.
- **BOARD is OFF and ceo-agent is OFF** during onboarding regardless of declared mode flag. Founder-review behavior applies at every poll.
- **Per-stage commit cadence.** v13 owns the final initial commit. Intermediate stages may snapshot via `git commit -m "chore(onboarding): vN complete"` for long runs — recommended after v2, v6b, v8, v10.
- **Polling discipline.** Every product/taste founder-facing decision uses the options-and-custom contract. Internal extractions (parsing v0 docs, building competitor candidate lists, generating per-page PDs) AND technical/engineering defaults (stack, ORM, hosting, linter, test framework, secret-management, test-account mechanism) are autonomous — no polls until a decision requires founder taste, or the founder already named a preference (per rule 17).
- **Race-condition gate (v6b → v8).** v8 consumes the locked module list; v8 MUST NOT start until v6b sets `status: locked` on `module-list.md`. Do not parallelize v6b and v8.
- **No wave-loop stages mix with onboarding stages.** If a `claudomat-brain/blocks/<X>/<X>.md` block dispatcher or stage file is read during onboarding, escalate.
- **Tier 3 deferrals from v1 surface at v10.** v1 logs unresolved Tier 3 items to `product-decisions.md` with `Status: Deferred — resolve at v10`; v10 batches them for resolution.

---

## Next

After v13 completes and the initial commit lands on `main`:
→ `process/session/onboarding/onboarding-complete-<YYYY-MM-DD>.md` marker is written.
→ `process/session/.last-wave-completed.yaml` is set to `loop_state: ready`.
→ Control passes to `claudomat-brain/DISPATCHER.md`. Founder invokes the first wave; dispatcher enters `claudomat-brain/blocks/product/product.md` → `P-0 Frame`.
