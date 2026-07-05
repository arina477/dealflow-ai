# Wave 12 — P-3 Plan (multi-spec: pipeline spine + board + timeline — M6 pipeline half)

## Approach

### Action 1 — Architecture deltas
**New module `apps/api/src/modules/pipeline/`** (mirrors wave-11 outreach / wave-10 matching module shape).
- **PipelineService** — `enrollAsActor` (eligible-source guard: reads outreach status='send_eligible' OR accepted match_candidate under ready_for_outreach run; idempotent via DB UNIQUE on the deal target + find-or-refuse) / `transitionStageAsActor` (fixed-enum guard; writes stage_changed event) / `addNoteAsActor` (append-only note event). Every mutation: one txn, M2 AuditService.append LAST-IN-TXN (reuse — the wave-5/11 pattern), actor via M1 getUserWithRole (app users.id). Reads-in-txn use tx-scoped repo handle (BUILD rule 7).
  - *Alt considered:* a service-level find-or-insert for idempotent enroll — REJECTED for the DB UNIQUE constraint + fail-on-conflict (the wave-9 double-universe race lesson: structural guard, not service-level check).
  - *Alt considered:* configurable per-mandate stages — REJECTED per product-decision #137 (fixed enum for MVP; configurable H2-deferred).
- **PipelineController** (board) + timeline read routes. @Roles (advisor + compliance); route-ordering static-before-:id (wave-9); DrizzleError.cause.code unwrap (wave-6).
- **Failure-domain:** enroll/transition/addNote each = one txn + audit (crosses into M2 audit). Reads mandates/match_candidates/outreach (read-only, shipped). Writes pipeline/pipeline_events (new). RBAC add: /pipeline routes.
- **Web:** /pipeline board page (SSR-hydrated, stage columns per design/pipeline.html) + a per-deal timeline panel (on the deal view). /pipeline-data + (if needed) /pipeline-events-data non-page-colliding proxies (wave-8/9). apiFetch rid; read-passthrough.
- **BOUNDARIES:** NO email/webhook/send, NO LLM, NO new SDK/spend. Additive only.

### Action 2 — Data model (migration 0011, additive)
- **pipeline**: id uuid pk, mandate_id FK->mandates, deal_source_type enum(outreach|match_candidate), outreach_id FK->outreach nullable, match_candidate_id FK->match_candidates nullable (exactly one set — CHECK), stage pgEnum **pipeline_stage** ['shortlisted','contacted','engaged','diligence','offer','closed','withdrawn'] default 'shortlisted', created_by/updated_by FK->users, created_at/updated_at. UNIQUE on the deal target (outreach_id / match_candidate_id) for idempotent enroll.
- **pipeline_events**: id uuid pk, pipeline_id FK->pipeline cascade, event_type pgEnum **pipeline_event_type** ['enrolled','stage_changed','note'], from_stage/to_stage pipeline_stage nullable, note text nullable, actor_id FK->users, created_at. Append-only (no update/delete path).
- Additive; NO alter of M4/M5/M6. drizzle-kit generate 0011 → journal when > 0010 (BUILD rule 4) + .down.sql (drop 2 tables + 2 enums). Schema apps/api/src/db/schema/pipeline.ts + index export. DISTINCT enum names (avoid collision — the wave-11 outreach_approval_status lesson).

### Action 3 — API contracts
- **GET /pipeline** (?mandateId) → deals grouped by stage; advisor+compliance; passthrough read.
- **POST /pipeline** (enroll {sourceType, sourceId}) → 201 pipeline row | 400 ineligible | 409 duplicate; advisor; audited.
- **PATCH /pipeline/:id/stage** (transition {toStage}) → 200 updated | 400 illegal stage | 404; advisor; audited.
- **POST /pipeline/:id/notes** (addNote {text}) → 201 event | 400 empty | 401/403; advisor+compliance; audited.
- **GET /pipeline/:id/events** → ordered timeline (enrolled + stage_changed + note); advisor+compliance; passthrough.
- Errors → Nest exceptions; DrizzleError.cause.code unwrap; read-passthrough (BUILD rule 5).

### Action 4 — Dependencies
NONE new. Reuses drizzle/NestJS/Zod/Next + M2 AuditService + M1 RolesGuard/getUserWithRole. NO Anthropic, NO email SDK, NO new secret. No external-SDK checklist.

## Plan (file-level steps)
**B-0 Schema** (backend-developer): pipeline.ts (2 tables + 2 enums + UNIQUE + CHECK) + index export + migration 0011 (journal when>0010 + .down.sql).
**B-1 Contracts** (backend-developer/typescript-pro): shared/pipeline.ts (pipelineStage/eventType enums + read schemas passthrough + z.string() timestamps; enroll/transition/addNote inputs .strict()) + rbac (/pipeline advisor+compliance; + NAV) + audit action names (pipeline-enroll/transition/note).
**B-2 Backend** (backend-developer): pipeline module {module,controller,service,repository,spec} — eligible-source guard + idempotent-enroll (DB UNIQUE + fail-on-conflict) + fixed-enum transition guard + append-only note; one-txn + audit-last-in-txn + actor-id + tx-scoped reads (rule 7); DrizzleError-unwrap; di-boot spec. Register in app.module. Reuse AuditModule + AuthModule.
**B-3 Frontend** (nextjs-developer): /pipeline board page (stage columns per design/pipeline.html; enrolled deals w/ mandate+buyer; move-to-stage → PATCH) + per-deal timeline panel (GET events; add-note) + _components; /pipeline-data proxy; SSR-hydrate; apiFetch rid; read-passthrough. NO send/AI affordances.
**B-4 Wiring** + **B-5 Verify** + **B-6 Review** (head-builder polices: additive migration, audit-last-in-txn, idempotent-enroll structural, fixed-enum guard, append-only notes, RBAC, boundaries).

### Action 6 — Specialist routing (validated against AGENTS.md)
backend-developer (B-0/B-1/B-2), typescript-pro (B-1 if split), nextjs-developer (B-3). All present in AGENTS.md.

### Action 7 — Parallelization map
B-0 → B-1 → B-2 (service+guards+audit) → B-3 (board+timeline pages). Serial (B-3 consumes B-2 endpoints). The eligible-source guard + idempotent-enroll + fixed-enum transition are independently unit-testable.

### Action 8 — Self-consistency sweep: CLEAN
Every AC → ≥1 step: spine+enroll+transition+audit+actor (07989285 → B-0/B-1/B-2); board API+RBAC+page+illegal-transition-server-reject (d1940142 → B-2 controller + B-3 page); note+timeline+audit-last-in-txn+append-only (45b259e1 → B-2 addNote/events + B-3 timeline panel). design_gap_flag FALSE (pipeline.html). No new dep/SDK/secret. Wave-4..11 lessons embedded (M2 audit-last-in-txn + actor-id + DrizzleError-unwrap + journal-when + tx-scoped-reads rule 7 + read-passthrough rule 5 + SSR-hydrate + page-route-collision-avoidance + idempotent-container DB-UNIQUE + distinct-enum-name).

```yaml
deps_new: []
schema_change: true   # migration 0011 (2 tables + 2 enums, additive)
new_secret: false
new_sdk: false
specialists: [backend-developer, typescript-pro, nextjs-developer]
reuse: [M2 AuditService HMAC-chain + last-in-txn, M1 RolesGuard/getUserWithRole, wave-11 outreach send_eligible, wave-10 match_run/match_candidates, wave-8 mandates, wave-3 AppShell, wave-5 apiFetch]
compliance_invariants: [every-mutation-audited-last-in-txn, append-only-events, idempotent-enroll, fixed-enum-transition-guard, eligible-source-guard]
hard_boundaries: "NO email/webhook/send + NO LLM + NO new SDK/spend — additive pipeline tracking over shipped surfaces"
design_gap_flag: false
self_consistency: clean
```
