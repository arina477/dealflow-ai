# V-1 jenny — Wave 21 (M9 process/DX hardening, DOCS wave) — COMPACT

**Verdict: APPROVE**

**Artifact under review:** `command-center/testing/ci-e2e-authoritative-policy.md`
**Authoritative spec:** seed `1d95cac0` (P-2 SCOPE head) + P-0 REFRAME (scope → (C) CI-e2e-authoritative; close B/D/E by PRODUCT-#1; no prod-cred provisioning).

---

## Check-by-check

### 1. Artifact matches (C) scope — MATCHES
- **DECLARES CI-e2e-authoritative for named invariants:** § 1 states the authoritative verification is the CI e2e suite run as non-superuser `dealflow_app` (migration 0016) on postgres:18, NOT a live-authed in-app check. § 2 enumerates every invariant the P-0 LOAD-BEARING list named — workspace-isolation read-negative-read (ISO-1), write-path own-row-re-home→42501 (OAE-1), no-DEFAULT-placement (OAE-1/OAE-2 falsifiability notes), RBAC 403/401 (compliance.rbac.spec / audit-log.rbac.spec rows), audit-logged-mutation last-in-txn + verifyChain (OAE-9..13), SoD (dedicated row). Each row cites a concrete e2e/spec file + marker + a falsifiability ("Falsa if…") clause → **falsifiable, not process-theater** (satisfies P-2 load-bearing).
- **Documents the live-authed-deferral:** § 3 gives the two structural constraints (single-tenant prod; no committable prod SuperTokens creds — cites CLAUDE.md rule 2). Matches P-0 scope item 2.
- **Sets a later-trigger:** § 3 "Deferred Until" names the two trigger conditions (2nd prod/staging tenant + provisioning automation, OR committable non-destructive advisor+admin fixture / populated test-accounts registry). Matches P-0 scope item 3 verbatim in intent.
- Consistent with the P-0 REFRAME — this is exactly what (C) asked for.

### 2. B/D/E closed-by-PRODUCT-#1, not re-authored — MATCHES
- § 4 closes B/D/E by explicit reference to `PRODUCT-PRINCIPLES.md` § Rule #1, quoting the promoted line, and states "This document **does not** re-author or duplicate that rule." No new B/D/E artifact was created; the three sub-items map onto Rule #1's three clauses (real source column / not noise by construction / qualify low-n). This is the one-line-note closure the reframe demanded — **no process-theater re-doc**. Consistent with the reframe (snacking/antipattern avoided).

### 3. No prod-cred provisioning — MATCHES
- The artifact **declares and defers**; it provisions nothing. § 3 Constraint 2 affirmatively states prod SuperTokens creds cannot be committed and the test-accounts registry stays gitignored/empty. No `.env`, no secret, no fixture population, no code/migration/UI. Consistent with the rule-2 boundary and P-0 "NO prod-cred provisioning (security)."

### 4. Codifies the wave-17..20 recurring decision, not a new/divergent policy — MATCHES
- § 3 "do NOT re-derive the rationale in every wave" and § 4/§ 5 explicitly frame this as sanctioning the disposition V/T already reached repeatedly ("Live-authed check deferred — CI-authoritative"). The named invariants reference the as-`dealflow_app` e2e suite that waves 17–20 stood up (ISO/OAE/AMP/MFC/RBAC markers). This is a codification of the thrice-repeated (w18/19/20) deferral, not a divergent stance. Consistent.

### 5. Spec-gap / OAE-3 flake / next-wave — MATCHES (no material gap)
- **OAE-3-class flake correctly SEPARATE:** The C-1 stage file root-causes the OAE-3 RED as a pre-existing wave-20 shared-DB global-COUNT(*) count-pollution flake (cc48c34), zero wave-21 app/test delta, confirmed flake by green on identical tree; logged as fix-forward for L-1, `fix_up_cycles: 0`. It is correctly NOT folded into this docs deliverable — a test-defect fix-forward is out of scope for a declare-only policy artifact. The policy doc does not (and should not) mutate the OAE-3 test. Correctly separate.
- **Minor observations (non-blocking, do not affect verdict):**
  - The OAE-3 flake itself is a live falsifiability caveat on invariant OAE-3 (§ 2 row: OutreachActivityService.create empty-ALS rejection). The policy's "falsifiable" claim for that row is sound in intent, but the invariant's e2e assertion currently carries a shared-DB global-count fragility. Recommend a next-wave note: harden OAE-3 to a seeded-row-scoped count (mirrors the wave-17 AMP-4 shared-DB-key fix pattern) so the authoritative test is deterministic. This is a test-hardening follow-up, correctly downstream of L-1, not a V-1 blocker.
  - OBS-W17-1 (hardcoded-HMAC-key-in-e2e, 3rd sighting, flagged as this wave's promotion turn in the checklist) is a spec-hardening lens the L-2 distill should apply; the policy doc's declare-only scope does not owe it. Noted for L-block, not a spec-gap in this artifact.
- No divergence between artifact and spec intent; no missing required section (§1 statement, §2 named-invariant table, §3 deferral+trigger, §4 B/D/E closure, §5 V/T usage, §6 enforcement all present).

---

## Tally: 5 MATCHES / 0 DRIFTS

**APPROVE.** The artifact faithfully implements the (C)-only reframe: a falsifiable, named-invariant CI-e2e-authoritative declaration + single-source deferral rationale + later-trigger, with B/D/E closed by one-line PRODUCT-#1 reference and zero prod-cred provisioning. OAE-3 flake correctly handled as a separate C-1 fix-forward (L-1), not part of this docs deliverable. Next-wave note: harden OAE-3 to seeded-row-scoped count for deterministic authoritativeness.
