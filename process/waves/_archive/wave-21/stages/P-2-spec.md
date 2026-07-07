# Wave 21 — P-2 Spec (pointer)
**Source of truth:** seed task 1d95cac0 tasks.description (accumulated notes) + this scoped contract. wave_type single-spec. design_gap false. D-block skip.
**claimed_task_ids:** [1d95cac0] (single-task process wave).
## AC summary (scoped to (C) per the P-0 REFRAME)
1. **A testing-strategy artifact declares CI-e2e-AUTHORITATIVE** for the named compliance/isolation invariants (falsifiable, enumerated): workspace-isolation read-negative-read + write-path (own-row-re-home→42501, no-DEFAULT-placement); RBAC 403/401; audit-logged-mutation last-in-txn + verifyChain; SoD — each referencing the wave-17..20 as-dealflow_app e2e that proves it.
2. **The live-authed in-app check deferral is documented ONCE** (single-tenant prod + no-committable-prod-creds rule-2) with a LATER-TRIGGER condition (2nd tenant + committable non-destructive fixture / populated test-accounts registry) — so V/T stop re-deriving it each wave.
3. **(B)/(D)/(E) closed-by-PRODUCT-#1** (a one-line note; no re-doc, no new artifact).
4. **NO prod-cred provisioning** (rule 2), NO code/migration/UI.
## Load-bearing: the declaration must be FALSIFIABLE (named invariant list + trigger), not vague process-theater. Enforced-by-principle B/D/E must NOT be re-documented.
