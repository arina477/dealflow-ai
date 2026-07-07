# Wave 22 — L-block Observations (knowledge-synthesizer)

**Wave:** 22 — M9 audit-assertion test-hygiene fix (TEST-ONLY: 12 OAE-class COUNT assertions scoped by workspace_id per T-4 rule 2).
**Author:** knowledge-synthesizer (L-2 distill input).
**Cross-wave window:** waves 17–22 (prior observations waves 17–21 fully read; wave-21 carry-forward queue audited below).
**Net pre-promotion candidates:** 0 PROMOTIONS this wave (enforcement-only wave; no new kernel; no carry-forward due). 1 new meta/ops HOLD (GitHub Actions minutes exhaustion — first sighting). readTail-RLS-exempt hold unchanged (no second sighting). All other holds unchanged.

---

## What shipped

TEST-ONLY wave. Single file changed: `apps/api/test/outreach-activity-rls.e2e-spec.ts`. 12 audit-count assertions at OAE-9..12 sites (lines 374/409/456/478/522/547/592/617) rewritten from unscoped `SELECT COUNT(*) FROM audit_log_entries` to `SELECT COUNT(*) FROM audit_log_entries WHERE workspace_id = $1`. This is the whole-class enforcement of T-4 rule 2 (fix-forward task 02f4e6a1 opened at wave-21 L-2 and V-3). No product code, no migration, no app-bundle change. C-1 was interrupted by a GitHub Actions billing/minutes hard-stop (exhausted included minutes — all runs silently withheld; zero check-suites created on clean-message pushes). Founder cleared the block; CI re-fired green: run 28850000460, 5/5 jobs success @c168d3a, outreach-activity-rls suite 9 tests ran and passed in shared CI postgres on postgres:18. Fault-killing preserved (0 unscoped audit-count assertions in the live tree after this fix; exact-verb, no weakening). No fix-forward needed post-resume.

---

## Observation ledger

### OBS-W22-1 — OAE-3-class enforcement: T-4 rule 2 second-enforcement validation (NOT a new candidate)

**What:** This wave closed the fix-forward task (02f4e6a1) opened at wave-21 for the 12 unscoped `COUNT(*)` assertions in `outreach-activity-rls.e2e-spec.ts`. The fix is mechanically identical to the wave-17 AMP-4 fix and the wave-21 root-cause diagnosis: replace whole-table counts with workspace-scoped counts to eliminate concurrent-suite pollution.

**Why this is NOT a new candidate:** T-4 rule 2 is the governing rule. This is its second enforcement application (wave-17 first application: `AMP-4` in `outreach-milestone-progress.e2e-spec.ts`; wave-22: OAE-9..12 in `outreach-activity-rls.e2e-spec.ts`). The observation from wave-21 OBS-W21-2 already recorded this as a rule-2 recurrence/validation. No new kernel is present.

**Severity:** informational/positive (rule is doing its job; fix-forward was clean; CI green first try post-resume).

**Promotion status:** NOT promotable. T-4 rule 2 is the governing rule; this is a second enforcement confirming rule 2 is correctly scoped.

**Source artifacts:**
- `process/waves/wave-22/stages/B-2-backend.md` (scoped audit reads committed at 128ede8).
- `process/waves/wave-22/stages/C-1-pr-ci-merge.md` §Queryable green evidence (run 28850000460; 9 tests ran + passed; scoped assertions in live tree confirmed by grep).
- `process/waves/_archive/wave-21/blocks/L/observations.md` OBS-W21-2 (origin root-cause: OAE-3 unscoped global COUNT(*), T-4 rule 2 violation, fix-forward task 02f4e6a1).

---

### OBS-W22-2 — GitHub Actions included-minutes exhaustion silently withholds dispatch (NEW; meta/ops; HOLD)

**What:** During C-1, two successive pushes to `origin/main` were accepted by GitHub (push exit 0; `pushed_at` confirmed via API) but no check-suite was created for either. The workflow was active (`state: active`), the commit messages were clean (no `[skip ci]`), and the same actor+PAT had successfully fired a run earlier the same session (run `0d15f95a` at 06:02). The diagnostic signature — push accepted, workflow active, zero check-suites created — is the textbook symptom of exhausted included Actions minutes or a spending limit, which causes GitHub to silently withhold `push`-triggered dispatch. The PAT lacked billing-read scope (403 on `actions/permissions` and billing endpoints), so the condition could not be confirmed in-session. A founder-escalation was raised; the founder cleared the block (billing/spending resolved); dispatch was restored and the resume-probe push fired green on the first attempt.

**Generalizable kernel:** A long autonomous session that fires many CI runs (multiple waves, multiple attempts, retries) can exhaust a free-tier or capped GitHub Actions minutes budget within a single session. When that threshold is crossed, GitHub silently withholds workflow dispatch on new pushes — no error is returned, no workflow run is created, but the push itself succeeds. The infra signature (push accepted + workflow active + zero check-suites) is the detection path. Resolution requires an account-owner billing action (spending limit or wait for monthly reset); it cannot be self-healed.

**Is this a 2-wave observation?** First sighting as an explicitly named condition. No prior wave surfaced this symptom. HOLD pending a second distinct occurrence.

**Is this promotable?** Not yet. It is a meta/ops observation about CI infrastructure budget, not a code or test pattern. Candidate principle target would be CI-PRINCIPLES or a new ops-principles file (neither currently contains a rule about monitoring Actions-minutes budget in long autonomous sessions). One sighting; no home with a settled contract for new rules; the firing condition is account-specific (depends on plan tier and session length). Hold until a second sighting confirms the kernel is generalizable beyond this account/tier.

**Pre-authored candidate (format-checked; DO NOT promote until 2nd sighting):**
```
X. A long autonomous session must probe Actions dispatch (zero-check-suite sentinel) before treating a post-push CI silence as a transient delay.
   Why: Exhausted included minutes cause GitHub to silently withhold dispatch with no error on the accepted push.
```
Check: Rule = "A long autonomous session must probe Actions dispatch (zero-check-suite sentinel) before treating a post-push CI silence as a transient delay." = 147 chars — OVER. Trim:
```
X. After a push, confirm a check-suite was created before treating CI silence as a transient delay.
   Why: Exhausted Actions minutes cause GitHub to silently withhold dispatch; the push succeeds but no run fires.
```
Check: Rule = "After a push, confirm a check-suite was created before treating CI silence as a transient delay." = 96 chars (≤120). Why = "Exhausted Actions minutes cause GitHub to silently withhold dispatch; the push succeeds but no run fires." = 104 chars — OVER. Trim:
```
X. After a push, confirm a check-suite was created before treating CI silence as a transient delay.
   Why: Exhausted Actions minutes silently withhold dispatch; the push is accepted but zero runs fire.
```
Check: Rule = 96 chars (≤120). Why = "Exhausted Actions minutes silently withhold dispatch; the push is accepted but zero runs fire." = 93 chars (≤100). Exactly 2 non-empty lines. No forbidden tokens. No wave refs. No em-dash. FORMAT VALID.

Note: number is X (to-be-assigned on promotion; CI-PRINCIPLES currently has 2 rules).

**Severity:** warning/operational (caused a C-1 hard-stop and a founder-escalation; no code or test defect; no production impact; resolved in-session after founder action).

**Promotion status:** HOLD (first sighting; meta/ops; no prior named observation; 1-wave; no clear home yet; pre-authored text above is tentative pending a confirmed 2nd occurrence).

**Source artifacts:**
- `process/waves/wave-22/stages/C-1-pr-ci-merge.md` §Push attempt 2 / §Diagnosis (zero check-suites on two accepted pushes; workflow active; same actor; dispatch silently withheld).
- `process/session/updates/founder-decision-ci-actions-blocked.md` (founder-facing escalation: "account's monthly build minutes are used up or a spending limit was hit").
- `process/waves/wave-22/stages/C-1-pr-ci-merge.md` §RESOLUTION (founder cleared block; resume-probe c168d3a dispatched run 28850000460; conclusion=success).

---

## Carried-forward holds recurrence audit (waves 17–21)

| Held candidate | Status this wave | Action |
|---|---|---|
| OBS-W20-2 Global shared-infra read RLS-exempt (BUILD #X, 1-wave strong hold) | NON-RECURRENCE (test-only wave; no shared-infra read surface touched; no new service/repository code). | HOLD unchanged (first-sighting, strong, load-bearing M11) |
| OBS-W21-3 P-0 process-theater avoidance (meta/informational, HOLD) | NON-RECURRENCE (test-only wave; no P-0 reframe event of this type). | HOLD unchanged (informational, low priority) |
| OBS-W20-3 P-4 three-layer defense meta (informational) | NON-RECURRENCE (no new write surface; no P-4 security-auditor spawn). | HOLD unchanged (informational, low priority) |
| OBS-W19-4 P-4 obligation as lesson-forwarding (informational) | NON-RECURRENCE (test-only wave; no P-4 obligation-encoding cycle for a new surface). | HOLD unchanged (informational, low priority) |
| OBS-W18-5 T-9 canonical journey-map skipped (informational) | NON-RECURRENCE (test-only wave; no route or UI added; journey-map correctly not updated). | HOLD unchanged (informational) |
| OBS-W17-2 Vacuous RLS test under BYPASSRLS role (VERIFY #4 provisional) | NON-RECURRENCE (no e2e test-role change). | HOLD unchanged |
| OBS-W17-3 Populated-DB migration trigger-protected tables (BUILD #10 provisional) | NON-RECURRENCE (no migration). | HOLD unchanged |
| OBS-W17-4 Pre-GUC guard SECURITY DEFINER (BUILD #11 provisional) | NON-RECURRENCE (no guard/middleware change). | HOLD unchanged |
| OBS-W17-5 SET utility-statement bind-param (informational) | NON-RECURRENCE. | HOLD unchanged |
| Other inherited holds (W16-2/W16-6/W14-3/W14-2/W13-1/W15-4/W15-5/W12-2/W11-1/W12-1) | All NON-RECURRENCE (test-only wave). | HOLD unchanged |

---

## Promotion summary

| Obs | Sightings | Severity | All 3 promo criteria? | Candidate target | Verdict |
|---|---|---|---|---|---|
| OBS-W22-1 OAE-3-class T-4 rule 2 enforcement | W17 AMP-4 (prior fix) + W21 origin + W22 enforcement | informational | NOT a new candidate — T-4 rule 2 governs it | T-4 rule 2 validates | NOT promotable (enforcement/validation only) |
| OBS-W22-2 GitHub Actions minutes exhaustion | W22 only | warning/operational | 2-wave bar NOT met; meta/ops; no home | CI-PRINCIPLES (X, tentative) | HOLD (first sighting, meta/ops) |

**Carry-forward queue after wave-22:**
- OBS-W22-2 — GitHub Actions minutes exhaustion (HOLD, meta/ops, CI-PRINCIPLES X tentative, first-sighting; pre-authored text in OBS-W22-2 above).
- OBS-W20-2 — Global shared-infra read RLS-exempt (HOLD, BUILD #X provisional, first-sighting strong, load-bearing M11).
- OBS-W21-3 — P-0 process-theater avoidance (HOLD, meta/informational, low priority, no home).
- OBS-W20-3 — P-4 three-layer defense meta (HOLD, informational, low priority).
- OBS-W19-4 — P-4 obligation as lesson-forwarding (HOLD, informational, low priority).
- OBS-W18-5 — T-9 journey-map skipped (HOLD, informational, low priority).
- OBS-W17-2 — Vacuous RLS under BYPASSRLS (HOLD, VERIFY #4 provisional).
- OBS-W17-3 — Populated-DB migration trigger-protected tables (HOLD, BUILD #10 provisional).
- OBS-W17-4 — Pre-GUC guard SECURITY DEFINER (HOLD, BUILD #11 provisional).
- OBS-W17-5 — SET utility-statement bind-param (HOLD, informational).
- Remaining inherited holds unchanged: W16-2 no-echo, W16-6 Drizzle JSONB sql-cast, W14-3 hash-excluded HMAC metadata, W14-2 differential discriminator, W13-1 mock-only derivation, W15-4 credential defense-in-depth, W15-5 AC-consumer-half unplanned, W12-2 self-migrate race, W11-1 store-binding, W12-1 caller-FK.

---

## Footer

```yaml
l_stage_input: complete
observations_emitted: 2
promotion_grade: []     # no promotion this wave — enforcement-only wave; no new kernel
not_promotable_this_wave:
  - OBS-W22-1 (T-4 rule 2 enforcement/validation — OAE-3-class scoped COUNT; rule already promoted W17; no new rule)
hold:
  - OBS-W22-2 (GitHub Actions minutes exhaustion; meta/ops; CI-PRINCIPLES X tentative; first-sighting; 1-wave)
oae_class_disposition: rule_2_enforcement_second_application   # T-4 rule 2: first application AMP-4 W17; second OAE-9..12 W22
readtail_rls_exempt_hold: unchanged   # OBS-W20-2; no 2nd sighting; still 1-wave strong hold
t4_rule_count_current: 3              # rules 1, 2, 3 all present; rule 3 promoted at W21
actions_minutes_exhaustion_sightings: 1   # W22 only; HOLD pending 2nd distinct occurrence
```
