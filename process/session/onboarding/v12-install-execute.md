# v12 Install Execute — DealFlow AI

**Started:** 2026-06-30 (interrupted by session usage limit; resumed 2026-07-01)
**Completed:** 2026-07-01
**Iterations:** multiple (rate-limit + worker-restart interruptions; work made restart-resilient)
**Final delta:** 0 required items (1 benign environment advisory noted)

## Per-category install audit

### external-tool
- None outstanding — all CLIs/skills/MCPs/env vars were present at v11.
- **Fix applied to a broken skill:** `~/.claude/skills/gemini-deep-research/scripts/deep_research.py` `_extract()` read `inter["outputs"]`, but the Deep Research agent returns the report under `steps[].content[].text`. Patched to fall back to `steps[]` (and used a standalone re-extractor to recover the 10 reports that the buggy extractor had written as "(empty response)"). Worth upstreaming.

### prebuilt-collection
- No action — all bundled + VoltAgent universal executors already present (verified v11).
- `agent-creator` remains "cataloged but no card" in the drift report — BENIGN: it is a pipeline (`claudomat-brain/setup-tools/agent-creator/agent-creator.md`) executed by reading the doc, not a spawnable `subagent_type`.

### head (Phase 6c) — 8/8 generated via agent-creator (real Gemini fast research → distill → synthesize)
- head-product — WROTE (research 6574w)
- head-builder — WROTE (research 7566w)
- head-ci-cd — WROTE (research 7467w)
- head-designer — WROTE (research 8036w)
- head-verifier — WROTE (research 6741w)
- head-tester — WROTE (research 8280w; card flags Playwright-Chrome host-install prerequisite for T-5/T-6)
- head-learn — WROTE (research 6913w)
- head-next — WROTE (research 6929w)

### board (Phase 6b) — 6/6 generated (founder-proxy already bundled = 7/7 total)
- strategist — WROTE (research 11751w)
- industry-expert — WROTE (research 5943w; §1/§2 synthesized from report §3–§6 + board-members lens as the archive omitted them)
- realist — WROTE (research 8813w)
- user-advocate — WROTE (research 10940w)
- risk-officer — WROTE (research 8361w)
- counter-thinker — WROTE (research 8506w)
- founder-proxy — already present (claudomat-bundled seed)

### bespoke-executor
- None missing (all stack-derived executors present from VoltAgent — verified v11).

### capability-sheet (Phase 7-final)
- Regenerated via `claudomat capabilities` (481 lines). Drift report: 5 findings, all benign — `agent-creator` (pipeline, not a card), and 4 slash-skills the deep-scan misses (`/loop`, `/checkpoint`, `/healthz`, `/ui-ux-pro-max`; `/loop` is installed). 141 filesystem agents not-in-catalog is informational.

### agentmail (Phase 8)
- Inbox present: `CEO_INBOX_ID=disturbedchapter757@agentmail.to` confirmed in `agentmail inboxes list` (83 inboxes). Env vars set (AGENTMAIL_API_KEY, CEO_INBOX_ID, CEO_NOTIFY_EMAIL_TO). Degenerate mode not active; no probe email required for onboarding.

## Execution notes (resilience)
- The agent-creator runs hit two external constraints: (1) an account session usage limit (reset 16:30 UTC) that failed the first batch; (2) worker/process restarts that kill in-flight background subagents mid-run.
- Resolved by decoupling: the Gemini Deep Research jobs run server-side (`background:True, store:True`) and their interaction IDs were persisted to `process/session/onboarding/.research-jobs.tsv`; a resumable poller (`poll_research.py`) + direct re-extractor recovered all reports; Stage-2+3 synthesis (no Gemini) is cheaply re-runnable from the persisted reports.

## Residual (documented, not blocking)
- `claudomat doctor --strict` reports ONE EXTERNAL WARN: `CLAUDOMAT_DB_URL` username is a per-brain role (`brain_290fe959…`) not the literal `claudomat_brain`. Doctor itself states "fine for local-dev"; the DB is fully functional (all milestone/bet/wave writes succeeded this run). This is a studio-provisioning artifact of the injected DSN, outside brain control — accepted as an environment note.
