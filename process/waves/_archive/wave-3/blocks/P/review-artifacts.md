# Wave 3 — P-block review artifacts

**Block:** P (Product)
**Wave topic:** AppShell chrome + role-aware dashboard shell + per-route RBAC enforcement + role-aware nav (M1 success-metric slice)
**Block exit gate:** P-4
**Status:** gate-passed

## Stage deliverables
| Stage | Deliverable file | Status | Notes |
|---|---|---|---|
| P-0 | process/waves/wave-3/stages/P-0-frame.md | done | PROCEED; no-prior-spec; allowlist-RBAC guardrail carried |
| P-1 | process/waves/wave-3/stages/P-1-decompose.md | done | PROCEED, multi-spec, design_gap_flag=false |
| P-2 | process/waves/wave-3/stages/P-2-spec.md | done | multi-spec contract in seed 1931b452 (3 blocks) |
| P-3 | process/waves/wave-3/stages/P-3-plan.md | done | approach (4 arch deltas: shared AppShell once / allowlist-safe RBAC / single role→routes+nav source / role from session claim) + file-level plan (19 steps across B-1/B-2/B-3/B-4); no schema, no new SDK; sweep clean |
| P-4 | process/waves/wave-3/blocks/P/gate-verdict.md | gate-passed | head-product APPROVED; karen+jenny APPROVE (jenny iter-2 after route+matrix remediation); Gemini 429; security-scope 2-iter |

## Block-specific context
- **Wave topic:** shared AppShell (Sidebar+TopBar per DESIGN-SYSTEM §10) + role-aware dashboard shell + ENFORCE per-route RBAC (API + web) using the guard primitive wave 2 built (not enforced then) + role-aware nav for the 4 roles. Completes M1's success metric ("invited user … lands on a role-aware dashboard shell").
- **Spec-contract short-circuit verdict:** no-prior-spec (seed is prose) → full P-1..P-3.
- **Roadmap milestone:** M1 (2c79236a…, in_progress, platform-foundation). wave.milestone_id backfilled. wave_db_id 57f2b2da-3ee2-4b4c-b2f7-92d29dd76bcb (wave_number 3).
- **claimed_task_ids (bundle):** [1931b452 (AppShell+dashboard seed), 2ecc4a7b (per-route RBAC), 2dc00409 (role-aware nav)] — set at P-1.
- **design_gap_flag:** unset — P-1 decides (dashboard.html + AppShell/Sidebar/TopBar in DESIGN-SYSTEM §10 exist; the ~20 authed-page mockups exist from onboarding — likely false).
- **Security-scope:** RBAC enforcement is auth-adjacent → security-scope tightened gate at P-4 + T-8 Security run this wave.
- **Autonomous mode active during P-block:** automatic

## Open escalations carried into gate
- Carried from wave 2: auth-hardening follow-up (task 6fe232e3) + wave-2 C-2 note; not this wave's scope.

## Gate verdict log
<appended by fresh head-product spawn at P-4 Action 1>
