# Onboarding Complete — DealFlow AI

**Completed:** 2026-07-01
**Initial commit:** 901f4775a1199f5a7ad142c4639218d0679ce6fa (local `main`)
**First wave seed:** `e83584db-6387-4567-916c-aacba5c5dede` — "Project scaffold + walking skeleton + CI" (under milestone M1 — Foundation)
**Environment:** hosted (CLAUDOMAT_CLAUDE_SESSION set)

## What exists
- Bets → `founder_bets` table (2 live: integrated-platform, compliance-first-wedge)
- Roadmap (milestones) → `milestones` table (12: 7 H1 / 3 H2 / 2 H3)
- First-wave seed task → `tasks` table (M1 walking skeleton)
- Founder stage + decisions → `command-center/product/founder-stage.md` (pilot-customer) + `product-decisions.md`
- Competitor research (Tier 1/2/3) → `command-center/artifacts/competitive-benchmarks/` (10 competitors)
- Architecture (8 domains + library, module-list locked) → `command-center/dev/architecture/`
- Design direction + system + 20 per-page mockups → `design/`
- Agents → 8 Heads + 7 BOARD seats (incl. founder-proxy) + all executors/verifiers at `~/.claude/agents/`
- CI pipeline → `.github/workflows/ci.yml`; charter → `command-center/management/ceo-blocklist.md`

## ⚠ Action needed from the founder — GitHub access
The founder chose to host the code on a new private GitHub repo, but the GitHub access token in this environment is **invalid** (`gh` returns HTTP 401 "Bad credentials"), so the repo could not be created and the commit could not be pushed. **The code is safely committed locally on `main` (901f477).** Once GitHub is reconnected (valid token / `gh auth login`), the repo can be created and pushed — and the first wave's pull-request + CI step (C-1) needs this too. Until then wave-1 can build locally but cannot open a PR / run CI.

## Next — enter the wave loop
Onboarding is done — the wave loop is open. To start the first wave, say:

> "Start the first wave"

`claudomat-brain/DISPATCHER.md` step 0 reads `process/session/.last-wave-completed.yaml` (`loop_state: ready`, seed `e83584db…`), runs preflight (capability-sheet refresh + `claudomat doctor`), and enters `claudomat-brain/blocks/product/product.md` → **P-0 Frame** on the seed task.

**One-time agent load (hosted):** The agents installed during onboarding register only when the brain runs on a fresh process. On hosted, the worker recycles the brain once at this onboarding→wave boundary — send "Start the first wave" to begin. If the first wave reports a missing Head agent ("agent not found"), the brain was not recycled: restart or resume the session from Studio, then resend "Start the first wave".

## Modes (post-onboarding)
Current mode flag: `automatic` (BOARD resolves ambiguity; splits + hard-stops to founder). To change, type the mode name verbatim:
- `default` — skip nice-to-haves; strategic + hard-stops to founder. No `/loop`.
- `automatic` — BOARD (7 seats) resolves ambiguity. Bootstraps `/loop`.
- `degenerate` — ceo-agent within `command-center/management/ceo-blocklist.md` charter (permissive, authored). Bootstraps `/loop`; per-decision email.

Type `founder-review` (or delete `process/session/.autonomous-session`) to revert. Full spec: `claudomat-brain/management/mode-switching.md`.

## Residual environment notes (non-blocking)
- **GitHub token invalid** — see the action-needed section above.
- **Playwright Chrome binary not installed** (root-only) — blocks live E2E (T-5) / layout (T-6) until installed host-side. Flagged in architecture/test.md + devops.md + competitive-benchmarks/INDEX.md.
- **CLAUDOMAT_DB_URL role** — connects as a per-brain role (`brain_290fe959…`) with the exact required grants (verified: waves INSERT/UPDATE + full CRUD on bets/milestones/tasks succeed); `claudomat doctor`'s literal `claudomat_brain`-role check is a studio-provisioning advisory, not a functional gap.
