# Wave 29 stage completion

Seed: d573e7bf-30e8-4eb2-9bba-2b1588f69578 — "Build firm-admin Records view page + deal-activity list read API"
Bundled siblings:
  - 6f86b594-569c-43fa-87d2-4294833bf7c9 — "Add shared-Zod records-view / deal-activity list filter contract"
  - 770ab1c4-6e22-493c-9184-b63722b24d1b — "Author deterministic RLS-isolation + RBAC-deny tests for the Records read"
claimed_task_ids: [d573e7bf-30e8-4eb2-9bba-2b1588f69578, 6f86b594-569c-43fa-87d2-4294833bf7c9, 770ab1c4-6e22-493c-9184-b63722b24d1b]
Active milestone: 033f97e0-bc25-48dd-bb5a-b2f2be5b056a (M10 — Advanced compliance & recordkeeping, in_progress)

Wave theme: M10 records VIEW (light vertical 3 of 3) — READ-ONLY / WORM-preserving; firm admin browses + filters retained records (audit-log + deal/pipeline activity) in-app. Workspace-RLS-scoped (getDb/FORCE RLS), RBAC compliance/admin. No new migration expected (pure read over existing tables). UI wave (Records page). On ship: M10's 3 light verticals complete → M10 closes at wave-29 N-block, then M11 promotion (M11 has a BOARD-ratified blocking prerequisite task 2867d087 to handle in M11 decomposition).

PRODUCT:
- [ ] P-0 Frame (discover + reframe)
- [ ] P-1 Decompose
- [ ] P-2 Spec
- [ ] P-3 Plan
- [ ] P-4 Gate

DESIGN (skip block if non-UI wave):
- [ ] D-1 Brief
- [ ] D-2 Variants (with bounded iteration)
- [ ] D-3 Review & adopt

BUILD:
- [ ] B-0 Branch & schema
- [ ] B-1 Contracts
- [ ] B-2 Backend
- [ ] B-3 Frontend
- [ ] B-4 Wiring
- [ ] B-5 Verify
- [ ] B-6 Review

CI/CD:
- [ ] C-1 PR, CI & merge
- [ ] C-2 Deploy & verify (canary armed when real users > 1000)

TEST:
- [ ] T-1 Static
- [ ] T-2 Unit
- [ ] T-3 Contract
- [ ] T-4 Integration
- [ ] T-5 E2E
- [ ] T-6 Layout
- [ ] T-7 Perf
- [ ] T-8 Security
- [ ] T-9 Journey

VERIFY:
- [ ] V-1 Independent reviews (Karen + jenny, parallel)
- [ ] V-2 Triage
- [ ] V-3 Fast-fix loop (or close)

LEARN:
- [ ] L-1 Docs
- [ ] L-2 Distill

NEXT:
- [ ] N-1 Survey & triggers
- [ ] N-2 Seed
- [ ] N-3 Handoff
