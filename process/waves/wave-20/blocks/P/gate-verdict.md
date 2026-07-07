# Wave 20 — P-4 Gate Verdict (Phase 1, Attempt 2 — post-rework)

**Block:** P (Product) — M9 internal outreach-activity tracker (multi-spec, 4 tasks)
**Gate:** P-4 · **Reviewer spawn:** head-product (fresh)
**Wave topic:** FIRST MUTABLE M9 write surface — new tenant table `outreach_activity` + audit-logged CRUD service + shared-Zod contracts + RBAC API + /outreach panel. Authors a NEW RLS policy on a NEW write table (write-path isolation is load-bearing). Credential-free.
**Prior:** Attempt 1 = REWORK with 4 write-path test-precision fixes (R1–R4). This attempt verifies they landed.

---

## VERDICT: APPROVED

`head_signoff.verdict: APPROVED` — next_action: `PROCEED_TO_PHASE_2` (karen + jenny + security-auditor).

All four Attempt-1 rework items landed in the source-of-truth seed spec (`d45c73b5.description` "## P-4 HEAD-PRODUCT CORRECTIONS" section), mirrored into `P-2-spec.md` and `P-3-plan.md`.

### R1 — own-row re-home UPDATE (the real falsifiable write-check) — LANDED
Seed mandates: as `dealflow_app` with GUC=firm-A, take firm-A's OWN visible row and `UPDATE ... SET workspace_id=firm-B` → REJECTED (SQLSTATE 42501, new-row fails the derived write-check). PLUS a plain INSERT with explicit firm-B `workspace_id` under firm-A GUC → rejected. Both as `dealflow_app`. The spec explicitly names the naive "UPDATE carrying firm-B id" test as PARTLY VACUOUS (targets an already-invisible row → 0 rows affected → false-green against a FOR-SELECT regression). This is now the correct fails-red write-check. CONFIRMED.

### R2 — FORCE-RLS positive control — LANDED
Spec requires proving ENABLE **+ FORCE** (assert `pg_class.relforcerowsecurity` OR a positive control proving FORCE applies to the table owner), not ENABLE-only. Explicitly names the wave-17/M8 owner-bypass false-green class that a `dealflow_app`-run negative cannot distinguish. CONFIRMED.

### R3 — cross-firm deal-target FK tenancy — LANDED
Spec notes RLS gates only `outreach_activity.workspace_id`, NOT the FK targets. Service MUST validate a provided `pipelineId`/`matchCandidateId`/`mandateId` belongs to the caller's workspace (resolve the FK under the same getDb/GUC — firm-B target invisible → reject as not-found/forbidden), with a test proving a cross-firm FK link is rejected. CONFIRMED.

### R4 — per-verb audit assertions — LANDED
Spec requires an audit-entry assertion for EACH mutation verb (create / update / status-transition / cancel), each verb path covered, plus `verifyChain` ok — replacing the generic "a mutation appends." CONFIRMED.

### No regression (Attempt-1 sound elements intact)
FOR-ALL / USING-only / no-literal-WITH-CHECK policy still mandated (grep-confirmed M8 has none, matched to the 28 tenant tables) · audit-logged-mutations (M2 HMAC append; table is a mutable ledger, correctly NOT wired into the immutable WORM audit_log) · populated-migration test (GAP-4, no WORM-trigger collision) · distinct enum names (wave-11 cluster lesson) · credential-free (zero external send / provider key / ESP / LLM / new SDK) · RBAC advisor+admin 200 / analyst+compliance 403 / anon 401 · `design_gap_flag: false` · `_TBD` metric → founder-poll (digest). All hold.

---

## Security-scope call (re-confirmed): STANDARD Phase-2 (karen + jenny) + a security-auditor red-team — NOT the full T-8 tightened gate.
This authors a NEW RLS policy on a NEW write table (higher-risk than read-only waves 18/19), so I did NOT treat it as vanilla — I add a `security-auditor` red-team on top of standard karen+jenny. But it is a single new policy on the well-established 28-table M8 pattern with NO auth/payment/session/CSRF/rate-limit surface, so the T-8 auto-trigger conditions do not fire and a separate security *stage* is not warranted.

---

## Stage-exit checklist (P-4)
- [x] All AC touching audit-log / RBAC suppression / write-path isolation are binary, observable, machine-readable (R1 SQLSTATE 42501 assertion, R2 `relforcerowsecurity` assertion, R4 per-verb + verifyChain).
- [x] Reviewer responses from Attempt-1 (auditor + framer write-path correction) logically resolved and integrated into the spec contract.
- [x] Every `claimed_task_id` traces to the M9 milestone bet; no scope smuggle (345dfbc6 founder-gated CRM correctly excluded; credential-free boundary held).
- [x] No artifact lacks machine-readability or end-to-end traceability → default-No-Go NOT triggered.

```yaml
head_signoff:
  verdict: APPROVED
  stage: P-4
  attempt: 2
  reviewers: { attempt1_carryover: [security-auditor, problem-framer], phase2_next: [karen, jenny, security-auditor] }
  failed_checks: []
  rationale: >
    All four Attempt-1 write-path test-precision reworks landed in the source-of-truth seed
    spec and both convenience pointers. R1 replaces the vacuous firm-B-id UPDATE with the
    falsifiable own-row re-home UPDATE (42501) + explicit-firm-B INSERT reject as dealflow_app;
    R2 adds the FORCE-RLS positive control against the wave-17 owner-bypass false-green class;
    R3 adds service-level cross-firm deal-target FK tenancy validation with a rejection test;
    R4 requires per-verb audit assertions (create/update/status-transition/cancel) + verifyChain.
    No sound element regressed (FOR-ALL/USING-only/no-WITH-CHECK, audit-logged-not-WORM,
    populated-migration GAP-4, distinct enums, credential-free, RBAC, design_gap false). The
    wave is sound; security-scope is standard Phase-2 + security-auditor red-team.
  next_action: PROCEED_TO_PHASE_2
```

---
## Phase 2 (karen + jenny + security-auditor + Gemini) — merged
- **karen:** APPROVE (5/5 VERIFIED — the RLS USING-only-FOR-ALL policy shape [0014/0017], FORCE+dealflow_app grants [0014/0016], the M2 AuditService.append reuse, the deal-target FK tables, getDb/workspaceAls/RolesGuard/MandateForm all real; R1-R4 folded).
- **jenny:** APPROVE (8/8 MATCHES, 0 DRIFTS — write-path M8-consistency [byte-for-byte the 28-table shape, 0 WITH CHECK repo-wide], internal-only vs external-send/CRM deferrals, mutable-ledger-appends-to-WORM-chain [WORM trigger is audit_log_entries-only], /outreach additive, design_gap false, RBAC advisor+admin, _TBD→digest).
- **security-auditor (red-team):** NOT-fully-sound → 1 HIGH + 2 MED residual holes R1-R4 don't cover → folded as B-BLOCK OBLIGATIONS SF1-SF7 (SF1 kill the DEFAULT_WORKSPACE_ID INSERT fallback [throw-on-null] + empty-ALS-reject test; SF4 extend R3 to 4 FKs + createdBy server-derived; SF5 audit last-in-txn + rollback test; SF3/SF6/SF7 tightenings). Confirmed the core RLS shape + not-WORM + credential-free SOUND.
- **Gemini:** UNAVAILABLE (429 depleted).

## MERGED P-4 VERDICT: APPROVED (Phase 1 attempt-2 APPROVED [R1-R4] + Phase 2 karen+jenny APPROVE + security-auditor findings folded as SF1-SF7 B-block obligations + Gemini UNAVAILABLE)
security-scope: standard Phase-2 + security-auditor red-team (done) — NOT the full T-8 tightened gate. → exit P-block to B-0. design_gap false → B.
## B-BLOCK OBLIGATIONS (MUST honor at B-0/B-2/B-6): R1 own-row-re-home write-check | R2 FORCE positive-control (relrowsecurity+relforcerowsecurity as dealflow_app) | R3+SF4 all-4-FK + createdBy tenancy | R4+SF5 per-verb audit last-in-txn + rollback | **SF1 [HIGH] no DEFAULT_WORKSPACE_ID fallback — throw-on-null + empty-ALS-reject test** | SF6 GAP-4 verifyChain-post-migration | SF7 credential-free channel-labels-only.
- verdict_complete: true
