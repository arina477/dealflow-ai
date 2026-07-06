# Wave 14 — P-4 Verdict

**Reviewer:** head-product (fresh spawn)
**Reviewed against:** process/waves/wave-14/blocks/P/review-artifacts.md
**Attempt:** 1  (first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
The wave is a coherent, additive M6 compliance-hardening vertical with three tasks that all trace directly back to the P-0 bet (prove the mandate-scoped recordkeeping export is correct so the compliance-wedge falsifier — an incorrect regulator package — is de-risked). I verified the load-bearing hash-chain-safety claim against the actual code and it holds; the spec's acceptance criteria for the audit log, the pre-send gate, and RBAC are all binary and machine-checkable; and I have adjudicated the open f5074df8 reconciliation in favour of REFRAME (option a) after confirming against the shipped wave-11 page and the gate service that the literal premise duplicated shipped work but the reframed oversight surface is genuinely new and valuable. No scope smuggle, no implementation leakage, no orphaned edge cases. Proceed to Phase 2 (Karen + jenny + Gemini) — security-scope tightened (touches the shipped compliance gate + audit + RBAC).

## f5074df8 adjudication — DECISION: **(a) REFRAME**

**Decision:** REFRAME f5074df8 to a compliance OVERSIGHT surface at `/compliance/queue` over outreach + gate-verdict records (read-focused, distinct from the wave-11 template-version approval queue). The spec's option-(a) acceptance criteria stand. The 3-task wave is preserved; no rescope.

**Reasoning (verified against code, not the spec's self-report):**
- **The literal premise is dead.** The wave-11 page `apps/web/app/(app)/compliance-queue/page.tsx` already ships the pending **template-VERSION** approval queue: it flattens templates → versions, filters `v.approvalStatus === 'pending'`, and wires approve/reject to `/outreach-templates-data/:id/versions/:vid/approve|reject` with compliance-only RBAC + server-side SoD. That is the "compliance approval queue."
- **"Pending-approval outreach" does not exist in the model.** `compliance-gate.service.ts` confirms outreach send-eligibility is decided by `evaluate()` → a `GateVerdict {allowed, blocks, requiredDisclaimers}`, audited as a `gate-evaluate` row. There is no separate outreach-approval status/workflow. So f5074df8's literal "pending-approval outreach items with approve/reject" would either duplicate the version queue or invent a non-existent workflow — REJECTED as written.
- **The reframe is non-duplicative and worth building.** Nothing today surfaces, per outreach, its gate verdict (`send_eligible`/`blocked` + block reason) alongside template version, SoD/approver, and mandate in one monitoring view. That is a real compliance oversight gap for a compliance-first M&A product — a distinct route/purpose from the version-approval queue (which stays). It is strictly read-focused; any approve/reject it exposes delegates to the EXISTING version endpoints (no new workflow — correct, because none exists to build).
- **Non-goal enforced:** the reframed surface MUST NOT introduce a new approval workflow or new approvable status, and MUST NOT re-implement the wave-11 version queue. Head-builder polices "reconciled-not-duplicate" at B-6.
- Option (b) CANCEL was available and would have been defensible on pure MVP grounds, but it drops the wave sub-floor (~1,800 LOC) forcing a RESCOPE-AUTO-MERGE or a sub-floor justification — needless churn when a genuinely valuable, non-duplicative oversight surface is in reach. REFRAME is the higher-leverage call.

## Load-bearing findings (verified against source)

### 1. Hash-chain-safe gate metadata (487b0f0c) — FALSIFIABLE + MECHANISM SOUND
- I read `apps/api/src/modules/audit/audit.service.ts`. The hashed core is a **closed field set** — `HashableEntryFields` = {sequenceNumber, actorUserId, actorRole, action, resourceType, resourceId, contentHash, payloadHash, chainVersion, createdAt}, hashed by `computeEntryHash`. Nothing else enters the HMAC.
- Therefore a nullable `mandate_id`/`outreach_id` column (migration 0012, additive) OR a stored metadata field that is NOT passed into `HashableEntryFields` leaves the hashed bytes **byte-identical**. Existing entries' hashes are unchanged and `AuditVerifier.verifyChain()` stays green over the mixed old/new chain. The plan's "additive metadata OUTSIDE the hashed core / hash-excluded nullable column" mechanism is **structurally sound** given this serialization.
- **AC is falsifiable:** verifyChain `{ok:true}` over a mixed chain (unit test + the 07bd1e1a e2e); gate allow/block regression-guarded (existing gate + outreach-gate e2e stay green). Both are binary, observable, automated.
- **Deferral to B-1 is correct:** the plan defers the exact metadata-field-vs-nullable-column choice to B-1 after reading the hash serialization + the derivation query. This is the right sequencing — both candidate mechanisms are hash-safe as long as they stay out of `HashableEntryFields`; the choice is a derivation-ergonomics call, not a correctness one. Not implementation leakage — it fixes the OBSERVABLE contract (verifyChain green, mandate-attributable) and leaves the mechanism to Build.
- **"No over-capture" is correct:** context is recorded at gate-evaluate time from the compose ctx (`OutreachService.compose` already carries mandateId+outreachId) for THIS mandate — not back-derived. `verdictAuditEntry(ctx, verdict)` is the exact single choke point that must carry the context; the plan names it. AC explicitly forbids "lossy template-version→mandate back-derivation." Sound.

### 2. 07bd1e1a e2e — FALSIFIABLE + ADEQUATE, ORDERING CORRECT
- Proves the mandate export captures ALL producers (mandate-event + outreach-compose + pipeline stage_changed + gate-evaluate post-487b0f0c) AND excludes a second mandate's rows (cross-mandate isolation) AND appends exactly one `export_generated` row AND full-chain verify `{ok:true}`. All binary/observable. Reuses the race-safe shared ensure-migrated helper; disjoint UUID namespace; runs in CI dealflow_test.
- **Ordering is correctly sequenced:** the plan runs 487b0f0c (B-2 backend, FIRST) before 07bd1e1a's gate-capture assertion (B-2b test). The e2e's "gate-evaluate rows ARE captured" assertion depends on 487b0f0c landing first — the plan states this dependency explicitly and orders accordingly. Correct.
- Lifts the wave-13 DEV-2 hard-gate once green — the compliance-load-bearing purpose. Adequate.

### 3. Scope / ambition — RIGHT INVESTMENT, BUNDLE COHERENT
- Compliance-hardening is the right bet: it directly de-risks the compliance-wedge falsifier (an incorrect regulator package is catastrophic, not cosmetic). All three tasks share one spine — proving/completing the mandate-scoped recordkeeping package. ceo-reviewer HOLD-SCOPE + mvp-thinner floor_constraint confirmed at P-0; I concur. No scope creep, no speculative future-proofing.

### 4. Boundaries — HONEST
- Additive; reuses shipped M2 (AuditService/AuditVerifier), M1 (RBAC), waves 11-13. NO credential/send/webhook/LLM/new-SDK. The one non-read-only touch (additive gate metadata) is explicitly regression- + hash-safety-guarded. The founder-credential guard (live send, webhook, AI drafting) stays correctly OUT. Boundaries are honestly stated and match the code surfaces.

### 5. Security-scope — TIGHTENED (TRUE)
- The wave touches the SHIPPED non-bypassable compliance gate + the tamper-evident audit hash-chain + compliance/admin RBAC. This is squarely in the security-sensitive set (auth/sessions-adjacent + the audit invariant + the send-eligibility authority). **I flag security-scope-tightened = TRUE.** Phase 2 (Karen + jenny) must scrutinize: (i) verifyChain stays green over the mixed chain, (ii) gate allow/block behavior is unchanged (no bypass introduced by the ctx-passing change), (iii) the oversight surface's RBAC/SoD does not leak cross-mandate outreach records to an advisor. T-8 Security stage must carry the hash-chain + gate-regression + cross-mandate-isolation invariants.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3
- security_scope_tightened: true
- f5074df8_decision: reframe (option a)

---
# Wave 14 — P-4 Verdict (Phase 2 iteration 1 — karen + jenny + Gemini) → reworked
- **karen: APPROVE w/ 1 WRONG + 2 caveats** — hashed core is a closed set (hash-safe VERIFIED); WRONG: outreachId unavailable at gate-evaluate time (gate pre-INSERT) → record mandateId only; caveat: append(input) .strict() → thread mandate as a hash-EXCLUDED column; caveat: 487b0f0c must UPDATE the recordkeeping gate-evaluate-excluded docstring (else B-6 re-flags H1).
- **jenny: DRIFT (low/med)** — journey map reserves /compliance/queue for F10 approvals; the shipped queue is /compliance-queue (hyphen) → the reframe on /compliance/queue creates a slash/hyphen dual-queue confusion. Recommend /compliance/oversight. Otherwise MATCHES.
- **Gemini: UNAVAILABLE** (429).
## Rework applied (orchestrator, spec + plan): mandate-only (drop outreachId); mandate as hash-EXCLUDED column threaded around the .strict append (migration-0012 option); 487b0f0c must update the recordkeeping intentionally-excluded docstring; oversight route → /compliance/oversight (not /compliance/queue).
## Security-scope-tightened TRUE → 2nd Phase-2 iteration required. Re-entering Action 0 (head-product attempt 2) → Phase 2 iteration 2.

---
# Wave 14 — P-4 Verdict (attempt 2)

**Reviewer:** head-product (fresh spawn)
**Reviewed against:** process/waves/wave-14/blocks/P/review-artifacts.md (re-gate of reworked P-2 spec + P-3 plan)
**Attempt:** 2  (post-rework — resolves the attempt-1 Phase-2 iteration-1 findings)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
All four attempt-1 Phase-2 findings are resolved in the reworked spec (task descriptions for 07bd1e1a + 487b0f0c) and P-3-plan.md, and I re-confirmed the attempt-1 Phase-1 approval invariants still hold — the wave remains a coherent, additive, hash-chain-safe M6 compliance-hardening vertical. karen's WRONG is corrected: 487b0f0c now records mandateId ONLY (outreachId is genuinely unavailable at gate-evaluate time because the gate runs before the outreach INSERT; mandateId alone is sufficient for mandate-attribution), and 07bd1e1a's producer-list matches. karen's two caveats are closed: the mandate context is threaded as a SEPARATE hash-EXCLUDED column/param around the .strict append signature (the migration-0012 additive-nullable-column option — because the HashableEntryFields core is a closed set, a column outside it leaves existing hashes byte-identical and verifyChain green over the mixed chain), and 487b0f0c now carries an explicit AC to UPDATE the recordkeeping.repository docstring that documented gate-evaluate as intentionally-excluded (reversing the wave-13 H1 exclusion, so B-6 will not re-flag the H1 honesty contradiction). jenny's route DRIFT is corrected: every option-(a) acceptance criterion and the mechanism now target /compliance/oversight (NOT /compliance/queue, which is reserved for F10 approvals, avoiding the slash/hyphen dual-queue collision with the shipped /compliance-queue). Phase-1 invariants re-confirmed: the hash-chain-safe gate-metadata AC is falsifiable (verifyChain {ok:true} over a mixed old/new chain via unit test + the 07bd1e1a e2e); ordering is correct (487b0f0c backend lands before 07bd1e1a's gate-capture e2e assertion, stated explicitly); the f5074df8 REFRAME is non-duplicative (distinct route + read-focused oversight purpose vs the wave-11 version-approval queue, which stays); boundaries are additive with no credential/send/webhook/LLM/new-SDK touch; and the e2e lifts the wave-13 DEV-2 hard-gate once green.

## Residual note (non-blocking, for B-3)
Two stale descriptive labels remain in P-3-plan.md (the B-3 Frontend one-liner on line 25, and the f5074df8 spec title) that still read "/compliance/queue". These are non-binding labels, NOT acceptance criteria — every AC, the route target, and the mechanism correctly say /compliance/oversight. Build must ship the route as /compliance/oversight per the ACs; head-builder polices at B-6. Recorded here so the stale labels are not mistaken for the contract.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 2
- security_scope_tightened: true
- reworks_resolved: [karen-WRONG-outreachId, karen-caveat-strict-append, karen-caveat-docstring, jenny-DRIFT-route]
- phase1_invariants_hold: true
- next_action: PROCEED_TO_PHASE2_ITERATION2 (karen + jenny re-check)

---
# Wave 14 — P-4 Phase-2 iteration 2 → PASSED
- **karen: APPROVE** (attempt 2) — all iter-1 findings resolved: outreachId dropped (mandateId-only, gate pre-INSERT); mandate as HASH-EXCLUDED column threaded around .strict append (HashableEntryFields core untouched → verifyChain green); 487b0f0c docstring-update AC added; closed-hashed-core + ordering hold.
- **jenny: APPROVE** (attempt 2, after title/plan route fix) — /compliance/oversight route fully resolved (title + all ACs + plan); remaining /compliance-queue mentions are correct context refs to the reserved wave-11 route. 487b0f0c aligns with the root-cause fix; 07bd1e1a lifts DEV-2; non-duplicative. T-9 journey note: map row-15/F10 → shipped /compliance-queue + add a /compliance/oversight row.
- **Gemini: UNAVAILABLE** (429).
## GATE PASSED (attempt 2, Phase-2 iteration 2 — security-scope-tightened ≥2 iterations satisfied): head-product APPROVED + karen APPROVE + jenny APPROVE.
```yaml
verdict_complete: true
gate: PASSED
security_scope_tightened: true
phase2_iterations: 2
f5074df8_decision: REFRAME → /compliance/oversight (outreach-gate oversight surface; non-duplicative)
build_notes: [gate records mandateId ONLY (outreachId unavailable pre-INSERT), hash-EXCLUDED column threaded around .strict append (migration-0012), 487b0f0c UPDATE recordkeeping intentionally-excluded docstring, ordering 487b0f0c→07bd1e1a e2e, verifyChain-green-over-mixed-chain is load-bearing, T-9 journey remap /compliance-queue vs /compliance/oversight]
```
---
## P-block exit
```yaml
product_block_status: complete
review_verdict: APPROVED
design_gap_flag: false
next: B
```
