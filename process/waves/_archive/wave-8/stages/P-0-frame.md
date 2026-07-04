# Wave 8 — P-0 Frame

## Discover
- wave_db_id: e8ce3899-4c1a-4250-b4bc-5c3a5b51dc07 (wave_number 8)
- Prior-work: reuses M1 (RolesGuard RBAC advisor), M2 (AuditService.append last-in-txn + compliance_rules/disclaimer_templates/suppression_list tables the compliance-profile FK-references), M3 (canonical company fields the buyer criteria align to). No prior wave built mandates.
- Roadmap milestone: M4 "Mandates & buyer universe" (c67b1610…, in_progress, product-feature, T2). wave.milestone_id backfilled.
- Spec-contract short-circuit: **no-prior-spec** (prose seed) → full P-1..P-3.
- Product decisions: no Tier-3 (RBAC+audit are established patterns). Compliance-profile capture FK-references M2 tables + mutations audited → P-4 security-scope-tightened gate likely applies (compliance-adjacent).
- Designs: mandate-new.html + mandates-list.html + mandate-detail.html EXIST → design_gap likely FALSE (D-block skips; confirm at P-1).

## Reframe
- **Original framing:** mandate data spine + create/configure a sell-side mandate (3-table schema + MandateService one-txn + POST advisor-guarded+audited + shared Zod + mandate-new form) + siblings mandates-list + mandate-detail. The load-bearing vertical for all of M4/M5/M6.
- **problem-framer:** PROCEED — mandate spine correctly framed as the cause-layer load-bearing container (not symptom); all M1/M2/M3 reuse claims verified in the shipped code; create/list/detail coherent; buyer-universe rightly deferred. 3 design-layer flags forward (schema table-vs-JSONB, capture-without-enforce UI false-safety, buyer-criteria DSL) as P-2/D guardrails, not framing defects.
- **ceo-reviewer:** PROCEED (HOLD-SCOPE) — the correct load-bearing first M4 bundle; traces to both live bets (integrated-platform deal container + compliance-first per-mandate profile); coherent vertical slice (can't trim without breaking the 3-table create txn); must NOT absorb the buyer-universe builder (separate module → horizontal over-bundle risk).
- **mvp-thinner:** OK — every AC traces to the literal M4 success metric which names BOTH "buyer criteria" AND "a compliance profile" as constituents of the created mandate → neither table peelable without breaking the mvp-critical claim; no gold-plating (lifecycle draft/active, criteria 4 dims, compliance capture-only); list/detail already split at N-2.
- **Mediation:** none needed (no ceo-expansion vs mvp-thin conflict).
- **Sibling task IDs created:** none this stage (list/detail pre-split at N-2).
- **Disposition:** PROCEED (all 3 aligned).
- **Final framing:** ship the mandate data spine + create/configure sell-side mandate (3 tables one-txn, advisor-guarded, audited, compliance-profile captured for M6) + mandates-list + mandate-detail, on the existing designs. Carry problem-framer's 3 design-layer flags into P-2/P-3.
