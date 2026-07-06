# Wave 14 — P-3 Plan (multi-spec: mandate-derivation e2e + gate mandate-attribution + oversight page — M6 hardening)

## Approach
### Action 1 — Architecture deltas
- **07bd1e1a (test):** new apps/api/test/recordkeeping-gate.e2e-spec.ts — self-migrating (reuse test/_helpers/ensure-migrated.ts race-safe helper), seeds a mandate with multi-producer audit rows (mandate-event + outreach-compose + pipeline stage_changed + gate-evaluate-with-context) + a SECOND mandate → asserts mandate-A export captures all A-producers incl gate-evaluate + excludes B; export-one-audit + verify green. Disjoint UUID namespace (wave-14 prefix). Runs in CI (dealflow_test).
- **487b0f0c (gate mandate-context — the load-bearing risk):** compliance-gate.service.ts verdictAuditEntry records MANDATE context (mandateId only — outreachId is NOT available at gate-evaluate time, gate runs before the outreach INSERT; mandateId suffices, karen P-4). **Mechanism (decide at B-1):** the gate-evaluate audit row currently keys resourceType='outreach-template-version'/resourceId=templateVersionId. Add the mandate/outreach context as ADDITIVE metadata that (i) the recordkeeping mandate-derivation can filter on, (ii) does NOT change the HASHED CORE serialization of the audit entry (so existing entries' hashes + verifyChain stay valid). READ audit.service.ts to find the hashed-core fields vs the additive/metadata fields — put the mandateId in a HASH-EXCLUDED nullable column (append(input) is .strict() — thread a SEPARATE hash-excluded column/param around the append signature; the HashableEntryFields core is closed, so a column outside it keeps existing hashes byte-identical). If the hash core MUST include it, then only NEW entries hash it (existing unchanged) + verifyChain must tolerate the mixed chain — prove it. The compose context (OutreachService.compose) has mandateId (outreachId does NOT exist yet — gate runs pre-INSERT) → pass mandateId into the gate's ctx (extend GateContext .strict() to carry mandateId) so verdictAuditEntry can record them.
  - *Alt considered:* a new nullable mandate_id column on audit_log_entries (additive migration 0012) that the hash excludes — clean + mandate-derivation filters on it directly. vs. a metadata JSON field. Pick the one that's hash-safe + derivation-friendly at B-1.
  - The recordkeeping.repository mandate-derivation gains a branch: gate-evaluate rows WHERE the new hash-excluded mandate column = the mandate (AND B MUST UPDATE the repository docstring that documents gate-evaluate as intentionally-excluded — 487b0f0c reverses it; else B-6 re-flags wave-13 H1) (no over-capture — context recorded at evaluate time for THIS compose's mandate).
- **f5074df8 (RECONCILED — pending P-4):** under option (a): /compliance/oversight oversight page (route-corrected per jenny P-4: /compliance/queue reserved for F10 approvals) over outreach+gate-verdict records (read-focused, distinct from wave-11 /compliance-queue); reuse audit-log-export.html patterns; SSR + proxy. Under option (b): cancel + rescope.
- **Failure-domain:** 487b0f0c touches the SHIPPED non-bypassable gate — regression-critical (allow/block unchanged + verifyChain unbroken). 07bd1e1a is test-only. f5074df8 is read-only UI.

### Action 2 — Data model
- 07bd1e1a: none (test). f5074df8: none (reads). 487b0f0c: POSSIBLY an additive nullable column on audit_log_entries (mandate_id/outreach_id) IF that's the hash-safe mechanism — migration 0012 (additive, journal-when>0011, .down; the column MUST be excluded from the HMAC hash core). OR a metadata field (no migration). Decide at B-1 by reading audit.service.ts hash serialization. **The hash-chain integrity is the load-bearing constraint.**

### Action 3 — API contracts
- 487b0f0c: internal gate change (no new route). f5074df8 (option a): GET /compliance/oversight oversight read (outreach + gate verdict + SoD/approver + mandate); RBAC compliance/admin. 07bd1e1a: none.

### Action 4 — Dependencies: NONE new. Reuses M2 AuditService/AuditVerifier + M1 RBAC + waves 11-13. No SDK/secret/spend.

## Plan (file-level, ORDERED — 487b0f0c before 07bd1e1a's assertion)
**B-0 Schema:** SKIP unless 487b0f0c needs the additive nullable audit column (migration 0012, hash-excluded) — decide at B-1.
**B-1 Contracts:** the gate-context passing (compose→gate ctx carries mandateId/outreachId) + the audit-entry shape/column for mandate context (hash-safe) + f5074df8 read shapes + rbac (/compliance/oversight compliance/admin) + confirm the hash-core-exclusion mechanism.
**B-2 Backend (487b0f0c FIRST):** gate verdictAuditEntry records mandate/outreach context (hash-safe); recordkeeping derivation branch for gate-evaluate; regression tests (gate allow/block unchanged; verifyChain green over mixed chain). THEN nothing else backend for 07bd1e1a (test). f5074df8 /compliance/oversight read endpoint (option a).
**B-2b Test (07bd1e1a):** the recordkeeping-gate e2e (asserts gate-capture — depends on 487b0f0c).
**B-3 Frontend (f5074df8, option a):** /compliance/oversight oversight page.
**B-4/B-5/B-6:** head-builder polices the HASH-CHAIN safety (verifyChain green), gate-regression, the e2e green, the f5074df8 reconciliation (not a duplicate).

### Action 6 — Specialists: backend-developer (B-0/B-1/B-2/e2e), nextjs-developer (B-3 f5074df8). All in AGENTS.md.
### Action 7 — Parallelization: 487b0f0c → 07bd1e1a-e2e (ordering dep). f5074df8 independent (parallel with the gate work, different files).
### Action 8 — Self-consistency: CLEAN. Every AC → step. **P-4 head-product MUST adjudicate f5074df8 (reframe vs cancel).** The hash-chain-safe gate metadata is the load-bearing risk (verifyChain must stay green). design_gap_flag false.

```yaml
deps_new: []
schema_change: maybe   # additive nullable hash-excluded audit column for 487b0f0c IF that's the hash-safe mechanism (migration 0012) — decide B-1; else metadata field (none)
new_secret: false
new_sdk: false
specialists: [backend-developer, nextjs-developer]
reuse: [M2 AuditService.append + AuditVerifier.verifyChain + audit hash-core, M1 RolesGuard/getUserWithRole, wave-11 gate/compose + compliance-queue, wave-13 recordkeeping derivation, shared ensure-migrated e2e helper]
compliance_invariants: [hash-chain-safe-gate-metadata (verifyChain green over mixed chain), gate-allow-block-unchanged (regression), mandate-attributable-no-over-capture, e2e-proves-mandate-capture-and-cross-mandate-isolation]
hard_boundaries: "additive; touches shipped gate (regression-guarded, hash-safe); NO credential/send/webhook/LLM/new-SDK"
ordering: "487b0f0c (gate mandate-context) before 07bd1e1a (e2e gate-capture assertion)"
design_gap_flag: false
open_decision: "f5074df8 reconciliation → P-4 head-product (reframe-oversight-surface vs cancel-redundant+rescope)"
self_consistency: clean
