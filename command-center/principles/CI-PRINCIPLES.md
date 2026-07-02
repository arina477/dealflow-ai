# CI Principles — DealFlow AI

Cross-wave CI / deploy / canary / PR-convention rules promoted from L-2 distill. Append-only; numbered sequentially. Read at every C-block stage.

---

## Contract for new rules

Format (deterministic; karen + L-2 linter reject anything that doesn't match):

```
N. <one-line declarative rule, ≤120 chars, ending in a period>
   Why: <one-line causal explanation, ≤100 chars, ending in a period>
```

Hard limits: rule line ≤ 120 chars; why line ≤ 100 chars; entry = exactly 2 non-empty lines.

Forbidden tokens (rule or why line, case-insensitive): `we`, `our`, `the team`, `during wave-`, `wave-<N>`, `because ... because`, em-dash (`—`), any parenthetical longer than ~5 words.

### GOOD

```
4. Never mock the database in integration tests.
   Why: A passing mock that doesn't match prod schema masks broken migrations.
```

### REJECTED — multi-clause prose

```
4. We've found that mocking the database, while convenient, can sometimes lead
to issues during integration testing because the mock might not accurately
reflect the production schema, especially after migrations...
```

Reasons: prose voice (`We've found`), runs > 1 line, hedging (`can sometimes`), war-story preamble.

### REJECTED — wave reference

```
4. After wave-7's auth bug, always validate session tokens at the edge.
```

Reason: cites a wave; rules outlive the wave they were learned from.

### REJECTED — non-falsifiable

```
4. Write good error messages.
```

Reason: not falsifiable; can't be checked by any subsequent reviewer.

### Authoring discipline

- Before adding: grep for the concept; do not add a near-dup.
- Number sequentially; renumber on insert.
- Group under an existing H2 unless ≥3 new rules share a theme.
- Wave-specific ("broke once") stays in `process/waves/wave-<N>/blocks/L/observations.md` until a second wave confirms.

---

## Promotion path

Promoted at L-2 Distill from `process/waves/wave-<N>/blocks/L/observations.md` by `karen` (rule-quality vetter) when an observation appears across 2+ waves AND head-ci-cd approves. Maximum 1 rule promoted per wave per file (cap is per-file, not per-wave — multiple principles files may each receive one). See `claudomat-brain/blocks/learn/stages/L-2-distill.md`.

---

## Project configuration (authored at v11 onboarding)

Three sections below are populated at `claudomat init` from the v6 DevOps branch + founder Q&A. Update them via L-2 distill (or directly when CI / deploy / canary topology changes between waves).

### Deploy targets

```yaml
# Railway bring-your-own: the founder's own Railway account + token are collected at
# deploy time (C-2 Action 0), and the brain provisions project/service/domain then.
# health_endpoint + platform mirror project.yaml: deploy_targets[].
deploy_targets:
  - environment: production
    platform: railway
    branch: main
    healthcheck_url: <back-filled by C-2 Action 0 on first deploy>   # path /health
    deploy_status_command: "curl -s https://backboard.railway.com/graphql/v2 (RAILWAY_TOKEN)"
    rollback_command: "Railway GraphQL redeploy previous deployment (see monitors/railway-deploy.md)"
    notes: "Bring-your-own: project/service/DB/domain provisioned on first C-2 deploy; API + Web separate Railway services on private network; SuperTokens Core on its own Postgres."
  - environment: preview
    platform: railway
    branch: "pr-* preview"
    healthcheck_url: <per-PR Railway preview URL>
    deploy_status_command: "Railway GraphQL API"
    rollback_command: "delete PR preview environment"
    notes: "PR preview environments via Railway."
```

### Canary configuration

```yaml
# Consumed by C-3 deploy & verify (canary phase) and `/canary` skill.
# Standard profile — pilot-customer default (applied silently per always-on rule 17).
# Internal tool with low initial DAU (project.yaml canary_threshold_dau: 1000): the
# canary phase runs conditionally once real-user volume crosses that threshold.
canary:
  enabled: true
  duration_minutes: 15
  rollback_threshold:
    error_rate_pct: 1.0
    p95_latency_delta_ms: 200
  smoke_routes:
    - <prod-url>/health
    - <prod-url>/login
  alert_destination: none   # AgentMail digest to founder covers alerts; wire slack/email later if desired
```

### PR conventions

```yaml
# Consumed by C-1 PR creation. Default profile (applied silently per always-on rule 17):
# AI attribution ON, auto-merge OFF (conservative — human merges), squash strategy.
pr_conventions:
  title_format: "<type>: <short description>"   # see C-1 stage file for type list
  title_max_chars: 70
  body_template: claudomat-default
  required_reviewers: []                        # solo/internal — no required reviewers yet
  required_labels: []
  ai_attribution_footer: true                   # PR body carries the Claude Code footer
  auto_merge_after_ci: false                    # human merges; matches merge_strategy: squash
```

---

## Rules

_(no rules yet — promoted from L-2 distill across waves)_
