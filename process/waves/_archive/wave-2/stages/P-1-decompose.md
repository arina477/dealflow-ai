# Wave 2 — P-1 Decompose

## Maximum size rubric (split when over — OR logic)
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | > 60 | ~30–40 (SuperTokens config, NestJS auth module, 3 Drizzle tables + migration, ~6 API routes, guard, 3 Next pages, shared contracts, tests) | No |
| New primitives | > 60 | ~18–22 (3 models [users/roles/invites] + ~6 routes [signup/session/reset/invite-create/invite-accept/logout] + 2–3 services + 1 migration + 1 SDK [SuperTokens] + guard primitive + 3 pages) | No |
| Estimated net LOC | > 5,000 | ~3,200 (from N-1 milestone-decomposer estimate) | No |
| Stage-4 working set | > 350K tokens | SuperTokens SDK docs + NestJS + Next briefs + plan draft ≈ well under 350K | No |

No maximum threshold trips → **no split**.

## Wave type
`claimed_task_ids.length == 3` (seed + 2 siblings) → **`multi-spec`**.
- Seed `e15f71dd` — SuperTokens + user/role/invite data model
- Sibling `e1c0e81e` — auth API (signup / session / reset)
- Sibling `af6cbc59` — auth screens (login / accept-invite / reset)

## Minimum size floor
Multi-spec floor: net LOC > 2,500 **OR** length ≥ 6. Estimated ~3,200 LOC > 2,500 → **floor met** (length 3 < 6 but LOC satisfies the OR). No merge needed.

## Verdict: **PROCEED** (multi-spec, no split, no merge)
- `claimed_task_ids: [e15f71dd-8f61-441c-904a-bdfa108bd6e1, e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]`
- No siblings created or re-parented.
- `floor_merge_attempt: 0`

## design_gap_flag: **false**
All UI surfaces this wave touches already have canonical mockups + design-system coverage:
| Surface | Prior art |
|---|---|
| Login | `design/login.html` + DESIGN-SYSTEM § Auth pages |
| Accept-invite | `design/accept-invite.html` + § Auth pages |
| Reset-password | `design/reset-password.html` + § Auth pages |
| Form inputs/errors | DESIGN-SYSTEM § Input/Select/Textarea (radius, focus-ring, aria-invalid/describedby) |

No missing surfaces → **D-block skips; next block is B.** (The AppShell/dashboard-shell chrome is explicitly out of this bundle per N-1 — those land in a follow-up M1 bundle — so no authed-shell mockup is needed this wave.)

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [e15f71dd-8f61-441c-904a-bdfa108bd6e1, e1c0e81e-41b8-4b49-9d6c-8b1ed5c33e38, af6cbc59-ffcb-43ca-810d-4860d6e6bf64]
siblings_created: []
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
```
