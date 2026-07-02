# Prebuilt claudomat agents

Ready-to-install agent cards bundled with the claudomat brain. Install Phase 6a copies these wholesale to `~/.claude/agents/` BEFORE the VoltAgent clone, so claudomat owns the namespace for these tags.

Two classes live here side by side:

- **Claudomat-internal** (`problem-framer`, `ceo-*`, `founder-proxy`, `mvp-thinner`, `milestone-decomposer`) — written from scratch for claudomat semantics.
- **Upstream-vendored** (`karen`, `code-quality-pragmatist`, `ui-comprehensive-tester`, `jenny`, `task-completion-validator`, `ultrathink-debugger`) — originally byte-identical copies of <https://github.com/darcyegb/ClaudeCodeAgents>, vendored so they ship with the brain instead of being cloned at install time. **No longer fully byte-identical**: the `@claude-md-compliance-checker` cross-references in karen / jenny / code-quality-pragmatist / task-completion-validator were stripped when the 7th vendored card (`claude-md-compliance-checker`) was retired in the `CLAUDE.md` / `project.yaml` split — that agent's checks targeted generic Anthropic-style rules absent from claudomat's CLAUDE.md. See discipline rule #4 below for the documented divergence policy. Provenance to upstream still applies otherwise.

## Why bundled — claudomat-internal cards

Behavior is tightly coupled to specific stage files (`P-0-frame.md` / `degenerate-mode.md` / `board-process.md`), specific data shapes (`product-decisions.md` on FS; `founder_bets` + `milestones` rows in Postgres per `claudomat-brain/db/SCHEMA.md`), and specific external wiring (AgentMail). Generic Gemini Deep Research at install time would produce inferior cards — open-web "what is a problem framer" content doesn't know about claudomat's verdict schemas, lazy-load directives, or HARD-STOP semantics.

Trade-off vs the `agent-creator` skill at Phase 6c (Heads): heads are stack-generic gates over claudomat blocks, stable enough that the agent-creator pipeline (`claudomat-brain/setup-tools/agent-creator/agent-creator.md`) can synthesize them at install. The cards bundled here are even more claudomat-tuned — their lifetime spans the entire framework, not just one block.

Trade-off vs VoltAgent collection (Phase 6a wholesale): that catalog is a general-purpose community set. Adding claudomat-specific agents creates cross-repo coupling that doesn't make sense for either side.

## Why bundled — upstream-vendored cards

The six remaining darcyegb cards are referenced from load-bearing brain contracts: `karen` at L-2 distill (`claudomat-brain/rules/sub-agent-invocation.md`), `code-quality-pragmatist` at B-6 review (`claudomat-brain/blocks/build/stages/B-6-review.md`), and `ui-comprehensive-tester` for T-5 Playwright swarms (`claudomat-brain/blocks/test/stages/T-5-e2e.md`). The other three (`jenny`, `task-completion-validator`, `ultrathink-debugger`) are tightly cross-referenced from those three — `karen.md` instructs `@task-completion-validator` and `@code-quality-pragmatist`, etc.

Upstream `darcyegb/ClaudeCodeAgents` is publicly available but ships **without a `LICENSE` file** and has had no commits since 2025-08-04. Vendoring removes both the disappearance risk (recent precedent: `gemini-deep-research-skill` was deleted upstream after we depended on it) and the install-time `git clone` failure mode. Source attribution is preserved in this README; the agent `.md` files are kept **byte-identical to upstream except for the minimum cross-reference patches** (the `@claude-md-compliance-checker` mentions in karen / jenny / code-quality-pragmatist / task-completion-validator were stripped when that 7th card was retired — see line 8 above + discipline rule #4 below). Provenance to upstream remains auditable via this README.

## Files

### Claudomat-internal (authored here)

| File | Role | Spawn point |
|---|---|---|
| `problem-framer.md` | P-0 frame: symptom-vs-cause + antipatterns red-team | `Agent(subagent_type=problem-framer)` at `claudomat-brain/blocks/product/stages/P-0-frame.md` |
| `ceo-reviewer.md` | P-0 frame: strategic-value + ambition lens (also BOARD seat #1 alias) | `Agent(subagent_type=ceo-reviewer)` at P-0 + BOARD invocation under `automatic` / `degenerate` |
| `ceo-agent.md` | `degenerate` mode decision body — BOARD tiebreak, HARD-STOP resolution, founder-ask fallback | `Agent(subagent_type=ceo-agent)` per `claudomat-brain/management/degenerate-mode.md` directive table |
| `founder-proxy.md` | BOARD seat #7 — simulates founder voice from `product-decisions.md` + live `founder_bets` rows | `Agent(subagent_type=founder-proxy)` per `claudomat-brain/management/board-process.md` |
| `mvp-thinner.md` | P-0 AC-level thinness reviewer — proposes splitting nice-to-have ACs into sibling tasks under the same milestone (no scope reduction) | `Agent(subagent_type=mvp-thinner)` at P-0 |
| `milestone-decomposer.md` | Operational ritual body — reads the active milestone's prose + current task state, authors ONE bundle per fire (1 seed via `parent_task_id IS NULL` + 0-N siblings via `parent_task_id = seed.id`) under `tasks.milestone_id = $active`, `wave_id = NULL`. Always inline, single-threaded. | `Agent(subagent_type=milestone-decomposer)` spawned by N-1 Action 7 (or P-1 RESCOPE-AUTO-MERGE) under `automatic` / `degenerate` modes |

### Upstream-vendored from `darcyegb/ClaudeCodeAgents` (kept verbatim)

| File | Role | Spawn point |
|---|---|---|
| `karen.md` | L-2 distill reality-check — promotes wave observations to principles by separating "claimed complete" from "actually working" | `Agent(subagent_type=karen)` at L-2 distill per `claudomat-brain/rules/sub-agent-invocation.md` |
| `code-quality-pragmatist.md` | B-6 review — flags over-engineering, premature abstractions, unnecessary complexity | `Agent(subagent_type=code-quality-pragmatist)` at B-6 review per `claudomat-brain/blocks/build/stages/B-6-review.md` |
| `ui-comprehensive-tester.md` | T-5 E2E — Playwright/Puppeteer/Mobile-MCP swarm member (3–5 in parallel) | `Agent(subagent_type=ui-comprehensive-tester)` at T-5 per `claudomat-brain/blocks/test/stages/T-5-e2e.md` |
| `jenny.md` | Implementation-vs-spec verification — invoked transitively by `karen` | `Agent(subagent_type=jenny)` on demand |
| `task-completion-validator.md` | End-to-end functional validation of claimed completions — invoked transitively by `karen` | `Agent(subagent_type=task-completion-validator)` on demand |
| `ultrathink-debugger.md` | Deep multi-hypothesis debugging walk | on demand |

## Install procedure

`claudomat-brain/setup-tools/install.md` Phase 6a step 1 (BEFORE VoltAgent):

```bash
shopt -s extglob
cp claudomat-brain/setup-tools/prebuilt-claudomat-agents/!(README).md ~/.claude/agents/
```

Excludes this `README.md` (only `*.md` files matching the agent tags above). The `cp` overwrites any existing card with the same name — claudomat owns these names.

After Phase 6a, install proceeds to the VoltAgent clone; it MUST NOT overwrite the claudomat-bundled cards (use `cp -n`).

## Versioning

Cards version with the brain. `claudomat sync` replaces `claudomat-brain/` wholesale, including this directory. Phase 6a re-runs on demand and re-copies the latest card content.

The cards in this directory are the source of truth. Project-side `command-center/AGENTS.md` references them with `_(claudomat-bundled)_` annotation; actual card content always comes from `claudomat-brain/setup-tools/prebuilt-claudomat-agents/`.

## Discipline rule for adding agents to this directory

**Claudomat-internal cards** must satisfy ALL of:

1. **Claudomat-internal scope** — behavior defined by claudomat stage files / management docs / verdict schemas, not generic domain expertise.
2. **Stable across projects** — same behavior on every claudomat install, not stack-tuned.
3. **Load-bearing infrastructure** — referenced from multiple places in the brain; agent absence breaks core flow (P-0 / BOARD / `degenerate` decision loop).
4. **Generic research wouldn't help** — Gemini Deep Research output would be inferior because the research surface doesn't know about claudomat semantics.

Failing any test → routes through `claudomat-brain/setup-tools/agent-creator/agent-creator.md` (BOARD / heads / executors / verifiers) or comes from the VoltAgent collection instead.

**Upstream-vendored cards** must satisfy ALL of:

1. **Load-bearing reference from a claudomat brain contract** — the card name appears in `claudomat-brain/` as a required spawn point (not just "nice to have").
2. **Upstream is fragile** — single-maintainer / no LICENSE file / archived / has already disappeared / very low recent commit activity.
3. **Permissive license OR no LICENSE + low redistribution risk** — MIT-style preferred; for `LICENSE`-absent repos, vendor only if upstream README explicitly encourages use AND the card content is small enough that re-authoring is cheap fallback if the author later objects.
4. **Byte-identical to upstream except for minimum cross-reference patches** — vendored copies stay literally identical at first vendor; later, claudomat may strip references to other vendored cards that were retired or renamed (e.g., the `claude-md-compliance-checker` removal in the 1.0.0 `CLAUDE.md` / `project.yaml` split required stripping `@claude-md-compliance-checker` from karen / jenny / code-quality-pragmatist / task-completion-validator). Any such patches MUST be documented in CHANGELOG so attribution stays auditable and a future upstream merge can be re-applied minus the patches.

Failing any test → keep as external `cp -n` install in `entrypoint.sh` (status quo for low-risk catalogs) or re-author from scratch.
