# Wave 14 — T-9 Verdict

**Reviewer:** head-tester (fresh spawn, T-9 Phase 1 gate)
**Reviewed against:** process/waves/wave-14/blocks/T/review-artifacts.md + findings-aggregate.md (T-1..T-8) + C-1 + C-2 + B-6 gate-verdict + the deployed recordkeeping-gate.e2e-spec.ts
**Attempt:** 1  (first gate)

## Verdict
APPROVED

## Rationale

Every compliance invariant on the security-scope-tightened map is non-hollowly covered by
independent, mutually-reinforcing evidence — unit + CI-real-DB + C-2-live — and I verified
the load-bearing claims against source, not just the summaries.

**#1 Hash-chain intact after the additive `mandate_id` column** — proven three disjoint ways.
(a) UNIT: `audit.mandate-hash-safety.spec` (5 tests, in CI test job) directly recomputes HMAC over
the fixed hashable field set == the stored `entry_hash`, proves old/new mixed-chain `verifyChain {ok:true}`,
and includes a mandate-mutation-not-detectable boundary test that confirms `mandate_id` is genuinely
outside the preimage (not a tautology — it asserts the recompute equals the stored hash). (b) CI real-DB:
the recordkeeping-gate e2e runs `verifyChain` over a mixed old/new chain on a freshly journal-migrated
Postgres. (c) LIVE (C-2): `GET /compliance/audit-log/verify` → `{ok:true, entriesChecked:310}` over the
accumulated PRODUCTION chain AFTER 0012 landed, with seq-309 `entryHash` byte-identical to the wave-13
tail — the definitive proof the additive column did not break tamper-evidence in prod. Migration 0012 is
statically additive-only (single nullable `ADD COLUMN`, zero DROP/ALTER-TYPE) and `mandate_id` is excluded
from `canonicalSerialization v1`.

**#2 mandate_id-column isolation (the feature's actual defense)** — GENUINE, not the earlier
resourceId-distinguishable version. I inspected `apps/api/test/recordkeeping-gate.e2e-spec.ts` directly:
9 real `it()` blocks, and test **I** (line 658) has mandate-A AND mandate-B both gate-evaluate the SAME
`SHARED_VERSION_ID` (`00000014-0005-4000-8000-000000000003`), isolated ONLY by the `mandate_id` column,
asserting mandate-A's export includes the `mandate_id=A` row and excludes the `mandate_id=B` row (count=1
each). This is exactly the case that regresses to count=2 (resource_id-keying) or count=0 (branch removed) —
a fault-killing assertion, not coverage theater. I confirmed via `git merge-base --is-ancestor` that the
shared-version commit (9009abb) AND the migration-journal fix (0161e57) are both ancestors of the deployed
code SHA 0488cd7. C-1 run 28784535052 shows this suite ran REAL (9 tests, migrated `dealflow_test`,
`mandate_id` column present) — GREEN, not skipped, at the deployed commit. The B-6 Ghost-Green (migration
0012 not registered in the Drizzle journal, which would have made the column absent on a fresh DB and the
green a Ghost) was caught by head-builder and fixed at 0161e57 before merge. The wave-13 DEV-2 hard-gate
lift is legitimate.

**#3 Gate no-regression** — `compliance-gate.service.spec` (30) + `outreach-gate.e2e` (6 REAL, no mocks) +
`pipeline-gate.e2e` (4) all green in CI, and C-2 live confirmed the non-bypassable compose→gate path fires
server-side (404 on nonexistent refs, 400 on malformed — no 500, no silent send; allow/block unchanged).
The only delta is `append`→`appendWithMandate(…, ctx.mandateId)`; evaluate() runs the same four evaluators
in the same order (verified in the B-6 rationale). Adequate.

**#4 RBAC/SoD + M2-validation + oversight read-only** — C-2 live server-side (not UI-hidden): advisor
export 403 + advisor verify 403 (RolesGuard), anon verify 401 (SessionGuard), advisor read 200 `[]`
(own-outreach scoping); `limit=999999`→400 and `mandateId=notauuid`→400 at the boundary (BadRequest, not
500/unbounded); `/compliance/oversight` self-grepped on the DEPLOYED authed HTML (24KB authed page, gate-
outcome table) is READ-ONLY (zero approve/reject/edit/delete/send/mailto/AI-draft affordance — only a
mandate-filter input + Refresh), DISTINCT from `/compliance-queue`, advisor 307-blocked with zero content
leaked. Adequate.

**Findings weigh — none block this wave.**
- **L1** (mandate_id tamper silent to `verifyChain` BY DESIGN): acceptably documented in
  `command-center/dev/architecture/audit-mandate-attribution.md`, which honestly states the boundary, names
  the HMAC-covered core invariants (who/what/when/order) that remain intact, documents the two existing
  attribution defenses (INSERT/SELECT-only DB grant + BEFORE-UPDATE/DELETE trigger; nightly AuditIntegrityJob),
  and carries an explicit auditor note that a separate reconciliation control is needed IF mandate-attribution
  integrity becomes a compliance requirement. `mandate_id` is filterable METADATA attribution, not a core
  tamper-evident invariant — this is a documented, defended, out-of-preimage column, NOT a bypass of a
  compliance invariant. Not a blocking control for this wave; the durable doc is sufficient.
- **L2** (journey-map remap of row-15/F10 to `/compliance-queue` + add `/compliance/oversight` row): T-9
  Phase-2 regen hygiene, handled downstream in the journey-map regen.
- **INFO** (full live compose→gate→mandate-attributed-write smoke not assembled): honestly stated as un-run
  (it would inject a whole owned mandate chain into prod), and the WRITE path is proven at C-1 by the REAL
  migrated-DB recordkeeping-gate e2e (9 tests incl shared-version); the LIVE mandate-filter READ path is
  confirmed against the new column. No green was fabricated.

**Heuristics applied — no blocking pattern fires.** No coverage theater (assertions check concrete export-row
membership + HMAC bytes + live chain state). No tautological assertions (test I and the hash-safety boundary
test both fail on real regressions — fault-killing). No untested compliance invariant (all four covered
unit + CI-real-DB + C-2-live). No silently-skipped E2E: the recordkeeping-gate e2e ran 9/9 REAL (count
verified in-source and in the CI job log at the deployed SHA); the Ghost-Green journal defect was caught and
fixed pre-merge. **No layout-only false-PASS and no missing-Playwright-binary ESCALATE:** T-5/T-6 here were
NOT a Playwright browser suite claiming a silent exit-0 — they were C-2 deployed-authed HTTP probes and
self-grepped deployed HTML with concrete asserted values (specific gate-outcome table strings, status codes,
byte-sizes, RBAC 403/401/307), i.e. behavioral assertions on real deployed data. The false-PASS-from-missing-
binary trap requires a Playwright run reporting green with zero executed tests; there is no such claim in this
wave, so that hard-ESCALATE does not apply.

## Cascade
- **Stages that must re-run:** none (APPROVED).
- **Stages that stay untouched:** all T-1..T-8.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3
