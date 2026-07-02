# Stage v12 — Install Execute: Resolve Every Delta From v11

## Purpose
Read v11's install-audit report and install every missing item. Loops until `claudomat doctor` returns clean (zero FAILs, zero EXTERNAL warns) AND every BOARD seat / Head / pre-built / bespoke agent / capability-sheet / AgentMail item is present.

## Prerequisites
- v11 complete (`process/session/onboarding/v11-install-audit.md` exists with categorized delta).
- `process/session/.last-wave-completed.yaml` carries `loop_state: install-pending`.
- READ `claudomat-brain/setup-tools/install.md` (entire Phase 3–8 — this stage is the executor).
- READ `claudomat-brain/setup-tools/agent-creator/agent-creator.md` (used for board / head / executor generation).

## Skip condition

If v11's delta report shows `total delta count == 0`: **short-circuit** — write a minimal `process/session/onboarding/v12-install-execute.md` recording "no delta; nothing to install" and exit immediately to v13.

## Actions

### Action 1 — Read the delta

Read `process/session/onboarding/v11-install-audit.md`. Categorize entries by install order (some categories have prerequisites — see Action 2).

### Action 2 — Install in dependency order

```
external-tool       (Phase 3–5) — CLIs / skills / MCPs / env vars must be present before agents can be generated
   ↓
prebuilt-collection (Phase 6a) — wholesale clones; gives us karen / jenny / executor agents that BOARD/Heads reference
   ↓
head                (Phase 6c) — generic, stack-agnostic; ready to fire on any wave
   ↓
board               (Phase 6b) — industry-expert needs `project.yaml: stack.industry_domain`; founder-proxy uses the fixed seed (no priming)
   ↓
bespoke-executor    (Phase 6d) — postgres-pro / react-specialist / etc. per stack-decisions.md
   ↓
capability-sheet    (Phase 7-final) — regenerated AFTER all agents are installed
   ↓
agentmail           (Phase 8) — inbox provisioning
```

Process per-category. Each category fires its install commands per `claudomat-brain/setup-tools/install.md`.

### Action 3 — Per-category install procedure

#### 3a. external-tool (Phase 3–5)

For each CLI / skill / MCP / env-var in the delta:
- Look up the install command from `claudomat-brain/setup-tools/install.md` for the cited phase.
- Fire the command (or instruct the founder via `AskUserQuestion` if the install requires interactive auth — `gh auth login`, `agentmail auth login`, OAuth flows, plugin marketplace UI, etc.).
- For env vars (AGENTMAIL_API_KEY / CEO_INBOX_ID / CEO_NOTIFY_EMAIL_TO / GEMINI_API_KEY): fire `AskUserQuestion` with options-and-custom (Set in shell rc / Set in .env / Set via secret manager / Custom); confirm export by re-checking shell env.

**Critical ordering for `gemini-deep-research` skill + `GEMINI_API_KEY`:** install BOTH before category 3c (heads), 3d (board), and 3e (bespoke-executor). Those categories invoke `agent-creator`, which depends on `gemini-deep-research` for Stage 1 research briefs. If skill is missing OR API key unset when agent-creator fires, agent generation degrades to manual brief drafting — silent quality loss the founder won't catch until the agents fail at runtime. Re-verify with `claudomat doctor` strict before proceeding to 3c.

#### 3b. claudomat-bundled + prebuilt-collection (Phase 6a)

Phase 6a has three sub-steps; install in order:

**Step 1 — claudomat-bundled** (FIRST, before any external clone):

```bash
mkdir -p ~/.claude/agents
shopt -s extglob
cp claudomat-brain/setup-tools/prebuilt-claudomat-agents/!(README).md ~/.claude/agents/
```

`cp` (without `-n`) is correct — claudomat owns these names, so re-installing the bundled cards is the canonical refresh path. (Steps 2–3 use `cp -n` so they never overwrite these.)

**Step 2 — VoltAgent**:

```bash
git clone --depth=1 https://github.com/VoltAgent/awesome-claude-code-subagents.git /tmp/voltagent
find /tmp/voltagent/categories -type f -name '*.md' -not -name 'README.md' \
  -exec cp -n {} ~/.claude/agents/ \;
rm -rf /tmp/voltagent
```

**Step 3 — DarcyEGB**: no-op. Six darcyegb cards (`karen`, `code-quality-pragmatist`, `ui-comprehensive-tester`, `jenny`, `task-completion-validator`, `ultrathink-debugger`) are claudomat-bundled in `claudomat-brain/setup-tools/prebuilt-claudomat-agents/` and land via Step 1 above. Upstream `darcyegb/ClaudeCodeAgents` has no LICENSE and was stale 9+ months at vendor time; see `prebuilt-claudomat-agents/README.md` "Upstream-vendored" section for attribution. (A 7th card, `claude-md-compliance-checker`, was historically vendored but removed in the `CLAUDE.md` / `project.yaml` split.)

`cp -n` (no-clobber) on step 2 protects claudomat-bundled cards from being overwritten if VoltAgent ever ships a same-named agent.

After install, re-run v11 Action 2 (both probe blocks) — confirm every named agent is present.

#### 3c. head (Phase 6c)

For each missing head, invoke `claudomat-brain/setup-tools/agent-creator/agent-creator.md` with `role: head` and the head-tag. Per agent-creator's pipeline:

- Stage 1: Gemini Deep Research brief on the head's domain.
- Stage 2: distillation pack.
- Stage 3: synthesize agent card → write to `~/.claude/agents/<head-tag>.md`.

agent-creator can be invoked in parallel for multiple heads. After each, verify via `[[ -f ~/.claude/agents/<head-tag>.md ]]`.

#### 3d. board (Phase 6b)

For each missing BOARD seat, invoke `claudomat-brain/setup-tools/agent-creator/agent-creator.md` with `role: board` and the seat-tag. Pass project context per the seat:

- `strategist` → `founder_bets` table rows (via `Bet — list live` recipe) — vision + bets.
- `industry-expert` → `project.yaml: stack.industry_domain` + `stack.compliance_regime`.
- `realist` → product-decisions.md (evidence-based decision history).
- `user-advocate` → user-flows.md + per-page-pd/.
- `risk-officer` → architecture/security.md + founder-stage.md.
- `counter-thinker` → competitive-benchmarks/ INDEX.md (Tier 1 + 2).
- `founder-proxy` → uses **fixed seed** at `claudomat-brain/setup-tools/agent-creator/founder-proxy-seed.md`. Skips Gemini Deep Research; Stage 3 only.

After each, verify via `[[ -f ~/.claude/agents/<seat-tag>.md ]]`. Also probe `founder-proxy` with `Agent(subagent_type=founder-proxy)` — confirm it spawns and grounds in `product-decisions.md` + `founder_bets` without error. A `HARD-STOP: must be human — no founder precedent in product-decisions or founder_bets` on a generic probe is EXPECTED this early (precedent accumulates over waves), not a failure.

#### 3e. bespoke-executor (Phase 6d)

For each missing executor implied by the stack-decisions.md delta, invoke `agent-creator.md` with `role: executor` and the appropriate domain pack. Pass project context per the executor (e.g., postgres-pro receives architecture/databases.md + Drizzle schema choices).

Update `command-center/AGENTS.md` § "Project-specific executors" with each new entry.

#### 3f. capability-sheet (Phase 7-final)

```bash
claudomat capabilities
```

Verify the regenerated sheet at `process/session/.capability-sheet.md` lists every agent now installed at `~/.claude/agents/` (no more "no global agent directory found" line).

#### 3g. agentmail (Phase 8)

If the AgentMail inbox isn't provisioned per `install.md` Phase 8, fire it now. Per Phase 8 procedure: provision the CEO inbox via `agentmail inbox create --label=ceo-<project>`, capture the inbox-id, export `CEO_INBOX_ID` env var, send a probe email to confirm two-way flow.

### Action 4 — Re-run audit until clean

After installing each category:

```bash
claudomat doctor --strict
```

If exit code != 0 OR any v11 probe action still reports MISSING items, return to Action 2 for the still-missing items. Iteration cap = 3 rounds. After cap, if items remain unresolvable autonomously (e.g., founder needs to manually run an interactive auth flow), fire `AskUserQuestion` with the residual list + options-and-custom (Founder handles X / Skip with documented risk / Custom).

### Action 5 — Write execution log

Write `process/session/onboarding/v12-install-execute.md`:

```markdown
# v12 Install Execute — <Project>

**Started:** <ISO-timestamp>
**Completed:** <ISO-timestamp>
**Iterations:** <count>
**Final delta:** 0   (or list residuals if any deferred)

## Per-category install audit

### external-tool
- <item> — installed (<command>)
- ...

### prebuilt-collection
- <agent-tag> — installed via VoltAgent
- ...

### head
- <head-tag> — generated via agent-creator at <ISO-timestamp>
- ...

### board
- founder-proxy --probe verified (spawns + grounds in product-decisions.md + founder_bets; a HARD-STOP on a generic probe is expected this early)
- <seat-tag> — generated via agent-creator at <ISO-timestamp>
- ...

### bespoke-executor
- <agent-tag> — generated via agent-creator at <ISO-timestamp>; added to AGENTS.md
- ...

### capability-sheet
- regenerated; <N> agents catalogued
- previous "no global agent directory" line removed

### agentmail
- inbox <id> provisioned; probe email sent + acknowledged

## Residual deferrals (if any)
- <item> — deferred. Reason: <founder choice>. Risk: <consequence>.
```

## Deliverable

- `process/session/onboarding/v12-install-execute.md` — execution audit log.
- All Phase 3–8 items installed (or residuals explicitly deferred with risk-log).

## Exit criteria

- `claudomat doctor --strict` returns exit code 0 (or only deferred items remain, each documented).
- Every BOARD seat (7), every Head (8 — 5 mask-pattern: head-product / head-designer / head-builder / head-tester / head-verifier; 3 spawn-pattern: head-ci-cd / head-learn / head-next), every pre-built collection agent, every bespoke executor implied by stack-decisions.md is present at `~/.claude/agents/`.
- Capability sheet regenerated and reflects current `~/.claude/agents/` content.

## Next

→ Return to `../onboarding-loop.md` → Stage v13 (handoff).
