# Stage v13 — Handoff: Final Verify + git/CI + Initial Commit + Wave-Loop Open

## Purpose
Last onboarding stage. Final-verify v12's install execution, write CI workflow + status-check seed + test-accounts, scrub secrets, initial commit, push, write the onboarding-complete marker, and **flip `loop_state: ready`** — the only stage authorized to do so. After this stage, the wave loop is open.

## Prerequisites
- v12 complete (`process/session/onboarding/v12-install-execute.md` exists with `Final delta: 0` or only documented residuals).
- `process/session/.last-wave-completed.yaml` carries `loop_state: install-pending` (set by v11; v13 flips to `ready` at exit).
- Repo exists locally.

## Actions

### Action 0 — Final verify (HARD GATE)

Run strict doctor one more time. Every install item from v12 must be present; no EXTERNAL warns; `project.yaml` schema must be valid:

```bash
claudomat doctor --strict
```

If exit code != 0:
- STOP. Do NOT proceed.
- Surface still-missing items verbatim from doctor output.
- Route back to v12 Action 4 loop until v12 closes clean.

If exit code == 0: proceed. The strict-pass at v13 entry is the contract that wave-1 starts with a complete agent catalog, all external dependencies wired, and `project.yaml` schema valid (required keys present, enum values valid, no leaked passwords in `test_users.local_dev[]`).

> **Scope of this HARD GATE.** Strict mode treats EXTERNAL warns as fatal (missing CLIs / skills / MCPs / agent cards) and runs full `project.yaml` schema validation (`validate_project_yaml()` — required keys, enums, password-leak guard, block-literal description rejection). **`_(fill in)_` placeholders are WARN-only at this gate** — `test_users.local_dev[]` is still empty at this point in v13 (step 2d below fills it). The "all-filled" enforcement lives at **step 4b** (immediately before the initial commit), which grep-counts every remaining placeholder and refuses to commit if any are found. `name` / `description` get an additional hard-block at step 2f (the README substitution Python refuses to write placeholders into README.md).

### 1. Git state check

```bash
git status
git log --oneline -5 2>/dev/null || echo "no commits yet"
```

If no `.git/` exists: `git init` + `git branch -M main`.

If commits exist from prior incremental snapshots: inventory them; the final commit closes out remaining unstaged work.

### 2. Ensure `.gitignore` is complete

`claudomat init` already wrote a baseline. Verify it includes all of:

```
# Session-scoped orchestrator state
process/session/.autonomous-session
process/session/.capability-sheet.md
process/session/.last-wave-completed.yaml
process/session/.loop-paused.yaml
process/session/.loop-resume.yaml
process/session/status-check.yaml
process/session/updates/.last-daily-checkpoint
command-center/testing/test-accounts.md

# Dependencies
node_modules/

# Build outputs
dist/
.next/
.turbo/

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
```

If any line is missing, append it. If the project has stack-specific outputs (Rails: `tmp/`, `log/`; Python: `__pycache__/`, `.venv/`; Rust: `target/`), append those per `command-center/dev/architecture/tools.md`.

### 2b. Author `command-center/principles/CI-PRINCIPLES.md` from v6 DevOps branch + founder Q&A

`claudomat init` rendered the scaffold; v13 populates the three configuration blocks (deploy_targets / canary / pr_conventions) using:

- `command-center/dev/architecture/devops.md` — deploy platform(s), healthcheck URLs, rollback commands per environment.
- `command-center/dev/architecture/security.md` — canary thresholds (error_rate_pct, p95_latency_delta_ms) for the security profile.
- `project.yaml: stack.deploy_platform` + `deploy_targets[]` — deploy-platform name + structured target list (resolves the `platform:` field and per-target health endpoints).

Where inferred values are ambiguous, fire ONE batched `AskUserQuestion` per block with options-and-custom. Examples:

> "Canary configuration. Pick the threshold profile:"
>
> 1. **Strict** — error_rate_pct: 0.5, p95_latency_delta_ms: 100. Suited for paying-customers / regulated-day-1.
> 2. **Standard** — error_rate_pct: 1.0, p95_latency_delta_ms: 200. Default for pilot-customer / paying-customers.
> 3. **Lenient** — error_rate_pct: 2.0, p95_latency_delta_ms: 500. Suited for self-use-mvp / pilot-customer.
> 4. **Disabled** — `enabled: false`. Skip canary phase at C-3; deploys go live unmonitored.
> 5. **Custom** — provide your own thresholds.

> "PR conventions. Pick attribution + auto-merge defaults:"
>
> 1. **Default** — AI attribution footer ON, auto-merge OFF.
> 2. **No attribution** — strip the AI footer; auto-merge OFF.
> 3. **Auto-merge after CI** — for trusted-author PRs only; AI footer ON.
> 4. **Strict gating** — require N reviewers + label; AI footer ON.
> 5. **Custom** — describe your conventions.

Update `CI-PRINCIPLES.md` blocks in place. C-1, C-3 will read this file at every wave.

### 2c. Seed `process/session/status-check.yaml`

Copy `claudomat-brain/management/status-check.yaml` template into `process/session/status-check.yaml`. Initial state: `STATUS: IDLE`, `current_wave: null`. The first tick under `automatic` / `degenerate` mode bootstraps the rest.

```bash
cp claudomat-brain/management/status-check.yaml process/session/status-check.yaml 2>/dev/null \
  || cp command-center/management/status-check.yaml process/session/status-check.yaml
```

This file is gitignored (already added by `claudomat init`). Exists locally so ceo-agent's `stall-monitor` directive can read it on the first tick without bootstrapping logic.

### 2d. Seed `command-center/testing/test-accounts.md` and `project.yaml: test_users.local_dev[]`

T-5 / T-8 hard-block on `test_pattern: blocked-on-credentials` if test accounts are missing. *How* they're provisioned is a **technical default** (always-on rule 17): unless the founder has already provided credentials or named an approach, default **silently** to creating them via the project's own signup flow at the first UI wave's B-5 — that needs no real credentials at handoff and avoids vendor lock-in to provider tooling.

**Default path — no founder input on test accounts (the common case):** do NOT poll. Write the planned approach to `project.yaml: test_users` as an empty local-dev array with a planning note — this is a concrete plan, NOT a deferral, so step 4b's placeholder gate passes:

```yaml
test_users:
  # Auto-provisioned via the project's own signup flow at the first UI wave's
  # B-5. No credentials needed at handoff. Re-fire v13 step 2d if you'd rather
  # provide accounts directly.
  local_dev: []
```

Append the plan to `product-decisions.md` (Status: Active — it's a plan, not a deferral):

```markdown
### [<YYYY-QN>] Test accounts — auto-provision via signup
**Category**: Testing
**Status**: Active
**Context**: v13 onboarding test-account seeding.
**Decision**: Test accounts are created through the project's own signup flow at the first UI wave's B-5 (one local-dev + one prod-fixture per v3 persona).
**Rationale**: No credentials needed at handoff; avoids vendor lock-in to provider tooling. T-5 / T-8 do not block — accounts exist before they're first needed.
**Next action**: First UI wave's B-5 scripts the signup endpoint.
```

Then announce one plain-language line:

> "Test accounts will be created automatically through the app's own signup the first time they're needed — nothing for you to provide now."

T-5 / T-8 will NOT block: the first UI wave's B-5 scripts the signup endpoint to provision one local-dev + one prod-fixture account per persona enumerated in v3, then writes them to the files below.

**Override path — founder provided creds or named an approach:** if the founder has already pasted credentials, or named a provisioning approach (their auth provider's admin tool, a specific custom flow), confirm how to seed via `AskUserQuestion`:

> "Test-account provisioning for live E2E and security probes. Pick how to seed credentials:"
>
> 1. **Provide accounts now** — paste credentials into chat; I'll write them to `command-center/testing/test-accounts.md` (gitignored, full creds) + `project.yaml: test_users.local_dev[]` (local-dev labels + emails ONLY, no passwords — schema-checked by `claudomat doctor`).
> 2. **Auto-create via my auth provider's tool** — I'll detect the provider from `architecture/security.md` and run the matching admin step (`supabase auth admin create`, `clerk users:create`, custom CLI / API call, etc.). Per persona × per environment.
> 3. **Auto-create via the project's own signup flow** (the default) — once dev env is up at first wave's B-5, I'll script the signup endpoint to provision N personas.
> 4. **Defer** — write empty `local_dev: []` array to `project.yaml: test_users` (no placeholders left in the committed file) and log to `product-decisions.md` as `Status: Deferred — resolve before first UI wave's T-5`. T-5 will block on `blocked-on-credentials` until resolved.
> 5. **Custom** — describe your provisioning approach.

For options 1 / 2: per persona enumerated in v3 (visitor / buyer / seller / admin / etc.), provision at minimum one local-dev account + one prod-fixture account. Write to:

- `command-center/testing/test-accounts.md` — full registry (passwords, identity-provider IDs, DB row IDs, auth rituals). Gitignored.
- `project.yaml: test_users.local_dev[]` — local-dev account labels + emails ONLY (no passwords, no tokens, no secrets, no prod accounts — `claudomat doctor` fails the schema if any forbidden key appears). Replace the `_(fill in)_` placeholders.

Option 3 is the silent default above — accounts are provisioned at the first UI wave's B-5, not here. For option 2, the orchestrator infers the provider command from `architecture/security.md`'s auth-section content; if multiple are present or the provider is custom-built, fall back to option 3 with a note.

For option 4 (Defer): replace the entire `test_users:` block in `project.yaml` with an empty-array form so step 4b's placeholder gate passes:

```yaml
test_users:
  # Deferred at v13. Re-fire v13 step 2d (or fill manually) before the first
  # UI wave so T-5 / T-8 stop blocking on `blocked-on-credentials`.
  local_dev: []
```

Then append to `product-decisions.md`:

```markdown
### [<YYYY-QN>] Test accounts deferred
**Category**: Testing
**Status**: Deferred — resolve before first UI wave's T-5
**Context**: v13 onboarding test-account seeding.
**Decision**: Test accounts will be provisioned just-in-time before the first wave that requires T-5.
**Rationale**: <founder's reasoning>
**Next action**: Re-fire v13 step 2d (or invoke `claudomat capabilities` + manual test-account flow) before the first UI wave starts.
```

### 2e. Author `command-center/management/ceo-blocklist.md` charter

`ceo-agent` (degenerate-mode decision body, bundled at `~/.claude/agents/ceo-agent.md`) reads the charter on every spawn. Charter expresses what the founder authorizes ceo-agent to do (silent = unlimited authority within hard invariants; restrictions bind). Without authoring, ceo-agent has unlimited charter authority — fine if the founder genuinely wants that, dangerous otherwise.

`claudomat init` rendered the scaffold. v13 populates with founder-chosen defaults derived from project context.

Fire `AskUserQuestion`:

> "ceo-blocklist.md charter — defines what `ceo-agent` may decide autonomously under `degenerate` mode. Pick:"
>
> 1. **Conservative defaults** — strict blocklist: routine wave decisions only; spend cap $0; reversible actions only; all destructive / payment / public-commitment routes to founder via per-decision email + reply-required. Suitable for founder-stage = `paying-customers` / `regulated-day-1` or risk-averse founders.
> 2. **Permissive defaults** — silent blocklist (unlimited within hard invariants from `degenerate-mode.md`): ceo-agent decides everything within charter, including modest spend (up to $100/wave, configurable), public commits, infrastructure changes. Per-decision email is informational, not gating. Suitable for founder-stage = `self-use-mvp` / `pilot-customer` and trust-the-loop founders.
> 3. **Skip charter authoring** — defer to first `degenerate` mode entry. mode-switching.md § First-entry will fire prerequisites check + author the charter then. Choose this if `degenerate` mode isn't planned for ≥30 days.
> 4. **Custom** — describe your authority model and I'll draft the charter; we'll iterate via Confirm / Refine / Cancel.

Per choice:

- **Conservative / Permissive** → write `command-center/management/ceo-blocklist.md` with the chosen template content. Inject project context: founder-stage value, vision, top bet, named compliance regime (if any from `project.yaml: stack.compliance_regime`). Cite `claudomat-brain/management/degenerate-mode.md` § Hard invariants verbatim (those override charter regardless).
- **Skip** → leave scaffold untouched; append entry to `product-decisions.md`:
  ```markdown
  ### [<YYYY-QN>] ceo-blocklist charter deferred
  **Category**: BOARD / ceo-agent
  **Status**: Deferred — author at first `degenerate` mode entry
  **Context**: v13 onboarding ceo-blocklist.md authoring.
  **Decision**: Charter scaffold ships unfilled; mode-switching.md § First-entry will block `degenerate` entry until charter is authored.
  **Risk**: First-time `degenerate` entry takes ~5 min longer (charter authoring) but prevents accidental unlimited-authority entry.
  ```
- **Custom** → fire `AskUserQuestion` with `Confirm / Refine / Cancel` after drafting; loop until founder approves.

Required for completeness even if `degenerate` isn't immediately planned — having charter authored upfront removes a friction point later.

### 2f. Finalize `./README.md` from `project.yaml`

`claudomat init` rendered `README.md` from `templates/README.md.template` with placeholder markers `{{name}}` and `{{description}}`. By v13, `project.yaml` is locked (v6b step 6 consolidated `name` + `description` along with the rest of the file). Substitute the two markers in place via a single Python pass that extracts the scalars from `project.yaml` (honoring quoted strings, in-line `#`-comments only when preceded by whitespace, and arbitrary metacharacters in the value) and writes them into `README.md` literally:

```bash
python3 - ./project.yaml ./README.md <<'PY'
import re, sys, pathlib

project_yaml, readme = sys.argv[1], sys.argv[2]
source = pathlib.Path(project_yaml).read_text()

def extract_scalar(key: str, src: str) -> str:
    # Find `^<key>:` line at column 0, capture the rest. `re.match` anchors
    # at position 0 of each line, so indented (nested) keys never match —
    # this parser only sees top-level keys. The `project.yaml` schema puts
    # `name` and `description` at column 0; every nested duplicate (e.g.
    # `commands[].name`, `commands[].description`) is indented by 4 spaces
    # and therefore invisible to this regex. `claudomat doctor` enforces
    # single-line scalars for `description` (block-literal `|`/`>` rejected),
    # so we only need to handle single-line plain/quoted scalars here.
    for line in src.splitlines():
        m = re.match(rf'^{re.escape(key)}:\s*(.*)$', line)
        if not m:
            continue
        rest = m.group(1).rstrip()
        if not rest:
            return ''
        # Quoted scalar: extract content between matching outer quotes.
        # YAML's `#`-comment rule does NOT apply inside quoted strings, so
        # `description: "Issue #42 tracker"` keeps the `#` intact.
        if rest[0] in ('"', "'"):
            quote = rest[0]
            close = rest.find(quote, 1)
            if close == -1:
                return rest[1:]  # unterminated; return what we have
            return rest[1:close]
        # Plain (unquoted) scalar: trailing `<whitespace>#…` is a comment.
        return re.sub(r'\s+#.*$', '', rest).rstrip()
    return ''

name = extract_scalar('name', source)
description = extract_scalar('description', source)

# Defend at the finalize point — v6b step 6 should have caught any unfilled
# values, but reject here too rather than silently writing placeholders into
# the README.
for label, val in (('name', name), ('description', description)):
    if not val or val.startswith('_('):
        sys.stderr.write(
            f"ERROR: project.yaml {label} still unfilled — block v13 exit "
            "(re-fire v6b step 6)\n"
        )
        sys.exit(1)

readme_path = pathlib.Path(readme)
readme_text = readme_path.read_text()
readme_text = readme_text.replace('{{name}}', name).replace('{{description}}', description)
readme_path.write_text(readme_text)
PY
```

If either substitution leaves `{{name}}` or `{{description}}` still in the file (e.g., founder skipped Phase 2 fields), block v13 exit with a critical finding pointing back at v6b step 6 — README must reflect final project facts before the initial commit.

After substitution, the README's project-specific docs table + Quick Start references resolve cleanly against `project.yaml`. README becomes project-owned thereafter — never re-rendered by `sync` / `init`.

### 3. CI workflow seed — options-and-custom

Default: write `.github/workflows/ci.yml` based on the v6 DevOps branch. For the claudomat baseline stack:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
        with: { version: 11.9.0 }
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  typecheck:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
        with: { version: 11.9.0 }
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      postgres:
        image: postgres:18
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: test }
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
        with: { version: 11.9.0 }
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
        with: { version: 11.9.0 }
      - uses: actions/setup-node@v6
        with: { node-version: 24, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

Every job has `timeout-minutes` + `permissions: contents: read` per `command-center/principles/BUILD-PRINCIPLES.md` discipline.

If v5 selected an override / custom stack, the CI workflow needs to match. Fire `AskUserQuestion`:

> "CI workflow draft generated for `<stack>`. Pick:"
>
> 1. **Approve as-is** — write `.github/workflows/ci.yml` and proceed.
> 2. **Adapt to my stack** — I'll regenerate using v6 DevOps branch as source of truth.
> 3. **Add jobs** — tell me which (e.g., E2E, security scan, deploy preview).
> 4. **Skip CI for now** — defer to first wave; commit without `.github/`. Logged as deferral in `product-decisions.md`.
> 5. **Custom** — paste your CI yaml or describe the jobs.

### 4. Scrub secrets

Before staging:

```bash
# Grep for credential patterns in staged content
git diff --cached | grep -iE 'api[_-]?key|secret|password|token|bearer|"sk-|"pk_'
```

Ensure `.env` files are NOT staged. Any credentials in `process/session/onboarding/docs-input/` that v0 captured verbatim should be moved to a gitignored location or redacted.

If anything suspicious appears, fire `AskUserQuestion` with options-and-custom (Redact / Move to gitignored / Confirm safe / Custom).

### 4b. Project-yaml all-filled gate (HARD GATE)

Before staging, `project.yaml` MUST contain zero `_(fill in)_` markers. By v13, every field is either filled with founder-approved values (v6b step 6 for name/description/stack/quick_start/commands/merge_strategy/deploy_targets; step 2d for test_users.local_dev[]) or explicitly emptied (step 2d Defer → `local_dev: []`). Run:

```bash
if grep -nE "_\(fill in|_\(\.\.\.\)_|\"_\(|'_\(" project.yaml; then
  echo "FAIL: project.yaml still has placeholders — fix before committing"
  exit 1
fi
echo "OK: project.yaml fully filled"
```

If any placeholder remains:
- STOP. Do NOT proceed to step 5.
- Surface the offending lines verbatim.
- Re-fire the upstream stage that owns each field (v6b step 6 or v13 step 2d) until placeholders are gone.

Rationale: `claudomat doctor` (including strict mode) treats placeholders as WARN — they're legitimate state during install/onboarding. But by the initial commit, every field MUST be resolved so wave-1 readers (C-1, C-2, agent-creator briefs, T-5/T-8) start with concrete values. This step is the single enforcement point.

### 5. Initial commit

Stage and commit everything produced during onboarding:

```bash
git add -A
git status --short
```

Review the file list. Expected top-level entries: `command-center/`, `design/` (if UI project), `process/`, `claudomat-brain/`, `.github/`, `.gitignore`, `CLAUDE.md`, `project.yaml`, `README.md`. (Tasks live in the Postgres `tasks` table, not on disk — no `.taskmaster/` directory.)

```bash
git commit -m "$(cat <<'EOF'
chore: initial project scaffold (claudomat onboarding v0-v13)

PRODUCT
- founder_bets + milestones rows in Postgres (v1) — vision, north star, H1/H2/H3 intents
- founder-stage.md (v1) — launch-stage flag (modulates compliance horizons)
- product-decisions.md (v10) — initial decisions from v5-v9 + resolved deferrals
- user-journey-map.md (v4) — page map + flow cross-reference
- per-page-pd/* (v4) — detailed product description per page

ARCHITECTURE
- dev/stack-decisions.md (v5) — locked tech stack
- dev/architecture/_library.md (v6b) — unified architecture reference
- dev/architecture/{modules,services,databases,sdks,tools,security,devops,test}.md (v6)
- dev/module-list.md (v6b) — locked module inventory

COMPETITIVE
- artifacts/competitive-benchmarks/ (v2) — tier-ranked evidence per competitor

DESIGN (UI projects only)
- design/direction.html (v7) — approved visual direction
- design/DESIGN-SYSTEM.md (v8) — tokens + module primitives
- design/<page>.html × N (v9) — per-page approved mockups

TASKS
- milestones + tasks rows in Postgres (DB-resident; `tasks.milestone_id` FK + free-form `description` prose with two YAML carve-outs per claudomat-brain/db/SCHEMA.md § tasks)

CI
- .github/workflows/ci.yml — baseline lint / typecheck / test / build jobs

The wave loop (claudomat-brain/DISPATCHER.md) is now ready.
First wave picks up via P-0 Frame, which queries `Task — next claimable` against the Postgres `tasks` table.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### 6. Push to origin — options-and-custom

```bash
git remote -v
```

If a remote exists:

```bash
git push -u origin main
```

If no remote configured, fire `AskUserQuestion`:

> "No `origin` remote configured. Pick:"
>
> 1. **Create new GitHub repo** — I'll run `gh repo create <name> --private --source=. --push` (requires `gh` auth).
> 2. **Add existing remote** — paste the URL; I'll `git remote add origin <URL>` and `git push -u origin main`.
> 3. **Local-only** — skip push; you'll wire the remote later.
> 4. **Custom** — describe how you want to wire the remote.

### 7. Write the handoff marker

First detect whether this brain is running **hosted** (claudomat-studio brain-worker) or **local** (plain `claude` on the founder's machine) — the onboarding→wave transition differs between them, and both the marker below (Action 7) and the founder-facing surface (7c) branch on it:

```bash
if [[ -n "${CLAUDOMAT_HOSTED:-}" || -n "${CLAUDOMAT_CLAUDE_SESSION:-}" ]]; then
  echo "hosted"   # brain-worker sets CLAUDOMAT_CLAUDE_SESSION on every spawn
                  # (claudomat-studio: deploy/worker/server/src/lib/spawn.ts).
                  # CLAUDOMAT_HOSTED=1 is the clean explicit contract Studio should also set.
else
  echo "local"    # no hosted signal → founder's own terminal
fi
```

Then write `process/session/onboarding/onboarding-complete-<YYYY-MM-DD>.md`:

```markdown
# Onboarding Complete — <Project>

**Completed:** <ISO-timestamp>
**Initial commit:** <sha>
**First wave seed:** <next-claimable `tasks` row id (from `Task — next claimable` recipe)>

## What exists
- Bets → `founder_bets` table in Postgres
- Roadmap (milestones) → `milestones` table in Postgres
- Tasks wired to milestones via `tasks.milestone_id` FK → `tasks` table in Postgres
- Founder stage + product decisions → `command-center/product/founder-stage.md` + `product-decisions.md` (FS)
- Competitor research (Tier 1/2/3) → `command-center/artifacts/competitive-benchmarks/`
- Architecture (8 domains + library) → `command-center/dev/architecture/`
- Design direction + system + per-page designs → `design/` (UI projects)
- CI pipeline → `.github/workflows/ci.yml`

## Next — enter the wave loop

Onboarding is done — the wave loop is open. To start the first wave, tell the orchestrator:

> "Start the first wave"

Or pick a specific task:

> "Run `Task — next claimable` on the DB"

`claudomat-brain/DISPATCHER.md` step 0 then reads `process/session/.last-wave-completed.yaml`, runs its preflight (capability-sheet refresh + `claudomat doctor`), and enters `claudomat-brain/blocks/product/product.md` → **P-0 Frame**.

**One-time agent load:** <one-time agent-load paragraph — LOCAL or HOSTED variant, per the environment detected in Action 7>

## Modes (post-onboarding)

To enter an autonomous mode, type the **mode-file name verbatim**:

- `default` — skip nice-to-haves; strategic + hard-stops to founder. No `/loop`.
- `automatic` — BOARD (7 seats) resolves ambiguity. Bootstraps `/loop`. Splits + hard-stops to founder.
- `degenerate` — ceo-agent within `command-center/management/ceo-blocklist.md` charter. Bootstraps `/loop`. Per-decision email; founder reached via ESC + chat / session message / digest.

Type `founder-review` (or delete `process/session/.autonomous-session`) to revert. Full spec: `claudomat-brain/management/mode-switching.md` § First-entry quick-start.
```

**Fill the `<one-time agent-load paragraph>` placeholder in the marker above with the matching prose below — insert the text only, not these labels — per the environment detected at the top of this action:**

- **Local —** The agents and MCP servers installed during onboarding load only at Claude Code **session start**; there is no in-session reload for `~/.claude/agents/` cards or root `.mcp.json` servers (`/reload-skills` and `/reload-plugins` don't cover them). Relaunch once before the first wave: run `claude --continue` (carries this conversation forward) or plain `claude` (brain state is durable on disk + Postgres, so wave-1 needs no in-conversation context). Skills don't need this — they hot-reload live. Then say "Start the first wave".
- **Hosted —** The agents and MCP servers installed during onboarding register only when the brain runs on a fresh process. On hosted, the worker recycles the brain once at this onboarding→wave boundary — send "Start the first wave" to begin. If the first wave reports a missing Head agent ("agent not found"), the brain was not recycled: restart or resume the session from Studio, then resend "Start the first wave".

### 7c. Surface the transition to the founder

Branch on the environment detected at the top of Action 7. **Either way: never present `/exit` / Ctrl-D as a step, and never make a manual restart the headline.** The need to (re)load the onboarding-installed agents is real — disk-written `~/.claude/agents/` cards and root `.mcp.json` servers are read only at Claude Code session start, with no in-session reload — but the *handoff* is into the wave loop, not a scary exit.

**Hosted run** (`CLAUDOMAT_HOSTED` or `CLAUDOMAT_CLAUDE_SESSION` set — the brain-worker sets the latter on every spawn): no `AskUserQuestion`, no `/exit`. The worker is responsible for recycling the brain at the onboarding→wave boundary (see the cross-repo dependency below). Close with:

> "Onboarding complete. Send **Start the first wave** to begin — on hosted, the worker recycles the brain once at the onboarding→wave boundary so the newly-installed agents register, then the wave loop opens (`claudomat-brain/DISPATCHER.md` → P-0 Frame). If the first wave reports a missing Head agent, the recycle didn't happen — restart or resume the session from Studio and resend."

> **Cross-repo dependency (hosted).** This clean hosted transition relies on a companion change in **claudomat-studio**: at the onboarding→wave boundary (the first dispatch after `loop_state: ready` was just set) the worker must spawn a fresh `claude --resume` instead of `tmux send-keys` into the still-live onboarding pane — typing into the old process does **not** load the freshly-written `~/.claude/agents/` cards, so wave-1's first Head spawn (P-4) fails with "agent not found". Until that ships, hosted wave-1 needs a manual session recycle. The claudomat change alone does not close the hosted path — see `CHANGELOG.md` / the PR.

**Local run** (no hosted signal): the founder relaunches once. Frame it as a quick, expected step. Fire `AskUserQuestion`:

> "Onboarding complete. One quick relaunch loads the agents installed during onboarding — they register only at Claude Code session start (skills hot-reload live; agents and MCP don't). Pick:"
>
> 1. **Relaunch now** — start a fresh Claude Code session: `claude --continue` (carries this conversation forward) or plain `claude` (brain state is durable on disk + Postgres — wave-1 needs no chat history). Then say "Start the first wave".
> 2. **Relaunch later** — I'll leave the handoff marker; relaunch when ready, then say "Start the first wave". The wave loop won't fire until then. (DISPATCHER's preflight `claudomat doctor` still verifies everything's wired; missing-agent errors only surface on the first `Agent()` spawn.)
> 3. **Custom** — describe what you want.

Whichever path, the handoff marker's `## Next` section (Action 7) MUST carry the **transition** instruction — read `claudomat-brain/DISPATCHER.md`, say "Start the first wave" — and MUST NOT contain any `/exit` / Ctrl-D / manual-restart-as-headline text, so the persisted handoff stays accurate and hosted-safe across sessions.

### 8. Flip `loop_state: ready` — wave loop opens

(founder-proxy generation happened at v12 as part of BOARD seat generation. v13 does not redo it; v12's exit criteria already verified `founder-proxy --probe` returns clean.)

Write `process/session/.last-wave-completed.yaml`:

```yaml
loop_state: ready
last_wave: null
next_wave_seed_task: <task-id from `Task — next claimable` recipe>
next_wave_bundled_siblings: []
onboarding_completed_at: <ISO-timestamp>
```

**v13 is the only onboarding stage authorized to set `loop_state: ready`.** v11 set `install-pending`; v12 left it `install-pending` while resolving delta; v13 flips to `ready` only AFTER Action 0 strict doctor returned clean.

**Onboarding carve-out from N-3 sole-writer rule.** Steady-state, `process/session/.last-wave-completed.yaml` is written *only* by N-3 of the prior wave (per `claudomat-brain/blocks/next/stages/N-3-handoff.md`). At onboarding, no prior wave exists — v13 is the legitimate bootstrap exception that creates the file for the first time so the first wave's DISPATCHER step 0 has something to read.

`claudomat-brain/DISPATCHER.md` step 0 reads this file at session start. With `loop_state: ready` and a `next_wave_seed_task` set, the dispatcher enters `claudomat-brain/blocks/product/product.md` → `P-0 Frame` on the next founder prompt (or next tick under `automatic` / `degenerate`).

If something downstream breaks the install state after v13 (founder uninstalls a CLI, an MCP server config drifts), DISPATCHER step 0's preflight check will catch it before P-0 fires.

## Deliverable

- Action 0: `claudomat doctor --strict` exit code 0.
- `.gitignore` — present and complete (baseline + stack-specific).
- `.github/workflows/ci.yml` — CI pipeline baseline (or deferral logged).
- `command-center/principles/CI-PRINCIPLES.md` — deploy_targets / canary / pr_conventions blocks populated.
- `process/session/status-check.yaml` — initial `STATUS: IDLE` state.
- `command-center/testing/test-accounts.md` + `project.yaml: test_users.local_dev[]` — test-account registry seeded, planned via signup flow at first wave's B-5 (the silent default — `local_dev: []` + Active decision), or deferral logged.
- `./README.md` — `{{name}}` / `{{description}}` markers substituted from `project.yaml.name` / `project.yaml.description` (step 2f above).
- Initial commit — everything from v0–v12 committed.
- (If remote configured) `git push origin main` succeeded.
- `process/session/onboarding/onboarding-complete-<YYYY-MM-DD>.md` — handoff marker.
- `process/session/.last-wave-completed.yaml` — `loop_state: ready` with `next_wave_seed_task` populated (+ `next_wave_bundled_siblings: []` on first wave).

## Exit criteria

- Action 0 passed: strict doctor returned exit 0 — external deps + `project.yaml` schema both valid.
- Step 4b passed: zero `_(fill in)_` placeholders in `project.yaml` at commit time.
- Working tree is clean (`git status --short` is empty).
- Initial commit is on `main` (local at minimum; pushed to origin if remote configured).
- CI workflow is runnable (no syntax errors in YAML; jobs are wired) — or deferral is logged.
- `CI-PRINCIPLES.md` deploy_targets / canary / pr_conventions blocks are populated.
- `process/session/status-check.yaml` exists with `STATUS: IDLE`.
- Test accounts seeded, planned via signup flow (silent default — `local_dev: []` + Active decision), or deferral logged — in every case a decision is appended to `product-decisions.md` and no placeholder remains in `test_users`.
- No secrets in committed files (step 4 grep returned clean).
- Handoff marker is written.
- `loop_state: ready` is set in `process/session/.last-wave-completed.yaml`.

## Next

→ **Onboarding loop ends here.** Control passes to `claudomat-brain/DISPATCHER.md`. The first wave begins when the founder invokes it (or on next autonomous tick) — the dispatcher reads `process/session/.last-wave-completed.yaml`, identifies the seed, and enters `claudomat-brain/blocks/product/product.md` → `P-0 Frame`. Because v11 audited / v12 installed / v13 verified, wave-1 starts with a complete agent catalog + all external dependencies wired.
