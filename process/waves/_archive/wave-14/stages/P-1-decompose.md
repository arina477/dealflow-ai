# Wave 14 — P-1 Decompose

## Maximum size rubric — NO threshold trips
| Measure | Estimate | Threshold | Trip? |
|---|---|---|---|
| Files touched | ~18-24 (e2e test file + gate audit-row change [compliance-gate.service + shared audit] + /compliance/queue page + _components + read API if needed + tests) | >60 | NO |
| New primitives | ~8-12 | >60 | NO |
| Estimated net LOC | ~2,800 (head-next) | >5,000 | NO |
| Stage-4 working set | ~130-160K | >350K | NO |

## Wave type
- claimed_task_ids.length = 3 (07bd1e1a seed + 487b0f0c + f5074df8) → **multi-spec**.

## Minimum floor (multi-spec: >2,500 LOC OR ≥6 specs)
- ~2,800 net LOC > 2,500 → **floor MET**. (mvp-thinner: peeling the page f5074df8 → ~1,800 sub-floor → floor_constraint_active blocks the split; keep the coherent 3-task vertical.)

## Verdict: **PROCEED** (no split, no merge)

## design_gap_flag: **false**
- /compliance/queue page (f5074df8) → design/compliance-queue.html EXISTS (the up-front mockup). 07bd1e1a (e2e test) + 487b0f0c (gate backend) have NO UI surface. No mockup-less surface → false.

## CARRIED CONSTRAINTS for P-2/P-3 (from P-0 + this survey):
1. **ORDERING:** 487b0f0c (gate records mandate/outreach context on its audit row) must land BEFORE 07bd1e1a's e2e assertion that gate-evaluate rows are captured in the mandate-scoped export.
2. **HASH-CHAIN SAFETY:** 487b0f0c adds a field to the gate-evaluate audit-row payload. The M2 audit log is append-only + HMAC-hashed; the field-add affects only NEW entries' hashes (existing entries unchanged). B MUST prove verifyChain still passes over mixed old/new entries (canonical serialization must handle the added field deterministically — likely the field is added to the recorded metadata/resource, not the hashed core, OR the core serialization tolerates it). This is the load-bearing correctness risk of this wave.
3. **RECONCILIATION (P-2 must resolve):** f5074df8 wants /compliance/queue for "pending-approval OUTREACH items" — BUT wave-11 already shipped /compliance-queue (apps/web/app/(app)/compliance-queue) for template-VERSION approval, and in the shipped model approval is at the template-version level (a version is approved → outreach passes/fails the GATE, not a separate outreach-approval queue). P-2 MUST define precisely what "pending-approval outreach" means: is it (a) the existing template-version approval queue re-surfaced/renamed at /compliance/queue, (b) a genuinely new pending-outreach-approval concept (does the data model have one? — likely NOT, since gate decides send-eligibility), or (c) a compliance REVIEW surface over blocked/pending outreach records. Do NOT build a duplicate of the wave-11 /compliance-queue. If the concept doesn't exist in the data model, narrow f5074df8 to a compliance review surface over the existing outreach/gate-verdict records (no new approval workflow). Route to head-product at P-4 if the reconciliation changes scope.

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [07bd1e1a, 487b0f0c, f5074df8]
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
carried_constraints: [ordering-487b0f0c-before-07bd1e1a-assertion, hash-chain-safety-on-gate-audit-field-add, reconcile-compliance-queue-vs-shipped-wave11-page]
