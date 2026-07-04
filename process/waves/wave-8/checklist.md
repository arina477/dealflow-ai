## Wave 8 stage completion

Seed: ba0edebf-8509-46b2-b69f-f5458ba400fd — Build mandate data spine + create/configure sell-side mandate flow
Bundled siblings:
  - c070ca23-0a93-4432-9390-d54d54159935 — Build mandates-list page with status filters and list endpoint
  - 50227055-22b6-4457-a694-dbecff7497c3 — Build mandate-detail page with profile, criteria, and compliance view
Claimed task IDs (B-0 claims this batch): ba0edebf, c070ca23, 50227055
Active milestone: c67b1610-9cc3-4cad-bcfa-1bee0573da72 — M4 — Mandates & buyer universe (in_progress, freshly promoted at wave-7 close; 0 done tasks — this is M4's first bundle)

Pending ritual outcomes affecting P-0:
  - M4 is `## Class product-feature` → P-0 runs mvp-thinner.
  - UI wave (mandates-list / mandate-detail / mandate-new pages; buyer-universe page deferred to later M4 bundle) → D-block runs.
  - Reuse-heavy: M1 RolesGuard (advisor RBAC on mandate create) + M2 AuditService.append (every mandate mutation audited last-in-txn) + M2 compliance tables (mandate_compliance_profile FK-references compliance_rules / disclaimer_templates / suppression_list). Mandate reads assemble buyers FROM the shipped M3 canonical companies+contacts universe.
  - Vertical slice = mandate data spine (schema + MandateService.create/configure + POST/GET/PATCH API + mandate-new form) [seed] + mandates-list page/endpoint [sibling] + mandate-detail page (profile/criteria/compliance view + configure PATCH, audited) [sibling]. Delivers create→list→review/edit end-to-end = first half of M4's success metric. buyer-universe builder + buyer-universe page (metric's second half) DEFERRED to a later M4 bundle; mandate-detail ships a labelled placeholder anchor as the stable mount point.
  - No new external SDK, no schema-breaking migration expected (additive Drizzle tables); no founder-blocked dependency. Buildable end-to-end.

Backlog under M4 (NOT this bundle — P-0 unassigned/queue triage candidates; each carries a stale wave_id, parent_task_id NULL):
  - bfadcec1 — Tighten test-fixture typing in wave-1 health tests
  - 6fe232e3 — Auth hardening: rate-limiting, input validation, logout
  - d7f716b4 — AppShell polish: placeholder pages for role-nav items
Unassigned queue at handoff: 1 (b1a0b2ac — /health spec wording; P-0 walk candidate).
Deferred (founder-blocked, re-homed to M9): 345dfbc6 — first real DataSourceAdapter (vendor selection + account-issued API key + spend gate; surfaced non-blocking).

PRODUCT:
- [x] P-0 Frame (discover + reframe) — PROCEED (problem-framer + ceo-reviewer + mvp-thinner all aligned); no-prior-spec; wave opened (8)
- [x] P-1 Decompose — PROCEED, multi-spec (3 tasks: spine+list+detail); ~3.4-4.3k LOC; design_gap_flag FALSE (designs exist → D skips)
- [x] P-2 Spec — multi-spec (3 blocks: spine+list+detail) in seed ba0edebf
- [x] P-3 Plan — new mandate module (3 tables migration 0006 + MandateService one-txn + API + 3 pages); reuse M1 RBAC + M2 audit/compliance; no new dep/SDK/secret
- [x] P-4 Gate — PASSED (head-product APPROVED; karen+jenny APPROVE after D1-D6 addendum; Gemini 429; security-scope 2 iterations)

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [x] B-0 Branch & schema — branch wave-8-mandate-spine; 3 tasks claimed; schema 0006 (backend-developer)
- [x] B-1 Contracts
- [x] B-2 Backend
- [x] B-3 Frontend — 3 mandate pages (list+new+detail SSR-hydrate); D1-D6; 304 web tests (c430bbd)
- [x] B-4 Wiring — repo typecheck+build PASS; 3 /mandates routes compile
- [x] B-5 Verify — lint 0-err, ~1091 tests pass, build pass; runtime→C-2
- [x] B-6 Review — head-builder APPROVED; /review 3 CRIT fixed (PATCH-crash+draft-lock+ambiguous-disclaimer+0007, 37998bb)

CI/CD:
- [x] C-1 PR, CI & merge — merged @ c278f7d (main), CI green 5/5
- [ ] C-2 Deploy & verify — **re-verify @ 7b33598: head-ci-cd verdict REJECTED → REWORK B-block.** Deploy+/health PASS @ 7b33598 (both services SUCCESS, rollback armed, no SKIPPED). All 3 prior UI defects FIXED+verified live (detail SSR text/html not Express JSON w/ deferred placeholders; jurisdiction dropdown populated w/ US; advisor GET /mandates/jurisdictions 200+US, analyst 403). BUT NEW CRITICAL client defect: MandateForm.tsx parses the 201 create response as {mandate:{id}} but API returns flat Mandate → create-via-UI 201 succeeds but shows false "Failed to create mandate." + no redirect (Iron Law: create fails from UI). Active-lock 409 + full RBAC matrix PASS. Canary skipped (0 DAU). Fix: MandateForm.tsx L435-436 read created.id (one file, no API change) → thin C-2 re-verify.

TEST:
- [ ] T-1 Static
- [ ] T-2 Unit
- [ ] T-3 Contract
- [ ] T-4 Integration
- [ ] T-5 E2E
- [ ] T-6 Layout
- [ ] T-7 Perf
- [ ] T-8 Security
- [ ] T-9 Journey

VERIFY:
- [ ] V-1 Independent reviews (Karen + jenny, parallel)
- [ ] V-2 Triage
- [ ] V-3 Fast-fix loop (or close)

LEARN:
- [ ] L-1 Docs
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff
