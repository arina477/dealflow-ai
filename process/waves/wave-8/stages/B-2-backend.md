# Wave 8 — B-2 Backend (+ B-0 schema)
backend-developer. 
- **B-0 schema:** mandate.ts (mandates [+ seller_geo, seller_size_band], mandate_buyer_criteria, mandate_compliance_profile [disclaimer_template_id ONE FK, suppression_scope scalar, acknowledgments jsonb]) + migration 0006 (journal idx 6, when=1783296000000 > 0005's 1783209598319 — BUILD rule 4 SATISFIED + verified) + down + snapshot.
- **B-2 MandateService:** createAsActor — actor=app users.id via getUserWithRole (NOT raw ST); ONE txn: DERIVE disclaimer_template_id from jurisdiction (D2, no-match→400), INSERT 3 tables, require 3 acknowledgments (D5, else 400), AUDIT mandate-create last-in-txn (rollback on fail). configureAsActor (PATCH, audited). list/getById (404). VALUE imports (DI lesson) + di-boot spec. Repository unwraps err.cause.code (wave-6 lesson) → proper 400/409/404 not 500.
- **Controller:** POST/PATCH advisor/admin; GET list/detail advisor/admin/analyst; SessionGuard+RolesGuard + module-load @Roles assertion.
- RBAC matrix: create advisor/admin 201, analyst/compliance 403, anon 401; list analyst 200.
## Verify: typecheck clean; biome 0; 347 api tests (mandate.spec 40, di-boot 5) + 440 shared. Deviation: nested compliance needed own .strict() (Zod non-propagation) — test-caught.
```yaml
skipped: false
specialists_spawned: [backend-developer]
actor_id_translated: true
audited_in_txn: true
one_txn_atomic: true
disclaimer_derived: true
three_acks_required: true
drizzle_error_unwrapped: true
migration_journal_when: 1783296000000   # > 0005 (1783209598319) ✓
