# L-1 — Docs (wave 5)

**Block:** L (Learn) · **Stage:** L-1 (∥ L-2) · **Mode:** automatic · **Owner:** head-learn

## Summary

Wave 5 shipped the compliance ENFORCEMENT layer (M2 second half): the 4-table rules engine + a single non-bypassable `ComplianceGateService.evaluate()` (suppression hard-block, SoD sender≠approver with approver=compliance-only, jurisdiction disclaimers, approval content-hash binding), every verdict + config-change audited in-transaction to the wave-4 tamper-evident log, + a compliance-settings CRUD UI. LIVE at deploy `13e55ef`, real-browser E2E 33/33, all gates APPROVED.

## Action 1 — CHANGELOG entry

Added `## [0.5.0] — 2026-07-03` under `[Unreleased]` (CHANGELOG.md, ~9 lines: headline + 5 bullets, keep-a-changelog Added). Plain-language, user-facing: rules engine, non-bypassable pre-send check, separation of duties (admin excluded as approver), content-bound approval, settings screen. All preventive-security-in-same-wave content → **Added** (no Security section — nothing shipped-then-patched).

## Action 2 — Milestone delta

**M2 (2f116b9b-0338-421d-a9ad-899a11403aff) — NO transition. Stays `in_progress`.**

- M2 task counts (live query): `done=8, open=3`. `open_count ≠ 0` → no mechanical progression → L-1 does NOT transition (per stage Action 2).
- The 3 open rows are the re-parented M1 FOLLOW-UPS, all carrying an original `wave_id` (not M2-core): `d7f716b4` (AppShell polish), `6fe232e3` (auth hardening), `bfadcec1` (test-fixture typing). None is M2-core scope.
- **M2 core is shipped + live-verified (both halves):** the wave-4 tamper-evident audit log + the wave-5 rules engine / non-bypassable pre-send gate. M2's success metric ("suppression/disclaimer/approval rules configurable + enforced by a callable pre-send check used by outreach (M6)") — the configurable rules + non-bypassable callable pre-send check ARE built, enforced, and live-verified; the "used by outreach" clause is an M6 forward dependency (the future send-path is the gate's caller), NOT M2 scope.
- **N-1 closure-judgment FLAG:** M2 closure is a judgment call for N-1 Action 6 (identical shape to the wave-3 M1 close: `open_count>0` but all open rows are non-core follow-ups). N-1 may either close M2 `in_progress → done` (core both-halves shipped; open rows are polish/hardening + the M6-wiring forward dependency) and promote M3, OR keep M2 open. L-1 does NOT make this call and does NOT transition M2. Recorded here for N-1 pickup.
- Judgment-call routing note (automatic mode): this is not an L-1 milestone-delta escalation — there is no mechanical progression for L-1 to apply, and the closure decision is scoped to N-1. No BOARD decision-slug raised at L-1.

## Action 3 — README touchups

Added a "pre-send compliance gate is live" paragraph after the audit-log paragraph (README.md), symmetric with the existing audit-log/auth-shell "is live" paragraphs: names the four enforced checks, `/compliance/settings` management route, compliance/admin roles. Surgical; detail lives in CHANGELOG.

## Action 3b — databases.md compliance reconciliation (P-4-deferred)

The P-4 gate (jenny item 4, LOW) deferred the databases.md §compliance reconciliation to L-1/L-2. The `compliance_rules_suppression` section in `command-center/dev/architecture/databases.md` was materially STALE vs the as-built schema (`apps/api/src/db/schema/compliance-rules.ts`). Reconciled to as-built shapes so a future wave does not re-derive from the stale sketch:

| Table | Stale sketch (removed) | As-built (now documented) |
|---|---|---|
| `suppression_list` | entity_type contact/company/domain, entity_ref, suppressed_by, suppressed_at, expires_at | match_type email/domain, value, reason, created_by FK SET NULL, created_at; index (match_type, value) |
| `disclaimer_templates` | name, jurisdiction_code, body_text, is_required | jurisdiction, body, version, active, created_by FK SET NULL; index (jurisdiction, active); append-style versioning |
| `compliance_rules` | rule_type, jurisdiction_code, parameters_json | rule_type ENUM, jurisdiction NULLABLE, config JSONB, enabled, created_by FK SET NULL, updated_at ($onUpdateFn) |
| `compliance_approvals` | campaign_id, template_id, requested_by, status pending/approved/rejected, reviewed_by, note | resource_type, resource_id, content_hash, approver_user_id FK SET NULL, approver_role, status approved/revoked |

Also documented: the four tables are mutable-config (their audit trail is via in-tx append to the immutable `audit_log_entries`, not DB-level immutability); SoD enforcement is application-layer (approver_role unconstrained text at DB, gate accepts compliance-only, admin excluded); settings-CRUD @Roles = compliance,admin (config authority distinct from send-approval authority).

## Action 3c — product-decisions append

Appended one entry (`command-center/product/product-decisions.md`): "SoD approver is the compliance role only; admin cannot approve a send" (Category: Security, Status: Active). Captures the P-4 remediation of a jenny-caught spec drift — a genuine compliance-policy decision (admin excluded as approver; config-authority vs approval-authority distinction), live-verified at C-2.

## Action 4 — Commit

- `23e85f8` — `docs: L-1 wave-5 closeout (changelog 0.5.0, readme, databases.md compliance reconcile, SoD decision)` (4 files).
- Pushed to `origin/main` (`9517345..23e85f8`).

---

## head-learn stage-exit checklist (L-1 Docs)

- Retrospective omits individual human error as root cause; systemic framing throughout observations.md (L-2) and the databases.md reconciliation traces the stale-sketch → re-derivation risk, not "an author made a mistake": PASS
- Plan-authoring defect (SoD drift) traced to the specific missing context (security.md §RBAC-SoD not carried into plan draft), caught at P-4, remediated pre-B-block: PASS
- Precise domain vocabulary (SoD, content-hash binding, in-tx audit, FK SET NULL): PASS
- Overridden/tightened constraint (SoD compliance-only) carries a justification tied to MVP compliance reality (FINRA/SOX self-approval exposure): PASS
- Impact differentiates existential (non-bypassable gate, SoD, audit binding) from polish: PASS
- Compliance gate NOT degraded for speed; the gate strengthens the compliance backstop: PASS

```yaml
head_signoff:
  verdict: APPROVED
  stage: L-1-docs
  reviewers: {}
  failed_checks: []
  rationale: >
    CHANGELOG 0.5.0 appended (terse, plain-language, Added-only). Milestone delta correctly
    records NO mechanical progression (M2 open_count=3, all M1-follow-ups) and flags M2 closure
    as an N-1 judgment call without transitioning it. README touched for the live compliance gate.
    The P-4-deferred databases.md §compliance reconciliation is done — as-built shapes replace the
    stale sketch, with the mutable-config vs immutable-audit and SoD-authority distinctions documented.
    The SoD compliance-only remediation is logged as a Security product-decision. All FS docs committed
    and pushed.
  next_action: PROCEED_TO_L-block-exit

l_stage_verdict: COMPLETE
verdict_evidence:
  - "CHANGELOG.md: [0.5.0] section added under [Unreleased]"
  - "README.md: pre-send compliance gate paragraph (commit 23e85f8)"
  - "databases.md §compliance reconciled to as-built (commit 23e85f8)"
  - "product-decisions.md: SoD compliance-only entry (commit 23e85f8)"
  - "milestone M2 2f116b9b: NO transition (done=8, open=3 all M1-follow-ups); N-1 closure flag recorded"
changelog_entry_added: true
roadmap_milestones_progressed: []
roadmap_skip_reason: "M2 open_count=3 (all re-parented M1 follow-ups, non-core); no milestone reached open_count=0; M2 closure is an N-1 Action-6 judgment call, flagged not transitioned"
readme_sections_touched: ["What's live (compliance gate paragraph)"]
note: "M2 core (both compliance-backbone halves) shipped + live-verified; N-1 to decide M2 close+promote-M3 vs keep-open. head-learn did NOT transition M2."
```
