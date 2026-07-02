# Stage v10 — Planning: Milestones (DB), product-decisions backfill

## Purpose
Turn all onboarding artifacts into an executable plan. Produce milestones (themes) as rows in the `milestones` table — with `## Scope` prose detailed enough that the per-wave milestone-decomposition ritual can derive correct task bundles later — and backfill `product-decisions.md` with every decision made during v5–v9. **v10 does NOT INSERT child tasks**; decomposition is per-wave, fired from N-1 Action 7 once a milestone goes `status='in_progress'` (per `claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md`).

## Prerequisites
- v6b complete (architecture library doc exists).
- v9 complete (all pages designed + approved) — skip for backend-only / API-only / CLI projects that skipped v7–v9.
- DB reachable: `psql "$CLAUDOMAT_DB_URL" -c 'SELECT 1'` exits 0 = success (verified by `claudomat doctor`).
- READ `claudomat-brain/ROADMAP/roadmap-lifecycle.md` (schema + states + edit rules).
- READ `claudomat-brain/db/SCHEMA.md` — milestone/task table contract + description prose conventions (free-form prose with two structured carve-outs: MONITOR YAML payload + P-2 spec-contract YAML head).
- READ `claudomat-brain/management/default-mode.md` § 3-tier classification — Tier 3 surfacing pattern (BOARD is OFF during onboarding).
- READ `command-center/product/founder-stage.md` — `stage:` value governs horizon defaulting for compliance-themed milestones.

## Actions

### 1. Generate milestones from artifacts

Consolidate inputs:
- Live founder bets from the `founder_bets` table (via `Bet — list live` recipe in `claudomat-brain/db/SCHEMA.md`) → each bet should trace to ≥1 milestone.
- `feature-list.md` MVP + H2 + H3 classification → milestones group features by theme + horizon.
- `user-journey-map.md` flows → ensures all personas are covered.
- `design/<page>.html` × N → every page needs at least one implementation milestone (could be bundled).
- `dev/architecture/_library.md` → infrastructure milestones (auth setup, DB bootstrap, CI pipeline, observability, etc.).

Per milestone:
- Theme name (e.g., "M1 — Auth & User Onboarding").
- Horizon (H1 / H2 / H3).
- Target success metric (preliminary; founder can sharpen at first refresh).
- Bet source (which founder bet drives this milestone).
- kebab-case slug for human-readable cross-references in prose sections.
- Scope surfaces (pages + modules + services + SDKs + features covered).
- References (to feature-list, pages, arch branches).

#### Horizon defaulting for compliance-themed milestones

Milestones whose theme is GDPR / consent UI / privacy-rights / audit-compliance admin / cross-border-data / AI Act transparency / admin-policy / regulated-compliance default as follows:

| Founder stage | Default horizon for compliance-themed milestones |
|---|---|
| `self-use-mvp` | H2 |
| `pilot-customer` | H2 |
| `paying-customers` | H1 |
| `regulated-day-1` | H1 |

Exception: a named regulatory deadline or named first-customer requirement lands the milestone in H1 regardless of stage — cite the deadline / requirement verbatim in the milestone's description prose under a `## Why now` section.

### 2. Founder approval on milestone shape — options-and-custom

Fire `AskUserQuestion` before INSERTing into `milestones` / `tasks`:

> "I drafted <N> milestones (<X> H1, <Y> H2, <Z> H3). Pick:"
>
> 1. **Approve as-is** — INSERT into `milestones` + `tasks` with this set.
> 2. **Reshape** — tell me which milestones to merge / split / re-horizon. I'll redraft.
> 3. **Trim to MVP only** — keep only H1; defer H2/H3 to first refresh ritual.
> 4. **Add milestones** — list themes I missed.
> 5. **Custom** — describe the milestone shape and I'll capture it.

Loop until founder approves the shape.

### 3. INSERT milestones

For each approved milestone, INSERT a row into the `milestones` table via inline SQL (recipe labels in [`claudomat-brain/db/SCHEMA.md`](../../db/SCHEMA.md) § Operation naming are reading anchors only; no separate `Milestone — add` recipe — derive INSERT shape from the column list):

```sql
INSERT INTO milestones (title, description, status, bet_id)
VALUES ($1, $2, 'todo', $3)
RETURNING id;
```

`description` is free-form prose with conventional `##` section headings per [`claudomat-brain/db/SCHEMA.md`](../../db/SCHEMA.md) § milestones — recommended sections: `## Horizon`, `## Class`, `## Tier`, `## Scope`, `## Success metric`, `## Bet source`, `## Why now`, `## References`. (Pre-1.0.0 bucket keys `horizon:` / `Milestone class:` / `success_metric:` / `Bet source:` / `why_now:` / `brain task tag:` / `scope_surfaces:` / `references:` were removed in the 1.0.0 description-bucket purge — no parser reads them anymore.) `bet_id` resolves to a row inserted earlier (or via `Bet — add live` in this same stage if no live bet anchors the milestone yet).

H1 milestones = MVP items. H2/H3 milestones are planned-but-not-yet-active. All start with `status='todo'` (substate "planned" — no child tasks yet).

### 4. Do NOT INSERT child tasks here

v10 deliberately ships milestones with **zero child tasks**. Task INSERTs are per-wave, owned by the milestone-decomposition ritual (`claudomat-brain/ROADMAP/milestones/milestone-decomposition-ritual.md`) which fires from N-1 Action 7 once the milestone goes `status='in_progress'`. The ritual writes **one bundle per fire** — 1 seed (`parent_task_id IS NULL`) + 0-N siblings (`parent_task_id = seed.id`, flat — exactly one level deep) — under `tasks.milestone_id = $active`. v10's job is to make each milestone's `## Scope` prose detailed enough that the ritual can derive correct bundles later; it is NOT to pre-populate the task queue.

(Pre-1.0.0 batch-INSERT of child tasks at v10 + `parent milestone slug:` / `successMetric:` / `source:` / `urgency:` / `wave-type hints:` description bucket-keys + the `wave_type_hint` derivation table were all removed in the 1.0.0 description-bucket purge + per-wave decomposition refactor.)

### 5. Backfill `product-decisions.md`

Walk through every decision made during v5–v9 and ensure each has an entry. Expected minimum:

- v5 stack selection (one entry).
- v6 per-branch architectural choices worth capturing (e.g., "Drizzle per-module schema", "Socket.IO namespace strategy", "Railway deploy via Dockerfile not Railpack") — aim for 3–5 entries.
- v7 design direction (one entry).
- v8 design system build (one entry).
- v9 per-page design consistency patterns (one entry).

Format per entry follows the scaffold (Context / Decision / Rationale / Alternatives considered).

### 6. Tier 3 deferrals — batched resolution

Read `command-center/product/product-decisions.md` for any entries with `Status: Deferred — resolve at v10`. Batch into ONE `AskUserQuestion`, one option-set per deferral.

Per deferred decision, present 2–4 inferred options + `defer-again` + `custom`:

> "Deferral #<N>: <question>. Options on table when deferred: <list>. Pick:"
>
> 1. **<option-A>** — <one-line consequence>.
> 2. **<option-B>** — <one-line consequence>.
> 3. **<option-C>** — <one-line consequence>.
> 4. **Defer again** — log to first refresh ritual.
> 5. **Custom** — tell me your resolution.

Update each entry's `Status:` from `Deferred — resolve at v10` to `Active` (or `Deferred — surface at first refresh ritual` if option 4) and append the resolution.

### 7. Coverage check — over milestone `## Scope` prose

Mandatory audit. Tasks don't exist yet (Step 4 above explains why); coverage is verified by reading milestone `## Scope` sections, NOT by counting `tasks` rows. For each item below, confirm at least one milestone's `## Scope` prose mentions it:

- Every page in `design/<page>.html` → mentioned in some milestone's `## Scope`.
- Every MVP feature in `feature-list.md` → mentioned in some milestone's `## Scope`.
- Every MVP module in `module-list.md` → mentioned in some milestone's `## Scope`.
- Every external SDK in `sdks.md` → mentioned in some milestone's `## Scope` or `## References` (cross-references `claudomat-brain/rules/external-sdk-integration-rules.md`).
- Every architecture branch's Risk/open-item → mentioned in some milestone's `## Scope` or `## References`.

If any MVP item has zero coverage in any milestone's prose, UPDATE the relevant milestone's `description` to include it (or, if it doesn't fit any existing milestone, loop back to Step 1 and author a new milestone). The milestone-decomposition ritual will translate prose coverage into concrete `tasks` rows per-wave during active life.

### 8. Snapshot commit

DB writes (milestones INSERTs) commit themselves. Step 8 commits only FS-side artifacts:

```bash
git add command-center/product/product-decisions.md
git commit -m "chore(onboarding): v10 planning complete — <N> milestones (DB, zero child tasks; decomposition is per-wave)"
```

## Deliverable

- `milestones` table — populated with H1/H2/H3 milestones (`status='todo'` for all, zero child tasks — decomposition runs per-wave from N-1).
- `tasks` table — **unchanged** at v10; the milestone-decomposition ritual fires per-wave during each milestone's active life.
- `command-center/product/product-decisions.md` — backfilled with 10–20 decisions from v5–v9 + all v1/v6b deferrals resolved (or re-deferred to first refresh ritual).
- Coverage = 100% for MVP surfaces in milestone `## Scope` prose (Step 7).

## Exit criteria

- `milestones` table has ≥3 rows (one per horizon minimum) and all H1 milestone rows have a non-`_TBD_` `## Success metric` section in description prose.
- Every MVP page / feature / module / SDK is mentioned in at least one milestone's `## Scope` (validated in Step 7 by reading milestone prose, not by querying `tasks`).
- Every v5–v9 decision is logged in `product-decisions.md`.
- Zero deferred items remain with `Status: Deferred — resolve at v10`.
- Founder explicitly approved the milestone shape.

## Next

→ Return to `../onboarding-loop.md` → Stage v11 (install-audit).
