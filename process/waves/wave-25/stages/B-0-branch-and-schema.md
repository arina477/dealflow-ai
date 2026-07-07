# Wave 25 — B-0 Branch & schema
Branch wave-25-auth-hardening. 1 task claimed. Schema: a rate_limit_hits (or counter) table via an additive migration (across-replica shared store; keyed by (key, window_start) for the SEC-1 atomic UPSERT; NOT tenant-scoped/WORM — it's pre-auth global). Authored by backend-developer at B-0/B-2. Journaled.
```yaml
branch: wave-25-auth-hardening
schema_skipped: false
migration: additive rate_limit_hits/counter (pre-auth global, not tenant-scoped, not WORM)
```
