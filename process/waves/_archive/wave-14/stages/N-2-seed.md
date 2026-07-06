# N-2 — Seed (wave-14 → seeds wave-15)

## Action 1 — Seed pick
Active milestone M7 (08d3053a). Candidates (parent_task_id IS NULL, wave_id IS NULL, status='todo'): `82ec8724` (user-mgmt admin vertical, decomposer-authored this wave) + `bfadcec1` (test-fixture typing debt — cosmetic, its own note defers to a testing-infra wave). LLM re-ordered per N-2 Action 1 ("prefer whichever the milestone scope needs next"): picked `82ec8724` — M7's core admin feature vertical / Leverage work — over `bfadcec1` (Overhead; picking it would be the Placebo Productivity Trap). `bfadcec1` intentionally left as future/testing-infra debt.

**seed_task_id:** `82ec8724-3f9e-45bd-8e81-e4e3fab8872d`
**seed_task_title:** "Build user-management admin vertical: invite, assign-role, deactivate (last-admin guard, SoD)"

## Action 2 — Siblings (parent_task_id = 82ec8724)
- `648a86a6` — Build workspace + firm-profile settings with default compliance profile cascade
- `41c017f7` — Add data-source connection admin management UI + encrypted-at-rest credential form
- `d7f716b4` — AppShell polish: placeholder pages for role-nav items + TopBar per-route title (re-parented from top-level; the admin pages replace its "Team"/"Settings" nav 404s)

## Action 3 — Validation (DB re-confirm) → PASS
All 4 rows: status=todo, wave_id IS NULL, milestone_id=M7. Seed parent_task_id NULL; 3 siblings parent_task_id=82ec8724. Clean vertical slice (API+DB+UI+shell), no horizontal bundle, no ghost dependencies (all read shipped-and-live M1 RBAC/M2 audit/M3 data-source store/AppShell), no dependency-deadlock (siblings are independent admin surfaces), no credential-gated content (DKIM/DMARC generation + live connection-test deferred with #141).

## Action 5 — claimed_task_ids
`[82ec8724-3f9e-45bd-8e81-e4e3fab8872d, 648a86a6-024b-4fce-9212-1e637ee16765, 41c017f7-0665-4fca-b95f-82fbf8962178, d7f716b4-d451-4095-8b43-9fbe4e85fcf8]`

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 82ec8724-3f9e-45bd-8e81-e4e3fab8872d"
  - "bundled siblings: 3"
  - "validation: pass"
seed_task_id: 82ec8724-3f9e-45bd-8e81-e4e3fab8872d
seed_task_title: "Build user-management admin vertical: invite, assign-role, deactivate (last-admin guard, SoD)"
bundled_sibling_ids:
  - 648a86a6-024b-4fce-9212-1e637ee16765
  - 41c017f7-0665-4fca-b95f-82fbf8962178
  - d7f716b4-d451-4095-8b43-9fbe4e85fcf8
claimed_task_ids:
  - 82ec8724-3f9e-45bd-8e81-e4e3fab8872d
  - 648a86a6-024b-4fce-9212-1e637ee16765
  - 41c017f7-0665-4fca-b95f-82fbf8962178
  - d7f716b4-d451-4095-8b43-9fbe4e85fcf8
active_milestone_id: 08d3053a-48fb-4562-a25b-6d99d40b0f62
queue_exhausted: false
validation_failed: false
note: "Seed is M7's Leverage feature vertical, not the Placebo-Trap test-fixture debt (bfadcec1, left unparented). Buildable-without-credential confirmed."
```
