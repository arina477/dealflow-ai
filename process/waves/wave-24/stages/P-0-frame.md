# Wave 24 — P-0 Frame
## Discover
- wave_db_id d5379ac9 (wave_number 24, milestone M10 — Advanced compliance & recordkeeping, in_progress). Seed fd8f2860 (single-task M10 compliance-hardening). M9 now blocked (all insight verticals shipped; CRM founder-gated).
- Reframe-check: NO existing promoted principle covers populated-DB WORM-migration testing (OBS-W17-3 held-never-promoted; nearest T-4 rule is teardown-scoped + distinct) → this wave ESTABLISHES the standing AC (not process-theater re-doc).
## Reframe
### problem-framer — PROCEED
Cause-layer fix confirmed: migrations are tested only vs an EMPTY CI DB → populated-prod-only failures (WORM-trigger collisions, backfill-vs-constraint) escape until deploy (the wave-17 C-2 HOLD: migration 0014 audit backfill collided with the WORM trigger on 328 prod rows). The standing-AC fix tests the REAL populated shape pre-deploy. Deliverable = standing AC + a reusable populated-migration test template (from AMP-1..5), enforceable at a NAMED checkpoint (B-0 migration stage / P-4 AC / B-6 gate). FLAG: bind to a named checkpoint (not a free-floating note); keep the helper a COPY-ABLE template, NOT a migration-test framework/DSL (premature abstraction).
### ceo-reviewer — PROCEED (HOLD-SCOPE)
Audit-chain migration-safety hardening is a correctly-scoped 6-8/10 foundation for M10's recordkeeping artifacts (a populated-prod audit-migration failure is a compliance-integrity risk). It was the only legally-seedable M10 candidate this tick. **P-2 must wire the standing AC as a MECHANICAL gate (a CI/check), not a prose checklist, or it's theater.** MILESTONE-INTEGRITY FLAG: all 3 M10 candidates are debt/hardening — an M10 recordkeeping-decomposition ritual is due within 1-2 waves before M10 drifts into a debt-bucket.
### mvp-thinner — OK
_TBD metric → no thinness trace (hard-rule OK+flag). The single atomic AC (standing WORM/audit populated-DB migration-proof + thin AMP-1..5 helper) has no separable nice-to-have. The seed sits correctly between under-built (theater) and over-built (framework).
### Disposition: PROCEED
Deliverable (scope to P-1/P-2):
1. **The STANDING acceptance criterion** documented (in testing principles / a compliance-migration doc): any migration touching audit_log_entries or any WORM/append-only table MUST ship a populated-DB migration test (seed real rows → run the migration → assert it applies + verifyChain ok:true).
2. **A thin REUSABLE populated-DB migration test template/helper** generalized from audit-migration-populated-db.e2e (AMP-1..5) — copy-able, NOT a framework/DSL.
3. **A NAMED + ideally MECHANICAL enforcement point** — prefer a lightweight CI/check (detect a migration touching audit/WORM tables that lacks a corresponding populated-DB test → fail/flag) so it's not toothless prose; at minimum bind it as a mandatory B-0/P-4/B-6 gate obligation. This is the load-bearing "mechanical not prose" requirement.
## FLAGS (→ N-block / founder digest):
- M10 recordkeeping-decomposition ritual due within 1-2 waves (M10's 3 candidates are all debt/hardening — no purpose-authored recordkeeping vertical yet).
- M10 _TBD success-metric poll (founder, same class as M9's DUE poll — carried).
## design_gap_flag: false (process/testing-infra, no UI). D-skip.
claimed_task_ids: [fd8f2860-51d7-446d-b0b0-dfbf9e54f3dd]
