# Wave 9 — P-0 Frame

## Discover
- wave_db_id: 5188f6bf-7bfa-43ea-9c56-cffce8875758 (wave_number 9)
- Prior-work: reuses M3 (canonical companies+contacts — candidate source), M4 wave-8 (mandate_buyer_criteria — filter dims + mandate-detail D6 placeholder anchors — page mount), M1 (RolesGuard), M2 (AuditService last-in-txn), wave-5 (getUserWithRole actor-id). No prior wave built the buyer universe.
- Roadmap milestone: M4 "Mandates & buyer universe" (c67b1610…, in_progress, product-feature, T2). wave.milestone_id backfilled. This bundle COMPLETES M4's success metric (half 2: assemble+enrich a buyer universe ready to rank).
- Spec-contract short-circuit: **no-prior-spec** (prose seeds) → full P-1..P-3.
- Product decisions: no Tier-3 (reuses M3+M4; audit/RBAC established; NO new SDK — enrich is from existing M3 contacts, not a new vendor [that'd be M9]).
- Design: buyer-universe.html EXISTS → design_gap likely FALSE (D skips; confirm at P-1).

## Reframe
- **Original framing:** buyer-universe builder (M4 final) — buyer_universe + buyer_universe_candidates schema (additive, FK mandates + M3 companies) + BuyerUniverseService (assemble from M3 companies + filter by mandate_buyer_criteria) + /buyer-universe page + enrich contacts (M3) + flag gaps + submit-to-matching (ready-to-rank handoff to M5). RBAC analyst-primary; audited; actor-id. NO scoring/ranking/LLM (M5).
- **problem-framer:** PROCEED — buyer_universe is the right root problem (the missing wave-8-mandate→M5-matching handoff, fixed at the correct schema+service+API+UI layer, grounded reuse of M3 companies/contacts + M4 criteria); M4/M5 boundary CLEAN (assemble/filter/enrich/flag/submit, no scoring/ranking/LLM — ranking correctly deferred to M5).
- **ceo-reviewer:** PROCEED (HOLD-SCOPE) — the ONLY remaining M4 work + the exact slice that closes M4's metric ("assemble AND enrich ... ready to rank"); not thin (enrich/flag is a named metric verb + M5's readiness input); not grandiose (ranking→M5 flagship); on the critical path (M5 can't start without the ready-to-rank container).
- **mvp-thinner:** OK — every AC traces to a verbatim verb of M4's metric; the 2 candidate peel-offs (filter-later, flag-gaps-later) both FAIL (filter-later destroys per-candidate include/exclude audit provenance; flag-gaps isn't separable from the enrich view + submit txn). No coherent AC to shift to a sibling.
- **Mediation:** none needed.
- **Sibling task IDs created:** none this stage (list/enrich pre-split at N-2).
- **Disposition:** PROCEED (all 3 aligned).
- **Final framing:** ship the buyer-universe builder (schema + assemble + filter + page + enrich + flag + submit-to-matching), completing M4. Police the M4/M5 boundary at P-2/P-3 (NO scoring/ranking/LLM). Reuse M3 companies/contacts + M4 criteria; no new store, no new SDK.
