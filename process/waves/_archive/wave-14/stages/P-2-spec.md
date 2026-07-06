# Wave 14 — P-2 Spec (pointer)
Authoritative = YAML head of 07bd1e1a's tasks.description. multi-spec, 3 blocks.
## claimed_task_ids: [07bd1e1a (seed e2e), 487b0f0c (gate mandate-context), f5074df8 (oversight page — RECONCILED)]
- **07bd1e1a:** self-migrating real-DB e2e (recordkeeping-gate.e2e-spec, reuse shared ensure-migrated helper) — mandate export captures ALL producers (incl gate-evaluate once 487b0f0c lands) + EXCLUDES cross-mandate rows + export-one-audit + verify green. Lifts the DEV-2 hard-gate.
- **487b0f0c:** gate records mandate/outreach context on gate-evaluate audit row → mandate-attributable WITHOUT over-capture; **HASH-CHAIN-SAFE (verifyChain green over mixed old/new; additive metadata; gate allow/block unchanged)**; recordkeeping derivation gains a branch to capture them.
- **f5074df8: RECONCILIATION → P-4 head-product decision.** wave-11 /compliance-queue ALREADY ships version-approval + SoD + audit; no "pending-approval outreach" status exists. Options: (a) REFRAME to an outreach-gate OVERSIGHT surface at /compliance/queue (distinct from wave-11's version queue; read-focused; delegates any approve to existing endpoints), or (b) CANCEL-redundant → rescope to 2 tasks (sub-floor → RESCOPE-AUTO-MERGE). Spec'd under option (a) pending P-4.
## ORDERING: 487b0f0c before 07bd1e1a's gate-capture assertion. Boundaries: additive, no credential/send/LLM.
