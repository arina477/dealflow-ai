# Wave 28 — L-1 Docs (M10 RETENTION policy)

**Stage:** L-1 (∥ L-2) · **Mode:** automatic · **head-learn verdict:** COMPLETE
**Shipped:** M10 vertical 2 (RETENTION policy) — LIVE @775cd67 · `/compliance/retention`

---

## 1. CHANGELOG decision — ADD, minor bump 0.23.0 → 0.24.0

**Judgment: warranted `### Added` + minor bump.** Retention is a genuine user-facing capability
(a firm admin/compliance officer sets the firm's records retention window on a new settings page,
with a read-only cutoff display and audit-logged changes) — directly parallel to wave-27 export
(0.23.0) and wave-25 auth (0.22.0). A firm setting its retention policy is a routine, real part of
its recordkeeping obligations, so it earns a release-note block, not a silent internal entry.

- **Entry:** `## [0.24.0] — 2026-07-08 — Firm records retention policy (M10)` — CHANGELOG.md lines 3-19.
- **Sections:** headline paragraph + `### Added` (1 bullet) + `### Correctness / compliance` (2) +
  `### Provenance (transparency)` (2). Within the length cap (headline + ≤5 bullets).
- **Compliance-trust framing (verified against V-block APPROVE + checklist):** WORM-preserved
  (no purge control anywhere; audit log untouched; verifyChain ok:true after a config change —
  proven test, not asserted); per-firm RLS on the new table (isolation test as dealflow_app);
  RBAC fail-closed (admin/compliance write, advisor/analyst 403, anon 401); every config change
  appended to the M2 hash-chain with actor + old→new. Genuine retention-DELETE explicitly deferred.
- **Version record:** package.json is `0.0.0` placeholder across apps — the CHANGELOG is the sole
  version marker, so the bump lives there only.

## 2. Milestone delta — M10 STAYS in_progress (NOT closed)

**M10 = `033f97e0` — Advanced compliance & recordkeeping — in_progress, LIGHT posture.**

- L-2 marked all 4 wave-28 retention tasks `done` (d3cc1337 + b7786c5b + ed4945e0 + ce75c6c6).
- Child-task tally: done=9, cancelled=0, **open=0**.
- **Mechanical `open_count=0` is a FALSE completion signal — M10 is NOT closed.** The milestone
  prose names THREE build-order verticals and its success metric requires all three:
  (1) recordkeeping EXPORTS — shipped @0.23.0;
  (2) RETENTION policy — shipped this wave @0.24.0;
  (3) records VIEW — "a firm admin browses + filters its retained records in-app" — **NOT yet
  decomposed into tasks.**
  The success metric explicitly requires "retained records are viewable in-app" — that clause is
  unmet. `open_count=0` is zero only because vertical 3's bundle has not been INSERTed yet
  (decomposition is per-wave via the milestone-decomposition-ritual), not because M10's scope is met.
- **Closing M10 now would be premature milestone closure (Chesterton's-Fence class).** No structural
  ambiguity to BOARD: the milestone's own declared scope + success metric name a third unshipped
  vertical, so the mechanical no-op applies — do not close; carry vertical 3 to N-1.
- **Carry for N-1:** the NEXT + LAST M10 light vertical = **records-VIEW (vertical 3)**. Once it
  ships, all 3 light verticals are done → M10's light success metric is fully met → M10 can then
  close, and the next N-block decomposition will SUCCEED (metric SET, seed authorable).

## 3. README decision — ADD (surgical)

The README `## Live deployment` section lists each shipped user-facing capability as a bolded
"X is live" paragraph (auth, shell, audit log, compliance gate, sourcing, export). Retention is a
peer user-facing capability → added a matching paragraph after the export one (README.md, after the
recordkeeping-export block): "Firm records retention policy is live." Surgical, no-purge + audit-logged
+ per-firm-scoped framing; detail stays in CHANGELOG.

## 4. Carry flags for N-1

- **M10 records-VIEW (vertical 3)** — last M10 light vertical, not yet decomposed. N-1 Action 7
  should author its bundle under M10; on ship, M10 closes.
- **M11 (`4636e74e`, todo) pile-up anomaly** — a `todo` milestone should carry ZERO child tasks
  (rows authored empty; decomposition is per-wave), but M11 has 1 open task. N-1 to reconcile
  (orphaned/mis-parented seed) before M11 activates.
- **M9 success-metric `_TBD`** — standing founder-input flag: the M9 insights verticals (CHANGELOG
  0.18–0.21) all note "the specific numeric success target for this area is still to be set by the
  founder." Not a wave-28 blocker; carried for the founder to resolve when M9 metrics are set.

---

```yaml
l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md:3-19"            # 0.24.0 entry, minor bump from 0.23.0
  - "README.md: /compliance/retention 'is live' paragraph in Live deployment section"
  - "milestones 033f97e0 (M10): status UNCHANGED = in_progress (vertical 3 records-view unshipped; open_count=0 is a false-completion signal, NOT a close condition)"
  - "L-1 closeout commit: <sha-pending-commit>"
changelog_entry_added: true
changelog_version: "0.24.0"
roadmap_milestones_progressed:
  - {milestone: "M10", before: "in_progress", after: "in_progress"}   # retention shipped; NOT closed — records-view (vertical 3) remains
roadmap_skip_reason: ""
readme_sections_touched: ["Live deployment"]
carry_flags:
  - "M10 records-view = LAST light vertical → N-1 decompose; on ship M10 closes"
  - "M11 (todo) pile-up: 1 open task under a todo milestone → N-1 reconcile"
  - "M9 success-metric _TBD → founder input"
note: "M10 mechanical open_count=0 deliberately NOT treated as a close condition; milestone prose + success metric require an unshipped 3rd vertical (records-view). automatic-mode BOARD not convened — no structural ambiguity, mechanical no-op (open bundle unauthored) applies."
```
