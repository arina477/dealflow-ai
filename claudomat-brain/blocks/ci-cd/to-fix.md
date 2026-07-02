# C-block — Soft gaps (deferred)

Gaps surfaced by the C-block dry run that aren't fixed inline. Each entry: issue, defer-to, fix trigger.

---

## Gap 1 — AI-attribution footer in PR body should be project-toggleable

**Issue.** C-1's PR body template hardcodes the `🤖 Generated with [Claude Code](https://claude.com/claude-code)` footer. Some projects strip this for compliance / brand / internal-only — brain shouldn't force it.

**Defer to.** Project-level configuration in `command-center/principles/CI-PRINCIPLES.md` § PR conventions, with a `pr_ai_attribution: include | omit` toggle. Default: `include`. C-1 reads the toggle and conditionally appends the footer.

**Fix trigger.** First project that needs to omit the footer.

---

## Gap 5 — Structured `Deploy targets` schema — RESOLVED

**Resolution.** `project.yaml: deploy_targets[]` is now the structured source C-block iterates. Schema includes `platform`, `project`, `service_name_template`, `health_endpoint`, `canary_threshold_dau` per target. C-2 reads this directly; no freeform prose anywhere in the pipeline.

For richer per-platform health check / canary config (alert thresholds, DAU provider integration), see Gap 8 — `command-center/principles/CI-PRINCIPLES.md` still owns operations-level detail.

---

## Gap 8 — `CI-PRINCIPLES.md` needs structured `Canary config` schema (threshold + DAU source)

**Issue.** C-2's canary phase reads `project.yaml: deploy_targets[].canary_threshold_dau` for the per-target threshold (default 1000), but two pieces are still missing:

1. **How** the orchestrator queries current DAU — analytics integration (PostHog, Plausible, GA4, etc.) the C-2 canary phase doesn't currently specify.
2. Per-route monitoring config + alert thresholds.

**Defer to.** `command-center/principles/CI-PRINCIPLES.md` `canary` section (project-level, operations-detail; complements the per-target threshold in `project.yaml`):

```yaml
canary:
  enabled: true
  dau_source:
    provider: posthog                      # posthog | plausible | ga4 | custom
    query: |
      <provider-specific query or CLI invocation>
    cache_ttl_minutes: 60                  # avoid re-querying every wave
  routes_to_monitor:
    - /
    - /sessions
  window_minutes: 30
  alert_thresholds:
    console_error_rate_sigma: 2
    http_5xx_rate_pct: 0.1
    layout_diff_threshold: 0.05
```

C-2's canary phase reads `project.yaml` for the threshold and `CI-PRINCIPLES.md` for the DAU query + alert config; arms `/canary` with both.

**Fix trigger.** First project install where canary fires, OR first project with traffic above default threshold.

---

## Format note

C-block-scoped soft gaps only. Proposed `command-center/principles/CI-PRINCIPLES.md` is project-level (lives in consuming repo, not claudomat brain), authored at install time per `claudomat-brain/setup-tools/install.md`. Brain ships schema definition; each project ships its own values.
