# Wave 4 — T-8 Security (Pattern B, active — MANDATORY, compliance backbone)
## Action 1 — Auth smoke: login works (C-2: signin OK + /auth/me role 200); session cookie first-party (wave-2/3). Unchanged.
## Action 2 — CSRF/origin: SameSite=Lax; web same-origin proxy now covers /compliance/audit-log/verify (B-6 fix, first-party cookie). Unchanged posture.
## Action 3 — Session: unchanged; verify endpoint role DB-authoritative (wave-3 guard).
## Action 4 — AUDIT-LOG COMPLIANCE INVARIANTS (the wave's security surface) — LIVE-VERIFIED at C-2:
- **Immutability (DB-layer):** UPDATE + DELETE + TRUNCATE on audit_log_entries all REJECTED live (INSERT/SELECT-only grant + BEFORE UPDATE/DELETE trigger + BEFORE TRUNCATE trigger; blocks even app-role-as-owner). REVOKE ALL FROM PUBLIC.
- **Tamper-evidence:** HMAC-SHA256 keyed chain; LIVE tamper-detection — flipped content_hash → verify ok:false firstBreakAt:2 content-hash-mismatch; restored → ok:true. Chain VERIFIES LIVE (3-entry appended chain → ok:true — the created_at-fix proof).
- **Key handling:** AUDIT_LOG_HMAC_KEY env-only (Railway, 64-char), boot fail-fast (keyring throws if missing → api won't boot unsigned), NEVER logged/DB'd/committed (secret-grep clean; only vitest dummy). chain_version rotation-ready (pins key+serialization).
- **RBAC:** verify endpoint compliance/admin (200/200), advisor/analyst 403, anon 401 (live C-2); screen compliance-only; fail-closed; DB-authoritative role.
- **Threat-boundary honest:** HMAC detects keyless + read-only-DB tampering; DB-write+key attacker can re-chain (accepted, documented, signature/HSM upgrade path); tail-truncation not claimed detectable (boundary). No over-claim.
## Action 5 — Secret grep (wave-4 diff): CLEAN — no AUDIT_LOG_HMAC_KEY value or other credential committed (only env refs + vitest dummy).
## Triage: no critical. The /review B-6 CRITICALs (chain-verifies-live, verify-now-proxy) already fixed + LIVE-confirmed at C-2. No new blocking findings.
```yaml
test_pattern: active
skipped: false
applicable_probes: [auth_smoke, csrf, session, audit_immutability, tamper_evidence, key_handling, rbac, secret_grep]
compliance_invariants_live: {immutability: rejected(U/D/T), tamper_detect: ok_false_at_break, chain_verifies: ok_true_3entries, rbac: {compliance:200,advisor:403,anon:401}}
secret_grep_findings: []
findings: []
```
