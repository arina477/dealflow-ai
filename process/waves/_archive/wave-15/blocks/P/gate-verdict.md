# Wave 15 — P-4 Gate Verdict (head-product, Phase 1)

**Wave topic:** M7 Admin & settings (FIRST M7 wave) — user-management + workspace/firm settings + data-source connection admin + AppShell nav polish
**Block:** P (Product)
**Gate:** P-4
**Verdict source:** head-product (fresh spawn)
**Mode:** automatic
**security_scope_tightened:** TRUE → Phase 2 runs ≥2 iterations

## VERDICT: APPROVED

All P-4 stage-exit checklist items tick. The four LOAD-BEARING compliance ACs are falsifiable, their mechanisms sound, boundaries honest, security-scope-tightened TRUE.

---

## Stage-exit checklist (P-4)

| Check | Result |
|---|---|
| All ACs touching audit-log / compliance-gate / RBAC are binary, observable, machine-readable | PASS |
| Cross-review responses (P-0 problem-framer / ceo-reviewer / mvp-thinner) logged, resolved, integrated | PASS |
| Gate defaults No-Go if any artifact lacks machine-readability or P-0 traceability | PASS (no trip — all trace) |

## LOAD-BEARING compliance ACs — falsifiable + sound

1. **RACE-SAFE last-admin guard — PASS.**
   - Falsifiable: AC mandates a **concurrency assertion** ("two concurrent deactivate-last-admin requests CANNOT both succeed... never zero active admins"; edge-case "concurrent double -> exactly one succeeds"). Binary, observable (409/400 on the blocked one).
   - Sound: transactional count-of-active-admins with `SELECT ... FOR UPDATE` on admin rows OR `pg_advisory_xact_lock` **inside** the mutation tx — explicitly NOT a service-level read-then-write TOCTOU. DB-CHECK/trigger alt rejected with rationale (can't express "≥1 active admin" as a table CHECK). Covers deactivate AND demote paths. Audit last-in-txn.

2. **CREDENTIAL NEVER IN AUDIT ROW / LOGS — PASS.**
   - Falsifiable: AC mandates a grep/assert test ("a mutation audits the action but the secret is absent from the audit row"; edge-case "credential absent from audit row + logs (assert)"). Read path never returns the credential (masked/omitted).
   - Sound: AES-256-GCM (node crypto), key = self-generated `CREDENTIALS_ENC_KEY` env var (rule 6, not committed); encrypt BEFORE store; audit records ACTION (connection-created/updated/enabled/disabled) + non-secret metadata (source name, actor) ONLY.
   - **Key distinction CONFIRMED correct:** we generate the ENCRYPTION key ourselves (rule 6 — mechanism, no account credential needed); the VENDOR key is what the admin pastes + we encrypt-at-rest, with NO live test (deferred #141/M9). P-1 constraint 5 + P-3 Action 4 state this explicitly.

3. **SoD + WORM-audit last-in-txn — PASS.** Every role/settings/credential mutation audited via M2 AuditService.append LAST-IN-TXN; actor = getUserWithRole app users.id. SoD: last-admin cannot self-deactivate/demote (folded into the guard); role changes admin-only (RBAC). Falsifiable: edge-case "Audit-throw -> mutation rolls back (last-in-txn)".

4. **Migration 0013 JOURNALED (wave-14 Ghost-Green lesson) — PASS.** P-3 Action 2 + B-0 explicitly require `drizzle-kit generate 0013 → journal when >0012 (register idx 13, when>0012, snapshot) + .down.sql + meta snapshot`. Carried into B-4/B-5/B-6 policing. Additive only (users.deactivated_at + workspace_settings + data_source_connections.encrypted_credentials); no destructive alter.

## Scope / ambition — PASS
- ceo-reviewer PROCEED (HOLD-SCOPE): right investment while M6 blocked — prepares the sending-identity surface M6's send plugs into; does NOT compete with unblocking M6. Traces to both live bets + M7 metric.
- mvp-thinner OK (floor-constrained): the only deferrable AC (d7f716b4 AppShell polish) peels residual to ~2,400-2,500 at/under the 2,500 multi-spec floor AND its RBAC-reverify half is seed-fused (#340) → refuse peel. 4-task bundle coherent (shared RBAC/SoD/audit spine; 3 thin CRUD + 1 re-parented polish).
- Compliance rigor (race-safe guard + SoD + WORM-audit + credential-security) = the differentiated 9/10 vs generic admin CRUD — the wedge's admin-layer expression.

## Boundaries honest — PASS
Additive (migration 0013); NO live-connection-test / domain-verify / invite-email / DKIM (#141/#331 deferred, NOT seeded); reuse M1 RBAC/invites + M2 audit + M3 store + M4 mandate_compliance_profile; CREDENTIALS_ENC_KEY self-generated, not committed. Consistent across P-0/P-1/P-2/P-3.

## Traceability + spec quality
- All 4 claimed_task_ids trace to M7's metric via P-0/P-1. No orphans (P-3 Action 8 self-consistency clean — every AC → step).
- No Implementation Leakage: ACs are observable (HTTP 400/401/403/409, audit-row asserts, concurrency asserts), not prescriptive mechanism.
- Orphaned-Edge-Case check clears: every spec's edge-cases block covers non-admin 403 / anon 401 / idempotency / audit-throw-rollback / concurrent-double.
- RBAC negative tests present (non-admin 403, anon 401); d7f716b4 adds the DB-authoritative role-reverify live test (closes wave-3 jenny gap).

```yaml
head_signoff:
  verdict: APPROVED
  stage: P-4
  phase: 1
  reviewers: { problem-framer: PROCEED, ceo-reviewer: PROCEED-HOLD-SCOPE, mvp-thinner: OK-floor-constrained }
  failed_checks: []
  load_bearing_acs_falsifiable: [race-safe-last-admin, credential-never-logged, SoD-WORM-audit-last-in-txn, migration-0013-journaled]
  mechanisms_sound: true
  boundaries_honest: true
  security_scope_tightened: true
  phase2_min_iterations: 2
  rationale: >
    Multi-spec M7 admin vertical (4 tasks). All four load-bearing compliance ACs are
    binary/observable/falsifiable (concurrency assertion for race-safe last-admin; grep/assert
    for credential-never-logged; rollback assertion for WORM-audit last-in-txn; journal-register
    for migration 0013). Mechanisms sound: transactional row-lock/advisory-lock (not TOCTOU);
    AES-256-GCM with self-generated CREDENTIALS_ENC_KEY (rule 6) distinct from the deferred
    vendor key; migration 0013 explicitly journaled (Ghost-Green guarded). Scope right while
    M6 blocked; boundaries honest and additive; full P-0 traceability, no orphans, no
    implementation leakage. security-scope-tightened TRUE → Phase 2 ≥2 iterations.
  next_action: PROCEED_TO_D_OR_B   # design_gap_flag false → B-block
```

---
# Wave 15 — P-4 Phase 2 (iter 1: karen+jenny; iter 2: security-auditor — security-scope-tightened ≥2 iterations)
- **iter 1 — karen APPROVE + jenny APPROVE** (all claims VERIFIED vs real code; no drift). Gemini UNAVAILABLE (429).
- **iter 2 — security-auditor: SECURITY-CONCERNS** (2 Medium spec-fixes + must-enforce-at-B; 0 crit/high; RBAC/SoD + invite-flow + audit-row-shape sound). The tightened 2nd iteration caught REAL issues iter-1 missed.
## Rework applied (spec + plan):
- Inv-1: last-admin guard → pg_advisory_xact_lock(<constant>) PRIMARY (count-FOR-UPDATE = write-skew → zero admins); covers deactivate+demote+self-deactivate; concurrency-tested.
- Inv-6: extend the CLOSED shared auditActionEnum with the 5 admin actions + toggle (else append fails at runtime); audit invite-CREATE + enable/disable.
- Inv-2: GCM random-IV-per-encrypt + tag-verify; credential REDACTED before any error/log; NO credential in contentHash/payloadHash.
- Inv-5: key-loss=credential-loss + no-rotation documented; key-id prefix reserves rotation.
- B-0: reconcile the M3 sourcing.ts "no secret column" assertion (encrypted_credentials coexists with env-var provider_key).
→ Re-entering Action 0 (head-product attempt 2) to confirm + close.

---

# Wave 15 — P-4 Gate Verdict — ATTEMPT 2 (head-product, fresh spawn) — CLOSES security-scope-tightened gate

**Verdict source:** head-product (fresh spawn, attempt 2)
**Mode:** automatic
**security_scope_tightened:** TRUE → Phase 2 required ≥2 iterations (SATISFIED: iter-1 karen+jenny clean; iter-2 security-auditor concerns resolved)

## VERDICT: APPROVED

All 5 security-auditor fixes verified present in the spec (task rows) + P-3 plan. Phase-1 load-bearing ACs re-confirmed falsifiable and strictly stronger than at attempt 1. The tightened ≥2-iteration Phase 2 is satisfied. **The security-scope-tightened gate CLOSES.**

## Security-auditor fix verification (spec + plan)

| Fix | Requirement | Landed | Evidence |
|---|---|---|---|
| **Inv-1** write-skew last-admin guard | `pg_advisory_xact_lock(<constant>)` as PRIMARY (NOT count-FOR-UPDATE); covers deactivate + demote + self-deactivate/self-demote (block last-admin self-deact outright); concurrency test | YES | Spec AC (82ec8724): advisory-lock at top of EVERY admin-set mutation tx, count-FOR-UPDATE explicitly rejected for write-skew, all-three-paths, "two concurrent deactivate-different-last-two → exactly one succeeds, never zero". P-3 Action 1 mirrors + names advisory-lock PRIMARY. |
| **Inv-6** auditActionEnum | Extend CLOSED shared auditActionEnum with 5 admin actions + toggle at B-1 (else append fails at runtime); audit invite-CREATE + enable/disable | YES | Spec AC + P-3 B-1: extend `packages/shared/src/audit.ts` with user-invite/role-change/deactivate/workspace-settings-update/data-source-conn-upsert + data-source-conn-toggle (additive, serialization-order-preserved). Invite-CREATE + toggle audited. |
| **Inv-2** GCM / credential-leak | random-IV-per-encrypt + tag-verify; credential REDACTED before any error/log; NO credential in contentHash/payloadHash | YES | Spec AC (41c017f7): random IV crypto.randomBytes(12) never reused + auth-tag stored AND verified; no hash into contentHash/payloadHash; REDACT before any error constructed/logged (DrizzleError/Zod/stack + Nest exception filter). P-3 Action 1 mirrors. |
| **Inv-5** key mgmt | key-loss=credential-loss + no-rotation documented + key-id prefix | YES | Spec AC + P-3 Action 1: key-id/version prefix on ciphertext reserves rotation; documented MVP limitation key-loss=permanent-credential-loss, single-key=no-rotation-without-re-encrypt. |
| **B-0** M3 reconciliation | reconcile sourcing.ts "no secret column" assertion | YES | P-3 B-0: RECONCILE the sourcing.ts no-secret-column comment — clarify two coexisting paths (env-var provider_key for adapters vs encrypted_credentials for admin form) so B-6 grep + future auditor aren't tripped. |

## Phase-1 re-confirm (light) — HOLDS

- **race-safe-guard** — falsifiable (concurrency assertion, 409, never-zero), mechanism now write-skew-safe (advisory-lock-on-constant). Stronger than attempt 1.
- **credential-never-logged** — falsifiable (grep/assert + forced-error-path assert), redaction + no-hash added. Stronger than attempt 1.
- **SoD/WORM-audit last-in-txn** — falsifiable (audit-throw → rollback edge-case), actor via getUserWithRole. Intact.
- **migration-0013-journaled** — journal-register (Ghost-Green guarded), additive-only. Intact.
- Boundaries honest (additive; NO live-test/domain-verify/invite-email/DKIM/LLM; reuse-only; CREDENTIALS_ENC_KEY self-generated not committed). Scope coherent (4-task bundle, shared RBAC/SoD/audit spine). No implementation leakage introduced — named mechanisms ARE the load-bearing compliance contract; ACs stay observable.

```yaml
head_signoff:
  verdict: APPROVED
  stage: P-4
  attempt: 2
  phase: 2-close
  reviewers: { karen: APPROVE, jenny: APPROVE, security-auditor: RESOLVED }
  phase2_iterations_done: 2   # iter-1 karen+jenny clean; iter-2 security-auditor concerns resolved
  security_scope_tightened_gate: CLOSED
  security_fixes_landed: [Inv-1-advisory-lock-write-skew, Inv-6-auditActionEnum-extend, Inv-2-GCM-random-IV-tag-verify-redact-no-hash, Inv-5-key-id-prefix-no-rotation-documented, B-0-sourcing-reconcile]
  failed_checks: []
  phase1_load_bearing_holds: true
  boundaries_honest: true
  rationale: >
    All 5 security-auditor fixes (2 Medium spec-fixes + must-enforce-at-B) verified present
    in the spec task rows + P-3 plan: Inv-1 advisory-lock-on-constant as PRIMARY (write-skew-safe,
    all-three-paths, concurrency-tested); Inv-6 CLOSED auditActionEnum extended at B-1 with 5 actions +
    toggle + invite-CREATE/toggle audited; Inv-2 GCM random-IV-per-encrypt + tag-verify + credential
    redacted-before-any-error + no-credential-in-hash; Inv-5 key-id prefix + documented key-loss/no-rotation;
    B-0 sourcing.ts no-secret-column reconciliation. Phase-1 load-bearing ACs re-confirmed falsifiable and
    strictly stronger. security-scope-tightened Phase 2 ≥2 iterations satisfied (iter-1 karen+jenny clean;
    iter-2 security-auditor resolved) → gate CLOSES.
  next_action: PROCEED_TO_B   # design_gap_flag false → B-block
```

---
# Wave 15 — P-4 → PASSED (security-scope-tightened, 2 Phase-2 iterations)
head-product attempt 2 APPROVED: all 5 security fixes landed (Inv-1 advisory-lock write-skew-safe + all-3-paths + concurrency test; Inv-6 auditActionEnum extended + invite/toggle audited; Inv-2 GCM random-IV+tag-verify+redact+no-hash; Inv-5 key-id-prefix + documented; B-0 M3 reconciliation). Gate CLOSES.
```yaml
verdict_complete: true
gate: PASSED
security_scope_tightened: true
phase2_iterations: 2
phase2: {iter1: {karen: APPROVE, jenny: APPROVE, gemini: UNAVAILABLE}, iter2: {security-auditor: SECURITY-CONCERNS→resolved}}
build_notes: [advisory-lock-primary-last-admin-guard (write-skew-safe, all-3-paths, concurrency-tested), extend-closed-auditActionEnum-5-admin-actions+toggle, GCM-random-IV+tag-verify+credential-redacted-before-any-error/log+no-credential-in-hash, key-id-prefix+key-loss-documented, migration-0013-JOURNALED (Ghost-Green), reconcile-M3-no-secret-column-assertion]
```
---
## P-block exit
```yaml
product_block_status: complete
review_verdict: APPROVED
design_gap_flag: false
next: B
```
