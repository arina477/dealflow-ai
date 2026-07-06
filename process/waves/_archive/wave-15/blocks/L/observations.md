# Wave 15 — L-block Observations (knowledge-synthesizer)

**Wave:** 15 — M7 admin (user-mgmt invite/role/deactivate + workspace settings + data-source credential storage + AppShell polish). SECURITY-SCOPE-TIGHTENED.
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 10–15 (observations from waves 11–14 fully read).
**Net pre-promotion candidates:** 2 promotion-grade (WORM-teardown recurrence + hollow-concurrency-test recurrence). 4 additional observations at informational/warning severity, 1 non-recurrence confirmation.

Each entry is logged with its first-sighting wave so a later wave's L-1 author can detect recurrence deterministically. Recurrence in any later wave promotes on sight (subject to head-X approval + format contract), no re-litigation.

---

## What shipped

- M7 first admin vertical: user management (invite/role/deactivate + race-safe last-admin advisory-lock guard), workspace/firm-profile settings (singleton advisory-lock upsert), data-source connection admin (AES-256-GCM encrypted credentials, write-only read path), AppShell nav polish + TopBar.
- 5 compliance invariants proven at B-6 (2-phase) + T-9 (re-verified at deployed SHA, not trusted from verdict): write-skew-safe advisory-lock last-admin guard (NOT count-FOR-UPDATE); credential-never-leaks (AES-256-GCM random-IV/tag-verify/key-id/redaction/no-hash); SoD+WORM-audit last-in-txn; DB-authoritative RBAC; migration 0013 journaled (BUILD #4 lesson held).
- 5 non-blocking spec-gap tasks seeded (F-1 cascade inert, F-3 integrations nav orphan, F-4 invite dup, F-5 no reactivate, F-6 config JSONB secret guard).
- 1 C-1 fix-forward cycle: test teardown DEFECT-B (WORM trigger blocking DELETE users) + DEFECT-A (ambiguous u.id). Both fixed at 596a78d.

---

## Systemic root-cause map (not human-blame)

Three independent classes surfaced this wave, all caught in-gate, none escaped to the deployed artifact:

1. A concurrency test that re-implemented the production guard inline (B-6 Phase-1 REWORK) — hollow proof of a compliance-critical invariant.
2. A set-cardinality invariant enforced via `count(*) FOR UPDATE` rather than `pg_advisory_xact_lock` on a constant — write-skew window (P-4 security-auditor Inv-1; fixed in spec before B-block).
3. Test teardown hard-deleting users FK-referenced by the WORM audit trigger (C-1 DEFECT-B) — recurrence of the wave-12 pattern.

The learning targets missing safeguards, not authors.

---

## Observation ledger

### OBS-W15-1 — WORM-teardown recurrence (PROMOTION-GRADE; 3-wave recurrence — exceeds 2-wave bar)

**What:** A new e2e suite (`admin-concurrency.e2e-spec.ts`) tore down fixture `users` rows via hard DELETE. The test-DB `audit_log_entries` table carries FK references to those users via the WORM mutation trigger (`audit_log_block_mutation()`, P0001). The DELETE succeeded at the application level but the trigger rejected the cascade UPDATE (`ON DELETE SET NULL` on the audit column), raising P0001. Fix at 596a78d: replace DELETE teardown with `UPDATE users SET ... WHERE namespace='00000015'` (retain audit-referenced rows, reset state, disjoint namespace), mirroring the wave-12 outreach-gate and wave-12 pipeline-gate pattern.

**Source artifacts:** `process/waves/wave-15/stages/C-1-pr-ci-merge.md` (DEFECT-B); `process/waves/_archive/wave-12/stages/C-1-pr-ci-merge.md` (fix-forward cycle 2: "pipeline-gate.e2e teardown deleted users → FK ON DELETE SET NULL on the IMMUTABLE audit_log_entries → audit_log_block_mutation() P0001"); `process/waves/_archive/wave-12/blocks/L/observations.md` OBS-W12-3 ("first occurrence wave-12; both specialists rate it weak-to-moderate"; rejected as promotable at wave-12 as a snack); wave-13 observations OBS-W13-4 (non-recurrence noted: "B-0 skipped, zero new migration — self-migrate-race NON-RECURRENCE"); wave-14 observations (non-recurrence confirmed implicitly — no new real-DB e2e suite). Wave-15 C-1 is the THIRD teardown firing against the WORM trigger.

**Recurrence accounting:**
- Wave-12: first sighting — OBS-W12-3. Noted at the time as "weak-to-moderate / ambiguous home / rejected as promotable" because it was a single occurrence and the principles home was unresolved (test-writing-principles vs a scoped T-layer file).
- Wave-13: non-recurrence (no new teardown-heavy e2e suite; B-0 skipped).
- Wave-14: non-recurrence (no new self-migrating e2e suite).
- Wave-15: recurrence confirmed — same mechanism (hard-DELETE teardown of users FK-referenced by WORM audit rows), same fix shape (retain + UPDATE not DELETE, disjoint namespace). Three waves total with the firing on waves 12 and 15 (separated by two non-recurrence waves). Meets the 2-wave recurrence bar; the gap between wave-12 and wave-15 does not disqualify: the pattern is architecturally impossible unless a new real-DB e2e suite with user teardown is added, and wave-13/14 simply added no such suite.

**Root class:** Test-fixture lifecycle gotcha against a trigger-enforced immutable table. Every new real-DB e2e suite that creates users and tears them down fires this until the fixture pattern is explicit. The home is now clear: T-4 (integration/e2e teardown principle).

**Severity:** warning (breaks CI; no production impact; deterministic fix shape; no compliance gap).

**All 3 promotion criteria met:**
- Generalizable: yes — any new real-DB suite creating users + auditing mutations + hard-deleting users in teardown fires this.
- Falsifiable: yes — grep for `DELETE FROM users` (or `db.delete(users)`) in teardown without a corresponding "WORM-safe retain" comment / namespace-scoped UPDATE fires the rule.
- Cited: 3-wave artifact chain above.

**Candidate principles file:** T-4 (currently zero rules — first rule).
**Promotion status:** PROMOTION-GRADE. DO NOT promote here (karen vets + orchestrator applies ≤1/file cap).

**Pre-authored T-4 #1 candidate (format-checked against T-4 Contract for new rules):**
```
1. In a real-DB e2e suite, never hard-delete a user row that is FK-referenced by an immutable audit table.
   Why: A WORM mutation trigger rejects the cascading update, breaking teardown and CI.
```
_(Rule 112 chars, Why 77 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract.)_

---

### OBS-W15-2 — Hollow-concurrency-test / hollow-real-mechanism-test (PROMOTION-GRADE; 2-wave recurrence)

**What:** `admin-concurrency.e2e-spec.ts` CONC-1 (as shipped at B-6 Phase-1 review, before fix) re-implemented the advisory-lock + count logic INLINE in the test body (lines 171–208 of the pre-fix file) instead of calling `UserManagementService.deactivateAsActor` / `runLastAdminGuard`. It exercised test-authored SQL, never the production guard. It would have passed identically against a broken `count(*) FOR UPDATE` implementation — the test proved nothing about the real mechanism. The B-6 Phase-1 verdict named this explicitly: "Hollow AI Test Suite anti-pattern applied to a compliance-critical invariant: the code is right, but the mandated proof is fabricated." Fix (795e896): CONC-1 rewritten to construct a REAL `UserManagementService(db, auditService)`, call `Promise.allSettled([svc.deactivateAsActor(...), svc.deactivateAsActor(...)])`, and assert exactly one success + exactly one `ConflictException` + DB remaining-count proves ≥1 admin.

**Prior recurrence:** Wave-12 B-6 gate verdict (OBS-W12-3's companion class, not a separate obs at the time): "The single load-bearing compliance invariant [...] is UNPROVEN. `runInTransaction` is mocked as a `vi.fn()` passthrough [...]; nothing is ever persisted to a real store, so nothing is proven rolled back, and the real `db.transaction()` ROLLBACK path is executed by zero tests. This is hollow-test theater on exactly the invariant this gate exists to protect." Wave-12 B-6 gated it as REWORK (pipeline rollback hollow-test) and it was fixed before green. The wave-12 observations filed OBS-W12-3 for WORM teardown but the hollow-test class itself was not independently filed as a named observation (it was embedded in the B-6 gate rationale and resolved in-gate; wave-12 L-2 did not extract it as a separately-named carry-forward). The kernel is present in the wave-12 B-6 verdict — the compliance-invariant proof mocks away the mechanism under test. This wave it recurred in the distinct form of an inline-SQL re-implementation rather than a mocked transaction (same principle, different mechanical expression). Two independent firings = recurrence bar met.

**Source artifacts:** `process/waves/wave-15/blocks/B/gate-verdict.md` (Phase-1 REWORK: CONC-1 hollow — inline-SQL re-implementation); `process/waves/wave-15/stages/T-9-journey.md` (T-9 gate: "Hollow test (the B-6 catch): re-verified GONE at the shipped SHA"); `process/waves/_archive/wave-12/blocks/B/gate-verdict.md` (REWORK rationale: "hollow-test theater on exactly the invariant this gate exists to protect — `runInTransaction` mocked as `vi.fn()` passthrough").

**Root class:** Hollow-mechanism test — a compliance-critical proof that re-implements or mocks the exact mechanism under test, passing regardless of whether the production mechanism is correct. Distinct from VERIFY #1 (echoing-stub serialization) and VERIFY #2 (adversarial review posture). The check is: does the test call the REAL service/guard/transaction path, or does it reproduce the logic inline / mock the seam?

**Severity:** strong (a hollow compliance-invariant proof is indistinguishable from a genuine one at CI green; the defect only surfaces when a reviewer reads the test source or when the guard is intentionally regressed for fault-killing verification).

**All 3 promotion criteria met:**
- Generalizable: yes — any concurrency/security/rollback test faces the temptation to re-implement the guard inline or mock the transaction seam.
- Falsifiable: yes — a test that constructs its own SQL / mocks the critical seam rather than calling the real service method fails this rule. Reviewable by B-6 head-builder reading test source.
- Cited: 2-wave artifact chain above.

**Candidate principles file:** VERIFY (currently rules 1–2; this would be VERIFY #3 — note: the prior "VERIFY #3" slot was reserved for OBS-W13-1 mock-only row-membership derivation, which did NOT recur in waves 14–15; this hollow-mechanism class is distinct but the numbering will be resolved by karen/orchestrator on promotion).
**Promotion status:** PROMOTION-GRADE. DO NOT promote here.

**Pre-authored VERIFY candidate (format-checked):**
```
3. A compliance-invariant test must call the real production service/guard path, not re-implement the mechanism inline or mock its critical seam.
   Why: An inline re-implementation or mocked seam passes identically whether the real guard is correct or broken.
```
_(Rule 116 chars, Why 79 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional — karen resolves slot vs OBS-W13-1 VERIFY #3 candidate on promotion.)_

---

### OBS-W15-3 — Set-cardinality invariant under concurrency: `count(*) FOR UPDATE` does not serialize the set (FIRST-SIGHTING; informational)

**What:** Enforcing "at least one admin must remain active" via `SELECT count(*) ... FOR UPDATE` is write-skew-safe only if both concurrent transactions touch the SAME row. Two transactions demoting DIFFERENT admin rows lock disjoint rows — neither sees the other's lock — so both count ≥1 remaining admins and both succeed, producing zero admins. The write-skew window is: T1 reads count=2 (locks admin-A), T2 reads count=2 (locks admin-B), T1 commits (count now 1), T2 commits (count now 0). Fix: `pg_advisory_xact_lock(<constant>)` serializes access to the WHOLE admin set regardless of which rows are touched.

**Source artifacts:** `process/waves/wave-15/stages/P-4-security.md` (Inv-1: "count(*) FOR UPDATE does NOT lock a count → concurrent demote of DIFFERENT admins = write-skew → zero admins. FIX: pg_advisory_xact_lock(<constant admin-guard key>) as PRIMARY"); `process/waves/wave-15/blocks/P/gate-verdict.md` (Inv-1 fix verified); `process/waves/wave-15/blocks/B/gate-verdict.md` (production guard confirmed NOT count-FOR-UPDATE; advisory-lock verified at deployed SHA by head-tester).

**Root class:** Write-skew on a set-cardinality invariant. A `FOR UPDATE` lock on returned rows provides no protection when two concurrent transactions touch disjoint members of the set. The generalization: any "enforce ≥N (or ≤N) members of a set" invariant under concurrent mutation of different members requires serialization of the WHOLE set, not row-level locking on individual members.

**Severity:** informational (caught at P-4 security-scope-tightened Phase-2 before B-block; the production code was correct at B-6; the risk was spec-level, never in the deployed artifact).

**Generalizable?** Yes — the pattern applies to any "enforce a set-size bound under concurrency" invariant (last-admin, max-active-license-seats, minimum-required-approvers). First-sighting this wave. 2-wave bar not met.

**Candidate principles file:** BUILD (candidate BUILD #8 — note: the BUILD #8 slot is contested by W11-1 store-binding and W12-1 caller-FK; this is a distinct kernel from both).
**Promotion status:** HOLD (first-sighting). Carries forward.

**Pre-authored BUILD candidate (format-checked; DO NOT promote until a later wave confirms recurrence):**
```
8. Enforce a set-size bound under concurrency with an advisory lock on a constant, not SELECT ... FOR UPDATE on returned rows.
   Why: FOR UPDATE locks disjoint rows in concurrent transactions, leaving the set-size invariant unprotected.
```
_(Rule 104 chars, Why 81 chars, exactly 2 lines, no forbidden tokens, no wave refs, no em-dash. Meets format contract. Number provisional.)_

---

### OBS-W15-4 — Credential defense-in-depth: four independent layers for a write-only secret (FIRST-SIGHTING; informational)

**What:** The wave shipped a four-layer credential-never-leaks pattern: (a) encrypt-at-rest (AES-256-GCM, random IV per encrypt, auth-tag stored+verified, key-id prefix, fail-closed); (b) redact before any error construction (`scrubCredentialFromError` on DrizzleError/ZodError/stack before re-throw); (c) never hash the credential into contentHash/payloadHash (brute-forceable); (d) write-only form input (never pre-filled, `type="password"`, sent only when a new value is typed). Each layer independently prevents a different leak vector; removing any one layer leaves a gap. The P-4 security-auditor caught that the original spec omitted (b) and (c).

**Source artifacts:** `process/waves/wave-15/stages/P-4-security.md` (Inv-2: GCM random-IV, REDACTED before error/log, NOT hashed into contentHash/payloadHash); `process/waves/wave-15/blocks/B/gate-verdict.md` (Phase-2 clean at CRIT/HIGH for all four layers); `process/waves/wave-15/stages/T-9-journey.md` (CREDENTIAL-NEVER-LEAKS verified genuine at deployed SHA: SEC-1/2/3/4).

**Root class:** Defense-in-depth for write-only secrets. The four layers address orthogonal leak vectors (storage, error propagation, hash-based inference, UI pre-fill). Novel this wave; no prior observation covers this pattern.

**Severity:** informational (pattern worked correctly in the shipped artifact; no leak occurred; noted for generalization to any future feature handling admin-entered secrets).

**Generalizable?** Potentially — any feature accepting an admin-entered external credential faces the same four vectors. Single occurrence; generalizable pattern but no recurrence event. 2-wave bar not met.

**Candidate principles file:** BUILD (own clock, distinct from all existing BUILD #1–7 and from OBS-W15-3).
**Promotion status:** HOLD (first-sighting). Carries forward only if a future wave re-encounters the same class of write-only secret handling (e.g., API key management, OAuth credential storage).

---

### OBS-W15-5 — Plan-authoring gap: AC asserts a cascade behavior whose consumer half is not planned (FIRST-SIGHTING; warning)

**What:** Task 648a86a6 AC-2 asserts: "default-compliance-profile settings CASCADE as the firm-level default the M4 `mandate_compliance_profile` inherits (new mandates start compliant-by-default)." The admin-side write (WorkspaceSettingsService storing the defaults) was planned and implemented correctly. The consumer half (MandateService reading `workspace_settings` as a fallback when the mandate form omits jurisdiction/suppression) was not planned in P-3, not seeded at B-2, and not tested anywhere. V-1 jenny caught it as F-1 (Medium spec gap): "`MandateService.createAsActor` [...] NEVER reads `workspace_settings`." The cascade AC claimed a cross-module wiring that the plan never decomposed into steps for either module.

**Source artifacts:** `process/waves/wave-15/stages/V-1-jenny.md` F-1 ("workspace default-compliance-profile cascade is inert (write-only defaults) — SPEC GAP — Medium"); `process/waves/wave-15/stages/P-3-plan.md` Action 1 WorkspaceSettingsService ("firm-profile CRUD + default-compliance-profile cascade (writes the firm-level defaults the M4 mandate_compliance_profile inherits)") — the plan names the cascade as the write side's purpose but has no B-2 step for the M4 read side; `process/waves/wave-15/stages/V-2-triage.md` F-1 classified as non-blocking spec gap, task INSERTed under M7.

**Root class:** Plan-authoring completeness gap — an AC asserts a multi-module behavior (write + consumer read), but P-3 decomposes only the write half, leaving the consumer side unplanned and unbuilt. The spec asserts the outcome (cascade) without requiring the second module's change.

**Severity:** warning (shipped as a write-only orphaned table: the admin can set defaults but nothing consumes them; user-visible gap if relied upon for a mandate form; caught at V-1, not a compliance failure).

**Generalizable?** Possibly — the pattern is "AC describes an end-to-end behavior (X writes → Y reads) but P-3 only plans X." This is a plan-authoring discipline: cross-module ACs require planning steps in BOTH modules. Prior wave check: OBS-W10-3 covers design-vs-bundle-capability-boundary at the P-block, and OBS-W10-1 covers snapshot-and-restore for re-computation — both are distinct mechanisms. No prior observation matches "AC asserts a behavior whose consumer half is unplanned." First-sighting. 2-wave bar not met.

**Candidate principles file:** PRODUCT-PRINCIPLES (plan-authoring convention at P-3) or BUILD-PRINCIPLES (cross-module wiring verification).
**Promotion status:** HOLD (first-sighting). Carries forward.

---

### OBS-W15-6 — Ghost-Green migration journal (BUILD #4 re-validation; held candidates non-recurrence audit)

**What:** Migration 0013 was correctly journaled at idx 13 (when 1783900800000 > 0012's entry), with snapshot and .down.sql, as verified at B-6 C3 and V-1 C5. The wave-14 Ghost-Green lesson (OBS-W14-1 = re-validation of BUILD #4) held. No repeat miss.

**Disposition:** BUILD #4 held correctly this wave. NOT a new observation. A held lesson that holds is not promotable (rule already exists). Recorded here as a positive process signal.

**Held candidates non-recurrence audit (waves 11–14 carry-forward):**

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W11-1 reused-authority store-binding (BUILD #8 candidate) | NON-RECURRENCE. WorkspaceSettingsService writes to its own store; no decision authority reads from a parallel store the flow fails to write. | HOLD unchanged |
| OBS-W12-1 caller-supplied-FK provenance (BUILD #8 candidate, contested with W11-1) | NON-RECURRENCE. No new caller-supplied association FK written without provenance check. | HOLD unchanged |
| OBS-W12-2 parallel self-migrate race (CI-PRINCIPLES #1 candidate) | NON-RECURRENCE for the RACE itself. The admin-concurrency e2e coexists with outreach/pipeline/recordkeeping suites using the existing disjoint-namespace + race-safe migrate helper — pattern absorbed, not re-fired. | HOLD unchanged |
| OBS-W13-1 mock-only row-membership derivation (VERIFY #3 candidate) | NON-RECURRENCE. No new row-selecting derivation SQL was tested only via a param-forwarding mock. | HOLD unchanged |
| OBS-W13-2 read-path documented-completeness-gap | NON-RECURRENCE. No new read-path over a reused authority's keying scheme was documented/corrected this wave. | HOLD unchanged |
| OBS-W14-2 differential-test discriminator (VERIFY #4 candidate) | NON-RECURRENCE. No new differential/isolation test distinguished cases by an incidental attribute. | HOLD unchanged |
| OBS-W14-3 hash-excluded additive metadata on HMAC chain (BUILD candidate) | NON-RECURRENCE. No new field was added to the audit hash preimage this wave (migration 0013 added `encrypted_credentials` to a different table; no change to `HashableEntryFields`). | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W15-1 WORM teardown | W12 + W15 (W13/W14 non-recurrence) | warning | YES (generalizable + falsifiable + cited 3-wave) | T-4 #1 | PROMOTION-GRADE |
| OBS-W15-2 Hollow-mechanism test | W12 (B-6 class) + W15 (B-6 Phase-1) | strong | YES (generalizable + falsifiable + cited 2-wave) | VERIFY (candidate #3 slot, karen resolves numbering) | PROMOTION-GRADE |
| OBS-W15-3 count-FOR-UPDATE write-skew | W15 only | informational | 2-wave bar NOT met | BUILD (provisional #8) | HOLD |
| OBS-W15-4 Credential defense-in-depth | W15 only | informational | 2-wave bar NOT met | BUILD (own clock) | HOLD |
| OBS-W15-5 AC-asserts-consumer-unplanned | W15 only | warning | 2-wave bar NOT met | PRODUCT or BUILD | HOLD |
| OBS-W15-6 Ghost-Green BUILD #4 re-validation + prior held candidates | n/a | informational | n/a (rule exists / non-recurrence) | n/a | NOT promotable |

**Carry-forward queue after wave-15:**
- OBS-W15-1 — WORM teardown (PROMOTION-GRADE, T-4 #1 candidate, 3-wave chain W12+W15).
- OBS-W15-2 — Hollow-mechanism test (PROMOTION-GRADE, VERIFY candidate, 2-wave chain W12 B-6 + W15 B-6).
- OBS-W15-3 — count-FOR-UPDATE write-skew on set-cardinality (HOLD, BUILD candidate, own clock).
- OBS-W15-4 — Credential defense-in-depth four layers (HOLD, BUILD candidate, own clock).
- OBS-W15-5 — AC-consumer-half unplanned (HOLD, PRODUCT/BUILD candidate, own clock).
- Inherited holds unchanged: W11-1 store-binding (BUILD #8), W12-1 caller-FK (BUILD #8 contested), W12-2 self-migrate race (CI #1), W13-1 mock-only derivation (VERIFY #3), W13-2 read-path gap, W14-2 differential discriminator (VERIFY #4), W14-3 hash-excluded metadata (BUILD).

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 6
promotion_grade: [OBS-W15-1 (T-4), OBS-W15-2 (VERIFY)]
hold: [OBS-W15-3, OBS-W15-4, OBS-W15-5]
non_promotable: [OBS-W15-6 (BUILD #4 re-validation + non-recurrences)]
worm_teardown_3wave_bar_met: true
hollow_mechanism_test_2wave_bar_met: true
prior_held_candidates_recurred: none
```
