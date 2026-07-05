# Wave 11 — P-2 Spec (pointer)
**Source of truth:** multi-spec contract in `tasks.description` of seed **102a2f00** (3 blocks). DB wins.
**wave_type:** multi-spec. **design_gap_flag:** false. **claimed_task_ids:** [102a2f00 (template spine), e90a4a99 (composer+gate), 2601ba33 (SoD)].
## AC summary
- **102a2f00 (template spine):** outreach_templates + outreach_template_versions (version_number, content_hash, approval_status, approved_content_hash, required-compliance-block FK→M2 disclaimer) migration 0010; TemplateService create/draftNewVersion/requestApproval; **VERSION-BINDING INVARIANT in service (isUsableForSend: approved AND approved_content_hash==current)**; required-block enforcement; RBAC advisor/analyst-draft + compliance-approve; audited + actor-id; templates-library page.
- **e90a4a99 (composer+gate):** outreach-composer page + **NON-BYPASSABLE server-side pre-send gate** (usable-template + M2-rules + required-disclaimer → send-eligible|blocked, fail-closed, audited; NO client bypass; NO actual send — produces send-eligible record).
- **2601ba33 (SoD):** sender≠approver SoD (server-side, 403 on violation); grant/reject compliance-role-only; approve binds approved_content_hash; audited.
## Invariants (moat): version-binding + non-bypassable-gate + SoD. HARD boundaries: NO LLM/AI-drafting + NO email-SDK/send (later bundles). Reuse M2 disclaimer/audit/rules/SoD + M1 RBAC.
