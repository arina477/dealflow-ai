# BOARD — N-1 milestone disposition (wave 9)

**Slug:** `N-1-milestone-disposition-wave-9`
**Mode:** automatic
**Convened by:** head-next (N-1 Action 6/8 — milestone closure + promotion)
**Decision class:** milestone-disposition (strategic scope/roadmap). Tier-3-adjacent → strict 6+/7 bar applied.
**Bench (project-registered DealFlow BOARD, all "BOARD seat" agents):** founder-proxy, strategist, realist, user-advocate, industry-expert, risk-officer, counter-thinker.

## The decision (3 linked parts)

1. **Close M4 (Mandates & buyer universe) → done.** Success metric ("advisor creates a sell-side mandate w/ buyer criteria + compliance profile AND analyst assembles+enriches a buyer universe ready to rank") fully shipped + live-verified: wave-8 mandate spine (live e57be83) + wave-9 buyer-universe builder (live 937ae18, V-3 APPROVED, C-2 first-try, all 9 T-layers + V-block + L-block passed, CHANGELOG 0.9.0). 6 done + 3 todo children; the 3 todo are M1/M2-era foundation backlog parked under M4, NOT M4-scope. Honest close (metric live-verified, not tickets-closed) — Hallucinated-Milestone-Completion explicitly avoided.
2. **Re-home the 3 non-M4 backlog tasks BEFORE closing** (closing invariant = 0 open children): clear stale wave_id + set milestone_id → clean future seeds. auth-hardening (6fe232e3)→M10; AppShell-polish (d7f716b4)→M7; test-fixture-typing (bfadcec1)→M7.
3. **Promote M5 (AI buyer-seller matching, ranked + rationale) → in_progress.** Roadmap-sequence next; consumes wave-9's ready-to-rank buyer universe; flagship differentiator. Introduces Anthropic/Claude LLM SDK + API spend — deferred NON-BLOCKING to wave-10 P-0/P-4 (external-sdk-integration-rules at P-3); promotion is a status flip only, commits no spend and integrates no SDK today.

Precedent: M3→done + M4→in_progress at wave-7 N-block was BOARD-routed identically.

## Votes (7/7)

| Seat | Vote | HARD-STOP | Note |
|---|---|---|---|
| founder-proxy | APPROVE | none | Traces to wave-7 M3 precedent (BOARD 7/7); same re-home mechanics + honest-completion standard; both live bets name AI matching as core. |
| strategist | APPROVE | none | Highest-leverage sequencing; serves both bets; no parity drift / freemium dilution / compliance shortcut. Wave-10 P-3: enforce Supplier-Power-Abstraction (Claude behind NestJS interface; no proprietary graph into training). |
| realist | APPROVE | none | "Done" claim traced to observable deployed state (V-3/T-9 proof-carrying vs live 937ae18, audit chain live-verified, byte-scan M4/M5 boundary 0 leak). Deferral is a valid circuit-breaker. M5's real proof burden (latency/degradation/auditability/cost) deferred not discharged → wave-10 P-4 must produce load-test + explainability evidence. |
| user-advocate | APPROVE | none | Advances advisor's lived reality; M5 explainability-first by design. AppShell 404 deferral acceptable (nav⊆RBAC by construction, 0 DAU) but re-home should target a NEAR milestone — 404s on visible nav must not survive to first real pilot login. |
| industry-expert | APPROVE | none (conditional flag) | M4 mirrors DealCloud/Grata/Sourcescrub sell-side workflow; M4→M5 sequencing (universe before ranking) is correct prior art; "deterministic pre-score first, LLM-rationale layered" is right for M&A. M5 LLM MUST enter only via zero-retention enterprise DPA endpoint; RBAC-scoped single-mandate RAG context + rationale-as-read-event — verify at M5 P-4, not deferrable to M6. |
| risk-officer | APPROVE | none | Verified against tree: migrations 0006/0008 additive-only; canonical-serialize-before-HMAC (no chain break); audit-log INSERT/SELECT-only + immutability trigger (WORM/SEC 17a-4). Re-home non-destructive. M5 = status flip only (no SDK in tree yet, grep-confirmed). Carry-forward: (1) LLM abstraction gateway MUST land in same wave as Anthropic SDK; (2) auth-hardening deferral OK only while invite-only + 0 pilot users. |
| counter-thinker | APPROVE | none | Inverted each part; no catastrophic mechanism. Ready-to-rank is real persisted state (buyer_universe.status='submitted' + submit guards + M5-consumable shape), NOT a stub; M4/M5 boundary enforced in code+schema; audit last-in-txn rollback-on-failure. No dependency deadlock (M5 reads shipped buyer_universe). **Most likely crack (non-catastrophic): auth-hardening re-homed untouched M1→M2→M3→M4→M10 = 4th perpetual-parking hop; compliance-first product should carry explicit scheduling commitment or founder-visible security-debt flag, not a 5th silent carry.** |

## Consolidated outcome

**APPROVED — 7/7 (exceeds strict Tier-3 6+/7 bar). 0 HARD-STOP. 0 REJECT. 0 ABSTAIN.**

Non-blocking dissent captured for action:
- **Security-debt flag (counter-thinker + risk-officer + user-advocate):** auth-hardening (6fe232e3) re-homed to M10 carries a founder-visible security-debt flag + conditional trigger — MUST pull forward before any public/pilot auth surface goes live (invite-only + 0 pilot users is the only current mitigation). Recorded in product-decisions.md.
- **AppShell 404 (user-advocate):** d7f716b4 → M7; must resolve before first real pilot login; nav⊆RBAC-by-construction holds interim.
- **Wave-10 M5 carry-forwards (strategist / industry-expert / risk-officer / realist):** LLM abstraction gateway must land WITH the Anthropic SDK (same wave); zero-retention enterprise DPA endpoint; RBAC-scoped single-mandate RAG context; explainable-rationale-as-read-event verified at M5 P-4; load-test + explainability evidence required at P-4. LLM API spend surfaces as founder Tier-3 (money) at wave-10 P-0/P-4.

Morning digest: clean decision (7/7), surfaces under "Clean decisions".
