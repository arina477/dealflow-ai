# Stage v6b — Architecture Integrate: Cross-Check + Unified Library Doc

## Purpose
Resolve conflicts between the 8 architecture branches, integrate into a single unified library doc, and lock the module list that v8 design-system consumes. This is the gate that unblocks parallel Design progression.

## Prerequisites
- v6 complete (all 8 branch files written + `module-list.md` snapshot, status=draft).
- READ `claudomat-brain/rules/sub-agent-invocation.md`.
- READ `command-center/AGENTS.md` for `architect-reviewer` and `technical-writer` cards.

## Actions

### 1. Cross-branch conflict scan

Spawn `architect-reviewer` (fresh context) via `Agent(subagent_type=architect-reviewer)` to scan all 8 branch files for conflicts. Common classes:

- **Module boundary disputes** — feature X described as module in branch A, as service boundary in branch B.
- **Data ownership** — two branches claim the same entity.
- **Auth flow contradictions** — security branch says X, services branch assumes Y.
- **SDK overlap** — multiple SDKs solving the same problem.
- **Test strategy mismatches** — test branch assumes a framework the tools branch didn't list.
- **DevOps / Security contradictions** — DevOps pipeline doesn't enforce security branch requirements (e.g., secret scanning, permissions).

Agent returns: numbered list of conflicts + suggested resolutions per conflict.

### 2. Resolve conflicts — options-and-custom per material conflict

For each conflict:

- **Unambiguous** (one branch is clearly correct) — orchestrator picks the winner + updates the loser branch. Log in working memory; no founder poll.
- **Material trade-off** (both sides have merit) — fire `AskUserQuestion`:

  > "Conflict #<N>: <branch A> says <X>; <branch B> says <Y>. Pick:"
  >
  > 1. **<branch A wins>** — adopt <X>; <branch B> updated. Trade-off: <consequence>.
  > 2. **<branch B wins>** — adopt <Y>; <branch A> updated. Trade-off: <consequence>.
  > 3. **Hybrid** — <agent's proposed third path> if any. Trade-off: <consequence>.
  > 4. **Defer** — log to product-decisions.md as `Status: Deferred`, leave both branches as-is, surface at first refresh ritual.
  > 5. **Custom** — describe your resolution and I'll apply it to both branches.

After resolution: re-run step 1. Loop until zero conflicts.

Iteration cap: 3 rounds. If 3 rounds don't resolve, escalate via batched `AskUserQuestion` with all open conflicts + force decisions.

### 3. Spawn `technical-writer` to produce unified library doc

Spawn `technical-writer` via `Agent(subagent_type=technical-writer)` to integrate the 8 resolved branch files into `command-center/dev/architecture/_library.md`.

Library doc structure:

```markdown
# Architecture Library — <Project>

## How to use this doc
- Each section is authoritative for its domain; branch files are the expanded detail.
- Read this at the start of any wave that touches multiple domains.
- Branch files are read when planning within a single domain.

## Table of contents
1. [Stack](#stack) — locked stack (mirror of stack-decisions.md)
2. [Modules / Reusable elements](#modules)
3. [Services](#services)
4. [Databases](#databases)
5. [SDKs](#sdks)
6. [Tools](#tools)
7. [Security](#security)
8. [DevOps](#devops)
9. [Test](#test)
10. [Cross-domain interactions](#cross-domain)
11. [Open items and risks](#risks)

---

## Stack
<mirror from stack-decisions.md>

## Modules / Reusable elements
<summary from modules.md>

...

## Cross-domain interactions
<Key interactions that span branches — where modules call services, services call SDKs, etc. This section WRITES the integration glue.>

## Open items and risks
<Consolidated from all branches' Risk sections>
```

### 4. Lock `module-list.md`

Post-integration, update `command-center/dev/module-list.md` to reflect final module boundaries (some may have shifted during conflict resolution). Set front-matter:

```yaml
---
status: locked
locked_at: <ISO-timestamp>
locked_by: v6b
---
```

This is the gate output for v8 Design System; v8 will refuse to proceed if `status: locked` is absent.

### 4b. Populate `.env.example` from architecture branches

`claudomat init` writes a placeholder `.env.example`; v6b is the first stage that knows the actual env-var inventory. Walk:

- `command-center/dev/architecture/security.md` — auth-provider env vars (e.g., `SUPERTOKENS_CONNECTION_URI`, `SUPERTOKENS_API_KEY`, `SESSION_SECRET`).
- `command-center/dev/architecture/sdks.md` — third-party SDK env vars (e.g., `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`).
- `command-center/dev/architecture/databases.md` — `DATABASE_URL` shape per stack (e.g., `postgres://user:pass@host:5432/dbname`); add a separate non-pooled URL for `drizzle-kit` migrations if using a connection pooler.
- `command-center/dev/architecture/services.md` — internal service URLs (e.g., `INTERNAL_API_BASE_URL`).
- `command-center/dev/architecture/devops.md` — observability / monitoring env vars not already in sdks.md.

Per env var, write a commented placeholder + one-line comment naming the consumer:

```bash
# Auth — SuperTokens (self-hosted on Railway) (architecture/security.md)
SUPERTOKENS_CONNECTION_URI=   # SuperTokens Core URL — Railway private networking
SUPERTOKENS_API_KEY=          # auto-generated in Railway env vars
SESSION_SECRET=               # app session signing secret

# Database — Postgres on Railway (architecture/databases.md)
DATABASE_URL=postgres://user:pass@localhost:5432/<project>_dev

# Payments — Stripe (architecture/sdks.md)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Group by source-branch heading. NEVER fill values — placeholders only. The founder fills `.env` (gitignored) at `pnpm dev` time.

Secret-management approach is a **technical default** (always-on rule 17): default to plain `.env.example` **silently** — do NOT poll. The populated `.env.example` is its own record, so no separate announcement is needed here. Only when the founder has already named a different approach (Doppler, 1Password Connect, Vault) in v0 docs or an explicit request, fire `AskUserQuestion` with options-and-custom (Plain `.env.example` / Doppler / 1Password Connect / Vault / Custom) and honor it. Subsequent waves' B-0 Action 3 honors whichever approach is recorded.

### 5. Cross-branch cascade from v5 overrides (if applicable)

If v5 recorded partial / full / custom override of the baseline stack, propagate cascading updates here:

- Update `command-center/principles/BUILD-PRINCIPLES.md` to reflect actual stack conventions (agent edits targeted sections, respecting the `Contract for new rules` block per always-on rule #13).
- Update `command-center/testing/test-writing-principles.md` if the test stack differs.
- Update `command-center/principles/PRODUCT-PRINCIPLES.md` § Auth or § Compliance if auth provider differs.
- Append cascading updates as decisions in `command-center/product/product-decisions.md`.

### 6. Consolidate `project.yaml`

`project.yaml` is the structured source agents/recipes read at every wave (C-1 merge strategy, C-2 deploy targets, T-4 quick_start, simplify skill stack lookup, agent-creator industry/compliance, etc.). By v6b every input it needs except `test_users.local_dev[]` has been collected by earlier stages — consolidate everything here so downstream stages and `claudomat doctor` see a fully-populated file.

Edit `./project.yaml` and replace EVERY placeholder marker with the resolved value. The template uses two forms — `_(fill in: ...)_` (most fields, carries a hint) and `_(...)_` (compact form for sub-fields like `commands[].description`). Both forms must be replaced; v13 step 4b's pre-commit grep gate is `_\(fill in|_\(\.\.\.\)_|\"_\(|'_\(` (matches both literal forms and quoted variants).

**Product context (from v1 / v3):**

- `name` — project name (single-line scalar). Captured during v1 vision intake; if not yet written, derive from the `founder_bets` row tagged as vision (via `Bet — list live` recipe in `claudomat-brain/db/SCHEMA.md`) or batch into the v6b `AskUserQuestion` poll below.
- `description` — product description, **single-line scalar** (plain or quoted form). Block-literal `|`/`>` is rejected by `claudomat doctor` because v13 README finalization extracts this via a single-line read. Sourced from v1 vision in the `founder_bets` table (compress to one sentence). If v1's vision is multi-paragraph, fire a batched `AskUserQuestion` here to confirm the one-sentence summary.

**Stack (from v5 stack-decisions + v6/v6b architecture):**

- `stack.repo_shape` — from `_library.md` § Repo shape (or `stack-decisions.md`).
- `stack.backend` — from `_library.md` § Backend framework.
- `stack.database` — from `_library.md` § Databases (include version, e.g. `Postgres 15`).
- `stack.frontend` — from `_library.md` § Frontend framework (`none` if backend-only).
- `stack.shared_contracts` — from `_library.md` § Shared contracts (`none` if not applicable).
- `stack.deploy_platform` — from `_library.md` § DevOps (lowercase enum: railway / vercel / netlify / aws / gcp / azure / heroku / render / custom / none).
- `stack.compliance_regime` — derived from v3 product-scope + v4 page-map compliance-surface signals; if not directly stated by then, fire a batched `AskUserQuestion` here (lowercase enum: gdpr / hipaa / pci / soc2 / none).
- `stack.industry_domain` — derived from v1 vision / v3 product-scope context; batched into the v6b `AskUserQuestion` poll below when not directly stated (free-text, lowercase preferred).

**Operations (from v6 DevOps + tools + testing branches):**

- `quick_start.install` / `quick_start.db_setup` / `quick_start.run_dev` — shell snippets from `command-center/dev/architecture/devops.md` § Local-dev quickstart (or equivalent). Single-line each.
- `commands[]` — one entry per build / lint / test / typecheck / start command surfaced by `command-center/dev/architecture/tools.md` (build/lint/typecheck) + the v6 testing branch (test runners). Each row: `{ name: "<command>", description: "<one line>" }`.
- `merge_strategy` — from founder Q&A (squash / merge / rebase; default `squash` if no preference).
- `deploy_targets[]` — one entry per declared deploy platform from `command-center/dev/architecture/devops.md` § Deploy targets. Each row: `{ platform, project, service_name_template, health_endpoint, canary_threshold_dau }`. Sub-keys are documented shape; validator only enforces top-level presence — but downstream C-2 reads these by key path, so populate them. Deploy is **bring-your-own** (default platform Railway): record the deploy target as the **founder's own** account, with the **credential collected at deploy time** (C-2 Action 0) — NOT a pre-provisioned `app-<slug>` project. Don't invent a concrete `project` name or token here; the brain provisions and names the project when it first deploys, and back-fills these sub-keys then (the `deploy_targets[]` row may be left empty, or carry a generic `deploy_targets[].project` placeholder, until that first deploy — C-2 Action 0 treats either as "awaiting provisioning" because `stack.deploy_platform` is a deploy-bearing platform, not `none`).

(The `_library.md` TOC at step 3 does NOT have separate "Quick start" or "Commands" sections — those facts live in the underlying branch files cited above. `_library.md` § DevOps + § Test are the integrated views.)

If any field has no clear source after v0–v6b (e.g., founder hasn't given a name yet, or DevOps branch left a gap), fire a batched `AskUserQuestion` with options-and-custom and write the answers in place. Do NOT exit this stage with any placeholder (in any of the forms above) remaining in `project.yaml` — except `test_users.local_dev[]`, which v13 step 2d fills. v13 step 2f's README substitution hard-blocks on unfilled `name` / `description`, AND v13 step 4b's pre-commit `grep` gate refuses to commit if any placeholder remains in any field. Catching it here is preferred — the error at v13 is less actionable and round-trips more state.

After edits, run `claudomat doctor` (non-strict is fine; the v13 strict run is the final gate). The schema must validate (required keys + stack.* sub-keys + enum constraints + no-password-in-test_users + single-line description). The placeholder warn at this stage may still report `test_users.local_dev[]` entries — those get filled at v13 step 2d (the 5-option poll for test-account provisioning).

### 7. Snapshot commit (recommended)

```bash
git add command-center/dev/architecture/ command-center/dev/module-list.md project.yaml
git commit -m "chore(onboarding): v6/v6b architecture complete"
```

Long onboarding runs benefit from this checkpoint.

## Deliverable

- `command-center/dev/architecture/_library.md` — unified reference, all sections populated.
- `command-center/dev/module-list.md` — `status: locked` + `locked_at` + `locked_by: v6b`.
- `project.yaml` — all fields except `test_users.local_dev[]` populated: `name`, `description` (single-line), `stack.*`, `quick_start.*`, `commands[]`, `merge_strategy`, `deploy_targets[]`. `claudomat doctor` passes schema (test_users placeholders remain as a benign warn until v13 step 2d).
- Resolved architecture branch files (any conflict-driven updates applied).
- `.env.example` — populated from architecture branches with grouped placeholders.
- (If v5 overrode) cascaded updates to `BUILD-PRINCIPLES.md` / `testing/test-writing-principles.md` / `PRODUCT-PRINCIPLES.md`.

## Exit criteria

- Zero unresolved cross-branch conflicts (or all open conflicts logged as `Status: Deferred`).
- `_library.md` is navigable and complete (all 11 sections populated).
- `module-list.md` has `status: locked`.
- All open items from branch Risk sections are captured in `_library.md` § Open items and risks.

## Next

→ Return to `../onboarding-loop.md` → Stage v7 (design-direction). For non-UI projects, skip v7/v8/v9 → Stage v10 (planning).
