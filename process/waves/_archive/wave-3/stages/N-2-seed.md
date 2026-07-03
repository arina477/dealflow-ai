# N-2 — Seed (wave 3 → wave 4 bundle)

## Actions

- **Action 1 — seed pick:** oldest top-level `todo`/`wave_id IS NULL`/`parent_task_id IS NULL` under M2 = `ec1f279d-ea8a-44db-977b-cb6891972c1f` — "Stand up tamper-evident audit_log_entries table with INSERT-only enforcement".
- **Action 2 — siblings:** `WHERE parent_task_id = ec1f279d… AND status='todo' AND wave_id IS NULL` →
  - `a8b2b5a2-18c5-46a3-a430-bb36e492500f` — Implement HMAC-SHA256 hash-chained AuditLog append service
  - `e6a4cbfe-121b-4fdc-8ae4-85db7e434378` — Add chain-integrity verifier + verification endpoint
  - `031d79fc-7513-4571-b0c9-8f43590fc9bf` — Build compliance-settings screen with audit-log integrity view
- **Action 3 — validation:** all 4 rows re-confirmed against DB — `status=todo`, `wave_id=NULL`, `milestone_id=2f116b9b… (M2)`; seed `parent_task_id=NULL`; 3 siblings `parent_task_id=ec1f279d…`. PASS.
- **Action 5 — claimed_task_ids:** `[ec1f279d, a8b2b5a2, e6a4cbfe, 031d79fc]`.

## Bundle quality check (head-next N-2 gate)

- **Vertical slice:** DB migration (table + INSERT-only grant + BEFORE UPDATE/DELETE trigger) → service (HMAC-SHA256 hash-chain append) → API (integrity verifier + endpoint) → UI (compliance-settings integrity view). Spans DB, API, and UI — end-to-end, NOT a horizontal all-migrations bundle. PASS.
- **Coupling:** all four target the same modular-monolith component (the audit-log service); no arbitrary API↔worker jumps. Sequential dependency (service depends on table; verifier on service; UI on endpoint) is a within-slice build order, not a cross-wave deadlock. PASS.
- **Ghost dependencies:** none — builds on shipped M1 (auth/RBAC/AppShell/Drizzle pipeline live at 935b847); no open unmerged PRs. PASS.
- **Size:** est. ~2,200 net LOC, ~40 files, 1 seed + 3 siblings — within the size rubric, one ~4h logical session. PASS.
- **Data-destructive migration:** additive-only (new `audit_log_entries` table). Seed task carries INSERT-only grant + BEFORE UPDATE/DELETE trigger as the immutability mechanism (not a rollback concern — the table is append-only by design). Security-scope (audit log integrity) will route through T-8 + P-4 security gate in wave-4. PASS.
- **Customer-problem rank:** seeds M2's load-bearing compliance backbone — the defensible wedge — not an easy overhead tweak. PASS.

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: ec1f279d-ea8a-44db-977b-cb6891972c1f"
  - "bundled siblings: 3"
  - "validation: pass"
seed_task_id: ec1f279d-ea8a-44db-977b-cb6891972c1f
seed_task_title: "Stand up tamper-evident audit_log_entries table with INSERT-only enforcement"
bundled_sibling_ids:
  - a8b2b5a2-18c5-46a3-a430-bb36e492500f
  - e6a4cbfe-121b-4fdc-8ae4-85db7e434378
  - 031d79fc-7513-4571-b0c9-8f43590fc9bf
claimed_task_ids:
  - ec1f279d-ea8a-44db-977b-cb6891972c1f
  - a8b2b5a2-18c5-46a3-a430-bb36e492500f
  - e6a4cbfe-121b-4fdc-8ae4-85db7e434378
  - 031d79fc-7513-4571-b0c9-8f43590fc9bf
active_milestone_id: 2f116b9b-0338-421d-a9ad-899a11403aff
queue_exhausted: false
validation_failed: false
note: "M2 first bundle — tamper-evident audit-log vertical slice. Rules engine / suppression / disclaimers / pre-send check deferred to a later M2 bundle (depend on this audit log existing)."
```

## head_signoff

```yaml
head_signoff:
  verdict: APPROVED
  stage: N-2
  reviewers: {}
  failed_checks: []
  rationale: "Seed is the oldest unparented todo under the active milestone. Bundle is a genuine vertical slice (DB→service→API→UI) hitting one cohesive component (audit-log service), validated against the DB (all 4 rows correct status/wave/milestone/parentage). No horizontal-layer bundling, no ghost deps on unmerged PRs, no mutually-exclusive workflows mixed, within size rubric. The internal sequential dependency (table→service→verifier→UI) is a build order inside one wave with state verified between build steps, not a Dependency-Deadlock Bundling anti-pattern. Audit-log is M2's load-bearing dependency (rules engine + pre-send check require it) — correct first slice."
  next_action: PROCEED_TO_N-3
```
