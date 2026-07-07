# Wave 28 — P-4 Verdict

**Reviewer:** head-product (fresh spawn)
**Reviewed against:** process/waves/wave-28/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
Wave 28 ships M10 vertical 2 (retention policy) as a genuinely WORM-preserving config
+ read-only surfacing feature, and every load-bearing compliance boundary is specified
as a binary, machine-checkable, observable acceptance criterion rather than aspirational
prose. The single crux — that "retention" must never delete or mutate the immutable
audit_log_entries chain — is held HARD in three independent places: the UI/API carry NO
purge or delete control (explicit AC on seed, service, and UI), a retention-config change
is an APPEND to the M2 HMAC chain (actor / old_days -> new_days) via AuditService, and a
test AC proves verifyChain still returns ok:true AFTER a config change. Genuine
retention-DELETE over WORM data is correctly DEFERRED (founder/compliance/legal), which is
causally correct: the mutable policy table sits BESIDE the append-only chain and never
mutates it. I verified the crux against code — the 0002 audit_log_no_mutate trigger fires
BEFORE UPDATE OR DELETE unconditionally for every role including superuser, so a purge
path would trip it and break the chain; deferral is the only correct design. The wave-27
"a new table does not inherit RLS" lesson is carried explicitly: the ONE additive migration
must ENABLE + FORCE ROW LEVEL SECURITY, CREATE the workspace_isolation policy (the 0014
`app.workspace_id` GUC pattern, which I confirmed exists to copy), and GRANT to dealflow_app,
with an isolation test proving firm A cannot read/write firm B's policy via the REAL service
as dealflow_app in workspaceAls (mirroring wave-27 recordkeeping-export-isolation). RBAC is a
binary negative matrix (admin/compliance -> 200, advisor/analyst -> 403, anon -> 401, RolesGuard
boot-fail-closed) plus bounds validation (out-of-range days -> 400). The migration is additive
and journaled (the wave-24 populated-migration AC is correctly scoped OUT — this is a mutable
non-WORM table). Posture is LIGHT (config + surfacing, ~7yr sensible default that is mutable and
firm-editable — covered by the standing 2026-07-07 light-posture decision, no founder-ask), not
a purge engine — not over-built, not under-built (the cutoff-surfacing display is a cheap derived
view off the same GET call, completing the surfacing value without stranding a raw-integer screen).
design_gap_flag is TRUE and the D-block runs (new retention settings + cutoff UI) before B.
All four claimed_task_ids trace to M10 metric clause 2 ("bounded by a configurable retention
window"). Every P-4 stage-exit checkbox ticks.

## Security-scope assessment (§ Security-scope tightened gate)
**Verdict: TIGHTENED — YES-light.** This wave's `wave_touches` does not intersect the classic
`{auth, payments, sessions, csrf, rate-limit, user-creation}` set, so the mechanical
Action-1 forced-second-iteration rule does not auto-fire. HOWEVER the wave introduces (a) a
NEW RLS-scoped tenant table — the wave-27 failure class where a missing/incorrect policy
silently leaks cross-firm config — and (b) writes to the WORM/audit backbone (config-change
HMAC appends adjacent to the immutable chain). The cross-firm-config-leak and
WORM-integrity risks are exactly the surface a generalist reviewer under-tests. I therefore
route a **security-auditor Phase-2 pass IN ADDITION to the standard karen + jenny** (all three
must APPROVE; Gemini degradable per dispatcher), scoped to two questions: (1) does the
migration genuinely ENABLE+FORCE RLS + workspace_isolation + GRANT on the new table, and is
the isolation proven via the REAL service as dealflow_app (not re-implemented SQL that bypasses
the policy)? (2) is there any code path — service, controller, UI, or migration — that
UPDATEs/DELETEs audit_log_entries or exposes a purge control, and does a verifyChain-ok-after-
config-change test exist? This is YES-light (a bounded, two-question security-auditor add-on),
NOT the full ≥2-iteration security ceremony reserved for the auth/session touch-set.

## Phase-2 routing (for orchestrator)
- karen — verify load-bearing claims (0014 RLS pattern reuse, 0002 WORM trigger, RolesGuard prior art, journaled migration).
- jenny — spec vs user-journey-map + product-decisions drift (light posture, no purge, ~7yr default authorization).
- security-auditor — the two-question RLS-on-new-table + WORM-preservation pass above (the tightened add-on).
- Gemini cross-model — degradable per dispatcher.

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3
