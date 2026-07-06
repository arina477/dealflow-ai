# Wave 16 — P-4 Verdict

**Reviewer:** head-product (fresh spawn)
**Reviewed against:** process/waves/wave-16/blocks/P/review-artifacts.md
**Attempt:** 1  (1 = first gate)
**Phase:** 1 (head-product)

## Verdict
APPROVED

## Rationale
This is the right wave and it is scoped honestly. Finishing and hardening the admin
area (M7) is the correct next move — the two milestones "ahead" of it are either waiting
on a founder decision or blocked by an outside credential, so there is no higher-value
place to spend the wave. The single most important fix — making the firm-wide compliance
defaults an admin sets actually take effect on new mandates (today they silently do
nothing) — is correctly elevated to the wave's backbone and carries a real end-to-end
proof, not just a "the code path exists" claim. Every acceptance criterion I judge most
strictly on — the audit trail, admin-only access, and the compliance cascade — is written
as a pass/fail, observable check: the cascade must prove a new mandate inherits the firm
default and that changing the default later does NOT rewrite existing mandates; the new
"reactivate user" event is recorded in the tamper-evident log and the log's integrity
check still passes afterward; opening the new activity view writes nothing to the log
(verified by an unchanged entry count); duplicate invites are blocked for both an existing
user AND a pending invite, with a concurrency guarantee of exactly one row; and secrets are
kept out of the plaintext config by a typed boundary, not a guess-y content scanner. The
6th task (a read-only recent-activity view) is a coherent, buildable addition that closes
the observability loop over the same audit log the other tasks write to — not filler. The
one thing that keeps M7 from being fully "done" (verifying a sending domain) stays out of
this wave and goes to the founder digest, so the milestone honestly stays in-progress
rather than being falsely closed. All six tasks trace cleanly back to the framed problem.

## Security-scope decision
**security_scope_tightened: YES (tightened-eligible).**
The wave's touched surfaces intersect the tightened-gate trigger set: it touches
**user-creation** (invite dedup) and **user-state** (reactivate), plus a credential-adjacent
config boundary. Membership in the trigger set is what arms the tightened gate — not the
presence of a brand-new auth/credential primitive — so I do NOT waive it even though this
wave is lighter than wave-15 (it introduces no new auth or credential primitive; the config
change hardens the existing wave-15 credential path). Effect on Phase 2: Karen + jenny run
under the security-scope-tightened gate. Per P-4 Action 1, a first Phase-2 pass returning
BLOCK with >2 medium-or-higher findings forces a second Phase-2 iteration (guaranteeing ≥2
Phase-2 iterations before block exit), cap remaining at 3 attempts total. Recording this so
the orchestrator applies the tightened rule at Action 2/3 rather than a plain single-pass exit.

## Checklist trace (P-4 stage-exit)
- Audit-log / compliance-cascade / RBAC ACs binary + observable + machine-readable — **PASS**
  - cascade: no-retroactive-mutation + explicit-wins + e2e proof (set→create→assert row carries default; change default→assert existing mandate unchanged) — falsifiable on the persisted row.
  - reactivate: NEW `user-reactivate` action appended additively to the CLOSED auditActionEnum (wave-15 Inv-6 lesson honored in P-3 plan B-1); audited last-in-txn; chain still verifies after ship; admin-only 403/401, 400 already-active, 404 unknown.
  - admin-activity: read-only over the immutable audit log; opening writes NO row (entriesChecked/chain unchanged — a real invariant); admin-only advisor-403/anon-401.
  - invite-dedup: BOTH already-registered (409) AND already-pending (409/idempotent, no 2nd row) + concurrency exactly-one.
  - config typed-boundary: typed/whitelisted (NOT a runtime scanner — problem-framer note-1 folded in); secret-shaped→400; no secret logged; backward-compatible.
- P-0 reviewer responses (problem-framer / ceo-reviewer / mvp-thinner) logged, mediated, integrated into the spec — **PASS** (seed→spine + e2e proof; config typed-boundary; invite both-cases; prod-cleanup non-deferrable). Karen + jenny are Phase-2 (Action 2).
- Traceability: every claimed_task_id (6) resolves to the P-0 frame; admin-activity 6th task is a coherent floor-clear vertical, not filler — **PASS** (No-Go default not triggered).
- Migration discipline: migration 0014 (invites live-uniqueness partial index) additive + JOURNALED (BUILD rule 4, when>0013, .down + snapshot) or documented advisory-lock fallback if predicate non-immutable — AC-enforced in P-3 plan — **PASS**.
- Deferral honesty: sending-domain DKIM/SPF/DMARC verify stays #141-founder-gated → founder digest; M7 stays in_progress (not falsely closed) — **PASS**.

## Escalation
n/a

## Footer
- verdict_complete: true
- rework_attempt_cap_remaining: 3

---
## Phase 2 (Karen + jenny + Gemini + security-auditor) — merged
**Reviewers:**
- **Karen:** APPROVE — 6/6 load-bearing claims VERIFIED against real shipped code (MandateService.createAsActor + WorkspaceSettingsService exist; "mandate never reads workspace_settings today" TRUE; InviteService/users_email_unique real; users.deactivated_at + deactivateAsActor real; auditActionEnum is Zod-text not PG-enum → additive no-migration TRUE; DataSourceAdminService config real; audit.repository + 6 admin actions real; 0013 latest journaled → 0014 correct). 0 WRONG.
- **jenny:** APPROVE — 7/7 MATCHES, 0 DRIFTS (admin-activity clean persona/filter/capability split from wave-13 /compliance/audit-log; cascade consistent with M4 capture-at-create; reactivate no permanent-deactivation conflict; config hardens wave-15 encrypted-at-rest; deferral honest).
- **Gemini:** UNAVAILABLE (HTTP 429 credits depleted) → degrades, does NOT block (per P-4 Action 3).
- **security-auditor (tightened-gate adversarial pass):** FINDINGS 3 (2 Medium, 1 Low) → **REWORK applied to P-2/P-3** (not deferred): F1 invite advisory-lock-primary (drop email index; expired→reinvite AC preserved); F2 config-400 uniform-static-no-echo + enumerated per-field whitelist (scrubCredentialFromError gap on input.config); F3 drop vacuous firm-scope → admin-only + read-only-immutable + no-secret-metadata. CLEAN on reactivate + migration.

## Merged verdict: APPROVED (after security rework)
Karen + jenny APPROVE; Gemini UNAVAILABLE (non-blocking); security-auditor's 2 Medium + 1 Low design defects folded into the spec (seed tasks.description addendum) + P-3 plan before build — the tightened gate's ≥2-scrutiny-pass value realized (the wave-15 precedent: fix security design defects pre-build). No open blocking findings. → exit P-block to B-0.

- verdict_complete: true
- security_scope_tightened: true (2 adversarial passes: Phase-2 reviewers + security-auditor; rework applied)
- rework_applied_in_place: [P-2 spec addendum, P-3 plan Findings 1/2/3]
