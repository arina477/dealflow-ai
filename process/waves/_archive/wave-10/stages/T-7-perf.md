# Wave 10 — T-7 Perf — SKIPPED
Not heavy at pilot scale. Deterministic scorer is a pure O(candidates) function; one-txn scored run; small fixture pools. (The unbounded-assemble INFO from wave-9 [buyer-universe] is the upstream scale note; matching reads the already-bounded included set.)
```yaml
test_pattern: skipped
skipped: true
skip_reason: "pure O(n) scorer; pilot scale; bounded included set"
