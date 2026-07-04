# Wave 9 — B-2 Backend (+ B-0 schema)
backend-developer.
- **B-0 schema:** buyer-universe.ts (buyer_universe [FK mandates, status draft|filtered|submitted] + buyer_universe_candidates [FK companies, membership_status candidate|included|excluded, provenance] + composite UNIQUE(buyer_universe_id, company_id)) + migration 0008_noisy_hitman (journal idx 8, when=1783468800000 > 0007's 1783382400000 — BUILD rule 4 ✓; composite UNIQUE emitted by drizzle-kit + .down.sql per 0000-0006 convention).
- **B-2 BuyerUniverseService:** assembleAsActor (read mandate+criteria, SELECT M3 companies, UPSERT universe + INSERT candidates onConflictDoNothing composite-unique — idempotent re-assemble), filterAsActor (apply mandateBuyerCriteria → per-candidate include/exclude + provenance, status→filtered), enrichAsActor (attach M3 contacts to included), getGaps (included w/ no contacts), submitAsActor (status→submitted ready-to-rank; guard empty→400). ALL: one-txn + AUDIT last-in-txn (buyer-universe-* actions, rollback on fail) + actor=app users.id via getUserWithRole. **M4/M5 BOUNDARY enforced: NO score/rank/fit/rationale/LLM column or call.** DrizzleError.cause.code unwrap. Controller 8 endpoints (route-ordering sub-paths before :id; fail-closed boot @Roles assertion). VALUE imports + di-boot spec.
- RBAC matrix: analyst 200/201, advisor/admin 200/201, anon 401, unauthorized 403.
## Verify: typecheck clean; biome 0; 461 api tests (buyer-universe.spec 130 + di-boot) + shared. Idempotency + boundary tests included.
```yaml
skipped: false
specialists_spawned: [backend-developer]
one_txn_audit_actor_id: true
idempotent_reassemble: true
m4_m5_boundary_no_score_rank: true
migration_journal_when: 1783468800000
