# Wave 1 — P-1 Decompose

## Maximum size rubric (split when any trips — none did)
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | > 60 | ~35–40 (root config ×6; apps/api NestJS ×~10; apps/web Next.js ×~10; packages/shared ×4; db schema/migration/client ×5; tests ×~6; CI already exists) | no |
| New primitives | > 60 | ~8 (health module, drizzle client, shared package, initial schema, 1 migration, env Zod, seed entry stub, web health route) | no |
| Estimated net LOC | > 5,000 | ~2,000–2,800 (config-heavy scaffold + boilerplate + health round-trip + tests) | no |
| Stage-4 working set | > 350K tokens | small (scaffold plan + a few briefs) | no |

## Wave type
`claimed_task_ids.length == 1` (seed only, no siblings) → **wave_type: single-spec**

## Minimum size floor
- Applicable floor (single-spec): net LOC > 1,500.
- Estimate: ~2,000–2,800 net LOC (two apps + shared package + DB layer + health round-trip + test files; NestJS + Next.js 15 scaffolds are verbose). **Floor met.**

## Verdict
**PROCEED** (single-spec; max rubric clear, floor met). No split, no merge. Consistent with problem-framer's "one indivisible vertical slice — do not auto-split" and ceo-reviewer's HOLD-SCOPE.

- Sibling task IDs created: none.
- Bundled-in task IDs: none.

## design_gap_flag
```yaml
design_gap_flag: false
missing_surfaces: []
```
Rationale: this wave builds the walking skeleton only — no new *product* UI surface. The bare Next.js app carries at most a placeholder page (not a designed screen). All real product screens (dashboard, mandates, matches, etc.) are later M1+ bundles and already have approved mockups in `design/` + the DESIGN-SYSTEM.md AppShell contract (§10). → next block is **B** (D-block skipped this wave).

<!--
floor_merge_attempt: 0
-->
