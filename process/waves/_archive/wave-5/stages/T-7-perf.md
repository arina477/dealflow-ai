# Wave 5 — T-7 Perf — SKIPPED
Not a heavy wave. Gate evaluators do bounded config reads (indexed lookups: suppression, disclaimer-per-jurisdiction, approval-per-resource). Advisory lock per-jurisdiction is short. CRUD is single-row. No perf-sensitive/large-data path at pilot scale.
```yaml
test_pattern: skipped
skipped: true
skip_reason: "not a heavy wave; indexed config reads + short advisory lock"
```
