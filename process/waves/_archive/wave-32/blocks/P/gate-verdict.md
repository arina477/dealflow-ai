# Wave 32 — P-4 Gate Verdict (Phase 1) — head-product

**Block:** P (Product) | **Wave:** 32 — M9 self-host open-source Twenty on our infra as the private company/contact data store (founder pivot 2026-07-08). FOUNDATIONAL slice: deploy self-hosted Twenty (4-service + S3) → auto-provision its API key → seed sample companies → activate DealFlow's READ connection (reuse the wave-31 adapter) → LIVE-verify real companies flow into sourcing search.
**Wave kind:** INFRA/DEVOPS (self-host a 3rd-party OSS app) | **claimed_task_ids:** [878c3123] | **design_gap_flag:** false → D-skip.

```json
{
  "agent": "head-product",
  "stage": "P-4",
  "status": "gating",
  "block_state": {
    "claimed_task_ids": ["878c3123"],
    "design_gap_flag": false,
    "spec_contract": "task 878c3123 description + P-2 AC (6 ACs, load-bearing set)",
    "escalation_log": [],
    "reviewer_verdicts": {
      "problem-framer": "REFRAME (3 folds — all folded into P-0 disposition)",
      "ceo-reviewer": "PROCEED (HOLD-SCOPE)",
      "mvp-thinner": "OK (devops-class, _TBD-metric hard-rule; nothing to peel)"
    }
  }
}
```

---

## VERDICT: APPROVED (Phase 1) → route to Phase 2 reviewers

Every P-4 Phase-1 stage-exit check ticks from concrete artifacts. No un-checkable compliance/audit/RBAC criterion, full traceability to the P-0 frame and the 2026-07-08 founder pivot, scope correctly bounded to the foundational read-activation slice with write-path/screens/prod-hardening deferred. The wave's KEY RISK (headless API-key provisioning on a fresh instance) is de-risked with a sound primary + fallback + escalation hatch. Phase-1 APPROVED is conditional on the Phase-2 reviewer matrix (karen / jenny / security-auditor) returning clean; the final block signoff is issued after Phase 2.

---

## Judge dimensions (the 7 asked)

1. **Bet/pivot alignment — CONFIRMED.** Traces verbatim to the 2026-07-08 pivot (`product-decisions.md` L508–516): "Private data store, our UI stays" — self-host open-source Twenty on OUR infra as store-of-record; DealFlow UI stays and reads/writes to it; NOT Twenty cloud. ceo-reviewer traces it to both live bets (integrated-platform-beats-stitched-tools + compliance/data-ownership-wedge) and to M9 (in_progress). Data-ownership/compliance rationale is sound for an M&A-advisory compliance-first product (`compliance_regime: none` but compliance FEATURES are MVP-core; no third-party SaaS custody of deal-adjacent data is a coherent wedge expression). The wave also dissolves the 3-wave (w29→w30→w31) founder-key-gated stall — genuine disproportionate value.

2. **deploy-doc-FIRST — CONFIRMED.** P-3 Action 1 + P-2 AC-1 both mandate authoring `command-center/dev/SDK-Docs/Twenty/twenty-selfhost.md` (service topology, env, pinned images, API-key mechanism) from Twenty's OFFICIAL self-hosting docs + GitHub source BEFORE any deploy. This is the SDK-doc-first discipline (external-SDK-integration-rules) correctly applied to an infra target. The doc does not yet exist (only the wave-31 cloud-adapter `twenty.md` is present) — correct for a pre-build P-4 gate; B-1 authors it. problem-framer already grounded the 4-service + S3 + pgvector-caveat + MESSAGE_QUEUE_TYPE=pg-boss reality against real Twenty docs, so the research-first bar is met, not aspirational.

3. **API-key auto-provisioning (the wave's KEY RISK) — CONFIRMED sound de-risking.** The plan spikes it EARLY (before wiring), with **DB-seed into Twenty's Postgres as PRIMARY** — genuinely feasible because we own the self-hosted instance's DB, so a direct INSERT of an API-key/token row (per the schema found in the deploy-doc research) bypasses the undocumented GraphQL chain entirely and is far more robust than depending on undocumented signUp→signUpInNewWorkspace→createOneApiKey→generateApiKeyToken behavior (captcha-off / first-workspace-unrestricted assumptions that problem-framer flagged as undocumented). GraphQL chain is the fallback; **ESCALATE to head-builder if BOTH fail**. This is exactly the escalation hatch a load-bearing undocumented-behavior risk requires — it prevents the "discovered at C-2" failure mode and is what makes the wave self-completable with NO founder key (rule 6/10). Note for Phase 2: karen should reality-check whether the DB-seed path is genuinely feasible against Twenty's actual token-table schema (hashing/format of the token secret) — this is the single most important thing to confirm.

4. **The SEED step — CONFIRMED, closes the "empty-instance = unverifiable" catch.** problem-framer's antipattern-#3 catch (demo-path tunnel vision: a fresh Twenty is EMPTY, so "real companies flow into sourcing search" has nothing to verify) is folded into P-0 disposition step 4, P-1, P-2 AC-4, and P-3 Action 1.4 as an explicit SEED step (a handful of realistic companies+contacts via API/DB). Without it live-verify is unsatisfiable; with it the live-verify becomes a real end-to-end read. Correctly scoped to the MINIMUM records needed to prove the read path (mvp-thinner confirmed large-seed is OUT).

5. **Adapter reuse — CONFIRMED, no rebuild.** The wave-31 `apps/api/src/modules/sourcing/adapters/twenty.adapter.ts` (verified present) is reused UNCHANGED; only TWENTY_BASE_URL repoints at the self-hosted instance. problem-framer confirmed this is REAL not assumed — the adapter reads purely from TWENTY_BASE_URL + TWENTY_API_KEY with an https-only SSRF guard, and self-hosted Twenty exposes the identical /rest/ surface (GET /rest/companies, Bearer auth, cursor pageInfo). No DealFlow migration, no new DealFlow API, no UI change (P-3 Actions 2/3 both = NONE).

6. **SECURITY SCOPE (tightened — new infra + multiple new secrets) — CONFIRMED, routed to Phase 2.** The security-scope-tightened gate fires (new infra + multiple new secrets). The secret-hygiene AC is explicit and binary across P-2 AC-2/3 and P-3 Action 4 / compliance_invariants: APP_SECRET, Twenty PG creds, Redis, S3 creds, TWENTY_API_KEY, TWENTY_BASE_URL are ALL orchestrator-generated (openssl/crypto) + env-set on the platform + NEVER committed; NO founder credential. **security-auditor is routed into Phase 2** to red-team the new-secrets / self-hosted-infra surface (secret exposure in the self-hosted stack, the DB-seeded token's storage, SSRF against the internal Twenty URL, the shared APP_SECRET across server+worker).

7. **Scope discipline — CONFIRMED.** Foundational ONLY: deploy + read-activate + live-verify. WRITE-path (DealFlow→Twenty) + company/contact SCREEN-migration + prod-hardening (backups/HA/monitoring) are correctly DEFERRED to later waves (pre-deferred by the founder pivot, re-confirmed by mvp-thinner + ceo-reviewer + P-3 hard_boundaries). Every P-3 step traces to the P-0 bet — no Scope Smuggle, no speculative future-proofing. The **ops-burden** (upgrades/patching/uptime/backups we now own) is flagged founder-visible (surface at N). **M9 success-metric _TBD** flagged for roadmap-refresh (non-blocking). design_gap false → D-skip.

---

## Stage-exit checklist (P-4)

- [x] All ACs touching audit-log / pre-send compliance gate / RBAC suppression are binary+observable+machine-readable — **N/A this wave** (no audit-log / compliance-gate / RBAC change; infra deploy + read-activation only. No compliance-invariant surface is touched — the reason this isn't a REWORK for missing binary compliance ACs is that there is no compliance mutation in scope). Secret-hygiene ACs ARE binary (env-set / never-committed / no-founder-cred, machine-checkable at C/V).
- [x] Cross-review responses logged + resolved + integrated — P-0: problem-framer REFRAME (3 folds ALL folded into disposition steps 1–4 + P-1/P-2/P-3), ceo PROCEED, mvp OK. Phase-2 matrix (karen/jenny/security-auditor) dispatched below; final signoff after their return.
- [x] [STABLE] Gate defaults to No-Go on any un-machine-readable or un-traceable artifact — every claimed_task_id + AC traces to P-0 and the 2026-07-08 pivot; the API-key undocumented risk carries an explicit ESCALATE hatch rather than an aspiration. No un-checkable criterion found.

**failed_checks:** [] (Phase 1)

---

## Anti-pattern scan — CLEAN

- **Scope Smuggle** — none; write-path/screens/hardening deferred, every AC traces to the bet.
- **The Infinite Horizon** — avoided; this is a vertical slice (deploy→key→seed→read→verify) that delivers an end-to-end live-verifiable increment, not horizontal infra with no proof (mvp-thinner explicitly rejected the deploy-only split).
- **Orphaned Edge Case / happy-path tunnel** — the empty-instance catch (SEED) and the undocumented-key catch (SPIKE + ESCALATE) are the two negative-space cases and both are explicitly specced. Vendor-failure/degradation on the self-hosted stack (service-unhealthy, S3 unreachable) is the residual — flag for karen Phase-2.
- **Delegation Abdication** — problem-framer's REFRAME was cross-examined against the pivot and the true lift, not rubber-stamped; folded, not merely appended.
- **The Un-Ranked / _TBD metric** — M9 metric is _TBD; correctly flagged for roadmap-refresh, non-blocking because the founder directive seeds the work directly.

---

## Phase-2 routing (reviewers)

- **karen** — feasibility reality-check: is the DB-seed API-key path genuinely feasible against Twenty's actual token-table schema (secret hashing/format, FK to workspace/user)? Is the 4-service + S3 deploy genuinely standable on the deploy target? Is the live-verify REAL (seeded records actually traverse Twenty → adapter → sourcing search, not a mocked green)? Red-team the self-hosted-instance failure modes (service-unhealthy, S3 unreachable, pgvector-fatal).
- **jenny** — spec-vs-pivot-decision consistency (does the 6-AC contract match the 2026-07-08 "private data store, our UI stays" directive?) + adapter-reuse verification (wave-31 twenty.adapter.ts reused UNCHANGED, TWENTY_BASE_URL repointed, no DealFlow migration/API/UI change).
- **security-auditor** — the tightened new-secrets / self-hosted-infra gate: all 6 secrets orchestrator-generated + env-set + never-committed + no-founder-cred; the DB-seeded token at rest; internal-URL SSRF; shared APP_SECRET across server+worker.

---

```yaml
head_signoff:
  verdict: APPROVED            # Phase 1 — conditional on Phase-2 matrix returning clean
  stage: P-4
  phase: 1
  reviewers:
    problem-framer: REFRAME (3 folds folded)
    ceo-reviewer: PROCEED (HOLD-SCOPE)
    mvp-thinner: OK
  phase_2_dispatch: [karen, jenny, security-auditor]
  failed_checks: []
  rationale: >
    Foundational self-host-Twenty read-activation slice traces cleanly to the 2026-07-08
    founder pivot and to M9. deploy-doc-first (twenty-selfhost.md before deploy) + 4-service+S3
    scope + API-key auto-provision spiked EARLY with DB-seed PRIMARY (feasible since we own the
    instance DB) / GraphQL fallback / ESCALATE-if-both-fail hatch + explicit SEED step (closes the
    empty-instance unverifiable catch) + wave-31 adapter reused unchanged + all 6 secrets
    orchestrator-generated/env-set/never-committed/no-founder-cred + a REAL live-verify. Scope
    correctly bounded — write-path/screens/prod-hardening deferred; ops-burden + M9 _TBD flagged
    founder-visible. No un-checkable compliance/audit/RBAC criterion (none in scope). Phase-1 APPROVED.
  next_action: DISPATCH_PHASE_2_REVIEWERS   # karen + jenny + security-auditor; final signoff after return
```
