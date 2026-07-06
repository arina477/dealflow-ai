# Wave 14 — V-3 Verdict

**Reviewer:** head-verifier (fresh spawn, V-3 Phase 1 gate) + agentId `arina-5ywq3s`
**Reviewed against:** V-1 karen (APPROVE) + V-1 jenny (APPROVE) + V-1-summary + V-2-triage (0 blocking, 0 fast-fix candidates) + C-1 (CI 5/5, recordkeeping-gate e2e 9/9 REAL) + C-2 (deployed LIVE `5754fbf`, verifyChain {ok:true,310} after 0012) + B-6 (APPROVED) + T-9 (head-tester APPROVED)
**Attempt:** 1  (first gate)
**Deployed target:** `5754fbf11818110f47a1c774aa06ebfe4042a8ef` (api + web, Railway, LIVE — independently re-probed)

## Verdict
APPROVED

Fast-fix loop: NOT ENTERED (V-2 triage = 0 blocking, 0 fast-fix candidates; both V-1 reviewers APPROVE). This gate issues the block-exit verdict directly.

## Rationale

Every load-bearing compliance invariant this wave touches is traced to a concrete, observable
deployed-state artifact or the deployed source path — NOT inferred from a green suite. I did not
sign off on the report chain; I spot-checked the five load-bearing proofs myself.

**#1 — HASH-CHAIN INTACT after the additive `mandate_id` column (THE #1; a break corrupts
tamper-evidence). AIRTIGHT — proven by deployed source AND live deployed state.**
- SOURCE (deployed code path, self-traced): `audit.hash.ts:54-66` `HashableEntryFields` is 10 fields
  with NO `mandateId`; `grep` of `audit.hash.ts` returns ZERO `mandate` references — the HMAC
  `canonicalSerialization v1` preimage is structurally mandate-free. `audit.service.ts:_appendCore`
  builds `hashable` (lines 154-165) WITHOUT mandateId, computes `entryHash = computeEntryHash(hashable,
  prevHash, key)` (169) over that mandateId-free object, then writes `mandateId` to the DB column
  SEPARATELY via `insertEntry(tx, {...hashable, prevHash, entryHash, mandateId})` (174-179). The column
  is written alongside — never into — the preimage. The write-time self-check tripwire (190+) ALSO
  excludes mandateId. This is the exact additive-nullable, hash-excluded mechanism the P-4 rework
  mandated; the column literally cannot enter the HMAC.
- LIVE (C-2, deployed-state artifact): `GET /compliance/audit-log/verify` → `{ok:true,
  entriesChecked:310}` over the accumulated PRODUCTION chain AFTER 0012 landed, re-checked stable at
  end-of-stage; seq-309 `entryHash` byte-identical to the wave-13 tail. This is the definitive proof the
  additive column did not break tamper-evidence in prod, not a mock. I independently re-probed the
  endpoint LIVE: anon `GET /compliance/audit-log/verify` → 401 (endpoint is live + SessionGuard-gated,
  not dead/404); `/health` → `{status:ok,db:ok,version:5754fbf}` (== deploy target, db live). The full
  `{ok:true}` reproduction requires an authed compliance session (invite-only app); C-2's contemporaneous
  authed 200 + the source proof + the migrated live column together substantiate the claim beyond
  inference. Airtight.

**#2 — Deployed == CI-tested commit (no Ghost Green). CONFIRMED, self-verified.**
`/health` returns `5754fbf` on the api own domain (independently re-probed, stable). `git diff --name-only
0488cd7 5754fbf` = exactly 2 files, BOTH under `process/` (wave-14 checklist + C-1 stage doc) — zero
application/schema/CI-workflow bytes; `[skip ci]` is correct. CI run 28784535052 ran GREEN (5/5:
lint/typecheck/test/build/audit incl `pnpm audit --audit-level=high` 0 high/critical) on the EXACT code
SHA `0488cd7` (headSha === main SHA — provenance verified). The migration-journal Ghost-Green (0012 not
registered → column absent on fresh DB) was CAUGHT by head-builder at B-6 and FIXED at 0161e57 — I
confirmed `meta/_journal.json` at HEAD carries `"idx": 12` (tag 0012_audit_mandate_id, when
1783814400000 > 0011), so a clean-DB `drizzle migrate` genuinely creates the column and the deployed
api's in-band migrate produced it live (verifyChain green + audit rows carry `mandateId:null` with no
column-error). No Ghost Green.

**#3 — mandate_id-COLUMN isolation (the feature's actual defense). GENUINE, fault-killing.**
The recordkeeping-gate e2e (9 tests) ran REAL (not mocked, not skipped) in CI run 28784535052 against a
freshly journal-migrated `dealflow_test` Postgres at the deployed SHA. Test I asserts mandate-A AND
mandate-B gate-evaluate the SAME `SHARED_VERSION_ID`, isolated ONLY by the `mandate_id` COLUMN, and that
mandate-A's export includes the `mandate_id=A` row and excludes `mandate_id=B` (count=1 each). This is
the assertion that regresses to count=2 (resource_id-keying) or count=0 (branch removed) — a
fault-killing test of the column-level isolation, added at M1-rework (9009abb), not the earlier
resourceId-distinguishable version. head-tester independently verified the 9-block count in-source and
the shared-version commit is an ancestor of 0488cd7. DEV-2 lift rests on real green.

**#4 — Gate NO-regression. CONFIRMED live + unit.** `compliance-gate.service.spec` (30) +
`outreach-gate.e2e` (6 REAL, no mocks) + `pipeline-gate.e2e` (4) all green in CI. The ONLY code delta is
`append`→`appendWithMandate(…, ctx.mandateId)`; `evaluate()` runs the same four evaluators in the same
order, `allowed: blocks.length === 0` unchanged. LIVE (C-2): the non-bypassable compose→gate path fired
server-side (404 on nonexistent refs, 400 on malformed — no 500, no silent send). I independently
re-probed anon `POST /outreach` → 401 (session-gated BEFORE the gate body — the non-bypassable edge holds:
auth precedes the gate; no anon bypass). No regression.

**#5 — Non-blocking findings correctly classified.**
- **L1 (mandate_id post-insert mutation silent to verifyChain BY DESIGN):** correctly NON-blocking for
  this wave. `mandate_id` is filterable ATTRIBUTION METADATA, not a core tamper-evident invariant — the
  HMAC-covered core (who/what/when/order/content) is fully intact. The boundary is honestly documented in
  a DURABLE compliance doc (`command-center/dev/architecture/audit-mandate-attribution.md`), which names
  two existing compensating mutation defenses (INSERT/SELECT-only DB grant + BEFORE-UPDATE/DELETE trigger;
  nightly AuditIntegrityJob) AND an explicit auditor note that a separate reconciliation control is needed
  IF mandate-attribution integrity is ever elevated to a hard compliance requirement. This is disclosed
  trade-off, not a hidden compliance-gate bypass — the chain's integrity guarantee is unchanged and the
  additive column's non-coverage is stated, not silently assumed tamper-proof. For a wave whose scope is
  additive attribution metadata, the durable doc + named defenses are sufficient; elevating a blocking
  control here would be triage-noise-blindness against a spec-compliant deployment. Tracked as future M-
  hardening if the requirement is ever raised. NOT a blocker.
- **Live compose→gate→scoped-export WRITE smoke un-run in prod:** correctly NON-blocking. The WRITE path
  is proven by the C-1 REAL migrated-DB recordkeeping-gate e2e (9 tests, mandate_id isolation incl
  shared-version) at the deployed commit; the LIVE mandate-filter READ path is confirmed against the new
  0012 column (200, empty because all gate-evaluate rows predate 0012 → mandateId NULL). Assembling a live
  non-null write would inject a whole owned mandate chain into prod. Honestly stated as un-run — no green
  fabricated. The e2e is the authoritative proof; DEV-2's lift rests on it. Recommend a live smoke once
  the send path ships (future wave). NOT a blocker.
- **f5074df8 route drift** (`/compliance/queue`→`/compliance/oversight`): pre-adjudicated at P-4;
  deployed route correct. Resolved, no action.

**DEV-2 HARD-GATE — GENUINELY LIFTED (the wave's headline outcome).** wave-13 gated the mandate-scoped
export ("must not back a live regulator request until the e2e lands"). This wave: the real-DB e2e landed
+ ran GREEN 9/9 in CI at the deployed commit, the gate mandate-attribution shipped HASH-SAFE (source-
traced: mandate_id out of the HMAC preimage; live verifyChain {ok:true,310} intact), and the column-level
isolation is fault-killing-tested (test I). The scoped export can now truthfully back a live regulator
request per the wave-13 V-block directive. LIFT is well-founded, not a Done-Theater marker.

**Anti-pattern sweep — none fire.** No Done-Theater (proofs traced to live artifacts + deployed source,
not task markers). No False-Green Amnesia (verifyChain probed live over the real production chain; e2e ran
REAL against migrated DB). No Spec-vs-Deployed drift (jenny's semantic audit + my source trace agree on
mandate-only, evaluate-time, no over-capture). No Compliance-Gate-Bypass (gate allow/block untouched; anon
outreach 401 before the gate body — non-bypassable edge intact). No Audit-Chain-Truncation (additive
hash-excluded column, chain byte-identical). No Ghost-Green / Ephemeral-Fix (deployed SHA == CI SHA +
docs-only chore; journal fix committed at 0161e57, on-disk-confirmed at HEAD). No Infinite-Fast-Fix (loop
not entered; 0 blocking).

## Cascade
- **Stages that must re-run:** none (APPROVED).
- **Stages that stay untouched:** all V-1 / V-2 (both reviewers APPROVE; triage 0 blocking).
- **Next block:** L (Learn).

## Footer
```yaml
head_signoff:
  verdict: APPROVED
  stage: V-3
  reviewers:
    karen: APPROVE
    jenny: APPROVE
    v2_triage: "0 blocking / 0 fast-fix candidates"
  failed_checks: []
  rationale: >
    All five load-bearing proofs verified against deployed-state artifacts + deployed source, not
    inferred from green. #1 hash-chain: mandate_id structurally absent from HashableEntryFields +
    canonicalSerialization (zero 'mandate' refs in audit.hash.ts) and written to the DB column outside
    computeEntryHash in _appendCore (self-traced) + live verifyChain {ok:true,310} over the production
    chain after 0012, seq-309 hash byte-identical to the wave-13 tail. #2 deployed==CI SHA (0488cd7→
    5754fbf = 2 docs-only files under process/, /health re-probed == 5754fbf; journal idx 12 confirmed
    on-disk — Ghost-Green fixed). #3 recordkeeping-gate e2e 9/9 REAL at the deployed commit, test I is a
    fault-killing shared-template-version column-isolation assertion. #4 gate no-regression (append→
    appendWithMandate only; live 404/400 not 500/silent-send; anon outreach 401 before the gate body =
    non-bypassable). #5 L1 (mandate_id tamper silent by design) correctly non-blocking — durable doc +
    two named compensating defenses + auditor note; live-write-smoke correctly non-blocking (proven via
    C-1 real-DB e2e). DEV-2 hard-gate genuinely LIFTED — the scoped export is now trustworthy for a live
    regulator request.
  next_action: PROCEED_TO_L
verdict_complete: true
fast_fix_cycles: 0
rework_attempt_cap_remaining: 3
```
