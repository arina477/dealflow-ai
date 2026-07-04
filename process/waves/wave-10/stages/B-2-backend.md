# Wave 10 — B-2 Backend (+ B-0 schema)
backend-developer.
- **B-0 schema:** matching.ts (match_run [mandate_id FK + buyer_universe_id FK UNIQUE + ready_for_outreach] + match_candidates [buyer_universe_candidate_id FK, fit_score int CHECK 0-100, score_breakdown jsonb, disposition]) + migration 0009_omniscient_sabretooth (journal idx 9, when=1783555200000 > 0008's 1783468800000 — BUILD rule 4 ✓; buyer_universe_id UNIQUE + fit_score CHECK emitted + .down.sql).
- **The PURE deterministic scorer (matching.scorer.ts):** weighted sector/industry token-match (primary) + contact-completeness (secondary) + deterministic tie-break; unsupported dims (geo/size/deal) → 0 + breakdown provenance (wave-9 graceful). DISCRIMINATION PROVEN in tests: exact-sector+contacts ≥90 vs no-sector+no-contacts ≤10 (≥80pt gap). PURE (no LLM/randomness/Date.now) → unit-testable.
- **B-2 MatchingService:** createRunAsActor (submit-guard 400 if universe not submitted; one-txn + advisory-lock + upsert match_run [buyer_universe_id UNIQUE idempotent] + score included candidates + INSERT match_candidates + status→scored + audit-last-in-txn); patchDispositionAsActor (accept/reject/flag, cross-run-scoped 404, audited); handoffAsActor (ready_for_outreach; ≥1-ACCEPTED guard 400 — BUILD rule 6; audited); getRun/listByMandate/getShortlist. actor=app users.id via getUserWithRole. DrizzleError-unwrap. Controller 6 endpoints (route-ordering; fail-closed boot @Roles). VALUE imports + di-boot.
- RBAC matrix: advisor 201/mutate, analyst read 200 + mutate 403, anon 401.
- **BOUNDARY-CLEAN:** NO anthropic/llm/bullmq import (boundary test asserts); score_breakdown is structured jsonb NOT prose.
## Verify: typecheck clean; biome 0; 544 api (matching.spec 41 + scorer + di-boot) + 458 shared.
```yaml
skipped: false
specialists_spawned: [backend-developer]
pure_deterministic_scorer_discriminates: true
one_txn_audit_actor_id_idempotent: true
submit_guard_and_accepted_handoff_guard: true
boundary_clean_no_llm: true
migration_journal_when: 1783555200000
