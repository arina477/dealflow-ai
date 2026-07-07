# Wave 21 — P-0 Frame

## Discover
- wave_db_id: e72bb0ce-db67-48e7-8c1c-b3f9981ba3d1 (wave_number 21, milestone M9)
- Prior-work: M9 shipped analytics (w18) + calibration (w19) + outreach-log (w20). The CRM (345dfbc6) is now blocked (founder vendor+key); seller-intent → wave-22 (needs decomposition). This wave (21) is the single claimable M9 seed: a PROCESS/DX hardening task (1d95cac0).
- Roadmap milestone: M9 — Integrations & insight (in_progress, Class product-feature, but THIS task is process/DX). Success metric _TBD.
- Spec-contract: accumulated-notes seed (1d95cac0) → full P-1..P-3 (light).

## Reframe
### Original framing
Seed 1d95cac0 has 4 accumulated process items: (B) verify-metric-computable-before-authoring, (C) prod-authed-fixtures-OR-declare-CI-authoritative, (D) predictive-vs-noise-preclassify, (E) low-n-caveat-AC.

### problem-framer — REFRAME
B/D/E are SUPERSEDED by PRODUCT-PRINCIPLES #1 (promoted wave-19 L-2, verbatim line 72: "A spec metric shown to users must have a real source column, not be noise by construction, and qualify low-n cases"). Re-authoring process docs for them = snacking/process-theater (antipattern). The sole real residue is (C), genuinely uncaptured. The sound causal fix for (C): DECLARE CI-e2e-authoritative for isolation/RBAC + document the deferral (a light VERIFY/testing artifact) — NOT provision uncommittable prod SuperTokens creds (over-build + rule-2 security-constraint antipattern). Key finding: test-accounts.md's prod-fixture MECHANISM exists but the registry is an empty template — the empty-registry-authoritative-gate is (C)'s true uncaptured cause. Thin to docs-only, D-block skip.

### ceo-reviewer — RESHAPE (scope-reduction)
Strip to (C) only (B/D/E = process-theater re-doc). The live-authed-check deferral is a genuine THRICE-repeated V/T gap (w18/19/20). Right 6-8/10 = DECLARE CI-e2e-authoritative for the isolation/RBAC/SoD invariants — make it FALSIFIABLE (a NAMED-invariant list + a later-trigger condition for when to add real authed live checks), else under-ambitious. Do NOT provision committable prod creds (over-ambitious + secret-hazardous, rule 2). Not idle-worthy to skip (CRM blocked, seller-intent needs next-wave decomposition); traces to the compliance-first bet.

### mvp-thinner — OK (blocked-on-_TBD-metric)
M9 ## Success metric _TBD → no AC-thinness trace possible; this is a process task not product-feature ACs → the B/D/E-done-by-principle + scope-to-C is a P-1/P-2 de-dup/execution-tier call (passed through as a note), not an mvp-thinner THIN.

### Disposition: PROCEED (reframed to (C) only)
Final framing → P-1: scope the wave to **(C) ONLY** — author a falsifiable testing-principles/VERIFY artifact formally DECLARING CI-e2e-as-authoritative for the named isolation/RBAC/SoD invariants + the deferral rationale + the later-trigger condition; CLOSE B/D/E as done-by-PRODUCT-#1 (a one-line note, no re-doc). NO prod-cred provisioning (security). A DOCS/process wave — no product code, no migration, no UI.

## LOAD-BEARING scope for (C):
- A testing artifact (command-center/testing/ or command-center/principles/VERIFY or test-layer) that:
  1. NAMES the invariants CI-e2e (real-DB as dealflow_app on postgres:18) is AUTHORITATIVE for: workspace-isolation read-negative-read + write-path (own-row-re-home, no-default-placement), RBAC 403/401, audit-logged-mutation last-in-txn + verifyChain, SoD. (These are the invariants V/T repeatedly proved via CI, deferring the live-authed check.)
  2. DOCUMENTS why the LIVE-authed in-app check is deferred (single-tenant prod + no committable prod SuperTokens creds — rule 2) — so it stops being a per-wave rediscovery.
  3. Sets the LATER-TRIGGER condition to add real authed live checks (e.g. when a 2nd prod/staging tenant + a committable non-destructive fixture exists, OR the test-accounts.md registry is populated via a safe mechanism).
- CLOSE (B)/(D)/(E): note in the task/checklist that they are captured by PRODUCT-PRINCIPLES #1 (no new artifact).

## design_gap_flag: false (docs/process wave, no UI).
claimed_task_ids: [1d95cac0-b396-40b7-8904-be0fa42aa3ab] (single-task process wave).
