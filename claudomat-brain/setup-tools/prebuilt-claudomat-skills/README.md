# Prebuilt claudomat skills

Ready-to-install Claude Code skills bundled with the claudomat brain. Install Phase 4 step "Claudomat-bundled skills" copies these wholesale to `~/.claude/skills/<name>/SKILL.md` BEFORE the gstack collection install.

## Why bundled

Same discipline as `prebuilt-claudomat-agents/` (sibling directory): skills with claudomat-internal scope, skills that exist upstream as agents-not-skills, or upstream-vendored skills that are too load-bearing to leave behind a fragile external `git clone` get bundled here. We re-package them as proper slash-skills so they integrate with `claudomat-brain/rules/skill-use.md` routing and fire automatically at the stages that need them. For upstream-vendored entries (MIT-licensed third-party skills) we keep the original `LICENSE` and attribution intact in-tree.

## Files

| Skill | Source | Why bundled |
|---|---|---|
| `simplify/SKILL.md` | Anthropic official code-simplifier agent (<https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md>) — re-packaged from agent format to skill format | gstack ships `codebase-simplifier` (full-codebase, fork-context) but not `simplify` (recent-diff, in-process). claudomat needs both: `/simplify` fires at B-6 review per `claudomat-brain/blocks/build/build.md`; `/codebase-simplifier` is on-demand. The official agent's content is the canonical source; we convert it to skill form and ship. |
| `gemini-deep-research/` (`SKILL.md` + `scripts/*.py` + `LICENSE`) | Hongyu Yu — `github.com/Hongyu-yu/gemini-deep-research-skill` (MIT). **Upstream repo was deleted after we vendored**; we are now the canonical copy. | REQUIRED by `agent-creator` Stage 1 research briefs (`claudomat-brain/setup-tools/agent-creator/agent-creator.md`). v0 HARD GATE in `claudomat-brain/onboarding/onboarding-loop.md`; v11/v12 enforce install before heads / BOARD / bespoke executors. Without it, agent generation degrades to manual brief drafting — silent quality loss. Python-backed skill (`requests` + `httpx`) over the Gemini Interactions REST API; requires `GEMINI_API_KEY` or `GOOGLE_API_KEY` at runtime. MIT LICENSE preserved verbatim per attribution clause. |

## Install procedure

`claudomat-brain/setup-tools/install.md` Phase 4 includes a "Claudomat-bundled skills" step (BEFORE the gstack wholesale install):

```bash
mkdir -p ~/.claude/skills
for skill_dir in claudomat-brain/setup-tools/prebuilt-claudomat-skills/*/; do
  skill_name="$(basename "$skill_dir")"
  mkdir -p "$HOME/.claude/skills/$skill_name"
  cp -r "$skill_dir"* "$HOME/.claude/skills/$skill_name/"
done
```

The `cp` (without `-n`) IS the right behavior here — claudomat owns these skill names. The gstack wholesale install in step 2 uses `cp -n` so it can't overwrite.

## Versioning

Skills version with the brain. `claudomat sync` replaces `claudomat-brain/` wholesale, including this directory. Phase 4 re-runs on demand and re-copies the latest skill content.

## Discipline rule for adding skills to this directory

Bundled skills must satisfy ANY of:

1. **Claudomat-specific routing** — fires at a specific brain stage (B-6 / L-2 / etc.) that gstack doesn't know about.
2. **Re-packaging from upstream agent format** — exists upstream as an agent but claudomat needs slash-skill exposure for stage routing.
3. **No upstream equivalent** — gstack / Anthropic-official / community catalogs don't ship it.
4. **Upstream-fragile critical dependency** — third-party MIT-licensed skill that claudomat treats as REQUIRED (HARD GATEs reference it), but upstream is single-maintainer / archived / has already disappeared. Vendor with `LICENSE` + attribution preserved to remove the install-time fetch and the disappearance risk.

If a skill fails all four, it stays in gstack or goes through normal Phase 4 install. Keeps the bundled set minimal.
