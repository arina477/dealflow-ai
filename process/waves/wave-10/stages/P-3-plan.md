# Wave 10 — P-3 Plan (multi-spec: deterministic match spine + shortlist — M5 first bundle)

## Approach

### Action 1 — Architecture deltas
**New module: `apps/api/src/modules/matching/`** (mirrors the wave-9 buyer-universe / wave-8 mandate module shape).
- **MatchingService** — `createRunAsActor(mandateId, stUserId)`: actor=app users.id via getUserWithRole. Reads the mandate's SUBMITTED buyer_universe (400 if not submitted — the semantic guard), its 'included' buyer_universe_candidates + attached M3 contacts + the mandate_buyer_criteria; in ONE txn: upsert a match_run (buyer_universe_id UNIQUE — idempotent per universe, the wave-9 idempotent-container lesson) + compute a DETERMINISTIC rule-based fit_score per candidate + INSERT match_candidates (fit_score, score_breakdown jsonb, disposition 'pending'); run.status→'scored'; AUDIT match-run-create last-in-txn. `patchDispositionAsActor` (accept/reject/flag — cross-run-scoped, audited), `handoffAsActor` (mark ready-for-outreach — guard on ACCEPTED count ≥1, BUILD rule 6), `getRun`/`listByMandate`/`getShortlist`.
  - **The deterministic scorer** (`scoreCandidate(candidate, criteria, contacts) → {score:int 0-100, breakdown}`): a PURE function. Weighted dimensions (only what M3 supports meaningfully): sector/industry match vs criteria (token-match, the wave-9 tighter-match) [primary weight]; contact-completeness (≥1 contact, key fields present) [secondary]; data-present signals. Unsupported dims (geo/size/deal_type — absent on M3 companies) contribute 0 + a breakdown provenance note ('not applied — M3 lacks column', wave-9 pattern). **Weights + tie-breaks specified so scores DISCRIMINATE** (e.g. exact-sector-match=base + graded contact-completeness + a deterministic tie-break [candidate name / created order] so ties don't all collapse — problem-framer note). Pure/deterministic → unit-testable; NO LLM/randomness.
  - *Alt considered:* score in-place on buyer_universe_candidates — REJECTED: the M4/M5 boundary explicitly keeps score OFF M4 tables; match_candidates is the correct separate home + becomes the later-LLM substrate.
- **MatchingController** — POST /matches (create run), GET /matches/:id, GET /matches?mandateId=, PATCH /matches/:id/candidates/:cid (disposition), POST /matches/:id/handoff, GET shortlist. @Roles advisor/admin (create/mutate) + analyst (read) + module-load @Roles assertion; route-ordering (static sub-paths + /candidates/:cid before /:id — the wave-9 route-order lesson).
- **Failure-domain:** create-run writes match_run + N match_candidates + audit in ONE txn. Reads M4 buyer_universe/candidates + M3 companies/contacts + M4 criteria (read-only). RBAC add: /matches routes.
- **Web:** /matches-shortlist page (SSR-hydrated per design/matches-shortlist.html), reachable from the buyer-universe/mandate flow. NAV: NAV_MATCHES if design has it.
- **BOUNDARIES:** NO Anthropic/Claude/LLM, NO BullMQ, NO rationale-text, NO spend (deterministic only — later LLM bundle). accept/reject → ready-for-outreach HANDOFF status, NO outreach (M6).

### Action 2 — Data model (migration 0009, additive)
- **match_run**: id uuid pk, mandate_id uuid FK→mandates, buyer_universe_id uuid FK→buyer_universe **UNIQUE** (one run per universe — idempotent), created_by uuid FK users, status pgEnum('pending','scored') default 'pending', ready_for_outreach boolean default false (the M6 handoff marker), created_at/updated_at.
- **match_candidates**: id uuid pk, match_run_id uuid FK→match_run (cascade), buyer_universe_candidate_id uuid FK→buyer_universe_candidates, fit_score integer (0-100, CHECK 0..100), score_breakdown jsonb, disposition pgEnum('pending','accepted','rejected','flagged') default 'pending', created_at.
- Additive; NO changes to M4/M3. Migration 0009 drizzle-kit generate → journal `when` > 0008's 1783468800000 (BUILD rule 4) + .down.sql (per 0000-0006). Schema `apps/api/src/db/schema/matching.ts` mirroring buyer-universe.ts; export from index.ts.

### Action 3 — API contracts
- **POST /matches** {mandateId} → deterministic-scored match_run + ranked candidates (201). advisor/admin. Guard: buyer_universe.status='submitted' (400). Idempotent (universe UNIQUE). Audited.
- **GET /matches/:id** (+ ranked candidates DESC) / **GET /matches?mandateId=**. advisor/admin/analyst.
- **PATCH /matches/:id/candidates/:cid** {disposition} → accept/reject/flag (200). advisor/admin. cross-run-scoped (AND match_run_id → 404). Audited.
- **POST /matches/:id/handoff** → ready_for_outreach=true (200). advisor/admin. Guard: ≥1 accepted (400 — BUILD rule 6 semantic-predicate). Audited.
- Errors → Nest exceptions (400/401/403/404/409), DrizzleError.cause.code unwrap (wave-6). read-schema passthrough (BUILD rule 5).

### Action 4 — Dependencies
NONE new. Reuses drizzle/NestJS/Zod/Next. **NO Anthropic SDK, NO BullMQ, NO new secret** (deterministic — the LLM/SDK/queue is the deferred bundle). No external-SDK checklist.

## Plan (file-level steps)
**B-0 Schema** (backend-developer): matching.ts (match_run [buyer_universe_id UNIQUE + ready_for_outreach] + match_candidates [fit_score CHECK 0-100 + score_breakdown + disposition]) + index export + migration 0009 (journal when > 0008 + .down.sql).
**B-1 Contracts** (backend-developer/typescript-pro): shared/matching.ts (matchRun/matchCandidate + create/disposition/handoff inputs + MatchRankedList + Shortlist; read passthrough + z.string() timestamps; INPUT strict) + rbac (/matches advisor/admin/analyst + NAV_MATCHES; nav⊆RBAC) + audit (match-run-create/match-disposition/match-handoff actions).
**B-2 Backend** (backend-developer): matching module {module,controller,service,repository} — VALUE imports; the PURE deterministic scorer (weights/tie-breaks, unit-tested, no LLM) + one-txn create-run/disposition/handoff + audit-last-in-txn + actor-id + idempotent (universe UNIQUE) + submit-guard + accepted-count handoff-guard (rule 6) + cross-run-scoped PATCH + DrizzleError-unwrap; di-boot spec. Register in app.module.ts.
**B-3 Frontend** (nextjs-developer): /matches-shortlist page (SSR-hydrated per design; ranked list + fit_score + score_breakdown [framed as RULE-BASED, not AI-rationale] + accept/reject/flag + handoff) + _components; /matches-data non-page-colliding proxy for client mutations (wave-8/9 lesson); apiFetch rid; read passthrough.
**B-4 Wiring** + **B-5 Verify** + **B-6 Review** (head-builder polices BOTH boundaries — deterministic-only [grep no anthropic/llm/bullmq] + M5/M6).

### Action 6 — Specialist routing (validated against AGENTS.md)
backend-developer (B-0/B-1/B-2), typescript-pro (B-1 if split), nextjs-developer (B-3). All present.

### Action 7 — Parallelization map
B-0 → B-1 → B-2 → B-3 (serial; B-3 scaffolds on B-1 contracts). The pure scorer is independently unit-testable.

### Action 8 — Self-consistency sweep: CLEAN
Every AC → ≥1 step: match schema + deterministic score + ranked persist + idempotent + submit-guard + audit + actor-id (47ed7ddd → B-0/B-1/B-2); ranked page SSR-hydrate + rule-based framing (fb82d339 → B-3); accept/reject/flag + handoff + accepted-guard (f74dce45 → B-2 disposition/handoff + B-3). RBAC advisor-primary (B-1). BOTH boundaries enforced (deterministic-only + M5/M6 — head-builder polices B-6). design_gap FALSE. No new dep/SDK/secret. Wave-5..9 lessons embedded (actor-id, DrizzleError-unwrap, journal-when, idempotent-container, semantic-predicate-guard [rule 6], read-schema-passthrough [rule 5], SSR-hydrate, page-route-collision-avoidance, unsupportedDimensions).

```yaml
deps_new: []
schema_change: true   # migration 0009 (2 tables, additive)
new_secret: false
new_sdk: false   # NO Anthropic/LLM/BullMQ this bundle (deferred M5 bundle)
specialists: [backend-developer, typescript-pro, nextjs-developer]
reuse: [M4 buyer_universe/candidates, M3 companies.sector/contacts, M4 mandate_buyer_criteria, M1 RolesGuard, M2 AuditService, wave-3 AppShell, wave-5 apiFetch]
hard_boundaries: "deterministic-only (NO LLM/Claude/BullMQ/rationale/spend — later bundle) + M5/M6 (handoff not outreach)"
security_scope: audit + RBAC + actor-id + user-scoped writes (compliance-adjacent — P-4 may tighten)
self_consistency: clean
```
