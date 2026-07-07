# Wave 22 — V-1 summary (test-fix wave)
Both reviewers APPROVE against the fix on main (c168d3a) + the CI-green proof.
## Karen — APPROVE, 0 findings
Fix on main; 12 audit reads all WHERE workspace_id=$1 (0 unscoped remain); CI 28850000460 @c168d3a success + outreach-activity-rls ran 9/9; NOT weakened (exact +1 / exact verb, no retry/skip); verifyChain untouched (hash-excluded).
## jenny — APPROVE, 5 MATCHES, 0 DRIFTS
Implements T-4 rule 2 (12 scoped, no symptom-patch); fault-killing preserved (exact +1 / exact-verb, narrowed population not falsifiability); one-suite test-only; consistent with M9 _TBD reliability-fix framing. Note: jenny read the STALE 39b3225 C-1-BLOCKED note — that infra block is RESOLVED (C-1 now PASS @7cd0843 after the founder-cleared CI resume). Next-wave: the wave-21 CI-authoritative policy owns flagging any OTHER unscoped-audit suites.
```yaml
karen_verdict: APPROVE
jenny_verdict: APPROVE
spec_drift_defects: 0
findings: []
note: "jenny's C-1-BLOCKED flag was stale (read 39b3225); C-1 is CI-verified PASS @7cd0843 post-resume"
```
