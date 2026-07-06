# Wave 14 — P-4 Phase 2 drift-check (jenny)

**Scope:** M6 compliance-hardening (security-scope-tightened). Spec 3 blocks (07bd1e1a e2e, 487b0f0c gate mandate-context, f5074df8 REFRAMED oversight page) vs product-decisions + journey map + P-0/P-3/P-gate + followon note.

## Per-item

1. **487b0f0c (gate mandate-context) — MATCHES.** Aligns exactly with `followon-gate-mandate-attribution.md`: it fixes the documented producer-side CAUSE (gate-evaluate row keyed to reusable cross-mandate `outreach-template-version`, not mandate-attributable) by recording mandate/outreach context AT gate-evaluate time from the compose ctx — NOT the lossy template-version→mandate back-derivation the note warns over-captures. Immutable-audit posture honored: ADDITIVE metadata OUTSIDE the HMAC hashed core (HashableEntryFields closed set — head-product verified against audit.service.ts), existing entries byte-identical, verifyChain green over mixed chain (unit + e2e). No edit/delete of existing rows. Gate allow/block regression-guarded. No drift.

2. **07bd1e1a (e2e) — MATCHES.** Lifts the wave-13 DEV-2 hard-gate exactly per the V-block directive: proves the mandate-scoped export captures ALL mandate-derivable producers (incl gate-evaluate post-487b0f0c) + excludes cross-mandate rows (no over-capture) + one export_generated + full-chain verify {ok:true}. Ordering correct (487b0f0c B-2 before 07bd1e1a B-2b gate-capture assertion). Real-DB CI, race-safe migrate, disjoint UUID namespace. The scoped export does not back a live regulator request until this lands green — honored. No drift.

3. **f5074df8 REFRAMED — DRIFTS (LOW/MEDIUM, route-semantics vs journey map).**
   - Reframe INTENT matches M6 ## Scope Pages + is non-duplicative of the shipped approvals queue: correct that "pending-approval outreach" is a dead premise (outreach = compose|send_eligible|blocked; gate decides eligibility; version-approval is the only approve/reject workflow, shipped wave-11). The read-only oversight surface (outreach × gate-verdict × template-version × SoD/approver × mandate) is a genuine, distinct gap. That part MATCHES #80's build intent + does not re-implement wave-11.
   - **DRIFT — journey-map route semantics inverted (named decision: journey row 15 / F10).** journey map row 15 (line 50) canonically assigns `/compliance/queue` → **F10 "Compliance queue (approvals)"** (Comp+Adv). The reframe repurposes that exact route for a NEW read-only OVERSIGHT surface, while the SHIPPED approvals queue actually lives at `/compliance-queue` (hyphen — wave-11 task 2601ba33). So the reframe (a) does NOT collide at the filesystem/Next-route level (slash `/compliance/queue` under existing `compliance/` dir ≠ hyphen `/compliance-queue`; confirmed the slash route does not yet exist), BUT (b) puts an oversight surface on the route the journey map reserved for the approvals flow, and leaves the shipped approvals queue on a route (`/compliance-queue`) the map does not list. Result: dual compliance-queue routes differing only by a slash/hyphen, with the map's F10 route-purpose no longer honored. Real user/nav-confusion + journey-integrity risk, not a hard collision.
   - **Not a #80 drift on WHICH screens** (both compliance-queue + audit-log-export are in #80's 20-screen set; reframe reuses those design patterns) — the drift is purely the route-string semantics vs the F10 mapping.

4. **Deferrals honored — MATCHES.** hard_boundaries: additive; read-only over immutable chain except additive gate metadata; NO credential/send/webhook/LLM/new-SDK. f5074df8 read-passthrough (any approve/reject delegates to EXISTING version endpoints — no new workflow). Founder-gated live-send/AI stay OUT. No drift.

5. **Other contradictions — none** beyond item 3.

## Recommendation
Non-blocking DRIFT. Resolve at B-3 / journey-map regen (T-9) by picking ONE:
 (i) confirm `/compliance/queue` (slash) as the oversight surface AND update journey-map row 15 to re-map F10 approvals to the shipped `/compliance-queue` (hyphen) + add a new oversight row for `/compliance/queue` — removes the semantic inversion; or
 (ii) mount the oversight surface on a non-F10 route (e.g. `/compliance/oversight`) to avoid overloading the F10-reserved `/compliance/queue` string.
Head-builder must police "reconciled-not-duplicate" + the route/nav distinction at B-6; T-9 must regen the journey map so row 15's route↔flow mapping is truthful.
