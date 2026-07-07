# Wave 21 — P-3 Plan (single-spec: M9 (C) CI-e2e-authoritative declaration)

## Approach
### Action 1 — Deliverable (docs/process, no product code)
- **A testing-strategy artifact** (command-center/testing/ci-e2e-authoritative-policy.md OR an addition to command-center/testing/test-writing-principles.md) that:
  1. NAMES the compliance/isolation invariants CI-e2e (real-DB as non-superuser dealflow_app on postgres:18) is AUTHORITATIVE for — enumerated + falsifiable: workspace-isolation read-negative-read; write-path (own-row-re-home→42501, no-DEFAULT_WORKSPACE_ID placement); RBAC 403/401; audit-logged-mutation last-in-txn + verifyChain; SoD. Reference the wave-17/18/19/20 e2e that prove each (as-dealflow_app pattern).
  2. DOCUMENTS the LIVE-authed in-app check deferral rationale: single-tenant prod (a 2-workspace live test is structurally impossible) + no committable prod SuperTokens creds (rule 2 — test_users.local_dev is labels+emails-only). So the CI e2e IS the authoritative isolation/RBAC proof; the live check is anon-gating-only (401) until the trigger below.
  3. Sets the LATER-TRIGGER to ADD real authed live checks: when a 2nd prod/staging tenant + a committable non-destructive advisor+admin fixture exists (or the test-accounts.md registry is safely populated). Until then, V/T record the live-authed check as "deferred — CI-authoritative" WITHOUT re-deriving the rationale each wave.
- **CLOSE (B)/(D)/(E)** in the task/deliverable: a one-line note that they are captured + enforced by PRODUCT-PRINCIPLES #1 (real-source-column / not-noise-by-construction / qualify-low-n) — no new artifact, no re-doc.
- Optionally: a pointer from test-writing-principles.md to PRODUCT #1 for the spec-authoring metric-honesty checklist.

### Action 2-4 — Data model: none. API: none. Deps: none. No code, no migration, no secret, no SDK.

## Plan (by B-stage — LIGHT docs wave)
**B-0 Schema:** SKIP (no schema).
**B-1/B-2:** author the CI-e2e-authoritative testing artifact + the B/D/E-closed note — via documentation-engineer or a qa/test-lens agent (the invariant list + falsifiability provided). No product code.
**B-3 Frontend:** SKIP (no UI).
**B-4/B-5:** typecheck/lint/build stay green (no code change → trivially green; the doc doesn't affect the build); B-5 lint on any touched md.
**B-6:** head-builder gates the artifact quality (falsifiable named-invariant list, not vague; B/D/E correctly closed-by-principle not re-doc'd).

### Action 6 — Specialist: documentation-engineer (or qa-expert for the invariant-list rigor). In roster.
### Action 7 — Parallelization: single artifact, single stage.
### Action 8 — Self-consistency: CLEAN. One docs deliverable. design_gap false. D-block skip.

```yaml
deps_new: []
schema_change: false
new_secret: false
new_sdk: false
specialists: [documentation-engineer]
reuse: [PRODUCT-PRINCIPLES #1 (B/D/E), the wave-17/18/19/20 as-dealflow_app CI e2e (the authoritative isolation/RBAC proofs), test-accounts.md (the fixture mechanism, empty registry)]
compliance_invariants: [the artifact ENUMERATES them: workspace-isolation read+write, RBAC 403/401, audit-logged-mutation+verifyChain, SoD — CI-authoritative]
hard_boundaries: "docs/process ONLY — NO prod-cred provisioning (rule 2 security), NO code/migration/UI, NO re-doc of B/D/E (done by PRODUCT #1). A falsifiable CI-e2e-authoritative declaration + deferral rationale + later-trigger."
design_gap_flag: false
d_block: skip
self_consistency: clean
```
