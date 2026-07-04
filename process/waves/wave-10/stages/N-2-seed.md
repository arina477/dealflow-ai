# N-2 — Seed (wave 10 → wave 11 handoff)

```yaml
n_stage_verdict: COMPLETE
verdict_evidence:
  - "seed task id: 102a2f00-1ac5-442c-a328-a31fedb2597c"
  - "bundled siblings: 2"
  - "validation: pass (all 3 rows status=todo, wave_id=NULL, milestone_id=a068dc3d; both siblings parent=seed)"
seed_task_id: 102a2f00-1ac5-442c-a328-a31fedb2597c
seed_task_title: "Build versioned template library spine + templates-library page"
bundled_sibling_ids:
  - e90a4a99-2071-4084-93cc-5fc1b8a37477   # outreach composer + non-bypassable server-side pre-send compliance gate
  - 2601ba33-c9b5-40e2-b932-507f53a0226a   # sender!=approver SoD + template version-binding
claimed_task_ids:
  - 102a2f00-1ac5-442c-a328-a31fedb2597c
  - e90a4a99-2071-4084-93cc-5fc1b8a37477
  - 2601ba33-c9b5-40e2-b932-507f53a0226a
active_milestone_id: a068dc3d-8f77-4d01-ba1d-bbc6ed9b16bc   # M6
queue_exhausted: false
validation_failed: false
note: >
  head-next N-2 gate: APPROVED (re-gate). Clean vertical slice (DB→service→API→UI, one
  compose-a-compliant-message workflow), no ghost dep on the unbuilt M5 LLM half or unmerged PRs,
  buildable on shipped M2 rules engine + M2 AuditService + M5 deterministic shortlist with ZERO
  Anthropic/email SDK, compliance-critical ACs at spec time (non-bypassable server-side pre-send gate
  writing M2 audit in-txn; sender!=approver SoD; content-hash template version-binding; audit
  last-in-txn), single-session sized (~3000-4500 LOC, ≤~50 files), send/email-SDK/tracking/
  approval-queue-screen/pipeline/recordkeeping-export all deferred to later M6 bundles. Wave-11 P-4
  flags (security-scope-tightened + SoD/RBAC gate + concurrent-send P99 load-test) embedded, not run.
```
