# Wave 13 — P-4 Verdict

**Reviewer:** head-product (fresh spawn, agentId head-product-p4-w13-a1)
**Reviewed against:** process/waves/wave-13/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate, 2+ = post-rework)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
This wave closes the last clause of the M6 success metric — "compliance can export a verifiable recordkeeping package" — by adding a read / verify / export / UI surface over the already-shipped M2 HMAC hash-chain, with no new schema, credential, send, webhook, LLM, or SDK. It is a genuine compliance moat, not a log viewer: the export assembles a self-contained, deterministic package (in-scope entries with their stored hashes + a full-chain verify result + a manifest carrying the genesis root and tail hash) that a regulator can re-verify OFFLINE, independent of the app. All six load-bearing compliance invariants are specified as falsifiable, observable acceptance criteria and every one was cross-checked against the real code: (a) the read path is READ-ONLY and emits ZERO audit rows (asserted as an edge case) — the immutable log is not polluted by inspection; (b) verify returns the REAL AuditVerifier shape `{ok, entriesChecked, firstBreakAt?, reason?}` with the exact three break reasons from `audit.verifier.ts` (content-hash-mismatch / prev-hash-mismatch / sequence-gap) and empty → `{ok:true, entriesChecked:0}` — the seed's sketched `{ok, anomalies[]}` was correctly rejected and the spec pins the true shape; (c) verify is FULL-chain (`verifyChain()` walks `readChainAscending()` from sequence 1) and the spec proves the scoped slice sits inside the unbroken chain rather than verifying a slice in isolation; (d) the export action appends EXACTLY one `export_generated` row LAST-IN-TXN via the real `AuditService.append(input, tx)` with rollback-on-audit-fail (exactly-one-or-none), matching the append atomicity contract; (e) deterministic export (same scope → byte-identical package, honestly carving out manifest generated-at/actor); (f) RBAC — advisor has NO export (403) and sees own-outreach only, compliance/admin org-wide, anon 401 / wrong-role 403; (g) immutable — no edit/delete affordance anywhere, and no backend mutation endpoint exists. Boundaries are honest: read-only over the immutable chain, the sole possible delta is an additive `export_generated` action value (and since the DB `action` column is `text`, not a pgEnum, this is realistically a shared-type-union addition with no migration — the plan's `schema_change: maybe` hedge is over-cautious but additive-only either way, deferred to B-1). Zero ghost deps — it reuses the shipped `AuditService.append` + `AuditVerifier.verifyChain` (no fork — the single tamper-evidence authority) + M1 `RolesGuard`/`getUserWithRole` + `audit_log_entries`. Scope is disciplined: the 3-task multi-spec bundle (~2,800 LOC) clears the 2,500 floor, the mvp-thinner OK + floor_constraint_active verdict is sound (peeling the export DEPTH drops the coherent vertical to ~1,850 below floor), and PDF / multi-format / multi-regulation presets / background jobs / export_templates / forensic reports are correctly deferred. Every AC traces to a claimed_task_id and to M6; the plan's self-consistency sweep is clean, migrations precede API precede UI, and all specialists (backend-developer, typescript-pro, nextjs-developer) are in AGENTS.md. The edge space is covered — tampered-chain verify, empty log, export-audit-rollback, advisor-403, deterministic-bytes, and read-emits-no-audit-row are all explicit.

## Security-scope-tightened gate call
NOT triggered. `wave_touches` ∩ `{auth, payments, sessions, csrf, rate-limit, user-creation}` = ∅. This wave reads and exports the audit log and applies role-scoping by REUSING the existing M1 `RolesGuard`/`getUserWithRole` — it builds no new auth/session/CSRF/rate-limit/user-creation machinery and mints no sessions or credentials. RBAC reuse over a read/export surface does not put the wave in the tightened set. (Karen still red-teams the RBAC/SoD matrix and the export-append invariant in Phase 2 as normal — the tightened second-iteration rule simply does not arm here.)

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---

# Wave 13 — P-4 Verdict (Phase 2 — karen + jenny + Gemini) → REWORK → reworked
**Attempt:** 1 (Phase 2)
## Phase 2 findings (REWORK):
- **karen: REWORK** — 1 WRONG + 1 correction (reuse spine all VERIFIED):
  - WRONG (load-bearing): audit_log_entries has NO mandate_id column (only resource_type/resource_id); mandate association is per-event-type — a naive resource_id=mandateId filter omits outreach/pipeline/gate rows → guts the mandate-scoped package. → mandate→audit-row DERIVATION per resource_type required.
  - Correction: action column is text (no migration) BUT shared auditActionEnum rejects unknowns → export_generated must be added to the shared enum; kill the phantom migration-0012 branch (B-0 = definite SKIP).
  - Non-blocking: re-export the existing auditVerifyResponseSchema (don't mirror); the module needs a NEW filtered/paginated read repo method (audit.repository has only readChainAscending full-chain).
- **jenny: 2 DRIFTS** — DRIFT-3 (medium): audit-lead export RBAC contradiction (leftover sibling prose vs the authoritative YAML ACs + per-page-pd, which INCLUDE audit-lead); DRIFT-7 (low, note): deep-links ?campaign_id/?mode=export dropped from the page AC (defensible MVP reduction).
- **Gemini: UNAVAILABLE** (429; degrades non-blocking).
## Rework applied (orchestrator, P-2 spec + P-3 plan):
- P-2 spec: mandate-scope is now a DERIVED filter (per resource_type: mandate-* resource_id=mandate; outreach join outreach.mandate_id; pipeline join pipeline.mandate_id; gate/approval via resource) — no assumed mandate_id column; must capture ALL producers' rows. audit-lead confirmed in the authoritative export RBAC.
- P-3 plan: B-0 = DEFINITE SKIP (no migration); export_generated → additive shared auditActionEnum value at B-1; re-export the real auditVerifyResponseSchema; new filtered/paginated read repo method; mandate-derivation documented for B-2; schema_change: false.
- DRIFT-7 (deep-links): noted as a defensible MVP reduction (log for a later page enhancement) — non-blocking.
→ Re-entering Action 0 (head-product attempt 2) then Phase 2 re-check.

---

# Wave 13 — P-4 Verdict (attempt 2)

**Reviewer:** head-product (fresh spawn, agentId head-product-p4-w13-a2)
**Reviewed against:** reworked P-2 spec (tasks 36a17c81 / 20c479db / 10ee0ec4) + process/waves/wave-13/stages/P-3-plan.md + the attempt-1 Phase-1/Phase-2 record above
**Attempt:** 2 (post-rework)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
The attempt-1 Phase-2 rework closes every Phase-2 finding and the attempt-1 Phase-1 approval still holds — the rework was clarifying/additive and touched none of the six compliance invariants. Finding-by-finding: (1) karen's load-bearing WRONG on mandate-scope is RESOLVED — both the read spec (36a17c81) and the export spec (20c479db) now state audit_log_entries has NO mandate_id column and specify a per-resource_type DERIVATION (mandate-* events → resource_id=mandate; outreach events → join outreach.mandate_id; pipeline events → join pipeline.mandate_id; gate/approval → via their resource's mandate) that must capture ALL producers' rows, not just mandate-* rows; P-3 Action 2 documents the identical map, defers the exact map to B-1, and flags that a NEW filtered/paginated read repo method is required because audit.repository only has readChainAscending() (full-chain). No assumed column survives anywhere. (2) The enum/migration correction is RESOLVED — P-3 Action 2 and the B-0 step both read "DEFINITE SKIP — no migration (action column is text)", export_generated is an additive value on the shared auditActionEnum at B-1 (with the existing auditVerifyResponseSchema re-exported, not mirrored), the phantom migration-0012 branch is explicitly killed, and schema_change:false in the footer. (3) jenny DRIFT-3 is RESOLVED — export RBAC now reads compliance-reviewer / compliance-officer / audit-lead / admin (advisor NO export → 403) consistently across the export spec, the read spec's RBAC, and P-3; the leftover sibling-prose contradiction is gone. (4) jenny DRIFT-7 (dropped ?campaign_id / ?mode=export deep-links) is an acceptable, defensible MVP scope reduction, correctly logged non-blocking — the page AC still honors ?mandate_id / ?from / ?to, so the compliance-relevant scoping deep-links are retained; only two convenience params are deferred, with no invariant or traceability consequence. The Phase-1 compliance invariants re-confirm intact and observable: read-only-zero-audit-rows (asserted edge case, and the new derivation is still a pure read), verify returns the REAL AuditVerifier shape {ok, entriesChecked, firstBreakAt?, reason?} full-chain, export appends exactly-one-or-none export_generated row last-in-txn with rollback-on-audit-fail, advisor-no-export (403), immutable-no-edit/delete anywhere, and deterministic-export (byte-identical modulo manifest generated-at/actor). Boundaries stay honest — read-only over the immutable chain, additive-only, no credential/send/webhook/LLM/new-SDK — and the derivation joins to outreach/pipeline are reads of existing tables, adding zero ghost deps. Every AC still traces to a claimed_task_id and to M6, migrations-precede-API-precede-UI ordering holds (now trivially, B-0 skipped), and all specialists are in AGENTS.md. Nothing remains unresolved at Phase 1; proceed to Phase 2 (karen + jenny) re-check.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2

---

# Wave 13 — P-4 Phase-2 RE-CHECK → PASSED
- **karen: APPROVE** (attempt 2) — mandate-scope DERIVATION resolved (per-resource_type, captures ALL producers' rows; new filtered repo method noted); enum/migration resolved (B-0 SKIP + shared-enum add + schema_change:false); reuse spine holds (real verify shape re-exported not mirrored).
- **jenny: APPROVE** (attempt 2) — DRIFT-3 audit-lead export RBAC resolved (consistent in the authoritative contract, matches per-page-pd + read RBAC); DRIFT-7 deep-links acceptable non-blocking MVP reduction; all MATCHES re-confirmed (page scope #80, success metric, read-only immutability, deferrals, real verify shape).
- **Gemini: UNAVAILABLE** (429; degrades non-blocking).
## GATE PASSED (attempt 2): head-product APPROVED + karen APPROVE + jenny APPROVE.
```yaml
verdict_complete: true
phase1_head_product: APPROVED (attempt 2)
phase2: {karen: APPROVE, jenny: APPROVE, gemini: UNAVAILABLE-429}
gate: PASSED
rework_attempts_used: 1
build_notes: [mandate-scope=per-resource_type-derivation (define map at B-1), B-0=DEFINITE-SKIP (export_generated→shared-enum at B-1, no migration), re-export existing auditVerifyResponseSchema, new filtered/paginated read repo method, deep-links ?campaign_id/?mode=export deferred (MVP)]
```
