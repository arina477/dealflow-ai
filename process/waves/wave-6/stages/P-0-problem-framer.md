```yaml
verdict: PROCEED
verdict_source: problem-framer
matched_antipatterns: []
reasoning: |
  Symptom-vs-cause (mandatory): this is a platform-foundation/data-spine wave, not a
  bug fix — there is no symptom masking a cause. The M3 success metric (analyst imports
  deduped, provenance-tracked records from >=2 sources and cleans them on-screen) IS the
  root product goal, and the four-task decomposition (connect -> ingest -> stage -> dedupe
  -> view/clean) builds toward exactly that at cause level. Every load-bearing design
  choice maps directly to a documented architecture invariant (databases.md invariants
  3 + idempotency, modules.md #3/#4/#8), so the framing matches reality rather than
  restating a wish.

  The four dedupe antipatterns I test for are all pre-empted in the task text and the
  architecture it cites: (1) NOT exact-match-only — deterministic name+domain first, then
  configurable fuzzy threshold (modules.md #133); (2) NOT destructive — soft-delete with
  merged_into_id FK, both provenance rows preserved; (3) idempotent — upsert on
  (connection_id, external_id) unique key so re-sync does not pile up dups; (4) human-review
  path present — above-threshold pairs go to dedupe_candidates (pending/merged/rejected),
  not auto-merge. Staging (immutable raw_companies) vs canonical (companies/contacts) is a
  correct two-tier model with non-nullable provenance joins — compliance-load-bearing and
  aligned to founder bet #2 (compliance wedge / source-traceability).

  The pluggable DataSourceAdapter is NOT premature abstraction (catalog #4): multi-source
  is the product thesis (founder bet #1 "integrated platform beats stitched tools"), the
  adapter is a documented architecture invariant (modules.md #8), and the seed correctly
  de-risks by accepting fixture/sandbox adapters this bundle ("interface + >=2-provider
  fan-out is the load-bearing AC, not the specific vendor") and deferring real vendor SDK
  integration to P-3 SDK-research. Fan-out lives in the ETL module, not the adapter (correct
  layer). The screen backs list/merge with DedupeService server-side — no client-side dedupe
  (no wrong-layer #2). Enrichment, scheduled cron, and the sourcing-workspace page are all
  cleanly deferred to later M3 bundles — a coherent vertical slice, not scope-coupled (#5)
  and not over-thinned. No configuration-drift knobs (#6): the fuzzy threshold is a real,
  named consumer (analyst tuning, architecture R-5). No validation theater or backwards-compat
  shims. Framing is unambiguously sound.
proposed_reframe: |
  n/a — PROCEED
escalation_reason: |
  n/a — PROCEED
carry_forward_note: |
  ONE demo-path-tunnel watch-item for P-2 Spec + the T-block (not a framing defect, does not
  gate PROCEED): the M3 success-metric proof requires >=2 sources producing ONE canonical
  record carrying BOTH provenance rows. That path is only exercised if the sandbox/fixture
  adapters emit OVERLAPPING records — the same company from two sources with realistic
  name/domain variants that trip both the deterministic and the fuzzy branch. If the fixtures
  contain only disjoint records, the merge/dedupe path ships green but untested on real dup
  data (happy-path tunnel). P-2 must make "fixtures contain cross-source duplicates" an
  explicit acceptance criterion, and the T-block must assert the two-provenance-rows outcome
  on a genuine duplicate, not just row counts. The task text already names the correct
  behavior; this only ensures the test data actually exercises it.
sibling_visible: false
```
