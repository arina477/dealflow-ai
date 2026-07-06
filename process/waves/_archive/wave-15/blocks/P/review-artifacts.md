# Wave 15 — P-block review artifacts
**Wave topic:** M7 Admin & settings (user-management + workspace/firm settings + data-source connection admin + AppShell nav polish)
**Block exit gate:** P-4
**Status:** gate-passed
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| P-0 | stages/P-0-frame.md | done | PROCEED (4-task admin vertical; constraints: race-safe last-admin + credential-never-logged + SoD/WORM-audit; security-scope-tightened) |
| P-1 | stages/P-1-decompose.md | done | PROCEED; multi-spec (4); design_gap_flag FALSE (admin mockups exist); constraints carried |
| P-2 | stages/P-2-spec.md | done | multi-spec (4 blocks) to 82ec8724 |
| P-3 | stages/P-3-plan.md | done | admin module + migration 0013 (journaled) + race-safe-last-admin + AES-GCM credential (self-gen key) + no-live-test |
| P-4 | gate-verdict.md | done | PASSED (security-scope-tightened, 2 Phase-2 iters; write-skew+audit-enum+credential-leak caught+fixed); design_gap_flag false → B |
## Context
- FIRST M7 wave (M7 Admin & settings promoted from todo at wave-14 N-3 via BOARD 7/7; M6→blocked on founder send-credential).
- Seed 82ec8724 (user-management admin: invite/assign-role/deactivate + last-admin guard + SoD + audited) + siblings 648a86a6 (workspace/firm-profile settings + default-compliance-profile cascade) + 41c017f7 (data-source connection admin UI + encrypted-at-rest credential form — NO live connection-test, buildable-without-credential) + d7f716b4 (AppShell polish: placeholder pages for role-nav items with unbuilt routes — carry-forward, replaces Team/Settings nav 404s).
- Buildable-without-credential (BOARD-confirmed; #141-seamed paths [DKIM/domain-verify/live-connection-test] deferred, NOT seeded).
- Spec-contract short-circuit: no-prior-spec → full P-1..P-3. Autonomous mode: automatic.
- TOUCHES AUTH/USER-CREATION (82ec8724 invite/role/deactivate) → security-scope-tightened likely at P-4.
