verdict: REFRAME
verdict_source: problem-framer
matched_antipatterns: ["PRODUCT-PRINCIPLES #1 (metric shown to users must not be noise by construction)"]
reasoning: |
  Symptom-vs-cause PASS: the real problem is that intent evidence is scattered with no
  per-mandate signal; a deterministic read-derived score over existing columns is the correct
  cause-layer fix, and the framing correctly rejects an LLM "intent guess" (wrong layer:
  non-deterministic, non-auditable, founder-gated). Computability CONFIRMED, purity/RLS/read-only
  SOUND, no ghost dep. ONE recoverable defect: the acceptance sketch surfaces `tieBreak` inside
  the user-facing `score_breakdown` (and, mirroring matching.scorer.ts, folds a 0-10 hash-of-id
  into the 0-100 total). A hash of the mandate id carries zero seller-intent meaning; surfacing it
  as a breakdown dimension — and letting it perturb the headline score by up to 10 points — is
  noise-by-construction shown to users. This is the exact wave-19 mistake that was promoted to
  PRODUCT-PRINCIPLES #1. Recoverable at spec, so REFRAME not ESCALATE.
proposed_reframe: |
  Keep the whole wave as framed EXCEPT the tieBreak treatment. Correct framing:

  1. `tieBreak` MUST NOT be a field in the `score_breakdown` returned by scoreMandateIntent, nor
     flow through the RBAC read API or the /insights UI. The advisor-facing breakdown surfaces ONLY
     real-signal dimensions: { outreachEngagement, pipelineVelocity, matchDisposition, total,
     notApplied }.
  2. The headline 0-100 score MUST be derived purely from the three real signals. Do NOT fold a
     hash-of-mandate-id into the total the way matching.scorer.ts adds tieBreak to rawTotal — that
     injects up to 10 points of noise into the number advisors read as "how hot is this mandate."
  3. If stable ordering of equal-scored mandates is needed on /insights, do it as a deterministic
     query-layer tiebreak (ORDER BY score DESC, mandate.createdAt ASC, mandate.id) — internal to
     ordering, never a scored dimension and never surfaced. This preserves determinism without
     polluting the signal.

  Non-blocking notes to carry into P-2/P-3 spec (NOT framing defects):
  - outreach_activity.mandateId is nullable; a completed touch may attach to a mandate only
    indirectly via pipelineId (pipeline.mandateId) or matchCandidateId. The aggregation must define
    the mandate join path explicitly, else completed touches get dropped from the score.
  - match_candidates.disposition defaults to 'pending' (not only accepted/flagged/rejected); the
    scorer must bucket 'pending' as neutral/notApplied, not silently as a rejection.
  - Empty-data cases (mandate with zero outreach and/or zero pipeline events) must qualify low-n
    per PRODUCT-PRINCIPLES #1 rather than emit a confident score — the seed's boundary/empty-data
    unit-test requirement already covers this; keep it load-bearing.
escalation_reason: |
  (n/a — REFRAME, not ESCALATE)
sibling_visible: false
