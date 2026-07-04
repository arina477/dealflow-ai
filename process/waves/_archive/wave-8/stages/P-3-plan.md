# Wave 8 — P-3 Plan (multi-spec: mandate spine + list + detail)

## Approach

### Action 1 — Architecture deltas
**New module: `apps/api/src/modules/mandate/`** (mirrors the wave-5 compliance / wave-6 sourcing module shape).
- **MandateService** — `create(input, actorStId, tx?)` + `configure(id, input, actorStId)` write the mandate + buyer_criteria + compliance_profile in ONE transaction (`runInTransaction`), audit LAST-IN-TXN via M2 AuditService.append (rollback on audit fail), actor = app users.id via `AuthRepository.getUserWithRole` (NOT raw SuperTokens id — wave-5 FK lesson). `list(filter)` + `getById(id)` for the list/detail reads.
  - *Alt considered:* three separate service calls (create mandate, then criteria, then compliance) — REJECTED: a partial mandate (profile without compliance) is an invalid half-configured state the M6 gate would later mis-read; the one-txn atomic write is the correct failure domain.
- **MandateController** — POST /mandates (advisor/admin), PATCH /mandates/:id (advisor/admin), GET /mandates (advisor/admin/analyst), GET /mandates/:id (advisor/admin/analyst). Guarded by the M1 SessionGuard + RolesGuard (`@Roles(...rolesForRoute('/mandates'))`) with a module-load non-empty @Roles assertion (the wave-3 pattern).
- **Failure-domain:** the create expands a transaction to 3 tables + the audit append (4 writes, 1 txn). Crosses into the M2 compliance tables via FK (read-only reference — no write to M2 tables). RBAC add: /mandates routes.
- **Web:** 3 pages under `apps/web/app/(app)/mandates/` — `page.tsx` (list), `new/page.tsx` (create form), `[id]/page.tsx` (detail, SSR-hydrated). Per design/mandate-*.html, in the wave-3 AppShell. NAV: add a Mandates nav item (nav⊆RBAC).

### Action 2 — Data model (migration 0006, additive)
- **`mandates`**: id (uuid pk), created_by (uuid FK users.id), seller_name, seller_industry/sector, description, deal_type, status (enum `draft`|`active`, default `draft`), created_at/updated_at (timestamptz). 
- **`mandate_buyer_criteria`**: id, mandate_id (uuid FK mandates.id, on-delete cascade), industry, geo, size_band, deal_type — all nullable filter dims (core 4, aligned to M3 canonical company fields; NO speculative DSL — problem-framer flag #3).
- **`mandate_compliance_profile`**: id, mandate_id (uuid FK mandates.id UNIQUE — 1:1, cascade), jurisdiction (text[] or text), disclaimer_template_id (uuid FK disclaimer_templates.id), suppression_scope (jsonb/text). CAPTURED only; read by the later M6 gate (problem-framer flag #2 — UI frames as captured-not-enforced).
- **3 tables over JSONB-on-mandates (problem-framer flag #1):** buyer_criteria is server-side FILTERED by the later buyer-universe builder + compliance_profile is READ by the M6 gate → both need queryable columns + FK integrity, not opaque JSON. Justified.
- Migration additive; drizzle-kit generate → journal-registered (BUILD rule 4 — the `when` timestamp must be > 0005's; the wave-7 lesson). Schema file `apps/api/src/db/schema/mandate.ts` mirroring sourcing.ts; export from schema/index.ts.

### Action 3 — API contracts
- **POST /mandates** — req `mandateCreateSchema` (profile + buyer criteria + compliance profile); res `Mandate` (201). Auth: advisor/admin (RolesGuard). One-txn, audited. Non-idempotent create.
- **PATCH /mandates/:id** — req partial configure; res `Mandate` (200). Auth: advisor/admin. Audited. draft→active transition when complete.
- **GET /mandates** — query `?status=draft|active|all`; res `Mandate[]`. Auth: advisor/admin/analyst.
- **GET /mandates/:id** — res `MandateDetail` (mandate + criteria + compliance profile); 404 if not found. Auth: advisor/admin/analyst.
- Error envelopes: 400 (validation / bad disclaimer_template_id FK), 401 (anon), 403 (non-authorized role), 404 (detail not found). Errors mapped to Nest exceptions (NOT bare 500 — the wave-6 DrizzleQueryError lesson: unwrap err.cause.code for pg codes).

### Action 4 — Dependencies
NONE new. Reuses drizzle, NestJS, Zod, Next.js — all installed. No new SDK, no new secret. (No external-SDK checklist needed.)

## Plan (file-level steps)

**B-1 Schema** (backend-developer):
- `apps/api/src/db/schema/mandate.ts` (create) — 3 tables + relations, mirror sourcing.ts.
- `apps/api/src/db/schema/index.ts` (modify) — export mandate schema.
- `apps/api/src/db/migrations/0006_*.sql` (+ .down + journal + snapshot) — drizzle-kit generate; verify journal `when` > 0005 (BUILD rule 4).

**B-2 Contracts** (typescript-pro):
- `packages/shared/src/mandate.ts` (create) — mandateSchema, mandateBuyerCriteriaSchema, mandateComplianceProfileSchema, mandateCreateSchema, mandateConfigureSchema, MandateListFilter, MandateDetail; **read-schema timestamps `z.string()` NOT `.datetime()`; entity schemas tolerant of the real API shape (wave-7 lesson)**.
- `packages/shared/src/index.ts` (modify) — barrel export.
- `packages/shared/src/rbac.ts` (modify) — add /mandates routes (POST/PATCH advisor/admin; GET advisor/admin/analyst) + NAV_MANDATES; nav⊆RBAC. `rbac.test.ts` update.
- `packages/shared/src/audit.ts` (modify) — add `mandate-create` + `mandate-configure` audit actions (additive).

**B-3 Backend** (backend-developer):
- `apps/api/src/modules/mandate/{mandate.module,mandate.controller,mandate.service,mandate.repository}.ts` (create) — VALUE imports for DI'd classes (AuditService, AuthRepository — the wave-2/7 import-type DI lesson); one-txn create/configure + audit-last-in-txn + actor-id translation; RolesGuard + module-load @Roles assertion; a di-boot spec.
- Register MandateModule in `app.module.ts` (modify). AuthModule must export AuthRepository (already does from wave-3); AuditModule exports AuditService (already does).

**B-4 Frontend** (nextjs-developer):
- `apps/web/app/(app)/mandates/page.tsx` (list, per mandates-list.html) + `new/page.tsx` (create form, per mandate-new.html; compliance framed as CAPTURED-not-enforced) + `[id]/page.tsx` (detail SSR-hydrated per mandate-detail.html — server fetches full detail, passes serializable props; NO client fetch to the /mandates/:id page route — wave-7 lesson) + `_components/*`.
- `apps/web/next.config.ts` (modify) — /mandates afterFiles proxy rewrites (POST/PATCH/GET; a non-page-colliding path for any client detail refetch if needed — wave-7 lesson).
- mutations via apiFetch (rid:'anti-csrf' — wave-5).

**B-5 Wiring** + **B-6 Review** (orchestrator + head-builder + /review).

### Action 6 — Specialist routing (validated against AGENTS.md)
typescript-pro (B-2), backend-developer (B-1, B-3), nextjs-developer (B-4). All present in AGENTS.md.

### Action 7 — Parallelization map
- B-1 → B-2 (shared contracts depend on schema shape) → serial.
- B-3 depends on B-1+B-2 (schema + contracts). B-4 depends on B-2 (shared types) + B-3 (endpoints live). B-3 and B-4 largely serial (B-4 consumes B-3's API), but B-4's page scaffolding can start against the B-2 contracts.
- Within B-4: the 3 pages are parallel-authorable (list / new / detail independent) but share the _components — author in one nextjs pass.

### Action 8 — Self-consistency sweep: CLEAN
Every AC → ≥1 step: create form + one-txn 3-table + audited + actor-id (ba0edebf → B-1/B-2/B-3); list + filter + empty-state (c070ca23 → B-3 GET + B-4 list); detail + SSR-hydrate + edit (50227055 → B-3 GET/:id + B-4 [id]). RBAC advisor/analyst (B-2 rbac). compliance-captured-not-enforced (B-4 copy). design_gap FALSE. No new dep/SDK. Wave-5/6/7 lessons embedded (actor-id, DrizzleError-unwrap, journal-when, read-schema-real-serialization, SSR-hydrate, apiFetch-rid).

```yaml
deps_new: []
schema_change: true   # migration 0006 (3 tables, additive)
new_secret: false
specialists: [typescript-pro, backend-developer, nextjs-developer]
reuse: [M1 RolesGuard/RBAC, M2 AuditService + compliance tables, M3 canonical fields, wave-3 AppShell, wave-5 apiFetch]
security_scope_tightened: true   # compliance-profile capture + user-scoped writes + audit → P-4 tightened gate
self_consistency: clean
```

---

## P-4 precision addendum (jenny D1-D6 — design↔spec reconciliation)
- **D2 (disclaimer derive):** B-3 MandateService resolves disclaimer_template_id from the selected jurisdiction (disclaimer_templates jurisdiction-keyed) — no picker; no-match → 400. B-4 mandate-new = jurisdiction dropdown only.
- **D3 (seller geo/size):** B-1 mandates table += seller_geo (text[]/text) + seller_size_band (text). B-4 mandate-new §1 captures Regions + Company Size.
- **D4 (suppression scalar):** B-1 suppression_scope scalar (text/tags); B-4 = text/tags input (NOT the design CSV dropzone — deferred). Copy notes the simplification.
- **D5 (acknowledgments capture+audit):** B-1 mandate_compliance_profile += acknowledgments (jsonb {key:bool} or 3 bool cols); B-3 create requires all 3 true (400) + persists them in the audited txn; B-4 mandate-new §3 the 3 required checkboxes.
- **D6 (detail placeholders):** B-4 mandate-detail renders Buyer Engine / Ranked Candidates / Pipeline as labelled deferred placeholders (stable mount points for the next M4 bundle) — NOT built, NOT dropped.
- **D1 (honesty):** the "aligned to M3 canonical fields" claim softened — only sector aligns today; geo/size_band/deal_type are mandate-side capture.
