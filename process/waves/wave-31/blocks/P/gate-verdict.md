# Wave 31 — P-4 Gate Verdict (Phase 1) — head-product

**Block:** P (Product) | **Wave topic:** M9 Integrations — Twenty CRM DataSourceAdapter (single-spec, external-SDK; mirrors the proven wave-30 Affinity adapter) | **Task:** 1eb63a40 | **Mode:** automatic

```yaml
head_signoff:
  verdict: APPROVED
  stage: P-4
  phase: 1
  reviewers: {}          # Phase-2 cross-review (karen + jenny) routed below
  failed_checks: []
  rationale: >
    Single-spec external-SDK wave that faithfully mirrors the shipped, APPROVED wave-30
    Affinity adapter behind the EXISTING DataSourceAdapter interface. SDK-doc-first,
    reuse-of-interface, inline robustness, env-secret + graceful-no-op, and key-gated
    live-verify all carry over verbatim from the proven pattern. Three deltas over
    wave-30 are all correct: (1) the problem-framer REFRAME on the self-hostable base
    URL is resolved the right way — resolve TWENTY_BASE_URL from ENV, config schema
    UNTOUCHED (verified data-source-admin.ts:110-121 is a genuine .strict() 3-key
    whitelist = wave-16 P-4 Finding-2 secret-sink boundary; re-loosening it was correctly
    rejected), with an https-only + host-shape SSRF guard on the resolved URL; (2) the
    P2-a lesson is folded — Twenty MUST safeParse its OWN output vs normalizedSourceRecordSchema
    (verified affinity.adapter.ts only safeParses inbound at lines 344/394, never its output —
    a real gap this wave closes, matching the fixture adapter); (3) scope held to core
    companies/people, Affinity stays registered-dormant as the 2nd connector (serves M9 +
    M3 >=2-sources). All AC touching the env-secret sink and wave-16 boundary are binary
    and machine-checkable; every claimed_task_id traces to the P-0 bet. The stale
    "base URL in connection.config" phrasing in the task prose body is overridden by the
    authoritative P-2 SCOPE head ("config schema UNTOUCHED - wave-16 boundary") per the
    structured-content carve-out — a resolved reframe, not a defect.
  next_action: PROCEED_TO_PHASE_2

checklist_P4:
  - id: ac-binary-observable-machine-readable
    status: PASS
    note: >
      AC touching the secret sink are binary/observable — TWENTY_API_KEY+TWENTY_BASE_URL
      env-only never-committed; graceful no-op (returns [], app boots, fixture/Affinity
      search work) if EITHER absent; base-URL https-validated (non-https/malformed -> no-op+log);
      config schema (dataSourceConnectionConfigSchema) UNTOUCHED; OUTPUT-self-validation vs
      normalizedSourceRecordSchema (malformed normalized record -> skipped+logged). Each is a
      discrete mocked-HTTP test in AC-5. No audit-log / RBAC / SoD surface in this wave
      (read-only external-source adapter; no new endpoint, no migration, no UI).
  - id: reviewers-logged-resolved
    status: DEFERRED_TO_PHASE_2
    note: security_scope = external-SDK + new secret -> standard karen + jenny Phase-2 (mirrors wave-30).
  - id: traceability-default-no-go
    status: PASS
    note: >
      Every artifact machine-readable + traceable to the P-0 frame (2nd real adapter behind the
      existing interface, founder Twenty redirect). No un-checkable artifact -> default No-Go NOT triggered.

confirmations:
  sdk_doc_first: true                 # AC-1: Twenty/twenty.md (REST companies/people, Bearer, cursor-pagination, rate-limits, normalize map) + registry row BEFORE the adapter; Twenty open-source -> docs complete
  mirror_wave_30: true                # twenty.adapter.ts mirrors affinity.adapter.ts (same fetchCompanies interface + inline robustness), registered in createDefaultRegistry — not re-invented
  base_url_from_env_config_untouched: true   # ENV resolution (verified strict 3-key whitelist at data-source-admin.ts:110-121); config schema NOT re-loosened; https-validated SSRF guard; per-firm-config-URL deferred
  p2a_output_validation_folded: true  # safeParse OUTPUT vs normalizedSourceRecordSchema — closes the verified wave-30 gap (affinity safeParses inbound only, 344/394)
  secret_env_never_committed: true    # TWENTY_API_KEY + TWENTY_BASE_URL env-only, never committed, requested-from-founder (rule 2/6)
  graceful_no_key_or_url: true        # graceful no-op if EITHER absent — app boots, fixture/Affinity search work
  key_gated_live_verify: true         # buildable core + mocked tests now; live Twenty fetch gated at C-2 on founder key + instance URL; does NOT block the wave
  affinity_dormant: true              # Affinity adapter stays registered (2nd connector; serves M9 + M3 >=2-sources)
  m9_tbd_flagged: true                # M9 _TBD metric flagged (M9-progress wave, not M9-closing)
  design_gap_flag: false              # backend adapter, reuses sourcing search -> D-skip

phase_2_routing:
  security_scope: external-sdk + new-secret (env-only)
  reviewers: [karen, jenny]
  karen_focus: >
    Red-team the Twenty integration failure modes (timeout / malformed-JSON / 429 / 5xx) and the
    https-only + host-shape SSRF guard on the env-resolved TWENTY_BASE_URL (admin-set but server-side-fetch input);
    confirm graceful no-op cannot leak state and the config-schema boundary is genuinely untouched.
  jenny_focus: >
    Confirm the spec-vs-build contract: SDK-doc-first authored before code, OUTPUT-self-validation
    actually present (the P2-a fold), env-secret never committed, and no config-schema mutation.
```

## Gate verdict log
APPROVED (Phase 1) — proceed to Phase-2 cross-review (karen + jenny). No REWORK defects. Single most important finding: the base-URL REFRAME is resolved correctly — ENV resolution with the wave-16 strict config-schema boundary left UNTOUCHED and an https SSRF guard applied — NOT by re-loosening the secret-sink whitelist.
