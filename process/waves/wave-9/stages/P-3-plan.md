# Wave 9 — P-3 Plan (multi-spec: buyer-universe builder — M4 final bundle)

## Approach

### Action 1 — Architecture deltas
**New module: `apps/api/src/modules/buyer-universe/`** (mirrors the wave-8 mandate / wave-6 sourcing module shape).
- **BuyerUniverseService** — `assembleAsActor(mandateId, stUserId)`: reads the mandate + its M4 mandate_buyer_criteria, pulls M3 canonical `companies` as prospective buyers, and PERSISTS a buyer_universe (one per mandate) + buyer_universe_candidates rows (FK→companies, status 'candidate', provenance). `filterAsActor(universeId, stUserId)`: applies the mandate criteria (industry/geo/size_band/deal_type) → sets each candidate included|excluded (per-candidate audit provenance). `enrichAsActor` (attach M3 contacts to included candidates), `flagGaps` (candidates missing contacts/data), `submitAsActor` (status→submitted, ready-to-rank). `getById`/`list`. All mutations: one-txn + audit-last-in-txn (buyer-universe-* actions) + actor=app users.id via getUserWithRole (wave-5 lesson).
  - *Alt considered:* filter-on-assemble (one step, no persisted 'candidate' rows) — REJECTED: mvp-thinner + spec require per-candidate include/exclude AUDIT PROVENANCE (why each buyer entered/was excluded) — the M5 handoff + review UX read it; assemble-then-filter with persisted candidates is the correct model.
- **BuyerUniverseController** — POST /buyer-universe (assemble), POST /buyer-universe/:id/filter, POST /:id/enrich, GET /:id/gaps, POST /:id/submit, GET /buyer-universe/:id, GET /buyer-universe?mandateId=, PATCH a candidate membership. SessionGuard + RolesGuard (@Roles analyst/advisor/admin) + module-load @Roles assertion (wave-3 pattern).
- **Failure-domain:** assemble/filter write buyer_universe + N candidate rows + audit in ONE txn. Reads M3 companies + M4 criteria + M3 contacts (read-only — no writes to M3/M4 tables). RBAC add: /buyer-universe routes.
- **Web:** /buyer-universe page under apps/web/app/(app)/buyer-universe/ (SSR-hydrated, per design/buyer-universe.html), reachable from the wave-8 mandate-detail D6 'Buyer Engine' placeholder anchor. NAV: add if the design has a nav item (else reached via the mandate detail).
- **M4/M5 BOUNDARY (load-bearing):** NO fit-scoring / ranking / rationale / LLM. assemble + criteria-filter + enrich (M3 contacts) + flag gaps + submit-to-matching (ready-to-rank status). Ranking is M5.

### Action 2 — Data model (migration 0008, additive)
- **`buyer_universe`**: id uuid pk, mandate_id uuid FK→mandates (cascade), created_by uuid FK users, status enum('draft','filtered','submitted') default 'draft', created_at/updated_at timestamptz.
- **`buyer_universe_candidates`**: id uuid pk, buyer_universe_id uuid FK→buyer_universe (cascade), company_id uuid FK→companies (the M3 canonical company — the candidate), membership_status enum('candidate','included','excluded') default 'candidate', provenance text, created_at. **Partial-unique on (buyer_universe_id, company_id)** — idempotent re-assemble (no dup candidate for the same company; the wave-6 dedupe-idempotency lesson).
- Additive; NO changes to mandates/companies/contacts. Migration 0008 drizzle-kit generate → journal-registered (`when` > 0007's 1783382400000 — BUILD rule 4, the wave-7 Ghost-Green lesson). Schema file `apps/api/src/db/schema/buyer-universe.ts` mirroring mandate.ts; export from schema/index.ts.

### Action 3 — API contracts
- **POST /buyer-universe** {mandateId} → assembles → buyer_universe + candidates (201). analyst/advisor/admin. Audited. Re-assemble reconciles (partial-unique).
- **POST /buyer-universe/:id/filter** → include/exclude per criteria (200). Audited.
- **POST /buyer-universe/:id/enrich** → attach M3 contacts to included candidates (200). Audited.
- **GET /buyer-universe/:id/gaps** → flagged gaps (candidates missing contacts/data).
- **POST /buyer-universe/:id/submit** → status→submitted, ready-to-rank (200). Audited. Guard: assemble+filter first (400 if empty/unfiltered).
- **GET /buyer-universe/:id** (+ candidates) + **GET /buyer-universe?mandateId=** + **PATCH candidate membership** (include/exclude, audited).
- Errors → Nest exceptions (400/401/403/404/409), NOT bare 500 (DrizzleError.cause.code unwrap — wave-6). read-schema passthrough + z.string() timestamps (wave-7/8).

### Action 4 — Dependencies
NONE new. Reuses drizzle/NestJS/Zod/Next. No new SDK (enrich = existing M3 contacts, NOT a new vendor — that's M9). No new secret.

## Plan (file-level steps)
**B-0 Schema** (backend-developer): `apps/api/src/db/schema/buyer-universe.ts` (2 tables + partial-unique + relations) + schema/index.ts export + migration 0008 (drizzle-kit generate; journal `when` > 0007 — verify + report).
**B-1 Contracts** (typescript-pro OR backend-developer): `packages/shared/src/buyer-universe.ts` (buyerUniverseSchema [+ status], buyerUniverseCandidateSchema [+ membership + provenance], assemble/filter/submit inputs, list/detail read-shapes — read-schemas passthrough + z.string() timestamps; INPUT schemas .strict()) + index barrel + rbac.ts (/buyer-universe routes analyst/advisor/admin + NAV if design has it; nav⊆RBAC) + audit.ts (buyer-universe-assemble/filter/enrich/submit actions, additive).
**B-2 Backend** (backend-developer): buyer-universe module {module,controller,service,repository} — VALUE imports (DI lesson); one-txn assemble/filter/enrich/submit + audit-last-in-txn + actor-id; reads M3 companies (assemble) + M4 mandateBuyerCriteria (filter) + M3 contacts (enrich); RolesGuard + module-load @Roles; di-boot spec; DrizzleError.cause.code unwrap. Register in app.module.ts.
**B-3 Frontend** (nextjs-developer): apps/web/app/(app)/buyer-universe/ page (SSR-hydrated per design/buyer-universe.html — assemble/filter/review candidates + include/exclude + enrich view + gaps + submit) + _components; reachable from the mandate-detail D6 anchor; next.config /buyer-universe-data non-page-colliding proxy for client mutations (wave-8 lesson); apiFetch rid; read-schema passthrough.
**B-4 Wiring** + **B-5 Verify** + **B-6 Review** (orchestrator + head-builder + /review).

### Action 6 — Specialist routing (validated against AGENTS.md)
backend-developer (B-0, B-1, B-2), typescript-pro (B-1 if split), nextjs-developer (B-3). All present.

### Action 7 — Parallelization map
- B-0 → B-1 (contracts depend on schema) → B-2 (service depends on schema+contracts) → B-3 (page depends on B-2 endpoints + B-1 types). Largely serial; B-3 scaffolding can start on B-1 contracts.

### Action 8 — Self-consistency sweep: CLEAN
Every AC → ≥1 step: assemble+filter+persist+audit+actor-id (92a8ff3f → B-0/B-1/B-2); page assemble/filter/review SSR-hydrate (394a60ba → B-3); enrich+flag+submit (c907731f → B-2 enrich/gaps/submit + B-3 view). RBAC analyst-primary (B-1). M4/M5 boundary (NO scoring/ranking/LLM — enforce in B-2 + police at B-6/T/V). design_gap FALSE. No new dep/SDK/secret. Wave-5/6/7/8 lessons embedded (actor-id, DrizzleError-unwrap, journal-when, partial-unique-idempotency, read-schema-passthrough, SSR-hydrate, apiFetch-rid, page-route-collision-avoidance).

```yaml
deps_new: []
schema_change: true   # migration 0008 (2 tables, additive, partial-unique)
new_secret: false
specialists: [backend-developer, typescript-pro, nextjs-developer]
reuse: [M3 companies/contacts, M4 mandate_buyer_criteria + mandate-detail D6 anchor, M1 RolesGuard, M2 AuditService, wave-3 AppShell, wave-5 apiFetch]
m4_m5_boundary: "assemble+filter+enrich+flag+submit only; NO scoring/ranking/rationale/LLM (M5)"
security_scope: audit + RBAC + actor-id + user-scoped writes (compliance-adjacent — P-4 may tighten)
self_consistency: clean
```
