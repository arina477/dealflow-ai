# DealFlow AI

> AI platform that sources M&A deals, ranks buyer-seller matches, and runs compliant, audited email outreach in one workflow — for M&A advisory firms replacing stitched-together sourcing, contact, and outreach tools.

[![claudomat](https://img.shields.io/badge/orchestrated--by-claudomat-7c3aed)](https://github.com/) [![CI](https://img.shields.io/badge/CI-pending-lightgrey)]() [![License](https://img.shields.io/badge/license-private-lightgrey)]()

---

## What this repo is

A claudomat-managed project: every wave follows a deterministic 8-block loop (Product → Design → Build → CI → Test → Verify → Learn → Next) with stage-level gates and head-X persona reviewers. Most decisions are made by the agent, not the founder.

- **Trigger table + always-on rules** → `CLAUDE.md` (brain-owned; refreshed by `claudomat sync`)
- **Project facts** (name, description, stack, deploy targets, commands, test users) → `project.yaml`
- **Wave-loop dispatcher** → `claudomat-brain/DISPATCHER.md`
- **Per-block instructions** → `claudomat-brain/blocks/<X>/<X>.md`
- **Per-stage actions** → `claudomat-brain/blocks/<X>/stages/<X-N>.md`
- **Project-specific principles, agents, skills, tools** → `command-center/`
- **Active wave + session state** → `process/`
- **Design surface (UI projects only)** → `design/`

---

## Quick start

```bash
# 1. Install dependencies (see project.yaml: quick_start.install)
# 2. Configure environment
cp .env.example .env
# 3. Initialize the database (see project.yaml: quick_start.db_setup)
# 4. Run the dev server (see project.yaml: quick_start.run_dev)
```

For local-dev test-user labels + emails, see `project.yaml: test_users.local_dev[]`. For prod-fixture credentials (with passwords) used at T-5 / T-8, see `command-center/testing/test-accounts.md` (gitignored).

---

## How to start a wave

```
"Start the next wave"
```

The orchestrator reads `process/session/.last-wave-completed.yaml`, picks the next seed from the `tasks` table (via the `Task — next claimable` recipe in `claudomat-brain/db/SCHEMA.md`), and enters `claudomat-brain/blocks/product/product.md` → `P-0 Frame`. From there, every stage runs to completion (or escalates per the active mode in `process/session/.autonomous-session`).

To pick a specific task instead:

```
"Work on task <id>"
```

To see what's in flight:

```sql
-- Next claimable task (canonical recipe `Task — next claimable` in
-- claudomat-brain/db/SCHEMA.md § tasks; bundles via `parent_task_id` FK)
SELECT id, title FROM tasks WHERE status='todo' ORDER BY created_at LIMIT 1;

-- All in-flight
SELECT id, title, status FROM tasks WHERE status IN ('todo','in_progress','blocked') ORDER BY status, created_at;
```

---

## Modes

Set in `process/session/.autonomous-session`. Four values:

| Mode | What it does |
|---|---|
| `founder-review` (default — no flag) | Every Tier 3 + hard-stop → founder. |
| `default` | Skip nice-to-haves; strategic + hard-stops → founder. |
| `automatic` | BOARD (7 seats) resolves ambiguity; splits + hard-stops → founder. |
| `degenerate` | ceo-agent resolves within `command-center/management/ceo-blocklist.md` charter; founder reached only via ESC + chat / session message / daily AgentMail digest. |

Switch modes by saying:

- *"Run autonomously"* → `automatic`
- *"ceo mode"* / *"365 mode"* → `degenerate` (verifies prerequisites first)
- *"I'm back"* / *"pause"* → revert to `founder-review` / `default`

Full spec: `claudomat-brain/management/mode-switching.md`.

---

## Project-specific docs

| Doc | What it has |
|---|---|
| `CLAUDE.md` | Trigger table + always-on rules + directory tree (brain-owned; identical across claudomat projects, refreshed on every `claudomat sync`) |
| `project.yaml` | Structured project facts — `name`, `description`, `stack.*`, `quick_start.*`, `commands[]`, `merge_strategy`, `deploy_targets[]`, `test_users.local_dev[]`. Edit this file to change project facts. Validated by `claudomat doctor`. |
| `milestones` table in Postgres | Theme-based milestone roadmap (DB-resident; access via `claudomat-brain/db/SCHEMA.md`) |
| `founder_bets` table in Postgres | Vision + live strategic bets with falsifiers (DB-resident) |
| `command-center/product/product-decisions.md` | Backfilled decisions across v5–v9 + per-wave (FS) |
| `command-center/dev/architecture/_library.md` | Unified architecture reference (8 branches integrated) |
| `command-center/principles/{PRODUCT,DESIGN,BUILD,VERIFY,CI}-PRINCIPLES.md` | Cross-wave lessons promoted from L-2 distill |
| `command-center/AGENTS.md` | Project agent catalog (BOARD 7 + heads 8 + verifiers + executors) |
| `design/DESIGN-SYSTEM.md` | Tokens + module primitives (UI projects) |
| `design/<page>.html` | Per-page approved mockups (UI projects) |

---

## Conventions

- **Branches:** `wave-<N>-<short-slug>` (created at B-0).
- **Commits per wave:** B-block author commits + B-6 review fix-ups; C-2 may squash on merge.
- **Tasks:** the `tasks` table in Postgres is the single source of truth (schema: `claudomat-brain/db/SCHEMA.md`).
- **Spec contracts:** live in `tasks.description` field — never as loose `process/waves/.../P-2-spec.md` only.
- **Iron Law:** orchestrator never fixes errors directly. Always classify via `command-center/dev/triage-routing-table.md` → route to specialist via `command-center/AGENTS.md`.

---

## License

Private. Replace with `MIT` / `Apache-2.0` / etc. if/when you publish.
