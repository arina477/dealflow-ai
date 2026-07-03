# Wave 3 — P-1 Decompose

## Maximum size rubric (split when over — OR logic)
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | > 60 | ~35 (AppShell + Sidebar + TopBar + nav + base primitives; dashboard shell page; RolesGuard route-application across api controllers; web route-protection middleware/layout; role-nav config; tests) | No |
| New primitives | > 60 | ~20 (AppShell/Sidebar/TopBar/NavItem/Badge/Card components + dashboard shell + role-nav map + per-route @Roles decorations + web route guard) | No |
| Estimated net LOC | > 5,000 | ~2,800 (N-1 milestone-decomposer estimate) | No |
| Stage-4 working set | > 350K tokens | design §10 + mockups + plan + briefs — under | No |

No maximum threshold trips → **no split**.

## Wave type
`claimed_task_ids.length == 3` → **multi-spec**.
- Seed 1931b452 — shared AppShell chrome + role-aware dashboard shell
- Sibling 2ecc4a7b — enforce per-route RBAC (API + web)
- Sibling 2dc00409 — role-aware AppShell nav (4 roles)

## Minimum floor
Multi-spec floor: net LOC > 2,500 OR length ≥ 6. ~2,800 > 2,500 → **floor met**. No merge.

## Verdict: **PROCEED** (multi-spec, no split, no merge)
- `claimed_task_ids: [1931b452-c7d5-43a0-9657-7e7cd1728203, 2ecc4a7b-2972-4a95-a36b-44e7112dd54b, 2dc00409-7c01-43fc-8fc1-4438330de7fb]`
- `floor_merge_attempt: 0`

## design_gap_flag: **false**
UI surfaces this wave builds all have design coverage:
| Surface | Prior art |
|---|---|
| AppShell chrome (Sidebar+TopBar) | DESIGN-SYSTEM §10 (canonical chrome contract, 11 refs) |
| Dashboard shell / role-aware landing | design/dashboard.html + §10 |
| Nav items / base primitives (buttons/cards/badges/nav) | DESIGN-SYSTEM (zinc/emerald, 4px grid, lucide-react) |
| Authed pages the shell wraps | 21 authed-page mockups from onboarding |
No missing surfaces → **D-block SKIPS; next block B.**

## wave_type set (T-block)
ui + auth (RBAC enforcement is auth-adjacent → T-8 Security runs; security-scope gate at P-4) + backend. Real UI → T-5 E2E + T-6 layout run (Chrome now installed).

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [1931b452-c7d5-43a0-9657-7e7cd1728203, 2ecc4a7b-2972-4a95-a36b-44e7112dd54b, 2dc00409-7c01-43fc-8fc1-4438330de7fb]
siblings_created: []
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
t_block_wave_type: [ui, auth, backend]
```
