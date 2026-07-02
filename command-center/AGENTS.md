# AGENTS.md — Project Agent Catalog

Project-local index of every sub-agent. Invoke via `/agents` (interactive) or the `Agent` tool with `subagent_type: <tag>`. This file is for *finding* the right agent — provenance and audit metadata live in each agent's card frontmatter and `claudomat doctor`.

Maintained by `claudomat-brain/setup-tools/agent-creator/agent-creator.md` (Stage 3). Do not hand-edit.

---

## Catalog

<!--
Schema:
- tag         — must match the agent card filename and `name:` in frontmatter
- expertise   — single line; what this agent is good at (lifted from card description)
- routing     — when/where to invoke. Heads: block code (P/D/B/C/T/V/L/N).
                Executors: tag-class trigger (e.g., "postgres tasks", "stripe integration").
                Verifiers: stage anchor (e.g., "V-1 reality check", "P-4 reviewer pool").
- collateral  — links to the research archive and distilled pack. Two `[label](path)`
                entries separated by ` · `. Provenance and SHAs live in card frontmatter,
                not here. Pre-built collection agents carry no project-side research/pack —
                collateral cell reads `(pre-built)` for externally-cloned cards (VoltAgent) or
                `(claudomat-bundled — <path>)` for in-tree cards shipped with the framework.
-->

### BOARD members (7 fixed seats — generated at `claudomat init` per `claudomat-brain/management/board-members.md`)

| tag | expertise | routing | collateral |
|---|---|---|---|
| `strategist` | Bet alignment, direction, strategic position | BOARD seat #1 | [research](setup-tools/agent-creator/research/strategist-2026-07-01.md) · [pack](domain-packs/strategist.md) |
| `industry-expert` | Prior art + pattern library across tech / product / organizational patterns the project's industry has converged on | BOARD seat #2 | [research](setup-tools/agent-creator/research/industry-expert-2026-07-01.md) · [pack](domain-packs/industry-expert.md) |
| `realist` | Evidence, data, assumed-unverified claims — "show the proof" | BOARD seat #3 | [research](setup-tools/agent-creator/research/realist-2026-07-01.md) · [pack](domain-packs/realist.md) |
| `user-advocate` | User-experienced impact (UX + retention + trust + brand signal) | BOARD seat #4 | [research](setup-tools/agent-creator/research/user-advocate-2026-07-01.md) · [pack](domain-packs/user-advocate.md) |
| `risk-officer` | Tech-risk only — failure modes, escape routes, performance/scale, vendor + architectural lock-in, schema/migration risk | BOARD seat #5 | [research](setup-tools/agent-creator/research/risk-officer-2026-07-01.md) · [pack](domain-packs/risk-officer.md) |
| `counter-thinker` | Steel-manned alternatives, inversion, "what's the smartest opposing case?" | BOARD seat #6 | [research](setup-tools/agent-creator/research/counter-thinker-2026-07-01.md) · [pack](domain-packs/counter-thinker.md) |
| `founder-proxy` | Founder voice via product-decisions.md + founder_bets; HARD-STOP on no precedent | BOARD seat #7 | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/founder-proxy.md`)_ |

### Head-X gates (8 — one per block; gate-only)

All head-X agents are spawned as fresh sub-agents at the block-exit gate stage to issue the gate verdict. The orchestrator runs each block's stages directly using stage-file actions; the head-X card may be consulted on demand at `~/.claude/agents/head-<X>.md` as a heuristics reference.

| tag | expertise | routing | collateral |
|---|---|---|---|
| `head-product` | P-block gate: bet alignment, scope discipline, decomposition, spec quality | P-4 gate verdict | [research](setup-tools/agent-creator/research/head-product-2026-07-01.md) · [pack](domain-packs/head-product.md) |
| `head-designer` | D-block gate: design-system token discipline (zinc/emerald, lucide-react, 4px grid), WCAG 2.2 accessibility, one-primary-CTA hierarchy, immutable audit-log + non-dismissible compliance UI, RBAC states, edge-case coverage | D-3 gate verdict | [research](setup-tools/agent-creator/research/head-designer-2026-07-01.md) · [pack](domain-packs/head-designer.md) |
| `head-builder` | B-block gate: shared-Zod-contract adherence, test-gate discipline, code simplicity, load-bearing compliance audit-log across branch/schema → contracts → backend → frontend → wiring → review | B-6 gate verdict | [research](setup-tools/agent-creator/research/head-builder-2026-07-01.md) · [pack](domain-packs/head-builder.md) |
| `head-tester` | T-block gate: coverage adequacy + flakiness discipline + compliance-invariant test map across T-1..T-9 (incl. T-5 e2e swarm, T-8 security, T-9 Journey); catches coverage theater, tautological assertions, layout-only false-PASS, untested audit-log/SoD invariants, silently-skipped E2E | T-9 gate verdict | [research](setup-tools/agent-creator/research/head-tester-2026-07-01.md) · [pack](domain-packs/head-tester.md) |
| `head-verifier` | V-block gate: proof-carrying verdicts traced to deployed-state artifacts; V-1 parallel Karen+jenny reviews, V-2 triage, V-3 bounded fast-fix loop; catches Done-Theater, false-greens, spec-vs-deployed drift, compliance-gate bypass | V-3 gate verdict + fast-fix loop | [research](setup-tools/agent-creator/research/head-verifier-2026-07-01.md) · [pack](domain-packs/head-verifier.md) |
| `head-ci-cd` | C-block gate: commit-SHA provenance, pnpm-audit security gate, additive-only Drizzle migrations, armed rollback, canary blast-radius, bounded MONITOR: tasks; PR-author + CI-watch + deploy & verify | C | [research](setup-tools/agent-creator/research/head-ci-cd-2026-07-01.md) · [pack](domain-packs/head-ci-cd.md) |
| `head-learn` | L-block gate: observation quality (systemic-not-human root cause, plan-authoring-defect tracing) + promote AT MOST ONE principle per wave in the target *-PRINCIPLES.md Contract format | L-block (sub-agent owns lifetime) | [research](setup-tools/agent-creator/research/head-learn-2026-07-01.md) · [pack](domain-packs/head-learn.md) |
| `head-next` | N-block: oldest-unparented seed-pick + vertical-slice sibling-bundling + archive-readiness (context distilled, tech debt logged, no scope creep/secret leaks) + milestone promotion/closure + wave-close | N (sub-agent owns lifetime) | [research](setup-tools/agent-creator/research/head-next-2026-07-01.md) · [pack](domain-packs/head-next.md) |

### Universal verifiers (always — installed pre-built or via agent-creator)

| tag | expertise | routing | collateral |
|---|---|---|---|
| `karen` | Load-bearing-claim verifier (line numbers, method names, exact spec text). Spot-checks claims against codebase reality. | V-1 parallel reviews; P-4 phase 2 reviewer pool; L-2 distill rule-quality vetter | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/karen.md`)_ |
| `jenny` | Semantic-spec verifier — does deployed behavior match the spec? Cross-references plan vs. user-journey-map vs. product-decisions for drift. | V-1 parallel reviews; P-4 phase 2 reviewer pool | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/jenny.md`)_ |
| `code-quality-pragmatist` | Reviews recent code for over-engineering, theoretical-best-practice creep, unnecessary complexity. | B-6 review pool | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/code-quality-pragmatist.md`)_ |
| `task-completion-validator` | Validates "done" claims against actual delivered behavior. | V-block; head-X gate input | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/task-completion-validator.md`)_ |

### Universal executors (always — pre-built)

| tag | expertise | routing | collateral |
|---|---|---|---|
| `problem-framer` | Catches "right code, wrong problem" — symptom-vs-cause confusion, wrong-layer fixes, demo-path tunnel vision. | P-0 frame (parallel with ceo-reviewer) | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/problem-framer.md`)_ |
| `ceo-reviewer` | Strategic ambition reviewer — "is this worth doing? ambitious enough or too ambitious?" | P-0 frame; BOARD seat #1 alias | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/ceo-reviewer.md`)_ |
| `knowledge-synthesizer` | Extracts patterns from agent observations; emits 0–3 observations per active block at L-1. | L-1 docs (knowledge synthesis) | _(pre-built)_ |
| `ui-comprehensive-tester` | Playwright tester for live-site verification; persona-partitioned across MCP instances. | T-5 e2e swarm; roadmap-planning competitive sweep | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/ui-comprehensive-tester.md`)_ |
| `milestone-decomposer` | Operational ritual body — INSERTs ONE bundle per fire (1 seed via `parent_task_id IS NULL` + 0-N siblings via `parent_task_id = seed.id`) under the active milestone (`tasks.milestone_id = $active`, `wave_id = NULL`). Always inline, single-threaded. | N-1 Action 7 spawn under `automatic` / `degenerate` when active milestone needs the next wave's bundle; also P-1 RESCOPE-AUTO-MERGE for current-bundle expansion | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/milestone-decomposer.md`)_ |
| `backend-developer` | Server-side implementation across frameworks (multi-framework); production-ready APIs + microservices. | B-2 backend (executor — replaced by domain-specific agents per stack) | _(pre-built)_ |
| `frontend-developer` | Frontend implementation across React / Vue / Angular (multi-framework). | B-3 frontend (executor — replaced by `react-specialist` / `vue-expert` / etc. per stack) | _(pre-built)_ |
| `ceo-agent` | Decision body under `degenerate` mode — resolves BOARD splits, HARD-STOP vetoes, all former-founder-asks within `command-center/management/ceo-blocklist.md` charter. | `degenerate`-mode escalation; stall monitor (every tick) | _(claudomat-bundled — `claudomat-brain/setup-tools/prebuilt-claudomat-agents/ceo-agent.md`)_ |
| `agent-creator` | Sub-agent authoring pipeline — research → distill → synthesize. Used to install missing-from-catalog agents. | On-demand when AGENTS.md doesn't catalog a needed tag | `claudomat-brain/setup-tools/agent-creator/agent-creator.md` |

### Project-specific executors (added per stack via `claudomat-brain/setup-tools/agent-creator/agent-creator.md`)

| tag | expertise | routing | collateral |
|---|---|---|---|
| `architect-reviewer` | System design, architectural patterns, technology-choice review at the macro level | v6 architecture (Security pair); B-block module decisions; architecture research | _(pre-built)_ |
| `database-administrator` | DB performance, HA, schema/migration/backup strategy | v6 Databases branch; DB-domain tasks | _(pre-built)_ |
| `devops-engineer` | CI/CD, IaC, containerization, deploy workflows, observability | v6 Tools + DevOps branches; C-block support | _(pre-built)_ |
| `security-engineer` | Auth/RBAC, session, secrets, input validation, threat modeling | v6 Security branch (pair w/ architect-reviewer); auth/payments/session waves | _(pre-built)_ |
| `test-automator` | Test frameworks, CI test integration, coverage strategy | v6 Test branch; T-block support | _(pre-built)_ |
| `qa-expert` | QA strategy, test planning, quality metrics | v6 Test branch (alt); T-block | _(pre-built)_ |
| `product-manager` | Product strategy, feature prioritization, per-page PD authoring | v4 per-page PDs; product decisions | _(pre-built)_ |
| `competitive-analyst` | Competitor analysis, benchmarking, positioning | v2 competitive scan; P-0 deepening; refresh ritual | _(pre-built)_ |
| `ux-researcher` | User research, usability, persona/journey insight | v7–v9 design support; BOARD user-advocate alias | _(pre-built)_ |
| `research-analyst` | Multi-source research + synthesis | v5 full-override stack research; general research | _(pre-built)_ |
| `technical-writer` | API refs, guides, integrated docs | v6b unified architecture library; documentation waves | _(pre-built)_ |
| `ui-designer` | Visual interface design, design systems, component libraries | v7–v9 design support | _(pre-built)_ |
| _(further per-stack executors — e.g., `postgres-pro`, `react-specialist`, `nextjs-developer`, `typescript-pro`, `<sdk>-integration` — added at v12 install per `project.yaml: stack.*`)_ | _ | _ | _ |

---

## Role-class legend

- **head** — gates a block across multiple stages; persistent across the block. Issues PASS / REWORK / ESCALATE on stage deliverables.
- **executor** — single-domain implementer; transient (spawned per task, dies on completion).
- **verifier** — adversarial reviewer; transient (spawned for one verdict pass).

## Block legend (heads)

`P` Product · `D` Design · `B` Build · `C` CI/CD · `T` Test · `V` Verify · `L` Learn · `N` Next
