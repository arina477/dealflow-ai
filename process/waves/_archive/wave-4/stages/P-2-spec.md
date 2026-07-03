# Wave 4 — P-2 Spec (pointer)
**Source of truth:** spec contract in `tasks.description` of seed **ec1f279d-ea8a-44db-977b-cb6891972c1f** (YAML head + prose). DB wins.
**wave_type:** multi-spec (4 blocks). **design_gap_flag:** false. **claimed_task_ids:** [ec1f279d (audit table), a8b2b5a2 (HMAC service), e6a4cbfe (verifier+endpoint), 031d79fc (compliance-settings screen)].

## Acceptance criteria (copy)
### Block 1 — audit_log_entries table (ec1f279d)
Additive migration+down: audit_log_entries (sequence_number IDENTITY PK, actor/role/action/resource, content_hash+payload_hash distinct, prev_hash+entry_hash chain, chain_version, created_at); INSERT+SELECT-only grant (no UPDATE/DELETE); BEFORE UPDATE/DELETE trigger RAISEs for EVERY role (DB-layer immutability); additive-only.
### Block 2 — HMAC hash-chain append service (a8b2b5a2)
entry_hash=HMAC-SHA256(AUDIT_LOG_HMAC_KEY, content||prev_hash||seq||...); chains to prior; genesis anchor; key from env NEVER DB/logs; chain_version for rotation; write ATOMIC with audited action (no silent drop); concurrent-append single-chain (serialize/row-lock tail); fail-fast if key missing. **Threat-model boundary documented** (HMAC detects app+read-only-DB tampering; DB+key attacker can re-chain — accepted boundary).
### Block 3 — verifier + endpoint (e6a4cbfe)
Walk chain, recompute each entry_hash (key by chain_version), detect content-tamper (mismatch) + deletions/gaps (non-contiguous seq / broken prev_hash link) at the break's sequence_number; GET /compliance/audit-log/verify (RBAC compliance/admin, 403/401) → {ok,entriesChecked,firstBreakAt?,reason?}; proven to detect tampering (tests mutate/delete → ok:false).
### Block 4 — compliance-settings integrity view (031d79fc)
compliance-settings screen (AppShell, RBAC compliance) per design/compliance-settings.html: chain status + count + last-verified + verify-now; broken chain = persistent/prominent compliance signal (not dismissible toast); RBAC-consistent (roleRoutes).

## Security-scope
Audit-log integrity/immutability = compliance-critical → P-4 security-scope tightened gate + T-8 Security. 4 tamper-evidence sharpening notes embedded (threat-model boundary, key-in-env, genesis+gap, write-atomicity).
