# Skill Use

Maps wave-loop stages to the skills that fire at them. Stage-keyed routing — orchestrator at stage entry queries this file to know which skills to invoke automatically. Skills not listed are unused or manually founder-invoked.

Skills live at `~/.claude/skills/` (top-level + plugin-bundled). Installed skills are inventoried in `process/session/.capability-sheet.md` § Installed skills (regenerated at session start). Capability check before any auto-invoke — if skill is absent, log gap and skip.

---

## Stage routing table

| Stage | Skill | Trigger | When to invoke | Purpose |
|---|---|---|---|---|
| DISPATCHER step 0 | `/careful` | always | At session start, before first stage entry | Bash PreToolUse hook — warns on `rm -rf` / `DROP TABLE` / force-push / `git reset --hard` / `kubectl delete` |
| P-3 Plan | `/plan-ceo-review` | always | After plan deliverable written, before P-4 gate | CEO/founder-mode 4-mode review (SCOPE EXPANSION / SELECTIVE / HOLD / REDUCTION); challenges priorities, ranks by impact |
| P-3 Plan | `/plan-eng-review` | always | After plan deliverable written, before P-4 gate | Eng-manager-mode review: architecture, data flow, edge cases, test coverage, performance |
| P-3 Plan | `/plan-design-review` | `wave_type ∈ {ui, design}` | After plan deliverable written, before P-4 gate | Designer's eye, 0-10 rating per dimension, explains what would make it a 10 |
| P-3 Plan | `/plan-devex-review` | `wave_type ∈ {api, cli, sdk}` | After plan deliverable written, before P-4 gate | DX review (3 modes: EXPANSION / POLISH / TRIAGE) |
| P-3 Plan | `/autoplan` | `wave_complexity == high` | In place of individual `/plan-*` skills | Runs CEO + eng + design + devex sequentially with auto-decisions |
| D-2 Variants | `/aidesigner` | always | At stage entry | Generate variant mockups (initial + bounded refine loop) |
| D-3 Review & adopt | `/design-review` | always | After variants approved, before adoption | Live-site visual coherence audit |
| B-5 Verify | `/health` | `wave_size == large` | After local checks pass, before B-6 review | Code-quality dashboard: typecheck + lint + tests + dead code → weighted 0-10 score |
| B-6 Review | `/simplify` | always | At stage entry, before `/review` | Reduce complexity on touched files |
| B-6 Review | `/review` | always | After `/simplify`; final pre-PR check | Contract-mismatch + null-access + production-bug check (not a style review) |
| C-1 PR, CI & merge | `/ship` | `wave_type == release` | At stage entry, in place of manual PR | Formal-release PR workflow (version bump + CHANGELOG + commit + push + PR) |
| C-1 PR, CI & merge | `/land-and-deploy` | always | After PR approval, within C-1 merge actions | Wait for CI + deploy + post-deploy health check |
| T-5 E2E | `/qa` | always | At stage entry, smoke pass | Headless smoke test on touched pages |
| T-5 E2E | `/browse` | always | During Playwright swarm | Gstack browser interaction harness |
| T-8 Security | `/cso` | `wave_touches ∈ {auth, payments, sessions, csrf, rate-limit, user-creation}` | At stage entry | OWASP Top 10 + STRIDE threat model |
| V-2 Triage | `/investigate` | always (when triage queue non-empty) | At stage entry, per finding | Root-cause investigation — Iron Law: no fixes without root cause |
| V-3 Fast-fix | `/investigate` | always | At stage entry, before any code change | Same as V-2; the fast-fix loop also classifies-first |
| L-1 Docs | `/document-release` | always | After all wave artifacts settled | Post-ship doc sync: README / ARCHITECTURE / CHANGELOG / VERSION |
| L-2 Distill | `/retro` | always | At stage entry, before `/learn` | Engineering retro; captures what worked / didn't; output routes to `command-center/principles/{PRODUCT,DESIGN,BUILD,VERIFY}-PRINCIPLES.md` |
| L-2 Distill | `/learn` | always | After `/retro`; observations promoted to principles | Persist project learnings across sessions |

---

## Trigger taxonomy

- **`always`** — fire whenever the stage runs (subject to capability check + the stage's own skip rules)
- **`wave_type ∈ {...}`** — fire only when P-1 Decompose declared one of the listed types
- **`wave_touches ∈ {...}`** — fire only when P-1 scope-tags include any of the listed domains
- **`wave_size ∈ {...}`** — fire only when P-1 size rubric matches
- **`wave_complexity ∈ {...}`** — fire only when P-1 complexity flag matches

Wave classification fields are read from `process/waves/wave-<N>/stages/P-1-decompose.md` at stage entry. If a field is absent, the trigger evaluates to false (conservative skip).

---

## Cross-cutting invariants

### 1. `/qa` supplements the T-5 Playwright swarm; never replaces it.
The T-5 Playwright swarm is authoritative (persona discipline, network scanning, regression coverage). `/qa` is a fast smoke pass that catches obvious crashes before the full swarm.

### 2. Plan-review skills supplement the P-4 gate; never replace it.
`/plan-eng-review`, `/plan-design-review`, `/plan-devex-review`, `/autoplan` catch architecture / UX / DX failure modes that head-product / Karen / jenny don't. They fire BEFORE the P-4 gate verdict, not instead.

### 3. `/ship` and `/land-and-deploy` are optional; manual `git` + `gh` always works.
`/ship` adds version bump + CHANGELOG for formal-release waves. Manual `git commit` + `gh pr create` + manual CI watching is explicitly supported — `wave_type != release` doesn't require `/ship`.

---

## Stage-internal / available but unused

- **`/canary`** — invoked inline by the C-3 deploy & verify stage's canary phase when it runs (canary phase is conditional on real users > 1000; stage skip rule, not a routing-table row).
- **`/office-hours`, `/freeze`, `/guard`, `/pair-agent`, `/checkpoint`** — installed but not integrated into the wave loop. If a new wave surfaces a need for one, propose integration explicitly before using — don't invent stage routing rows ad hoc.

---

## Auto-invocation contract (orchestrator)

At stage entry:

1. Look up the stage's row(s) in the routing table above.
2. For each row: evaluate the `Trigger` against current wave context (read `process/waves/wave-<N>/stages/P-1-decompose.md`).
3. Capability check: skill must appear in `process/session/.capability-sheet.md` § Installed skills. If absent, log gap to the stage deliverable and skip.
4. For triggers that fire: spawn the skill at the moment specified in `When to invoke`. Multiple skills at the same stage fire in table-row order unless an inter-skill ordering rule (e.g., `/simplify` before `/review` at B-6) is documented.
5. For `manual` / founder-invoked skills: never auto-spawn. Stage runs without the skill unless founder explicitly invokes.

Under autonomous modes (`automatic` / `degenerate`), the orchestrator follows this contract without gating on founder approval per skill — capability-sheet presence + trigger match is sufficient. Founder retains override at any time per the active mode's rules.
