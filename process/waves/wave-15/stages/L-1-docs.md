# L-1 — Docs (wave-15, M7 admin & settings)

**Block:** L (Learn) · **Stage:** L-1 (∥ L-2) · **Head:** head-learn (spawn-pattern)
**Wave:** 15 (`f22747a7-6405-4fd1-9021-fae7da5cdf1c`, status=running) · **Ship SHA:** f5455d6 (main green, 596a78d)
**Mode:** automatic · **V-block:** Karen + jenny APPROVE, 0 spec-drift, 0 blocking.

## Action 1 — CHANGELOG entry

`## [0.15.0] — 2026-07-06 — Admin & settings (M7)` prepended above `[0.14.0]`.

- **Range:** `CHANGELOG.md:3–15` (headline + ### Added / ### Correctness / compliance / ### Provenance (transparency); ≤5 bullets/section; declarative present-tense, PM-readable per rule 16).
- Compliance-load-bearing bits credited: race-safe last-admin guard (write-skew-safe advisory lock → 409) + credential encryption at rest (AES-256-GCM). Audit-chain integrity confirmed live (314 entries) after additive migration 0013.
- Honest gaps documented in Provenance: **write-only firm default-compliance settings** (saved, not yet consumed by mandate creation), plus deferred reactivate / duplicate-invite / integrations-nav-link follow-ups. New prod-only secret `CREDENTIALS_ENC_KEY` + additive migration 0013 stated. Explicit: no email-send, no AI, no audit-record mutation.

## Action 2 — Milestone delta

Milestone touched: **M7 — Admin & settings** (`08d3053a-48fb-4562-a25b-6d99d40b0f62`).

Task census (post L-2 done-marking):

| status | count |
|---|---|
| done | 4 |
| open (todo/in_progress/blocked) | 6 |
| cancelled | 0 |
| **total** | **10** |

- **4 done this wave:** user-management admin vertical (seed `82ec8724`), AppShell placeholder polish (`d7f716b4`), workspace+firm settings (`648a86a6`), data-source connection admin + encrypted-at-rest (`41c017f7`).
- **6 open remain** → `open_count = 6 > 0` → **M7 stays `in_progress`. NO transition to `done`.** (Correct — brief-mandated; DB unchanged.)
  - 5 V-2 follow-ups (todo): `c54db02d` invite duplicate/existing-user handling · `042cf4e6` reactivate/undo for deactivated users · `2560fecc` guard config JSONB against raw secrets · `904a3c25` **wire firm default-compliance-profile cascade into mandate creation** (this is the write-only-settings gap — tracked, honest) · `6f1a96da` admin nav entry / link to /admin/integrations.
  - 1 pre-existing carryover (todo): `bfadcec1` tighten test-fixture typing in wave-1 health tests (not a V-2 follow-up; `wave_id IS NULL`).
- **Delta recorded:** `{M7: in_progress → in_progress, done_this_wave: 4, open_remaining: 6}`.
- **Backlog-stockout:** NOT flagged. Threshold is <3 open per milestone (PRODUCT-PRINCIPLES fallback); 6 ≥ 3, healthy queue for N-1.
- Mode-aware routing: mechanical, no-ambiguity progression (open_count>0 → no transition). No BOARD/ceo escalation required.

## Action 3 — README touchups

- **README not touched (prose).** README's env section is a pointer to `.env.example` + `project.yaml` (lines 73–79); it does not enumerate individual prod secrets, and `CREDENTIALS_ENC_KEY` is deploy-env-only (not local-dev-facing).
- **`.env.example` corrected instead** — the new secret was missing from it (B-0 Action 3 per-wave append was skipped this wave). Added `CREDENTIALS_ENC_KEY=` placeholder under the security block, matching the file's `# openssl rand -base64 32` convention. This is the canonical record location for a self-generated deploy secret (rule 17); the populated `.env.example` is the record, not README prose. Surgical, one placeholder, no secret value.

## Action 4 — Commit

FS docs committed to main: CHANGELOG.md + .env.example + checklist.md. Direct push to main (automatic mode; main allows doc commits).

- **Commit SHA:** b09a120 (docs content landed at 4a6dbf2; amended to b09a120 to backfill this deliverable's own SHA reference)

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-15"
  - ".env.example: CREDENTIALS_ENC_KEY placeholder added (security block)"
  - "milestones row: M7 08d3053a-48fb-4562-a25b-6d99d40b0f62 — NO UPDATE (open_count=6>0, stays in_progress)"
  - "docs commit: 4a6dbf2"
changelog_entry_added: true
roadmap_milestones_progressed:
  - {milestone: "M7 — Admin & settings", before: in_progress, after: in_progress, done_this_wave: 4, open_remaining: 6}
roadmap_skip_reason: ""
readme_sections_touched: []           # README prose untouched; .env.example placeholder added instead
backlog_stockout_flag: false          # 6 open ≥ 3 threshold
note: "M7 does NOT ship this wave — write-only firm-default-compliance-settings gap (task 904a3c25) plus 4 other open follow-ups remain. Documented honestly in CHANGELOG Provenance. New prod-only secret CREDENTIALS_ENC_KEY + additive migration 0013; audit chain intact (314 entries). No email/AI/audit-mutation shipped."
```
