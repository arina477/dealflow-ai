# Wave 11 — P-0 Frame

## Discover
- wave_db_id: 25f2288b-d557-4d09-8945-5197f7b3dac4 (wave_number 11)
- Prior-work: reuses M2 disclaimer_templates (required-compliance-block source) + AuditService (last-in-txn) + the M2 content-hash + approval-version-binding pattern (product-decisions #4; the wave-5 compliance backbone), M1 RolesGuard/getUserWithRole (advisor/analyst draft, compliance approves), wave-6/7 read-passthrough + SSR-hydrate. No prior wave built outreach templates.
- Roadmap milestone: M6 "Compliant outreach & pipeline" (a068dc3d…, in_progress, product-feature, T1 — the compliance-first outreach WEDGE; "one live mandate sourcing→match→compliant-outreach→pipeline end-to-end"). Depends M2+M5(deterministic-shipped). wave.milestone_id backfilled.
- Spec-contract short-circuit: **no-prior-spec** (prose seeds) → full P-1..P-3.
- Product decisions: no Tier-3 THIS bundle. The LLM-drafting (later M6 bundle) shares M5's BLOCKED founder LLM-spend gate; the transactional-email SDK / send-path is a later bundle — both OUT of this slice.
- Designs: templates-library.html + outreach-composer.html + compliance-queue.html EXIST → design_gap likely FALSE (D skips; confirm at P-1).

## Reframe
- **Original framing:** versioned compliance-safe template store (outreach_templates + outreach_template_versions: version_number/subject/body/required-compliance-block-FK→M2-disclaimer/content_hash/approval_status/approval-version-binding) + TemplateService (create/draftNewVersion/requestApproval; VERSION-BINDING INVARIANT in service) + required-compliance-block enforcement + templates-library page. Siblings: composer + non-bypassable pre-send gate (e90a4a99), sender≠approver SoD + version-binding (2601ba33). RBAC advisor/analyst-draft + compliance-approve; audited; actor-id. NO LLM/AI-drafting + NO email-SDK/send (later bundles).
- **problem-framer:** PROCEED — cause-layer framing (approved-template-version store as the load-bearing container every downstream reader consumes); the version-binding invariant correctly in the SERVICE (mirrors verified-live M2 disclaimer approval-version binding + decision #4); LLM-drafting + email-SDK/send correctly deferred to later gated bundles; zero antipatterns (two-table split + content_hash required-by-invariant, not premature).
- **ceo-reviewer:** PROCEED (HOLD-SCOPE) — store-first vertical slice is exactly the right ambition for the compliance-first wedge; the version-binding invariant (can't send an edited-but-unapproved template) is the genuine competitive moat; LLM-drafting (behind M5's blocked founder-spend gate) + email-send (later external-SDK bundle) correctly deferred. No expansion/reduction.
- **mvp-thinner:** OK — every AC traces to the mvp-critical floor (versioned approved compliance-safe template + non-bypassable server-side pre-send gate composing from it + SoD); the load-bearing compliance invariants (version-binding, SoD, non-bypassable gate) default-to-KEEP under the moat rule; the only splittable candidates (compliance-queue UI, send/tracking/export/pipeline, richer metadata) are ALREADY deferred to later M6 bundles by the tasks' HARD boundaries. Nothing left to peel.
- **Mediation:** none needed.
- **Sibling task IDs created:** none this stage (composer/gate + SoD pre-split at N-2).
- **Disposition:** PROCEED (all 3 aligned).
- **Final framing:** ship the versioned template store + version-binding invariant + required-compliance-block + templates-library page + the composer + non-bypassable pre-send gate + sender≠approver SoD — the compliance-first outreach foundation. Police the boundaries (NO LLM/AI-drafting, NO email-SDK/send — later gated bundles). Reuse M2 disclaimer/audit + M1 RBAC. P-4 SECURITY-SCOPE-TIGHTENED (version-binding + approval + SoD + audit — the compliance moat).
