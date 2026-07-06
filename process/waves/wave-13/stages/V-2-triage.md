# Wave 13 — V-2 Triage
Inputs: T-block (3) + V-1 karen (1 MED) + jenny (1 gap + 1 directive). Both APPROVE. ZERO blocking findings.
## Classification
| Finding | Source | Class | Disposition |
|---|---|---|---|
| DEV-2: mandate-derivation SQL only unit-tested (mocked repo) — a real-SQL multi-producer capture bug wouldn't be caught | head-builder/head-tester/karen/jenny (MED) | non-blocking-with-directive | Full-chain export is the COMPLETE + proven-live path (regulator gets everything via full-chain/time-range); mandate-scoped is a convenience filter, /review structural-verified (8 branches, no-double-count, injection-safe) + C-2 live read/verify/export. Directive: add a recordkeeping mandate-derivation real-DB e2e (seed multi-producer audit rows under one mandate → assert scoped export captures ALL mandate-derivable producers + EXCLUDES gate-evaluate; reuse wave-12 race-safe shared migrate helper) BEFORE the scoped-export is relied on for a live regulator request. → HIGH-priority follow-on task (N-block seed candidate). NOT blocking this wave (all cardinal invariants proven live). |
| gate-evaluate not mandate-attributable (resource_type=outreach-template-version) | jenny (spec-GAP) | bug-spec/followon | Honestly documented (H1 fix, no overclaim). Producer-side fix (gate records outreach/mandate context) = the followon-gate-mandate-attribution.md note. Future M6/M10 bundle. |
| Deployed test-cred registry (invite→signup) | T (LOW) | noise | Carry-forward (waves 11/12). Suppress. |
## Result
- blocking_resolved: [] (0 crit/high; both APPROVE)
- non_blocking: [DEV-2 mandate-derivation-e2e (HIGH-priority follow-on task), gate-mandate-attribution (producer-side followon), ]
- fast_fix_candidates: [] → V-3 fast-fix SKIPS (DEV-2 is a >20-LOC real-DB e2e — beyond fast-fix scope; a follow-on task, per framework; Phase-1 head-verifier gate still runs + adjudicates the deferral)
```yaml
findings_blocking: 0
findings_non_blocking: 2
noise_suppressed: 1
fast_fix_in_scope: 0
dev2_disposition: high-priority-followon-task (mandate-derivation e2e) — non-blocking per full-chain-export-proven + all-cardinal-invariants-live; head-verifier adjudicates
```
