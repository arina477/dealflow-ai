# Wave 3 — B-block review artifacts

**Block:** B (Build) · **Wave topic:** AppShell + role-aware dashboard shell + per-route RBAC + role-aware nav · **Block exit gate:** B-6 · **Status:** gate-passed

## Stage deliverables
| Stage | Deliverable | Status | Notes |
|---|---|---|---|
| B-0 | stages/B-0-branch-and-schema.md | done | branch wave-3-appshell-rbac; lucide-react; NO schema; 3 tasks claimed |
| B-1 | stages/B-1-contracts.md | done | rbac.ts single source of truth (75711f8); 92 tests; nav⊆RBAC by construction |
| B-2 | stages/B-2-backend.md | done | RBAC enforcement + compliance exemplar; per-role 403/200 tested (1cf4fba); rbac.ts biome→B-5 |
| B-3 | stages/B-3-frontend.md | done | AppShell once + dashboard at / + role-aware nav (144642f) |
| B-4 | stages/B-4-wiring.md | done | repo typecheck+build PASS; no drift |
| B-5 | stages/B-5-verify.md | done | lint 0-err(2 warn), 197 tests, build pass; smoke→C-2 |
| B-6 | stages/B-6-review.md | gate-passed | head-builder APPROVED; /review 2 CRIT fixed (5635c35); commit-discipline PASS |

## Block-specific context
- **Spec:** tasks row 1931b452 (multi-spec, 3 blocks + P-4 remediation addendum with the pinned role→route matrix). Branch wave-3-appshell-rbac.
- **claimed_task_ids:** [1931b452 (AppShell+dashboard), 2ecc4a7b (RBAC), 2dc00409 (nav)]
- **New deps:** lucide-react@1.23.0. **Schema:** NONE (no migration). **New env:** none.
- **Load-bearing invariants (P-4):** (1) RBAC allowlist — /auth/*+/health ungated, / AUTHED (unauth→/login), don't break live login; (2) single roleRoutes source (rbac.ts) drives nav + @Roles, nav⊆RBAC contract-tested; (3) role from server-verified session claim; (4) AppShell built ONCE via (app) route-group layout per §10; dashboard at / (canonical); login redirect → /.

## B-block execution notes carried from P-4
1. B-1: author rbac.ts roleRoutes FROM the pinned matrix (spec addendum) — do not improvise.
2. B-2/B-3: allowlist RBAC; dashboard at /; login→/.
3. T-9: reconcile journey map + add /compliance/summary.

## Gate verdict log
<appended by head-builder at B-6>

```yaml
build_block_status: complete
branch: wave-3-appshell-rbac
stages_run: [B-0,B-1,B-2,B-3,B-4,B-5,B-6]
review_verdict: APPROVE
last_commit_sha: 5635c35
ready_for_ci: true
```
