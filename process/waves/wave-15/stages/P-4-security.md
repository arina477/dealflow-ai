# Wave 15 — P-4 Phase-2 iter-2 security-auditor review
VERDICT: SECURITY-CONCERNS (2 Medium spec-fixes + must-enforce-at-B; 0 crit/high; RBAC/SoD + invite-flow + audit-row-shape sound).
## Medium spec-fixes (applied):
- Inv-1 write-skew: `count(*) FOR UPDATE` does NOT lock a count → concurrent demote of DIFFERENT admins = write-skew → zero admins. FIX: pg_advisory_xact_lock(<constant admin-guard key>) as PRIMARY (serializes the admin set) + cover deactivate + demote + block self-deactivation/self-demote of last admin.
- Inv-6 auditActionEnum closed: add the 5 admin actions to the shared auditActionEnum (additive) or append fails at runtime; + audit invite-creation + enable/disable toggle.
## Must-enforce-at-B (named in spec/plan):
- Inv-2: GCM random-IV-per-encrypt (never reuse) + auth-tag stored+verified; credential REDACTED before any error/log (DrizzleError/Zod-error/stack leak risk); do NOT hash the credential into contentHash/payloadHash (brute-forceable).
- Inv-5: key-loss=credential-loss + no-rotation documented; a key-id prefix on ciphertext (enables future rotation).
- B-0: reconcile the M3 sourcing.ts "no column named secret/api_key/credential" assertion (encrypted_credentials contradicts it) — update the comment; the two paths (env-var provider_key for adapters vs encrypted_credentials for the admin form) coexist.
## Sound (no action): RolesGuard DB-authoritative (no escalation); invite RECORD inherited-secure (hashed token, single-consume, expiry); audit_log_entries .strict shape structurally can't hold plaintext.
