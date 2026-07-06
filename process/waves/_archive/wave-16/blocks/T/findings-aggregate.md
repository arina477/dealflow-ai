# Wave 16 — T-block findings aggregate (V-2 input)
| # | Severity | Stage | Description |
|---|---|---|---|
| 1 | LOW | B-6/review | advisory-lock hashtext 32-bit collision (throughput-only, not correctness; code-acknowledged) |
| 2 | INFO | B-6/review | admin-activity exposes monotonic sequenceNumber cursor to admins (accepted reviewed risk; admin-trusted) |
| 3 | INFO | ops | reactivate/deactivate/role sibling handlers still use raw params (pre-existing debt; only reactivate got UUID validation this wave) |
## Security substance — PROVEN:
- Race-safe invite dedup (advisory-lock, expired→reinvite correct): CI INVITE-CONC-1 REAL fault-killing.
- Compliance-default cascade (inherits + no-retroactive + shape round-trip both provenances): CI CASCADE-1/2/3a/3b + C-2 live.
- Admin-activity read-only (0 audit rows written) + no-secret/PII + RBAC admin-only: CI ACT-* + C-2 live (entriesChecked unchanged).
- Config typed-boundary no-echo (secret absent from 400): CI C-4 + C-2 live.
- Reactivate no-priv-esc (role_id preserved) + audited + UUID-validated: CI + C-2 live.
- Audit HMAC chain intact after new user-reactivate action: C-2 verifyChain ok:true (324->328).
findings_total: 3 (0 crit/high/med, 1 low, 2 info)
