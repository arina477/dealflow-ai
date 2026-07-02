# Stage v7 — Design Direction: /aidesigner Proposal + Approval Loop

## Purpose
Land a single one-page design proposal that defines the visual language for the whole product — color, type, shape, motion, density, overall "vibe". v8 (system) and v9 (per-page) consume this direction.

**Skip rule.** Backend-only / API-only / CLI / library projects skip this stage. v6b's Tools branch should classify the project; if ambiguous, fire one `AskUserQuestion` with options-and-custom (UI project / Backend-only / Hybrid / Custom).

## Prerequisites
- v1 complete (FOUNDER-BETS vision anchors emotional direction).
- v2 complete (Tier 1 competitor screenshots available for reference).
- v3 + v4 complete (at least one representative page is known).
- `/aidesigner` skill present (verified by `claudomat doctor`).
- READ `design/brief-template.md` (project-side template).

## Actions

### 1. Pick the representative page — options-and-custom

Fire `AskUserQuestion`:

> "Which page should anchor the design direction? It'll set the visual language for everything else."
>
> 1. **Home / landing** — public marketing surface (default for most products).
> 2. **Logged-in dashboard** — first authed view (default for tools / SaaS where the marketing site is secondary).
> 3. **Core product page** — the canonical screen users live on (default for marketplaces / catalogs / editors).
> 4. **Signup / onboarding flow** — first-impression sequence (default for products where activation is everything).
> 5. **Custom** — specify a different page from the v4 inventory.

### 2. Build the direction brief

Write a one-shot brief for `/aidesigner` to `process/session/onboarding/v7-direction-brief.md`:

```markdown
# Direction Brief — <Project>

## Product one-liner
<From FOUNDER-BETS vision>

## Audience tone
<Who is this for, how should they feel when they land on it>

## Emotional anchors
<3-5 adjectives — e.g., "confident / calm / fast / credible / no-BS">

## Visual references
- Competitor <Tier 1 #1>: <what we want to match / beat> — see `command-center/artifacts/competitive-benchmarks/<competitor>.md` screenshots
- Competitor <Tier 1 #2>: <what's instructive>
- <Optional> External reference: <Linear / Stripe / Notion / etc.> for <specific attribute>

## Hard constraints
- Must be responsive (1024 / 1280 / 1440 minimum; mobile if v3 says so)
- Must support <dark mode | light mode | both> as default
- Must render the chosen representative page with real-looking content (not lorem)

## The page to design
<Representative page from step 1 — pull content from per-page-pd/<page>.md>

## Out of scope for this direction pass
- Multi-page consistency (comes in v9)
- Component variants (comes in v8)
- Edge states (comes in v9)
```

If the founder has constraint preferences not yet captured (e.g., dark-mode-default vs light-mode-default), fire `AskUserQuestion` with options-and-custom (Light default / Dark default / Both / Custom).

### 3. Invoke `/aidesigner`

Invoke per `claudomat-brain/rules/skill-use.md`. Pass the brief. Request a single HTML page rendering the chosen representative page.

Output lands in: `design/staging/direction.html`.

### 4. Founder approval loop — options-and-custom

Present the staging page via `AskUserQuestion`:

> "Initial design direction generated: `design/staging/direction.html`. Pick:"
>
> 1. **Approve** — commit as canonical direction; v8 builds the design system on top.
> 2. **Revise — keep core, change specifics** — tell me what to adjust (e.g., 'too dense', 'colors feel corporate', 'hierarchy is weak'). I'll regenerate with your feedback.
> 3. **Reject — start fresh** — different brief entirely. We'll re-do step 2 with a new reference set.
> 4. **Pick from prior attempts** — if we've already iterated, surface the last 3 staging files and pick one.
> 5. **Custom** — describe what you want and I'll capture it as refine prompt.

Loop:
- **Revise**: aggregate feedback, re-invoke `/aidesigner` with refine prompt, return to step 4.
- **Reject**: rewrite the brief (step 2) with new references, go back to step 3.
- **Pick from prior**: canonicalize the chosen prior staging file directly.
- **Approve**: proceed to step 5.

Iteration cap: 5 revise iterations OR 2 rejects. After cap, force a `Pick from prior attempts / Custom override / Escalate to founder for manual direction` poll.

### 5. Canonicalize approved direction

```bash
git mv design/staging/direction.html design/direction.html
```

Optional incremental commit:

```bash
git commit -m "chore(onboarding): v7 design direction approved"
```

### 6. Log decision

Append to `command-center/product/product-decisions.md`:

```markdown
### [<YYYY-QN>] Design direction approved
**Category**: Design
**Status**: Active
**Context**: v7 onboarding design direction.
**Decision**: <one-paragraph description of the approved direction — colors, type, shape, emotional anchors>
**Rationale**: <why this won vs iterations / rejects>
**Artifacts**: `design/direction.html`, `process/session/onboarding/v7-direction-brief.md`
```

## Deliverable

- `design/direction.html` — approved canonical direction.
- `process/session/onboarding/v7-direction-brief.md` — the brief that produced it.
- `command-center/product/product-decisions.md` — direction decision logged.

## Exit criteria

- Founder explicitly chose **Approve** (or **Pick from prior attempts**).
- `design/direction.html` is canonicalized (no longer in `staging/`).
- Decision is logged.

## Next

→ Return to `../onboarding-loop.md` → Stage v8 (design-system).
