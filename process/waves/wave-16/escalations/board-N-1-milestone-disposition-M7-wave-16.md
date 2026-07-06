# BOARD — N-1 milestone-disposition (wave-16 close)

- **decision-slug:** N-1-milestone-disposition-M7-wave-16
- **mode:** automatic · **tier:** Tier-3 (milestone disposition + next-milestone-theme advance — strategic/taste per always-on rule 17) · **bar:** 6+/7 APPROVE (strict)
- **convened by:** head-next (N-block gate)
- **date:** 2026-07-06

## Question

Dispose the active milestone M7 "Admin & settings" (H1/T3) and seed wave 17. M7 state (DB-verified): 10 child tasks done, 4 open (3 V-2 wave-16 Low hardening gaps + 1 wave-1 test-typing carryover). M7 `## Success metric` has 3 legs: (1) connect a data source — SHIPPED & LIVE; (2) invite users + assign roles — SHIPPED & LIVE; (3) verify a sending domain (DKIM/SPF/DMARC) for compliant outreach — NOT shipped, founder-gated on the email-provider/DKIM credential (product-decision #141, the same gate that put M6 into `blocked`; brain cannot unblock — account-issued credential per rule 6).

- **Option A** — finish M7 gaps: wave 17 = the 3 Low hardening tasks (would trip the multi-spec floor → RESCOPE-AUTO-MERGE; Low polish while substantive M8 waits; sending-domain leg still can't ship).
- **Option B** — park M7 + advance to M8 "Pilot-partner workspace (data isolation)" (oldest todo, H2/T4): promote M8 → in_progress, decompose M8's first bundle, seed wave 17 from M8. Honesty question surfaced: does M7 go `done` (2/3 legs shipped & usable) or `blocked` (M5/M6 #141 precedent)?

## Votes

| Seat | Vote | Core rationale |
|---|---|---|
| founder-proxy | APPROVE B — **M7 → blocked** (not done) | M5 (wave-10) + M6 (wave-14) precedent: a #141-gated unshipped Success-metric leg → `blocked` (honest external-hold), never `done`. Founder's recorded test is "is the metric met?" — M7's leg 3 is gated, so not met. M8 serves the imminent pilot partner. |
| strategist | APPROVE B | Option A is the Placebo-Productivity trap (burn a wave on 3 Lows while Leverage M8 waits). M8 (data isolation for the partner arriving "shortly after MVP") is correctly-sequenced, no SMB/multi-tenant drift. Dissent: durably track the #141-deferred sending-domain leg. |
| industry-expert | APPROVE B | Chinese-Wall multi-tenancy is M&A table-stakes (Mizuho/Virtu fines for failing to *technically* enforce barriers). Standing up RLS isolation BEFORE a second firm's MNPI enters is correct. M7 close is not a re-committed regulatory mistake — sending-domain is genuinely credential-blocked, tracked not skipped. Dissent: RLS must be DB-row-level, not app-layer. |
| risk-officer | APPROVE B | The 3 gaps are Low-severity on already-in-prod surfaces (advisory-lock collision-widening, cursor opacity, fieldMapping tightening) — none open failure modes; re-homing as live todo rows is sufficient tracking (not Premature-Archival). Front-loading M8 RLS before first partner is safer than retrofitting. Dissent: prioritize the fieldMapping gap early. |
| realist | REJECT (both as framed) | M7→done is *evidenced* (LIVE commits d72d7cb/a18fc82 real; sending-domain honestly `todo`, not Done-Theater). But Option B's load-bearing premise — decompose M8 NOW — rests on M8's `## Success metric` = `_TBD by founder_`. Conditional: APPROVE-able once M8 metric is supplied. |
| counter-thinker | REJECT (both as framed) — **M7 → blocked** | Failure (b): M7→done erodes the honest-completion discipline that held M5/M6 at `blocked` on the identical #141 gate — a Premature-Archival failure. Correct path = M7→blocked, THEN promote M8. Guardrail if M8 seeded: deny-by-default RLS enumeration test + cross-tenant negative read BEFORE onboarding partner. |
| user-advocate | APPROVE B | For the arriving partner, data isolation (confidentiality/information-wall) dominates felt value vs invisible backend polish; it's a procurement gate. M7 close harms no promise IF the deferred sending-domain leg renders as honest "verification pending" (no dead button). |

## Tally & resolution

- **Forward motion (park M7 / advance to M8): 7/7 endorse.** Both REJECT votes (realist, counter-thinker) explicitly endorse advancing to M8 — they object to *framing details*, not the direction. Clears the Tier-3 6+/7 strict bar. **No HARD-STOP.**
- **M7 disposition:** founder-proxy + counter-thinker cite dispositive documented precedent (M5→blocked wave-10, M6→blocked wave-14 on the identical #141 gate). **Resolution: M7 → `blocked`** (honest external-hold), NOT `done`. This also resolves the honesty tension cleanly and keeps the 3 Low gaps + #141 sending-domain remainder tracked & reversible on M7.
- **M8 seeding:** realist's blocker (M8 `## Success metric` = `_TBD`) evaluated by firing the milestone-decomposer. Verdict: `decomposition-complete` — the scope-too-vague guard is a *cluster* (TBD metric AND one-line scope AND no references) that did NOT fire: M8's `## Scope` is richly enumerated, `## References` (architecture/security.md, 23KB) are live, and the qualitative target ("no cross-firm data visibility") anchors the negative-read test. Only the *quantitative* metric is founder-deferred → a metric-refinement note, not a seeding blocker. Bundle authored & DB-validated. realist's condition thereby satisfied at the ritual level.

## Decision

**Option B (adjusted): M7 → blocked; M8 → in_progress; wave 17 seeded from M8's first bundle.** The quantitative M8 metric + the #141 sending-domain blocker surface to the founder (digest note), non-blocking.
