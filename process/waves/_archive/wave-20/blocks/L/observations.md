# Wave 20 — L-block Observations (knowledge-synthesizer)

**Wave:** 20 — M9 outreach-activity tracker (first mutable M9 write surface: new tenant table + audit-logged CRUD service + shared-Zod contracts + RBAC API + /outreach panel).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 15–20 (prior observations waves 15–19 fully read; carry-forward queue from wave-19 audited below).
**Net pre-promotion candidates:** 1 PROMOTION-GRADE (BUILD #9 — e2e fixture vs real Postgres, 3-wave, DUE PROMOTION this wave). 1 strong new HOLD (readTail-RLS-exempt, first-sighting). 1 informational process note (P-4 three-layer defense meta). 0 new promotions executed here (karen vets; orchestrator promotes; ≤1/file/wave cap).

Each entry is logged with its first-sighting wave so a later wave's L-1 author can detect recurrence deterministically.

---

## What shipped

M9 first mutable write surface: `outreach_activity` table (channel/status distinct enums, workspace_id FORCE RLS FOR-ALL USING-only policy, 0-or-1 deal-target FK, createdBy, indexes) via additive migration 0018; `OutreachActivityService` + `OutreachActivityRepository` (all writes via `getDb(this.db)` under GUC; every mutation appends to M2 HMAC audit chain; table NOT WORM — stays updatable); shared-Zod contracts (`.strict()`, workspaceId+createdBy excluded, null-explicit); POST/GET/PATCH RBAC API (advisor+admin 200/403/401, fail-closed boot); /outreach create-form + my-open-touches list (design-system reuse). P-4 THREE-LAYER defense: problem-framer caught the spec's factually wrong "M8 copies USING→WITH CHECK" premise and the FOR-ALL-vs-FOR-SELECT distinction; head-product caught 4 write-path test-precision gaps (R1–R4: vacuous UPDATE test, FORCE-positive-control, FK-tenancy, per-verb audit); security-auditor caught HIGH latent leak SF1 (getWorkspaceId() ?? DEFAULT_WORKSPACE_ID INSERT fallback — silently places rows in pilot workspace). B-6 all-11-obligations verified (APPROVED attempt 1). C-1 5 fix-forward cycles cleared on cycle 5: cycle 0 drizzle journal trailing comma, cycle 1 readTail-RLS-filtered genesis-seq 23505 (REAL prod bug), cycle 2 hardcoded HMAC key in pipeline-gate e2e, cycles 3–4 workspace-isolation ISO-5 raw-INSERT poisoning WORM chain then wrong ALS context. Deployed + V-1 APPROVE + V-3 APPROVED.

---

## Systemic root-cause map (not human-blame)

Five independent defect classes surfaced in C-1; all caught in-gate, none escaped to the deployed artifact:

1. **Journal trailing comma** — `_journal.json` trailing comma → JSON.parse threw for ALL e2e → 100% suite failure on cycle 0. Root: a hand-authored journal entry introduced malformed JSON that static review does not catch; only real-DB e2e execution revealed it.

2. **readTail RLS-filtered under dealflow_app (REAL prod bug)** — `AuditRepository.readTail` executed a direct Drizzle select against `audit_log_entries` under the `dealflow_app` role. With FORCE RLS and no GUC set at the time of the read, the query returned 0 rows. Each workspace's FIRST ever audit write thus saw an empty tail, computed genesis seq=1, and collided on the global UNIQUE sequence constraint (SQLSTATE 23505). The fix routes `readTail` through `read_audit_chain_rls_exempt` (a SECURITY DEFINER function introduced in migration 0016), which walks the full global chain regardless of the current GUC. Root: the HMAC audit chain is a global shared-infra structure requiring a global view; per-tenant RLS is semantically incorrect for reads whose correctness depends on seeing ALL rows.

3. **Hardcoded HMAC key in pipeline-gate e2e** — `pipeline-gate.e2e-spec.ts` contained a suite-private hardcoded `AUDIT_LOG_HMAC_KEY`. The shared global chain's rows were committed by other suites with the env-var-derived key; when pipeline-gate's `verifyChain` recomputed those rows' HMACs with its private key, it produced content-hash mismatches → `ok:false`. Identical kernel to wave-16/17 OBS-W17-1 (PROMOTION-GRADE carry-forward).

4. **ISO-5 raw-INSERT poisoned the WORM chain** — `workspace-isolation` e2e ISO-5 inserted a fake-hash row via raw `INSERT INTO audit_log_entries` bypassing the HMAC-append service → WORM chain integrity broken (immutable rows with wrong hash).

5. **ISO-5 ALS context missing** — ISO-5's seed called `appendStandalone` without a `workspaceAls.run(WS_A)` wrapper → row landed in DEFAULT_WORKSPACE_ID; the subsequent UPDATE matched 0 rows → the WORM trigger never fired → chain poisoning silent.

The learning targets missing safeguards, not authors.

---

## Observation ledger

### OBS-W20-1 — E2e fixture/seed SQL not exercised against a real migrated DB: 3rd sighting of OBS-W18-4 / OBS-W19-2 (DUE PROMOTION; 3-wave; BUILD-PRINCIPLES #9)

**What:** Wave-20 C-1's 5 fix-forward cycles were dominated by fixture and seed SQL errors that static review could not detect — they were invisible until first execution against a real migrated Postgres DB with the runtime role. The specific defects:

- **Cycle 0 — journal trailing comma:** `_journal.json` with a malformed trailing comma in a hand-authored entry. JSON.parse threw at `readMigrationFiles` startup → ALL e2e suites failed immediately. A linter cannot parse Drizzle's journal schema constraints; only real-DB execution (`readMigrationFiles` → `JSON.parse`) surfaced it.
- **Cycle 2 — hardcoded HMAC key in pipeline-gate e2e:** `pipeline-gate.e2e-spec.ts` contained a suite-private hardcoded `AUDIT_LOG_HMAC_KEY`. The defect is invisible statically (the literal is valid TypeScript); it only fires at runtime when `verifyChain` recomputes foreign rows' HMACs with the wrong key.
- **Cycles 3–4 — ISO-5 raw-INSERT + wrong ALS context:** fixture SQL that bypassed the HMAC-append service (raw INSERT) and then ran without ALS context. Both are structurally valid TypeScript/SQL; only execution against the real schema with the actual runtime role exposes them.

**Recurrence accounting:**
- Wave-18 OBS-W18-4 (first-sighting, HOLD): analytics-isolation e2e seed had 4 schema-mismatch defects (wrong column name, missing NOT NULL, stale FK, partial-index collision) caught at C-1. Approved on static review only.
- Wave-19 OBS-W19-2 (second-sighting, PROMOTION-GRADE HELD): match-feedback-isolation e2e with mnemonic UUID literals (`mfi1`, `st-a`, `st-b`) rejected by `string_to_uuid` (SQLSTATE 22P02) → `beforeAll` throw → 7 tests SKIPPED. 2-wave bar met; rule pre-authored; wave-19 L-2 HELD due to the one-per-wave-per-file cap (PRODUCT-PRINCIPLES #1 was the W19 promotion).
- Wave-20 (this wave): 4 of 5 C-1 fix cycles were fixture/seed SQL defects invisible to static review. Different failure modes (JSON parse, HMAC-key mismatch, raw-INSERT path bypass, ALS context missing) — all share the same root: fixture/seed SQL not executed against a real migrated DB before B-6 approval.

**Mechanism comparison across all three waves:**
- Wave-18: column names, NOT NULL constraints, FK patterns, partial-index collisions.
- Wave-19: UUID type-casting (non-hex literals rejected by `string_to_uuid`).
- Wave-20: JSON parsing (journal), HMAC key derivation, bypass of append service, missing ALS context.

All four failure modes are invisible to static analysis. All surfaced only on first execution against the real runtime stack (migrated DB + runtime role + full service/repository path).

**Root class:** A real-DB e2e fixture (INSERT statements, seed functions, test-setup SQL, journal entries) authored and approved on static review alone — without executing it against a migrated, role-scoped test DB — accumulates defects invisible to static analysis. Every such defect manifests as a C-1 CI failure (or, in the worse case, silently-skipped suites if the fixture throws in `beforeAll`). The fix in all three waves was a fixture-only commit with no source, assertion, or security-invariant change.

**Severity:** warning-to-strong (wave-18: warning, 4 fix cycles; wave-19: warning, 1 fix cycle; wave-20: strong, 5 fix cycles with one a REAL prod bug surfaced via fixture exercise; all test-only fixes except cycle 1 which fixed a real prod audit-chain correctness defect). The production-bug aspect of cycle 1 is a SEPARATE observation (OBS-W20-2) — the root cause of that defect was an architectural correctness gap, not fixture SQL authoring.

**3-wave bar (supersedes 2-wave):** Wave-18 C-1 (4 schema-mismatch cycles) + wave-19 C-1 (1 UUID-literal cycle) + wave-20 C-1 (4 fixture/seed cycles of the 5). Different mechanism each wave; identical root class (fixture not exercised before C-1). 2-wave bar was already met at wave-19; this is the 3rd confirmation.

**All 3 promotion criteria confirmed (as per wave-19 OBS-W19-2 pre-authored analysis):**
- Generalizable: yes — applies to any new real-DB e2e fixture with UUID literals, FK references, column-name assumptions, journal entries, or service-call bypass paths.
- Falsifiable: yes — a B-6 APPROVED real-DB e2e fixture that was never executed locally against a migrated role-scoped DB before approval fails this rule. C-1 CI failure on a test-only commit is the observable symptom.
- Cited: 3-wave artifact chain (OBS-W18-4 + OBS-W19-2 + wave-20 `C-1-pr-ci-merge.md` §CI fix-up cycles 0/2/3/4).

**Candidate principles file:** BUILD-PRINCIPLES (#9 — BUILD currently has 8 rules; this is the next sequential slot; wave-19 confirmed the slot and pre-authored the text; OBS-W17-3 populated-migration and OBS-W17-4 pre-GUC SECURITY DEFINER renumber to #10 and #11 respectively).

**BUILD-PRINCIPLES #9 promotion-grade entry (pre-authored at wave-19, confirmed format-valid):**
```
9. Run any new real-DB e2e fixture against a migrated DB with the runtime role locally before B-6 approval.
   Why: Static review cannot detect non-hex UUID literals, wrong column names, or partial-index collisions.
```
Check: Rule = "Run any new real-DB e2e fixture against a migrated DB with the runtime role locally before B-6 approval." = 104 chars (≤120). Why = "Static review cannot detect non-hex UUID literals, wrong column names, or partial-index collisions." = 99 chars (≤100). Exactly 2 non-empty lines. No `we`/`our`/`the team`. No wave refs. No em-dash. No parenthetical > 5 words. Ends in period. FORMAT VALID.

Note: wave-20's additional failure modes (JSON trailing comma, HMAC-key mismatch, service bypass, ALS missing) all strengthen the Why's "static review cannot detect X" claim. The pre-authored text is sufficient; the Why's examples do not need to be exhaustive.

**Promotion status:** PROMOTION-GRADE (3-wave bar; the due promotion this wave — held from wave-19 by the one-per-file/wave cap when PRODUCT-PRINCIPLES #1 was promoted). This is THE promotion for wave-20.

**Source artifacts:**
- `process/waves/wave-20/stages/C-1-pr-ci-merge.md` §CI fix-up cycles (cycles 0, 2, 3, 4 — fixture/seed defects invisible to static review).
- `process/waves/_archive/wave-19/blocks/L/observations.md` OBS-W19-2 (2nd sighting, pre-authored rule text, HELD pending this wave).
- `process/waves/_archive/wave-18/blocks/L/observations.md` OBS-W18-4 (1st sighting, 4 schema-mismatch cycles).

---

### OBS-W20-2 — A global shared-structure read under per-tenant RLS must use an RLS-exempt path (NEW; strong; HOLD pending 2nd sighting)

**What:** C-1 fix-forward cycle 1 surfaced a REAL production correctness bug (not a test defect): `AuditRepository.readTail` was implemented as a direct Drizzle `select().from(auditLogEntries).orderBy(seq DESC).limit(1)`. Under the `dealflow_app` role with FORCE RLS, this read is filtered to the current workspace's GUC. At the time `readTail` is called (inside `AuditService.append`, before the new row is inserted), the GUC holds the current request's workspace. However, the HMAC audit chain is a SINGLE GLOBAL monotonic sequence — `sequence_number` is a global `GENERATED ALWAYS AS IDENTITY` unique across all workspaces, and the HMAC of each entry depends on the prior entry's hash regardless of workspace. The correct tail for computing the next entry's hash is the GLOBALLY MOST-RECENT entry, not the most-recent entry for the current workspace.

Consequence: the first-ever audit write for workspace W would see a workspace-filtered `readTail` returning 0 rows (no prior rows for W), compute genesis seq=1, and attempt to INSERT with sequence_number=1. But if any other workspace had already written seq=1, the UNIQUE constraint on sequence_number raises SQLSTATE 23505 (duplicate key). This would fire for every new workspace's first audit entry on a multi-tenant production system. The fix routes `readTail` through `read_audit_chain_rls_exempt` (a SECURITY DEFINER function installed by migration 0016 that returns the tail of the full chain regardless of GUC).

Verified as a genuine production-correctness bug: `git show 3cc58de:…/audit/audit.repository.ts` readTail body = direct Drizzle select (RLS-filtered); `git show 86ddc29:…/audit/audit.repository.ts` readTail body = `FROM read_audit_chain_rls_exempt(1, 9223372036854775807)` (global RLS-exempt). The deployed fix is in the production artifact at 86ddc29.

**Generalizable kernel:** A shared-infra data structure that maintains a global property (a hash chain's contiguity, a global counter's monotonicity, a global sequence's uniqueness) may have reads that are SEMANTICALLY INCORRECT under per-tenant RLS — not because the timing is wrong (as in OBS-W17-4's pre-GUC guard case) but because the correct behavior requires seeing ALL rows globally. When such a structure is accessed under per-tenant RLS, the read sees only the current tenant's rows, which may be a strict subset (or empty) of the data required for correctness. The fix is an RLS-exempt path scoped to the minimum fields needed (global tail only; not the full chain's content-projection, which should remain RLS-scoped).

**Distinction from OBS-W17-4 (pre-GUC guard reads):** OBS-W17-4's kernel is timing-driven — a read that fires BEFORE the request's GUC is set sees no rows because no workspace is active. The readTail defect fires DURING a request with a valid GUC set; the problem is not timing but semantic correctness: per-tenant filtering returns a wrong (incomplete) answer for a global-view operation. These are distinct kernel classes sharing the same fix pattern (SECURITY DEFINER RLS-exempt path) but different root causes.

**Is this 2-wave?** First clear sighting as a named observation. However, the `read_audit_chain_rls_exempt` function itself was introduced in wave-17 (migration 0016) to solve the chain-walk/verify case — so the SECURITY DEFINER pattern for global-chain access was established in wave-17. The wave-20 case is a new application surface (readTail for appending, not just verifying). Whether this counts as a 2nd data point or a first sighting with a 2-wave-adjacent precedent requires judgment: the kernel (global-chain read needs global view → RLS-exempt) was implicit in migration 0016 but not articulated as an L-2 observation. Treating this as a first sighting with a strong wave-17 precedent. 2-wave bar NOT formally met for a named L-2 observation; HOLD pending a distinct second application.

**Severity:** strong (a REAL multi-tenant production correctness bug, not a test defect; would have caused SQLSTATE 23505 on the first audit write per workspace in production; surfaced by the new write surface's CI e2e which exercised the first-per-workspace audit write path; flagged explicitly in T-9 gate verdict and V-2 triage as load-bearing for M11 multi-tenant).

**Catch stage analysis:** The defect was NOT caught at P-4 (spec review focused on the new outreach_activity write path, not the underlying audit-chain infrastructure). NOT caught at B-6 (the review verified the audit append mechanics at the service level; the repository's readTail RLS semantics were not explicitly audited). Caught by CI e2e at C-1 when the new write surface triggered a first-per-workspace audit write that the prior read-only waves never exercised. This is a valuable data point: a new mutable write surface can expose latent shared-infra defects that read-only waves leave dormant.

**Candidate principles file:** BUILD-PRINCIPLES (a new rule slot, not #9 which is claimed by OBS-W20-1; would be a new slot after the existing holds resolve — tentatively #12 or later depending on carry-forward ordering).

**Pre-authored BUILD candidate (format-checked; DO NOT promote until 2nd sighting):**
```
9. A read on a global shared-infra structure must use an RLS-exempt path when its correctness requires the full cross-tenant view.
   Why: Per-tenant RLS returns an incomplete subset, corrupting global properties like chain contiguity or monotonic sequence.
```
Check: Rule = "A read on a global shared-infra structure must use an RLS-exempt path when its correctness requires the full cross-tenant view." = 127 chars — OVER. Trim:
```
X. A global shared-infra read whose correctness requires all tenants' rows must use an RLS-exempt path.
   Why: Per-tenant RLS returns an incomplete subset, breaking global properties like chain contiguity or sequence integrity.
```
Check: Rule = "A global shared-infra read whose correctness requires all tenants' rows must use an RLS-exempt path." = 100 chars (≤120). Why = "Per-tenant RLS returns an incomplete subset, breaking global properties like chain contiguity or sequence integrity." = 115 chars — OVER. Trim:
```
X. A global shared-infra read whose correctness requires all tenants' rows must use an RLS-exempt path.
   Why: Per-tenant RLS returns an incomplete subset, breaking global properties like chain contiguity.
```
Check: Rule = 100 chars (≤120). Why = "Per-tenant RLS returns an incomplete subset, breaking global properties like chain contiguity." = 93 chars (≤100). Exactly 2 non-empty lines. No forbidden tokens. No wave refs. No em-dash. FORMAT VALID.

Note: number is X (to-be-assigned on promotion; must not claim BUILD #9 which is OBS-W20-1; will be assigned as the next available sequential number at promotion time).

**Promotion status:** HOLD (first-sighting as named observation; strong kernel; load-bearing for M11 multi-tenant; strong wave-17 implicit precedent; HOLD pending a 2nd distinct application in a subsequent wave).

**Source artifacts:**
- `process/waves/wave-20/stages/C-1-pr-ci-merge.md` §CI fix-up cycles cycle 1 ("audit append 23505 dup-key at seq=1: readTail RLS-filtered to workspace → empty tail → genesis collision (real prod bug)").
- `process/waves/wave-20/blocks/T/gate-verdict.md` §3 ("C-1 fix-forward #2 was a GENUINE bug-catch… readTail RLS-filtered under dealflow_app → empty tail → genesis seq=1 → 23505 collision… fix (readTail → RLS-exempt global tail) is sound because the HMAC chain is one global monotonic sequence; only the integrity WALK is RLS-exempt, LIST/EXPORT projection stays RLS-scoped").
- `process/waves/wave-20/stages/V-2-triage.md` §jenny gap 1 ("a shared-infra read used under RLS that needs the GLOBAL view must be RLS-exempt… Load-bearing for M11 multi-tenant").
- `process/waves/wave-20/blocks/V/gate-verdict.md` §2 (readTail fix verified in deployed artifact; `git show 86ddc29` body confirmed; `read_audit_chain_rls_exempt` GRANT EXECUTE exists in migration 0016).

---

### OBS-W20-3 — P-4 three-layer defense: each reviewer catches a progressively deeper defect (INFORMATIONAL; process meta; LOW PRIORITY)

**What:** Wave-20's P-4 used a three-reviewer stack (problem-framer → head-product → security-auditor) and each reviewer caught a defect in a domain orthogonal to the prior reviewer's catch:

- **problem-framer:** caught a FACTUAL PREMISE ERROR in the spec ("M8 copies USING→WITH CHECK" — no literal `WITH CHECK` exists in migrations 0014–0017; the correct behavior is derived from `FOR ALL` + USING-only). This is a structural/architectural correctness issue: if build had followed the spec literally and searched for `WITH CHECK` to copy, it would have authored a divergent policy that forked `outreach_activity` from the 28-table pattern. Not a test or security gap — a schema-authoring mistake.
- **head-product:** caught 4 write-path test-precision gaps (R1–R4): the naive "UPDATE with firm-B id" write-check was vacuous (the targeted row was already invisible → 0 rows affected → false-green against a FOR-SELECT regression), FORCE-positive-control was ENABLE-only (owner-bypass false-green class from wave-17), FK-tenancy was not specified for all 4 FK targets, per-verb audit assertions were insufficiently granular.
- **security-auditor:** caught SF1, a HIGH latent data-placement leak: `getWorkspaceId() ?? DEFAULT_WORKSPACE_ID` as the INSERT fallback would silently land rows in the pilot workspace when ALS context was absent, giving a false-success caller experience while corrupting tenant isolation.

**Pattern:** Each reviewer caught a defect the prior reviewer's frame would not have found: the framer was checking schema-correctness of the specification premises; head-product was checking test falsifiability; the security-auditor was checking runtime data-placement semantics. None of these defects would have been caught by the other reviewer's frame.

**Is this a generalizable principle?** Partially. The observation is: for a new write surface, independent reviewers with distinct adversarial frames (correctness, falsifiability, data-placement security) catch disjoint defect classes. This is evidence that multi-layer P-4 review adds non-redundant signal on write-surface waves. However:
- This is a PROCESS meta-observation, not a BUILD/PRODUCT/VERIFY implementation rule.
- It is not strongly falsifiable as a rule ("use multiple reviewers" is too broad; the spec already mandates head-product + karen + jenny ± security-auditor).
- One wave is not a meaningful statistical base for a principle about reviewer effectiveness.
- The existing security-scope rule (head-product caught → call security-auditor on write surfaces) is already operationalized in the P-4 gate.

**Verdict:** INFORMATIONAL. Low priority. The observation confirms the P-4 security-scope escalation trigger is correctly calibrated (a new write surface warranted security-auditor red-team; the security-auditor found a HIGH finding the other reviewers missed). Not promotable as a new rule in current form. If a future wave shows a write surface that skipped multi-layer P-4 review and shipped a data-placement leak that would have been caught by the security-auditor frame, this becomes evidence for a tighter scope rule.

**Severity:** low/informational (positive outcome — no defects escaped; all three layers contributed non-redundant catches; the P-4 gate's escalation trigger worked as designed).

**Promotion status:** HOLD (informational, process meta, low priority, no home yet).

**Source artifacts:**
- `process/waves/wave-20/stages/P-0-problem-framer.md` §FLAG ("the M8 policy copies USING→WITH CHECK is FACTUALLY WRONG — grep shows NO literal WITH CHECK in migrations 0014-0017").
- `process/waves/wave-20/blocks/P/gate-verdict.md` §Attempt 1 rework (R1–R4 head-product catches + SF1 security-auditor HIGH finding).
- `process/waves/wave-20/stages/P-2-spec.md` §P-4 corrections (R1 vacuous-test correction, R2 FORCE-positive-control, R3 FK-tenancy, R4 per-verb audit, SF1 no-DEFAULT_WORKSPACE_ID-fallback).

---

## Carried-forward holds recurrence audit (waves 15–19)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W19-2 / OBS-W18-4 E2e fixture vs real Postgres (BUILD #9 provisional) | RECURRENCE — see OBS-W20-1. 3rd wave (W18 schema-mismatches + W19 UUID literals + W20 journal/HMAC-key/service-bypass/ALS-missing). 3-wave bar met; DUE PROMOTION this wave. | PROMOTION-GRADE (3-wave) — THE due promotion |
| OBS-W19-1 Metric-honesty (PRODUCT-PRINCIPLES #1) | PROMOTED (wave-19/20 orchestrator window — PRODUCT-PRINCIPLES #1 now present in `command-center/principles/PRODUCT-PRINCIPLES.md`). | CLOSED — already promoted |
| OBS-W17-1 Cross-suite shared-DB chain pollution (T-4 #2, PROMOTION-GRADE carry-forward) | RECURRENCE confirmed (cycles 2/3/4 of C-1 hardcoded HMAC key + non-contiguous sequence — same kernel: global-chain assertion fails under parallel suite contamination). This wave's cycle 2 (hardcoded HMAC key in pipeline-gate e2e) is a direct recurrence of OBS-W16-5 / OBS-W17-1. The T-4 #2 carry-forward HOLD is now 3+ waves and remains PROMOTION-GRADE. However, this wave's due promotion is OBS-W20-1 (BUILD #9, held from W19). T-4 #2 should be the NEXT wave's promotion (wave-21). | PROMOTION-GRADE carry-forward — next wave |
| OBS-W17-2 Vacuous RLS test under BYPASSRLS role (VERIFY #4 provisional) | NON-RECURRENCE. e2e correctly uses `SET ROLE dealflow_app` (NOSUPERUSER/NOBYPASSRLS) throughout; R2 FORCE positive-control confirms `relforcerowsecurity=true`. Lesson applied, not defect. | HOLD unchanged |
| OBS-W17-3 Populated-DB migration trigger-protected tables (BUILD #10 provisional) | NON-RECURRENCE as a distinct defect class. Migration 0018 is additive-only (CREATE TABLE + 2 enums); no UPDATE/DELETE on trigger-protected table. The populated-DB test (GAP-4/OAM-2) ran and confirmed no collision. | HOLD unchanged (renumbers to #10 behind OBS-W20-1) |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #11 provisional) | NON-RECURRENCE of the strict OBS-W17-4 class (timing-driven: fires before GUC is set). OBS-W20-2 (readTail) is a DISTINCT kernel (semantic: fires DURING a request with GUC set, but needs global view). OBS-W17-4 unchanged. | HOLD unchanged (renumbers to #11 behind OBS-W17-3) |
| OBS-W17-5 SET utility-statement bind-param (BUILD, informational) | NON-RECURRENCE. No `SET <guc> = $1` usage; `SELECT set_config(...)` pattern used throughout. | HOLD unchanged |
| OBS-W19-4 P-4 obligation as lesson-forwarding (informational) | Wave-20 P-4 again encoded prior lessons (wave-17 FORCE-positive-control, wave-11 distinct enum names, wave-18 hollow-test, wave-17 populated-DB migration) as explicit named obligations. Pattern held. Still 1 wave of explicit encoding with measurable no-rework outcome at B-6. Not yet 2-wave recurrence as a defect. | HOLD unchanged (informational; low priority) |
| OBS-W18-5 T-9 canonical journey-map skipped (informational) | NON-RECURRENCE. journey_map_version updated (jenny V-3 gap-list includes no journey-map artifact gap for wave-20; V-2 "route-additive + journey updated" listed as MATCH). | HOLD unchanged (informational; non-recurrence this wave) |
| OBS-W16-2 No-echo on validation rejection (BUILD provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W16-6 Drizzle sql-cast JSONB bypass (BUILD provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W14-3 Hash-excluded HMAC additive metadata (BUILD provisional) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W14-2 Differential-test discriminator (VERIFY #4 provisional) | NON-RECURRENCE. AMP-4 fault-killing discriminator correctly scoped. | HOLD unchanged |
| OBS-W13-1 mock-only row-membership derivation (VERIFY new-slot) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W15-4 Credential defense-in-depth | NON-RECURRENCE. Credential-free boundary held. | HOLD unchanged |
| OBS-W15-5 AC-consumer-half unplanned | NON-RECURRENCE. | HOLD unchanged |
| OBS-W12-2 Parallel self-migrate race (CI candidate) | NON-RECURRENCE. | HOLD unchanged |
| OBS-W11-1 store-binding, OBS-W12-1 caller-FK | NON-RECURRENCE. | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W20-1 E2e fixture vs real Postgres | W18 (4 schema mismatches) + W19 (UUID literals) + W20 (journal/HMAC-key/service-bypass/ALS) | warning-to-strong | YES (3-wave; generalizable + falsifiable + multi-wave artifact chain) | BUILD-PRINCIPLES (#9) | PROMOTION-GRADE (DUE — held from W19) |
| OBS-W20-2 Global shared-infra read RLS-exempt | W20 only (strong wave-17 implicit precedent in migration 0016 pattern) | strong | 2-wave bar NOT formally met as named obs | BUILD-PRINCIPLES (X, slot TBD) | HOLD (first-sighting, strong; load-bearing for M11) |
| OBS-W20-3 P-4 three-layer defense meta | W20 only | low/informational | Not falsifiable as rule; meta/process | (no home yet) | HOLD (informational, low priority) |
| OBS-W17-1 Cross-suite shared-DB chain pollution | W16 + W17 + W20 (3rd confirmation) | warning | YES (pre-graded PROMOTION-GRADE; T-4 #2; pre-authored text in W17) | T-4 (#2) | PROMOTION-GRADE carry-forward → wave-21 (W20 slot taken by OBS-W20-1) |

**Carry-forward queue after wave-20:**
- OBS-W17-1 — Cross-suite shared-DB chain pollution (PROMOTION-GRADE carry-forward, T-4 #2; 3+ sightings W16+W17+W20; pre-authored text in wave-17 observations; NEXT WAVE's due promotion).
- OBS-W20-2 — Global shared-infra read RLS-exempt (HOLD, BUILD #X provisional, first-sighting strong, load-bearing for M11).
- OBS-W20-3 — P-4 three-layer defense meta (HOLD, informational, no home yet, low priority).
- OBS-W19-4 — P-4 obligation as lesson-forwarding (HOLD, informational, no home yet, low priority).
- OBS-W18-5 — T-9 canonical journey-map skipped (HOLD, informational, low priority, no home yet; non-recurrence this wave).
- OBS-W17-2 — Vacuous RLS test under BYPASSRLS (HOLD, VERIFY #4 provisional).
- OBS-W17-3 — Populated-DB migration trigger-protected tables (HOLD, BUILD #10 provisional).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (HOLD, BUILD #11 provisional).
- OBS-W17-5 — SET utility-statement bind-param (HOLD, informational, low priority).
- OBS-W14-3 — Hash-excluded HMAC additive metadata (HOLD; karen ruling pending).
- Inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-2 differential discriminator, W13-1 mock-only derivation, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 3
promotion_grade:
  - OBS-W20-1 (BUILD-PRINCIPLES #9 — e2e fixture vs real Postgres; 3-wave W18+W19+W20; DUE PROMOTION this wave)
promotion_grade_carry_forward:
  - OBS-W17-1 (T-4 #2 — cross-suite shared-DB chain pollution; 3+ sightings W16+W17+W20; wave-21 due promotion)
hold:
  - OBS-W20-2 (global shared-infra read RLS-exempt; strong; BUILD slot TBD; first-sighting; load-bearing M11)
  - OBS-W20-3 (P-4 three-layer defense meta; informational; low priority; no home yet)
not_promotable_this_wave: []
build_9_promotion_text: >
  9. Run any new real-DB e2e fixture against a migrated DB with the runtime role locally before B-6 approval.
     Why: Static review cannot detect non-hex UUID literals, wrong column names, or partial-index collisions.
build_9_wave_count: 3           # W18 schema-mismatches + W19 UUID literals + W20 journal/HMAC/bypass/ALS
obs_w17_1_recurrence_count: 3  # W16 HMAC-key + W17 sequence-noncontiguity + W20 cycle-2 hardcoded-HMAC-key
product_principles_1_confirmed_promoted: true   # OBS-W19-1 promoted; rule present in PRODUCT-PRINCIPLES.md
obs_w20_2_readtail_rls_exempt: first_sighting_strong  # global-chain read needs global view; M11 load-bearing
```
