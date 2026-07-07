# L-1 Docs — wave-25 (M10 auth-hardening)

**Head:** head-learn (spawn-pattern, L-block lifetime). **Mode:** automatic.
**Shipped LIVE @987ebb4** — rate-limiting on `/auth/*` (429 verified in prod), missing-invite 500→400, logout anti-CSRF verify. Security-posture improvement, mostly user-invisible.

---

## Action 1 — CHANGELOG decision: ADD (under Changed + Fixed; NOT `### Security`)

**Verdict: surface it.** A concise auth-hardening note IS worth surfacing for a compliance-first M&A product — security-conscious clients value visible brute-force protection. This is the correct call *vs* the pure-internal wave-21/22/24 tooling skips (those touched nothing a customer experiences; this changes real user-facing auth behavior on hitting a limit or a bad invite link).

**Placement judgment — Changed + Fixed, deliberately NOT a `### Security` heading.** The L-1 stage contract (`stages/L-1-docs.md` Action 1) is explicit: *"Security section: shipped vulnerabilities patched after the fact only. Preventive security in the same wave (rate-limit on a new endpoint, CSRF on a new auth flow) goes in Added/Changed."* Wave-25 is **preventive hardening on existing endpoints before external users onboard** — not a post-hoc patch of a vuln that shipped to users. House precedent confirms: v0.2.0 auth session-hardening + CSRF went under `### Added`, never a standalone `### Security` heading. So the substance is surfaced (parent's "surface it" instinct honored) while the section label follows the binding contract + house style.

- Rate-limiting on existing `/auth/*` endpoints → **Changed** (existing feature modified).
- Logout anti-CSRF verify on existing logout endpoint → **Changed**.
- Missing-invite 500 → 400 → **Fixed** (defect corrected this wave).

**Entry:** `## [0.22.0] — 2026-07-07 — Auth hardening (M10)` — CHANGELOG.md headline paragraph + 3 bullets (1 Fixed, 2 Changed), within the ≤5-bullet cap. Plain, user-outcome-framed (rule 16).

## Action 2 — Milestone delta: M10 STAYS `in_progress`

DB-verified state (`milestones` / `tasks`, L-2 already marked claimed task done):

| Milestone | Status | done | open | Delta |
|---|---|---|---|---|
| M10 — Advanced compliance & recordkeeping (SOX/FINRA artifacts) | `in_progress` | 2 | 1 | **stays in_progress** |

- Claimed task `6fe232e3` (Auth hardening: rate-limiting, input validation, logout anti-CSRF) → `done` ✓ (wave_id `0fdb99f2…`).
- Exactly **1 buildable candidate left**: `1a1c5855` — "Document + AC the RLS connection-split (runtime dealflow_app…)" — `todo`, unparented.
- `open_count = 1 ≠ 0` → NO milestone transition. Mechanical, unambiguous — runs under automatic mode without BOARD escalation. No `product-decisions.md` append (reserved for `→ done` transitions).
- `open_count = 1 < 3` (brain fallback threshold) → **flag `backlog-stockout` for N-1** (Action 2 step 3). Ties directly into the tripwire below.

M9 was NOT touched by this wave (claimed task belongs to M10) → no M9 milestone delta. (M9 is `blocked`, 17 done / 1 open — unrelated to this wave.)

## Action 3 — README: SKIPPED

No user-facing setup change — no new CLI command, env var, install step, or breaking change. Rate-limiting + error-shape + logout CSRF are behavioral hardening on existing endpoints. Skip recorded per Action 3 condition.

---

## ⚠️ WAVE-26 TRIPWIRE — recordkeeping-decomposition is DUE (carry PROMINENTLY to N-1)

**This is the 2nd consecutive M10 hardening/debt wave.** M10's declared theme is **"Advanced compliance & recordkeeping (SOX/FINRA artifacts)"** — the actual SOX/FINRA recordkeeping verticals have NEVER been decomposed. The only buildable candidate left (`1a1c5855` RLS-doc) is *itself* hardening/debt, not the recordkeeping vertical.

**Binding instruction for N-1 (wave-26):**
> If wave-26 finds ONLY debt/hardening candidates AND M10's real recordkeeping-decomposition is still unfired, N-1 MUST **BOARD-escalate and REFUSE to author a 3rd consecutive hardening seed.** Instead, author M10's real SOX/FINRA recordkeeping verticals via `roadmap-planning-ritual` (milestone owns a recordkeeping theme with zero recordkeeping child tasks shipped). The recordkeeping vertical is DUE — a 3rd hardening seed would be milestone drift (Drift Normalization anti-pattern), letting the milestone's stated compliance value erode while snacking on debt.

Rationale: promoting a 3rd hardening item would institutionalize the milestone as a hardening backlog rather than delivering its existential compliance value. This is the exact "symptom-snacking vs. milestone theme" failure head-learn exists to catch.

## `_TBD` success-metric flags (founder polls — carry to N-1 / founder)

Both touched-area milestones still carry `_TBD_` numeric success targets (DB-confirmed):
- **M10** — "Advanced compliance & recordkeeping" — success metric `_TBD_` (founder to set).
- **M9** — "Integrations & insight" — success metric `_TBD_` (founder to set).

Neither is resolvable by head-learn (strategic / product-taste per rule 17) — flagged for founder. Under automatic mode these do not block; N-1 surfaces them.

---

## Action 4 — Commit

- FS docs (CHANGELOG.md `## [0.22.0]` block + this deliverable) committed to `main`, direct push: `docs: L-1 wave-25 closeout`.
- Commit SHA: **cf80ddb** (see footer `verdict_evidence`).

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-14 (## [0.22.0] — Auth hardening (M10))"
  - "milestones row NO-OP: 033f97e0 M10 stays in_progress (open_count=1)"
  - "task 6fe232e3 confirmed done (L-2 marked); 1a1c5855 remains todo"
  - "commit cf80ddb (docs: L-1 wave-25 closeout)"
changelog_entry_added: true
changelog_section: "Changed + Fixed (NOT Security — preventive same-wave hardening per L-1 contract)"
roadmap_milestones_progressed: [{milestone: "M10", before: "in_progress", after: "in_progress"}]
roadmap_skip_reason: ""
milestone_backlog_flag: "M10 backlog-stockout (open=1 < 3) → N-1 reason backlog-stockout"
readme_sections_touched: []
carry_forward:
  wave26_tripwire: "2nd M10 hardening wave; if wave-26 finds only debt/hardening AND recordkeeping-decomposition unfired → N-1 BOARD-escalate + REFUSE 3rd hardening seed; author SOX/FINRA recordkeeping verticals via roadmap-planning."
  tbd_metric_polls: ["M10 success metric _TBD_ (founder)", "M9 success metric _TBD_ (founder)"]
note: "README skipped (no user-facing setup change). M9 not touched by this wave — no M9 delta."
```
