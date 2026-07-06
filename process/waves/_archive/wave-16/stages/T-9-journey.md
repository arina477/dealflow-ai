# Wave 16 — T-9 Journey (gate + journey regen)
**Gate:** APPROVED (head-tester, security-scope-tightened). verdict → blocks/T/gate-verdict.md. next_action: PROCEED_TO_V.
## Journey delta (M7 admin-hardening, LIVE @d72d7cb)
- **/admin/activity** (NEW) — read-only admin-only recent-admin-actions view (actor/target/action/timestamp) over the immutable audit log; advisor 403/anon 401; opening writes 0 audit rows.
- **Admin nav section** — links /admin/{users,settings,integrations,activity}; server-gated (advisor doesn't see); /admin/integrations un-orphaned.
- **/admin/users** — + Reactivate action (deactivated users); UUID-validated; audited (user-reactivate).
- **Mandate create** — now inherits firm compliance defaults for unset fields (cascade; resolve-once-at-create).
- **/admin/integrations** — config typed-boundary (secret-shaped value → 400 uniform no-echo).
## Security-invariant coverage (PROVEN — CI real-DB + C-2 live)
race-safe-invite-dedup (advisory-lock, expired→reinvite) | compliance-cascade (inherits+no-retroactive+shape-round-trip) | admin-activity-read-only+no-secret+RBAC | config-no-echo-typed-boundary | reactivate-no-priv-esc+audited+uuid | audit-HMAC-chain-intact-after-user-reactivate (ok:true 324→328).
