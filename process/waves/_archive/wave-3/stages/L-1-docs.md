# L-1 — Docs (wave 3)

Owner: head-learn (spawn-pattern sub-agent). Mode: automatic. V-block exited APPROVE (Karen + jenny).

## Action 1 — CHANGELOG entry

Added `## [0.3.0] — 2026-07-03` to `CHANGELOG.md` (keep-a-changelog, `### Added`, headline + 5 bullets):
the shared app shell + role-aware dashboard on `/`, per-route RBAC (fail-closed), single-source-of-truth
role-based navigation, and server-verified-role-per-request. Terse; file-level detail lives in PR/commits.

- Line range: `CHANGELOG.md:7-18` (new `[0.3.0]` block above `[0.2.0]`).

## Action 2 — Milestone delta

Milestone touched: **M1 — Foundation: auth, roles, app shell, data model, CI** (`2c79236a-ffc0-43e2-b406-a5aa56413882`).

L-2 confirmed the 3 wave-3 claimed tasks (`1931b452`, `2ecc4a7b`, `2dc00409`) are `done`. M1 child-task rollup:

| status | count |
|---|---|
| done | 7 |
| open (todo) | 3 |

`open_count = 3 > 0` → **M1 stays `in_progress`. No transition applied** (mechanical rule: milestone closes only when `open_count = 0`).

The 3 open tasks are all FOLLOW-UPS, not core scope:
- `6fe232e3` — Auth hardening: rate-limiting, input validation, logout anti-...
- `d7f716b4` — AppShell polish: placeholder pages for role-nav items whose targets don't exist yet
- `bfadcec1` — Tighten test-fixture typing in wave-1 health tests

**M1 CORE scope is shipped.** Auth, the 4-role model, the app shell, per-route RBAC (the wave-2 deferral),
role-aware navigation, the data model, and CI are all LIVE (deploy `935b847`); M1's success metric
("land on a role-aware dashboard shell") is met. Only follow-ups/polish remain.

**Closure-judgment flag for N-1:** M1 closure is a JUDGMENT CALL, not mechanical. Core scope + success metric
are done; only 3 non-core follow-ups remain. N-1 may (a) close M1 and re-parent the 3 follow-ups to a later
milestone, or (b) keep M1 open until follow-ups land. head-learn does NOT transition M1 (open_count > 0 keeps
the mechanical rule at "no transition"); this is surfaced for N-1's disposition per Action 2's
below-threshold / judgment-call path. Under `automatic` mode the disposition routes via N-1, not L-1.

`product-decisions.md`: NOT appended. No new Tier-3 / scope decision resolved this wave (the `/` canonical-route
reconciliation was logged at P-4; RBAC scope was set in P-2). Append-skip is correct.

## Action 3 — README touchup

`README.md` "Live deployment" section: added a paragraph noting the authenticated shell is live —
role-aware dashboard at `/`, shared app frame, per-route RBAC, role-scoped navigation. Surgical; detail
stays in CHANGELOG.

## Action 4 — Commit

FS docs (CHANGELOG + README) committed and pushed to `main` in the L-1 batch commit (see footer SHA).
BUILD-PRINCIPLES promotion (L-2) commits separately with its candidate audit trail.

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:7-18"
  - "milestones row: 2c79236a-ffc0-43e2-b406-a5aa56413882 UNCHANGED (in_progress; open_count=3)"
  - "README.md: Live deployment section touched"
changelog_entry_added: true
roadmap_milestones_progressed: [{milestone: "M1 (2c79236a)", before: "in_progress", after: "in_progress"}]
roadmap_skip_reason: "M1 open_count=3 (>0) — no mechanical transition; closure is an N-1 judgment call (core scope + success metric shipped, only 3 follow-ups remain)"
readme_sections_touched: ["Live deployment"]
note: "M1 core scope + success metric SHIPPED; N-1 closure-judgment flag raised. product-decisions.md append skipped (no new decision resolved this wave)."
```
