# BOARD — next-milestone-slot-after-wave30-M9-adapter-done

**Mode:** automatic
**Convened by:** head-next (N-block, wave-30 close)
**Date:** 2026-07-08
**Question:** Is there a legal, autonomously-buildable next seed for wave-31, OR should the loop take a genuine FOUNDER-PAUSE (scope-exhausted / awaiting-founder-key-and-metrics)?

## Situation (verified against Postgres)

- Wave 30 built the M9 Affinity DataSourceAdapter against the public Affinity REST API + mocked tests; deployed LIVE to Railway @a6ad02c; boots DORMANT (needs the founder's account-issued `AFFINITY_API_KEY`, a deploy secret not yet provided). V-block APPROVED.
- M9 (Integrations & insight, `in_progress`): 18/18 child tasks done, 0 open. `## Success metric` = `_TBD by founder_`; its real condition (real CRM data syncing) is NOT observably met while the adapter is dormant. M9 CANNOT close (strict closure invariant) → stays `in_progress`.
- Milestones: DONE = M1/M2/M3/M4/M8/M10; BLOCKED (founder-gated) = M5/M6/M7; TODO = M11 (`_TBD` metric + out-of-MVP prereq) + M12 (`_TBD` metric); H1 cancelled.
- Milestone-decomposition ritual REFUSES M11/M12 (Step 2 scope-too-vague guard on `_TBD` `## Success metric`). M9's remaining `## Scope` (live CRM hookup, external multi-channel send, matching-model LLM-spend) is founder-credential/spend-gated. Only unassigned work is 1 trivial /health-spec doc-polish task (b1a0b2ac) — not milestone-scale.
- Precedent: wave-29 close hit the identical structural situation (slug `next-milestone-slot-after-M10-close`) → BOARD 7/7 APPROVE-PAUSE. Founder answered by choosing "A — Integrations" + vendor Affinity → M9 unblocked → wave-30 built the adapter.

## Votes (7/7 — fresh context, parallel, no shared state)

| Seat | Vote | One-line rationale |
|---|---|---|
| ceo-reviewer | APPROVE-PAUSE | No milestone-advancing buildable seed; force-seeding the doc task is the "polished thing nobody needed" wave the ambition lens exists to prevent. |
| architect-reviewer | APPROVE-PAUSE | Dormant-adapter behind the sourcing interface is the correct reversible parked state; no half-built/fragile architecture; `_TBD` guard is working, not to be routed around. |
| ux-researcher | APPROVE-PAUSE | Entire M9 investment is invisible to advisors until real Affinity companies flow into /sourcing/companies — key-gated; credential-free candidates deliver zero perceptible user value. |
| risk-manager | APPROVE-PAUSE | Parked state verified safe (no pending migration, no committed secret, absent-key path is a clean no-op returning []); busywork churn erodes progress-signal credibility; pause is reversible. |
| founder-proxy | APPROVE-PAUSE | Founder's most recent directive (Integrations/Affinity) explicitly reserved the API key; this IS the definitional founder-pause; 4x pause precedent; live bet bf09e8cc best served by real data flowing. |
| competitive-analyst | APPROVE-PAUSE | CRM sync is table-stakes; competitive value is zero while dormant; the correct move is to surface the key gate so the integration goes live. |
| product-manager | APPROVE-PAUSE | No legal decomposition bundle exists without new founder input; the honest next step is a pause surfacing key + metrics, not a filler wave. |

**Tally: 7/7 APPROVE-PAUSE. No dissent. No HARD-STOP veto.** Exceeds the 6+/7 Tier-3 strict bar.

## Consolidated decision

No legal, autonomously-buildable, milestone-advancing next seed for wave-31. Loop takes a genuine FOUNDER-PAUSE (scope-exhausted-pending-founder). M9 stays `in_progress` (adapter built + deployed dormant; cannot close — `_TBD` metric + dormant live-verify both founder-gated).

## Founder decisions surfaced (priority order)

- **(a) Provide the Affinity API key** (`AFFINITY_API_KEY`) → a small live-verify wave activates the adapter + verifies real companies appear in /sourcing/companies. **Most immediate — unlocks real data + M9 progress. BOARD-leading.**
- (b) Set M9's `_TBD` success metric (founder-reserved) so M9 can mechanically close once the live hookup verifies.
- (c) Set M11/M12 `_TBD` success metrics (+ resolve M11's out-of-MVP blocking prereq) so decomposition can author bundles.
- (d) Roadmap-refresh / strategic review (sharpen the `_TBD` metrics to prevent a repeat stall).
