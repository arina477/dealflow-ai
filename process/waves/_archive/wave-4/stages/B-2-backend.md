# Wave 4 — B-2 Backend (DB immutability + HMAC service + verifier + endpoint)
## Part 1 — DB layer (postgres-pro, commit 3602994)
- apps/api/src/db/schema/audit-log.ts (auditLogEntries: sequence_number IDENTITY PK, actor/role/action/resource, content_hash+payload_hash distinct, prev_hash/entry_hash, chain_version, created_at; FK actor_user_id→users ON DELETE SET NULL) + barrel.
- Migration 0002_steep_boom_boom.sql (+down): CREATE TABLE + REVOKE UPDATE/DELETE/TRUNCATE + GRANT INSERT/SELECT to CURRENT_USER + BEFORE UPDATE/DELETE trigger (audit_log_block_mutation RAISE, blocks EVERY role incl. owner). Additive; down drops only new objects.
- **Immutability PROVEN** (rollback'd txn on PG 18.4): UPDATE→rejected, DELETE→rejected, row intact; IDENTITY rejects explicit-value insert.
- NOTE: migration applies at C-2 against the APP postgres (dealflow-postgres, has 0001); postgres-pro's local test hit the BRAIN DB (different users table) — SQL proven valid on same PG 18.4.
## Part 2 — service layer (security-engineer, commit 54ff1b8)
- apps/api/src/modules/audit/{keyring,hash,repository,service,verifier,module}.ts + 5 specs; compliance/audit-log.controller.ts (GET /compliance/audit-log/verify) + rbac spec; app.module + compliance.module wiring.
- **Keyring:** env AUDIT_LOG_HMAC_KEY fail-fast (module-init throw, no unsigned entries); chain_version→key map (rotation-ready); key never logged/DB'd (leak test).
- **Hash:** HMAC-SHA256 canonical VERSIONED serialization; chain_version pins BOTH key + serialization-order (golden-vector test 228e6ee1…, fails on any v1 format change — P-4 item-1).
- **Append(input, tx):** REQUIRED tx (write-atomic, composes into caller txn); pg_advisory_xact_lock FIRST (concurrent-append serialized, covers genesis race); genesis anchor GENESIS_PREV_HASH; **predict-then-force sequence** (nextSeq=tail+1 under lock, .overridingSystemValue() so stored seq == hashed seq); created_at app-side for deterministic recompute.
- **Verifier:** walk by sequence; recompute entry_hash (key per chain_version) + prev_hash link + sequence contiguity → detects content-tamper/link-break/gap at firstBreakAt+reason; empty→ok:true vacuous. Tail-truncation NOT claimed (accepted boundary, documented).
- **Endpoint:** @Roles(...rolesForRoute('/compliance/audit-log/verify'))→['compliance','admin'] + module-load non-empty assertion; per-role: compliance/admin→200, advisor/analyst→403, anon→401, stale-claim→403 (DB-authoritative).
- Service+verifier built+tested STANDALONE (no real call-site; M6+).
## Verify
typecheck clean; biome 0 err (2 pre-existing infos); api tests 88 pass/1 skip.
```yaml
skipped: false
specialists_spawned: [postgres-pro, security-engineer]
commits: [3602994, 54ff1b8]
immutability_proven: true
migration_applies_at: C-2 (app postgres)
deviations: ["keyring via useFactory (avoid DI-resolve of defaulted param)", "shared dist rebuild for api typecheck", "vitest dummy AUDIT_LOG_HMAC_KEY", "migration live-apply deferred to C-2 (brain-DB test conflict)"]
simplify_applied: true
```
