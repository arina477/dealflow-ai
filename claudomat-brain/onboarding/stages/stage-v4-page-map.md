# Stage v4 — Page Map + Per-Page PDs (Parallelized)

## Purpose
Produce the canonical page map of the product (every web page / route / screen) and one detailed product-description file per page. These feed v7–v9 (design) as implementation specs and v10 (planning) as task-coverage baseline.

## Prerequisites
- v3 complete (user flows + features + tools-modules-map exist).
- READ `claudomat-brain/rules/sub-agent-invocation.md` (for parallel `product-manager` spawns in step 3).
- READ `command-center/product/founder-stage.md` — `stage:` value governs the compliance-surface quota in step 1.5.

## Actions

### 1. Enumerate pages — extract + confirm via options-and-custom

From v3 flows + features, identify every page/screen. Default categories:

- **Marketing / public**: home, about, pricing, contact, terms, privacy, blog.
- **Auth**: signup, login, forgot-password, reset-password, email-verify.
- **Core product**: dashboards, listing/catalog, detail views, checkout/purchase, settings.
- **Admin**: admin dashboard, user management, content moderation, audit logs.
- **Support / policy**: help center, FAQ, contact support, dispute resolution.

Each page gets: page name + route + primary persona(s) + related flow(s) from v3.

Fire `AskUserQuestion`:

> "I drafted a <N>-page map across <K> categories: <one-line summary per category>. Pick how to proceed:"
>
> 1. **Approve as-is** — proceed to compliance-quota check.
> 2. **Add pages** — tell me which to add (with category + persona).
> 3. **Remove pages** — tell me which to drop.
> 4. **Restructure** — re-categorize / merge / split; describe what you want.
> 5. **Custom** — describe the page-map structure and I'll capture it.

### 1.5. Compliance-surface quota (founder-stage gate)

Before step 2, count pages classified as **privacy / consent UI / audit log / compliance admin / data-rights-export / cross-border-data / admin-policy**. Compare against MVP page count.

| Founder stage | Quota | Excess handling |
|---|---|---|
| `self-use-mvp` | ≤ ~10% of MVP pages | excess pages → stub PD (one screen, 1–2KB), not full fan-out |
| `pilot-customer` | ≤ ~10% of MVP pages | excess pages → stub PD |
| `paying-customers` | no cap | full fan-out |
| `regulated-day-1` | no cap | full fan-out |

For excess pages in the first two stages: generate a **short stub PD** (Purpose 1 paragraph + Audience + minimum interactions + "H2 expansion deferred — see founder-stage.md"). Do NOT spawn a `product-manager`. Mark the entry in the page map with `[stub — H2 expansion deferred]`.

Log the quota decision in working memory so step 3 knows which pages to skip full expansion on.

### 2. Write page map

Write consolidated page map to: `command-center/artifacts/user-journey-map.md`.

Format:

```markdown
# User Journey Map — <Project>

## Page inventory

| Page | Route | Persona(s) | Related flows | Tools/modules used |
|---|---|---|---|---|
| Home | `/` | visitor | browse, signup-entry | header-nav, hero, feature-cards |
| ... |

## Flows cross-reference

### <Flow name> (<persona>)
- Entry: <page>
- Steps: <page> → <page> → <page>
- Exit: <page>
- Related features: <feature-list ref>
```

Consolidates v3 flows + page inventory into one navigable doc. T-5 (E2E swarm) and T-9 (journey audit) consume this on every wave.

### 3. Parallel per-page PD generation

For each page NOT marked `[stub — H2 expansion deferred]`, spawn `product-manager` IN PARALLEL via `Agent(subagent_type=product-manager)` to generate the extensive product description. Batch size: up to 5 agents in parallel to avoid context saturation.

Stub-marked pages skip full PD expansion — the short stub from step 1.5 is the deliverable until promoted to H1.

Each per-page agent receives:
- Page name + route + personas + related flows.
- Relevant feature entries from `feature-list.md`.
- Relevant module references from `tools-modules-map.md`.
- Tier 1 competitor equivalent-page screenshots from `competitive-benchmarks/` (if available).

Each agent produces: `command-center/product/per-page-pd/<page-kebab-name>.md`.

Per-page PD contents:
- **Purpose** — one paragraph, why this page exists.
- **Audience** — primary + secondary personas + auth state (anon / authed / role-gated).
- **Entry points** — where users arrive from.
- **Content sections** — top-to-bottom page anatomy (header / hero / content sections / CTAs / footer).
- **Interactions** — clickable elements + their destinations / side-effects.
- **Data requirements** — what API endpoints feed this page (placeholder names; v6b reconciles).
- **Empty / error / loading states** — each explicitly designed.
- **Responsive breakpoints** — mobile / tablet / desktop considerations.
- **Success metrics** — what "this page works" looks like (for testing).
- **Competitor comparison** — how Tier 1 competitors handle the equivalent page; what we do same / different.

### 4. Consolidate + cross-check

After all per-page PD files exist:
- Verify every page from step 1 has a corresponding PD file (or a stub annotation).
- Scan for duplicated content across PDs — if multiple pages describe the same module, consolidate references to `tools-modules-map.md`.
- Update `user-journey-map.md` with a "Per-page PDs" section linking to each file.

## Deliverable

- `command-center/artifacts/user-journey-map.md` — page map + flows cross-reference + PD file links.
- `command-center/product/per-page-pd/<page-name>.md` × N — one file per non-stub page; stub markdown for excess compliance pages.

## Exit criteria

- Every enumerated page has a per-page PD file (or a stub).
- `user-journey-map.md` is complete and navigable (links resolve).
- No feature from v3 `feature-list.md` is "orphaned" (not consumed by any page).
- No page is "unreachable" (not connected to any flow).
- Founder approved the page map.

## Next

→ Return to `../onboarding-loop.md` → Stage v5 (stack-selection).
