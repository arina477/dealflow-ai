# Wave 39 — P-0 Frame

## Discover

- **wave_db_id:** 7d6b6c7a-eea8-4b15-8ed6-1e8fd50afebb (wave_number 39; FS-dir ↔ DB-row trace)
- **Prior-work citation:** wave-37 shipped self-serve firm setup + grant-admin (promote); admin read-oversight wave-36; deploy-reliability fix wave-38. This wave delivers the *transfer + self-demote* half of the founder's wave-37 admin-role ask. Reuses shipped `assignRoleAsActor` (user-management.service.ts), immutable hash-chained audit log, `runLastAdminGuard` (advisory-lock race-safe), RLS/tenant scoping, and the read-only admin activity view (done task 8bb0a22f). Reduce P-4 review to the delta (new transfer/self-demote semantics + confirm modal + audit surfacing).
- **Roadmap milestone:** M7 — Admin & settings (08d3053a), in_progress, Class=product-feature, Tier=T3. Wave row milestone backfilled.
- **Spec-contract short-circuit verdict:** `no-prior-spec` (seed description is prose ## What/## Why, no fenced YAML head) → full P-1..P-3.
- **Product-decision resolutions:** none new. Admin role management is a founder-requested M7 feature already in scope. Security-scope-tightened + SoD/RBAC gate applies at P-4 (wave mutates user roles / auth).

## Reframe

**Original framing:** bundle = seed 69cd8ce4 (admin transfer + self-demote, race-safe last-admin guard) + siblings 3ebd6610 (full member-CRUD UI) + 9e37eeef (confirm-modal + audit-view surfacing).

**problem-framer — PROCEED.** Symptom-vs-cause: "admin can't transfer/self-demote" is a genuine capability gap, not a symptom; RBAC model intact, wave adds UI + one new semantic on a correct backend (right layer). No antipatterns matched. Ground-truth verified `runLastAdminGuard` (line 476, `pg_advisory_xact_lock`, race-safe) already fires on demote/deactivate — correctly the load-bearing invariant and correctly reused. Two notes to P-2: (1) "transfer" is promote-B-then-demote-A — P-2 decides atomic single-tx vs two sequential audited mutations (atomic preferred so the guard sees correct post-state); (2) cross-workspace target resolves NotFound via RLS — test as edge, not build.

**ceo-reviewer — PROCEED (HOLD-SCOPE).** Completes a direct outstanding founder ask (product-decisions entry 573). Correctly EXCLUDES DKIM/SPF/DMARC domain-verification — it's founder-credential-gated (rule 6), an external-hold item, not a live alternative. Ambition 8-9/10. Race-safe last-admin guard = load-bearing correctness (orphaning a workspace is data-loss-class). Confirm-modal + audit-surfacing = compliance table-stakes, not gold-plating. Rigor flags to P-2/P-4: advisory-lock guard, SoD edges black-box proven, every mutation audited last-in-txn, RLS preserved.

**mvp-thinner — THIN.** Keep SEED in full + 9e37eeef PART-1 (confirm-modal) as mvp-critical safety spine (splitting the confirm would leave a fat-finger-able privilege drop = OVER-CUT boundary, avoided). Split out: 9e37eeef PART-2 (activity-view surfacing) + 3ebd6610 (full member-CRUD grid) as beyond-spine future siblings. Floor not breached.

**Mediation (ceo HOLD-SCOPE vs mvp THIN on the member-CRUD grid):** Per P-0 precedence, mvp-thinner wins the tie — not every mvp-critical M7 scope item is `done` (transfer/demote ships this wave), so thinning governs over holding. ceo-reviewer's valid concern ("no members list = no transfer target") is satisfied by a **minimal member-picker inside the seed** (select a transfer target); the *full* CRUD grid (change ANY role, bulk deactivate/reactivate) is the beyond-spine part → deferred. I keep 9e37eeef **whole** (both confirm-modal AND audit-surfacing): ceo-reviewer's compliance-table-stakes argument + it being a thin read-view over already-written audit events outweighs mvp-thinner's PART-2 split, at negligible cost.

**Bundle actions taken:**
- **Claimed this wave:** `69cd8ce4` (seed, incl. minimal transfer-target member-picker) + `9e37eeef` (confirm-modal + audit-view surfacing).
- **Deferred:** `3ebd6610` (full member-CRUD grid) — deparented to an unparented `todo` seed, claimable by a future M7 wave.
- **Roadmap hygiene:** cancelled dormant wave-37 mvp-thin duplicates `0ef436c3` (transfer/demote — superseded by claimed seed) + `81e06ff3` (member-CRUD — superseded by deferred 3ebd6610). M7 now 14 done / 4 open / 6 cancelled. (`dd5ff64b` onboarding-polish left as a distinct future item.)

**Disposition:** PROCEED (bundle narrowed to mvp-critical spine).

**Final framing for P-block:** Ship the two privilege-sensitive admin-role mutations (transfer, self-demote) as an authz-gated, audited, race-safe-guarded vertical slice with a minimal transfer-target member-picker, a confirmation gate on destructive role changes, and surfacing of the new events in the admin activity view. claimed_task_ids = [69cd8ce4, 9e37eeef].
