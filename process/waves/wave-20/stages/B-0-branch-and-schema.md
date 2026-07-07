# Wave 20 — B-0 Branch & schema (deferred to backend-developer)
Branch wave-20-outreach-activity. 4 tasks claimed. REAL additive migration this wave (new outreach_activity table + 2 distinct enums + FORCE RLS FOR-ALL USING-only policy + dealflow_app GRANT) + DETERMINISTIC-TEST-SPEC-FIRST migration test (empty + POPULATED-DB, GAP-4 + SF6 verifyChain-post) — authored by backend-developer at B-0/B-2. schema_skipped: false.
```yaml
branch: wave-20-outreach-activity
schema_skipped: false
migration: additive (outreach_activity + 2 enums)
```

---

## B-0 COMPLETE — backend-developer delivery

**Status: DELIVERED**
**Migration:** `0018_outreach_activity` (idx 18, hand-authored SQL)

### Files created/modified
- `apps/api/src/db/schema/outreach-activity.ts` — leaf schema (separate from outreach.ts to avoid pipeline.ts circular dep)
- `apps/api/src/db/migrations/0018_outreach_activity.sql` — hand-authored migration
- `apps/api/src/db/migrations/meta/_journal.json` — entry idx 18 added
- `apps/api/src/db/migrations/meta/0018_snapshot.json` — Drizzle snapshot (renamed from generated 0019)
- `apps/api/src/db/schema/index.ts` — `export * from './outreach-activity'` added
- `apps/api/test/outreach-activity-migration.e2e-spec.ts` — fail-first migration e2e tests (OAM-1 through OAM-7)

### RLS policy
- FOR ALL USING-only: `USING (workspace_id = NULLIF(current_setting('app.workspace_id', true),'')::uuid)`
- NO FOR SELECT, NO literal WITH CHECK — matches 28-table pattern from 0017
- FORCE ROW LEVEL SECURITY enabled
- GRANT to dealflow_app

### SF1 belt+suspenders
- Service THROWS ForbiddenException when getWorkspaceId()=null (primary guard)
- Repository passes SQL expression for workspace_id; NULLIF(...)::uuid returns NULL when GUC unset → NOT NULL rejects → fail-closed (secondary guard)
- ZERO DEFAULT_WORKSPACE_ID fallback anywhere

### Typecheck: CLEAN
### Unit tests: N/A at B-0 (migration tests are e2e; B-2 spec created fail-first)
