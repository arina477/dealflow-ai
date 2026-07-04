# Wave 9 — T-7 Perf — SKIPPED (with INFO carried)
Not heavy at pilot scale (fixture company pool small). INFO from /review: assemble pulls ALL active M3 companies into one txn (unbounded — a 10k-company mandate → 10k candidate rows/one INSERT). Carried to backlog (performance-engineer) — bound the candidate pool (SQL-level pre-filter / chunked / cap) before real-provider scale. Not a pilot blocker.
```yaml
test_pattern: skipped
skipped: true
skip_reason: "pilot scale; unbounded-assemble INFO carried to backlog"
