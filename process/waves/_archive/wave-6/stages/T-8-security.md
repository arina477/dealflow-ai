# Wave 6 — T-8 Security (Pattern B, active — T-8-LITE; data-pipeline, NOT user-auth/PII)
## Scope: this wave = external-party company/contact data (not user auth/payments/sessions) → T-8-LITE (secret-handling + the data-correctness invariants), NOT the full security-scope-tightened gate.
## Action 1 — Auth: unchanged; /sourcing/* uses the wave-3 RBAC guard (DB-authoritative). Dedupe-resolve actor = app users.id via getUserWithRole (wave-5 lesson).
## Action 2 — CSRF: /sourcing/* mutations same-origin proxy + apiFetch rid header (wave-5 VIA_CUSTOM_HEADER). GET reads exempt.
## Action 3 — SECRET HANDLING (the T-8-lite core): provider credentials Railway-env-ONLY — data_source_connections stores provider_key (the env credential NAME, e.g. 'GRATA_API_KEY'), **NO secret column** (schema-asserted + grep-clean). Adapter resolves process.env[key] at runtime. Fixture adapter needs no credential. NO secret committed (secret-grep clean).
## Action 4 — DATA-CORRECTNESS invariants (dedupe = the wave's integrity surface) — LIVE-VERIFIED at C-2:
- **Cross-source dedup:** same domain 2 connections → 1 canonical + provenance from both (no data fragmentation).
- **NO false-positive merge** (the worst-case — merging distinct companies): "Acme Co"≠"Acme Inc" (name-only never auto-merges; only domain agreement); 4 distinct domains → 4 companies. LIVE-confirmed.
- **Provenance lineage** (company + contact, principle-3) — traceable source of every canonical record; preserved on auto-merge AND human-merge (shared impl).
- **Idempotent** (no pile-up on re-sync/re-dedupe). **Ambiguous→review-queue** (not silent auto-merge or drop).
- **Dedupe-resolve audited** (M2 sourcing-dedupe-resolve, in-tx) + **atomic single-winner** (no concurrent double-apply).
## Action 5 — Secret grep (wave-6 diff): CLEAN. No PII/secret leak in the screen (email masking).
## Triage: no critical. The B-6 (candidate-idempotency + 4 dedupe /review CRITICALs) + C-2 (import-type DI, fixture-asset) all fixed + LIVE-confirmed. No new blocking findings.
```yaml
test_pattern: active
mode: t8-lite
skipped: false
applicable_probes: [auth, csrf, secret_handling, data_correctness_dedupe, audit, secret_grep, pii_masking]
data_correctness_live: {cross_source: 1_canonical_2_provenance, no_false_positive: true, contact_provenance: principle3, idempotent: no_pileup, resolve: audited_atomic}
secret_grep_findings: []
findings: []
```
