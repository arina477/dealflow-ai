# Wave 6 — V-1 Summary (orchestrator)
Independent reviews vs LIVE (deploy 918dbf0). No shared context.
## Karen (source-claim) — APPROVE (7 claim-groups TRUE, 2 non-blocking)
Files real; dedupe correctness in code (NO 'co' strip → no false-positive; name-only never auto-merges; contact_provenance on BOTH merge paths; candidate-idempotency; atomic resolve); DI fix (value-import + di-boot spec); fixture-asset fix (nest-cli assets); env-secrets (no secret col); /health=918dbf0; migration 0004 (7 tables). Live payoff cross-checked genuine (918dbf0==audited code; C-2 evidence real). Notes: in-memory mock models DB constraints; live re-run blocked by torn-down proxy (cross-checked C-2).
## jenny (spec-semantic) — APPROVE (0 drift, 0 gap)
All 4 blocks MATCH live: 7 tables; idempotent ETL/sync; dedupe cross-source→1 canonical + provenance both; NO false-positive (4 domains=4 companies); **contact_provenance (P-4 principle-3) delivered + live-proven** (Alice 1 contact + 2 contact_provenance); ambiguous→review-queue; companies screen /sourcing/companies (analyst, no manual-create) per design; repoint faithful. Thin slice honest (fixture-only; deferrals named not faked). Notes: dead-code ingestion.service:135-150 (cosmetic); audited-resolve not live-exercised (0 candidates in deterministic fixture — unit-covered, honest).
## Combined: both APPROVE. Deduped provenance-tracked canonical company universe (M3 metric) LIVE + spec-conformant. No REJECT/critical/drift/gap.
```yaml
karen_verdict: APPROVE
jenny_verdict: APPROVE
spec_drift_count: 0
spec_gap_count: 0
findings:
  - {source: T-6, severity: low, item: "TopBar title recurring → polish task"}
  - {source: jenny/review, severity: low, item: "dead-code ingestion.service:135-150 (cosmetic)"}
  - {source: jenny, severity: info, item: "audited-resolve not live-exercised (0 candidates in deterministic fixture; unit-covered — honest, not a gap)"}
```
