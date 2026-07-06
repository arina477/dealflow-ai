# Wave 16 — V-1 summary
Both reviewers APPROVE against deployed d72d7cb.
## Karen (source-claim) — APPROVE, 8 confirmations, 0 REJECT
inviteAsActor uses pg_advisory_xact_lock; reactivateAsActor preserves role_id; validateConfigOrThrow uniform-static; admin-activity reuses AuditRepository (not forked); mandate cascade tx-scoped + no `sql` cast (post /review-fix); /health==d72d7cb; routes live + RBAC-gated (negative-control 404 proves 401s are real route hits); auditActionEnum user-reactivate appended at END (:234, Inv-6 honored); no un-journaled migration; audit chain ok:true; C-1 HMAC fix preserved verifyResult.ok (not weakened). Honest disclosure: 3 fully-authed runtime response-body assertions executed by C-2 (no prod admin creds in repo), source-corroborated by V-1.
## jenny (semantic-spec) — APPROVE, 0 drift / 3 gap
All 6 blocks match INTENT; P-4 rework faithfully implemented; deferral honest (M7 in_progress, #141 deferred). disclaimer_template is DERIVED from resolved jurisdiction (correct posture, not independently inherited — documented, not drift).
```yaml
karen_verdict: APPROVE
karen_findings_count: 8
jenny_verdict: APPROVE
jenny_findings_count: 3
spec_drift_count: 0
spec_gap_count: 3
findings: [G-1 hashtext-collision, G-2 seq-cursor-to-admin, G-3 fieldMapping-bounded-free-value]
```
