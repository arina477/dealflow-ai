# Wave 4 — P-1 Decompose

## Maximum size rubric (split when over — OR logic)
| Measure | Threshold | Estimate | Trips? |
|---|---|---|---|
| Files touched | > 60 | ~40 (migration + Drizzle schema + grant/trigger; HMAC service; verifier + endpoint; compliance module wiring; compliance-settings screen + integrity view; shared audit contracts; tests) | No |
| New primitives | > 60 | ~15 (audit_log_entries table + grant + trigger + migration; AuditLog append service; chain verifier; verify endpoint; @Roles guard; compliance-settings page + integrity component; shared audit Zod) | No |
| Estimated net LOC | > 5,000 | ~2,600 (N-1 ~2,200 undercounted the compliance-critical TEST burden: append-only DB enforcement, tamper-detection, chain-integrity across N entries, key-version, RBAC endpoint, integration) | No |
| Stage-4 working set | > 350K | security.md + mockups + plan — under | No |

No maximum threshold trips → **no split**.

## Wave type
`claimed_task_ids.length == 4` → **multi-spec**.
- Seed ec1f279d — tamper-evident audit_log_entries table (append-only grant+trigger)
- Sibling a8b2b5a2 — HMAC-SHA256 hash-chained AuditLog append service
- Sibling e6a4cbfe — chain-integrity verifier + verification endpoint
- Sibling 031d79fc — compliance-settings screen with audit-log integrity view

## Minimum floor
Multi-spec floor: net LOC > 2,500 OR length ≥ 6. Estimated ~2,600 > 2,500 → **floor met** (the heavy compliance/security test coverage for a tamper-evident hash-chain genuinely exceeds 2500). **No merge** — the natural expansion (rules engine + pre-send gate) is DELIBERATELY deferred to a later M2 bundle (P-0 thin-slice guardrail); merging it in would over-scope.

## Verdict: **PROCEED** (multi-spec, no split, no merge)
- `claimed_task_ids: [ec1f279d…, a8b2b5a2…, e6a4cbfe…, 031d79fc…]`
- `floor_merge_attempt: 0`

## design_gap_flag: **false**
| Surface | Prior art |
|---|---|
| Compliance-settings + audit-log integrity view | design/compliance-settings.html (6 audit/integrity refs) + design/audit-log-export.html + DESIGN-SYSTEM |
| AppShell chrome (wraps the screen) | §10 (built wave 3, shared) |
No missing surfaces → **D-block SKIPS; next block B.**

## wave_type (T-block)
backend + ui + auth (audit log = compliance/security → T-8 Security MANDATORY; security-scope gate at P-4). Real UI (compliance-settings) → T-5 E2E + T-6 layout run.

```yaml
wave_type: multi-spec
verdict: PROCEED
claimed_task_ids: [ec1f279d-ea8a-44db-977b-cb6891972c1f, a8b2b5a2-18c5-46a3-a430-bb36e492500f, e6a4cbfe-121b-4fdc-8ae4-85db7e434378, 031d79fc-7513-4571-b0c9-8f43590fc9bf]
siblings_created: []
floor_merge_attempt: 0
design_gap_flag: false
missing_surfaces: []
t_block_wave_type: [backend, ui, auth]
```
