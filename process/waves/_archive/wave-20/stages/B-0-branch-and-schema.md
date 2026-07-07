# Wave 20 — B-0 Branch & schema
Branch wave-20-outreach-activity. 4 tasks claimed. REAL additive migration 0018_outreach_activity (new outreach_activity table + 2 distinct enums outreach_activity_channel/_status + FORCE RLS FOR-ALL USING-only policy matched to the 28 + dealflow_app GRANT + workspace_id column DEFAULT NULLIF(current_setting app.workspace_id)). Migration test FIRST (empty + POPULATED-DB GAP-4 + SF6 verifyChain-post). Commit 97f00d1.
```yaml
branch: wave-20-outreach-activity
schema_skipped: false
migration: 0018_outreach_activity (additive: table + 2 enums; rollback = DROP table + DROP 2 types)
rls: FORCE + FOR-ALL USING-only policy (matched to 28 tenant tables) + dealflow_app GRANT
deviations: []
```
