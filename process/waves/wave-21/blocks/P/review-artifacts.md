# Wave 21 — P-block review artifacts

**Block:** P (Product)
**Wave topic:** M9 process/DX hardening (spec-authoring + test-fixture). Seed 1d95cac0. **KEY: items B/D/E already captured by the promoted PRODUCT #1; only (C) [prod authed fixtures OR declare-CI-e2e-authoritative] remains substantive.**
**Block exit gate:** P-4
**Status:** gate-passed

## Stage deliverables
| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | stages/P-0-frame.md | done | discovery + reframe (the B/D/E-superseded-by-PRODUCT-#1 insight) |
| P-1 | stages/P-1-decompose.md | done | |
| P-2 | stages/P-2-spec.md | done | |
| P-3 | stages/P-3-plan.md | done | |
| P-4 | stages/P-4-gemini-review.md | done (APPROVED; UNAVAILABLE) | |

## Block-specific context
- **Wave topic:** M9 process/DX hardening — a META/process wave (not product-feature build). Single-task seed (1d95cac0), no siblings.
- **Seed content:** (B) verify-metric-computable, (C) prod-authed-fixtures-or-CI-authoritative, (D) predictive-vs-noise-preclassify, (E) low-n-caveat-AC.
- **SUPERSESSION (the P-0 reframe crux):** PRODUCT-PRINCIPLES #1 (promoted wave-19 L-2: "A spec metric shown to users must have a real source column, not be noise by construction, and qualify low-n cases") ALREADY captures B + D + E. So the wave's substantive residue = **(C) ONLY**: provision a workspace-scoped non-destructive advisor+admin test fixture enabling real authed live V/T checks, OR formally declare CI-e2e-as-authoritative-for-isolation/RBAC up front (a testing-principles/process artifact) so the per-wave live-authed-deferral stops being a rediscovery.
- **Constraints on (C):** test_users.local_dev[] must be labels+emails ONLY (no committable passwords/secrets); prod SuperTokens creds can't be committed → a real PROD authed fixture is credential-constrained. The safe default (rule 17 technical): DECLARE CI-e2e-authoritative + document the deferral rationale (single-tenant prod + no-committable-prod-creds) as a testing-principles artifact; optionally a minimal non-destructive helper. Likely a DOCS/process wave (no product code, no migration, no UI → D-block skip, light B/T).
- **design_gap_flag:** almost certainly FALSE (process/docs wave, no UI).
- **claimed_task_ids:** [1d95cac0] (single-task process wave)
- **Autonomous mode:** automatic

## Open escalations carried into gate
none

## Gate verdict log
<appended by fresh head-product spawn at P-4 Action 1>
