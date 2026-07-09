# Wave 37 — L-1 Docs

**Feature shipped:** self-serve firm setup UI (create workspace + name firm + first admin) + admin grant-admin from the UI. Delivered, deployed, E2E-verified live (create-firm E2E, workspace isolation, grant-admin 200/403). Milestone M7 (Admin & settings), Horizon H1.

## Action 1 — CHANGELOG entry

Appended `## [0.28.0] — 2026-07-09 — Set up your own firm and manage admins, all in the app (M7)` to `CHANGELOG.md` (top of file, above 0.27.0). User-facing: a firm can self-provision its workspace, set up its first admin, and promote a teammate to admin from the UI. Sections used: **Added** (self-serve setup flow + grant-admin control), **Correctness / compliance** (per-firm workspace isolation + admin-only role change), **Provenance** (no email, no AI, audit log untouched). Terse house-style matched (headline paragraph + ≤5 bullets across sections). Preventive security (server-minted unsteerable workspace_id, atomic+compensate) stays in Added/Correctness, not a Security section — nothing shipped-then-patched this wave.

## Action 2 — Milestone delta (M7 — Admin & settings)

- Milestone: `08d3053a-48fb-4562-a25b-6d99d40b0f62` — M7 Admin & settings, `in_progress`.
- Child-task state after L-2 marks this wave's seed done: 12 done + 4 cancelled + 4 open (todo). `open_count = 4 > 0` → **M7 stays `in_progress`; NOT transitioned to done.** Mechanical, no judgment ambiguity → no mode escalation.
- Remaining M7 open items (4): `FIX: prod migrations do not auto-apply on deploy (0021 + rate_limit_hits)` (follow-up task 7f4d150b), `Admin role transfer/demote-self + role-sharing`, `Full member-management CRUD UI`, `Onboarding polish: create-firm wizard + logo/branding`.
- 4 open ≥ brain fallback threshold (3) → **no `backlog-stockout` flag** for N-1.
- **M7 success metric — NOT YET MET.** Metric: "An admin can connect a data source, invite users and assign roles, and verify a sending domain so the firm can send compliant outreach." Connect a source (M9 Twenty, live) ✔; invite users + assign roles (grant-admin this wave + prior invite) ✔; **verify a sending domain (DKIM/SPF/DMARC) — NOT evidenced as delivered** ✘. Sending-domain verification is the outstanding metric-completing capability. Recorded for N.

## Action 3 — README touchups

Skipped. The user-facing surface is an in-app flow (sign-in link → create-firm), not a CLI command, env var, install step, or breaking change. CHANGELOG carries the detail; no README section warrants a surgical edit.

## Action 4 — Commit

FS touchups (CHANGELOG) committed by the orchestrator per L-1 Action 4 default (`docs: L-1 wave-37 closeout`). Milestone stayed in_progress (no DB status write needed this stage; no product-decisions transition entry, since no milestone transitioned).

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md: 0.28.0 entry appended above 0.27.0 (M7 self-serve firm setup + grant-admin)"
  - "milestone M7 (08d3053a-48fb-4562-a25b-6d99d40b0f62): evaluated, stays in_progress (open_count=4)"
  - "README.md: not touched (in-app flow, no CLI/env/install/breaking change)"
changelog_entry_added: true
roadmap_milestones_progressed: []       # M7 evaluated but not transitioned (4 open tasks remain)
roadmap_skip_reason: "M7 stays in_progress: 4 open tasks; success metric not yet met (sending-domain verification outstanding)"
readme_sections_touched: []
note: "M7 success metric outstanding piece = sending-domain DKIM/SPF/DMARC verification. Follow-up 7f4d150b (migrate-on-boot) is an open M7 task. No backlog-stockout (4 open >= 3)."

head_signoff:
  verdict: APPROVED
  stage: L-1
  reviewers: {}
  failed_checks: []
  rationale: >
    CHANGELOG 0.28.0 is user-facing, outcome-first, terse, and honestly scoped to what shipped
    (self-serve setup + grant-admin + per-firm isolation), with correct provenance (no email, no AI,
    audit log untouched). Milestone delta is mechanical and correct: M7 stays in_progress on 4 open
    tasks, no false "done", and the success metric is honestly marked NOT-met (sending-domain
    verification still owed) rather than rounded up. README skip is justified. No Observation-Theater:
    every claim traces to the deployed-state E2E in TV-closeout / C verify, not to green tests.
  next_action: PROCEED_TO_N
```
