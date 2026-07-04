# Wave 8 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, agentId head-product@P-4-phase1)
**Reviewed against:** process/waves/wave-8/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate, 2+ = post-rework)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
The wave-8 mandate bundle is a well-formed, correctly-scoped P-block. It ships the load-bearing sell-side mandate spine (seller/target profile + buyer criteria + compliance profile) as one atomic create, plus the list and detail surfaces, and correctly defers the buyer-universe builder to a later M4 bundle. Every acceptance criterion on the load-bearing paths is binary and observable — HTTP status codes (201/400/401/403/404), persisted-row state (all three rows or none), SSR-hydrated props, and empty-state render — with no qualitative prose standing in for a testable constraint. The four compliance-first surfaces this wave is judged strictly on are all present and machine-checkable: (1) audit-last-in-transaction with rollback-on-audit-failure, (2) advisor/admin-only writes with explicit negative denials for analyst/compliance/anon (403/401), (3) actor = app users.id via getUserWithRole (not the raw SuperTokens id — the wave-5 FK lesson), and (4) one-transaction three-table atomicity with the "three separate service calls REJECTED" rationale documenting the correct failure domain. The compliance profile is captured/stored only — honestly framed as "captured for the later M6 gate, not enforced here" in both the spec AC and the P-3 UI note (problem-framer flag #2), and the false-safety risk is structurally bounded because there is no send or enforcement surface in this wave; the only live compliance surface is the audit trail, which is binary and reuses M2's established tamper-evident AuditService (the wave adds new audit actions only, no log-structure change, so no new cryptographic-integrity spec is required). The three-table split over JSONB is justified by concrete downstream readers — the buyer-universe filter and the M6 gate both need queryable columns and FK integrity, and the disclaimer_template_id FK produces a 400 on a bad reference rather than a silently-stored bad blob — so this is warranted normalization, not premature. Migration 0006 is additive and journal-when-guarded (BUILD rule 4 / wave-7 lesson), touches no M2 tables except by read-only FK reference. Scope passes the multi-spec floor and sits under every split threshold; all three P-0 reframers aligned (problem-framer PROCEED, ceo-reviewer PROCEED/HOLD-SCOPE, mvp-thinner OK) with no mediation needed. All six carried cross-wave lessons (actor-id, DrizzleError-unwrap, journal-when, read-schema-real-serialization, SSR-hydrate, apiFetch-rid) are embedded in the P-3 plan and the self-consistency sweep is clean. One item is carried to Phase-2 karen rather than blocking here: workspace/cross-firm scoping on GET /mandates is not separately specced, which is consistent with the established role-based M1–M3 model (no tenant_id anywhere across eight waves indicates a single invite-only workspace, so no isolation rule is broken) — but it is the correct cross-workspace-exposure red-team target for karen at Phase 2.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---
## Phase 2 — Karen + jenny + Gemini (security-scope-tightened: compliance-profile capture + user-scoped writes + audit → ≥2 Phase-2 iterations)
**Karen:** APPROVE — all load-bearing REUSE/schema claims VERIFIED (M2 disclaimer_templates FK target real; AuditService.append(input,tx) last-in-txn; RolesGuard/roleRoutes/getUserWithRole + AuthModule exports AuthRepository; sourcing.ts pattern + 0006 slot; wave-5/6/7 lessons real). Red-team RESOLVED: GET /mandates role-based-all-visible is CORRECT (single-firm role-gated model, no tenant isolation in M1-M3). 2 low notes (compliance_profile has ONE FK not phantom suppression_list FK; AGENTS.md thinness) — note #1 carried to spec.
**jenny iter-1:** APPROVE-conditional — load-bearing MATCHES (metric-honesty first-half-only + builder deferred; compliance captured-not-enforced consistent w/ M2 gate; M1/M2/M3 reuse; atomicity; RBAC/actor-id; karen single-FK). 6 design↔spec reconciliation precisions (D1-D6) to fold before B-1.
**Precision addendum (D1-D6, doc-level):** D1 alignment-claim softened (only sector aligns to M3 today); D2 disclaimer_template_id DERIVED from jurisdiction (no picker, no-match→400); D3 mandates += seller_geo + seller_size_band; D4 suppression_scope scalar (CSV-upload deferred); D5 3 compliance acknowledgments PERSISTED + audited + required(→400); D6 detail Buyer-Engine/Ranked/Pipeline as deferred placeholders (next-M4-bundle mount points). Folded into spec + plan.
**jenny iter-2:** APPROVE — all D1-D6 RESOLVED on the enforceable surface (D2/D3/D5 DDL/form-concrete for B-1); residual cosmetic only (stale edge-case wording).
**Gemini:** UNAVAILABLE (HTTP 429 — degraded, non-blocking).

## Phase 2 Verdict: PASS (Karen APPROVE + jenny APPROVE iter-2 + Gemini UNAVAILABLE-degraded; 2 Phase-2 iterations on the compliance-adjacent wave).
**P-block gate: PASSED.** design_gap_flag=false → next block B.

### B-block notes carried from P-4:
1. **Schema (B-1, migration 0006, journal `when` > 0005):** mandates (+ seller_geo, seller_size_band — D3) + mandate_buyer_criteria (core-4, queryable) + mandate_compliance_profile (jurisdiction, disclaimer_template_id [ONE FK → disclaimer_templates], suppression_scope scalar [D4], acknowledgments [D5]).
2. **MandateService (B-3):** one-txn 3-table create + audit-last-in-txn (rollback on fail) + actor=app users.id via getUserWithRole; DERIVE disclaimer_template_id from jurisdiction (D2, no-match→400); require all 3 acknowledgments (D5, else 400); VALUE imports (DI lesson); di-boot spec.
3. **API (B-3):** POST/PATCH advisor/admin, GET list+detail advisor/admin/analyst; errors → Nest exceptions not bare 500 (DrizzleError unwrap).
4. **Web (B-4):** mandates-list + mandate-new (jurisdiction dropdown, compliance CAPTURED-not-enforced copy, suppression text/tags, 3 required acknowledgment checkboxes) + mandate-detail (SSR-hydrated; Buyer-Engine/Ranked/Pipeline as deferred placeholders — D6); apiFetch rid; read-schema z.string() not .datetime().
5. RBAC /mandates + NAV_MANDATES (nav⊆RBAC). No new dep/SDK/secret.
