## Wave 38 stage completion

Seed: 7f4d150b-409f-4936-a09f-12fe46d5b90c — FIX: prod migrations do not auto-apply on deploy (migrate-on-boot broken; 0021 + rate_limit_hits un-applied)
Bundled siblings: (none — single-task bundle)
Claimed task ids: [7f4d150b-409f-4936-a09f-12fe46d5b90c]
Active milestone: 08d3053a-48fb-4562-a25b-6d99d40b0f62 (M7 — Admin & settings, in_progress)
wave_type: infra

> Execution note: wave-38 ran reactively during a prod-incident recovery (compaction landed
> mid-wave). Build + deploy done via specialist routing (deployment-engineer). Reconciliation of
> the delivered work is in stages/C-2-deploy-and-verify.md. Closing gates (V/L/N) run properly.

PRODUCT:
- [x] P-0 Frame (discover + reframe) — stages/P-0-frame.md
- [x] P-1 Decompose — single-task infra bundle (no design gap; wave_type=infra)
- [x] P-2 Spec — stages/P-2-spec.md (source of truth: task 7f4d150b description)
- [x] P-3 Plan — root-cause-then-fix (journal drift); see C-2 reconciliation
- [x] P-4 Gate — narrow infra fix; spec well-formed

DESIGN (skip block — non-UI infra wave):
- [~] D-1 Brief — SKIP (non-UI)
- [~] D-2 Variants — SKIP
- [~] D-3 Review & adopt — SKIP

BUILD:
- [x] B-0 Branch & schema — no schema change (migration journal metadata only)
- [x] B-1 Contracts — no contract change
- [x] B-2 Backend — 8b762bc (journal timestamps) + e79f944 (remove migrate-on-boot)
- [~] B-3 Frontend — SKIP (no frontend)
- [x] B-4 Wiring — preDeploy is the migration path
- [x] B-5 Verify — typecheck clean; api unit 1077 pass; nest build clean
- [x] B-6 Review — deployment-engineer local gate before redeploy

CI/CD:
- [x] C-1 PR, CI & merge — direct-push-to-main (e79f944)
- [x] C-2 Deploy & verify — deploy bd65486e SUCCESS; prod DB verified (rate_limit_hits + create_firm_workspace exist); health 200

TEST:
- [x] T-1 Static — tsc clean
- [x] T-2 Unit — api 1077 pass
- [~] T-3 Contract — SKIP (no contract surface change)
- [x] T-4 Integration — prod DB migration end-state queried directly (active)
- [~] T-5 E2E — SKIP (no new user-visible behavior; create-firm E2E'd wave-37)
- [~] T-6 Layout — SKIP (non-UI)
- [~] T-7 Perf — SKIP (not heavy)
- [~] T-8 Security — SKIP (no auth/rate-limit logic change)
- [x] T-9 Journey — no journey change

VERIFY:
- [x] V-1 Independent reviews (Karen APPROVE + jenny APPROVE, parallel)
- [x] V-2 Triage (0 blocking; F1→task 26710959, F2→noise)
- [x] V-3 Fast-fix loop (head-verifier APPROVED; empty queue, skipped Phase 2)

LEARN:
- [x] L-1 Docs — CHANGELOG [0.28.1] Fixed (migrations apply reliably on deploy); M7 stays in_progress (14 done / 3 open, no transition); README skip; stages/L-1-docs.md
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff
