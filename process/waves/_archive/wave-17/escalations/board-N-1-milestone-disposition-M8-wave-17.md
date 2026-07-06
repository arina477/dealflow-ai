# BOARD — N-1-milestone-disposition-M8-wave-17

**Mode:** automatic · **Bar:** Tier-3 strict (6+/7) · **Convened by:** head-next at N-1 (wave-17 close)
**Decision:** M8 disposition — Option A (call M8 done on shipped pilot scope + advance to M9) vs Option B (M8 stays in_progress; wave 18 = the 3 gaps).

## Outcome: 7/7 APPROVE-A · 0 HARD-STOP → APPLIED

Clears the strict Tier-3 6+/7 bar decisively. M8 in_progress→done; M9 todo→in_progress; wave 18 seeds from M9.

## Votes (independent, fresh-context, parallel — none saw another's vote)

| # | Seat | Vote | Hard-stop | Rationale (summary) |
|---|---|---|---|---|
| 1 | ceo-reviewer | APPROVE-A | no | M8 scope explicitly one-firm; metric live-verified as the real runtime role = honest completion, not hallucinated. GAP-2 is H3/M11 territory per its own prose. Option B holds a done pilot milestone hostage to inert work while M9 (the top bet made concrete) waits. Condition: GAP-2 genuinely re-homed as a live tracked task, not silently dropped. |
| 2 | architect-reviewer | APPROVE-A | no (1 binding M11 condition) | Read the isolation foundation directly: deny-by-default FORCE RLS on 28 tenant tables, per-request GUC on dedicated pooled client with surgical RESET, unauth fails closed. **Verified exactly ONE `INSERT INTO workspaces` in the whole repo (migration seed) — no app/API path creates a 2nd workspace**, so single-firm containment cannot be silently violated. GAP-2 genuinely topologically inert. Binding condition: M11's first 2nd-workspace-creation task must be blocked behind GAP-2; ideally a boot assertion refusing workspace-count>1 until fail-closed lands. |
| 3 | ux-researcher | APPROVE-A | no | Pilot advisor's isolation experience is real & live today; the 3 gaps are invisible internal hardening. M9 (CRM sync + productivity analytics) is directly user-valuable. Delaying felt value for invisible work is a poor pilot-stage trade. |
| 4 | risk-manager | APPROVE-A | no (2 attached controls) | Metric met on BOTH read and write sides today: `USING`-only RLS policies → Postgres copies USING into WITH CHECK, so a workspace_id-mismatched INSERT is DB-rejected regardless of the app fallback. GAP-2 is defense-in-depth behind an already-enforcing primary control. Attached controls: (1) GAP-2 → M11 as a BLOCKING head-of-bundle seed (parent NULL, "M11 cannot exit until closed"); (2) recommend a runtime interlock failing 2nd-workspace creation until fail-closed lands. "If BOARD cannot secure control (2), downgrade to APPROVE-B rather than escalate." |
| 5 | founder-proxy | APPROVE-A | no | Founder voice: pilot isolation = exactly the guarantee asked for, live now. Option B is the stitched-together momentum-kill the roadmap was built to avoid. Compliance-first → GAP-2 must be bound to M11 as a hard pre-req, never silent backlog rot (cites the auth-hardening-carried-4-milestones security-debt precedent). Advance to M9. Precedent-consistent with every prior milestone close. |
| 6 | competitive-analyst | APPROVE-A | no | CRM interoperability (DealCloud/Affinity/Salesforce sync) + productivity analytics (Intapp) are table-stakes in M&A deal-tech; M9 attacks that. The 3 gaps have no competitive/market signal at pilot stage. Compliance posture is strengthened by shipped+verified controls, not by internal migration test coverage prospects can't audit. |
| 7 | product-manager | APPROVE-A | no | Written scope + metric are pilot-scoped to one firm and demonstrably shipped/live-verified (not mocked). Reads = the visibility vector, RLS-protected & live; GAP-2 is a write-placement defense only exercised at 2+ firms. Option A is honest scope-complete, not Hallucinated-Milestone-Completion. |

## Consolidated decision + dissent

- **No dissent.** Unanimous APPROVE-A. No seat preferred Option B; no HARD-STOP veto.
- **Binding condition (risk-manager + architect-reviewer, honored):** GAP-2 (2867d087) re-homed to M11 as a top-level (parent NULL), wave_id-cleared, claimable seed, with in-task prose flagging it a BLOCKING M11 pre-requisite — "M11 must not introduce a 2nd-workspace provisioning path until this write-path fail-closed sweep lands; M11 cannot exit until closed."
- **Recommended non-blocking control (planned into M11):** a hard runtime/boot assertion refusing workspace-count > 1 until the fail-closed write-path sweep lands. Recorded on the GAP-2 task + carried to the founder digest; not applied this wave (deferred to M11 planning).
- **Applied transitions:** M8 9ed98c3c in_progress→done; M9 099cee10 todo→in_progress. Recorded in `command-center/product/product-decisions.md`.
- **Re-homing (before close, for the 0-open-children invariant):** GAP-2 2867d087→M11; GAP-4 fd8f2860→M10; GAP-5 1a1c5855→M10 — all wave_id cleared to become clean future seeds.

## Founder digest note (surfaced)

M8 (pilot-partner data isolation) shipped and closed on its pilot scope. One real hardening item — making the write path fail-closed when no workspace is set — is inert for the single pilot firm but MUST land before a second firm is ever onboarded; it is now tracked as a blocking prerequisite under the future multi-tenant milestone (M11), not forgotten. Next up: M9 (integrations & insight — CRM sync + productivity analytics).
