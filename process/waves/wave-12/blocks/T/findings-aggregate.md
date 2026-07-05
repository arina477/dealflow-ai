# Wave 12 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | LOW | T-5 | Full interactive enroll→move→note→timeline journey not assembled live (no eligible source in prod; audit invariant proven by CI real-DB e2e @ deployed commit + UI unit-tested). |
| 2 | LOW | T-6 | Authed mobile/detail visual screenshots not captured (structure verified via authed HTML + component tests + pipeline.html mockup). |
| 3 | LOW | T-8 | Cookie-attr/session-rotation not freshly probed (auth backbone unchanged by wave-12). |
| 4 | MEDIUM | cross-wave | Deployed test-cred registry still empty + no eligible source in prod → full deployed-authed journey smokes rely on invite→signup + CI proofs. Carry-forward (same as wave-11 finding #1). |
## Compliance substance — PROVEN (not a gap):
- Audit-last-in-txn (audit-throw → real ROLLBACK → zero orphan): pipeline-gate.e2e 4/4 CI real-DB @ 989fae9.
- Idempotent enroll (DB partial-unique → 409): CI e2e + unit.
- Fixed-enum transition + append-only events + eligible-source guard + H-1 mandate-consistency: pipeline.spec 44 + /review-verified.
- RBAC (advisor/compliance split, pinned) + AC-STRIP (7 columns, no send/AI): C-2 deployed-authed + rbac.test.
findings_total: 4 (0 critical, 0 high, 1 medium, 3 low)
