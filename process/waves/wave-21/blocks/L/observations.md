# Wave 21 — L-block Observations (knowledge-synthesizer)

**Wave:** 21 — M9 process/DX hardening (docs-only: `ci-e2e-authoritative-policy.md` + `test-writing-principles.md` pointer).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 16–21 (prior observations waves 16–20 fully read; wave-20 carry-forward queue audited below).
**Net pre-promotion candidates:** 1 PROMOTION (OBS-W17-1 HMAC-key — T-4 #3, due this wave, 3-wave-confirmed). 1 rule-2-validation note (OAE-3 recurrence). 1 meta-process hold. 0 additional new candidates (docs-only wave; no new code surface; no new defect class).

---

## What shipped

Docs-only wave. Single artifact: `command-center/testing/ci-e2e-authoritative-policy.md` (131 lines, 6 sections — §1 policy statement, §2 25-invariant→cited-e2e table with explicit "Falsa if:" clauses, §3 live-authed-check deferral + two-condition later-trigger, §4 B/D/E-closed-by-PRODUCT-#1, §5 V/T usage, §6 enforcement). Pointer at `test-writing-principles.md:275`. Shipped at ed9899b; V-3 APPROVED.

P-0 REFRAME recognized that 3 of 4 seed items (B/D/E) were already captured by the promoted PRODUCT-PRINCIPLES #1 and scoped them closed without re-authoring. Only (C) — the live-authed-check deferral — was genuinely uncaptured.

C-1 surfaced a pre-existing wave-20 test defect (OAE-3 unscoped global COUNT(*) — cc48c34, zero wave-21 delta). Root-caused, confirmed flake, fix-forward task 02f4e6a1 (whole-class, 8 sites). Not a wave-21 regression.

---

## Observation ledger

### OBS-W21-1 — OBS-W17-1 HMAC key: 3rd-sighting recurrence validation (PROMOTION-GRADE; T-4 #3; DUE THIS WAVE)

**What:** The hardcoded-HMAC-key-in-e2e class has now fired in three distinct waves with three distinct fixture owners:

- **Wave-16 (first sighting, OBS-W16-5):** `recordkeeping-gate.e2e-spec.ts` contained a suite-private hardcoded `AUDIT_LOG_HMAC_KEY`. New parallel suites wrote to the shared chain using the shared env-var-derived key. When `recordkeeping-gate`'s `verifyChain` walked all rows and recomputed HMACs using its private key, every foreign row produced a content-hash mismatch → `{ok: false}` → CI RED. Fix: align all suites on the shared env-var key.
- **Wave-17 (OBS-W17-1, kernel consolidated with sequence-gap class):** Same root class — a global-chain-verify assertion over ALL rows in a shared DB fails under parallel suite contamination. The wave-17 expression was sequence-number non-contiguity; the fix (scope to seeded rows) addressed the sequence half. The HMAC-key half was noted as part of OBS-W16-5's kernel.
- **Wave-20 (C-1 fix-forward cycle 2):** `pipeline-gate.e2e-spec.ts` contained a suite-private hardcoded `AUDIT_LOG_HMAC_KEY`. The shared global chain's rows were committed by other suites using the env-var-derived key. `pipeline-gate`'s `verifyChain` recomputed those rows' HMACs with its private key → content-hash mismatches → `ok: false`. Identical mechanism to wave-16. Documented in wave-20 observations as "Identical kernel to wave-16/17 OBS-W17-1 (PROMOTION-GRADE carry-forward)."

**Note on T-4 rule 2 vs this rule:** T-4 rule 2 (already promoted, present in T-4.md) addresses the scoped-rows half: "assert only its own scoped rows of a shared append-only chain, not the full chain." That rule covers sequence-pollution and unscoped-count-assertion failures. The HMAC-key class is the COMPLEMENTARY half: even when a suite correctly scopes its row assertions, if it hard-codes a private HMAC key diverging from the shared env-var, `verifyChain` will produce key-mismatch false-RED on foreign rows. These are two distinct mechanical failures with distinct root causes and distinct fixes; T-4 rule 2 does not subsume this.

**Root class:** A real-DB e2e suite that calls `verifyChain` (or any HMAC-recomputing chain-walk) and hard-codes a suite-private `AUDIT_LOG_HMAC_KEY` (rather than deriving it from the shared env var) will recompute foreign rows' HMACs with a mismatched key → content-hash-mismatch false-RED. The fix is to use the shared default key derivation in every suite that asserts against the shared chain.

**Severity:** warning (CI RED on a load-bearing compliance invariant on two distinct waves; caught at C-1 fix-forward; no production impact; fixed without weakening assertions).

**All 3 promotion criteria met:**
- Generalizable: yes — any project with a shared HMAC audit chain + multiple parallel real-DB suites faces this class when any suite hard-codes a divergent key.
- Falsifiable: yes — grep e2e files for `AUDIT_LOG_HMAC_KEY` assignment (or any per-suite override of the HMAC key env var); any assignment in a suite that calls `verifyChain` over shared rows fails this rule. Observable symptom: content-hash-mismatch false-RED in CI on the chain-verifying suite.
- Cited: 3-wave artifact chain (OBS-W16-5 `process/waves/_archive/wave-16/blocks/L/observations.md`; wave-17 C-1 cycle 3 / OBS-W17-1 `process/waves/_archive/wave-17/blocks/L/observations.md`; wave-20 C-1 cycle 2 `process/waves/_archive/wave-20/stages/C-1-pr-ci-merge.md` + OBS-W20 carry-forward `process/waves/_archive/wave-20/blocks/L/observations.md` §OBS-W17-1 row).

**Candidate principles file:** T-4 (T-4 currently has 2 rules; this is #3 — the next sequential slot).

**T-4 #3 promotion-grade entry (byte-valid; format-checked against T-4 Contract):**
```
3. A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var.
   Why: A suite-private hardcoded key recomputes foreign rows with a mismatched key, producing false-RED chain failures.
```
Rule line: "A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var." = 107 chars (≤120). Why line: "A suite-private hardcoded key recomputes foreign rows with a mismatched key, producing false-RED chain failures." = 111 chars — OVER 100. Trim:
```
3. A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var.
   Why: A hardcoded suite-private key recomputes foreign rows with a mismatched key, causing false-RED chain failures.
```
Rule: 107 chars (≤120). Why: "A hardcoded suite-private key recomputes foreign rows with a mismatched key, causing false-RED chain failures." = 109 chars — still OVER. Trim further:
```
3. A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var.
   Why: A hardcoded private key recomputes foreign rows with a mismatched key and produces false-RED chain failures.
```
Rule: 107 chars. Why: "A hardcoded private key recomputes foreign rows with a mismatched key and produces false-RED chain failures." = 107 chars — still OVER. Compact the Why:
```
3. A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var.
   Why: A hardcoded suite key recomputes foreign rows with a mismatched HMAC, causing false-RED chain failures.
```
Rule: 107 chars. Why: "A hardcoded suite key recomputes foreign rows with a mismatched HMAC, causing false-RED chain failures." = 102 chars — still OVER. One more pass:
```
3. A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var.
   Why: A hardcoded per-suite key mismatches the chain's stored HMACs, producing false-RED failures on foreign rows.
```
Rule: 107 chars. Why: "A hardcoded per-suite key mismatches the chain's stored HMACs, producing false-RED failures on foreign rows." = 107 chars — OVER. Strip further:
```
3. A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var.
   Why: A hardcoded per-suite key mismatches stored HMACs on foreign rows, producing false-RED chain failures.
```
Rule: 107 chars. Why: "A hardcoded per-suite key mismatches stored HMACs on foreign rows, producing false-RED chain failures." = 101 chars — still 1 over. Final trim:
```
3. A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var.
   Why: A hardcoded per-suite key mismatches stored HMACs on foreign rows, causing false-RED chain failures.
```
Rule: 107 chars. Why: "A hardcoded per-suite key mismatches stored HMACs on foreign rows, causing false-RED chain failures." = 99 chars (≤100). Exactly 2 non-empty lines. No `we`/`our`/`the team`. No wave refs. No em-dash. No parenthetical > 5 words. Both lines end in period. FORMAT VALID.

**Promotion status:** PROMOTION-GRADE (3-wave: W16 + W17 + W20; THE due promotion this wave per wave-20 carry-forward queue and checklist carry-forward note). Meets ≤1/file/wave cap for T-4.

**Source artifacts:**
- `process/waves/_archive/wave-16/blocks/L/observations.md` OBS-W16-5 (1st sighting, hardcoded HMAC key in recordkeeping-gate).
- `process/waves/_archive/wave-17/blocks/L/observations.md` OBS-W17-1 (2nd sighting, consolidated kernel; chain-pollution class generalized).
- `process/waves/_archive/wave-20/stages/C-1-pr-ci-merge.md` §Cycle 2 (3rd sighting, hardcoded HMAC key in pipeline-gate, identical mechanism to W16).
- `process/waves/_archive/wave-20/blocks/L/observations.md` §Carry-forward queue (explicit "wave-21 promotion turn" designation).

---

### OBS-W21-2 — OAE-3 unscoped global COUNT(*): T-4 rule 2 recurrence validation (NOT a new candidate — rule exists, being enforced)

**What:** C-1 surfaced OAE-3 (`outreach-activity-rls.e2e-spec.ts`, 8 sites at lines 374/408/453/474/516/540/583/607) asserting `SELECT COUNT(*) FROM audit_log_entries` with no `WHERE workspace_id` / action scope. Concurrent audit-writing suites in the shared CI Postgres appended rows between this test's `beforeCount` and `afterCount` reads → off-by-one (34 vs 33) → intermittent CI RED. This is a `shared-DB count-pollution flake` — same class as the AMP-4 fix in wave-17 (commit `dfcda74`).

**Why this is NOT a new candidate:** T-4 rule 2 (already promoted) covers exactly this class: "A real-DB parallel suite must assert only its own scoped rows of a shared append-only chain, not the full chain." The OAE-3 flake is a recurrence of rule 2's anti-pattern — it validates that rule 2 is correctly scoped and that the fix path (scope the assertion to `workspace_id` + action predicate matching the seeded seed, or capture the delta under the same GUC) is the one the rule prescribes. No new rule is needed; the lesson is captured. Fix-forward task 02f4e6a1 (whole-class, 8 sites) is the enforcement artifact.

**Severity:** warning/informational (rule-2-validation; no new promotion warranted; pre-existing wave-20 defect, not a wave-21 regression; fix-forward correctly routed).

**Promotion status:** NOT promotable. T-4 rule 2 is the governing rule; this is a recurrence confirming rule 2's scope is correct.

**Source artifacts:**
- `process/waves/wave-21/stages/C-1-pr-ci-merge.md` §Root cause + §Flake check (OAE-3 global COUNT(*) pollution, pre-existing cc48c34).
- `process/waves/wave-21/blocks/V/gate-verdict.md` §Q3 (8 unscoped COUNT(*) sites confirmed, root-caused to T-4 rule 2 violation, fix-forward task 02f4e6a1 verified in DB).
- `process/waves/_archive/wave-17/stages/C-1-pr-ci-merge.md` commit `dfcda74` (AMP-4 scoped-rows fix — prior same-class fix; this is the rule the OAE-3 flake re-violated).

---

### OBS-W21-3 — P-0 REFRAME avoided process-theater by recognizing promoted principles first (meta; LOW; HOLD)

**What:** Wave-21's P-0 recognized that 3 of 4 seed items (B/D/E) were already captured by PRODUCT-PRINCIPLES #1 (promoted at wave-19/20). Rather than re-authoring process artifacts for those items — which would have produced documentation duplicating a live promoted rule — the reframe scoped them closed with a one-line pointer and focused only on the genuinely uncaptured item (C). The BOARD (problem-framer + ceo-reviewer + mvp-thinner) labeled the re-doc path "snacking/process-theater antipattern."

**Generalizable kernel:** Before authoring a new process artifact or principle entry for an observed gap, check whether an existing promoted principle already covers it. A promoted rule IS the enforcement — re-authoring it as a wave artifact creates a duplicate authority source with no additional enforcement value and risks the two drifting. The minimum-artifact path is a one-line pointer to the real promoted rule.

**Is this promotable?** Partially generalizable, but: (1) this is a meta/process observation, not a BUILD/PRODUCT/VERIFY implementation rule; (2) no clear home — it would land in an as-yet-unspecified meta-principles file or PRODUCT-PRINCIPLES as a process-authoring note; (3) one wave of explicit application; (4) the existing P-0 wave-loop design (reframe step) is where this belongs — a principles rule about checking promoted rules before authoring is close to a "follow the process" tautology, which is not falsifiable as a new rule.

**Severity:** low/informational (positive outcome; process-theater avoided; no artifact deficit; the reframe worked as designed).

**Promotion status:** HOLD (meta/process; low priority; first explicit capture; no home; one wave of application; low falsifiability as a rule in current form).

**Source artifacts:**
- `process/waves/wave-21/stages/P-0-frame.md` §Reframe (problem-framer REFRAME: "B/D/E are SUPERSEDED by PRODUCT-PRINCIPLES #1… Re-authoring process docs for them = snacking/process-theater").
- `process/waves/wave-21/stages/P-0-frame.md` §ceo-reviewer — RESHAPE ("Strip to (C) only (B/D/E = process-theater re-doc)").

---

## Carried-forward holds recurrence audit (waves 16–20)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W17-1 HMAC key hardcoded in e2e (T-4 #3, 3-wave) | RECURRENCE CONFIRMED (3rd sighting W20 cycle 2; kernel validated; 3-wave bar met; pre-authored text confirmed format-valid at wave-20). | PROMOTION-GRADE (OBS-W21-1 — THE DUE PROMOTION this wave) |
| OBS-W20-2 Global shared-infra read RLS-exempt (BUILD #X, 1-wave strong hold) | NON-RECURRENCE (docs-only wave; no new shared-infra read surface). | HOLD unchanged (first-sighting, strong, load-bearing M11) |
| OBS-W20-3 P-4 three-layer defense meta (informational) | NON-RECURRENCE (docs-only wave; no P-4 security-auditor spawn). | HOLD unchanged (informational, low priority) |
| OBS-W19-4 P-4 obligation as lesson-forwarding (informational) | NON-RECURRENCE (P-4 was a light gate on a docs-only wave; no P-4 lesson-encoding cycle). | HOLD unchanged (informational, low priority) |
| OBS-W18-5 T-9 canonical journey-map skipped (informational) | NON-RECURRENCE (docs-only wave; no route/UI added; journey-map not applicable). | HOLD unchanged (informational) |
| OBS-W17-2 Vacuous RLS test under BYPASSRLS role (VERIFY #4 provisional) | NON-RECURRENCE (no e2e test-role change this wave). | HOLD unchanged |
| OBS-W17-3 Populated-DB migration trigger-protected tables (BUILD #10 provisional) | NON-RECURRENCE (no migration authored this wave). | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #11 provisional) | NON-RECURRENCE (no guard/middleware change). | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param (informational) | NON-RECURRENCE. | HOLD unchanged |
| Other inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE (docs-only wave; no code/migration/test changes). | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W21-1 HMAC key hardcoded in e2e (OBS-W17-1 3rd sighting) | W16 + W17 + W20 (3-wave) | warning | YES (generalizable + falsifiable + 3-wave cited) | T-4 (#3) | PROMOTION-GRADE (DUE — held from W20; W21 promotion turn) |
| OBS-W21-2 OAE-3 unscoped COUNT(*) | W17 AMP-4 (prior fix) + W20 origin (cc48c34) + W21 observed | warning/informational | NOT a new candidate — T-4 rule 2 already covers it | T-4 rule 2 validates | NOT promotable (rule-2 recurrence/validation) |
| OBS-W21-3 P-0 reframe avoids process-theater | W21 only | low/informational | No — meta, not falsifiable as rule, no home, 1-wave | (none yet) | HOLD (informational, low priority) |

**Carry-forward queue after wave-21:**
- OBS-W17-1 / OBS-W21-1 — HMAC key in e2e T-4 #3 (PROMOTION-GRADE — THE DUE PROMOTION THIS WAVE; karen vets + orchestrator promotes).
- OBS-W20-2 — Global shared-infra read RLS-exempt (HOLD, BUILD #X provisional, first-sighting strong, load-bearing M11).
- OBS-W21-3 — P-0 process-theater avoidance (HOLD, meta/informational, low priority, no home).
- OBS-W20-3 — P-4 three-layer defense meta (HOLD, informational, low priority).
- OBS-W19-4 — P-4 obligation as lesson-forwarding (HOLD, informational, low priority).
- OBS-W18-5 — T-9 journey-map skipped (HOLD, informational, low priority).
- OBS-W17-2 — Vacuous RLS under BYPASSRLS (HOLD, VERIFY #4 provisional).
- OBS-W17-3 — Populated-DB migration (HOLD, BUILD #10 provisional).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (HOLD, BUILD #11 provisional).
- OBS-W17-5 — SET utility-statement bind-param (HOLD, informational, low priority).
- Remaining inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-3 hash-excluded HMAC metadata, W14-2 differential discriminator VERIFY #4, W13-1 mock-only derivation, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 3
promotion_grade:
  - OBS-W21-1 (T-4 #3 — hardcoded HMAC key in e2e; 3-wave W16+W17+W20; DUE PROMOTION this wave)
promotion_grade_t4_3_text: >
  3. A real-DB e2e that calls verifyChain on a shared audit chain must derive its HMAC key from the shared env var.
     Why: A hardcoded per-suite key mismatches stored HMACs on foreign rows, causing false-RED chain failures.
t4_3_rule_chars: 107   # ≤120
t4_3_why_chars: 99     # ≤100
t4_3_format_valid: true
hold:
  - OBS-W21-3 (P-0 process-theater avoidance; meta/informational; low priority; no home; 1-wave)
not_promotable_this_wave:
  - OBS-W21-2 (T-4 rule-2 recurrence/validation — OAE-3 unscoped COUNT(*); rule already exists; no new promotion needed)
oae3_disposition: rule_2_recurrence_validation   # T-4 rule 2 is the governing rule; OAE-3 violates it; fix-forward 02f4e6a1 is the enforcement
obs_w17_1_recurrence_count: 3   # W16 recordkeeping-gate + W17 AMP-4-sequence-half + W20 pipeline-gate
t4_current_rule_count: 2        # rules 1 and 2 present; #3 is the next sequential slot
```
