# Wave 5 — P-0 Frame

## Discover section
- **wave_db_id:** 42f6400a-23a3-4398-bdf9-f861cc4e78f9 (wave_number 5, milestone_id backfilled M2)
- **Prior-work:** M1 DONE; M2 first bundle (tamper-evident audit log) shipped LIVE wave 4 (deploy cd06e8a). This bundle = M2 second half (enforcement). The gate writes verdicts to the wave-4 audit-log append service. security.md §Outreach-compliance-controls specifies the pre-send gate + SoD + suppression + disclaimer design.
- **Roadmap milestone:** M2 (Compliance backbone, in_progress, platform-foundation). This bundle completes M2's "callable pre-send check" success metric.
- **Spec-contract short-circuit:** no-prior-spec → full P-1..P-3.
- **Security-scope:** compliance gate + SoD = compliance/security-critical → security-scope tightened gate at P-4 + T-8 Security. Depends on wave-4 audit log.

## Reframe section
- **Original framing:** compliance rules engine schema (suppression_list, disclaimer_templates, compliance_rules, compliance_approvals) + non-bypassable callable pre-send compliance gate (suppression check + SoD sender≠approver + jurisdiction disclaimers + approval-version content-hash binding) + compliance-settings CRUD UI; every gate verdict written to the wave-4 audit log.
- **problem-framer:** PROCEED. Attacks cause (no single server-side send-eligibility authority) not symptom; non-bypassability honest (callable-contract now, "no send path skips it" enforced at M6 send endpoint — not over-claimed); SoD server-side (approver≠sender from session), content-hash-bound approvals (approval can't be reused for modified content), hard-block suppression/disclaimers, same-tx audit writes. No antipattern. **Carry-forward:** author seed ACs so the gate exposes no skippable fast path; P-4 tracks the M6 send-path wiring as a dependency so "non-bypassable" isn't silently downgraded to "callable but uncalled" at V.
- **ceo-reviewer:** PROCEED (HOLD-SCOPE). Load-bearing half of the wedge (bet #2); completes M2's callable-pre-send-check metric on the wave-4 audit log; de-risks the wedge's hardest part behind a clean gate contract M6 consumes; SoD/suppression/disclaimers irreducible core (not gold-plating). Correctly sequenced (gate + rules CRUD now; outreach composer that CALLS the gate is M6).
- **mvp-thinner:** n/a — skipped (M2 platform-foundation).
- **Disposition:** PROCEED.
- **Final framing:** Build the compliance enforcement layer — rules-engine schema + non-bypassable callable pre-send gate (suppression hard-block + SoD sender≠approver server-side + jurisdiction disclaimers + approval-version content-hash binding) writing every verdict to the wave-4 audit log, + compliance-settings CRUD UI. Carry: gate exposes no skippable fast path (P-2 ACs); P-4 tracks M6 send-path non-bypass wiring as a dependency. Security-scope gate + T-8 apply.
