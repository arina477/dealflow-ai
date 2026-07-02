# v11 Install Audit — DealFlow AI

**Audited at:** 2026-06-30
**Audited by:** v11 install-audit stage
**Total delta count:** 14 agent cards (8 heads + 6 BOARD seats) + capability-sheet regen

## Per-category delta

### external-tool (Phase 3–5)
- None. `claudomat doctor --strict` returns STRICT OK — all CLIs (psql, gh, agentmail, python3), env vars (GEMINI/GOOGLE, AGENTMAIL_*, AIDESIGNER), gstack skills, gemini-deep-research skill, aidesigner skill, and Playwright ×10 MCP present.
- ⚠ Known infra gap (NOT a doctor delta): Playwright **Chrome browser binary is not installed** and requires root to install — blocks live-browser E2E (T-5) / layout (T-6) and was the reason v2 screenshots couldn't be captured. Must be resolved host-side before the first UI wave's T-5. Tracked in architecture/test.md + devops.md + competitive-benchmarks/INDEX.md + product-decisions.md (v6b #18).

### prebuilt-collection (Phase 6a)
- All claudomat-bundled cards present (problem-framer, ceo-reviewer, ceo-agent, founder-proxy, mvp-thinner, milestone-decomposer, karen, jenny, code-quality-pragmatist, task-completion-validator, ui-comprehensive-tester, ultrathink-debugger). ✓
- VoltAgent universal executors present (knowledge-synthesizer, backend-developer, frontend-developer). ✓
- `agent-creator` card absent — BENIGN: agent-creator is a PIPELINE (`claudomat-brain/setup-tools/agent-creator/agent-creator.md`) executed by reading the doc + running its stages, not a spawnable `subagent_type`. No install action.

### head (Phase 6c) — **8 MISSING, all required**
- head-product — agent-creator (head class)
- head-designer — agent-creator (head class)
- head-builder — agent-creator (head class)
- head-tester — agent-creator (head class)
- head-verifier — agent-creator (head class)
- head-ci-cd — agent-creator (head class)
- head-learn — agent-creator (head class)
- head-next — agent-creator (head class)

### board (Phase 6b) — **6 MISSING** (founder-proxy already bundled ✓)
- strategist — agent-creator (board class)
- industry-expert — agent-creator (board class); uses `project.yaml: stack.industry_domain` = "m&a advisory (fintech / deal sourcing)"
- realist — agent-creator (board class)
- user-advocate — agent-creator (board class)
- risk-officer — agent-creator (board class); uses `founder-stage.md` = pilot-customer + compliance-first context
- counter-thinker — agent-creator (board class)

### bespoke-executor (Phase 6d)
- None missing. Stack-derived executors all present on disk (VoltAgent): postgres-pro, nextjs-developer, react-specialist, typescript-pro, security-engineer, devops-engineer, test-automator, database-administrator. ✓
- Optional (NOT required for MVP): a dedicated `supertokens-integration` / email-provider integration agent — covered by security-engineer + backend-developer; defer unless a wave needs it.

### capability-sheet (Phase 7-final)
- Present but STALE (generated before heads/BOARD generated) — regenerate via `claudomat capabilities` at v12 after agent install. Also refresh AGENTS.md catalog (heads + BOARD rows).

### agentmail (Phase 8)
- Env vars present (AGENTMAIL_API_KEY, CEO_INBOX_ID, CEO_NOTIFY_EMAIL_TO — doctor OK). Inbox-existence probe was inconclusive (used wrong subcommand `agentmail inbox list`; correct is `agentmail inboxes list`). v12 verifies with the correct subcommand. Not a hard onboarding blocker (degenerate mode not active).

## Verdict
**install-pending** — v12 must generate the 8 heads + 6 BOARD seats via agent-creator, refresh the capability sheet + AGENTS.md, verify AgentMail inbox, then v13 final-verifies and flips loop_state: ready.
