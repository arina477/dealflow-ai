# Stage v1 — Vision & Gaps: Parse Docs, Poll Only for What's Missing

## Purpose
Turn raw documents from v0 into seeded `founder_bets` rows (DB) + initial `milestones` rows (DB; north star themes — empty child task sets, populated by v10) + `founder-stage.md` (one of 4 stage values, FS). **Extraction first, polling second.** Do NOT re-ask for anything the founder has already written down.

## Prerequisites
- v0 complete (`process/session/onboarding/docs-input/*.md` exists with ≥200 chars).
- DB reachable (`psql "$CLAUDOMAT_DB_URL" -c 'SELECT 1'` exits 0 = success); brain schema present.
- READ `claudomat-brain/ROADMAP/roadmap-lifecycle.md` (schema + states); `claudomat-brain/db/SCHEMA.md` (DB contract).
- READ `claudomat-brain/management/default-mode.md` § 3-tier classification — Tier 3 items raise via `AskUserQuestion`. **BOARD is OFF during onboarding** regardless of declared mode.

## Actions

### 1. Parse v0 input docs — extract what's there

Read every `process/session/onboarding/docs-input/*.md`. Build a structured working-memory table (orchestrator internal — no file written yet):

| Field | Extracted? | Content |
|---|---|---|
| Vision / North Star | ✅/❌ | <quote or close paraphrase> |
| Target user / market | ✅/❌ | <content> |
| Product one-liner | ✅/❌ | <content> |
| Core bets (strategic convictions) | ✅/❌ | <list, ≥1 expected> |
| Named competitors | ✅/❌ | <list> |
| Differentiation vs competitors | ✅/❌ | <how this wins> |
| Horizon signal (H1 / H2 / H3) | ✅/❌ | <MVP scope vs medium-term vs moat> |
| Must-have features (MVP) | ✅/❌ | <list> |
| Out-of-scope / non-goals | ✅/❌ | <list> |
| Monetization / business model | ✅/❌ | <how it makes money> |

Mark ✅ only on direct, unambiguous answers. "Maybe implied" = ❌ — don't guess; poll the founder.

### 2. Gap-polling — options-and-custom per gap

If **all essentials ✅** (Vision, Target user, Product one-liner, ≥1 bet, Competitors): proceed to step 2b.

Otherwise: batch missing essentials into ONE `AskUserQuestion` session, **with concrete options per gap derived from docs / web search / framework heuristics**. Per missing field, present 2–4 inferred options + `custom`.

Example (when "Differentiation" is ❌):

> "Your docs mention **<extracted competitors>** but don't say what makes you different. Pick the dimension that matches:"
>
> 1. **Pricing / business-model wedge** — undercutting / inverting how they monetize.
> 2. **UX / speed wedge** — the existing tools are slow / clunky / fragmented.
> 3. **Distribution wedge** — you reach a market segment they can't.
> 4. **Capability gap** — they can't do <X> at all; you can.
> 5. **Custom** — tell me where you win and I'll capture it.

Cap the batched poll at 5 questions. If >5 essentials are missing, fire ONE meta-`AskUserQuestion`:

> "Your docs are very sparse — multiple essentials are missing. Pick how to recover:"
>
> 1. **Quick interview** — I ask the 5 most critical missing items in sequence.
> 2. **Provide a fuller brief** — paste / link a richer version (back to v0 step 2).
> 3. **Build from scratch** — I'll propose a vision based on the product category and you confirm/edit.
> 4. **Custom** — tell me how to recover.

### 2b. Founder-stage poll (ALWAYS fires)

Independent of the gap poll. Always ask via `AskUserQuestion`, even if all essentials are ✅:

> "What's this product's stage at launch?"
>
> 1. **self-use-mvp** — I'm the first user (internal tool, own team, personal project).
> 2. **pilot-customer** — one friendly design partner before GA.
> 3. **paying-customers** — public beta or paid GA at launch.
> 4. **regulated-day-1** — health / finance / minors / EU-regulated AI (compliance non-negotiable at launch).
> 5. **Custom** — explain your situation; I'll map it to the closest stage and confirm.

Write the chosen value to `command-center/product/founder-stage.md`:

```yaml
---
stage: <self-use-mvp | pilot-customer | paying-customers | regulated-day-1>
set_at: <ISO-timestamp>
set_by: v1
custom_note: <optional — present only if founder chose Custom>
---
```

This flag modulates v3 (compliance horizon defaulting), v4 (compliance-page quota), v6 (security branch scope), v10 (compliance-milestone horizon defaulting). Early stages defer compliance work to H2 by default; `paying-customers` / `regulated-day-1` get full treatment.

### 3. INSERT founder bets

For each conviction extracted in step 1, INSERT a row into `founder_bets` via the `Bet — add live` recipe in [`claudomat-brain/db/SCHEMA.md`](../../db/SCHEMA.md):

```sql
INSERT INTO founder_bets (title, description, status)
VALUES ($1, $2, 'live')
RETURNING id;
```

`description` is free-form prose with conventional `##` section headings per [`claudomat-brain/db/SCHEMA.md`](../../db/SCHEMA.md) § founder_bets — recommended sections: `## Statement`, `## Why I believe`, `## Horizon`, `## Confidence`, `## Falsifier`. Vision / North Star content goes inline under `## Statement` on the founder's most foundational bet (use founder's voice — quote where possible). (Pre-1.0.0 bucket keys `statement:` / `why I believe:` / `horizon:` / `confidence:` / `falsifier:` were removed in the 1.0.0 description-bucket purge — no parser reads them anymore.)

If the founder hasn't articulated "this bet would be falsified if X", poll per bet:

> "What would falsify Bet <N> ('<bet statement>')? Non-falsifiable bets are hopes. Pick the disconfirming signal:"
>
> 1. **<inferred-falsifier-A>** — e.g., "Less than 30% of pilot users return after week 2".
> 2. **<inferred-falsifier-B>** — e.g., "First 10 paying customers churn within 60 days".
> 3. **<inferred-falsifier-C>** — alternative inferred from the bet text.
> 4. **Custom** — tell me your falsifier.

DB INSERTs commit themselves; no `git commit` yet — v13 owns the initial commit.

### 4. INSERT initial milestone(s) for horizon themes

If docs provided horizon signal (H1 / H2 / H3 themes), INSERT one milestone row per top-level theme via inline SQL (recipe labels in [`claudomat-brain/db/SCHEMA.md`](../../db/SCHEMA.md) § Operation naming are reading anchors — no `Milestone — add` recipe; derive INSERT shape from columns):

```sql
INSERT INTO milestones (title, description, status, bet_id)
VALUES ($1, $2, 'todo', $3)
RETURNING id;
```

`description` is free-form prose per [`claudomat-brain/db/SCHEMA.md`](../../db/SCHEMA.md) § milestones — at v1 INSERT-time, prose body needs a `## Horizon` section (H1 / H2 / H3) and a placeholder `## Success metric` section with body `_TBD by founder_` (v10 finalizes the remaining sections — `## Class`, `## Tier`, `## Scope`, `## Bet source`, `## References`). `bet_id` resolves to the founder bet most relevant to the theme (from step 3). Active milestones stay in substate "planned" (no child tasks yet) — v10 fires milestone-decomposition to INSERT child tasks. (Pre-1.0.0 bucket keys `horizon:` / `success_metric:` were removed in the 1.0.0 description-bucket purge — no parser reads them anymore.)

If docs are sparse and no horizon themes can be extracted, skip Step 4 — v10 will INSERT the milestone set wholesale.

### 5. Tier 3 deferral path

If during gap-polling the founder raises a Tier 3 autonomous-mode question they want to defer, DO NOT force resolution. Append to `command-center/product/product-decisions.md`:

```markdown
### [<YYYY-QN>] <Question>
**Category**: <Strategy | Architecture | Product | Design | Compliance>
**Status**: Deferred — resolve at v10
**Context**: Surfaced during v1 onboarding gap-polling.
**Options on table**: <list of options the founder considered>
**Notes**: <any additional context the founder shared>
```

v10 batches all such deferrals into a single resolution `AskUserQuestion`.

## Deliverable

- `founder_bets` table — ≥1 row with `status='live'` (description prose populated per `claudomat-brain/db/SCHEMA.md` § founder_bets).
- `milestones` table — 0 or more horizon-theme rows in `status='todo'` (empty child task sets; v10 populates).
- `command-center/product/founder-stage.md` — `stage:` value set to one of the 4 valid values.
- `command-center/product/product-decisions.md` — any Tier 3 deferrals logged with `Status: Deferred — resolve at v10`.

## Exit criteria

- Vision + target user + product one-liner are unambiguously captured in `founder_bets` row description prose.
- ≥1 founder bet INSERTed with all required prose sections (statement / why I believe / horizon / confidence / falsifier — see `claudomat-brain/db/SCHEMA.md` § founder_bets for section headings).
- `founder-stage.md` `stage:` value is one of the 4 valid values.
- No outstanding ❌ essentials from step 1 extraction.
- (If polling happened) founder confirmed extracted content reflects intent (`Approve / Revise / Custom`).

## Next

→ Return to `../onboarding-loop.md` → Stage v2 (competitive-scan).
