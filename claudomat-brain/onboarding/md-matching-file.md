# Onboarding — md-matching-file

Canonical inventory matching `.md` files to the brain block/stage invocations that consume them. Onboarding's job is to ensure every file listed here exists in a fresh project repo before the first wave's `P-0 Frame` can fire.

Contract between the **brain** (claudomat) and **project-level scaffolding** (consumed by the onboarding pipeline). If brain-referenced files don't exist when a wave runs, the wave hits "missing-infrastructure" branches (e.g., T-3/T-4 `test_pattern: deferred`) — onboarding's job is to make that path the exception.

---

## Categories

Files split into 5 categories by who owns the content + when authored:

1. **Project artifacts** — generated from project state at install (crawls, capability snapshots)
2. **Project-level principles** (`command-center/principles/`) — empty scaffolds at install, populated by L-2 over time
3. **Project-level configuration** — authored at install via founder Q&A or platform inspection
4. **Project-level data** — empty scaffolds, populated as project matures
5. **Brain-level templates** — copied from claudomat into the project's `claudomat-brain/` (vendored brain)

---

## 1 — Project artifacts (generated at onboarding)

| File | Consumed by | Generation |
|---|---|---|
| `command-center/artifacts/user-journey-map.md` | D-3, T-5, T-9 | Crawl deployed prod state via `/browse`; for greenfield, scaffold empty with documented schema |
| `command-center/AGENTS.md` | All blocks (sub-agent spawning) | Curated catalog: tag → expertise → routing → collateral. Hand-edited via the `agent-creator` skill (pipeline-driver procedure at `claudomat-brain/setup-tools/agent-creator/agent-creator.md`). |
| `process/session/.capability-sheet.md` | All blocks (always-on rule #11, #12) | Auto-generated at session start by `claudomat capabilities`. Holds installed agents / skills (top-level + plugin-bundled) / MCP servers / stage-routing index / drift report vs AGENTS.md. |

**Regeneration policy.** AGENTS.md regenerates when the agent-creator skill (pipeline-driver) runs. Capability sheet regenerates at session start (DISPATCHER step 0) when stale (>60min) or missing. Journey map regenerates every wave at T-9.

**Required host skills.** Host-level skills (under `~/.claude/skills/`) that are runtime prerequisites for specific brain blocks. If missing, onboarding installs them or routes the consuming block to a fallback path.

| Skill | Source | Consumed by | Fallback when missing |
|---|---|---|---|
| `gemini-deep-research` | Vendored at `claudomat-brain/setup-tools/prebuilt-claudomat-skills/gemini-deep-research/` from `Hongyu-yu/gemini-deep-research-skill` (MIT, upstream deleted) | `claudomat-brain/setup-tools/agent-creator/agent-creator.md` (head/executor/verifier brief execution) | Manual brief drafting by orchestrator — slower, no grounded citations. Calls Gemini Deep Research agent (`deep-research-preview-04-2026` / `deep-research-max-preview-04-2026`) via Interactions REST API. Requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` (paid tier). Skill is bundled; first-use Python 3.10+ deps: `cd ~/.claude/skills/gemini-deep-research && uv venv && uv pip install -r requirements.txt`. |

---

## 2 — Project-level principles (`command-center/principles/`)

Empty scaffolds at install. Each carries a "Contract for new rules" header (per always-on rule #13). Populated over time by L-2 distillation.

| File | Owner | Default content at install |
|---|---|---|
| `PRODUCT-PRINCIPLES.md` | head-product (P-block) | Empty scaffold + Contract header |
| `DESIGN-PRINCIPLES.md` | head-designer (D-block) | Empty scaffold + Contract header |
| `BUILD-PRINCIPLES.md` | head-builder (B-block) | Empty scaffold + Contract header |
| `dev-principles.md` | B-2, B-3, B-5 | Empty scaffold + Contract header |
| `test-layer-principles/T-1.md` | T-1 (head-tester) | Default thresholds: 0 `@ts-expect-error`, 0 `as any`, 0 `as unknown as` per wave (warning only) |
| `test-layer-principles/T-2.md` | T-2 | Default coverage policy: every new pure-function module gets a colocated test |
| `test-layer-principles/T-3.md` | T-3 | Default: contract tests required for every endpoint with a Zod schema |
| `test-layer-principles/T-4.md` | T-4 | Default: integration tests required when wave touches schema OR multi-service boundary |
| `test-layer-principles/T-5.md` | T-5 | Default tester swarm size: 3; min runs per scenario: 2; persistent-flake threshold: 3 waves |
| `test-layer-principles/T-6.md` | T-6 | Default visual diff threshold: 5%; required breakpoints: 1440/1280/1024 |
| `test-layer-principles/T-7.md` | T-7 | Default budgets: LCP < 2.5s, INP < 200ms, CLS < 0.1, TBT < 200ms; bundle delta thresholds |
| `test-layer-principles/T-8.md` | T-8 | Default `auth_boundary_paths` (project-specific — empty until populated) |
| `test-layer-principles/T-9.md` | T-9 | Default journey-map regen schedule: every wave |
| `CI-PRINCIPLES.md` | C-1, C-3 | Authored from founder Q&A + platform inspection: deploy_targets schema, canary config, PR conventions (incl. AI-attribution toggle) |
| `VERIFY-PRINCIPLES.md` | V-block | Empty scaffold + Contract header |

Brain blocks reference these files for project-specific values (thresholds, budgets, paths, policies). Empty scaffolds with documented defaults let blocks honor "read the principles file; defaults declared there" without inline green-field branches.

---

## 3 — Project-level configuration

| File | Generation source |
|---|---|
| `CLAUDE.md` | Brain-owned (copied from `claudomat-brain/CLAUDE.md` by init/sync). Identical across all claudomat projects — Trigger Table + always-on rules + dir tree. Never edited project-side. |
| `project.yaml` | Founder Q&A (Phase 2 brownfield) / onboarding (v6b consolidates `name` + `description` + `stack.*` + `quick_start.*` + `commands[]` + `merge_strategy` + `deploy_targets[]`; v13 step 2d fills `test_users.local_dev[]`; v13 step 2f substitutes name + description into README). Schema-validated by `claudomat doctor`. |
| `.env.example` | Founder Q&A — env var placeholders per project requirements |
| `command-center/management/status-check.yaml` | Copy from brain template; project-specific values empty |
| `command-center/management/ceo-blocklist.md` | Authored at install ONLY when entering `degenerate` mode for the first time. Otherwise omitted (scaffold-on-first-use) |

**Mode files** (`<mode>-mode.md` × 4) live in the brain's `claudomat-brain/management/` and are referenced via vendored-brain symlink — projects do NOT author them.

---

## 4 — Project-level data (empty scaffolds, populated as project matures)

| Source | Consumed by |
|---|---|
| `milestones` table (Postgres) | P-0, N-1, N-2 |
| `founder_bets` table (Postgres) | P-0 |
| `command-center/product/product-decisions.md` | P-0 |
| `command-center/artifacts/Concept/` | P-0 |
| `command-center/artifacts/competitive-benchmarks/` | P-0 |
| `design/DESIGN-SYSTEM.md` | D-1, D-2, D-3, B-3, T-6 |
| `design/brief-template.md` | D-1 |
| `design/review-gate.md` | D-3 |
| `design/staging/` | D-2 |
| `user-scenarios/` | T-9 (optional; scenario smoke skipped when absent) |

For UI projects, `design/DESIGN-SYSTEM.md` is authored at install via the `/design-consultation` skill (gstack). For non-UI projects (CLIs, libraries, infra-only), the design surface is scaffolded blank or omitted — D-block always skips on non-UI waves.

---

## 5 — Brain-level templates (vendored into project's `claudomat-brain/`)

Per V2 vendored-brain architecture, these files live in the brain repo and are copied wholesale into each project at install. Projects do NOT author them; updated only via `claudomat sync`.

| File | Purpose |
|---|---|
| `claudomat-brain/DISPATCHER.md` | Wave sequencer (block order) |
| `claudomat-brain/blocks/<X>/<X>.md` × 8 | Per-block dispatchers (P/D/B/C/T/V/L/N) |
| `claudomat-brain/blocks/<X>/stages/<X-N>.md` × N | Per-stage actions |
| `claudomat-brain/management/<mode>-mode.md` × 4 | Mode behavior specs (founder-review / default / automatic / degenerate) |
| `claudomat-brain/management/board-process.md`, `board-members.md`, `conflict-resolution.md` | BOARD routing under autonomous modes |
| `command-center/dev/triage-routing-table.md` | Classification → specialist mapping (Iron Law) |
| `claudomat-brain/rules/external-sdk-integration-rules.md` | SDK pre-build checklist |
| `claudomat-brain/monitors/monitor-principles.md` + `claudomat-brain/monitors/<platform>.md` | Async deploy / external-wait monitors (C-3) |
| `claudomat-brain/rules/sub-agent-invocation.md` | Sub-agent spawn protocol |
| `claudomat-brain/rules/skill-use.md` | Skill invocation protocol |
| `claudomat-brain/setup-tools/install.md` | Onboarding entry point — references this manifest |
| `claudomat-brain/setup-tools/agent-creator/agent-creator.md` + templates | Agent generation when AGENTS.md catalog is missing a needed specialist |
