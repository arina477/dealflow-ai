# Roadmap refresh — strategist proposal (2026-07-09)

**Lens:** strategist (bet alignment · direction · competitive position).
**Trigger:** founder "refresh the roadmap" → roadmap-planning-ritual Step 3. Core need: replace `_TBD` success metrics with concrete, lockable definitions of done so the decomposition ritual (which REJECTS `_TBD`) stops stalling the loop (paused 4×).
**Grounding:** `founder_bets` (2 live), `milestones` (13 rows, live DB read), `product-decisions.md`, `competitive-benchmarks/INDEX.md`. No browser sweeps re-run — existing evidence referenced.

## North-star bets (unchanged)
1. **Integrated platform beats stitched-together tools for M&A.** (`bf09e8cc`)
2. **Compliance-first outreach is a durable wedge for M&A advisory.** (`c541045c`)

Competitive read (INDEX.md): the white space — sourcing + AI ranked matching + compliance-first outreach in ONE workflow — is still unoccupied. Compliance-first audited outreach validates bet #2 (zero competitors have it). Datasite (Grata + SourceScrub, $500M) is the 12–18-month consolidation threat; urgency is shipping and proving the integrated H1 loop before their combined stack matures.

---

## CRITICAL FINDING — three milestones carry a STALE `blocked` flag

M5, M6, M7 are `status='blocked'` but **none has a `## Blocked reason`** in its description, and their task ledgers are:
- **M5** — 3/3 tasks DONE. Ranked matching engine + fit-scores + rationale shipped.
- **M6** — 12/12 tasks DONE. Outreach composer, **non-bypassable pre-send gate**, **sender≠approver SoD**, versioned templates, event tracking, **HMAC audit-log recordkeeping export**, pipeline — all shipped.
- **M7** — 10 DONE + 4 todo, where all 4 todo are hardening/polish (test-fixture typing, invite key-space widening, opaque pagination cursor, field-mapping constraint) — none required by the success metric.

The `blocked` state is an orphaned flag, not real external hold. Per `roadmap-lifecycle.md`, `blocked` means an external legal/compliance hold — that condition does not exist here. **The single highest-leverage act of this refresh is not writing new metrics — it is un-sticking these three flags so the loop recognizes that the core integrated loop (bets #1 AND #2) is ALREADY SHIPPED.** M6 is literally the compliance-first-outreach wedge, built and done.

Strategist read: the loop was not stalling on missing metrics alone; it was stalling because the milestones proving BOTH bets were parked in a dead-end state with no exit condition and no owner. Fix that first.

---

## Per-milestone proposals

Format per milestone: **Metric** (measurable) · **Disposition** · **Why (1 line)**.

### M9 — Integrations & insight  *(in_progress, 21 DONE / 0 open)*
- **Metric:** "A firm connects one external CRM (Twenty live today; Affinity adapter built) and real companies flow into DealFlow sourcing, AND an advisor views a throughput/response-rate analytics view — verified once on the live self-hosted Twenty integration." (Already met: Twenty CRM live + verified per 2026-07 decisions; adapters built.)
- **Disposition:** **KEEP → close to `done`.** It already meets a real metric.
- **Why:** Substantially delivered; a lockable metric it already satisfies lets N-1 close it cleanly instead of leaving H2's first proof open. Do NOT expand scope to chase Salesforce/DealCloud/LinkedIn/intent-signals now — that is feature-parity drift (Feature Parity Hubris) against a bet already proven by one live CRM.

### M5 — AI buyer-seller matching  *(blocked, 3 DONE / 0 open)*
- **Metric:** "For a mandate with a buyer universe, the system returns a ranked buyer list with integer fit-scores (0–100) + explainable rationale per buyer; an advisor can accept/reject to build a shortlist that feeds outreach." (This is already the milestone's own prose metric — it is concrete, not `_TBD`.)
- **Disposition:** **UNBLOCK → `done`.** No open tasks, all scope shipped, stale flag.
- **Why:** Blocked with no reason and everything shipped; it is the matching half of bet #1. Recognize completion.

### M6 — Compliant outreach & pipeline  *(blocked, 12 DONE / 0 open)* — **the bet-#2 milestone**
- **Metric:** Already concrete in prose: "An advisor sends a compliance-checked, approved, tracked outreach to a shortlist; every message is immutably recorded in the tamper-evident audit log; compliance can export a verifiable recordkeeping package; replies/opens advance buyers through the pipeline — ONE live mandate flows sourcing → match → compliant outreach → pipeline end-to-end."
- **Disposition:** **UNBLOCK → `done`.** All 12 tasks DONE including the non-bypassable gate + SoD + audit export.
- **Why blocked / recommendation:** No `## Blocked reason` exists — the flag is orphaned. This milestone IS the compliance-first-outreach wedge and it is built. Unblocking + closing it is the single most bet-aligned act available. **Recommend a one-time human/E2E confirmation** that a real mandate actually traverses the full loop end-to-end (the metric's binding claim) before flipping to `done` — proof-traced, not inferred from green tasks. If that E2E holds, close; if a genuine gap surfaces, author a tight remaining-slice bundle rather than reopening the whole milestone.

### M7 — Admin & settings  *(blocked, 10 DONE / 4 todo)*
- **Metric:** "An admin connects a data source, invites users and assigns roles, and verifies a sending domain (DKIM/SPF/DMARC) that gates outreach — all three flows pass live." (Milestone's own prose metric; concrete.)
- **Disposition:** **UNBLOCK → keep `in_progress` OR close-with-follow-ups.** The 4 open tasks are hardening (typing, key-space, opaque cursor, field-mapping constraint), none gating the metric. Re-parent them as non-blocking follow-ups (precedent: M1 close, product-decisions 2026-07-03) and close M7 if the 3 admin flows pass; else finish only the domain-verification path.
- **Why:** Core admin scope shipped; the residue is polish. Do not let 4 hardening tasks hold H1's admin milestone in a false `blocked`.

### M8 — Pilot-partner workspace  *(done, metric was `_TBD`)*
- **Metric (backfill for the record):** "The design-partner firm operates in an isolated workspace_id-scoped space with row-level security; a cross-firm read returns zero rows — verified by an isolation E2E."
- **Disposition:** **KEEP `done`;** backfill the metric prose so the ledger isn't retro-`_TBD`.
- **Why:** Already closed; a concrete metric on the record supports the M11 Chinese-Wall design that builds on it.

### M11 — Multi-tenant SaaS platform + billing  *(todo, 1 task)*
- **Metric:** "An external M&A firm self-provisions a tenant through signup, is placed in a tenant-isolated workspace where a cross-tenant data read returns zero rows (Chinese-Wall confidentiality), and is billed on a live subscription — one real self-provision + isolation-verified + first invoice charged."
- **Disposition:** **KEEP, DEMOTE below the pilot proof (stays H3).** Note the blocking prereq (`2867d087`) and that tenant isolation must extend M8's RLS to a hard Chinese-Wall before any external self-serve.
- **Why:** Monetization is real and bet-aligned long-term, but self-serve multi-tenant billing is the **freemium/SMB-dilution + premature-scaling trap** if pursued before the pilot proves retention at the 1,000-DAU canary. Metric must bind tenant isolation (M&A confidentiality is non-negotiable), not just "billing works." Build only after the pilot loop is proven.

### M12 — Deal network & predictive models  *(todo, 0 tasks)*
- **Metric:** "A predictive deal-readiness model lifts match-acceptance rate by ≥10 percentage points over the deterministic M5 baseline on a held-out mandate set (n≥ a pre-registered minimum), measured on real accept/reject outcome data."
- **Disposition:** **KEEP, DEFER (H3, gated on data volume).** Cannot be built until M5/M9 have accumulated enough real accept/reject outcomes to train + hold out honestly.
- **Why:** Bet-aligned (proprietary data moat) but the metric is unachievable until outcome data exists. Deferring is correct; the ≥10pp-on-holdout bar keeps it from shipping model theater. Guardrail: predictive models must not leak relationship graphs to public LLM training (proprietary-moat defense).

### Cancelled / done (no action)
- **H1 broad seed** — `cancelled`, superseded by M1–M12. Leave.
- **M1, M2, M3, M4, M10** — `done`. M10 (recordkeeping export at light posture) already closed. Leave.

---

## Tier ordering — what the loop builds NEXT

**Sharpest next milestone: finish and CLOSE the H1 integrated loop by un-sticking M5, M6, M7 — starting with M6 (the compliance-first-outreach wedge).**

Rationale (asymmetry / single leverage point): the loop's real bottleneck is not un-authored future scope — it is that the two milestones proving BOTH live bets (M5 = integrated matching, M6 = compliant outreach) are ALREADY BUILT but parked in a stale `blocked` state with no exit. Building anything new (M11 billing, M12 models, more M9 CRM adapters) before recognizing that H1 is shipped would be: (a) feature-parity drift, (b) premature scaling ahead of the pilot, or (c) model theater on absent data — each fails the core competitive challenge. Concentrate resources on **confirming the end-to-end live-mandate loop (M6's binding metric) via a real E2E, then closing M5/M6/M7.** That converts "we think it's done" into a proven, demonstrable integrated loop — the exact thing the pilot partner and the 1,000-DAU canary path need, and the exact moat Datasite cannot yet replicate.

Build-order after H1 closure: **M9 close (already met) → then hold.** Do not open M11/M12 until the pilot loop shows retention. If a genuine remaining slice surfaces in the M6 E2E, that slice is the next build — not a new milestone.

## New milestone warranted?
**No.** The bets are served by existing milestones; the white space is covered; adding scope now would dilute focus. The one structural gap — hardening the pre-send gate and audit chain under real pilot load — lives inside M6/M7 follow-ups, not a new milestone. Resist padding.

---

## Dimension check (strategist lens)
- Strategic Diagnosis Alignment: **PASS** — targets the true bottleneck (stale-blocked shipped bets), not vague growth.
- Compliance-First Identity: **PASS** — M6 unblock + E2E confirmation defends the non-bypassable gate + audit chain as the product.
- Coherent Action Sequencing: **PASS** — close H1 before opening H3; metrics are lockable, no `_TBD`.
- Market Vertical Discipline / Freemium trap: **PASS** — M11 demoted + isolation-bound; no SMB/freemith drift.
- False-positive economics / model realism: **PASS** — M12 gated on real holdout data, ≥10pp bar.

**No hard-stop.** One recommendation that needs human/E2E sign-off (not a hard-stop): confirm the M6 live-mandate loop actually traverses end-to-end before flipping `done` — proof-traced per the metric's binding claim.

*(Recommendations, not commitments — these feed the founder AskUserQuestion checkpoint at Step 4.)*
