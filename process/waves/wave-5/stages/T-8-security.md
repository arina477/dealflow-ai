# Wave 5 — T-8 Security (Pattern B, active — MANDATORY, compliance enforcement + SoD)
## Action 1 — Auth smoke: login works (C-2); session cookie first-party (wave-2/3). CRUD actor now DB-authoritative (app users.id + role, not stale claim — C-2 FK fix).
## Action 2 — CSRF/origin: SameSite=Lax; web same-origin proxy covers /compliance/{rules,suppression,disclaimers,audit-log/verify} (first-party cookie). SuperTokens CSRF on POST (C-2 confirmed).
## Action 3 — Session: unchanged; CRUD + gate roles DB-authoritative (RolesGuard + getUserWithRole).
## Action 4 — COMPLIANCE ENFORCEMENT INVARIANTS (the wave's security surface) — LIVE-VERIFIED at C-2:
- **Non-bypassable gate:** evaluate() no-skip, all evaluators every call, verdict→AuditService.append IN-TX before return, rollback on audit-fail (no verdict without audit). Gate is a callable contract (M6 send-path = tracked dependency, not claimed live-non-bypass).
- **SoD (the wedge invariant) — LIVE:** approver=compliance→allowed; **admin approver→BLOCKED** (sod/invalid-approver-role — no super-role shortcut); advisor/analyst→blocked; sender==approver→blocked; **null-approver (deleted account)→fail-closed BLOCKED** (approver-unknown); revoked→blocked; no-row→no-approval. Approver from stored row server-side.
- **Content-hash binding:** keyless SHA-256 canonicalized; edited content→re-block (LIVE content-hash-mismatch). Suppression hard-block (LIVE). Disclaimers enforced (partial-unique 1-active-per-jurisdiction, LIVE).
- **Every verdict + config-change AUDITED** to the tamper-evident wave-4 audit log in-tx (LIVE: config-change entriesChecked +2; gate-evaluate 0→5). Recordkeeping proof.
- **RBAC:** CRUD compliance/admin (config mgmt), advisor/analyst 403, anon 401 (LIVE). SoD approver ≠ CRUD authority (compliance-only vs compliance/admin — correct distinction).
- **DB-layer:** 4 mutable config tables + partial-unique integrity constraints; immutability reserved for audit_log (correct).
## Action 5 — Secret grep (wave-5 diff): CLEAN — no hardcoded credentials (AUDIT_LOG_HMAC_KEY env-only; content hash keyless).
## Triage: no critical. The /review B-6 3 CRITICALs (SoD null-approver, disclaimer race, ctx-validation) + the C-2 actor-id-FK all fixed + LIVE-confirmed. 2 low carried: actorRole-DB-authoritative (FIXED in C-2 actor-id fix); disclaimer-substring plaintext-v1 (HTML enforcement M6). No new blocking findings.
```yaml
test_pattern: active
skipped: false
applicable_probes: [auth_smoke, csrf, session, non_bypass_gate, sod, content_hash, suppression, disclaimer, audit_coverage, rbac, secret_grep]
compliance_invariants_live: {sod_admin_approver: BLOCKED, non_bypass: audit-in-tx-rollback, content_hash: post-edit-block, suppression: hard-block, config_audited: "entriesChecked +2", gate_audited: "0->5"}
secret_grep_findings: []
findings:
  - {severity: low, description: "disclaimer substring-match is plaintext-v1 (HTML rendered-text enforcement deferred to M6)"}
```
