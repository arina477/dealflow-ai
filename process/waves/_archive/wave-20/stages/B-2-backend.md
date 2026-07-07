# Wave 20 — B-2-backend
OutreachActivityService+repository (getDb CRUD) + controller (POST/GET/PATCH @Roles advisor+admin) + module. Commits 39c67e3 + cc48c34. ALL obligations: SF1 (no DEFAULT_WORKSPACE_ID — service throws-on-null, repo NULLIF(current_setting)→NULL→NOT-NULL-reject; OA-SF1-1 + OAE-3 empty-ALS reject), R1 (own-row-re-home UPDATE→42501 OAE-1 + INSERT-explicit-B→42501 OAE-2, not vacuous), R2/SF3 (relforcerowsecurity positive-control as dealflow_app OAM-7/OAE-14), R3/SF4 (all-4-FK tenancy OA-R3-1..4 + createdBy-server-derived OA-R3-5), R4/SF5 (per-verb audit last-in-txn create/update/status-transition/cancel OA-R4-1..4 + rollback OAE-13 + verifyChain OAE-9..12), FOR-ALL USING-only policy matched, SF7 credential-free. 19/19 unit. Deviations: repo passes NULLIF(current_setting) inline (Drizzle NOT NULL type) — equivalent to column DEFAULT, fail-closed.
```yaml
skipped: false
deviations: []
```
