# L-1 — Docs (wave-4)

Wave-4 shipped the tamper-evident audit-log backbone (M2 compliance wedge): append-only
`audit_log_entries` table with DB-layer immutability (BEFORE UPDATE/DELETE/TRUNCATE triggers),
HMAC-SHA256 hash-chain append service, chain-integrity verifier, `GET /compliance/audit-log/verify`
(RBAC compliance/admin), and the compliance integrity view at `/compliance/audit-log`.
LIVE at deploy `cd06e8a`, real-browser E2E 7/7, all block gates APPROVED.

## Action 1 — CHANGELOG entry

Added `## [0.4.0] — 2026-07-03` at `CHANGELOG.md:9-19` (headline + 4 Added bullets, keep-a-changelog).
Terse, plain-language, user-facing. No Changed/Fixed/Removed/Security section this wave (net-new
feature; the two /review CRITICALs were caught and fixed pre-merge, not shipped-then-patched, so they
do not belong under Security per the L-1 "shipped vulnerabilities patched after the fact only" rule).

## Action 2 — Milestone delta

Milestone touched: M2 (`2f116b9b-0338-421d-a9ad-899a11403aff`, "Compliance backbone: tamper-evident
audit log + rules engine"), `status=in_progress`.

Child-task count after L-2 done-marking: `done_count=4`, `open_count=3`.
Open tasks (the three M1 follow-ups re-parented into M2 in wave-3):
- `d7f716b4` AppShell polish (placeholder pages for role-nav items)
- `6fe232e3` Auth hardening (rate-limiting, input validation, logout anti-CSRF)
- `bfadcec1` Tighten test-fixture typing in wave-1 health tests

**No transition. M2 stays `in_progress`.** `open_count=3 > 0`, so the mechanical closure condition
(`open_count=0`) is not met. Additionally, M2's OWN remaining scope — the rules engine + pre-send
compliance gate — is NOT yet decomposed into tasks; the audit-log backbone was only the FIRST M2
bundle. M2 is not shippable and must not be closed. No judgment-call escalation needed: the transition
is mechanically ineligible (open tasks remain), not an ambiguous "structurally complete?" call.

`open_count=3` is at/above the brain fallback threshold (< 3 remaining flags backlog-stockout); at
exactly 3 no stockout flag is raised. N-1 will decompose the next M2 bundle (rules engine / pre-send
gate) per its Action 7 when the queue needs a seed.

**product-decisions append:** none. No new Tier-3 / scope-change decision resolved this wave. The
`/compliance/audit-log` route reconciliation (integrity view retargeted from `/compliance/settings`)
was a P-4 doc-level remediation already logged at P-4; it is not a new L-1 decision.

## Action 3 — README touchup

Added a "tamper-evident audit log is live" paragraph at `README.md:49-52`, alongside the existing
auth + authenticated-shell notes. Names the append-only cryptographically-chained record, the
compliance/admin review surface at `/compliance/audit-log`, and the verify endpoint. Surgical; detail
stays in CHANGELOG.

## Action 4 — Commit

Batched FS commit (CHANGELOG + README + L-block deliverables + checklist). SHA recorded in the wave
git log. Pushed to `main`.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:9-19"
  - "milestones row: 2f116b9b-0338-421d-a9ad-899a11403aff NO transition (in_progress; open_count=3)"
  - "README.md:49-52"
changelog_entry_added: true
roadmap_milestones_progressed: []          # M2 touched but not progressed (open_count=3)
roadmap_skip_reason: "M2 open_count=3>0; closure ineligible + rules-engine/pre-send-gate bundles not yet decomposed (first M2 bundle only)"
readme_sections_touched: ["Live deployment / audit-log note"]
note: "M2 stays in_progress. First M2 bundle (audit-log backbone) shipped; rules-engine + pre-send-gate remain as future M2 bundles."
```
