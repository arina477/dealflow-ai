# Stage v3 — Product Scope: Personas × Flows × Features × Tools/Modules

## Purpose
Decompose the product into scope artifacts: persona-anchored user flows, feature catalog with horizon classification, and the tools/modules map of reusable building blocks. These three converge in v4 (page map) and feed v6 (architecture) and v7–v9 (design).

## Prerequisites
- v1 complete (Vision + bets known; `founder-stage.md` populated).
- v2 complete (competitor tier-ranking + UX patterns observed).
- v0 docs + v2 screenshots available for reference.
- READ `command-center/product/founder-stage.md` — `stage:` value governs horizon defaulting in step 2.

## Actions

### 1. Personas — extract + confirm via options-and-custom

Extract personas from v1 target-user content + v2 competitor user-segment observations. Build a draft persona list (typical: 2–5 — e.g., buyer / seller / admin / visitor).

Fire `AskUserQuestion`:

> "I extracted <N> personas from the docs and competitive scan: <list with one-line each>. Pick how to proceed:"
>
> 1. **Approve as-is** — proceed with these <N> personas.
> 2. **Trim** — remove some; tell me which.
> 3. **Add** — append additional personas; tell me which.
> 4. **Replace** — discard mine; you provide the persona list.
> 5. **Custom** — describe the persona model and I'll capture it.

For each confirmed persona, enumerate end-to-end **user flows** (one flow = one goal). Per flow, write:

- Flow name + persona
- Trigger / entry point (URL, button, event)
- Step-by-step narrative (5–15 steps)
- Success state
- Failure modes
- Cross-persona handoffs (e.g., buyer order → seller fulfillment)

Write to: `command-center/product/user-flows.md`.

### 2. Feature catalog — extract + horizon-classify

Enumerate every feature implied by flows + docs + competitive scan. Per feature:

- Name + one-line description
- Primary persona(s)
- Related user flow(s) from step 1
- Dependencies (auth, payments, storage, realtime, etc.)
- MVP / H2 / H3 classification
- Complexity estimate (S/M/L/XL)

#### Horizon defaulting by founder stage

Read `command-center/product/founder-stage.md`. Features whose theme is **GDPR / consent UI / privacy-rights / audit log / admin-policy / cross-border-data / AI Act transparency / regulated-compliance** default as follows:

| Founder stage | Default horizon for compliance-themed features |
|---|---|
| `self-use-mvp` | H2 |
| `pilot-customer` | H2 |
| `paying-customers` | H1 |
| `regulated-day-1` | H1 |

Exception: a named regulatory deadline or named first-customer requirement overrides — tag H1 regardless of stage and cite the deadline inline. Non-compliance features use normal MVP/H2/H3 judgment.

After draft catalog is built, fire `AskUserQuestion`:

> "I drafted <N> features (<X> MVP, <Y> H2, <Z> H3). Pick how to proceed:"
>
> 1. **Approve as-is** — proceed to tools/modules mapping.
> 2. **Reclassify horizons** — tell me which features should move horizons.
> 3. **Add features** — list features I missed.
> 4. **Remove features** — list features that don't belong.
> 5. **Custom** — describe what's wrong and I'll restructure.

Write to: `command-center/product/feature-list.md`.

### 3. Tools / modules identification

From features + flows, extract **reusable building blocks**. First pass; v6 architecture will deepen it. Categories:

- **External services**: payment providers, auth providers, email/SMS, object storage (S3-compatible / Railway Buckets), CDN, analytics, error tracking, monitoring.
- **Internal modules**: authentication, user management, billing, notifications, search, file upload, admin panel, rate limiting, audit log, i18n.
- **Shared primitives**: form components, data tables, modals, toasts, design tokens.
- **Background work**: cron jobs, queues, webhook processors.

Per tool/module: name + one-line purpose + which features consume it.

Write to: `command-center/product/tools-modules-map.md`.

### 4. Cross-reference + consistency check

Self-audit:
- Every feature references ≥1 user flow (or is explicitly flagged as infrastructure).
- Every module/tool references ≥1 feature that uses it.
- Every persona has ≥1 user flow.
- No orphan flows.

Flag and resolve internal inconsistencies before closing the stage. If resolution requires founder choice, fire `AskUserQuestion` with options-and-custom (Collapse / Keep both / Collapse with note / Custom).

## Deliverable

- `command-center/product/user-flows.md` — persona × flow narratives.
- `command-center/product/feature-list.md` — MVP + H2 + H3 feature catalog (compliance horizon-defaulted by founder-stage).
- `command-center/product/tools-modules-map.md` — reusable building-block inventory.

## Exit criteria

- All three files populated with ≥1 entry per section.
- Cross-reference audit (step 4) passes with zero unresolved inconsistencies.
- Every MVP-classified feature has a user flow that covers its primary use case.
- Founder approved the persona list, feature catalog, and any reclassifications.

## Next

→ Return to `../onboarding-loop.md` → Stage v4 (page-map).
