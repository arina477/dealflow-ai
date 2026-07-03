# Wave 3 — T-7 Perf — SKIPPED
Not a heavy wave (AppShell + RBAC; no perf-sensitive/large-data path). One extra DB read per guarded request (RBAC re-verify) is negligible + guarded routes are few. web bundle modest (C-2 build ~103kB first-load).
```yaml
test_pattern: skipped
skipped: true
skip_reason: "not a heavy wave"
```
