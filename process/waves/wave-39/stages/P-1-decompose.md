# Wave 39 — P-1 Decompose

## Maximum size rubric (split when over)

| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | > 60 | ~18–25 (extend user-management.service.ts + admin-users.controller.ts + admin-users/activity UI + member-picker + confirm-modal component + shared audit/rbac + tests across layers) | no |
| New primitives | > 60 | ~6–9 (1–2 endpoints for transfer/self-demote, member-picker + confirm-modal + transfer/demote controls components, new audit event surfacing; NO new model/migration — reuses users table, role enum, hash-chain audit) | no |
| Estimated net LOC | > 5,000 | ~2,700 | no |
| Stage-4 working set | > 350K tokens | well under | no |

No maximum threshold trips.

## Wave type
`claimed_task_ids = [69cd8ce4, 9e37eeef]` → length 2 → **`wave_type: multi-spec`**.
(3ebd6610 full member-CRUD grid deferred at P-0 mvp-thin; not claimed.)

## Minimum floor (multi-spec: net LOC > 2,500 OR ≥ 6 specs)
Net LOC estimate ~2,700 — above the 2,500 multi-spec floor. Breakdown:
- Backend transfer (atomic promote-B+demote-A single-tx) + self-demote path + authz + last-admin-guard reuse + audit writes + tests: ~900
- Frontend member-picker (transfer target) + transfer/self-demote controls + confirm modal + API wiring + component tests: ~1,000
- Activity-view surfacing of new role-transfer/self-demote audit events (new row types over existing ActivityTable) + tests: ~350
- Cross-layer compliance tests (SoD/RBAC matrix, RLS, destructive-flow E2E, security): ~450

Floor met. `floor_merge_attempt: 0`.

## Verdict
**PROCEED** (max rubric clear; multi-spec floor met at ~2,700 net LOC; no split, no merge).

## design_gap_flag

```yaml
design_gap_flag: false
missing_surfaces: []
```

Rationale: every touched UI surface already has a mockup or design-system pattern —
- `admin-users` page: mockup `design/admin-users.html` + built `AdminUsersClient.tsx` (wave-37 grant-admin). Transfer/self-demote controls + transfer-target member-picker are additive controls composed from existing design-system primitives (select, buttons, badges) on this mocked page.
- Destructive-change **confirm modal**: fully specified by DESIGN-SYSTEM § Modal/Drawer (overlay zinc-950@50%, --radius-lg, --shadow-md, focus-trap, Esc closes, role="dialog" + aria-modal, return-focus). Warning copy/states are P-2/B-3 content, not a novel visual layout.
- Admin **activity view**: built `admin/activity` page + `ActivityTable.tsx`; new role-transfer/self-demote events are new row types in the existing table, no new layout.

No surface requires a design-exploration pass → D-block skips; next block = B. (If B-block surfaces a genuine mid-build design gap, design.md § "Mid-execution design-gap from B-block" recovery re-enters D for just that gap.)

```yaml
wave_type: multi-spec
verdict: PROCEED
floor_merge_attempt: 0
design_gap_flag: false
claimed_task_ids: [69cd8ce4-fb06-4b4a-ace9-1d3ffc828707, 9e37eeef-33fd-4f2b-bf2d-047f3bc1b3d0]
```
