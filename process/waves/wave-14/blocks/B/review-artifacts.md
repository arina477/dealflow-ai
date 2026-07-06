# Wave 14 — B-block review artifacts
**Wave topic:** M6 compliance hardening (mandate-derivation e2e + gate mandate-attribution + oversight page)
**Block exit gate:** B-6
**Status:** complete
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | done | migration 0012 hash-excluded mandate_id column |
| B-1 | done | gate ctx mandateId + hash-excluded column + appendWithMandate + oversight rbac (5ec3a2c) |
| B-2 | done | gate mandateId hash-safe (verifyChain green proven) + regression green + recordkeeping branch + docstring + e2e lifts DEV-2 (d020fd4) |
| B-3 | done | /compliance/oversight oversight (distinct, read-only, advisor-blocked) (c31d069) |
| B-4 | done | repo typecheck+build PASS |
| B-5 | done | lint 0, full test green (~1717); gate-regression green |
| B-6 | gate-verdict.md | done — APPROVED (hash-safe gate + Ghost-Green journal fix + M1 e2e isolation + L1 doc) |
## Context (P-4 build-notes — LOAD-BEARING)
- ORDERING: 487b0f0c (gate mandateId context) lands BEFORE 07bd1e1a's e2e gate-capture assertion.
- **HASH-CHAIN-SAFE (the load-bearing risk):** the gate records mandateId as a HASH-EXCLUDED column (append input is .strict — thread a separate column/param around the append signature; HashableEntryFields core is closed → existing hashes byte-identical → AuditVerifier.verifyChain STAYS GREEN over mixed old/new). Gate allow/block UNCHANGED (regression). NO outreachId (unavailable pre-INSERT). Prove verifyChain green in the e2e + a mixed-chain unit test.
- 487b0f0c MUST UPDATE the recordkeeping.repository docstring that documents gate-evaluate as intentionally-excluded (now included) — else B-6 re-flags wave-13 H1.
- 07bd1e1a: recordkeeping-gate.e2e-spec (reuse test/_helpers/ensure-migrated.ts) — mandate export captures ALL producers incl gate-evaluate + EXCLUDES cross-mandate + export-one-audit + verify green. Lifts DEV-2 hard-gate.
- f5074df8 → /compliance/oversight (NOT /compliance/queue) outreach-gate oversight surface (distinct from wave-11 /compliance-queue).
