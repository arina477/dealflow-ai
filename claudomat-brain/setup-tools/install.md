# Setup Tools — Installation Runbook

Claude-assisted runbook for bootstrapping a project onto claudomat. Read top-to-bottom; each phase has a decision point where Claude either acts on already-known context or asks the founder.

The **flexible** half of the install pipeline. The mechanical half is exposed by `bin/claudomat` (`init` / `sync` / `update` / `version` / `capabilities` / `doctor`). Everything that varies per project (which agents, CLIs, MCP servers, integrations) lives here.

---

## When this runs

- **Greenfield init.** First time onto claudomat. After `claudomat init` completes mechanical bootstrap, Claude reads this file and walks Phases 2–10 in order.
- **Mid-project catalog growth.** New agent tag / MCP server / CLI needed → the relevant section is read on-demand.
- **Refresh.** `claudomat sync` / `claudomat update` re-vendor the brain but do NOT re-run this runbook. Re-run only when a new install action is needed.

---

## Phase 1 — Mechanical bootstrap (CLI)

Run by `bin/claudomat init`. Idempotent on the brain copy; refuses to overwrite project-owned files.

1. **Vendor the brain.** Copy `<framework>/claudomat-brain/` → `./claudomat-brain/`. Pin `./claudomat-brain/VERSION` to the framework version.
2. **Copy brain-owned CLAUDE.md** (always overwrites — brain-owned, refreshed by every `claudomat sync`):
   - `<framework>/claudomat-brain/CLAUDE.md` → `./CLAUDE.md`
3. **Render templates** (only if target file does NOT already exist):
   - `<framework>/templates/project.yaml.template` → `./project.yaml`
   - `<framework>/templates/README.md.template` → `./README.md`
   - `<framework>/templates/.mcp.json.template` → `./.mcp.json`
   - `<framework>/templates/command-center/**` → `./command-center/**`
   - `<framework>/templates/design/**` → `./design/**`
4. **Scaffold `process/`:**
   ```
   process/session/
   process/session/updates/
   process/session/rituals/
   process/session/onboarding/
   process/session/monitors/
   process/waves/
   ```
5. **Append to `.gitignore`:**
   ```
   process/session/.autonomous-session
   process/session/.capability-sheet.md
   process/session/.loop-paused.yaml
   process/session/.loop-resume.yaml
   process/session/.last-wave-completed.yaml
   process/session/updates/.last-daily-checkpoint
   command-center/testing/test-accounts.md
   ```
6. **Print hand-off message** pointing Claude at this runbook starting at Phase 2.

Verify Phase 1 with `claudomat doctor` before proceeding.

---

## Phase 2 — Project context capture

Goal: fill in the placeholders in `./project.yaml` (`name`, `description`, `stack.*`, `quick_start.*`, `commands[]`, `merge_strategy`, `deploy_targets[]`, `test_users.local_dev[]`) so the rest of the runbook has project context. **Never edit `CLAUDE.md` to capture facts** — it is brain-owned and overwritten on every `claudomat sync`.

### What needs to be known

| `project.yaml` field | Used by |
|---|---|
| `name` (single-line scalar) | v13 step 2f README substitution; surfaced in PR descriptions, CI log prefixes, etc. |
| `description` (single-line scalar; no block-literal `\|` / `>`) | v13 step 2f README substitution; surfaced in agent-creator briefs (`product_description`) |
| `stack.repo_shape` (monorepo / single-package / other) | Phase 6 agents (architect-reviewer scoping), B-block fan-out planning |
| `stack.backend` (e.g., NestJS / FastAPI / Rails) | Phase 4 CLIs, Phase 6 agents (executors), Phase 5 MCP servers |
| `stack.database` (Postgres / MySQL / Mongo / SQLite) | Phase 4 CLIs, Phase 6 agents (postgres-pro vs mysql-pro), monitor templates |
| `stack.frontend` (Next.js / SvelteKit / Vue / etc.) | Phase 6 agents (react-specialist / vue-specialist / etc.) |
| `stack.shared_contracts` (Zod / OpenAPI / tRPC / none) | Phase 6 agents (contract regen at B-1), simplify skill conventions |
| `stack.deploy_platform` + `deploy_targets[]` (railway / vercel / netlify / aws / …) | Phase 4 CLIs, Phase 5 MCP, monitor templates, C-2 deploy verification |
| `stack.industry_domain` (marketplace / fintech / AI tooling / etc.) | Phase 6 BOARD bespoke generation (industry-expert reads this) |
| `stack.compliance_regime` (gdpr / hipaa / pci / soc2 / none) | Phase 6 BOARD bespoke generation (risk-officer reads this) |
| `merge_strategy` (squash / merge / rebase) | C-1 PR merge |
| `commands[]` (build / lint / test / typecheck) | C-1 PR conventions, simplify skill |
| `quick_start.*` (install / db_setup / run_dev) | T-4 integration tests, README.md |
| `test_users.local_dev[]` (labels + emails ONLY) | T-5 e2e, T-8 security. **Never includes passwords** (gitignored `command-center/testing/test-accounts.md` is the prod-fixture store) |
| Autonomous-mode plans (founder-review only / default / automatic / degenerate) — NOT stored in `project.yaml`, tracked at `process/session/.autonomous-session` | Phase 8 AgentMail setup (only needed if degenerate) |

### Procedure

1. Read existing `project.yaml` placeholder values. If all filled (no `_(fill in`, `_(...)_`, `"_(`, or `'_(` markers — matches doctor's regex and v13 step 4b's grep gate), skip to step 4.
2. For each empty field, ask the founder (one batched `AskUserQuestion`).
3. Write resolved values into `project.yaml` via Edit (replace each `_(fill in: …)_` marker).
4. **Finalize `./README.md`** by substituting `{{name}}` and `{{description}}` from the just-filled `project.yaml` — `claudomat init` rendered the template literally; this step replaces the markers. Identical to v13 step 2f (which handles greenfield); brownfield runs it here:

```bash
python3 - ./project.yaml ./README.md <<'PY'
import re, sys, pathlib

project_yaml, readme = sys.argv[1], sys.argv[2]
source = pathlib.Path(project_yaml).read_text()

def extract_scalar(key: str, src: str) -> str:
    for line in src.splitlines():
        m = re.match(rf'^{re.escape(key)}:\s*(.*)$', line)
        if not m:
            continue
        rest = m.group(1).rstrip()
        if not rest:
            return ''
        if rest[0] in ('"', "'"):
            quote = rest[0]
            close = rest.find(quote, 1)
            if close == -1:
                return rest[1:]
            return rest[1:close]
        return re.sub(r'\s+#.*$', '', rest).rstrip()
    return ''

name = extract_scalar('name', source)
description = extract_scalar('description', source)
for label, val in (('name', name), ('description', description)):
    if not val or val.startswith('_('):
        sys.stderr.write(f"ERROR: project.yaml {label} still unfilled — fix before continuing\n")
        sys.exit(1)

readme_path = pathlib.Path(readme)
readme_text = readme_path.read_text()
readme_text = readme_text.replace('{{name}}', name).replace('{{description}}', description)
readme_path.write_text(readme_text)
PY
```

5. Run `claudomat doctor` — schema validation must pass (enum constraints, required keys, no-password-in-test_users).
6. Confirm context summary in one paragraph; founder approves before Phase 3.

**Greenfield carve-out:** brand-new project (no codebase) → skip Phase 2, route to onboarding (`claudomat-brain/onboarding/onboarding-loop.md`) which handles project discovery before tech-stack decisions. Onboarding's v5 / v6b / v13 stages fill `project.yaml`; v13 step 2f does the README substitution. Runbook resumes at Phase 3 afterward.

---

## Phase 3 — Global CLIs

Stack-driven. Install only what the project's chosen stack requires. Skip irrelevant rows.

### Always-required

```bash
# psql — canonical Postgres client; brain reads/writes milestones/tasks/waves/founder_bets via psql
brew install postgresql   # or distro equivalent; only the psql client is required
# CLAUDOMAT_DB_URL must be exported with the claudomat_brain role's DSN before running waves.

# GitHub CLI — required for C-1 PR & CI (gh pr create + gh run list), C-2 merge
brew install gh   # or distro equivalent
gh auth login

# Python 3.10+ — required by P-4 review helper and Gemini Deep Research deps
python3 --version

# AgentMail CLI — required by Phase 8 setup (always). Powers ceo-agent email channel
# under degenerate AND any agent-to-founder notifications under other modes. Install
# regardless of whether degenerate mode is currently planned.
npm install -g agentmail-cli
agentmail auth login

# RTK (Rust Token Killer) — transparent CLI proxy, 60-90% token savings on dev ops
# (Optional but strongly recommended; see ~/.claude/RTK.md if installed.)
```

### Stack-conditional

| If project uses... | Install |
|---|---|
| Railway for deploy | Nothing to install — the brain talks to Railway over its GraphQL API (`https://backboard.railway.com/graphql/v2`) with `curl` + `jq`, using `RAILWAY_TOKEN` / `RAILWAY_PROJECT_ID` from the environment. Do **not** install the Railway CLI. See `claudomat-brain/monitors/railway-deploy.md` and C-2 Action 0. |
| Netlify for deploy | `npm install -g netlify-cli` then `netlify login` |
| Vercel for deploy | `npm install -g vercel` then `vercel login` |
| AWS CDK / CloudFormation | `npm install -g aws-cdk` + AWS CLI per platform |
| Postgres locally | `brew install postgresql@18` (or distro equivalent) |
| Stripe local testing | `brew install stripe/stripe-cli/stripe` |

Verify each install with `<cli> --version`. Record installed versions in `process/session/.capability-sheet.md` § CLIs at Phase 7.

---

## Phase 4 — Claude Code skills

Skills install at `~/.claude/skills/` (top-level + plugin-bundled). `process/session/.capability-sheet.md` § Installed skills indexes what's present (regenerated at Phase 7 + every session start). Stage routing lives in `claudomat-brain/rules/skill-use.md`.

### Claudomat-bundled skills (FIRST — before gstack)

Skills bundled with the brain at `claudomat-brain/setup-tools/prebuilt-claudomat-skills/`. Install BEFORE gstack so claudomat owns the namespace.

Currently bundled:

- **`simplify`** — re-packaged from Anthropic's official `code-simplifier` agent (<https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md>). gstack ships `codebase-simplifier` (full-codebase, fork-context) but not `simplify` (recent-diff, in-process). claudomat needs both: `/simplify` fires at B-6 review per `claudomat-brain/blocks/build/build.md`.

```bash
mkdir -p ~/.claude/skills
for skill_dir in claudomat-brain/setup-tools/prebuilt-claudomat-skills/*/; do
  skill_name="$(basename "$skill_dir")"
  mkdir -p "$HOME/.claude/skills/$skill_name"
  cp -r "$skill_dir"* "$HOME/.claude/skills/$skill_name/"
done
```

Verify:

```bash
[[ -f ~/.claude/skills/simplify/SKILL.md ]] && echo "OK simplify" || echo "MISSING simplify"
```

`cp` (without `-n`) IS correct here — claudomat owns these skill names. gstack wholesale install in the next subsection uses `cp -n` so it can't overwrite.

See `claudomat-brain/setup-tools/prebuilt-claudomat-skills/README.md` for the discipline rule on adding skills.

### Always-on (gstack collection — install wholesale)

The **gstack** collection ships every claudomat project's baseline. Install in full — partial breaks routing-table assumptions in `claudomat-brain/rules/skill-use.md`. Update via `gstack-upgrade`.

Core gstack skills the wave loop fires automatically:

- `/careful` — Bash PreToolUse hook for destructive commands
- `/investigate` — root-cause investigation skill
- `/review` — pre-PR review skill
- `/qa` — headless smoke test
- `/simplify` — complexity reduction at B-6
- `/ship` — formal-release PR workflow
- `/land-and-deploy` — CI + deploy + canary watch
- `/document-release` — post-ship doc sync
- `/learn` — persistent project learnings
- `/retro` — engineering retrospective
- `/plan-ceo-review` / `/plan-eng-review` / `/plan-design-review` / `/plan-devex-review` / `/autoplan` — plan-review family
- (`/simplify` and `/aidesigner` live in claudomat-bundled skills — `/simplify` above, `/aidesigner` in the "claudomat-bundled" subsection below — NOT gstack)
- `/cso` — OWASP Top 10 + STRIDE threat model (fires conditionally per `wave_touches`, but skill itself is always installed)
- `/canary` — post-deploy canary monitor (skill installed always; C-3 canary phase runs conditionally on real-users threshold)

### Always-on — claudomat-bundled (no separate install)

- **`/gemini-deep-research`** — REQUIRED. Powers `agent-creator` Stage 1 research briefs (BOARD bench / Heads / bespoke executors generation depends on this). Without it, agent-creator falls back to manual brief drafting — slower, no grounded citations, weaker agent cards.

  **Source:** vendored from `github.com/Hongyu-yu/gemini-deep-research-skill` (MIT, © 2026 Hongyu Yu) into `claudomat-brain/setup-tools/prebuilt-claudomat-skills/gemini-deep-research/` — `LICENSE` preserved in-tree. Upstream repo has since been deleted; we are the canonical copy.

  **Install:** automatic. The "Claudomat-bundled skills" step at the top of Phase 4 already wholesale-copies `claudomat-brain/setup-tools/prebuilt-claudomat-skills/*/` into `~/.claude/skills/`, including the full `gemini-deep-research/` bundle (`SKILL.md` + `scripts/*.py` + `LICENSE`). No external `git clone`, no separate `uv venv` is run at install — the Python 3.10+ deps (`requests==2.34.2`, `httpx==0.28.1`) install on first use:

  ```bash
  cd ~/.claude/skills/gemini-deep-research
  uv venv
  uv pip install -r requirements.txt
  ```

  **Required env var (paid tier):** `GEMINI_API_KEY` (or `GOOGLE_API_KEY`). Deep Research models (`deep-research-preview-04-2026` / `deep-research-max-preview-04-2026`) are paid-tier only.

  **Verify:**

  ```bash
  [[ -d ~/.claude/skills/gemini-deep-research ]] && echo "OK skill" || echo "MISSING skill"
  [[ -n "${GEMINI_API_KEY:-}${GOOGLE_API_KEY:-}" ]] && echo "OK key" || echo "MISSING key"
  ```

  **Enforcement:** `claudomat doctor` checks the skill directory (always present after a fresh `init` / `sync`, since it's bundled) and the env var. The env var remains an EXTERNAL warn — strict-mode (used by v0 Action 0 + v13 Action 0) refuses to proceed if the API key is missing. The skill itself can no longer be missing in a healthy install; if `~/.claude/skills/gemini-deep-research/` is absent, `claudomat sync` restores it.

- **`/aidesigner`** — REQUIRED for any project with a D-block / UI work. Generates single-file HTML mockups from a design brief via aidesigner.ai's REST API. Used at D-2 Variants (initial generation), D-3 refine loop (back-edge), and v7 design direction / v8 design system / v9 page designs onboarding stages.

  **Source:** authored in-tree at `claudomat-brain/setup-tools/prebuilt-claudomat-skills/aidesigner/`. Calls `POST https://api.aidesigner.ai/api/v1/generateDesign` directly via `curl` — no MCP server, no `npx`-launched process. See [`prebuilt-claudomat-skills/aidesigner/SKILL.md`](./prebuilt-claudomat-skills/aidesigner/SKILL.md) for the API contract + recipes.

  **Install:** automatic. The "Claudomat-bundled skills" step at the top of Phase 4 wholesale-copies `claudomat-brain/setup-tools/prebuilt-claudomat-skills/*/` into `~/.claude/skills/`, including `aidesigner/SKILL.md`. No external clone, no npm install.

  **Required env var:** `AIDESIGNER_API_KEY`. Bearer-auth token. Get from aidesigner.ai → Settings → API Keys.

  **Verify:**

  ```bash
  [[ -d ~/.claude/skills/aidesigner ]] && echo "OK skill" || echo "MISSING skill"
  [[ -n "${AIDESIGNER_API_KEY:-}" ]] && echo "OK key" || echo "MISSING key"
  ```

  **Enforcement:** `claudomat doctor` checks the skill directory (always present after a fresh `init` / `sync`) and the env var. The env var is an EXTERNAL warn in `doctor`; the Studio-managed deploy makes it HARD-required — `new-client.mjs` aborts at provisioning if absent, and `worker-entrypoint.sh` refuses to start the brain-worker if absent at boot.

### Conditional (install only if stack matches)

- `/health` — code-quality dashboard for projects with full lint/test infrastructure
- `/design-review`, `/design-shotgun`, `/design-html`, `/design-consultation` — design-heavy projects (UI-first; not all projects need the full design family)

### Procedure

1. List installed skills: `ls ~/.claude/skills/`.
2. For each always-on skill NOT installed, install per the skill's repo / vendor instructions (gstack: `gstack-upgrade` or repo install).
3. For conditional skills, check stack against `project.yaml: stack.*`. Install if matched; record skip with reason if not.
4. Skill inventory is auto-populated by `claudomat capabilities` at Phase 7. No hand-edits required — stage routing lives in `claudomat-brain/rules/skill-use.md`.

---

## Phase 5 — MCP servers

MCP servers configured at `.mcp.json` (project root) or per-machine `~/.mcp.json`. Each provides one or more `mcp__<server>__<method>` tools.

### Always-required

- **Playwright MCP — 10 instances**, named `playwright-1` through `playwright-10`. Required for T-5 E2E tester-swarm parallelism + T-6 Layout + roadmap-planning-ritual's competitive sweep (3 parallel agents on `playwright-3 / 4 / 5`). Configure all 10 — partial allocation breaks swarm patterns documented in `command-center/testing/test-writing-principles.md` § 15.6.

> **Note:** aidesigner is NOT an MCP server — it's a claudomat-bundled skill at `~/.claude/skills/aidesigner/` that calls aidesigner.ai's REST API directly with `AIDESIGNER_API_KEY`. See Phase 4 above for the skill; see [`prebuilt-claudomat-skills/aidesigner/SKILL.md`](./prebuilt-claudomat-skills/aidesigner/SKILL.md) for the API contract.

### Conditional

| If project uses... | Install MCP |
|---|---|
| Domain registration via Dynadot | `domain-mcp` |
| Railway deploys (alternative to CLI) | `railway-mcp` |
| Linear for ticketing | `linear-mcp` |
| GitHub via API (alternative to `gh` CLI) | `github-mcp` |
| Slack notifications | `slack-mcp` |
| Lucid diagrams | `lucid-mcp` |

### Procedure

1. List configured MCPs from `.mcp.json` and `~/.mcp.json`.
2. For each conditional row matching project's stack, install + auth per the MCP server's instructions.
3. MCP-server inventory is auto-populated by `claudomat capabilities` at Phase 7 (read directly from `.mcp.json` + `~/.mcp.json`). No hand-edits required.

---

## Phase 6 — Agent installation

Two install modes:

1. **Pre-built collections (Phase 6a)** — installed wholesale; agents already authored, no Gemini Deep Research per agent.
2. **Project-bespoke (Phases 6b–6e)** — generated via `claudomat-brain/setup-tools/agent-creator/agent-creator.md` (research → distill → synthesize) per the project's stack and domain.

Phase 6a runs FIRST. Bespoke phases reference catalog agents; missing collection agents would force unnecessary agent-creator passes.

### 6a — Pre-built agent collections (always; install wholesale)

Install every collection in full — `command-center/AGENTS.md` references agents by name (`architect-reviewer`, `ux-researcher`, `risk-manager`, `competitive-analyst`, `product-manager`, `ui-comprehensive-tester`, `trend-analyst`, etc.). Partial installation breaks BOARD reading lists (`claudomat-brain/management/board-members.md`) and roadmap-planning-ritual's parallel `ui-comprehensive-tester` swarm.

#### Step 1 — Claudomat-bundled agents (FIRST — before any external collection)

Claudomat ships a set of internal load-bearing agent cards at `claudomat-brain/setup-tools/prebuilt-claudomat-agents/` (per-card per-rationale lives in that directory's README). Install BEFORE external collections so claudomat owns the namespace:

```bash
mkdir -p ~/.claude/agents
shopt -s extglob
cp claudomat-brain/setup-tools/prebuilt-claudomat-agents/!(README).md ~/.claude/agents/
```

Verify (iterate the source directory so the check tracks whatever cards ship — no hardcoded name list to drift):

```bash
for f in claudomat-brain/setup-tools/prebuilt-claudomat-agents/*.md; do
  [[ "$(basename "$f")" == "README.md" ]] && continue
  a="$(basename "${f%.md}")"
  if [[ ! -f "$HOME/.claude/agents/${a}.md" ]]; then
    echo "ERROR: prebuilt agent $a was not installed" >&2
    exit 1
  fi
done
# Every prebuilt card must exist in ~/.claude/agents/ before proceeding to step 2.
```

The VoltAgent clone in step 2 MUST use `cp -n` (no-clobber) so it never overwrites the bundled claudomat cards. The darcyegb-set (`karen`, `code-quality-pragmatist`, `ui-comprehensive-tester`, `jenny`, `task-completion-validator`, `ultrathink-debugger`) is **vendored** into `prebuilt-claudomat-agents/` per the table in that directory's README and lands as part of step 1 above — no separate external clone needed. (The 7th darcyegb card, `claude-md-compliance-checker`, was removed in the `CLAUDE.md` / `project.yaml` split — its checks targeted generic Anthropic-style rules that aren't in claudomat's CLAUDE.md.)

See `claudomat-brain/setup-tools/prebuilt-claudomat-agents/README.md` for the per-agent rationale + discipline rule for adding agents (separate sections for claudomat-internal vs upstream-vendored).

#### Step 2 — VoltAgent — `awesome-claude-code-subagents`

Source: <https://github.com/VoltAgent/awesome-claude-code-subagents>

Two install paths:

**Option A — agent-installer skill** (interactive; browse and pick categories):

```bash
# Spawn the agent-installer agent — walks the categorized repo and installs selected agents.
# Useful when you want to selectively install rather than wholesale.
Agent(subagent_type=agent-installer)
```

**Option B — wholesale clone + copy** (recommended for claudomat init):

```bash
mkdir -p ~/.claude/agents
git clone --depth 1 https://github.com/VoltAgent/awesome-claude-code-subagents /tmp/voltagent-install
# Copy every category's .md agent cards to the global agents dir.
# IMPORTANT: -n flag prevents overwriting claudomat-bundled cards from step 1.
find /tmp/voltagent-install/categories -type f -name '*.md' \
  -not -name 'README.md' \
  -exec cp -n {} ~/.claude/agents/ \;
rm -rf /tmp/voltagent-install
```

Verify:

```bash
ls ~/.claude/agents/architect-reviewer.md ~/.claude/agents/ux-researcher.md \
   ~/.claude/agents/risk-manager.md ~/.claude/agents/competitive-analyst.md \
   ~/.claude/agents/product-manager.md \
   ~/.claude/agents/trend-analyst.md
# All 6 must exist; missing any breaks BOARD or roadmap-planning-ritual.
# (Note: `ui-comprehensive-tester.md` is also shipped by VoltAgent, but claudomat owns it —
#  it lands via Step 1's wholesale copy; Step 2's `cp -n` is a no-op for that tag.)
```

#### Step 3 — DarcyEGB (legacy external path — now vendored)

Previously this step cloned <https://github.com/darcyegb/ClaudeCodeAgents> and `cp -n`'d its `.md` cards into `~/.claude/agents/`. The upstream repo had no `LICENSE` file and went 9+ months without commits, so the six remaining cards are now **vendored** into `claudomat-brain/setup-tools/prebuilt-claudomat-agents/` (`karen` / `code-quality-pragmatist` / `ui-comprehensive-tester` / `jenny` / `task-completion-validator` / `ultrathink-debugger` — the 7th, `claude-md-compliance-checker`, was retired in the `CLAUDE.md` / `project.yaml` split). See that README's "Upstream-vendored" table for attribution and the documented divergence-from-upstream policy (cross-references to the retired 7th card were stripped). Step 1's wholesale copy already covers them — no separate clone or `cp -n` is run here.

If you ever need to re-sync from upstream (e.g., the author adds a LICENSE and resumes work), the procedure is documented in `prebuilt-claudomat-agents/README.md` under the vendored-cards discipline rule. Until then, nothing to do at this step.

#### Catalog update

After Phase 6a step 2 (VoltAgent), regenerate `command-center/AGENTS.md` so the project catalog reflects available agents. Either run `claudomat capabilities` (Phase 7) which builds the index, OR hand-edit AGENTS.md to append each agent's row per its frontmatter description.

#### Conflict handling

If VoltAgent ships an agent with the same tag as a claudomat-bundled card (e.g., both have `ui-comprehensive-tester` — VoltAgent's general-purpose one vs the vendored darcyegb one in `prebuilt-claudomat-agents/`), the claudomat-bundled card wins because step 1 runs first and step 2 uses `cp -n`. To pin a different version: edit the bundled card in-tree and commit, or remove the bundled `.md` so step 2's `cp -n` is the install source.

For BOARD members the brain references (`architect-reviewer`, `ux-researcher`, `risk-manager`, `competitive-analyst`, `product-manager`, `trend-analyst`), VoltAgent is canonical per `claudomat-brain/management/board-members.md`. The bundled `prebuilt-claudomat-agents/` does NOT ship those — they only come from VoltAgent.

### 6b — BOARD members (always; 7 fixed seats)

Per `claudomat-brain/management/board-members.md` § Composition:

1. `strategist`
2. `industry-expert`
3. `realist`
4. `user-advocate`
5. `risk-officer`
6. `counter-thinker`
7. `founder-proxy` (uses `claudomat-brain/setup-tools/agent-creator/founder-proxy-seed.md` instead of Gemini Deep Research)

Run agent-creator 7×, parameterized per role per `claudomat-brain/setup-tools/agent-creator/agent-creator.md` § "Required for `<role_class> == board`". founder-proxy bypasses Gemini per the carve-out.

Cards land at `~/.claude/agents/<member>.md`. Catalog updates at `command-center/AGENTS.md`.

### 6c — Heads (always; 8 fixed)

Every block uses head-X as a gate-only sub-agent (canonical contract in `claudomat-brain/management/board-members.md`). Spawned fresh at the block-exit gate stage to issue the verdict; the orchestrator carries no in-process persona.

1. `head-product` — gates P-block at P-4
2. `head-designer` — gates D-block at D-3
3. `head-builder` — gates B-block at B-6
4. `head-tester` — gates T-block at T-9
5. `head-verifier` — gates V-block at V-3
6. `head-ci-cd` — owns C-block (C-1 → C-2; outcomes externally-determined by CI/deploy/canary monitors)
7. `head-learn` — owns L-block (L-1 → L-2; lightweight observation + distill)
8. `head-next` — owns N-block (N-1 → N-3; short procedural close-out)

Run agent-creator 8× with `<role_class> == head`. Each produces an agent-card artifact at `~/.claude/agents/<tag>.md`. Per `claudomat-brain/setup-tools/agent-creator/agent-creator.md` § "Required for `<role_class> == head`".

Without the head card present at `~/.claude/agents/`, gate-stage spawn halts (`subagent_type` fails to resolve).

### 6d — Executors (project-specific)

Run agent-creator once per executor tag in `command-center/setup-tools/tag-template.yaml` § active. Common executors:

- `postgres-pro` (or `mysql-pro` / `mongodb-pro` per database)
- `react-specialist` (or `vue-expert` / `svelte-expert` per frontend)
- `nextjs-developer` / `django-developer` / `fastapi-developer` / etc. per backend
- `typescript-pro` / `python-pro` / `golang-pro` / etc. per language
- `<sdk>-integration` per heavy SDK (`payment-integration`, `supertokens-integration`, etc.)

Decide which executors are needed by reading `project.yaml: stack.*` and the project's `package.json` / `Cargo.toml` / `requirements.txt` for declared dependencies.

### 6e — Verifiers

- `karen` (universal — load-bearing-claim verifier)
- `jenny` (universal — semantic-spec verifier)
- `code-quality-pragmatist` (recommended)
- `task-completion-validator` (recommended)
- Project-specific verifiers per agent-creator output

`karen` + `jenny` are referenced by every block-exit gate; install before the first wave.

### Procedure

For each agent in the resolved list:

1. Confirm tag does NOT already exist in `command-center/AGENTS.md`.
2. Run agent-creator per its 3-stage pipeline.
3. Verify card written to `~/.claude/agents/<tag>.md` and AGENTS.md row appended.

Total cost: ~$X-Y in Gemini Deep Research API calls (depends on executor count). Run in parallel batches where practical to compress wall-clock time.

### 6f — SessionStart hook (always; surfaces drift to orchestrator)

Claude Code reads `~/.claude/agents/*.md` at session start only — no mid-session re-scan. Without enforcement, host's cards drift from the brain (stale bundled cards, missing required heads, malformed frontmatter). Drift surfaces as silent gate-stage failures: the file is absent and Claude Code silently treats `subagent_type: head-X` as unrecognized.

**Wire `claudomat session-start` as a SessionStart hook** in `~/.claude/settings.json` (user-global) or `<project>/.claude/settings.json` (project-local; recommended only when claudomat is scoped to one project):

```json
{
  "hooks": {
    "SessionStart": [
      { "matcher": "*", "command": "claudomat session-start" }
    ]
  }
}
```

The hook runs `claudomat session-start` at every new session. Exact checks and exit behavior live in `cmd_session_start()` in `lib/claudomat/commands/hooks/session_start.bash`.

**Co-existence with other hooks:** `hooks.SessionStart` is an array. Append the claudomat entry to whatever's there (e.g., any third-party SessionStart hook). Single-element array → convert to multi-element form.

`claudomat doctor` checks for the SessionStart hook configuration; absent → WARN.

### 6g — Archive hook (optional; pushes session JSONLs to S3)

Per-machine opt-in. Skip this phase if you don't want session transcripts and `~/.claude/` machine state pushed to a central bucket.

**Source of truth.** Exact archive behavior lives in `lib/claudomat/commands/archive.bash` and `lib/claudomat/commands/archive/`; the hook payload and bucket layout live in `claudomat-brain/hooks/snapshot-sessions.sh`. Keep command validation, allowed characters, settings merge semantics, and smoketest details there.

**What it does.** Once installed, host-level Stop + SessionEnd hooks call `claudomat archive snapshot` for every Claude Code session on this machine. The snapshot hook pushes the current session transcript, current project's `memory/` directory, subagent/tool spill files for that session, and selected global `~/.claude` state.

**Prerequisites.** Install `rclone` on the machine doing archiving, keep `jq` available, and have an S3-compatible bucket reachable from this host. On macOS, `flock` is optional; without it, the hook logs a one-time warning and continues.

**Setup.** Run once per machine, never on shared CI:

```bash
claudomat archive setup
```

`setup` supports interactive input, `--from-stdin` JSON, env vars, and flags. It validates bucket access before writing config.

After setup, make sure the host hook script is mirrored, then wire the host settings:

```bash
claudomat sync                   # mirror brain → ~/.claude/{agents,skills,hooks}/ (only-if-differs; safe to re-run)
claudomat archive install        # wire Stop + SessionEnd hooks into ~/.claude/settings.json
```

**Operate.**

```bash
claudomat archive status         # show config, toggle state, recent log
claudomat archive snapshot       # run a one-off push (also fired automatically by hooks)
claudomat archive disable        # keep hooks wired, make them no-op
claudomat archive enable         # resume pushing
claudomat archive setup          # re-prompts; smoketest validates the new pair
claudomat archive uninstall      # remove only archive hook entries
```

`claudomat doctor` includes warn-only archive health checks when the machine is opted in.

### 6h — Autonomous-guard hook (auto-installed; no manual step)

No manual setup. The `autonomous-guard` Stop hook (`claudomat-brain/hooks/autonomous-guard.sh`) is auto-wired into `~/.claude/settings.json` on every `claudomat sync` — there is no separate install or uninstall command, by design (the hook is always-on for autonomous modes, a permanent part of claudomat). Users diffing `~/.claude/settings.json` after sync should expect to see a new `.hooks.Stop[]` entry tagged with the marker `_claudomat_autonomous_guard: true`. See `claudomat-brain/hooks/README.md` for the contract.

### 6i — DB-readiness hook (auto-installed; no manual step)

No manual setup. The `db-readiness` SessionStart hook (`claudomat-brain/hooks/db-readiness.sh`) is auto-wired into `~/.claude/settings.json` on every `claudomat sync`. It is project-scoped: outside a tree containing `claudomat-brain/`, it exits silently; inside one, it requires `CLAUDOMAT_DB_URL` to be set to a postgres-shaped URL. Exact behavior lives in the hook script and `_db_readiness_install` in `lib/claudomat/commands/hooks/permanent_hooks.bash`.

### 6j — Railway-guard hook (auto-installed; no manual step)

No manual setup. The `railway-guard` PreToolUse(Bash) hook (`claudomat-brain/hooks/railway-guard.sh`) is auto-wired into `~/.claude/settings.json` on every `claudomat sync`. It hard-blocks any attempt to install or invoke the Railway CLI and redirects the model to the Railway GraphQL API (`claudomat-brain/monitors/railway-deploy.md`); it is inert on non-Railway Bash commands (it allowlists the approved GraphQL host and the `RAILWAY_*` env vars). Exact behavior lives in the hook script and `_railway_guard_install` in `lib/claudomat/commands/hooks/permanent_hooks.bash`.

---

## Phase 7 — Capability sheet generation

```bash
claudomat capabilities
```

Writes `process/session/.capability-sheet.md` — the single source of truth for: installed agents, installed skills (top-level + plugin-bundled), MCP servers, stage routing (lifted from `claudomat-brain/rules/skill-use.md`), and a drift report against `command-center/AGENTS.md`. Always-on rule #11 requires this file before any sub-agent spawn.

Regenerated automatically at session start (DISPATCHER step 0) when missing or older than 60 minutes. CLI overwrites; no diff merging.

If the drift report is non-empty, resolve before entering the wave loop:
- Cataloged agents missing from `~/.claude/agents/` → install per Phase 6.
- Case mismatches → rename one side.
- Bundled-agent paths unresolved → likely brain-pin drift; run `claudomat sync`.
- Brain-referenced skills not installed → install or remove the brain reference.

---

## Phase 8 — AgentMail setup (always)

Set up on every project regardless of mode plans. Under `degenerate` it powers ceo-agent ↔ founder per-decision email; under other modes the inbox is available for any agent-to-founder notification (charter proposals, halt events, digest sends). Install-time setup avoids a stop-the-world step when a project later switches to `degenerate` or needs an out-of-session founder ping.

### 8a — Custom domain registration at AgentMail

1. Pick a subdomain for ceo-agent, e.g., `ceo@<your-domain>`.
2. Register the domain at AgentMail per their docs.
3. Apply DNS records at the domain registrar:
   - SPF (TXT)
   - DKIM (TXT)
   - DMARC (TXT)
   - MX records pointing to AgentMail's mail servers
4. Verify propagation: `dig <domain> TXT` and `dig <domain> MX` from a third-party resolver (e.g., 8.8.8.8).
5. Trigger AgentMail verification: `agentmail domains verify <domain>`.

### 8b — Create the ceo-agent inbox

```bash
agentmail inboxes create --name "ceo-agent" --address "ceo@<your-domain>"
# Output includes inbox_id like inb_abc123
```

### 8c — Export env vars

Add to `~/.bashrc` (or shell-specific equivalent):

```bash
export AGENTMAIL_API_KEY=am_us_xxxxxxxxxxxx
export CEO_INBOX_ID=inb_abc123
export CEO_NOTIFY_EMAIL_TO=<founder's email>
export CEO_NOTIFY_PROJECT_NAME="<project>"  # optional; shows in subject lines
```

### 8d — Verify

```bash
agentmail --version                                # expect 0.7.x or higher
agentmail --format json inboxes list | head -20    # expect a JSON array
agentmail inboxes get --inbox-id "$CEO_INBOX_ID" --format json    # expect the inbox object
```

### 8e — Probe ceo-agent spawn

`Agent(subagent_type=ceo-agent)` with `--probe` directive. Should return within 60s and write a probe entry to `process/session/updates/ceo-digest-<DATE>.md`.

`degenerate`-mode entry refuses to activate if any of these AgentMail setup steps fail, OR if any of the other prerequisites in `claudomat-brain/management/degenerate-mode.md` § 1 fail (13-item checklist total).

---

## Phase 9 — Onboarding entry OR first-wave seed

### Greenfield (no existing codebase)

Run the onboarding loop at `claudomat-brain/onboarding/onboarding-loop.md` (15-stage pre-launch sequence v0 → v13). Onboarding produces:

- Vision + competitive scan + product scope (v0–v4)
- Stack selection + architecture (v5–v6b)
- Design direction + design system + page designs (v7–v9)
- Milestones + tasks (DB-resident) + product-decisions (v10)
- **Install audit (v11) → install execute (v12) → final verify + handoff (v13)**

The trailing v11 → v12 → v13 trio is **REQUIRED** for greenfield because:

- Phase 6a (pre-built collections — claudomat-bundled + VoltAgent) and Phase 6c (Heads — stack-generic) CAN run pre-onboarding.
- Phase 6b (BOARD bench — `industry-expert` needs industry domain, `risk-officer` needs founder-stage) and Phase 6d (bespoke per-stack executors — `postgres-pro` / `react-specialist` etc.) CANNOT run until v0–v10 produce the project context they consume.
- Phase 7 (capability sheet) must regenerate AFTER all agents are installed.

Pre-onboarding install order (run from this runbook before invoking the onboarding loop):

```
Phase 1 (init) → Phase 2 (project.yaml context — minimal) → Phase 3 (CLIs) →
Phase 4 (skills) → Phase 5 (MCPs) →
Phase 6a (pre-built collections) → Phase 6c (Heads only — stack-generic) →
Phase 7-baseline (capability sheet pre-onboarding snapshot) →
Phase 8 (AgentMail) → Phase 9 (this — enter onboarding loop)
```

Post-onboarding install order (executed automatically by onboarding v11 → v12 → v13):

```
v11 audit → v12 execute (Phase 6b BOARD + Phase 6d bespoke executors +
            Phase 7-final capability-sheet refresh +
            any Phase 3–8 items still missing) →
v13 final verify (Phase 10 doctor) → flip loop_state: ready → wave loop opens
```

After v13's `loop_state: ready` flip, wave loop opens; first wave starts at `process/waves/wave-1/` via DISPATCHER step 0.

### Brownfield (existing codebase)

Skip onboarding entirely. Manually seed the first wave:

1. Run the full pre-onboarding install order above (Phase 1 → Phase 8) — same as greenfield, but includes Phase 6b/6d at install time since project context already exists in `project.yaml`.
2. Run Phase 10 verification.
3. Author the first task via the `Task — add` recipe (`claudomat-brain/db/SCHEMA.md`) — INSERT a row into the `tasks` table with title = `<initial wave goal>`, status `todo`.
4. Set `process/session/.last-wave-completed.yaml` with `loop_state: ready`, `next_wave_seed_task: <task-id>`, and `next_wave_bundled_siblings: []` (populate the siblings array via inline `SELECT id FROM tasks WHERE parent_task_id = '<seed-id>' AND status='todo' ORDER BY created_at` if the seed has bundled children — `claudomat-brain/db/SCHEMA.md` § Operation naming explains that recipe labels are reading anchors, not a separate catalog).
5. Either invoke the wave loop manually or, under `automatic` / `degenerate`, the loop picks up the seed at next tick.

---

## Phase 10 — Verification

Run `claudomat doctor --strict` to confirm:

- `CLAUDE.md` exists (brain-owned; identical to `claudomat-brain/CLAUDE.md` after most recent sync)
- `project.yaml` exists and validates clean against schema (required keys + enum constraints satisfied; no passwords/secrets under `test_users.local_dev[]`). Placeholders (`_(fill in)_`) stay WARN even under strict — v13 step 4b's pre-commit `grep` is the all-filled gate; brownfield runs the README/project.yaml substitution at Phase 2 step 4 above.
- `claudomat-brain/VERSION` matches framework version
- `command-center/` skeleton present (AGENTS.md, principles/, product/, etc.)
- `process/session/` and `process/session/updates/` exist
- `command-center/AGENTS.md` lists 7 BOARD members + 8 heads (gate-only) + executors + verifiers (and underlying agent cards exist at `~/.claude/agents/`)
- `process/session/.capability-sheet.md` is fresh (regenerated post-Phase-6 — must show all installed agents, not "no global agent directory found")
- All required CLIs respond to `--version`
- All required MCP servers reachable
- AgentMail prerequisites pass (always — even if `degenerate` not planned)
- For greenfield: `process/session/onboarding/onboarding-complete-<DATE>.md` exists; `loop_state: ready`

`doctor` halts on FAIL or (in strict mode) on EXTERNAL warns. If clean, Phase 10 also writes `loop_state: ready` to `process/session/.last-wave-completed.yaml` (greenfield: v13 already did this; brownfield: first time).

If any FAIL: re-read the relevant phase; re-run the action; re-verify. Do NOT enter the wave loop with `loop_state: install-pending` — DISPATCHER step 0 refuses anyway.

### Recovery: project found in `install-pending` state mid-flight

If `loop_state` is stuck at `install-pending` (e.g., onboarding ran but v12 didn't complete; or post-v13 drift broke an agent install), recover by:

1. Re-fire `process/session/onboarding/v11-install-audit.md` action sequence (or just `claudomat doctor` strict to enumerate the gap).
2. Re-fire `v12-install-execute.md` action sequence to install missing items.
3. Re-fire `v13-handoff.md` Action 0 (strict doctor); on clean, flip `loop_state: ready`.

This is the same v11 → v12 → v13 trio executed outside the initial onboarding context. Orchestrator may run them autonomously without founder gating IF the install items don't require interactive auth (`gh auth login`, plugin marketplace UI, etc.). For interactive items: poll the founder via `AskUserQuestion` per options-and-custom.

---

## Idempotency contract

Re-running this runbook after partial completion is safe IF each phase's procedure is followed:

- **Phase 1** — `claudomat init` refuses to overwrite existing `command-center/` / `project.yaml` / `README.md` / `design/`. Brain vendoring and CLAUDE.md copy are idempotent (always overwrite — both brain-owned).
- **Phase 2** — Reading existing `project.yaml` context is idempotent; only empty fields trigger founder questions.
- **Phase 3 / 4 / 5** — Each CLI / skill / MCP install is checked before installation. Already-present items skipped.
- **Phase 6** — `agent-creator.md` short-circuits to Stage 2 if a recent research archive exists (`--refresh` flag bypasses).
- **Phase 7** — Capability sheet always overwrites; no merge needed.
- **Phase 8** — DNS / inbox checks idempotent; env-var exports replace prior values.
- **Phase 9 / 10** — Onboarding is one-time (skipped on re-run if `process/session/onboarding/onboarding-complete-<DATE>.md` exists). Verification re-runs cleanly.

---

## Updating this document

Append project-specific install steps to the relevant phase rather than creating side documents. New phase genuinely needed (e.g., new infrastructure layer) → add as Phase 11+; never reorder existing phases (downstream references break).
