# Wave 4 — T-7 Perf — SKIPPED
Not a heavy wave. Verifier loads the chain in-order (O(n) walk) — acceptable at pilot scale; a streaming/checkpoint verifier is a future optimization (noted, not needed now, 0 real entries in prod). Append is single-row + one advisory lock. Integrity-view fetch is a single verify call.
```yaml
test_pattern: skipped
skipped: true
skip_reason: "not a heavy wave; verifier O(n) acceptable at pilot scale"
```
