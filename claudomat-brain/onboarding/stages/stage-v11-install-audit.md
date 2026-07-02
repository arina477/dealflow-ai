# Stage v11 — Install Audit: Detect What install.md Phase 3–8 Failed To Produce

## Purpose
Onboarding v0–v10 generated project context (vision / bets / stack / architecture / design / milestones). The install runbook (`claudomat-brain/setup-tools/install.md` Phase 3–8) was supposed to install the tools the wave loop will execute against. **This stage verifies what's actually present on disk vs. what was supposed to be installed.** Produces a delta report consumed by v12.

Pre-onboarding, the runbook can install pre-built collections (Phase 6a) + Heads (Phase 6c) + capability-sheet baseline (Phase 7-baseline), but **BOARD bench (Phase 6b) and bespoke per-stack executors (Phase 6d) require project context that only emerges from v0–v10.** v11 is the first stage where that context exists. v11 audits; v12 installs the delta; v13 verifies clean and hands off.

## Prerequisites
- v10 complete (`milestones` table + `tasks` table populated; `product-decisions.md` backfilled; stack locked).
- `command-center/AGENTS.md` exists (catalog template — populated names but underlying agent cards may be missing).

## Actions

### Action 1 — Run strict doctor

```bash
claudomat doctor --strict
```

Capture every `[FAIL]` and `[WARN] EXTERNAL:` line. These are the install.md Phase 3–5 items missing. Categorize per delta entry:

- CLIs (`psql`, `gh`, `agentmail`, stack-conditional) → category `external-tool`, source `Phase 3`. (The P-4 cross-model review uses the Gemini REST API via `python3`, not a `gemini` CLI; its `GEMINI_API_KEY`/`GOOGLE_API_KEY` need is the Phase-4 key delta below.)
- AgentMail env vars (`AGENTMAIL_API_KEY`, `CEO_INBOX_ID`, `CEO_NOTIFY_EMAIL_TO`) → category `external-tool`, source `Phase 8`.
- gstack always-on skills (all of them) → category `external-tool`, source `Phase 4`.
- **`gemini-deep-research` skill** → claudomat-bundled (not an external delta any more); skill directory always present after `init` / `sync`. Only `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) env var remains a possible `external-tool` delta under source `Phase 4`. Both must be live before agent-creator generates BOARD / Heads / bespoke executors in v12.
- MCPs (Playwright × 10) → category `external-tool`, source `Phase 5`.

### Action 2 — Probe Phase 6a installs (claudomat-bundled + VoltAgent)

Phase 6a has three install sources; probe each separately so v12 knows which install command to fire.

**Source 1 — claudomat-bundled** (`claudomat-brain/setup-tools/prebuilt-claudomat-agents/`):

```bash
for agent in problem-framer ceo-reviewer ceo-agent founder-proxy; do
  [[ -f "$HOME/.claude/agents/$agent.md" ]] && echo "OK $agent" || echo "MISSING $agent"
done
```

Per missing → delta entry, category `claudomat-bundled`, source `Phase 6a step 1` (cp from `claudomat-brain/setup-tools/prebuilt-claudomat-agents/`). v12 copies them wholesale.

**Source 2 — VoltAgent collection** (universal executors):

```bash
for agent in knowledge-synthesizer backend-developer frontend-developer agent-creator; do
  [[ -f "$HOME/.claude/agents/$agent.md" ]] && echo "OK $agent" || echo "MISSING $agent"
done
```

Per missing → delta entry, category `prebuilt-collection`, source `Phase 6a step 2` (VoltAgent wholesale clone).

(The verifier set — `karen`, `jenny`, `code-quality-pragmatist`, `task-completion-validator`, `ui-comprehensive-tester`, `ultrathink-debugger` — is claudomat-bundled and probed by Source 1 above; no separate external-collection delta for those.)

### Action 3 — Probe Heads (Phase 6c)

```bash
# Mask-pattern heads (5)
for head in head-product head-designer head-builder head-tester head-verifier; do
  [[ -f "$HOME/.claude/agents/$head.md" ]] && echo "OK $head (mask)" || echo "MISSING $head (mask)"
done
# Spawn-pattern heads (3)
for head in head-ci-cd head-learn head-next; do
  [[ -f "$HOME/.claude/agents/$head.md" ]] && echo "OK $head (spawn)" || echo "MISSING $head (spawn)"
done
```

Per missing head → delta entry, category `head`, source `Phase 6c agent-creator`. **All 8 heads required.** Mask-pattern blocks (P/D/B/T/V) halt block entry on missing card; spawn-pattern blocks (C/L/N) halt on missing card.

### Action 4 — Probe BOARD bench (Phase 6b)

```bash
for seat in strategist industry-expert realist user-advocate \
            risk-officer counter-thinker founder-proxy; do
  [[ -f "$HOME/.claude/agents/$seat.md" ]] && echo "OK $seat" || echo "MISSING $seat"
done
```

Per missing seat → delta entry, category `board`, source `Phase 6b agent-creator`. (`founder-proxy` uses the fixed seed at `claudomat-brain/setup-tools/agent-creator/founder-proxy-seed.md` — no priming step.)

### Action 5 — Probe bespoke per-stack executors (Phase 6d)

Read `command-center/dev/stack-decisions.md` to identify per-stack agents the project should have. Match against `command-center/AGENTS.md` § "Project-specific executors". Common derivations:

| Stack signal | Expected agent tag |
|---|---|
| Postgres + Drizzle | `postgres-pro` |
| Next.js | `nextjs-developer` |
| React | `react-specialist` |
| FastAPI / Python | `python-pro` |
| Stripe SDK | `stripe-integration` |
| SuperTokens SDK | `supertokens-integration` |
| Vue | `vue-expert` |
| Rails | `rails-expert` |

Per missing executor implied by stack but absent from `~/.claude/agents/` → delta entry, category `bespoke-executor`, source `Phase 6d agent-creator`.

### Action 6 — Probe capability sheet freshness

```bash
if [[ ! -f process/session/.capability-sheet.md ]]; then
  echo "MISSING capability-sheet"
elif grep -q "no global agent directory found" process/session/.capability-sheet.md; then
  echo "STALE capability-sheet (generated before agents were installed)"
else
  echo "OK capability-sheet"
fi
```

If MISSING or STALE → delta entry, category `capability-sheet`, source `Phase 7-final`.

### Action 7 — Probe AgentMail provisioning (Phase 8)

Check that `agentmail` CLI auth completed AND the project's CEO inbox exists:

```bash
agentmail inbox list 2>/dev/null | grep -q "$CEO_INBOX_ID" && echo "OK agentmail-inbox" || echo "MISSING agentmail-inbox"
```

Plus the 3 env vars from Action 1 should already be flagged by strict doctor; cross-reference here.

Per missing item → delta entry, category `agentmail`, source `Phase 8`.

### Action 8 — Write the delta report

Write `process/session/onboarding/v11-install-audit.md`:

```markdown
# v11 Install Audit — <Project>

**Audited at:** <ISO-timestamp>
**Audited by:** v11 install-audit stage
**Total delta count:** <N>

## Per-category delta

### external-tool (Phase 3–5)
- <CLI / skill / MCP / env-var> — <fix command from doctor output>

### prebuilt-collection (Phase 6a)
- <agent-tag> — install via VoltAgent wholesale clone (or, for the bundled `prebuilt-claudomat-agents/` set including the vendored darcyegb cards, surface as `claudomat-bundled` instead)

### head (Phase 6c)
- <head-tag> — install via agent-creator (head class)

### board (Phase 6b)
- <seat-tag> — install via agent-creator (board class). Requires `project.yaml: stack.industry_domain` + `stack.compliance_regime` (industry-expert / risk-officer). (`founder-proxy` uses the fixed seed — no priming.)

### bespoke-executor (Phase 6d)
- <agent-tag> — install via agent-creator (executor class). Source: stack-decisions.md derivation (<stack-signal>).

### capability-sheet (Phase 7-final)
- regenerate via `claudomat capabilities`

### agentmail (Phase 8)
- <inbox-name> — provision per install.md Phase 8

## Verdict
- If `total delta count == 0`: **clean** — v12 short-circuits; proceed to v13.
- Otherwise: **install-pending** — v12 must resolve all delta entries before v13.
```

### Action 9 — Set loop_state

Write/update `process/session/.last-wave-completed.yaml`:

```yaml
loop_state: install-pending      # was unset; v11 sets to install-pending
last_wave: null
delta_count: <N from Action 8>
audit_completed_at: <ISO-timestamp>
```

`install-pending` is a terminal state for the wave-loop dispatcher — DISPATCHER refuses to enter the wave loop until v13 flips it to `ready`. Single source of truth that prevents wave-1 starting with an incomplete agent catalog.

## Deliverable

- `process/session/onboarding/v11-install-audit.md` — delta report (categorized).
- `process/session/.last-wave-completed.yaml` — `loop_state: install-pending` + `delta_count`.

## Exit criteria

- All 7 probe actions ran (Actions 1–7).
- Delta report written with per-category enumeration.
- `loop_state: install-pending` set.

## Next

→ Return to `../onboarding-loop.md` → Stage v12 (install-execute). If `delta_count == 0`, v12 immediately short-circuits to v13.
