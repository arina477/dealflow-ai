# Wave 11 — P-3 Plan (multi-spec: template library + composer + non-bypassable pre-send gate + SoD — M6 first bundle)

## Approach

### Action 1 — Architecture deltas
**New module: `apps/api/src/modules/outreach/`** (mirrors the wave-5 compliance-gate / wave-8 mandate module shape).
- **TemplateService** — `create` (template + v1) / `draftNewVersion` (ALWAYS a new version row + content_hash; never mutate an approved version) / `requestApproval` (required-compliance-block check). `isUsableForSend(version)` predicate (the VERSION-BINDING INVARIANT: approval_status='approved' AND approved_content_hash == current content_hash). Content hashing reuses the M2 content-hash approach (apps/api/src/modules/compliance-gate/evaluators/content-hash.ts / the wave-4 content-hash keyless SHA-256).
- **TemplateApprovalService** (or in TemplateService) — `grantApproval` (compliance-role; sets approved_content_hash = current content_hash) / `reject`. RBAC compliance-only. Records the approver (for SoD).
- **OutreachService.composeAsActor** — composes an outreach from a template version to a shortlist buyer; **runs the NON-BYPASSABLE PRE-SEND GATE server-side** = REUSE the M2 **ComplianceGateService.evaluate** (the sole send-eligibility authority, wave-5) EXTENDED with: (a) the template version isUsableForSend (version-binding); (b) the M2 rules (disclaimer/suppression/content-hash evaluators — already exist); (c) the **SoD: sender != the approver of the template version** (reuse/extend the M2 sod.evaluator pattern). Verdict → send-eligible|blocked, AUDITED in-txn, fail-closed. **NO actual email send (later bundle) — produces the send-eligible outreach record.**
  - *Alt considered:* a new bespoke gate for outreach — REJECTED: the M2 ComplianceGateService is the established non-bypassable send-eligibility authority; extend it (add a template-version-usable + outreach-SoD check) rather than fork a second gate (a second gate = a bypass risk).
- **Controllers:** OutreachTemplateController (POST /outreach-templates, /:id/versions, /request-approval, /approve, /reject, GET list/detail), OutreachController (POST /outreach compose→gate, GET /:id). @Roles (advisor/analyst draft; compliance approve; advisor compose) + module-load @Roles assertion; route-ordering (static sub-paths before :id — wave-9). SoD enforced server-side.
- **Failure-domain:** compose runs the gate (reads template version + M2 rules + the approver) → send-eligibility in one txn + audit. Reads M2 disclaimer_templates + rules + M5 shortlist (read-only). Writes outreach_templates/versions/outreach records (new). RBAC add: /outreach-templates + /outreach routes.
- **Web:** templates-library page + outreach-composer page (SSR-hydrated per designs), + (at least) the grant/reject approval action (compliance-queue page may be a later bundle — the seed says the approval API + SoD land here; a minimal compliance-queue view for pending versions is in-scope). NAV.
- **BOUNDARIES:** NO Anthropic/LLM/AI-drafting (later gated bundle); NO transactional-email SDK / actual send (later bundle — the gate produces send-eligible only). M6/later boundary.

### Action 2 — Data model (migration 0010, additive)
- **outreach_templates**: id uuid pk, name, mandate_scope (nullable — mandate_id FK or a scope descriptor), owner_id uuid FK users, created_at/updated_at.
- **outreach_template_versions**: id uuid pk, template_id uuid FK→outreach_templates (cascade), version_number integer (monotonic per template — a partial-unique or app-monotonic), subject text, body text, disclaimer_template_id uuid FK→disclaimer_templates (M2 — the required compliance block), content_hash text (SHA-256 over rendered content), approval_status pgEnum('pending','approved','rejected') default 'pending', approved_content_hash text nullable (the hash the approval bound to), approved_by uuid FK users nullable (for SoD), created_at.
- **outreach**: id uuid pk, mandate_id FK, buyer_universe_candidate_id/match_candidate_id FK (the shortlist target), template_version_id uuid FK→outreach_template_versions, gate_verdict jsonb, status pgEnum('compose','send_eligible','blocked') default 'compose', created_by uuid FK users, created_at.
- Additive; NO alter of M2/M4/M5. Migration 0010 drizzle-kit generate → journal `when` > 0009's 1783555200000 (BUILD rule 4) + .down.sql. Schema `apps/api/src/db/schema/outreach.ts`; export from index.ts.

### Action 3 — API contracts
- **POST /outreach-templates** (create) / **POST /:id/versions** (draftNewVersion + content_hash) / **POST /:id/versions/:vid/request-approval** (required-block-check → 400 if missing) — advisor/analyst; audited.
- **POST /:id/versions/:vid/approve** (grant; **compliance role only** — SoD; sets approved_content_hash + approved_by) / **/reject** — compliance; audited.
- **POST /outreach** (compose {mandateId, candidateId, templateVersionId} → runs the pre-send gate → send_eligible|blocked verdict; **SoD: composer != approved_by → 403**; version-binding: isUsableForSend else blocked; M2 rules; fail-closed) — advisor; audited.
- **GET /outreach-templates** (+ versions), **GET /outreach-templates/:id**, **GET /outreach/:id**.
- Errors → Nest exceptions (400/401/403/404/409); DrizzleError.cause.code unwrap (wave-6); read-passthrough (rule 5).

### Action 4 — Dependencies
NONE new. Reuses drizzle/NestJS/Zod/Next + the M2 ComplianceGateService/evaluators/AuditService/disclaimer_templates. **NO Anthropic SDK, NO transactional-email SDK, NO new secret** (LLM-drafting + email-send are deferred bundles). No external-SDK checklist.

## Plan (file-level steps)
**B-0 Schema** (backend-developer): outreach.ts (outreach_templates + outreach_template_versions + outreach) + index export + migration 0010 (journal when > 0009 + .down.sql; version_number monotonic + content_hash).
**B-1 Contracts** (backend-developer/typescript-pro): shared/outreach.ts (template/version/outreach schemas + create/draft/approval/compose inputs + gate-verdict; read passthrough + z.string(); INPUT strict) + rbac (/outreach-templates advisor/analyst-draft+compliance-approve; /outreach advisor-compose; + NAV; nav⊆RBAC) + audit (template-create/version-draft/approval-request/approval-grant/approval-reject/outreach-compose actions).
**B-2 Backend** (backend-developer): outreach module {module,controller(s),template.service,outreach.service,approval,repository} — VALUE imports; content_hash (reuse M2 keyless SHA-256); **isUsableForSend version-binding**; **the pre-send gate = REUSE ComplianceGateService.evaluate extended with version-binding + outreach-SoD (composer != approved_by) + M2 rules**, one-txn + audit-last-in-txn + actor-id + fail-closed; grant/reject compliance-role SoD; DrizzleError-unwrap; tx-scoped reads (BUILD rule 7); di-boot spec. Register in app.module.ts. Reuse ComplianceGateModule + AuditModule + AuthModule (all export their services).
**B-3 Frontend** (nextjs-developer): templates-library page (list/version-history/draft-editor/request-approval, per design) + outreach-composer page (compose from approved template → gate verdict, per design) + (min) a compliance-queue pending-approval grant/reject view + _components; /outreach-data + /outreach-templates-data non-page-colliding proxies (wave-8/9); apiFetch rid; read passthrough; SSR-hydrate. NO AI-drafting UI, NO send button (gate produces send-eligible only — frame accordingly).
**B-4 Wiring** + **B-5 Verify** + **B-6 Review** (head-builder polices the compliance invariants: version-binding, non-bypassable-gate-reuses-M2, SoD + the boundaries).

### Action 6 — Specialist routing (validated against AGENTS.md)
backend-developer (B-0/B-1/B-2), typescript-pro (B-1 if split), nextjs-developer (B-3). All present.

### Action 7 — Parallelization map
B-0 → B-1 → B-2 (template.service + gate + SoD) → B-3 (pages). Serial (B-3 consumes B-2 endpoints). The content-hash + isUsableForSend + gate-extension are independently unit-testable.

### Action 8 — Self-consistency sweep: CLEAN
Every AC → ≥1 step: template store + versioning + version-binding + required-block + audit + actor-id (102a2f00 → B-0/B-1/B-2 + B-3 page); composer + non-bypassable pre-send gate (reuse M2) + no-send (e90a4a99 → B-2 gate + B-3 composer); SoD + version-binding-at-approval + grant/reject (2601ba33 → B-2 approval/SoD + B-3 compliance-queue). RBAC advisor/analyst/compliance (B-1). BOTH boundaries (NO LLM/AI-drafting + NO email-SDK/send). design_gap FALSE. No new dep/SDK/secret. Wave-4..10 lessons embedded (M2 content-hash + compliance-gate + SoD reuse; actor-id; DrizzleError-unwrap; journal-when; tx-scoped-reads rule 7; read-passthrough rule 5; SSR-hydrate; page-route-collision-avoidance; one-txn + audit-last-in-txn).

```yaml
deps_new: []
schema_change: true   # migration 0010 (3 tables, additive)
new_secret: false
new_sdk: false   # NO Anthropic/LLM, NO email-SDK this bundle (deferred)
specialists: [backend-developer, typescript-pro, nextjs-developer]
reuse: [M2 disclaimer_templates + ComplianceGateService + evaluators (sod/disclaimer/content-hash/suppression) + AuditService + content-hash-binding, M1 RolesGuard/getUserWithRole, M5 shortlist, wave-3 AppShell, wave-5 apiFetch]
compliance_invariants: [version-binding (isUsableForSend), non-bypassable-pre-send-gate (reuse M2 ComplianceGateService), sender!=approver-SoD]
hard_boundaries: "NO LLM/AI-drafting (later gated bundle) + NO email-SDK/send-path (later bundle) — this slice = template store + composer + GATE + SoD, produces send-eligible not send"
security_scope_tightened: true   # compliance-critical (version-binding + approval + SoD + audit + non-bypassable gate) → P-4 tightened gate
self_consistency: clean
```
