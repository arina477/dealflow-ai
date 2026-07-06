# Wave 14 — P-0 Frame

## Discover
- wave_db_id: 8f84efbe-8254-448d-b9f2-45798a87064c (wave_number 14)
- Prior-work: waves 11 (outreach) + 12 (pipeline) + 13 (recordkeeping export) shipped M6's core; this wave HARDENS the recordkeeping-export correctness + ships the last M6 page. No overlap-redo.
- Roadmap milestone: M6 (a068dc3d, in_progress, Class=product-feature). wave.milestone_id backfilled.
- Spec-contract short-circuit: **no-prior-spec** → full P-1..P-3.
- Product decisions: buildable-without-credential (no email key/webhook/LLM). 487b0f0c touches the SHIPPED wave-11 compliance-gate (adds mandate/outreach context to its gate-evaluate audit row) — additive; the M2 audit log is append-only + hashed, so a payload-field add affects only NEW entries' hashes (existing entries + verifyChain stay valid — MUST verify at B). Founder-gated send/AI stay OUT.

## Reframe
- Original framing: 3-task M6-hardening bundle — seed 07bd1e1a (mandate-derivation real-DB e2e — the wave-13 DEV-2 hard-gated test), sibling 487b0f0c (record mandate/outreach context on the gate audit row — the wave-13 H1 producer-side fix), sibling f5074df8 (/compliance/queue approval-queue page — last M6 page).
- **problem-framer: PROCEED** — symptom-vs-cause passes (487b0f0c fixes the true producer-side CAUSE of the H1 gap, not a symptom back-derivation patch); hash-chain verified append-only/version-gated (no regression risk); test+fix+page = coherent M6-hardening breadth. **Ordering note for P-3: 07bd1e1a's e2e assertion that gate-evaluate rows ARE captured depends on 487b0f0c landing FIRST.**
- **ceo-reviewer: PROCEED (HOLD-SCOPE)** — scope exactly right; all 3 trace to M6 + both live bets, share one spine (proving/completing the mandate-scoped recordkeeping package); directly de-risks the compliance-first-wedge FALSIFIER (an incorrect regulator package is catastrophic, not cosmetic); live send correctly out (credential-gated) — max meaningful M6 progress achievable now.
- **mvp-thinner: OK (floor_constraint_active)** — the only splittable AC is f5074df8 (/compliance/queue — SoD enforcement already shipped wave-11, so the queue is a review-convenience surface, not mvp-critical); BUT peeling it drops the wave to ~1,800 LOC / 2 tasks below the 2,500 multi-spec floor → the floor BLOCKS the split; refuse. The e2e + gate-fix are a linked hard-gated mvp-critical pair.
- **Merge (PROCEED+PROCEED+OK):** no split (floor blocks peeling the page). Disposition: **PROCEED** with the original 3-task framing.
- **P-3 constraints carried:** (1) ORDERING — 487b0f0c (gate mandate-attribution) before 07bd1e1a's gate-capture e2e assertion. (2) HASH-CHAIN SAFETY — 487b0f0c's audit-payload field-add must NOT break verifyChain over mixed old/new entries (canonical serialization handles the added field; existing entries unchanged); B must prove the deployed chain still verifies. (3) HARD-GATE — once 07bd1e1a lands green, the wave-13 DEV-2 hard-gate on the scoped export lifts.
- Final framing: build the M6 compliance-hardening vertical — the mandate-derivation real-DB e2e (proving the scoped export captures all mandate-derivable producers incl gate decisions + excludes cross-mandate rows) + the producer-side gate mandate-attribution (closing H1, hash-chain-safe) + the /compliance/queue approval-queue page. Buildable-without-credential; additive.
