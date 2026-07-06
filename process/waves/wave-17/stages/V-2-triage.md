# Wave 17 — V-2 Triage
Both V-1 reviewers APPROVE (0 spec-drift, 0 fabricated claims) → **ZERO blocking**. Fast-fix queue EMPTY. No B re-entry.
## Non-blocking → 3 tasks INSERTed under M8 (GAP-1 handled; GAP-3/4/5 = ops/process notes, 1 task)
- **GAP-2 (Low→Med for H3):** write-path getWorkspaceId() ?? DEFAULT_WORKSPACE_ID in disclaimers.service.ts:125/213 + rules.service.ts:81 → INSERT default-workspace fallback. Inert for ONE firm; latent cross-firm mis-placement for H3 (background/unauth write with no GUC lands in pilot firm's workspace instead of failing closed). P-4 F1 warned against default-to-first on the resolve path; this is the WRITE path. → task (H3 hardening: replace with explicit deny/throw).
- **GAP-4 (Info):** make a populated-DB migration proof a STANDING AC for any future audit-table (WORM) migration (the C-2 empty-CI-vs-populated-prod lesson). → task (process/testing AC).
- **GAP-5 (Info):** the RLS connection-split (runtime dealflow_app / migrate owner) + coupled-rollback is an operational contract that emerged at C-2 — document it + make it an explicit deploy AC for future role-privilege migrations. → task (ops doc + deploy AC).
## Noise (suppressed): GAP-1 (RESET '' not NULL — already handled by the 0017 NULLIF cast, no action); GAP-3 (CI SET ROLE is semantically equivalent to a native non-superuser connection — the false-green guard is honored; a dedicated CI role is a nice-to-have, folded into GAP-5's process note).
## Fast-fix queue: [] | B re-entry: []
```yaml
findings_input_count: 7
findings_blocking: []
findings_non_blocking: [{id: GAP-2, milestone: M8}, {id: GAP-4, milestone: M8}, {id: GAP-5, milestone: M8}]
findings_noise: [GAP-1-handled-NULLIF, GAP-3-SET-ROLE-equivalent, T-block-2-info]
fast_fix_queue: []
b_block_re_entry_required: []
```
