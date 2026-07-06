# BOARD — N-1-milestone-disposition-wave-14

**Mode:** automatic · **Tier:** 3 (roadmap disposition + next-milestone priority) · **Threshold:** 6+/7 · **Convened by:** head-next (N-1) · **Date:** 2026-07-06

## Decision
Option A — M6 (a068dc3d, Compliant outreach & pipeline) `in_progress → blocked` (external hold: founder email-provider credential #141 + LLM-spend decision); promote M7 (08d3053a, Admin & settings) `todo → in_progress`; fire milestone-decomposer inline for M7's first BUILDABLE-WITHOUT-CREDENTIAL bundle; surface the two founder-gated deferrals non-blocking.

## Why routed to BOARD (not head-next authority)
M6→blocked leg alone is arguably mechanical (documented external-credential gate, wave-10 M5→blocked precedent), but the **next-milestone-promotion (M7 vs M8 vs M10) is a genuine roadmap-priority call with product consequences** — classified as product/taste per always-on rule 17. Combined = Tier-3-adjacent. Under automatic mode → BOARD.

## Votes (7/7 APPROVE, 0 HARD-STOP)

| Member | Vote | Key point / dissent note |
|---|---|---|
| strategist | APPROVE | Reversible status-flip, no spend/schema; M7 carries DKIM/SPF/DMARC = critical path to send-unblock; both live bets hold. Dissent: enforce sending-domain verification + wave-9 auth-hardening/AppShell-404 debt explicitly in-scope at M7 P-3/P-4. |
| realist | APPROVE | Exhaustion EVIDENCED (all 5 ## Scope Pages shipped; wave-13 log predicted this); remaining trio VERIFIED credential/spend-gated per rule 6. Dissent: M7 first bundle MUST be Firm-Profile + Compliance-Profile CRUD, NOT domain-verification-generation (re-imports #141 stockout). |
| risk-officer | APPROVE | BLOCKED is honest state (metric UNMET, send unshipped, not mocked); avoids Hallucinated Milestone Completion; frees slot (no deadlock); trivially reversible. Dissent: M7 P-block MUST run security-scope-tightened + SoD/RBAC gate; audit/compliance tables append-only (WORM). |
| industry-expert | APPROVE | M7-before-send is mandatory prior art (sender-domain auth is hard precondition; deliverability crisis); recordkeeping-before-send is correct compliance-first ordering (SEC 17a-4). Dissent: at send-unblock, verify pre-send gate routes through DKIM/DMARC-verified sub-domain, not primary. |
| counter-thinker | APPROVE | Inversion survives: M7 promotion moves work forward (credential-*management* UI is buildable credential-free), not sideways; a 2nd dry-run send-adapter would be scaffolding that rots. Dissent: real risk is SILENT FOUNDER-GATE — make #141 an explicit founder poll + wave-count watchdog on M6 BLOCKED. |
| user-advocate | APPROVE | Honest "send not yet live" is trust-correct for compliance-first product; shipped SoD + hash-chain + non-bypassable gate = trust primitives; M7 domain-verification on user's critical path. Dissent: composer must NOT dangle a dead Send button — surface not-yet-sendable state in plain language. |
| founder-proxy | APPROVE | Every element traces to documented founder precedent (wave-10 M5→blocked 7/7; wave-13 buildable-vertical pattern; wave-9 M7 re-home of AppShell-404). Both live bets served. Note: frame #141 loudly ("give me this and the outreach loop goes live end-to-end"), not buried. |

## Consolidated dissent (folded into execution)
1. **Decomposition guard (realist + counter-thinker):** M7 first bundle scoped to buildable-without-credential slices (Firm Profile CRUD, Default Compliance Profile, user-management/RBAC, credential-management form UI). Do NOT seed DKIM/SPF/DMARC record-generation (credential-seamed → #141 stockout risk). The credential-*management* UI (paste-key form) is buildable; the record-*generation*/live-verify path is deferred with the ESP credential.
2. **Loud deferral + watchdog (counter-thinker + founder-proxy):** #141 email-credential ask framed as the flagship-unblock, with a wave-count re-surface watchdog on M6's BLOCKED state.
3. **M7 P-block gates (risk-officer + industry-expert + user-advocate):** security-scope-tightened + SoD/RBAC gate; audit/compliance tables append-only; composer honestly surfaces not-yet-sendable state.

## Outcome
APPROVED 7/7 (clears Tier-3 6+/7). Applied at N-1: M6→blocked, M7→in_progress, decomposition fired, deferrals surfaced.
