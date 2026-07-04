# Wave 6 — T-7 Perf — SKIPPED
Not a heavy wave at pilot scale. Dedupe uses indexed lookups (normalized_domain/name); the ambiguous-name scan is a documented full-scan acceptable at fixture/pilot size (pg_trgm noted for scale). ETL synchronous on-demand (no queue — deliberate). Fixture dataset small.
```yaml
test_pattern: skipped
skipped: true
skip_reason: "not heavy; indexed dedupe lookups + small fixture at pilot scale; pg_trgm noted for scale"
```
